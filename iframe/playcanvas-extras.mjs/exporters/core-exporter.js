/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 2a805ddb9
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Texture, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, RenderTarget, createShaderFromCode, BlendState, drawQuadWithShader } from 'playcanvas';

const textureBlitVertexShader = `
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
    }`;
const textureBlitFragmentShader = `
    varying vec2 uv0;
    uniform sampler2D blitTexture;
    void main(void) {
        gl_FragColor = texture2D(blitTexture, uv0);
    }`;
class CoreExporter {
  constructor() {}
  textureToCanvas(texture, options = {}) {
    const image = texture.getSource();
    if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement || typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas || typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
      const {
        width: _width,
        height: _height
      } = this.calcTextureSize(image.width, image.height, options.maxTextureSize);
      const _canvas = document.createElement('canvas');
      _canvas.width = _width;
      _canvas.height = _height;
      const context = _canvas.getContext('2d');
      context.drawImage(image, 0, 0, _canvas.width, _canvas.height);
      if (options.color) {
        const {
          r,
          g,
          b
        } = options.color;
        const imagedata = context.getImageData(0, 0, _width, _height);
        const data = imagedata.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i + 0] = data[i + 0] * r;
          data[i + 1] = data[i + 1] * g;
          data[i + 2] = data[i + 2] * b;
        }
        context.putImageData(imagedata, 0, 0);
      }
      return Promise.resolve(_canvas);
    }
    const device = texture.device;
    const {
      width,
      height
    } = this.calcTextureSize(texture.width, texture.height, options.maxTextureSize);
    const dstTexture = new Texture(device, {
      name: 'ExtractedTexture',
      width,
      height,
      format: texture.format,
      cubemap: false,
      mipmaps: false,
      minFilter: FILTER_LINEAR,
      magFilter: FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    const renderTarget = new RenderTarget({
      colorBuffer: dstTexture,
      depth: false
    });
    const shader = createShaderFromCode(device, textureBlitVertexShader, textureBlitFragmentShader, 'ShaderCoreExporterBlit');
    device.scope.resolve('blitTexture').setValue(texture);
    device.setBlendState(BlendState.NOBLEND);
    drawQuadWithShader(device, renderTarget, shader);
    const pixels = new Uint8ClampedArray(width * height * 4);
    device.readPixels(0, 0, width, height, pixels);
    dstTexture.destroy();
    renderTarget.destroy();
    const newImage = new ImageData(pixels, width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const newContext = canvas.getContext('2d');
    newContext.putImageData(newImage, 0, 0);
    return Promise.resolve(canvas);
  }
  calcTextureSize(width, height, maxTextureSize) {
    if (maxTextureSize) {
      const scale = Math.min(maxTextureSize / Math.max(width, height), 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    return {
      width,
      height
    };
  }
}

export { CoreExporter };
