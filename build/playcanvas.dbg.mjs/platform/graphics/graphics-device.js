/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { now } from '../../core/time.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, TYPE_FLOAT32, BUFFER_STATIC, PRIMITIVE_POINTS } from './constants.js';
import { BlendState } from './blend-state.js';
import { DepthState } from './depth-state.js';
import { ScopeSpace } from './scope-space.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';

/**
 * The graphics device manages the underlying graphics context. It is responsible for submitting
 * render state changes and graphics primitives to the hardware. A graphics device is tied to a
 * specific canvas HTML element. It is valid to have more than one canvas element per page and
 * create a new graphics device against each.
 *
 * @augments EventHandler
 */
class GraphicsDevice extends EventHandler {
  /**
   * The canvas DOM element that provides the underlying WebGL context used by the graphics device.
   *
   * @type {HTMLCanvasElement}
   * @readonly
   */

  /**
   * True if the deviceType is WebGPU
   *
   * @type {boolean}
   * @readonly
   */

  /**
   * The scope namespace for shader attributes and variables.
   *
   * @type {ScopeSpace}
   * @readonly
   */

  /**
   * The maximum number of supported bones using uniform buffers.
   *
   * @type {number}
   * @readonly
   */

  /**
   * The maximum supported texture anisotropy setting.
   *
   * @type {number}
   * @readonly
   */

  /**
   * The maximum supported dimension of a cube map.
   *
   * @type {number}
   * @readonly
   */

  /**
   * The maximum supported dimension of a texture.
   *
   * @type {number}
   * @readonly
   */

  /**
   * The maximum supported dimension of a 3D texture (any axis).
   *
   * @type {number}
   * @readonly
   */

  /**
   * The highest shader precision supported by this graphics device. Can be 'hiphp', 'mediump' or
   * 'lowp'.
   *
   * @type {string}
   * @readonly
   */

  /**
   * The number of hardware anti-aliasing samples used by the frame buffer.
   *
   * @readonly
   * @type {number}
   */

  /**
   * Currently active render target.
   *
   * @type {import('./render-target.js').RenderTarget}
   * @ignore
   */

  /**
   * Index of the currently active render pass.
   *
   * @type {number}
   * @ignore
   */

  /** @type {boolean} */

  /**
   * True if hardware instancing is supported.
   *
   * @type {boolean}
   * @readonly
   */

  /**
   * True if the device supports uniform buffers.
   *
   * @type {boolean}
   * @ignore
   */

  /**
   * True if 32-bit floating-point textures can be used as a frame buffer.
   *
   * @type {boolean}
   * @readonly
   */

  /**
   * True if 16-bit floating-point textures can be used as a frame buffer.
   *
   * @type {boolean}
   * @readonly
   */

  /**
   * A vertex buffer representing a quad.
   *
   * @type {VertexBuffer}
   * @ignore
   */

  /**
   * An object representing current blend state
   *
   * @ignore
   */

  /**
   * The current depth state.
   *
   * @ignore
   */

  constructor(canvas) {
    super();
    this.canvas = void 0;
    this.isWebGPU = false;
    this.scope = void 0;
    this.boneLimit = void 0;
    this.maxAnisotropy = void 0;
    this.maxCubeMapSize = void 0;
    this.maxTextureSize = void 0;
    this.maxVolumeSize = void 0;
    this.precision = void 0;
    this.samples = void 0;
    this.renderTarget = null;
    this.renderPassIndex = void 0;
    this.insideRenderPass = false;
    this.supportsInstancing = void 0;
    this.supportsUniformBuffers = false;
    this.textureFloatRenderable = void 0;
    this.textureHalfFloatRenderable = void 0;
    this.quadVertexBuffer = void 0;
    this.blendState = new BlendState();
    this.depthState = new DepthState();
    this.defaultClearOptions = {
      color: [0, 0, 0, 1],
      depth: 1,
      stencil: 0,
      flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
    };
    this.canvas = canvas;

    // local width/height without pixelRatio applied
    this._width = 0;
    this._height = 0;

    // Some devices window.devicePixelRatio can be less than one
    // eg Oculus Quest 1 which returns a window.devicePixelRatio of 0.8
    this._maxPixelRatio = platform.browser ? Math.min(1, window.devicePixelRatio) : 1;

    // Array of objects that need to be re-initialized after a context restore event
    /** @type {import('./shader.js').Shader[]} */
    this.shaders = [];
    this.buffers = [];

    /** @type {import('./texture.js').Texture[]} */
    this.textures = [];

    /** @type {import('./render-target.js').RenderTarget[]} */
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

    // Profiler stats
    this._drawCallsPerFrame = 0;
    this._shaderSwitchesPerFrame = 0;
    this._primsPerFrame = [];
    for (let i = PRIMITIVE_POINTS; i <= PRIMITIVE_TRIFAN; i++) {
      this._primsPerFrame[i] = 0;
    }
    this._renderTargetCreationTime = 0;

    // Create the ScopeNamespace for shader attributes and variables
    this.scope = new ScopeSpace("Device");
    this.textureBias = this.scope.resolve("textureBias");
    this.textureBias.setValue(0.0);
  }

  /**
   * Function that executes after the device has been created.
   */
  postInit() {
    // create quad vertex buffer
    const vertexFormat = new VertexFormat(this, [{
      semantic: SEMANTIC_POSITION,
      components: 2,
      type: TYPE_FLOAT32
    }]);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.quadVertexBuffer = new VertexBuffer(this, vertexFormat, 4, BUFFER_STATIC, positions);
  }

  /**
   * Fired when the canvas is resized.
   *
   * @event GraphicsDevice#resizecanvas
   * @param {number} width - The new width of the canvas in pixels.
   * @param {number} height - The new height of the canvas in pixels.
   */

