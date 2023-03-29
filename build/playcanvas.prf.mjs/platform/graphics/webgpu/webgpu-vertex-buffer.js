/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { WebgpuBuffer } from './webgpu-buffer.js';

class WebgpuVertexBuffer extends WebgpuBuffer {
	constructor(vertexBuffer, format) {
		super();
	}
	destroy(device) {
		super.destroy(device);
	}
	unlock(vertexBuffer) {
		const device = vertexBuffer.device;
		super.unlock(device, vertexBuffer.usage, GPUBufferUsage.VERTEX, vertexBuffer.storage);
	}
}

export { WebgpuVertexBuffer };
