let Untar;
function UntarScope(isWorker) {
	let utfDecoder;
	let asciiDecoder;
	if (typeof TextDecoder !== 'undefined') {
		try {
			utfDecoder = new TextDecoder('utf-8');
			asciiDecoder = new TextDecoder('windows-1252');
		} catch (e) {
			console.warn('TextDecoder not supported - pc.Untar module will not work');
		}
	} else {
		console.warn('TextDecoder not supported - pc.Untar module will not work');
	}
	function PaxHeader(fields) {
		this._fields = fields;
	}
	PaxHeader.parse = function (buffer, start, length) {
		const paxArray = new Uint8Array(buffer, start, length);
		let bytesRead = 0;
		const fields = [];
		while (bytesRead < length) {
			let spaceIndex;
			for (spaceIndex = bytesRead; spaceIndex < length; spaceIndex++) {
				if (paxArray[spaceIndex] === 0x20) break;
			}
			if (spaceIndex >= length) {
				throw new Error('Invalid PAX header data format.');
			}
			const fieldLength = parseInt(utfDecoder.decode(new Uint8Array(buffer, start + bytesRead, spaceIndex - bytesRead)), 10);
			const fieldText = utfDecoder.decode(new Uint8Array(buffer, start + spaceIndex + 1, fieldLength - (spaceIndex - bytesRead) - 2));
			const field = fieldText.split('=');
			if (field.length !== 2) {
				throw new Error('Invalid PAX header data format.');
			}
			if (field[1].length === 0) {
				field[1] = null;
			}
			fields.push({
				name: field[0],
				value: field[1]
			});
			bytesRead += fieldLength;
		}
		return new PaxHeader(fields);
	};
	PaxHeader.prototype.applyHeader = function (file) {
		for (let i = 0; i < this._fields.length; i++) {
			let fieldName = this._fields[i].name;
			const fieldValue = this._fields[i].value;
			if (fieldName === 'path') {
				fieldName = 'name';
			}
			if (fieldValue === null) {
				delete file[fieldName];
			} else {
				file[fieldName] = fieldValue;
			}
		}
	};
	function UntarInternal(arrayBuffer) {
		this._arrayBuffer = arrayBuffer || new ArrayBuffer(0);
		this._bufferView = new DataView(this._arrayBuffer);
		this._globalPaxHeader = null;
		this._paxHeader = null;
		this._bytesRead = 0;
	}
	if (!isWorker) {
		Untar = UntarInternal;
	}
	UntarInternal.prototype._hasNext = function () {
		return this._bytesRead + 4 < this._arrayBuffer.byteLength && this._bufferView.getUint32(this._bytesRead) !== 0;
	};
	UntarInternal.prototype._readNextFile = function () {
		const headersDataView = new DataView(this._arrayBuffer, this._bytesRead, 512);
		const headers = asciiDecoder.decode(headersDataView);
		this._bytesRead += 512;
		let name = headers.substring(0, 100).replace(/\0/g, '');
		const ustarFormat = headers.substring(257, 263);
		const size = parseInt(headers.substring(124, 136), 8);
		const type = headers.substring(156, 157);
		const start = this._bytesRead;
		let url = null;
		let normalFile = false;
		switch (type) {
			case '0':
			case '':
				normalFile = true;
				if (!isWorker) {
					const blob = new Blob([this._arrayBuffer.slice(this._bytesRead, this._bytesRead + size)]);
					url = URL.createObjectURL(blob);
				}
				break;
			case 'g':
				this._globalPaxHeader = PaxHeader.parse(this._arrayBuffer, this._bytesRead, size);
				break;
			case 'x':
				this._paxHeader = PaxHeader.parse(this._arrayBuffer, this._bytesRead, size);
				break;
		}
		this._bytesRead += size;
		const remainder = size % 512;
		if (remainder !== 0) {
			this._bytesRead += 512 - remainder;
		}
		if (!normalFile) {
			return null;
		}
		if (ustarFormat.indexOf('ustar') !== -1) {
			const namePrefix = headers.substring(345, 500).replace(/\0/g, '');
			if (namePrefix.length > 0) {
				name = namePrefix.trim() + name.trim();
			}
		}
		const file = {
			name: name,
			start: start,
			size: size,
			url: url
		};
		if (this._globalPaxHeader) {
			this._globalPaxHeader.applyHeader(file);
		}
		if (this._paxHeader) {
			this._paxHeader.applyHeader(file);
			this._paxHeader = null;
		}
		return file;
	};
	UntarInternal.prototype.untar = function (filenamePrefix) {
		if (!utfDecoder) {
			console.error('Cannot untar because TextDecoder interface is not available for this platform.');
			return [];
		}
		const files = [];
		while (this._hasNext()) {
			const file = this._readNextFile();
			if (!file) continue;
			if (filenamePrefix && file.name) {
				file.name = filenamePrefix + file.name;
			}
			files.push(file);
		}
		return files;
	};
	if (isWorker) {
		self.onmessage = function (e) {
			const id = e.data.id;
			try {
				const archive = new UntarInternal(e.data.arrayBuffer);
				const files = archive.untar(e.data.prefix);
				postMessage({
					id: id,
					files: files,
					arrayBuffer: e.data.arrayBuffer
				}, [e.data.arrayBuffer]);
			} catch (err) {
				postMessage({
					id: id,
					error: err.toString()
				});
			}
		};
	}
}
let workerUrl = null;
function getWorkerUrl() {
	if (!workerUrl) {
		const code = '(' + UntarScope.toString() + ')(true)\n\n';
		const blob = new Blob([code], {
			type: 'application/javascript'
		});
		workerUrl = URL.createObjectURL(blob);
	}
	return workerUrl;
}
class UntarWorker {
	constructor(filenamePrefix) {
		this._requestId = 0;
		this._pendingRequests = {};
		this._filenamePrefix = filenamePrefix;
		this._worker = new Worker(getWorkerUrl());
		this._worker.addEventListener('message', this._onMessage.bind(this));
	}
	_onMessage(e) {
		const id = e.data.id;
		if (!this._pendingRequests[id]) return;
		const callback = this._pendingRequests[id];
		delete this._pendingRequests[id];
		if (e.data.error) {
			callback(e.data.error);
		} else {
			const arrayBuffer = e.data.arrayBuffer;
			for (let i = 0, len = e.data.files.length; i < len; i++) {
				const file = e.data.files[i];
				const blob = new Blob([arrayBuffer.slice(file.start, file.start + file.size)]);
				file.url = URL.createObjectURL(blob);
			}
			callback(null, e.data.files);
		}
	}
	untar(arrayBuffer, callback) {
		const id = this._requestId++;
		this._pendingRequests[id] = callback;
		this._worker.postMessage({
			id: id,
			prefix: this._filenamePrefix,
			arrayBuffer: arrayBuffer
		}, [arrayBuffer]);
	}
	hasPendingRequests() {
		return Object.keys(this._pendingRequests).length > 0;
	}
	destroy() {
		if (this._worker) {
			this._worker.terminate();
			this._worker = null;
			this._pendingRequests = null;
		}
	}
}
UntarScope();

export { Untar, UntarWorker };
