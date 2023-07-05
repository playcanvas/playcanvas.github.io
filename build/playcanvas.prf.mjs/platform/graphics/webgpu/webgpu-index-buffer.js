import '../../../core/debug.js';
import { INDEXFORMAT_UINT16 } from '../constants.js';
import { WebgpuBuffer } from './webgpu-buffer.js';

class WebgpuIndexBuffer extends WebgpuBuffer {
	constructor(indexBuffer) {
		super();
		this.format = null;
		this.format = indexBuffer.format === INDEXFORMAT_UINT16 ? "uint16" : "uint32";
	}
	unlock(indexBuffer) {
		const device = indexBuffer.device;
		super.unlock(device, indexBuffer.usage, GPUBufferUsage.INDEX, indexBuffer.storage);
	}
}

export { WebgpuIndexBuffer };
