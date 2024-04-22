import { BindGroup } from '../bind-group.js';
import { UniformBuffer } from '../uniform-buffer.js';

class WebgpuCompute {
  constructor(compute) {
    this.uniformBuffers = [];
    this.bindGroup = null;
    this.compute = compute;
    const {
      device,
      shader
    } = compute;
    const {
      computeBindGroupFormat,
      computeUniformBufferFormats
    } = shader.impl;
    this.bindGroup = new BindGroup(device, computeBindGroupFormat);
    if (computeUniformBufferFormats) {
      for (const name in computeUniformBufferFormats) {
        if (computeUniformBufferFormats.hasOwnProperty(name)) {
          const ub = new UniformBuffer(device, computeUniformBufferFormats[name], true);
          this.uniformBuffers.push(ub);
          this.bindGroup.setUniformBuffer(name, ub);
        }
      }
    }
    this.pipeline = device.computePipeline.get(shader, computeBindGroupFormat);
  }
  destroy() {
    this.uniformBuffers.forEach(ub => ub.destroy());
    this.uniformBuffers.length = 0;
    this.bindGroup.destroy();
    this.bindGroup = null;
  }
  updateBindGroup() {
    const {
      bindGroup
    } = this;
    bindGroup.updateUniformBuffers();
    bindGroup.update();
  }
  dispatch(x, y, z) {
    const device = this.compute.device;
    device.setBindGroup(0, this.bindGroup);
    const passEncoder = device.passEncoder;
    passEncoder.setPipeline(this.pipeline);
    passEncoder.dispatchWorkgroups(x, y, z);
  }
}

export { WebgpuCompute };