  /**
   * Destroy the graphics device.
   */
  destroy() {
    var _this$quadVertexBuffe;
    // fire the destroy event.
    // textures and other device resources may destroy themselves in response.
    this.fire('destroy');
    (_this$quadVertexBuffe = this.quadVertexBuffer) == null ? void 0 : _this$quadVertexBuffe.destroy();
    this.quadVertexBuffer = null;
  }
  onDestroyShader(shader) {
    this.fire('destroy:shader', shader);
    const idx = this.shaders.indexOf(shader);
    if (idx !== -1) {
      this.shaders.splice(idx, 1);
    }
  }

  // executes after the extended classes have executed their destroy function
  postDestroy() {
    this.scope = null;
    this.canvas = null;
  }

  // don't stringify GraphicsDevice to JSON by JSON.stringify
  toJSON(key) {
    return undefined;
  }
  initializeContextCaches() {
    this.indexBuffer = null;
    this.vertexBuffers = [];
    this.shader = null;
    this.renderTarget = null;
  }
  initializeRenderState() {
    this.blendState = new BlendState();
    this.depthState = new DepthState();

    // Cached viewport and scissor dimensions
    this.vx = this.vy = this.vw = this.vh = 0;
    this.sx = this.sy = this.sw = this.sh = 0;
  }

  /**
   * Sets the specified blend state.
   *
   * @param {BlendState} blendState - New blend state.
   */
  setBlendState(blendState) {
    Debug.assert(false);
  }

  /**
   * Sets the specified depth state.
   *
   * @param {DepthState} depthState - New depth state.
   */
  setDepthState(depthState) {
    Debug.assert(false);
  }

  /**
   * Sets the specified render target on the device. If null is passed as a parameter, the back
   * buffer becomes the current target for all rendering operations.
   *
   * @param {import('./render-target.js').RenderTarget} renderTarget - The render target to
   * activate.
   * @example
   * // Set a render target to receive all rendering output
   * device.setRenderTarget(renderTarget);
   *
   * // Set the back buffer to receive all rendering output
   * device.setRenderTarget(null);
   */
  setRenderTarget(renderTarget) {
    this.renderTarget = renderTarget;
  }

  /**
   * Sets the current index buffer on the graphics device. On subsequent calls to
   * {@link GraphicsDevice#draw}, the specified index buffer will be used to provide index data
   * for any indexed primitives.
   *
   * @param {import('./index-buffer.js').IndexBuffer} indexBuffer - The index buffer to assign to
   * the device.
   */
  setIndexBuffer(indexBuffer) {
    // Store the index buffer
    this.indexBuffer = indexBuffer;
  }

  /**
   * Sets the current vertex buffer on the graphics device. On subsequent calls to
   * {@link GraphicsDevice#draw}, the specified vertex buffer(s) will be used to provide vertex
   * data for any primitives.
   *
   * @param {import('./vertex-buffer.js').VertexBuffer} vertexBuffer - The vertex buffer to
   * assign to the device.
   */
  setVertexBuffer(vertexBuffer) {
    if (vertexBuffer) {
      this.vertexBuffers.push(vertexBuffer);
    }
  }

  /**
   * Queries the currently set render target on the device.
   *
   * @returns {import('./render-target.js').RenderTarget} The current render target.
   * @example
   * // Get the current render target
   * var renderTarget = device.getRenderTarget();
   */
  getRenderTarget() {
    return this.renderTarget;
  }

  /**
   * Initialize render target before it can be used.
   *
   * @param {import('./render-target.js').RenderTarget} target - The render target to be
   * initialized.
   * @ignore
   */
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

  /**
   * Reports whether a texture source is a canvas, image, video or ImageBitmap.
   *
   * @param {*} texture - Texture source data.
   * @returns {boolean} True if the texture is a canvas, image, video or ImageBitmap and false
   * otherwise.
   * @ignore
   */
  _isBrowserInterface(texture) {
    return this._isImageBrowserInterface(texture) || typeof HTMLCanvasElement !== 'undefined' && texture instanceof HTMLCanvasElement || typeof HTMLVideoElement !== 'undefined' && texture instanceof HTMLVideoElement;
  }
  _isImageBrowserInterface(texture) {
    return typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap || typeof HTMLImageElement !== 'undefined' && texture instanceof HTMLImageElement;
  }

  /**
   * Sets the width and height of the canvas, then fires the `resizecanvas` event. Note that the
   * specified width and height values will be multiplied by the value of
   * {@link GraphicsDevice#maxPixelRatio} to give the final resultant width and height for the
   * canvas.
   *
   * @param {number} width - The new width of the canvas.
   * @param {number} height - The new height of the canvas.
   * @ignore
   */
  resizeCanvas(width, height) {}

  /**
   * Sets the width and height of the canvas, then fires the `resizecanvas` event. Note that the
   * value of {@link GraphicsDevice#maxPixelRatio} is ignored.
   *
   * @param {number} width - The new width of the canvas.
   * @param {number} height - The new height of the canvas.
   * @ignore
   */
  setResolution(width, height) {
    this._width = width;
    this._height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.fire(GraphicsDevice.EVENT_RESIZE, width, height);
  }
  updateClientRect() {
    this.clientRect = this.canvas.getBoundingClientRect();
  }

  /**
   * Width of the back buffer in pixels.
   *
   * @type {number}
   */
  get width() {
    Debug.error("GraphicsDevice.width is not implemented on current device.");
    return this.canvas.width;
  }

  /**
   * Height of the back buffer in pixels.
   *
   * @type {number}
   */
  get height() {
    Debug.error("GraphicsDevice.height is not implemented on current device.");
    return this.canvas.height;
  }

  /**
   * Fullscreen mode.
   *
   * @type {boolean}
   */
  set fullscreen(fullscreen) {
    Debug.error("GraphicsDevice.fullscreen is not implemented on current device.");
  }
  get fullscreen() {
    Debug.error("GraphicsDevice.fullscreen is not implemented on current device.");
    return false;
  }

  /**
   * Maximum pixel ratio.
   *
   * @type {number}
   */
  set maxPixelRatio(ratio) {
    if (this._maxPixelRatio !== ratio) {
      this._maxPixelRatio = ratio;
      this.resizeCanvas(this._width, this._height);
    }
  }
  get maxPixelRatio() {
    return this._maxPixelRatio;
  }

