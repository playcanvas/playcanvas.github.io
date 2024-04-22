import { DynamicBuffers } from '../dynamic-buffers.js';
import { WebgpuDynamicBuffer } from './webgpu-dynamic-buffer.js';

class WebgpuDynamicBuffers extends DynamicBuffers {
  constructor(...args) {
    super(...args);
    this.pendingStagingBuffers = [];
  }
  createBuffer(device, size, isStaging) {
    return new WebgpuDynamicBuffer(device, size, isStaging);
  }
  submit() {
    super.submit();
    const count = this.usedBuffers.length;
    if (count) {
      const device = this.device;
      const gpuBuffers = this.gpuBuffers;
      const commandEncoder = device.wgpu.createCommandEncoder();
      for (let i = count - 1; i >= 0; i--) {
        const usedBuffer = this.usedBuffers[i];
        const {
          stagingBuffer,
          gpuBuffer,
          offset,
          size
        } = usedBuffer;
        const src = stagingBuffer.buffer;
        src.unmap();
        commandEncoder.copyBufferToBuffer(src, offset, gpuBuffer.buffer, offset, size);
        gpuBuffers.push(gpuBuffer);
      }
      const cb = commandEncoder.finish();
      device.addCommandBuffer(cb, true);
      for (let i = 0; i < count; i++) {
        const stagingBuffer = this.usedBuffers[i].stagingBuffer;
        this.pendingStagingBuffers.push(stagingBuffer);
      }
      this.usedBuffers.length = 0;
    }
  }
  onCommandBuffersSubmitted() {
    const count = this.pendingStagingBuffers.length;
    if (count) {
      for (let i = 0; i < count; i++) {
        const stagingBuffer = this.pendingStagingBuffers[i];
        stagingBuffer.buffer.mapAsync(GPUMapMode.WRITE).then(() => {
          if (this.stagingBuffers) {
            stagingBuffer.onAvailable();
            this.stagingBuffers.push(stagingBuffer);
          }
        });
      }
      this.pendingStagingBuffers.length = 0;
    }
  }
}

export { WebgpuDynamicBuffers };
