import { UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';
import '../../core/tracing.js';

class BindGroup {
  constructor(graphicsDevice, format, defaultUniformBuffer) {
    this.device = graphicsDevice;
    this.format = format;
    this.dirty = true;
    this.impl = graphicsDevice.createBindGroupImpl(this);
    this.textures = [];
    this.uniformBuffers = [];

    this.defaultUniformBuffer = defaultUniformBuffer;
    if (defaultUniformBuffer) {
      this.setUniformBuffer(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, defaultUniformBuffer);
    }
  }

  destroy() {
    this.impl.destroy();
    this.impl = null;
    this.format = null;
    this.defaultUniformBuffer = null;
  }

  setUniformBuffer(name, uniformBuffer) {
    const index = this.format.bufferFormatsMap.get(name);
    if (this.uniformBuffers[index] !== uniformBuffer) {
      this.uniformBuffers[index] = uniformBuffer;
      this.dirty = true;
    }
  }

  setTexture(name, texture) {
    const index = this.format.textureFormatsMap.get(name);
    if (this.textures[index] !== texture) {
      this.textures[index] = texture;
      this.dirty = true;
    }
  }

  update() {
    const textureFormats = this.format.textureFormats;
    for (let i = 0; i < textureFormats.length; i++) {
      const textureFormat = textureFormats[i];
      const value = textureFormat.scopeId.value;
      this.setTexture(textureFormat.name, value);
    }
    if (this.dirty) {
      this.dirty = false;
      this.impl.update(this);
    }
  }
}

export { BindGroup };
