class WebgpuBindGroup {
  constructor() {
    this.bindGroup = void 0;
  }
  update(bindGroup) {
    this.destroy();
    const device = bindGroup.device;
    const descr = this.createDescriptor(device, bindGroup);
    this.bindGroup = device.wgpu.createBindGroup(descr);
  }
  destroy() {
    this.bindGroup = null;
  }
  createDescriptor(device, bindGroup) {
    const entries = [];
    const format = bindGroup.format;
    const uniformBufferFormats = bindGroup.format.uniformBufferFormats;
    bindGroup.uniformBuffers.forEach((ub, i) => {
      const slot = uniformBufferFormats[i].slot;
      const buffer = ub.persistent ? ub.impl.buffer : ub.allocation.gpuBuffer.buffer;
      entries.push({
        binding: slot,
        resource: {
          buffer: buffer,
          offset: 0,
          size: ub.format.byteSize
        }
      });
    });
    const textureFormats = bindGroup.format.textureFormats;
    bindGroup.textures.forEach((tex, textureIndex) => {
      const wgpuTexture = tex.impl;
      const textureFormat = format.textureFormats[textureIndex];
      const slot = textureFormats[textureIndex].slot;
      const view = wgpuTexture.getView(device);
      entries.push({
        binding: slot,
        resource: view
      });
      if (textureFormat.hasSampler) {
        const sampler = wgpuTexture.getSampler(device, textureFormat.sampleType);
        entries.push({
          binding: slot + 1,
          resource: sampler
        });
      }
    });
    const storageTextureFormats = bindGroup.format.storageTextureFormats;
    bindGroup.storageTextures.forEach((tex, textureIndex) => {
      const wgpuTexture = tex.impl;
      const slot = storageTextureFormats[textureIndex].slot;
      const view = wgpuTexture.getView(device);
      entries.push({
        binding: slot,
        resource: view
      });
    });
    const storageBufferFormats = bindGroup.format.storageBufferFormats;
    bindGroup.storageBuffers.forEach((buffer, bufferIndex) => {
      const wgpuBuffer = buffer.impl.buffer;
      const slot = storageBufferFormats[bufferIndex].slot;
      entries.push({
        binding: slot,
        resource: {
          buffer: wgpuBuffer
        }
      });
    });
    const descr = {
      layout: bindGroup.format.impl.bindGroupLayout,
      entries: entries
    };
    return descr;
  }
}

export { WebgpuBindGroup };
