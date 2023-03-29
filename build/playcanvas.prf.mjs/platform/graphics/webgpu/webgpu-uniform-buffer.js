/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
