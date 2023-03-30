/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
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
