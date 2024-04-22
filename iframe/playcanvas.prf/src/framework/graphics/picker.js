import { Color } from '../../core/math/color.js';
import { PIXELFORMAT_RGBA8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { Camera } from '../../scene/camera.js';
import { Layer } from '../../scene/layer.js';
import { getApplication } from '../globals.js';
import { RenderPassPicker } from './render-pass-picker.js';

const tempSet = new Set();
class Picker {
  constructor(app, width, height) {
    this.renderTarget = null;
    this.mapping = new Map();
    if (app instanceof GraphicsDevice) {
      app = getApplication();
    }
    this.renderer = app.renderer;
    this.device = app.graphicsDevice;
    this.renderPass = new RenderPassPicker(this.device, app.renderer);
    this.width = 0;
    this.height = 0;
    this.resize(width, height);
  }
  getSelection(x, y, width = 1, height = 1) {
    const device = this.device;
    y = this.renderTarget.height - (y + height);
    x = Math.floor(x);
    y = Math.floor(y);
    width = Math.floor(Math.max(width, 1));
    height = Math.floor(Math.max(height, 1));
    device.setRenderTarget(this.renderTarget);
    device.updateBegin();
    const pixels = new Uint8Array(4 * width * height);
    device.readPixels(x, y, width, height, pixels);
    device.updateEnd();
    const mapping = this.mapping;
    for (let i = 0; i < width * height; i++) {
      const r = pixels[4 * i + 0];
      const g = pixels[4 * i + 1];
      const b = pixels[4 * i + 2];
      const a = pixels[4 * i + 3];
      const index = a << 24 | r << 16 | g << 8 | b;
      if (index !== -1) {
        tempSet.add(mapping.get(index));
      }
    }
    const selection = [];
    tempSet.forEach(meshInstance => selection.push(meshInstance));
    tempSet.clear();
    return selection;
  }
  allocateRenderTarget() {
    const colorBuffer = new Texture(this.device, {
      format: PIXELFORMAT_RGBA8,
      width: this.width,
      height: this.height,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      name: 'pick'
    });
    this.renderTarget = new RenderTarget({
      colorBuffer: colorBuffer,
      depth: true
    });
  }
  releaseRenderTarget() {
    if (this.renderTarget) {
      this.renderTarget.destroyTextureBuffers();
      this.renderTarget.destroy();
      this.renderTarget = null;
    }
  }
  prepare(camera, scene, layers) {
    if (camera instanceof Camera) {
      camera = camera.node.camera;
    }
    if (layers instanceof Layer) {
      layers = [layers];
    }
    if (!this.renderTarget || this.width !== this.renderTarget.width || this.height !== this.renderTarget.height) {
      this.releaseRenderTarget();
      this.allocateRenderTarget();
    }
    this.mapping.clear();
    const renderPass = this.renderPass;
    renderPass.init(this.renderTarget);
    renderPass.colorOps.clearValue = Color.WHITE;
    renderPass.colorOps.clear = true;
    renderPass.depthStencilOps.clearDepth = true;
    renderPass.update(camera, scene, layers, this.mapping);
    renderPass.render();
  }
  resize(width, height) {
    this.width = Math.floor(width);
    this.height = Math.floor(height);
  }
}

export { Picker };
