import '../../../core/debug.js';
import './webgpu-debug.js';

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
		let index = 0;
		bindGroup.uniformBuffers.forEach(ub => {
			const buffer = ub.persistent ? ub.impl.buffer : ub.allocation.gpuBuffer.buffer;
			entries.push({
				binding: index++,
				resource: {
					buffer: buffer,
					offset: 0,
					size: ub.format.byteSize
				}
			});
		});
		bindGroup.textures.forEach((tex, textureIndex) => {
			const wgpuTexture = tex.impl;
			const textureFormat = format.textureFormats[textureIndex];
			const view = wgpuTexture.getView(device);
			entries.push({
				binding: index++,
				resource: view
			});
			const sampler = wgpuTexture.getSampler(device, textureFormat.sampleType);
			entries.push({
				binding: index++,
				resource: sampler
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
