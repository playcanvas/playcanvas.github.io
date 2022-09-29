/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../core/event-handler.js';
import { platform } from '../core/platform.js';
import { now } from '../core/time.js';
import { ScopeSpace } from './scope-space.js';
import { ProgramLibrary } from './program-library.js';
import { PRIMITIVE_TRIFAN, PRIMITIVE_POINTS } from './constants.js';
import '../core/tracing.js';

const EVENT_RESIZE = 'resizecanvas';

class GraphicsDevice extends EventHandler {
  constructor(canvas) {
    super();
    this.canvas = void 0;
    this.deviceType = void 0;
    this.scope = void 0;
    this.boneLimit = void 0;
    this.maxAnisotropy = void 0;
    this.maxCubeMapSize = void 0;
    this.maxTextureSize = void 0;
    this.maxVolumeSize = void 0;
    this.precision = void 0;
    this.renderTarget = null;
    this.insideRenderPass = false;
    this.supportsInstancing = void 0;
    this.supportsUniformBuffers = false;
    this.textureFloatRenderable = void 0;
    this.textureHalfFloatRenderable = void 0;
    this.canvas = canvas;
    this._width = 0;
    this._height = 0;
    this._maxPixelRatio = 1;
    this.shaders = [];
    this.buffers = [];
    this.textures = [];
    this.targets = [];
    this._vram = {
      texShadow: 0,
      texAsset: 0,
      texLightmap: 0,
      tex: 0,
      vb: 0,
      ib: 0,
      ub: 0
    };
    this._shaderStats = {
      vsCompiled: 0,
      fsCompiled: 0,
      linked: 0,
      materialShaders: 0,
      compileTime: 0
    };
    this.initializeContextCaches();
    this._drawCallsPerFrame = 0;
    this._shaderSwitchesPerFrame = 0;
    this._primsPerFrame = [];

    for (let i = PRIMITIVE_POINTS; i <= PRIMITIVE_TRIFAN; i++) {
      this._primsPerFrame[i] = 0;
    }

    this._renderTargetCreationTime = 0;
    this.scope = new ScopeSpace("Device");
    this.textureBias = this.scope.resolve("textureBias");
    this.textureBias.setValue(0.0);
    this.programLib = new ProgramLibrary(this);
  }

  destroy() {
    this.fire('destroy');
  }

  postDestroy() {
    this.scope = null;
    this.canvas = null;
  }

  toJSON(key) {
    return undefined;
  }

  initializeContextCaches() {
    this.indexBuffer = null;
    this.vertexBuffers = [];
    this.shader = null;
    this.renderTarget = null;
  }

  getProgramLibrary() {
    return this.programLib;
  }

  setProgramLibrary(programLib) {
    this.programLib = programLib;
  }

  setRenderTarget(renderTarget) {
    this.renderTarget = renderTarget;
  }

  setIndexBuffer(indexBuffer) {
    this.indexBuffer = indexBuffer;
  }

  setVertexBuffer(vertexBuffer) {
    if (vertexBuffer) {
      this.vertexBuffers.push(vertexBuffer);
    }
  }

  getRenderTarget() {
    return this.renderTarget;
  }

  initRenderTarget(target) {
    if (target.initialized) return;
    const startTime = now();
    this.fire('fbo:create', {
      timestamp: startTime,
      target: this
    });
    target.init();
    this.targets.push(target);
    this._renderTargetCreationTime += now() - startTime;
  }

  _isBrowserInterface(texture) {
    return typeof HTMLCanvasElement !== 'undefined' && texture instanceof HTMLCanvasElement || typeof HTMLImageElement !== 'undefined' && texture instanceof HTMLImageElement || typeof HTMLVideoElement !== 'undefined' && texture instanceof HTMLVideoElement || typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap;
  }

  resizeCanvas(width, height) {
    this._width = width;
    this._height = height;
    const ratio = Math.min(this._maxPixelRatio, platform.browser ? window.devicePixelRatio : 1);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.fire(EVENT_RESIZE, width, height);
    }
  }

  setResolution(width, height) {
    this._width = width;
    this._height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.fire(EVENT_RESIZE, width, height);
  }

  updateClientRect() {
    this.clientRect = this.canvas.getBoundingClientRect();
  }

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  set fullscreen(fullscreen) {}

  get fullscreen() {
    return false;
  }

  set maxPixelRatio(ratio) {
    this._maxPixelRatio = ratio;
    this.resizeCanvas(this._width, this._height);
  }

  get maxPixelRatio() {
    return this._maxPixelRatio;
  }

  getBoneLimit() {
    return this.boneLimit;
  }

  setBoneLimit(maxBones) {
    this.boneLimit = maxBones;
  }

}

export { GraphicsDevice };
