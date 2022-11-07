/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { BINDGROUP_VIEW } from './constants.js';

class ShaderProcessorOptions {

  constructor(viewUniformFormat, viewBindGroupFormat) {
    this.uniformFormats = [];
    this.bindGroupFormats = [];
    this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;
    this.bindGroupFormats[BINDGROUP_VIEW] = viewBindGroupFormat;
  }

  hasUniform(name) {
    for (let i = 0; i < this.uniformFormats.length; i++) {
      const uniformFormat = this.uniformFormats[i];
      if (uniformFormat.get(name)) {
        return true;
      }
    }
    return false;
  }

  hasTexture(name) {
    for (let i = 0; i < this.bindGroupFormats.length; i++) {
      const groupFormat = this.bindGroupFormats[i];
      if (groupFormat.getTexture(name)) {
        return true;
      }
    }
    return false;
  }
}

export { ShaderProcessorOptions };
