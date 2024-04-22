import { WebgpuPipeline } from './webgpu-pipeline.js';

class WebgpuComputePipeline extends WebgpuPipeline {
  get(shader, bindGroupFormat) {
    const pipelineLayout = this.getPipelineLayout([bindGroupFormat.impl]);
    const pipeline = this.create(shader, pipelineLayout);
    return pipeline;
  }
  create(shader, pipelineLayout) {
    const wgpu = this.device.wgpu;
    const webgpuShader = shader.impl;
    const descr = {
      compute: {
        module: webgpuShader.getComputeShaderModule(),
        entryPoint: webgpuShader.computeEntryPoint
      },
      layout: pipelineLayout
    };
    const pipeline = wgpu.createComputePipeline(descr);
    return pipeline;
  }
}

export { WebgpuComputePipeline };
