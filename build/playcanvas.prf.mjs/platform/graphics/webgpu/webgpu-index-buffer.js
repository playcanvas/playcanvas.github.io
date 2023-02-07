/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';
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
