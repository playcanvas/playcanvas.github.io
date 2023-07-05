import '../../core/debug.js';
import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_INT, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY } from './constants.js';
import { DynamicBufferAllocation } from './dynamic-buffers.js';

const _updateFunctions = [];
_updateFunctions[UNIFORMTYPE_FLOAT] = function (uniformBuffer, value, offset) {
	const dst = uniformBuffer.storageFloat32;
	dst[offset] = value;
};
_updateFunctions[UNIFORMTYPE_VEC2] = (uniformBuffer, value, offset) => {
	const dst = uniformBuffer.storageFloat32;
	dst[offset] = value[0];
	dst[offset + 1] = value[1];
};
_updateFunctions[UNIFORMTYPE_VEC3] = (uniformBuffer, value, offset) => {
	const dst = uniformBuffer.storageFloat32;
	dst[offset] = value[0];
	dst[offset + 1] = value[1];
	dst[offset + 2] = value[2];
};
_updateFunctions[UNIFORMTYPE_VEC4] = (uniformBuffer, value, offset) => {
	const dst = uniformBuffer.storageFloat32;
	dst[offset] = value[0];
	dst[offset + 1] = value[1];
	dst[offset + 2] = value[2];
	dst[offset + 3] = value[3];
};
_updateFunctions[UNIFORMTYPE_INT] = function (uniformBuffer, value, offset) {
	const dst = uniformBuffer.storageInt32;
	dst[offset] = value;
};
_updateFunctions[UNIFORMTYPE_IVEC2] = function (uniformBuffer, value, offset) {
	const dst = uniformBuffer.storageInt32;
	dst[offset] = value[0];
	dst[offset + 1] = value[1];
};
_updateFunctions[UNIFORMTYPE_IVEC3] = function (uniformBuffer, value, offset) {
	const dst = uniformBuffer.storageInt32;
	dst[offset] = value[0];
	dst[offset + 1] = value[1];
	dst[offset + 2] = value[2];
};
_updateFunctions[UNIFORMTYPE_IVEC4] = function (uniformBuffer, value, offset) {
	const dst = uniformBuffer.storageInt32;
	dst[offset] = value[0];
	dst[offset + 1] = value[1];
	dst[offset + 2] = value[2];
	dst[offset + 3] = value[3];
};
_updateFunctions[UNIFORMTYPE_MAT2] = (uniformBuffer, value, offset) => {
	const dst = uniformBuffer.storageFloat32;
	dst[offset] = value[0];
	dst[offset + 1] = value[1];
	dst[offset + 4] = value[2];
	dst[offset + 5] = value[3];
	dst[offset + 8] = value[4];
	dst[offset + 9] = value[5];
};
_updateFunctions[UNIFORMTYPE_MAT3] = (uniformBuffer, value, offset) => {
	const dst = uniformBuffer.storageFloat32;
	dst[offset] = value[0];
	dst[offset + 1] = value[1];
	dst[offset + 2] = value[2];
	dst[offset + 4] = value[3];
	dst[offset + 5] = value[4];
	dst[offset + 6] = value[5];
	dst[offset + 8] = value[6];
	dst[offset + 9] = value[7];
	dst[offset + 10] = value[8];
};
_updateFunctions[UNIFORMTYPE_FLOATARRAY] = function (uniformBuffer, value, offset, count) {
	const dst = uniformBuffer.storageFloat32;
	for (let i = 0; i < count; i++) {
		dst[offset + i * 4] = value[i];
	}
};
_updateFunctions[UNIFORMTYPE_VEC2ARRAY] = (uniformBuffer, value, offset, count) => {
	const dst = uniformBuffer.storageFloat32;
	for (let i = 0; i < count; i++) {
		dst[offset + i * 4] = value[i * 2];
		dst[offset + i * 4 + 1] = value[i * 2 + 1];
	}
};
_updateFunctions[UNIFORMTYPE_VEC3ARRAY] = (uniformBuffer, value, offset, count) => {
	const dst = uniformBuffer.storageFloat32;
	for (let i = 0; i < count; i++) {
		dst[offset + i * 4] = value[i * 3];
		dst[offset + i * 4 + 1] = value[i * 3 + 1];
		dst[offset + i * 4 + 2] = value[i * 3 + 2];
	}
};
class UniformBuffer {
	constructor(graphicsDevice, format, persistent = true) {
		this.device = void 0;
		this.persistent = void 0;
		this.allocation = void 0;
		this.storageFloat32 = void 0;
		this.storageInt32 = void 0;
		this.renderVersionDirty = 0;
		this.device = graphicsDevice;
		this.format = format;
		this.persistent = persistent;
		if (persistent) {
			this.impl = graphicsDevice.createUniformBufferImpl(this);
			const storage = new ArrayBuffer(format.byteSize);
			this.assignStorage(new Int32Array(storage));
			graphicsDevice._vram.ub += this.format.byteSize;
		} else {
			this.allocation = new DynamicBufferAllocation();
		}
	}
	destroy() {
		if (this.persistent) {
			const device = this.device;
			this.impl.destroy(device);
			device._vram.ub -= this.format.byteSize;
		}
	}
	get offset() {
		return this.persistent ? 0 : this.allocation.offset;
	}
	assignStorage(storage) {
		this.storageInt32 = storage;
		this.storageFloat32 = new Float32Array(storage.buffer, storage.byteOffset, storage.byteLength / 4);
	}
	loseContext() {
		var _this$impl;
		(_this$impl = this.impl) == null ? void 0 : _this$impl.loseContext();
	}
	setUniform(uniformFormat) {
		const offset = uniformFormat.offset;
		const value = uniformFormat.scopeId.value;
		if (value !== null && value !== undefined) {
			const updateFunction = _updateFunctions[uniformFormat.updateType];
			if (updateFunction) {
				updateFunction(this, value, offset, uniformFormat.count);
			} else {
				this.storageFloat32.set(value, offset);
			}
		}
	}
	set(name) {
		const uniformFormat = this.format.map.get(name);
		if (uniformFormat) {
			this.setUniform(uniformFormat);
		}
	}
	update() {
		const persistent = this.persistent;
		if (!persistent) {
			const allocation = this.allocation;
			const oldGpuBuffer = allocation.gpuBuffer;
			this.device.dynamicBuffers.alloc(allocation, this.format.byteSize);
			this.assignStorage(allocation.storage);
			if (oldGpuBuffer !== allocation.gpuBuffer) {
				this.renderVersionDirty = this.device.renderVersion;
			}
		}
		const uniforms = this.format.uniforms;
		for (let i = 0; i < uniforms.length; i++) {
			this.setUniform(uniforms[i]);
		}
		if (persistent) {
			this.impl.unlock(this);
		} else {
			this.storageFloat32 = null;
			this.storageInt32 = null;
		}
	}
}

export { UniformBuffer };
