class WebgpuPipeline {
  constructor(device) {
    this.device = device;
  }
  getPipelineLayout(bindGroupFormats) {
    const bindGroupLayouts = [];
    bindGroupFormats.forEach(format => {
      bindGroupLayouts.push(format.bindGroupLayout);
    });
    const descr = {
      bindGroupLayouts: bindGroupLayouts
    };
    const pipelineLayout = this.device.wgpu.createPipelineLayout(descr);
    return pipelineLayout;
  }
}

export { WebgpuPipeline };
