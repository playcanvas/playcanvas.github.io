class WebgpuQuerySet {
  constructor(device, isTimestamp, capacity) {
    this.querySet = void 0;
    this.stagingBuffers = [];
    this.activeStagingBuffer = null;
    this.bytesPerSlot = void 0;
    this.device = device;
    this.capacity = capacity;
    this.bytesPerSlot = isTimestamp ? 8 : 4;
    const wgpu = device.wgpu;
    this.querySet = wgpu.createQuerySet({
      type: isTimestamp ? 'timestamp' : 'occlusion',
      count: capacity
    });
    this.queryBuffer = wgpu.createBuffer({
      size: this.bytesPerSlot * capacity,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
  }
  destroy() {
    var _this$querySet, _this$queryBuffer;
    (_this$querySet = this.querySet) == null || _this$querySet.destroy();
    this.querySet = null;
    (_this$queryBuffer = this.queryBuffer) == null || _this$queryBuffer.destroy();
    this.queryBuffer = null;
    this.activeStagingBuffer = null;
    this.stagingBuffers.forEach(stagingBuffer => {
      stagingBuffer.destroy();
    });
    this.stagingBuffers = null;
  }
  getStagingBuffer() {
    let stagingBuffer = this.stagingBuffers.pop();
    if (!stagingBuffer) {
      stagingBuffer = this.device.wgpu.createBuffer({
        size: this.queryBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
    }
    return stagingBuffer;
  }
  resolve(count) {
    const device = this.device;
    const commandEncoder = device.wgpu.createCommandEncoder();
    commandEncoder.resolveQuerySet(this.querySet, 0, count, this.queryBuffer, 0);
    const activeStagingBuffer = this.getStagingBuffer();
    this.activeStagingBuffer = activeStagingBuffer;
    commandEncoder.copyBufferToBuffer(this.queryBuffer, 0, activeStagingBuffer, 0, this.bytesPerSlot * count);
    const cb = commandEncoder.finish();
    device.addCommandBuffer(cb);
  }
  request(count, renderVersion) {
    const stagingBuffer = this.activeStagingBuffer;
    this.activeStagingBuffer = null;
    return stagingBuffer.mapAsync(GPUMapMode.READ).then(() => {
      var _this$stagingBuffers;
      const srcTimings = new BigInt64Array(stagingBuffer.getMappedRange());
      const timings = [];
      for (let i = 0; i < count; i++) {
        timings.push(Number(srcTimings[i * 2 + 1] - srcTimings[i * 2]) * 0.000001);
      }
      stagingBuffer.unmap();
      (_this$stagingBuffers = this.stagingBuffers) == null || _this$stagingBuffers.push(stagingBuffer);
      return {
        renderVersion,
        timings
      };
    });
  }
}

export { WebgpuQuerySet };
