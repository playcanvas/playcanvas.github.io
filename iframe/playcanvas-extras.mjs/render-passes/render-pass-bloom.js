/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 2a805ddb9
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { RenderPass, RenderTarget, Texture, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, Color, BlendState } from 'playcanvas';
import { RenderPassDownsample } from './render-pass-downsample.js';
import { RenderPassUpsample } from './render-pass-upsample.js';

class RenderPassBloom extends RenderPass {
  constructor(device, sourceTexture, format) {
    super(device);
    this.bloomTexture = void 0;
    this.lastMipLevel = 1;
    this.bloomRenderTarget = void 0;
    this.textureFormat = void 0;
    this.renderTargets = [];
    this._sourceTexture = sourceTexture;
    this.textureFormat = format;
    this.bloomRenderTarget = this.createRenderTarget(0);
    this.bloomTexture = this.bloomRenderTarget.colorBuffer;
  }
  destroy() {
    this.destroyRenderPasses();
    this.destroyRenderTargets();
  }
  destroyRenderTargets(startIndex = 0) {
    for (let i = startIndex; i < this.renderTargets.length; i++) {
      const rt = this.renderTargets[i];
      rt.destroyTextureBuffers();
      rt.destroy();
    }
    this.renderTargets.length = 0;
  }
  destroyRenderPasses() {
    for (let i = 0; i < this.beforePasses.length; i++) {
      this.beforePasses[i].destroy();
    }
    this.beforePasses.length = 0;
  }
  createRenderTarget(index) {
    return new RenderTarget({
      depth: false,
      colorBuffer: new Texture(this.device, {
        name: `BloomTexture${index}`,
        width: 1,
        height: 1,
        format: this.textureFormat,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
      })
    });
  }
  createRenderTargets(count) {
    for (let i = 0; i < count; i++) {
      const rt = i === 0 ? this.bloomRenderTarget : this.createRenderTarget(i);
      this.renderTargets.push(rt);
    }
  }
  calcMipLevels(width, height, minSize) {
    const min = Math.min(width, height);
    return Math.floor(Math.log2(min) - Math.log2(minSize));
  }
  createRenderPasses(numPasses) {
    const device = this.device;
    let passSourceTexture = this._sourceTexture;
    for (let i = 0; i < numPasses; i++) {
      const pass = new RenderPassDownsample(device, passSourceTexture);
      const rt = this.renderTargets[i];
      pass.init(rt, {
        resizeSource: passSourceTexture,
        scaleX: 0.5,
        scaleY: 0.5
      });
      pass.setClearColor(Color.BLACK);
      this.beforePasses.push(pass);
      passSourceTexture = rt.colorBuffer;
    }
    passSourceTexture = this.renderTargets[numPasses - 1].colorBuffer;
    for (let i = numPasses - 2; i >= 0; i--) {
      const pass = new RenderPassUpsample(device, passSourceTexture);
      const rt = this.renderTargets[i];
      pass.init(rt);
      pass.blendState = BlendState.ADDBLEND;
      this.beforePasses.push(pass);
      passSourceTexture = rt.colorBuffer;
    }
  }
  onDisable() {
    var _this$renderTargets$;
    (_this$renderTargets$ = this.renderTargets[0]) == null || _this$renderTargets$.resize(1, 1);
    this.destroyRenderPasses();
    this.destroyRenderTargets(1);
  }
  set sourceTexture(value) {
    this._sourceTexture = value;
    if (this.beforePasses.length > 0) {
      const firstPass = this.beforePasses[0];
      firstPass.options.resizeSource = value;
      firstPass.sourceTexture = value;
    }
  }
  get sourceTexture() {
    return this._sourceTexture;
  }
  frameUpdate() {
    super.frameUpdate();
    let numPasses = this.calcMipLevels(this._sourceTexture.width, this._sourceTexture.height, 2 ** this.lastMipLevel);
    numPasses = Math.max(1, numPasses);
    if (this.renderTargets.length !== numPasses) {
      this.destroyRenderPasses();
      this.destroyRenderTargets(1);
      this.createRenderTargets(numPasses);
      this.createRenderPasses(numPasses);
    }
  }
}

export { RenderPassBloom };
