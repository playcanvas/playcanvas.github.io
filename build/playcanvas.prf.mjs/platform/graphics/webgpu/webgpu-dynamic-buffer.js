import '../../../core/debug.js';
import { DynamicBuffer } from '../dynamic-buffers.js';

class WebgpuDynamicBuffer extends DynamicBuffer {
	constructor(device, size, isStaging) {
		super(device);
		this.buffer = null;
		this.mappedRange = null;
		this.buffer = device.wgpu.createBuffer({
			size: size,
			usage: isStaging ? GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC : GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			mappedAtCreation: isStaging
		});
		if (isStaging) {
			this.onAvailable();
		}
		device._vram.ub += size;
	}
	destroy(device) {
		device._vram.ub -= this.buffer.size;
		this.buffer.destroy();
		this.buffer = null;
	}
	onAvailable() {
		this.mappedRange = this.buffer.getMappedRange();
	}
	alloc(offset, size) {
		return new Int32Array(this.mappedRange, offset, size);
	}
}

export { WebgpuDynamicBuffer };
