/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { TEXTUREDIMENSION_2D, SAMPLETYPE_FLOAT } from './constants.js';

class BindBufferFormat {
  constructor(name, visibility) {
    this.name = name;
    this.visibility = visibility;
  }

}

class BindTextureFormat {
  constructor(name, visibility, textureDimension = TEXTUREDIMENSION_2D, sampleType = SAMPLETYPE_FLOAT) {
    this.scopeId = void 0;
    this.name = name;
    this.visibility = visibility;
    this.textureDimension = textureDimension;
    this.sampleType = sampleType;
  }

}

class BindGroupFormat {
  constructor(graphicsDevice, bufferFormats, textureFormats) {
    this.device = graphicsDevice;
    this.bufferFormats = bufferFormats;
    this.bufferFormatsMap = new Map();
    bufferFormats.forEach((bf, i) => this.bufferFormatsMap.set(bf.name, i));
    this.textureFormats = textureFormats;
    const scope = graphicsDevice.scope;
    this.textureFormatsMap = new Map();
    textureFormats.forEach((tf, i) => {
      this.textureFormatsMap.set(tf.name, i);
      tf.scopeId = scope.resolve(tf.name);
    });
    this.impl = graphicsDevice.createBindGroupFormatImpl(this);
  }

  destroy() {
    this.impl.destroy();
  }

  getTexture(name) {
    const index = this.textureFormatsMap.get(name);

    if (index !== undefined) {
      return this.textureFormats[index];
    }

    return null;
  }

  getShaderDeclarationTextures(bindGroup) {
    let code = '';
    let bindIndex = this.bufferFormats.length;
    this.textureFormats.forEach(format => {
      code += `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform texture2D ${format.name};\n` + `layout(set = ${bindGroup}, binding = ${bindIndex++}) uniform sampler ${format.name}_sampler;\n`;
    });
    return code;
  }

  loseContext() {}

}

export { BindBufferFormat, BindGroupFormat, BindTextureFormat };
