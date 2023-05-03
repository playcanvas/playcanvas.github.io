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
