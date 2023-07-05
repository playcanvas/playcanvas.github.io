import '../../core/debug.js';
import { math } from '../../core/math/math.js';

let stagingCount = 0;
let gpuCount = 0;
class DynamicBuffer {
	constructor(device) {
		this.device = void 0;
		this.device = device;
	}
}
class UsedBuffer {
	constructor() {
		this.gpuBuffer = void 0;
		this.stagingBuffer = void 0;
		this.offset = void 0;
		this.size = void 0;
	}
}
class DynamicBufferAllocation {
	constructor() {
		this.storage = void 0;
		this.gpuBuffer = void 0;
		this.offset = void 0;
	}
}
class DynamicBuffers {
	constructor(device, bufferSize, bufferAlignment) {
		this.bufferSize = void 0;
		this.gpuBuffers = [];
		this.stagingBuffers = [];
		this.usedBuffers = [];
		this.activeBuffer = null;
		this.device = device;
		this.bufferSize = bufferSize;
		this.bufferAlignment = bufferAlignment;
	}
	destroy() {
		this.gpuBuffers.forEach(gpuBuffer => {
			gpuBuffer.destroy(this.device);
		});
		this.gpuBuffers = null;
		this.stagingBuffers.forEach(stagingBuffer => {
			stagingBuffer.destroy(this.device);
		});
		this.stagingBuffers = null;
		this.usedBuffers = null;
		this.activeBuffer = null;
	}
	alloc(allocation, size) {
		if (this.activeBuffer) {
			const _alignedStart = math.roundUp(this.activeBuffer.size, this.bufferAlignment);
			const space = this.bufferSize - _alignedStart;
			if (space < size) {
				this.scheduleSubmit();
			}
		}
		if (!this.activeBuffer) {
			let gpuBuffer = this.gpuBuffers.pop();
			if (!gpuBuffer) {
				gpuCount++;
				console.log('allocating new gpu buffer ', gpuCount);
				gpuBuffer = this.createBuffer(this.device, this.bufferSize, false);
			}
			let stagingBuffer = this.stagingBuffers.pop();
			if (!stagingBuffer) {
				stagingCount++;
				console.log('allocating new STAGING buffer', stagingCount);
				stagingBuffer = this.createBuffer(this.device, this.bufferSize, true);
			}
			this.activeBuffer = new UsedBuffer();
			this.activeBuffer.stagingBuffer = stagingBuffer;
			this.activeBuffer.gpuBuffer = gpuBuffer;
			this.activeBuffer.offset = 0;
			this.activeBuffer.size = 0;
		}
		const activeBuffer = this.activeBuffer;
		const alignedStart = math.roundUp(activeBuffer.size, this.bufferAlignment);
		allocation.gpuBuffer = activeBuffer.gpuBuffer;
		allocation.offset = alignedStart;
		allocation.storage = activeBuffer.stagingBuffer.alloc(alignedStart, size);
		activeBuffer.size = alignedStart + size;
	}
	scheduleSubmit() {
		if (this.activeBuffer) {
			this.usedBuffers.push(this.activeBuffer);
			this.activeBuffer = null;
		}
	}
	submit() {
		this.scheduleSubmit();
	}
}

export { DynamicBuffer, DynamicBufferAllocation, DynamicBuffers };
