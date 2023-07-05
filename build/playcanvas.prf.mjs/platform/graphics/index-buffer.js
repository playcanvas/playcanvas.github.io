import '../../core/debug.js';
import { typedArrayIndexFormatsByteSize, BUFFER_STATIC, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16 } from './constants.js';

let id = 0;
class IndexBuffer {
	constructor(graphicsDevice, format, numIndices, usage = BUFFER_STATIC, initialData) {
		this.device = graphicsDevice;
		this.format = format;
		this.numIndices = numIndices;
		this.usage = usage;
		this.id = id++;
		this.impl = graphicsDevice.createIndexBufferImpl(this);
		const bytesPerIndex = typedArrayIndexFormatsByteSize[format];
		this.bytesPerIndex = bytesPerIndex;
		this.numBytes = this.numIndices * bytesPerIndex;
		if (initialData) {
			this.setData(initialData);
		} else {
			this.storage = new ArrayBuffer(this.numBytes);
		}
		this.adjustVramSizeTracking(graphicsDevice._vram, this.numBytes);
		this.device.buffers.push(this);
	}
	destroy() {
		const device = this.device;
		const idx = device.buffers.indexOf(this);
		if (idx !== -1) {
			device.buffers.splice(idx, 1);
		}
		if (this.device.indexBuffer === this) {
			this.device.indexBuffer = null;
		}
		if (this.impl.initialized) {
			this.impl.destroy(device);
			this.adjustVramSizeTracking(device._vram, -this.storage.byteLength);
		}
	}
	adjustVramSizeTracking(vram, size) {
		vram.ib += size;
	}
	loseContext() {
		this.impl.loseContext();
	}
	getFormat() {
		return this.format;
	}
	getNumIndices() {
		return this.numIndices;
	}
	lock() {
		return this.storage;
	}
	unlock() {
		this.impl.unlock(this);
	}
	setData(data) {
		if (data.byteLength !== this.numBytes) {
			return false;
		}
		this.storage = data;
		this.unlock();
		return true;
	}
	_lockTypedArray() {
		const lock = this.lock();
		const indices = this.format === INDEXFORMAT_UINT32 ? new Uint32Array(lock) : this.format === INDEXFORMAT_UINT16 ? new Uint16Array(lock) : new Uint8Array(lock);
		return indices;
	}
	writeData(data, count) {
		const indices = this._lockTypedArray();
		if (data.length > count) {
			if (ArrayBuffer.isView(data)) {
				data = data.subarray(0, count);
				indices.set(data);
			} else {
				for (let i = 0; i < count; i++) indices[i] = data[i];
			}
		} else {
			indices.set(data);
		}
		this.unlock();
	}
	readData(data) {
		const indices = this._lockTypedArray();
		const count = this.numIndices;
		if (ArrayBuffer.isView(data)) {
			data.set(indices);
		} else {
			data.length = 0;
			for (let i = 0; i < count; i++) data[i] = indices[i];
		}
		return count;
	}
}

export { IndexBuffer };
