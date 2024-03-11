/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 2a805ddb9
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { RenderPass, PIXELFORMAT_RGBA8, Texture, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_DEPTH, FILTER_NEAREST, RenderTarget, RenderPassForward, RenderPassColorGrab, LAYERID_SKYBOX, LAYERID_IMMEDIATE } from 'playcanvas';
import { RenderPassBloom } from './render-pass-bloom.js';
import { RenderPassCompose } from './render-pass-compose.js';
import { RenderPassTAA } from './render-pass-taa.js';
import { RenderPassPrepass } from './render-pass-prepass.js';

class RenderPassCameraFrame extends RenderPass {
  constructor(app, options = {}) {
    super(app.graphicsDevice);
    this.app = void 0;
    this.prePass = void 0;
    this.scenePass = void 0;
    this.composePass = void 0;
    this.bloomPass = void 0;
    this.taaPass = void 0;
    this._bloomEnabled = true;
    this._renderTargetScale = 1;
    this._rt = null;
    this.app = app;
    this.options = this.sanitizeOptions(options);
    this.setupRenderPasses(this.options);
  }
  destroy() {
    if (this._rt) {
      this._rt.destroyTextureBuffers();
      this._rt.destroy();
      this._rt = null;
    }
    this.beforePasses.forEach(pass => pass.destroy());
    this.beforePasses = null;
  }
  sanitizeOptions(options) {
    const defaults = {
      camera: null,
      samples: 2,
      sceneColorMap: true,
      lastGrabLayerId: LAYERID_SKYBOX,
      lastGrabLayerIsTransparent: false,
      lastSceneLayerId: LAYERID_IMMEDIATE,
      lastSceneLayerIsTransparent: true,
      taaEnabled: false
    };
    return Object.assign({}, defaults, options);
  }
  set renderTargetScale(value) {
    this._renderTargetScale = value;
    if (this.scenePass) {
      this.scenePass.options.scaleX = value;
      this.scenePass.options.scaleY = value;
    }
  }
  get renderTargetScale() {
    return this._renderTargetScale;
  }
  set bloomEnabled(value) {
    if (this._bloomEnabled !== value) {
      this._bloomEnabled = value;
      this.composePass.bloomTexture = value ? this.bloomPass.bloomTexture : null;
      this.bloomPass.enabled = value;
    }
  }
  get bloomEnabled() {
    return this._bloomEnabled;
  }
  set lastMipLevel(value) {
    this.bloomPass.lastMipLevel = value;
  }
  get lastMipLevel() {
    return this.bloomPass.lastMipLevel;
  }
  setupRenderPasses(options) {
    const {
      app,
      device
    } = this;
    const {
      scene,
      renderer
    } = app;
    const composition = scene.layers;
    const cameraComponent = options.camera;
    const targetRenderTarget = cameraComponent.renderTarget;
    const format = device.getRenderableHdrFormat() || PIXELFORMAT_RGBA8;
    const sceneTexture = new Texture(device, {
      name: 'SceneColor',
      width: 4,
      height: 4,
      format: format,
      mipmaps: false,
      minFilter: FILTER_LINEAR,
      magFilter: FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    const sceneDepth = new Texture(device, {
      name: 'SceneDepth',
      width: 4,
      height: 4,
      format: PIXELFORMAT_DEPTH,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    const rt = new RenderTarget({
      colorBuffer: sceneTexture,
      depthBuffer: sceneDepth,
      samples: options.samples
    });
    this._rt = rt;
    const sceneOptions = {
      resizeSource: targetRenderTarget,
      scaleX: this.renderTargetScale,
      scaleY: this.renderTargetScale
    };
    if (options.prepassEnabled) {
      this.prePass = new RenderPassPrepass(device, scene, renderer, cameraComponent, sceneDepth, sceneOptions);
    }
    this.scenePass = new RenderPassForward(device, composition, scene, renderer);
    this.scenePass.init(rt, sceneOptions);
    if (options.prepassEnabled) {
      this.scenePass.noDepthClear = true;
      this.scenePass.depthStencilOps.storeDepth = true;
    }
    const lastLayerId = options.sceneColorMap ? options.lastGrabLayerId : options.lastSceneLayerId;
    const lastLayerIsTransparent = options.sceneColorMap ? options.lastGrabLayerIsTransparent : options.lastSceneLayerIsTransparent;
    let clearRenderTarget = true;
    let lastAddedIndex = 0;
    lastAddedIndex = this.scenePass.addLayers(composition, cameraComponent, lastAddedIndex, clearRenderTarget, lastLayerId, lastLayerIsTransparent);
    clearRenderTarget = false;
    let colorGrabPass;
    let scenePassTransparent;
    if (options.sceneColorMap) {
      colorGrabPass = new RenderPassColorGrab(device);
      colorGrabPass.source = rt;
      scenePassTransparent = new RenderPassForward(device, composition, scene, renderer);
      scenePassTransparent.init(rt);
      lastAddedIndex = scenePassTransparent.addLayers(composition, cameraComponent, lastAddedIndex, clearRenderTarget, options.lastSceneLayerId, options.lastSceneLayerIsTransparent);
      if (options.prepassEnabled) {
        scenePassTransparent.depthStencilOps.storeDepth = true;
      }
    }
    let sceneTextureWithTaa = sceneTexture;
    if (options.taaEnabled) {
      this.taaPass = new RenderPassTAA(device, sceneTexture, cameraComponent);
      sceneTextureWithTaa = this.taaPass.historyTexture;
    }
    this.bloomPass = new RenderPassBloom(app.graphicsDevice, sceneTextureWithTaa, format);
    this.composePass = new RenderPassCompose(app.graphicsDevice);
    this.composePass.bloomTexture = this.bloomPass.bloomTexture;
    this.composePass.taaEnabled = options.taaEnabled;
    this.composePass.init(targetRenderTarget);
    const afterPass = new RenderPassForward(device, composition, scene, renderer);
    afterPass.init(targetRenderTarget);
    afterPass.addLayers(composition, cameraComponent, lastAddedIndex, clearRenderTarget);
    const allPasses = [this.prePass, this.scenePass, colorGrabPass, scenePassTransparent, this.taaPass, this.bloomPass, this.composePass, afterPass];
    this.beforePasses = allPasses.filter(element => element !== undefined);
  }
  frameUpdate() {
    var _this$taaPass$update, _this$taaPass;
    super.frameUpdate();
    const sceneTexture = (_this$taaPass$update = (_this$taaPass = this.taaPass) == null ? void 0 : _this$taaPass.update()) != null ? _this$taaPass$update : this._rt.colorBuffer;
    this.composePass.sceneTexture = sceneTexture;
    if (this.bloomEnabled) {
      this.bloomPass.sourceTexture = sceneTexture;
    }
  }
}

export { RenderPassCameraFrame };
