/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../core/tracing.js';
import { BUFFER_GPUDYNAMIC, PRIMITIVE_POINTS } from './constants.js';
import { createShaderFromCode } from './program-lib/utils.js';
import { VertexBuffer } from './vertex-buffer.js';

class TransformFeedback {
  constructor(inputBuffer, usage = BUFFER_GPUDYNAMIC) {
    this.device = inputBuffer.device;
    const gl = this.device.gl;
    this._inputBuffer = inputBuffer;

    if (usage === BUFFER_GPUDYNAMIC && inputBuffer.usage !== usage) {
      gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer.impl.bufferId);
      gl.bufferData(gl.ARRAY_BUFFER, inputBuffer.storage, gl.DYNAMIC_COPY);
    }

    this._outputBuffer = new VertexBuffer(inputBuffer.device, inputBuffer.format, inputBuffer.numVertices, usage, inputBuffer.storage);
  }

  static createShader(graphicsDevice, vsCode, name) {
    return createShaderFromCode(graphicsDevice, vsCode, null, name, true);
  }

  destroy() {
    this._outputBuffer.destroy();
  }

  process(shader, swap = true) {
    const device = this.device;
    const oldRt = device.getRenderTarget();
    device.setRenderTarget(null);
    device.updateBegin();
    device.setVertexBuffer(this._inputBuffer, 0);
    device.setRaster(false);
    device.setTransformFeedbackBuffer(this._outputBuffer);
    device.setShader(shader);
    device.draw({
      type: PRIMITIVE_POINTS,
      base: 0,
      count: this._inputBuffer.numVertices,
      indexed: false
    });
    device.setTransformFeedbackBuffer(null);
    device.setRaster(true);
    device.updateEnd();
    device.setRenderTarget(oldRt);

    if (swap) {
      let tmp = this._inputBuffer.impl.bufferId;
      this._inputBuffer.impl.bufferId = this._outputBuffer.impl.bufferId;
      this._outputBuffer.impl.bufferId = tmp;
      tmp = this._inputBuffer.impl.vao;
      this._inputBuffer.impl.vao = this._outputBuffer.impl.vao;
      this._outputBuffer.impl.vao = tmp;
    }
  }

  get inputBuffer() {
    return this._inputBuffer;
  }

  get outputBuffer() {
    return this._outputBuffer;
  }

}

export { TransformFeedback };
