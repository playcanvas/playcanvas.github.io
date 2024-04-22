class WebgpuBuffer {
  constructor(usageFlags = 0) {
    this.buffer = null;
    this.usageFlags = 0;
    this.usageFlags = usageFlags;
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
  allocate(device, size) {
    this.buffer = device.wgpu.createBuffer({
      size,
      usage: this.usageFlags
    });
  }
  unlock(device, storage) {
    var _storage$byteOffset, _storage$buffer;
    const wgpu = device.wgpu;
    if (!this.buffer) {
      const size = storage.byteLength + 3 & ~3;
      this.usageFlags |= GPUBufferUsage.COPY_DST;
      this.allocate(device, size);
    }
    const srcOffset = (_storage$byteOffset = storage.byteOffset) != null ? _storage$byteOffset : 0;
    const srcData = new Uint8Array((_storage$buffer = storage.buffer) != null ? _storage$buffer : storage, srcOffset, storage.byteLength);
    const data = new Uint8Array(this.buffer.size);
    data.set(srcData);
    wgpu.queue.writeBuffer(this.buffer, 0, data, 0, data.length);
  }
  read(device, offset, size, data) {
    return device.readStorageBuffer(this, offset, size, data);
  }
  write(device, bufferOffset, data, dataOffset, size) {
    device.writeStorageBuffer(this, bufferOffset, data, dataOffset, size);
  }
  clear(device, offset, size) {
    device.clearStorageBuffer(this, offset, size);
  }
}

export { WebgpuBuffer };
