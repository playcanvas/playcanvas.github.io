import { BUFFERUSAGE_STORAGE } from './constants.js';

let id = 0;
class StorageBuffer {
  constructor(graphicsDevice, byteSize, bufferUsage = 0) {
    this.id = id++;
    this.device = graphicsDevice;
    this.byteSize = byteSize;
    this.bufferUsage = bufferUsage;
    this.impl = graphicsDevice.createBufferImpl(BUFFERUSAGE_STORAGE | bufferUsage);
    this.impl.allocate(graphicsDevice, byteSize);
    this.device.buffers.push(this);
    this.adjustVramSizeTracking(graphicsDevice._vram, this.byteSize);
  }
  destroy() {
    const device = this.device;
    const idx = device.buffers.indexOf(this);
    if (idx !== -1) {
      device.buffers.splice(idx, 1);
    }
    this.adjustVramSizeTracking(device._vram, -this.byteSize);
    this.impl.destroy(device);
  }
  adjustVramSizeTracking(vram, size) {
    vram.sb += size;
  }
  read(offset = 0, size = this.byteSize, data = null) {
    return this.impl.read(this.device, offset, size, data);
  }
  write(bufferOffset = 0, data, dataOffset = 0, size) {
    this.impl.write(this.device, bufferOffset, data, dataOffset, size);
  }
  clear(offset = 0, size = this.byteSize) {
    this.impl.clear(this.device, offset, size);
  }
}

export { StorageBuffer };
