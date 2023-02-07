/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';

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
		let index = 0;
		bindGroup.uniformBuffers.forEach(ub => {
			const buffer = ub.impl.buffer;
			entries.push({
				binding: index++,
				resource: {
					buffer: buffer
				}
			});
		});
		bindGroup.textures.forEach(tex => {
			const wgpuTexture = tex.impl;
			const view = wgpuTexture.getView(device);
			entries.push({
				binding: index++,
				resource: view
			});
			const sampler = wgpuTexture.getSampler(device);
			entries.push({
				binding: index++,
				resource: sampler
			});
		});
		return {
			layout: bindGroup.format.impl.bindGroupLayout,
			entries: entries
		};
	}
}

export { WebgpuBindGroup };
