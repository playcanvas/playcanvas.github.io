/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
