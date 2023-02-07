class WebgpuBuffer {
	constructor() {
		this.buffer = null;
	}
	destroy(device) {
		if (this.buffer) {
			this.buffer.destroy();
			this.buffer = null;
		}
	}
	get initialized() {
		return !!this.buffer;
	}
	loseContext() {}
	unlock(device, usage, target, storage) {
		var _storage$byteOffset, _storage$buffer;
		const wgpu = device.wgpu;
		if (!this.buffer) {
			const size = storage.byteLength + 3 & ~3;
			this.buffer = device.wgpu.createBuffer({
				size: size,
				usage: target | GPUBufferUsage.COPY_DST
			});
		}
		const srcOffset = (_storage$byteOffset = storage.byteOffset) != null ? _storage$byteOffset : 0;
		const srcData = new Uint8Array((_storage$buffer = storage.buffer) != null ? _storage$buffer : storage, srcOffset, storage.byteLength);
		const data = new Uint8Array(this.buffer.size);
		data.set(srcData);
		wgpu.queue.writeBuffer(this.buffer, 0, data, 0, data.length);
	}
}

export { WebgpuBuffer };
