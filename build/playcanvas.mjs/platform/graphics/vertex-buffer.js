import '../../core/debug.js';
import { BUFFER_STATIC } from './constants.js';

let id = 0;
class VertexBuffer {
	constructor(graphicsDevice, format, numVertices, usage = BUFFER_STATIC, initialData) {
		this.device = graphicsDevice;
		this.format = format;
		this.numVertices = numVertices;
		this.usage = usage;
		this.id = id++;
		this.impl = graphicsDevice.createVertexBufferImpl(this, format);
		this.numBytes = format.verticesByteSize ? format.verticesByteSize : format.size * numVertices;
		this.adjustVramSizeTracking(graphicsDevice._vram, this.numBytes);
		if (initialData) {
			this.setData(initialData);
		} else {
			this.storage = new ArrayBuffer(this.numBytes);
		}
		this.device.buffers.push(this);
	}
	destroy() {
		const device = this.device;
		const idx = device.buffers.indexOf(this);
		if (idx !== -1) {
			device.buffers.splice(idx, 1);
		}
		if (this.impl.initialized) {
			this.impl.destroy(device);
			this.adjustVramSizeTracking(device._vram, -this.storage.byteLength);
		}
	}
	adjustVramSizeTracking(vram, size) {
		vram.vb += size;
	}
	loseContext() {
		this.impl.loseContext();
	}
	getFormat() {
		return this.format;
	}
	getUsage() {
		return this.usage;
	}
	getNumVertices() {
		return this.numVertices;
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
}

export { VertexBuffer };
