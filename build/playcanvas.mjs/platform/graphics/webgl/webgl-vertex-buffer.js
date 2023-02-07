import { WebglBuffer } from './webgl-buffer.js';

class WebglVertexBuffer extends WebglBuffer {
	constructor(...args) {
		super(...args);
		this.vao = null;
	}
	destroy(device) {
		super.destroy(device);
		device.boundVao = null;
		device.gl.bindVertexArray(null);
	}
	loseContext() {
		super.loseContext();
		this.vao = null;
	}
	unlock(vertexBuffer) {
		const device = vertexBuffer.device;
		super.unlock(device, vertexBuffer.usage, device.gl.ARRAY_BUFFER, vertexBuffer.storage);
	}
}

export { WebglVertexBuffer };
