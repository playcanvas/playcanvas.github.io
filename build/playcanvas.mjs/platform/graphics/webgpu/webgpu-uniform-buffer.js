import { WebgpuBuffer } from './webgpu-buffer.js';

class WebgpuUniformBuffer extends WebgpuBuffer {
	constructor(uniformBuffer) {
		super();
	}
	destroy(device) {
		super.destroy(device);
	}
	unlock(uniformBuffer) {
		const device = uniformBuffer.device;
		super.unlock(device, undefined, GPUBufferUsage.UNIFORM, uniformBuffer.storage);
	}
}

export { WebgpuUniformBuffer };
