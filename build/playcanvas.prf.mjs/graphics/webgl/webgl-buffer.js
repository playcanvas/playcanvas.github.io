/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { BUFFER_GPUDYNAMIC, BUFFER_STREAM, BUFFER_DYNAMIC, BUFFER_STATIC } from '../constants.js';

class WebglBuffer {
  constructor() {
    this.bufferId = null;
  }

  destroy(device) {
    if (this.bufferId) {
      device.gl.deleteBuffer(this.bufferId);
      this.bufferId = null;
    }
  }

  get initialized() {
    return !!this.bufferId;
  }

  loseContext() {
    this.bufferId = null;
  }

  unlock(device, usage, target, storage) {
    const gl = device.gl;

    if (!this.bufferId) {
      this.bufferId = gl.createBuffer();
    }

    let glUsage;

    switch (usage) {
      case BUFFER_STATIC:
        glUsage = gl.STATIC_DRAW;
        break;

      case BUFFER_DYNAMIC:
        glUsage = gl.DYNAMIC_DRAW;
        break;

      case BUFFER_STREAM:
        glUsage = gl.STREAM_DRAW;
        break;

      case BUFFER_GPUDYNAMIC:
        if (device.webgl2) {
          glUsage = gl.DYNAMIC_COPY;
        } else {
          glUsage = gl.STATIC_DRAW;
        }

        break;
    }

    gl.bindBuffer(target, this.bufferId);
    gl.bufferData(target, storage, glUsage);
  }

}

export { WebglBuffer };