  /**
   * The type of the device. Can be one of pc.DEVICETYPE_WEBGL1, pc.DEVICETYPE_WEBGL2 or pc.DEVICETYPE_WEBGPU.
   *
   * @type {import('./constants.js').DEVICETYPE_WEBGL1 | import('./constants.js').DEVICETYPE_WEBGL2 | import('./constants.js').DEVICETYPE_WEBGPU}
   */
  get deviceType() {
    return this._deviceType;
  }

  /**
   * Queries the maximum number of bones that can be referenced by a shader. The shader
   * generators (programlib) use this number to specify the matrix array size of the uniform
   * 'matrix_pose[0]'. The value is calculated based on the number of available uniform vectors
   * available after subtracting the number taken by a typical heavyweight shader. If a different
   * number is required, it can be tuned via {@link GraphicsDevice#setBoneLimit}.
   *
   * @returns {number} The maximum number of bones that can be supported by the host hardware.
   * @ignore
   */
  getBoneLimit() {
    return this.boneLimit;
  }

  /**
   * Specifies the maximum number of bones that the device can support on the current hardware.
   * This function allows the default calculated value based on available vector uniforms to be
   * overridden.
   *
   * @param {number} maxBones - The maximum number of bones supported by the host hardware.
   * @ignore
   */
  setBoneLimit(maxBones) {
    this.boneLimit = maxBones;
  }

  /**
   * Function which executes at the start of the frame. This should not be called manually, as
   * it is handled by the AppBase instance.
   *
   * @ignore
   */
  frameStart() {
    this.renderPassIndex = 0;
  }
}
GraphicsDevice.EVENT_RESIZE = 'resizecanvas';

export { GraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDTEVBUkZMQUdfQ09MT1IsXG4gICAgQ0xFQVJGTEFHX0RFUFRILFxuICAgIFBSSU1JVElWRV9QT0lOVFMsIFBSSU1JVElWRV9UUklGQU4sIFNFTUFOVElDX1BPU0lUSU9OLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4vYmxlbmQtc3RhdGUuanMnO1xuaW1wb3J0IHsgRGVwdGhTdGF0ZSB9IGZyb20gJy4vZGVwdGgtc3RhdGUuanMnO1xuaW1wb3J0IHsgU2NvcGVTcGFjZSB9IGZyb20gJy4vc2NvcGUtc3BhY2UuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4vdmVydGV4LWZvcm1hdC5qcyc7XG5cbi8qKlxuICogVGhlIGdyYXBoaWNzIGRldmljZSBtYW5hZ2VzIHRoZSB1bmRlcmx5aW5nIGdyYXBoaWNzIGNvbnRleHQuIEl0IGlzIHJlc3BvbnNpYmxlIGZvciBzdWJtaXR0aW5nXG4gKiByZW5kZXIgc3RhdGUgY2hhbmdlcyBhbmQgZ3JhcGhpY3MgcHJpbWl0aXZlcyB0byB0aGUgaGFyZHdhcmUuIEEgZ3JhcGhpY3MgZGV2aWNlIGlzIHRpZWQgdG8gYVxuICogc3BlY2lmaWMgY2FudmFzIEhUTUwgZWxlbWVudC4gSXQgaXMgdmFsaWQgdG8gaGF2ZSBtb3JlIHRoYW4gb25lIGNhbnZhcyBlbGVtZW50IHBlciBwYWdlIGFuZFxuICogY3JlYXRlIGEgbmV3IGdyYXBoaWNzIGRldmljZSBhZ2FpbnN0IGVhY2guXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBHcmFwaGljc0RldmljZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVGhlIGNhbnZhcyBET00gZWxlbWVudCB0aGF0IHByb3ZpZGVzIHRoZSB1bmRlcmx5aW5nIFdlYkdMIGNvbnRleHQgdXNlZCBieSB0aGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0hUTUxDYW52YXNFbGVtZW50fVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGNhbnZhcztcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRldmljZVR5cGUgaXMgV2ViR1BVXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBpc1dlYkdQVSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNjb3BlIG5hbWVzcGFjZSBmb3Igc2hhZGVyIGF0dHJpYnV0ZXMgYW5kIHZhcmlhYmxlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTY29wZVNwYWNlfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHNjb3BlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gbnVtYmVyIG9mIHN1cHBvcnRlZCBib25lcyB1c2luZyB1bmlmb3JtIGJ1ZmZlcnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIGJvbmVMaW1pdDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIHN1cHBvcnRlZCB0ZXh0dXJlIGFuaXNvdHJvcHkgc2V0dGluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbWF4QW5pc290cm9weTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIHN1cHBvcnRlZCBkaW1lbnNpb24gb2YgYSBjdWJlIG1hcC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbWF4Q3ViZU1hcFNpemU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBzdXBwb3J0ZWQgZGltZW5zaW9uIG9mIGEgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbWF4VGV4dHVyZVNpemU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBzdXBwb3J0ZWQgZGltZW5zaW9uIG9mIGEgM0QgdGV4dHVyZSAoYW55IGF4aXMpLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBtYXhWb2x1bWVTaXplO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGhpZ2hlc3Qgc2hhZGVyIHByZWNpc2lvbiBzdXBwb3J0ZWQgYnkgdGhpcyBncmFwaGljcyBkZXZpY2UuIENhbiBiZSAnaGlwaHAnLCAnbWVkaXVtcCcgb3JcbiAgICAgKiAnbG93cCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHByZWNpc2lvbjtcblxuICAgIC8qKlxuICAgICAqIFRoZSBudW1iZXIgb2YgaGFyZHdhcmUgYW50aS1hbGlhc2luZyBzYW1wbGVzIHVzZWQgYnkgdGhlIGZyYW1lIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2FtcGxlcztcblxuICAgIC8qKlxuICAgICAqIEN1cnJlbnRseSBhY3RpdmUgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyVGFyZ2V0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEluZGV4IG9mIHRoZSBjdXJyZW50bHkgYWN0aXZlIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyUGFzc0luZGV4O1xuXG4gICAgLyoqIEB0eXBlIHtib29sZWFufSAqL1xuICAgIGluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgaGFyZHdhcmUgaW5zdGFuY2luZyBpcyBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdXBwb3J0c0luc3RhbmNpbmc7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBkZXZpY2Ugc3VwcG9ydHMgdW5pZm9ybSBidWZmZXJzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgMzItYml0IGZsb2F0aW5nLXBvaW50IHRleHR1cmVzIGNhbiBiZSB1c2VkIGFzIGEgZnJhbWUgYnVmZmVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgdGV4dHVyZUZsb2F0UmVuZGVyYWJsZTtcblxuICAgICAvKipcbiAgICAgICogVHJ1ZSBpZiAxNi1iaXQgZmxvYXRpbmctcG9pbnQgdGV4dHVyZXMgY2FuIGJlIHVzZWQgYXMgYSBmcmFtZSBidWZmZXIuXG4gICAgICAqXG4gICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgKiBAcmVhZG9ubHlcbiAgICAgICovXG4gICAgdGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGU7XG5cbiAgICAvKipcbiAgICAgKiBBIHZlcnRleCBidWZmZXIgcmVwcmVzZW50aW5nIGEgcXVhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZXJ0ZXhCdWZmZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHF1YWRWZXJ0ZXhCdWZmZXI7XG5cbiAgICAvKipcbiAgICAgKiBBbiBvYmplY3QgcmVwcmVzZW50aW5nIGN1cnJlbnQgYmxlbmQgc3RhdGVcbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBibGVuZFN0YXRlID0gbmV3IEJsZW5kU3RhdGUoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGRlcHRoIHN0YXRlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlcHRoU3RhdGUgPSBuZXcgRGVwdGhTdGF0ZSgpO1xuXG4gICAgZGVmYXVsdENsZWFyT3B0aW9ucyA9IHtcbiAgICAgICAgY29sb3I6IFswLCAwLCAwLCAxXSxcbiAgICAgICAgZGVwdGg6IDEsXG4gICAgICAgIHN0ZW5jaWw6IDAsXG4gICAgICAgIGZsYWdzOiBDTEVBUkZMQUdfQ09MT1IgfCBDTEVBUkZMQUdfREVQVEhcbiAgICB9O1xuXG4gICAgc3RhdGljIEVWRU5UX1JFU0laRSA9ICdyZXNpemVjYW52YXMnO1xuXG4gICAgY29uc3RydWN0b3IoY2FudmFzKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5jYW52YXMgPSBjYW52YXM7XG5cbiAgICAgICAgLy8gbG9jYWwgd2lkdGgvaGVpZ2h0IHdpdGhvdXQgcGl4ZWxSYXRpbyBhcHBsaWVkXG4gICAgICAgIHRoaXMuX3dpZHRoID0gMDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gMDtcblxuICAgICAgICAvLyBTb21lIGRldmljZXMgd2luZG93LmRldmljZVBpeGVsUmF0aW8gY2FuIGJlIGxlc3MgdGhhbiBvbmVcbiAgICAgICAgLy8gZWcgT2N1bHVzIFF1ZXN0IDEgd2hpY2ggcmV0dXJucyBhIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIG9mIDAuOFxuICAgICAgICB0aGlzLl9tYXhQaXhlbFJhdGlvID0gcGxhdGZvcm0uYnJvd3NlciA/IE1hdGgubWluKDEsIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvKSA6IDE7XG5cbiAgICAgICAgLy8gQXJyYXkgb2Ygb2JqZWN0cyB0aGF0IG5lZWQgdG8gYmUgcmUtaW5pdGlhbGl6ZWQgYWZ0ZXIgYSBjb250ZXh0IHJlc3RvcmUgZXZlbnRcbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vc2hhZGVyLmpzJykuU2hhZGVyW119ICovXG4gICAgICAgIHRoaXMuc2hhZGVycyA9IFtdO1xuXG4gICAgICAgIHRoaXMuYnVmZmVycyA9IFtdO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuL3RleHR1cmUuanMnKS5UZXh0dXJlW119ICovXG4gICAgICAgIHRoaXMudGV4dHVyZXMgPSBbXTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0W119ICovXG4gICAgICAgIHRoaXMudGFyZ2V0cyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX3ZyYW0gPSB7XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0ZXhTaGFkb3c6IDAsXG4gICAgICAgICAgICB0ZXhBc3NldDogMCxcbiAgICAgICAgICAgIHRleExpZ2h0bWFwOiAwLFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICB0ZXg6IDAsXG4gICAgICAgICAgICB2YjogMCxcbiAgICAgICAgICAgIGliOiAwLFxuICAgICAgICAgICAgdWI6IDBcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9zaGFkZXJTdGF0cyA9IHtcbiAgICAgICAgICAgIHZzQ29tcGlsZWQ6IDAsXG4gICAgICAgICAgICBmc0NvbXBpbGVkOiAwLFxuICAgICAgICAgICAgbGlua2VkOiAwLFxuICAgICAgICAgICAgbWF0ZXJpYWxTaGFkZXJzOiAwLFxuICAgICAgICAgICAgY29tcGlsZVRpbWU6IDBcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gUHJvZmlsZXIgc3RhdHNcbiAgICAgICAgdGhpcy5fZHJhd0NhbGxzUGVyRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lID0gMDtcblxuICAgICAgICB0aGlzLl9wcmltc1BlckZyYW1lID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSBQUklNSVRJVkVfUE9JTlRTOyBpIDw9IFBSSU1JVElWRV9UUklGQU47IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fcHJpbXNQZXJGcmFtZVtpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lID0gMDtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIFNjb3BlTmFtZXNwYWNlIGZvciBzaGFkZXIgYXR0cmlidXRlcyBhbmQgdmFyaWFibGVzXG4gICAgICAgIHRoaXMuc2NvcGUgPSBuZXcgU2NvcGVTcGFjZShcIkRldmljZVwiKTtcblxuICAgICAgICB0aGlzLnRleHR1cmVCaWFzID0gdGhpcy5zY29wZS5yZXNvbHZlKFwidGV4dHVyZUJpYXNcIik7XG4gICAgICAgIHRoaXMudGV4dHVyZUJpYXMuc2V0VmFsdWUoMC4wKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB0aGF0IGV4ZWN1dGVzIGFmdGVyIHRoZSBkZXZpY2UgaGFzIGJlZW4gY3JlYXRlZC5cbiAgICAgKi9cbiAgICBwb3N0SW5pdCgpIHtcblxuICAgICAgICAvLyBjcmVhdGUgcXVhZCB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGNvbnN0IHZlcnRleEZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQodGhpcywgW1xuICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfUE9TSVRJT04sIGNvbXBvbmVudHM6IDIsIHR5cGU6IFRZUEVfRkxPQVQzMiB9XG4gICAgICAgIF0pO1xuICAgICAgICBjb25zdCBwb3NpdGlvbnMgPSBuZXcgRmxvYXQzMkFycmF5KFstMSwgLTEsIDEsIC0xLCAtMSwgMSwgMSwgMV0pO1xuICAgICAgICB0aGlzLnF1YWRWZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMsIHZlcnRleEZvcm1hdCwgNCwgQlVGRkVSX1NUQVRJQywgcG9zaXRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjYW52YXMgaXMgcmVzaXplZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBHcmFwaGljc0RldmljZSNyZXNpemVjYW52YXNcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgbmV3IGhlaWdodCBvZiB0aGUgY2FudmFzIGluIHBpeGVscy5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyBmaXJlIHRoZSBkZXN0cm95IGV2ZW50LlxuICAgICAgICAvLyB0ZXh0dXJlcyBhbmQgb3RoZXIgZGV2aWNlIHJlc291cmNlcyBtYXkgZGVzdHJveSB0aGVtc2VsdmVzIGluIHJlc3BvbnNlLlxuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3knKTtcblxuICAgICAgICB0aGlzLnF1YWRWZXJ0ZXhCdWZmZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5xdWFkVmVydGV4QnVmZmVyID0gbnVsbDtcbiAgICB9XG5cbiAgICBvbkRlc3Ryb3lTaGFkZXIoc2hhZGVyKSB7XG4gICAgICAgIHRoaXMuZmlyZSgnZGVzdHJveTpzaGFkZXInLCBzaGFkZXIpO1xuXG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuc2hhZGVycy5pbmRleE9mKHNoYWRlcik7XG4gICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLnNoYWRlcnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleGVjdXRlcyBhZnRlciB0aGUgZXh0ZW5kZWQgY2xhc3NlcyBoYXZlIGV4ZWN1dGVkIHRoZWlyIGRlc3Ryb3kgZnVuY3Rpb25cbiAgICBwb3N0RGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zY29wZSA9IG51bGw7XG4gICAgICAgIHRoaXMuY2FudmFzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBkb24ndCBzdHJpbmdpZnkgR3JhcGhpY3NEZXZpY2UgdG8gSlNPTiBieSBKU09OLnN0cmluZ2lmeVxuICAgIHRvSlNPTihrZXkpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29udGV4dENhY2hlcygpIHtcbiAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IG51bGw7XG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVycyA9IFtdO1xuICAgICAgICB0aGlzLnNoYWRlciA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplUmVuZGVyU3RhdGUoKSB7XG5cbiAgICAgICAgdGhpcy5ibGVuZFN0YXRlID0gbmV3IEJsZW5kU3RhdGUoKTtcbiAgICAgICAgdGhpcy5kZXB0aFN0YXRlID0gbmV3IERlcHRoU3RhdGUoKTtcblxuICAgICAgICAvLyBDYWNoZWQgdmlld3BvcnQgYW5kIHNjaXNzb3IgZGltZW5zaW9uc1xuICAgICAgICB0aGlzLnZ4ID0gdGhpcy52eSA9IHRoaXMudncgPSB0aGlzLnZoID0gMDtcbiAgICAgICAgdGhpcy5zeCA9IHRoaXMuc3kgPSB0aGlzLnN3ID0gdGhpcy5zaCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIGJsZW5kIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtCbGVuZFN0YXRlfSBibGVuZFN0YXRlIC0gTmV3IGJsZW5kIHN0YXRlLlxuICAgICAqL1xuICAgIHNldEJsZW5kU3RhdGUoYmxlbmRTdGF0ZSkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBkZXB0aCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RGVwdGhTdGF0ZX0gZGVwdGhTdGF0ZSAtIE5ldyBkZXB0aCBzdGF0ZS5cbiAgICAgKi9cbiAgICBzZXREZXB0aFN0YXRlKGRlcHRoU3RhdGUpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgcmVuZGVyIHRhcmdldCBvbiB0aGUgZGV2aWNlLiBJZiBudWxsIGlzIHBhc3NlZCBhcyBhIHBhcmFtZXRlciwgdGhlIGJhY2tcbiAgICAgKiBidWZmZXIgYmVjb21lcyB0aGUgY3VycmVudCB0YXJnZXQgZm9yIGFsbCByZW5kZXJpbmcgb3BlcmF0aW9ucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IHJlbmRlclRhcmdldCAtIFRoZSByZW5kZXIgdGFyZ2V0IHRvXG4gICAgICogYWN0aXZhdGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgYSByZW5kZXIgdGFyZ2V0IHRvIHJlY2VpdmUgYWxsIHJlbmRlcmluZyBvdXRwdXRcbiAgICAgKiBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHJlbmRlclRhcmdldCk7XG4gICAgICpcbiAgICAgKiAvLyBTZXQgdGhlIGJhY2sgYnVmZmVyIHRvIHJlY2VpdmUgYWxsIHJlbmRlcmluZyBvdXRwdXRcbiAgICAgKiBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KG51bGwpO1xuICAgICAqL1xuICAgIHNldFJlbmRlclRhcmdldChyZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSByZW5kZXJUYXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3VycmVudCBpbmRleCBidWZmZXIgb24gdGhlIGdyYXBoaWNzIGRldmljZS4gT24gc3Vic2VxdWVudCBjYWxscyB0b1xuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSNkcmF3fSwgdGhlIHNwZWNpZmllZCBpbmRleCBidWZmZXIgd2lsbCBiZSB1c2VkIHRvIHByb3ZpZGUgaW5kZXggZGF0YVxuICAgICAqIGZvciBhbnkgaW5kZXhlZCBwcmltaXRpdmVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vaW5kZXgtYnVmZmVyLmpzJykuSW5kZXhCdWZmZXJ9IGluZGV4QnVmZmVyIC0gVGhlIGluZGV4IGJ1ZmZlciB0byBhc3NpZ24gdG9cbiAgICAgKiB0aGUgZGV2aWNlLlxuICAgICAqL1xuICAgIHNldEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBpbmRleCBidWZmZXJcbiAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IGluZGV4QnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGN1cnJlbnQgdmVydGV4IGJ1ZmZlciBvbiB0aGUgZ3JhcGhpY3MgZGV2aWNlLiBPbiBzdWJzZXF1ZW50IGNhbGxzIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI2RyYXd9LCB0aGUgc3BlY2lmaWVkIHZlcnRleCBidWZmZXIocykgd2lsbCBiZSB1c2VkIHRvIHByb3ZpZGUgdmVydGV4XG4gICAgICogZGF0YSBmb3IgYW55IHByaW1pdGl2ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi92ZXJ0ZXgtYnVmZmVyLmpzJykuVmVydGV4QnVmZmVyfSB2ZXJ0ZXhCdWZmZXIgLSBUaGUgdmVydGV4IGJ1ZmZlciB0b1xuICAgICAqIGFzc2lnbiB0byB0aGUgZGV2aWNlLlxuICAgICAqL1xuICAgIHNldFZlcnRleEJ1ZmZlcih2ZXJ0ZXhCdWZmZXIpIHtcblxuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMucHVzaCh2ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgY3VycmVudGx5IHNldCByZW5kZXIgdGFyZ2V0IG9uIHRoZSBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IFRoZSBjdXJyZW50IHJlbmRlciB0YXJnZXQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBHZXQgdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldFxuICAgICAqIHZhciByZW5kZXJUYXJnZXQgPSBkZXZpY2UuZ2V0UmVuZGVyVGFyZ2V0KCk7XG4gICAgICovXG4gICAgZ2V0UmVuZGVyVGFyZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSByZW5kZXIgdGFyZ2V0IGJlZm9yZSBpdCBjYW4gYmUgdXNlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IHRhcmdldCAtIFRoZSByZW5kZXIgdGFyZ2V0IHRvIGJlXG4gICAgICogaW5pdGlhbGl6ZWQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluaXRSZW5kZXJUYXJnZXQodGFyZ2V0KSB7XG5cbiAgICAgICAgaWYgKHRhcmdldC5pbml0aWFsaXplZCkgcmV0dXJuO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIHRoaXMuZmlyZSgnZmJvOmNyZWF0ZScsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogc3RhcnRUaW1lLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0YXJnZXQuaW5pdCgpO1xuICAgICAgICB0aGlzLnRhcmdldHMucHVzaCh0YXJnZXQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lICs9IG5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgYSB0ZXh0dXJlIHNvdXJjZSBpcyBhIGNhbnZhcywgaW1hZ2UsIHZpZGVvIG9yIEltYWdlQml0bWFwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB0ZXh0dXJlIC0gVGV4dHVyZSBzb3VyY2UgZGF0YS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdGV4dHVyZSBpcyBhIGNhbnZhcywgaW1hZ2UsIHZpZGVvIG9yIEltYWdlQml0bWFwIGFuZCBmYWxzZVxuICAgICAqIG90aGVyd2lzZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2lzQnJvd3NlckludGVyZmFjZSh0ZXh0dXJlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc0ltYWdlQnJvd3NlckludGVyZmFjZSh0ZXh0dXJlKSB8fFxuICAgICAgICAgICAgICAgICh0eXBlb2YgSFRNTENhbnZhc0VsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHRleHR1cmUgaW5zdGFuY2VvZiBIVE1MQ2FudmFzRWxlbWVudCkgfHxcbiAgICAgICAgICAgICAgICAodHlwZW9mIEhUTUxWaWRlb0VsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHRleHR1cmUgaW5zdGFuY2VvZiBIVE1MVmlkZW9FbGVtZW50KTtcbiAgICB9XG5cbiAgICBfaXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gKHR5cGVvZiBJbWFnZUJpdG1hcCAhPT0gJ3VuZGVmaW5lZCcgJiYgdGV4dHVyZSBpbnN0YW5jZW9mIEltYWdlQml0bWFwKSB8fFxuICAgICAgICAgICAgICAgKHR5cGVvZiBIVE1MSW1hZ2VFbGVtZW50ICE9PSAndW5kZWZpbmVkJyAmJiB0ZXh0dXJlIGluc3RhbmNlb2YgSFRNTEltYWdlRWxlbWVudCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGUgY2FudmFzLCB0aGVuIGZpcmVzIHRoZSBgcmVzaXplY2FudmFzYCBldmVudC4gTm90ZSB0aGF0IHRoZVxuICAgICAqIHNwZWNpZmllZCB3aWR0aCBhbmQgaGVpZ2h0IHZhbHVlcyB3aWxsIGJlIG11bHRpcGxpZWQgYnkgdGhlIHZhbHVlIG9mXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI21heFBpeGVsUmF0aW99IHRvIGdpdmUgdGhlIGZpbmFsIHJlc3VsdGFudCB3aWR0aCBhbmQgaGVpZ2h0IGZvciB0aGVcbiAgICAgKiBjYW52YXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBuZXcgaGVpZ2h0IG9mIHRoZSBjYW52YXMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KSB7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGUgY2FudmFzLCB0aGVuIGZpcmVzIHRoZSBgcmVzaXplY2FudmFzYCBldmVudC4gTm90ZSB0aGF0IHRoZVxuICAgICAqIHZhbHVlIG9mIHtAbGluayBHcmFwaGljc0RldmljZSNtYXhQaXhlbFJhdGlvfSBpcyBpZ25vcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIG5ldyB3aWR0aCBvZiB0aGUgY2FudmFzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgbmV3IGhlaWdodCBvZiB0aGUgY2FudmFzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRSZXNvbHV0aW9uKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICB0aGlzLmNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgIHRoaXMuZmlyZShHcmFwaGljc0RldmljZS5FVkVOVF9SRVNJWkUsIHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIHVwZGF0ZUNsaWVudFJlY3QoKSB7XG4gICAgICAgIHRoaXMuY2xpZW50UmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdpZHRoIG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgRGVidWcuZXJyb3IoXCJHcmFwaGljc0RldmljZS53aWR0aCBpcyBub3QgaW1wbGVtZW50ZWQgb24gY3VycmVudCBkZXZpY2UuXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5jYW52YXMud2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGVpZ2h0IG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIERlYnVnLmVycm9yKFwiR3JhcGhpY3NEZXZpY2UuaGVpZ2h0IGlzIG5vdCBpbXBsZW1lbnRlZCBvbiBjdXJyZW50IGRldmljZS5cIik7XG4gICAgICAgIHJldHVybiB0aGlzLmNhbnZhcy5oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVsbHNjcmVlbiBtb2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZ1bGxzY3JlZW4oZnVsbHNjcmVlbikge1xuICAgICAgICBEZWJ1Zy5lcnJvcihcIkdyYXBoaWNzRGV2aWNlLmZ1bGxzY3JlZW4gaXMgbm90IGltcGxlbWVudGVkIG9uIGN1cnJlbnQgZGV2aWNlLlwiKTtcbiAgICB9XG5cbiAgICBnZXQgZnVsbHNjcmVlbigpIHtcbiAgICAgICAgRGVidWcuZXJyb3IoXCJHcmFwaGljc0RldmljZS5mdWxsc2NyZWVuIGlzIG5vdCBpbXBsZW1lbnRlZCBvbiBjdXJyZW50IGRldmljZS5cIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXhpbXVtIHBpeGVsIHJhdGlvLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWF4UGl4ZWxSYXRpbyhyYXRpbykge1xuICAgICAgICBpZiAodGhpcy5fbWF4UGl4ZWxSYXRpbyAhPT0gcmF0aW8pIHtcbiAgICAgICAgICAgIHRoaXMuX21heFBpeGVsUmF0aW8gPSByYXRpbztcbiAgICAgICAgICAgIHRoaXMucmVzaXplQ2FudmFzKHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1heFBpeGVsUmF0aW8oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXhQaXhlbFJhdGlvO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRoZSBkZXZpY2UuIENhbiBiZSBvbmUgb2YgcGMuREVWSUNFVFlQRV9XRUJHTDEsIHBjLkRFVklDRVRZUEVfV0VCR0wyIG9yIHBjLkRFVklDRVRZUEVfV0VCR1BVLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdMMSB8IGltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdMMiB8IGltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdQVX1cbiAgICAgKi9cbiAgICBnZXQgZGV2aWNlVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RldmljZVR5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgcmVmZXJlbmNlZCBieSBhIHNoYWRlci4gVGhlIHNoYWRlclxuICAgICAqIGdlbmVyYXRvcnMgKHByb2dyYW1saWIpIHVzZSB0aGlzIG51bWJlciB0byBzcGVjaWZ5IHRoZSBtYXRyaXggYXJyYXkgc2l6ZSBvZiB0aGUgdW5pZm9ybVxuICAgICAqICdtYXRyaXhfcG9zZVswXScuIFRoZSB2YWx1ZSBpcyBjYWxjdWxhdGVkIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXZhaWxhYmxlIHVuaWZvcm0gdmVjdG9yc1xuICAgICAqIGF2YWlsYWJsZSBhZnRlciBzdWJ0cmFjdGluZyB0aGUgbnVtYmVyIHRha2VuIGJ5IGEgdHlwaWNhbCBoZWF2eXdlaWdodCBzaGFkZXIuIElmIGEgZGlmZmVyZW50XG4gICAgICogbnVtYmVyIGlzIHJlcXVpcmVkLCBpdCBjYW4gYmUgdHVuZWQgdmlhIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRCb25lTGltaXR9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1heGltdW0gbnVtYmVyIG9mIGJvbmVzIHRoYXQgY2FuIGJlIHN1cHBvcnRlZCBieSB0aGUgaG9zdCBoYXJkd2FyZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Qm9uZUxpbWl0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ib25lTGltaXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyB0aGF0IHRoZSBkZXZpY2UgY2FuIHN1cHBvcnQgb24gdGhlIGN1cnJlbnQgaGFyZHdhcmUuXG4gICAgICogVGhpcyBmdW5jdGlvbiBhbGxvd3MgdGhlIGRlZmF1bHQgY2FsY3VsYXRlZCB2YWx1ZSBiYXNlZCBvbiBhdmFpbGFibGUgdmVjdG9yIHVuaWZvcm1zIHRvIGJlXG4gICAgICogb3ZlcnJpZGRlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhCb25lcyAtIFRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyBzdXBwb3J0ZWQgYnkgdGhlIGhvc3QgaGFyZHdhcmUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEJvbmVMaW1pdChtYXhCb25lcykge1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IG1heEJvbmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIHdoaWNoIGV4ZWN1dGVzIGF0IHRoZSBzdGFydCBvZiB0aGUgZnJhbWUuIFRoaXMgc2hvdWxkIG5vdCBiZSBjYWxsZWQgbWFudWFsbHksIGFzXG4gICAgICogaXQgaXMgaGFuZGxlZCBieSB0aGUgQXBwQmFzZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBmcmFtZVN0YXJ0KCkge1xuICAgICAgICB0aGlzLnJlbmRlclBhc3NJbmRleCA9IDA7XG4gICAgfVxufVxuXG5leHBvcnQgeyBHcmFwaGljc0RldmljZSB9O1xuIl0sIm5hbWVzIjpbIkdyYXBoaWNzRGV2aWNlIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJjYW52YXMiLCJpc1dlYkdQVSIsInNjb3BlIiwiYm9uZUxpbWl0IiwibWF4QW5pc290cm9weSIsIm1heEN1YmVNYXBTaXplIiwibWF4VGV4dHVyZVNpemUiLCJtYXhWb2x1bWVTaXplIiwicHJlY2lzaW9uIiwic2FtcGxlcyIsInJlbmRlclRhcmdldCIsInJlbmRlclBhc3NJbmRleCIsImluc2lkZVJlbmRlclBhc3MiLCJzdXBwb3J0c0luc3RhbmNpbmciLCJzdXBwb3J0c1VuaWZvcm1CdWZmZXJzIiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsInRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlIiwicXVhZFZlcnRleEJ1ZmZlciIsImJsZW5kU3RhdGUiLCJCbGVuZFN0YXRlIiwiZGVwdGhTdGF0ZSIsIkRlcHRoU3RhdGUiLCJkZWZhdWx0Q2xlYXJPcHRpb25zIiwiY29sb3IiLCJkZXB0aCIsInN0ZW5jaWwiLCJmbGFncyIsIkNMRUFSRkxBR19DT0xPUiIsIkNMRUFSRkxBR19ERVBUSCIsIl93aWR0aCIsIl9oZWlnaHQiLCJfbWF4UGl4ZWxSYXRpbyIsInBsYXRmb3JtIiwiYnJvd3NlciIsIk1hdGgiLCJtaW4iLCJ3aW5kb3ciLCJkZXZpY2VQaXhlbFJhdGlvIiwic2hhZGVycyIsImJ1ZmZlcnMiLCJ0ZXh0dXJlcyIsInRhcmdldHMiLCJfdnJhbSIsInRleFNoYWRvdyIsInRleEFzc2V0IiwidGV4TGlnaHRtYXAiLCJ0ZXgiLCJ2YiIsImliIiwidWIiLCJfc2hhZGVyU3RhdHMiLCJ2c0NvbXBpbGVkIiwiZnNDb21waWxlZCIsImxpbmtlZCIsIm1hdGVyaWFsU2hhZGVycyIsImNvbXBpbGVUaW1lIiwiaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMiLCJfZHJhd0NhbGxzUGVyRnJhbWUiLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsIl9wcmltc1BlckZyYW1lIiwiaSIsIlBSSU1JVElWRV9QT0lOVFMiLCJQUklNSVRJVkVfVFJJRkFOIiwiX3JlbmRlclRhcmdldENyZWF0aW9uVGltZSIsIlNjb3BlU3BhY2UiLCJ0ZXh0dXJlQmlhcyIsInJlc29sdmUiLCJzZXRWYWx1ZSIsInBvc3RJbml0IiwidmVydGV4Rm9ybWF0IiwiVmVydGV4Rm9ybWF0Iiwic2VtYW50aWMiLCJTRU1BTlRJQ19QT1NJVElPTiIsImNvbXBvbmVudHMiLCJ0eXBlIiwiVFlQRV9GTE9BVDMyIiwicG9zaXRpb25zIiwiRmxvYXQzMkFycmF5IiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsImRlc3Ryb3kiLCJmaXJlIiwib25EZXN0cm95U2hhZGVyIiwic2hhZGVyIiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInBvc3REZXN0cm95IiwidG9KU09OIiwia2V5IiwidW5kZWZpbmVkIiwiaW5kZXhCdWZmZXIiLCJ2ZXJ0ZXhCdWZmZXJzIiwiaW5pdGlhbGl6ZVJlbmRlclN0YXRlIiwidngiLCJ2eSIsInZ3IiwidmgiLCJzeCIsInN5Iiwic3ciLCJzaCIsInNldEJsZW5kU3RhdGUiLCJEZWJ1ZyIsImFzc2VydCIsInNldERlcHRoU3RhdGUiLCJzZXRSZW5kZXJUYXJnZXQiLCJzZXRJbmRleEJ1ZmZlciIsInNldFZlcnRleEJ1ZmZlciIsInZlcnRleEJ1ZmZlciIsInB1c2giLCJnZXRSZW5kZXJUYXJnZXQiLCJpbml0UmVuZGVyVGFyZ2V0IiwidGFyZ2V0IiwiaW5pdGlhbGl6ZWQiLCJzdGFydFRpbWUiLCJub3ciLCJ0aW1lc3RhbXAiLCJpbml0IiwiX2lzQnJvd3NlckludGVyZmFjZSIsInRleHR1cmUiLCJfaXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UiLCJIVE1MQ2FudmFzRWxlbWVudCIsIkhUTUxWaWRlb0VsZW1lbnQiLCJJbWFnZUJpdG1hcCIsIkhUTUxJbWFnZUVsZW1lbnQiLCJyZXNpemVDYW52YXMiLCJ3aWR0aCIsImhlaWdodCIsInNldFJlc29sdXRpb24iLCJFVkVOVF9SRVNJWkUiLCJ1cGRhdGVDbGllbnRSZWN0IiwiY2xpZW50UmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsImVycm9yIiwiZnVsbHNjcmVlbiIsIm1heFBpeGVsUmF0aW8iLCJyYXRpbyIsImRldmljZVR5cGUiLCJfZGV2aWNlVHlwZSIsImdldEJvbmVMaW1pdCIsInNldEJvbmVMaW1pdCIsIm1heEJvbmVzIiwiZnJhbWVTdGFydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQWlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsY0FBYyxTQUFTQyxZQUFZLENBQUM7QUFDdEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTs7QUFHQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNB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
