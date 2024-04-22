import { UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';

let id = 0;
class BindGroup {
  constructor(graphicsDevice, format, defaultUniformBuffer) {
    this.renderVersionUpdated = -1;
    this.uniformBuffers = void 0;
    this.uniformBufferOffsets = [];
    this.id = id++;
    this.device = graphicsDevice;
    this.format = format;
    this.dirty = true;
    this.impl = graphicsDevice.createBindGroupImpl(this);
    this.textures = [];
    this.storageTextures = [];
    this.storageBuffers = [];
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
  setStorageBuffer(name, storageBuffer) {
    const index = this.format.storageBufferFormatsMap.get(name);
    if (this.storageBuffers[index] !== storageBuffer) {
      this.storageBuffers[index] = storageBuffer;
      this.dirty = true;
    }
  }
  setTexture(name, texture) {
    const index = this.format.textureFormatsMap.get(name);
    if (this.textures[index] !== texture) {
      this.textures[index] = texture;
      this.dirty = true;
    } else if (this.renderVersionUpdated < texture.renderVersionDirty) {
      this.dirty = true;
    }
  }
  setStorageTexture(name, texture) {
    const index = this.format.storageTextureFormatsMap.get(name);
    if (this.storageTextures[index] !== texture) {
      this.storageTextures[index] = texture;
      this.dirty = true;
    } else if (this.renderVersionUpdated < texture.renderVersionDirty) {
      this.dirty = true;
    }
  }
  updateUniformBuffers() {
    for (let i = 0; i < this.uniformBuffers.length; i++) {
      this.uniformBuffers[i].update();
    }
  }
  update() {
    const {
      textureFormats,
      storageTextureFormats,
      storageBufferFormats
    } = this.format;
    for (let i = 0; i < textureFormats.length; i++) {
      const textureFormat = textureFormats[i];
      const value = textureFormat.scopeId.value;
      this.setTexture(textureFormat.name, value);
    }
    for (let i = 0; i < storageTextureFormats.length; i++) {
      const storageTextureFormat = storageTextureFormats[i];
      const value = storageTextureFormat.scopeId.value;
      this.setStorageTexture(storageTextureFormat.name, value);
    }
    for (let i = 0; i < storageBufferFormats.length; i++) {
      const storageBufferFormat = storageBufferFormats[i];
      const value = storageBufferFormat.scopeId.value;
      this.setStorageBuffer(storageBufferFormat.name, value);
    }
    this.uniformBufferOffsets.length = this.uniformBuffers.length;
    for (let i = 0; i < this.uniformBuffers.length; i++) {
      const uniformBuffer = this.uniformBuffers[i];
      this.uniformBufferOffsets[i] = uniformBuffer.offset;
      if (this.renderVersionUpdated < uniformBuffer.renderVersionDirty) {
        this.dirty = true;
      }
    }
    if (this.dirty) {
      this.dirty = false;
      this.renderVersionUpdated = this.device.renderVersion;
      this.impl.update(this);
    }
  }
}

export { BindGroup };
