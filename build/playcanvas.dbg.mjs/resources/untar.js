/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW50YXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9yZXNvdXJjZXMvdW50YXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsibGV0IFVudGFyOyAvLyBzZWUgYmVsb3cgd2h5IHdlIGRlY2xhcmUgdGhpcyBoZXJlXG5cbi8vIFRoZSBVbnRhclNjb3BlIGZ1bmN0aW9uIGlzIGdvaW5nIHRvIGJlIHVzZWRcbi8vIGFzIHRoZSBjb2RlIHRoYXQgZW5kcyB1cCBpbiBhIFdlYiBXb3JrZXIuXG4vLyBUaGUgVW50YXIgdmFyaWFibGUgaXMgZGVjbGFyZWQgb3V0c2lkZSB0aGUgc2NvcGUgc28gdGhhdFxuLy8gd2UgZG8gbm90IGhhdmUgdG8gYWRkIGEgJ3JldHVybicgc3RhdGVtZW50IHRvIHRoZSBVbnRhclNjb3BlIGZ1bmN0aW9uLlxuLy8gV2UgYWxzbyBoYXZlIHRvIG1ha2Ugc3VyZSB0aGF0IHdlIGRvIG5vdCBtYW5nbGUgJ1VudGFyJyB2YXJpYWJsZSBvdGhlcndpc2Vcbi8vIHRoZSBXb3JrZXIgd2lsbCBub3Qgd29yay5cbmZ1bmN0aW9uIFVudGFyU2NvcGUoaXNXb3JrZXIpIHtcbiAgICBsZXQgdXRmRGVjb2RlcjtcbiAgICBsZXQgYXNjaWlEZWNvZGVyO1xuXG4gICAgaWYgKHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHV0ZkRlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoJ3V0Zi04Jyk7XG4gICAgICAgICAgICBhc2NpaURlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoJ3dpbmRvd3MtMTI1MicpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1RleHREZWNvZGVyIG5vdCBzdXBwb3J0ZWQgLSBwYy5VbnRhciBtb2R1bGUgd2lsbCBub3Qgd29yaycpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKCdUZXh0RGVjb2RlciBub3Qgc3VwcG9ydGVkIC0gcGMuVW50YXIgbW9kdWxlIHdpbGwgbm90IHdvcmsnKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBQYXhIZWFkZXIoZmllbGRzKSB7XG4gICAgICAgIHRoaXMuX2ZpZWxkcyA9IGZpZWxkcztcbiAgICB9XG5cbiAgICBQYXhIZWFkZXIucGFyc2UgPSBmdW5jdGlvbiAoYnVmZmVyLCBzdGFydCwgbGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IHBheEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyLCBzdGFydCwgbGVuZ3RoKTtcbiAgICAgICAgbGV0IGJ5dGVzUmVhZCA9IDA7XG4gICAgICAgIGNvbnN0IGZpZWxkcyA9IFtdO1xuXG4gICAgICAgIHdoaWxlIChieXRlc1JlYWQgPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGxldCBzcGFjZUluZGV4O1xuICAgICAgICAgICAgZm9yIChzcGFjZUluZGV4ID0gYnl0ZXNSZWFkOyBzcGFjZUluZGV4IDwgbGVuZ3RoOyBzcGFjZUluZGV4KyspIHtcbiAgICAgICAgICAgICAgICBpZiAocGF4QXJyYXlbc3BhY2VJbmRleF0gPT09IDB4MjApXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3BhY2VJbmRleCA+PSBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgUEFYIGhlYWRlciBkYXRhIGZvcm1hdC4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZmllbGRMZW5ndGggPSBwYXJzZUludCh1dGZEZWNvZGVyLmRlY29kZShuZXcgVWludDhBcnJheShidWZmZXIsIHN0YXJ0ICsgYnl0ZXNSZWFkLCBzcGFjZUluZGV4IC0gYnl0ZXNSZWFkKSksIDEwKTtcbiAgICAgICAgICAgIGNvbnN0IGZpZWxkVGV4dCA9IHV0ZkRlY29kZXIuZGVjb2RlKG5ldyBVaW50OEFycmF5KGJ1ZmZlciwgc3RhcnQgKyBzcGFjZUluZGV4ICsgMSwgZmllbGRMZW5ndGggLSAoc3BhY2VJbmRleCAtIGJ5dGVzUmVhZCkgLSAyKSk7XG4gICAgICAgICAgICBjb25zdCBmaWVsZCA9IGZpZWxkVGV4dC5zcGxpdCgnPScpO1xuXG4gICAgICAgICAgICBpZiAoZmllbGQubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFBBWCBoZWFkZXIgZGF0YSBmb3JtYXQuJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmaWVsZFsxXS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBmaWVsZFsxXSA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpZWxkcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBmaWVsZFswXSxcbiAgICAgICAgICAgICAgICB2YWx1ZTogZmllbGRbMV1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBieXRlc1JlYWQgKz0gZmllbGRMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IFBheEhlYWRlcihmaWVsZHMpO1xuICAgIH07XG5cbiAgICBQYXhIZWFkZXIucHJvdG90eXBlLmFwcGx5SGVhZGVyID0gZnVuY3Rpb24gKGZpbGUpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9maWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxldCBmaWVsZE5hbWUgPSB0aGlzLl9maWVsZHNbaV0ubmFtZTtcbiAgICAgICAgICAgIGNvbnN0IGZpZWxkVmFsdWUgPSB0aGlzLl9maWVsZHNbaV0udmFsdWU7XG5cbiAgICAgICAgICAgIGlmIChmaWVsZE5hbWUgPT09ICdwYXRoJykge1xuICAgICAgICAgICAgICAgIGZpZWxkTmFtZSA9ICduYW1lJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZpZWxkVmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgZmlsZVtmaWVsZE5hbWVdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmaWxlW2ZpZWxkTmFtZV0gPSBmaWVsZFZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQG5hbWUgVW50YXJcbiAgICAgKiBAY2xhc3NkZXNjIFVudGFycyBhIHRhciBhcmNoaXZlIGluIHRoZSBmb3JtIG9mIGFuIGFycmF5IGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciAtIFRoZSBhcnJheSBidWZmZXIgdGhhdCBob2xkcyB0aGUgdGFyIGFyY2hpdmUuXG4gICAgICogQGRlc2NyaXB0aW9uIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgVW50YXIuXG4gICAgICovXG4gICAgZnVuY3Rpb24gVW50YXJJbnRlcm5hbChhcnJheUJ1ZmZlcikge1xuICAgICAgICB0aGlzLl9hcnJheUJ1ZmZlciA9IGFycmF5QnVmZmVyIHx8IG5ldyBBcnJheUJ1ZmZlcigwKTtcbiAgICAgICAgdGhpcy5fYnVmZmVyVmlldyA9IG5ldyBEYXRhVmlldyh0aGlzLl9hcnJheUJ1ZmZlcik7XG4gICAgICAgIHRoaXMuX2dsb2JhbFBheEhlYWRlciA9IG51bGw7XG4gICAgICAgIHRoaXMuX3BheEhlYWRlciA9IG51bGw7XG4gICAgICAgIHRoaXMuX2J5dGVzUmVhZCA9IDA7XG4gICAgfVxuXG4gICAgaWYgKCFpc1dvcmtlcikge1xuICAgICAgICBVbnRhciA9IFVudGFySW50ZXJuYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBVbnRhciNfaGFzTmV4dFxuICAgICAqIEBkZXNjcmlwdGlvbiBXaGV0aGVyIHdlIGhhdmUgbW9yZSBmaWxlcyB0byB1bnRhci5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIG9yIGZhbHNlLlxuICAgICAqL1xuICAgIFVudGFySW50ZXJuYWwucHJvdG90eXBlLl9oYXNOZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYnl0ZXNSZWFkICsgNCA8IHRoaXMuX2FycmF5QnVmZmVyLmJ5dGVMZW5ndGggJiYgdGhpcy5fYnVmZmVyVmlldy5nZXRVaW50MzIodGhpcy5fYnl0ZXNSZWFkKSAhPT0gMDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBVbnRhciNfcmVhZE5leHRGaWxlXG4gICAgICogQGRlc2NyaXB0aW9uIFVudGFycyB0aGUgbmV4dCBmaWxlIGluIHRoZSBhcmNoaXZlLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IFJldHVybnMgYSBmaWxlIGRlc2NyaXB0b3IgaW4gdGhlIGZvbGxvd2luZyBmb3JtYXQ6XG4gICAgICoge25hbWUsIHNpemUsIHN0YXJ0LCB1cmx9LlxuICAgICAqL1xuICAgIFVudGFySW50ZXJuYWwucHJvdG90eXBlLl9yZWFkTmV4dEZpbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IGhlYWRlcnNEYXRhVmlldyA9IG5ldyBEYXRhVmlldyh0aGlzLl9hcnJheUJ1ZmZlciwgdGhpcy5fYnl0ZXNSZWFkLCA1MTIpO1xuICAgICAgICBjb25zdCBoZWFkZXJzID0gYXNjaWlEZWNvZGVyLmRlY29kZShoZWFkZXJzRGF0YVZpZXcpO1xuICAgICAgICB0aGlzLl9ieXRlc1JlYWQgKz0gNTEyO1xuXG4gICAgICAgIGxldCBuYW1lID0gaGVhZGVycy5zdWJzdHJpbmcoMCwgMTAwKS5yZXBsYWNlKC9cXDAvZywgJycpO1xuICAgICAgICBjb25zdCB1c3RhckZvcm1hdCA9IGhlYWRlcnMuc3Vic3RyaW5nKDI1NywgMjYzKTtcbiAgICAgICAgY29uc3Qgc2l6ZSA9IHBhcnNlSW50KGhlYWRlcnMuc3Vic3RyaW5nKDEyNCwgMTM2KSwgOCk7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBoZWFkZXJzLnN1YnN0cmluZygxNTYsIDE1Nyk7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gdGhpcy5fYnl0ZXNSZWFkO1xuICAgICAgICBsZXQgdXJsID0gbnVsbDtcblxuICAgICAgICBsZXQgbm9ybWFsRmlsZSA9IGZhbHNlO1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgJzAnOiBjYXNlICcnOiAvLyBOb3JtYWwgZmlsZVxuICAgICAgICAgICAgICAgIC8vIGRvIG5vdCBjcmVhdGUgYmxvYiBVUkwgaWYgd2UgYXJlIGluIGEgd29ya2VyXG4gICAgICAgICAgICAgICAgLy8gYmVjYXVzZSBpZiB0aGUgd29ya2VyIGlzIGRlc3Ryb3llZCBpdCB3aWxsIGFsc28gZGVzdHJveSB0aGUgYmxvYiBVUkxzXG4gICAgICAgICAgICAgICAgbm9ybWFsRmlsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKCFpc1dvcmtlcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3RoaXMuX2FycmF5QnVmZmVyLnNsaWNlKHRoaXMuX2J5dGVzUmVhZCwgdGhpcy5fYnl0ZXNSZWFkICsgc2l6ZSldKTtcbiAgICAgICAgICAgICAgICAgICAgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdnJzogLy8gR2xvYmFsIFBBWCBoZWFkZXJcbiAgICAgICAgICAgICAgICB0aGlzLl9nbG9iYWxQYXhIZWFkZXIgPSBQYXhIZWFkZXIucGFyc2UodGhpcy5fYXJyYXlCdWZmZXIsIHRoaXMuX2J5dGVzUmVhZCwgc2l6ZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICd4JzogLy8gUEFYIGhlYWRlclxuICAgICAgICAgICAgICAgIHRoaXMuX3BheEhlYWRlciA9IFBheEhlYWRlci5wYXJzZSh0aGlzLl9hcnJheUJ1ZmZlciwgdGhpcy5fYnl0ZXNSZWFkLCBzaXplKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJzEnOiAvLyBMaW5rIHRvIGFub3RoZXIgZmlsZSBhbHJlYWR5IGFyY2hpdmVkXG4gICAgICAgICAgICBjYXNlICcyJzogLy8gU3ltYm9saWMgbGlua1xuICAgICAgICAgICAgY2FzZSAnMyc6IC8vIENoYXJhY3RlciBzcGVjaWFsIGRldmljZVxuICAgICAgICAgICAgY2FzZSAnNCc6IC8vIEJsb2NrIHNwZWNpYWwgZGV2aWNlXG4gICAgICAgICAgICBjYXNlICc1JzogLy8gRGlyZWN0b3J5XG4gICAgICAgICAgICBjYXNlICc2JzogLy8gRklGTyBzcGVjaWFsIGZpbGVcbiAgICAgICAgICAgIGNhc2UgJzcnOiAvLyBSZXNlcnZlZFxuICAgICAgICAgICAgZGVmYXVsdDogLy8gVW5rbm93biBmaWxlIHR5cGVcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2J5dGVzUmVhZCArPSBzaXplO1xuXG4gICAgICAgIC8vIEZpbGUgZGF0YSBpcyBwYWRkZWQgdG8gcmVhY2ggYSA1MTIgYnl0ZSBib3VuZGFyeTsgc2tpcCB0aGUgcGFkZGVkIGJ5dGVzIHRvby5cbiAgICAgICAgY29uc3QgcmVtYWluZGVyID0gc2l6ZSAlIDUxMjtcbiAgICAgICAgaWYgKHJlbWFpbmRlciAhPT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fYnl0ZXNSZWFkICs9ICg1MTIgLSByZW1haW5kZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFub3JtYWxGaWxlKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh1c3RhckZvcm1hdC5pbmRleE9mKCd1c3RhcicpICE9PSAtMSkge1xuICAgICAgICAgICAgY29uc3QgbmFtZVByZWZpeCA9IGhlYWRlcnMuc3Vic3RyaW5nKDM0NSwgNTAwKS5yZXBsYWNlKC9cXDAvZywgJycpO1xuXG4gICAgICAgICAgICBpZiAobmFtZVByZWZpeC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgbmFtZSA9IG5hbWVQcmVmaXgudHJpbSgpICsgbmFtZS50cmltKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmaWxlID0ge1xuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIHN0YXJ0OiBzdGFydCxcbiAgICAgICAgICAgIHNpemU6IHNpemUsXG4gICAgICAgICAgICB1cmw6IHVybFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICh0aGlzLl9nbG9iYWxQYXhIZWFkZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2dsb2JhbFBheEhlYWRlci5hcHBseUhlYWRlcihmaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9wYXhIZWFkZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3BheEhlYWRlci5hcHBseUhlYWRlcihmaWxlKTtcbiAgICAgICAgICAgIHRoaXMuX3BheEhlYWRlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBVbnRhciN1bnRhclxuICAgICAqIEBkZXNjcmlwdGlvbiBVbnRhcnMgdGhlIGFycmF5IGJ1ZmZlciBwcm92aWRlZCBpbiB0aGUgY29uc3RydWN0b3IuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtmaWxlbmFtZVByZWZpeF0gLSBUaGUgcHJlZml4IGZvciBlYWNoIGZpbGVuYW1lIGluIHRoZSB0YXIgYXJjaGl2ZS4gVGhpcyBpcyB1c3VhbGx5IHRoZSB7QGxpbmsgQXNzZXRSZWdpc3RyeX0gcHJlZml4LlxuICAgICAqIEByZXR1cm5zIHtvYmplY3RbXX0gQW4gYXJyYXkgb2YgZmlsZXMgaW4gdGhpcyBmb3JtYXQge25hbWUsIHN0YXJ0LCBzaXplLCB1cmx9LlxuICAgICAqL1xuICAgIFVudGFySW50ZXJuYWwucHJvdG90eXBlLnVudGFyID0gZnVuY3Rpb24gKGZpbGVuYW1lUHJlZml4KSB7XG4gICAgICAgIGlmICghdXRmRGVjb2Rlcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignQ2Fubm90IHVudGFyIGJlY2F1c2UgVGV4dERlY29kZXIgaW50ZXJmYWNlIGlzIG5vdCBhdmFpbGFibGUgZm9yIHRoaXMgcGxhdGZvcm0uJyk7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmaWxlcyA9IFtdO1xuICAgICAgICB3aGlsZSAodGhpcy5faGFzTmV4dCgpKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gdGhpcy5fcmVhZE5leHRGaWxlKCk7XG4gICAgICAgICAgICBpZiAoIWZpbGUpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGZpbGVuYW1lUHJlZml4ICYmIGZpbGUubmFtZSkge1xuICAgICAgICAgICAgICAgIGZpbGUubmFtZSA9IGZpbGVuYW1lUHJlZml4ICsgZmlsZS5uYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmlsZXMucHVzaChmaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmaWxlcztcbiAgICB9O1xuXG4gICAgLy8gaWYgd2UgYXJlIGluIGEgd29ya2VyIHRoZW4gY3JlYXRlIHRoZSBvbm1lc3NhZ2UgaGFuZGxlciB1c2luZyB3b3JrZXIuc2VsZlxuICAgIGlmIChpc1dvcmtlcikge1xuICAgICAgICBzZWxmLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGUuZGF0YS5pZDtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhcmNoaXZlID0gbmV3IFVudGFySW50ZXJuYWwoZS5kYXRhLmFycmF5QnVmZmVyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGFyY2hpdmUudW50YXIoZS5kYXRhLnByZWZpeCk7XG4gICAgICAgICAgICAgICAgLy8gVGhlIHdvcmtlciBpcyBkb25lIHNvIHNlbmQgYSBtZXNzYWdlIHRvIHRoZSBtYWluIHRocmVhZC5cbiAgICAgICAgICAgICAgICAvLyBOb3RpY2Ugd2UgYXJlIHNlbmRpbmcgdGhlIGFycmF5IGJ1ZmZlciBiYWNrIGFzIGEgVHJhbnNmZXJyYWJsZSBvYmplY3RcbiAgICAgICAgICAgICAgICAvLyBzbyB0aGF0IHRoZSBtYWluIHRocmVhZCBjYW4gcmUtYXNzdW1lIGNvbnRyb2wgb2YgdGhlIGFycmF5IGJ1ZmZlci5cbiAgICAgICAgICAgICAgICBwb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgICAgICAgICAgZmlsZXM6IGZpbGVzLFxuICAgICAgICAgICAgICAgICAgICBhcnJheUJ1ZmZlcjogZS5kYXRhLmFycmF5QnVmZmVyXG4gICAgICAgICAgICAgICAgfSwgW2UuZGF0YS5hcnJheUJ1ZmZlcl0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcG9zdE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBlcnIudG9TdHJpbmcoKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbn1cblxuLy8gdGhpcyBpcyB0aGUgVVJMIHRoYXQgaXMgZ29pbmcgdG8gYmUgdXNlZCBmb3Igd29ya2Vyc1xubGV0IHdvcmtlclVybCA9IG51bGw7XG5cbi8vIENvbnZlcnQgdGhlIFVudGFyU2NvcGUgZnVuY3Rpb24gdG8gYSBzdHJpbmcgYW5kIGFkZFxuLy8gdGhlIG9ubWVzc2FnZSBoYW5kbGVyIGZvciB0aGUgd29ya2VyIHRvIHVudGFyIGFyY2hpdmVzXG5mdW5jdGlvbiBnZXRXb3JrZXJVcmwoKSB7XG4gICAgaWYgKCF3b3JrZXJVcmwpIHtcbiAgICAgICAgLy8gZXhlY3V0ZSBVbnRhclNjb3BlIGZ1bmN0aW9uIGluIHRoZSB3b3JrZXJcbiAgICAgICAgY29uc3QgY29kZSA9ICcoJyArIFVudGFyU2NvcGUudG9TdHJpbmcoKSArICcpKHRydWUpXFxuXFxuJztcblxuICAgICAgICAvLyBjcmVhdGUgYmxvYiBVUkwgZm9yIHRoZSBjb2RlIGFib3ZlIHRvIGJlIHVzZWQgZm9yIHRoZSB3b3JrZXJcbiAgICAgICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtjb2RlXSwgeyB0eXBlOiAnYXBwbGljYXRpb24vamF2YXNjcmlwdCcgfSk7XG5cbiAgICAgICAgd29ya2VyVXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICB9XG4gICAgcmV0dXJuIHdvcmtlclVybDtcbn1cblxuLyoqXG4gKiBXcmFwcyB1bnRhcidpbmcgYSB0YXIgYXJjaGl2ZSB3aXRoIGEgV2ViIFdvcmtlci5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFVudGFyV29ya2VyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIG5ldyBpbnN0YW5jZSBvZiBhbiBVbnRhcldvcmtlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZmlsZW5hbWVQcmVmaXhdIC0gVGhlIHByZWZpeCB0aGF0IHNob3VsZCBiZSBhZGRlZCB0byBlYWNoIGZpbGUgbmFtZSBpbiB0aGVcbiAgICAgKiBhcmNoaXZlLiBUaGlzIGlzIHVzdWFsbHkgdGhlIHtAbGluayBBc3NldFJlZ2lzdHJ5fSBwcmVmaXguXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZmlsZW5hbWVQcmVmaXgpIHtcbiAgICAgICAgdGhpcy5fcmVxdWVzdElkID0gMDtcbiAgICAgICAgdGhpcy5fcGVuZGluZ1JlcXVlc3RzID0ge307XG4gICAgICAgIHRoaXMuX2ZpbGVuYW1lUHJlZml4ID0gZmlsZW5hbWVQcmVmaXg7XG4gICAgICAgIHRoaXMuX3dvcmtlciA9IG5ldyBXb3JrZXIoZ2V0V29ya2VyVXJsKCkpO1xuICAgICAgICB0aGlzLl93b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHRoaXMuX29uTWVzc2FnZS5iaW5kKHRoaXMpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge01lc3NhZ2VFdmVudH0gZSAtIFRoZSBtZXNzYWdlIGV2ZW50IGZyb20gdGhlIHdvcmtlci5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1lc3NhZ2UoZSkge1xuICAgICAgICBjb25zdCBpZCA9IGUuZGF0YS5pZDtcbiAgICAgICAgaWYgKCF0aGlzLl9wZW5kaW5nUmVxdWVzdHNbaWRdKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSB0aGlzLl9wZW5kaW5nUmVxdWVzdHNbaWRdO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9wZW5kaW5nUmVxdWVzdHNbaWRdO1xuXG4gICAgICAgIGlmIChlLmRhdGEuZXJyb3IpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGUuZGF0YS5lcnJvcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBhcnJheUJ1ZmZlciA9IGUuZGF0YS5hcnJheUJ1ZmZlcjtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIGJsb2IgVVJMcyBmb3IgZWFjaCBmaWxlLiBXZSBhcmUgY3JlYXRpbmcgdGhlIFVSTHNcbiAgICAgICAgICAgIC8vIGhlcmUgLSBvdXRzaWRlIG9mIHRoZSB3b3JrZXIgLSBzbyB0aGF0IHRoZSBtYWluIHRocmVhZCBvd25zIHRoZW1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBlLmRhdGEuZmlsZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0gZS5kYXRhLmZpbGVzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbYXJyYXlCdWZmZXIuc2xpY2UoZmlsZS5zdGFydCwgZmlsZS5zdGFydCArIGZpbGUuc2l6ZSldKTtcbiAgICAgICAgICAgICAgICBmaWxlLnVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGUuZGF0YS5maWxlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbnRhcnMgdGhlIHNwZWNpZmllZCBhcnJheSBidWZmZXIgdXNpbmcgYSBXZWIgV29ya2VyIGFuZCByZXR1cm5zIHRoZSByZXN1bHQgaW4gdGhlIGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheUJ1ZmZlcn0gYXJyYXlCdWZmZXIgLSBUaGUgYXJyYXkgYnVmZmVyIHRoYXQgaG9sZHMgdGhlIHRhciBhcmNoaXZlLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSB3b3JrZXIgaXMgZmluaXNoZWQgb3IgaWZcbiAgICAgKiB0aGVyZSBpcyBhbiBlcnJvci4gVGhlIGNhbGxiYWNrIGhhcyB0aGUgZm9sbG93aW5nIGFyZ3VtZW50czoge2Vycm9yLCBmaWxlc30sIHdoZXJlIGVycm9yIGlzXG4gICAgICogYSBzdHJpbmcgaWYgYW55LCBhbmQgZmlsZXMgaXMgYW4gYXJyYXkgb2YgZmlsZSBkZXNjcmlwdG9ycy5cbiAgICAgKi9cbiAgICB1bnRhcihhcnJheUJ1ZmZlciwgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgaWQgPSB0aGlzLl9yZXF1ZXN0SWQrKztcbiAgICAgICAgdGhpcy5fcGVuZGluZ1JlcXVlc3RzW2lkXSA9IGNhbGxiYWNrO1xuXG4gICAgICAgIC8vIHNlbmQgZGF0YSB0byB0aGUgd29ya2VyIC0gbm90aWNlIHRoZSBsYXN0IGFyZ3VtZW50XG4gICAgICAgIC8vIGNvbnZlcnRzIHRoZSBhcnJheUJ1ZmZlciB0byBhIFRyYW5zZmVycmFibGUgb2JqZWN0XG4gICAgICAgIC8vIHRvIGF2b2lkIGNvcHlpbmcgdGhlIGFycmF5IGJ1ZmZlciB3aGljaCB3b3VsZCBjYXVzZSBhIHN0YWxsLlxuICAgICAgICAvLyBIb3dldmVyIHRoaXMgY2F1c2VzIHRoZSB3b3JrZXIgdG8gYXNzdW1lIGNvbnRyb2wgb2YgdGhlIGFycmF5XG4gICAgICAgIC8vIGJ1ZmZlciBzbyB3ZSBjYW5ub3QgYWNjZXNzIHRoaXMgYnVmZmVyIHVudGlsIHRoZSB3b3JrZXIgaXMgZG9uZSB3aXRoIGl0LlxuICAgICAgICB0aGlzLl93b3JrZXIucG9zdE1lc3NhZ2Uoe1xuICAgICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgICAgcHJlZml4OiB0aGlzLl9maWxlbmFtZVByZWZpeCxcbiAgICAgICAgICAgIGFycmF5QnVmZmVyOiBhcnJheUJ1ZmZlclxuICAgICAgICB9LCBbYXJyYXlCdWZmZXJdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHdoZXRoZXIgdGhlIHdvcmtlciBoYXMgcGVuZGluZyByZXF1ZXN0cyB0byB1bnRhciBhcnJheSBidWZmZXJzLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGVyZSBhcmUgcGVuZGluZyByZXF1ZXN0cyBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGhhc1BlbmRpbmdSZXF1ZXN0cygpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3BlbmRpbmdSZXF1ZXN0cykubGVuZ3RoID4gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgaW50ZXJuYWwgV2ViIFdvcmtlci5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBpZiAodGhpcy5fd29ya2VyKSB7XG4gICAgICAgICAgICB0aGlzLl93b3JrZXIudGVybWluYXRlKCk7XG4gICAgICAgICAgICB0aGlzLl93b3JrZXIgPSBudWxsO1xuXG4gICAgICAgICAgICB0aGlzLl9wZW5kaW5nUmVxdWVzdHMgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBleGVjdXRlIHRoZSBVbnRhclNjb3BlIGZ1bmN0aW9uIGluIG9yZGVyIHRvIGRlY2xhcmUgdGhlIFVudGFyIGNvbnN0cnVjdG9yXG5VbnRhclNjb3BlKCk7XG5cbmV4cG9ydCB7IFVudGFyLCBVbnRhcldvcmtlciB9O1xuIl0sIm5hbWVzIjpbIlVudGFyIiwiVW50YXJTY29wZSIsImlzV29ya2VyIiwidXRmRGVjb2RlciIsImFzY2lpRGVjb2RlciIsIlRleHREZWNvZGVyIiwiZSIsImNvbnNvbGUiLCJ3YXJuIiwiUGF4SGVhZGVyIiwiZmllbGRzIiwiX2ZpZWxkcyIsInBhcnNlIiwiYnVmZmVyIiwic3RhcnQiLCJsZW5ndGgiLCJwYXhBcnJheSIsIlVpbnQ4QXJyYXkiLCJieXRlc1JlYWQiLCJzcGFjZUluZGV4IiwiRXJyb3IiLCJmaWVsZExlbmd0aCIsInBhcnNlSW50IiwiZGVjb2RlIiwiZmllbGRUZXh0IiwiZmllbGQiLCJzcGxpdCIsInB1c2giLCJuYW1lIiwidmFsdWUiLCJwcm90b3R5cGUiLCJhcHBseUhlYWRlciIsImZpbGUiLCJpIiwiZmllbGROYW1lIiwiZmllbGRWYWx1ZSIsIlVudGFySW50ZXJuYWwiLCJhcnJheUJ1ZmZlciIsIl9hcnJheUJ1ZmZlciIsIkFycmF5QnVmZmVyIiwiX2J1ZmZlclZpZXciLCJEYXRhVmlldyIsIl9nbG9iYWxQYXhIZWFkZXIiLCJfcGF4SGVhZGVyIiwiX2J5dGVzUmVhZCIsIl9oYXNOZXh0IiwiYnl0ZUxlbmd0aCIsImdldFVpbnQzMiIsIl9yZWFkTmV4dEZpbGUiLCJoZWFkZXJzRGF0YVZpZXciLCJoZWFkZXJzIiwic3Vic3RyaW5nIiwicmVwbGFjZSIsInVzdGFyRm9ybWF0Iiwic2l6ZSIsInR5cGUiLCJ1cmwiLCJub3JtYWxGaWxlIiwiYmxvYiIsIkJsb2IiLCJzbGljZSIsIlVSTCIsImNyZWF0ZU9iamVjdFVSTCIsInJlbWFpbmRlciIsImluZGV4T2YiLCJuYW1lUHJlZml4IiwidHJpbSIsInVudGFyIiwiZmlsZW5hbWVQcmVmaXgiLCJlcnJvciIsImZpbGVzIiwic2VsZiIsIm9ubWVzc2FnZSIsImlkIiwiZGF0YSIsImFyY2hpdmUiLCJwcmVmaXgiLCJwb3N0TWVzc2FnZSIsImVyciIsInRvU3RyaW5nIiwid29ya2VyVXJsIiwiZ2V0V29ya2VyVXJsIiwiY29kZSIsIlVudGFyV29ya2VyIiwiY29uc3RydWN0b3IiLCJfcmVxdWVzdElkIiwiX3BlbmRpbmdSZXF1ZXN0cyIsIl9maWxlbmFtZVByZWZpeCIsIl93b3JrZXIiLCJXb3JrZXIiLCJhZGRFdmVudExpc3RlbmVyIiwiX29uTWVzc2FnZSIsImJpbmQiLCJjYWxsYmFjayIsImxlbiIsImhhc1BlbmRpbmdSZXF1ZXN0cyIsIk9iamVjdCIsImtleXMiLCJkZXN0cm95IiwidGVybWluYXRlIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBLElBQUlBLE1BQUo7O0FBUUEsU0FBU0MsVUFBVCxDQUFvQkMsUUFBcEIsRUFBOEI7QUFDMUIsRUFBQSxJQUFJQyxVQUFKLENBQUE7QUFDQSxFQUFBLElBQUlDLFlBQUosQ0FBQTs7QUFFQSxFQUFBLElBQUksT0FBT0MsV0FBUCxLQUF1QixXQUEzQixFQUF3QztJQUNwQyxJQUFJO0FBQ0FGLE1BQUFBLFVBQVUsR0FBRyxJQUFJRSxXQUFKLENBQWdCLE9BQWhCLENBQWIsQ0FBQTtBQUNBRCxNQUFBQSxZQUFZLEdBQUcsSUFBSUMsV0FBSixDQUFnQixjQUFoQixDQUFmLENBQUE7S0FGSixDQUdFLE9BQU9DLENBQVAsRUFBVTtNQUNSQyxPQUFPLENBQUNDLElBQVIsQ0FBYSwyREFBYixDQUFBLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FQRCxNQU9PO0lBQ0hELE9BQU8sQ0FBQ0MsSUFBUixDQUFhLDJEQUFiLENBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRUQsU0FBU0MsU0FBVCxDQUFtQkMsTUFBbkIsRUFBMkI7SUFDdkIsSUFB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