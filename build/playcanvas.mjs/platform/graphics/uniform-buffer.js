import '../../core/tracing.js';
import { UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_INT, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3 } from './constants.js';

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

class UniformBuffer {
  constructor(graphicsDevice, format) {
    this.device = graphicsDevice;
    this.format = format;
    this.impl = graphicsDevice.createUniformBufferImpl(this);
    this.storage = new ArrayBuffer(format.byteSize);
    this.storageFloat32 = new Float32Array(this.storage);
    this.storageInt32 = new Int32Array(this.storage);
    graphicsDevice._vram.ub += this.format.byteSize;

  }

  destroy() {
    const device = this.device;

    this.impl.destroy(device);
    device._vram.ub -= this.format.byteSize;
  }

  loseContext() {
    this.impl.loseContext();
  }

  setUniform(uniformFormat) {
    const offset = uniformFormat.offset;
    const value = uniformFormat.scopeId.value;
    if (value !== null && value !== undefined) {
      const updateFunction = _updateFunctions[uniformFormat.type];
      if (updateFunction) {
        updateFunction(this, value, offset);
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
    const uniforms = this.format.uniforms;
    for (let i = 0; i < uniforms.length; i++) {
      this.setUniform(uniforms[i]);
    }

    this.impl.unlock(this);
  }
}

export { UniformBuffer };
