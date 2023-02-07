/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { now } from '../../core/time.js';
import { PRIMITIVE_TRIFAN, SEMANTIC_POSITION, TYPE_FLOAT32, BUFFER_STATIC, PRIMITIVE_POINTS } from './constants.js';
import { ScopeSpace } from './scope-space.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';

const EVENT_RESIZE = 'resizecanvas';

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
   */

  /**
   * The graphics device type, DEVICETYPE_WEBGL or DEVICETYPE_WEBGPU.
   *
   * @type {string}
   * @ignore
   */

  /**
   * The scope namespace for shader attributes and variables.
   *
   * @type {ScopeSpace}
   */

  /**
   * The maximum number of supported bones using uniform buffers.
   *
   * @type {number}
   */

  /**
   * The maximum supported texture anisotropy setting.
   *
   * @type {number}
   */

  /**
   * The maximum supported dimension of a cube map.
   *
   * @type {number}
   */

  /**
   * The maximum supported dimension of a texture.
   *
   * @type {number}
   */

  /**
   * The maximum supported dimension of a 3D texture (any axis).
   *
   * @type {number}
   */

  /**
   * The highest shader precision supported by this graphics device. Can be 'hiphp', 'mediump' or
   * 'lowp'.
   *
   * @type {string}
   */

  /**
   * Currently active render target.
   *
   * @type {import('./render-target.js').RenderTarget}
   * @ignore
   */

  /** @type {boolean} */

  /**
   * True if hardware instancing is supported.
   *
   * @type {boolean}
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
   */

  /**
   * True if 16-bit floating-point textures can be used as a frame buffer.
   *
   * @type {boolean}
   */

  /**
   * A vertex buffer representing a quad.
   *
   * @type {VertexBuffer}
   * @ignore
   */

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
    this.quadVertexBuffer = void 0;
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
    // Cached viewport and scissor dimensions
    this.vx = this.vy = this.vw = this.vh = 0;
    this.sx = this.sy = this.sw = this.sh = 0;
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
    this.fire(EVENT_RESIZE, width, height);
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
    this._maxPixelRatio = ratio;
    this.resizeCanvas(this._width, this._height);
  }
  get maxPixelRatio() {
    return this._maxPixelRatio;
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
}

export { GraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBQUklNSVRJVkVfUE9JTlRTLCBQUklNSVRJVkVfVFJJRkFOLCBTRU1BTlRJQ19QT1NJVElPTiwgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNjb3BlU3BhY2UgfSBmcm9tICcuL3Njb3BlLXNwYWNlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4vdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuL3ZlcnRleC1mb3JtYXQuanMnO1xuXG5jb25zdCBFVkVOVF9SRVNJWkUgPSAncmVzaXplY2FudmFzJztcblxuLyoqXG4gKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIG1hbmFnZXMgdGhlIHVuZGVybHlpbmcgZ3JhcGhpY3MgY29udGV4dC4gSXQgaXMgcmVzcG9uc2libGUgZm9yIHN1Ym1pdHRpbmdcbiAqIHJlbmRlciBzdGF0ZSBjaGFuZ2VzIGFuZCBncmFwaGljcyBwcmltaXRpdmVzIHRvIHRoZSBoYXJkd2FyZS4gQSBncmFwaGljcyBkZXZpY2UgaXMgdGllZCB0byBhXG4gKiBzcGVjaWZpYyBjYW52YXMgSFRNTCBlbGVtZW50LiBJdCBpcyB2YWxpZCB0byBoYXZlIG1vcmUgdGhhbiBvbmUgY2FudmFzIGVsZW1lbnQgcGVyIHBhZ2UgYW5kXG4gKiBjcmVhdGUgYSBuZXcgZ3JhcGhpY3MgZGV2aWNlIGFnYWluc3QgZWFjaC5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdyYXBoaWNzRGV2aWNlIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBUaGUgY2FudmFzIERPTSBlbGVtZW50IHRoYXQgcHJvdmlkZXMgdGhlIHVuZGVybHlpbmcgV2ViR0wgY29udGV4dCB1c2VkIGJ5IHRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7SFRNTENhbnZhc0VsZW1lbnR9XG4gICAgICovXG4gICAgY2FudmFzO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGdyYXBoaWNzIGRldmljZSB0eXBlLCBERVZJQ0VUWVBFX1dFQkdMIG9yIERFVklDRVRZUEVfV0VCR1BVLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGV2aWNlVHlwZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzY29wZSBuYW1lc3BhY2UgZm9yIHNoYWRlciBhdHRyaWJ1dGVzIGFuZCB2YXJpYWJsZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2NvcGVTcGFjZX1cbiAgICAgKi9cbiAgICBzY29wZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBzdXBwb3J0ZWQgYm9uZXMgdXNpbmcgdW5pZm9ybSBidWZmZXJzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBib25lTGltaXQ7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBzdXBwb3J0ZWQgdGV4dHVyZSBhbmlzb3Ryb3B5IHNldHRpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIG1heEFuaXNvdHJvcHk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBzdXBwb3J0ZWQgZGltZW5zaW9uIG9mIGEgY3ViZSBtYXAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIG1heEN1YmVNYXBTaXplO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gc3VwcG9ydGVkIGRpbWVuc2lvbiBvZiBhIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIG1heFRleHR1cmVTaXplO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gc3VwcG9ydGVkIGRpbWVuc2lvbiBvZiBhIDNEIHRleHR1cmUgKGFueSBheGlzKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbWF4Vm9sdW1lU2l6ZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBoaWdoZXN0IHNoYWRlciBwcmVjaXNpb24gc3VwcG9ydGVkIGJ5IHRoaXMgZ3JhcGhpY3MgZGV2aWNlLiBDYW4gYmUgJ2hpcGhwJywgJ21lZGl1bXAnIG9yXG4gICAgICogJ2xvd3AnLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBwcmVjaXNpb247XG5cbiAgICAvKipcbiAgICAgKiBDdXJyZW50bHkgYWN0aXZlIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbmRlclRhcmdldCA9IG51bGw7XG5cbiAgICAvKiogQHR5cGUge2Jvb2xlYW59ICovXG4gICAgaW5zaWRlUmVuZGVyUGFzcyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBoYXJkd2FyZSBpbnN0YW5jaW5nIGlzIHN1cHBvcnRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHN1cHBvcnRzSW5zdGFuY2luZztcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRldmljZSBzdXBwb3J0cyB1bmlmb3JtIGJ1ZmZlcnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3VwcG9ydHNVbmlmb3JtQnVmZmVycyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiAzMi1iaXQgZmxvYXRpbmctcG9pbnQgdGV4dHVyZXMgY2FuIGJlIHVzZWQgYXMgYSBmcmFtZSBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlO1xuXG4gICAgIC8qKlxuICAgICAgKiBUcnVlIGlmIDE2LWJpdCBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBjYW4gYmUgdXNlZCBhcyBhIGZyYW1lIGJ1ZmZlci5cbiAgICAgICpcbiAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAqL1xuICAgIHRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlO1xuXG4gICAgLyoqXG4gICAgICogQSB2ZXJ0ZXggYnVmZmVyIHJlcHJlc2VudGluZyBhIHF1YWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVydGV4QnVmZmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBxdWFkVmVydGV4QnVmZmVyO1xuXG4gICAgY29uc3RydWN0b3IoY2FudmFzKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5jYW52YXMgPSBjYW52YXM7XG5cbiAgICAgICAgLy8gbG9jYWwgd2lkdGgvaGVpZ2h0IHdpdGhvdXQgcGl4ZWxSYXRpbyBhcHBsaWVkXG4gICAgICAgIHRoaXMuX3dpZHRoID0gMDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gMDtcblxuICAgICAgICAvLyBTb21lIGRldmljZXMgd2luZG93LmRldmljZVBpeGVsUmF0aW8gY2FuIGJlIGxlc3MgdGhhbiBvbmVcbiAgICAgICAgLy8gZWcgT2N1bHVzIFF1ZXN0IDEgd2hpY2ggcmV0dXJucyBhIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIG9mIDAuOFxuICAgICAgICB0aGlzLl9tYXhQaXhlbFJhdGlvID0gcGxhdGZvcm0uYnJvd3NlciA/IE1hdGgubWluKDEsIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvKSA6IDE7XG5cbiAgICAgICAgLy8gQXJyYXkgb2Ygb2JqZWN0cyB0aGF0IG5lZWQgdG8gYmUgcmUtaW5pdGlhbGl6ZWQgYWZ0ZXIgYSBjb250ZXh0IHJlc3RvcmUgZXZlbnRcbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vc2hhZGVyLmpzJykuU2hhZGVyW119ICovXG4gICAgICAgIHRoaXMuc2hhZGVycyA9IFtdO1xuXG4gICAgICAgIHRoaXMuYnVmZmVycyA9IFtdO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuL3RleHR1cmUuanMnKS5UZXh0dXJlW119ICovXG4gICAgICAgIHRoaXMudGV4dHVyZXMgPSBbXTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0W119ICovXG4gICAgICAgIHRoaXMudGFyZ2V0cyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX3ZyYW0gPSB7XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0ZXhTaGFkb3c6IDAsXG4gICAgICAgICAgICB0ZXhBc3NldDogMCxcbiAgICAgICAgICAgIHRleExpZ2h0bWFwOiAwLFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICB0ZXg6IDAsXG4gICAgICAgICAgICB2YjogMCxcbiAgICAgICAgICAgIGliOiAwLFxuICAgICAgICAgICAgdWI6IDBcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9zaGFkZXJTdGF0cyA9IHtcbiAgICAgICAgICAgIHZzQ29tcGlsZWQ6IDAsXG4gICAgICAgICAgICBmc0NvbXBpbGVkOiAwLFxuICAgICAgICAgICAgbGlua2VkOiAwLFxuICAgICAgICAgICAgbWF0ZXJpYWxTaGFkZXJzOiAwLFxuICAgICAgICAgICAgY29tcGlsZVRpbWU6IDBcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gUHJvZmlsZXIgc3RhdHNcbiAgICAgICAgdGhpcy5fZHJhd0NhbGxzUGVyRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lID0gMDtcblxuICAgICAgICB0aGlzLl9wcmltc1BlckZyYW1lID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSBQUklNSVRJVkVfUE9JTlRTOyBpIDw9IFBSSU1JVElWRV9UUklGQU47IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fcHJpbXNQZXJGcmFtZVtpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lID0gMDtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIFNjb3BlTmFtZXNwYWNlIGZvciBzaGFkZXIgYXR0cmlidXRlcyBhbmQgdmFyaWFibGVzXG4gICAgICAgIHRoaXMuc2NvcGUgPSBuZXcgU2NvcGVTcGFjZShcIkRldmljZVwiKTtcblxuICAgICAgICB0aGlzLnRleHR1cmVCaWFzID0gdGhpcy5zY29wZS5yZXNvbHZlKFwidGV4dHVyZUJpYXNcIik7XG4gICAgICAgIHRoaXMudGV4dHVyZUJpYXMuc2V0VmFsdWUoMC4wKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB0aGF0IGV4ZWN1dGVzIGFmdGVyIHRoZSBkZXZpY2UgaGFzIGJlZW4gY3JlYXRlZC5cbiAgICAgKi9cbiAgICBwb3N0SW5pdCgpIHtcblxuICAgICAgICAvLyBjcmVhdGUgcXVhZCB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGNvbnN0IHZlcnRleEZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQodGhpcywgW1xuICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfUE9TSVRJT04sIGNvbXBvbmVudHM6IDIsIHR5cGU6IFRZUEVfRkxPQVQzMiB9XG4gICAgICAgIF0pO1xuICAgICAgICBjb25zdCBwb3NpdGlvbnMgPSBuZXcgRmxvYXQzMkFycmF5KFstMSwgLTEsIDEsIC0xLCAtMSwgMSwgMSwgMV0pO1xuICAgICAgICB0aGlzLnF1YWRWZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMsIHZlcnRleEZvcm1hdCwgNCwgQlVGRkVSX1NUQVRJQywgcG9zaXRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjYW52YXMgaXMgcmVzaXplZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBHcmFwaGljc0RldmljZSNyZXNpemVjYW52YXNcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgbmV3IGhlaWdodCBvZiB0aGUgY2FudmFzIGluIHBpeGVscy5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyBmaXJlIHRoZSBkZXN0cm95IGV2ZW50LlxuICAgICAgICAvLyB0ZXh0dXJlcyBhbmQgb3RoZXIgZGV2aWNlIHJlc291cmNlcyBtYXkgZGVzdHJveSB0aGVtc2VsdmVzIGluIHJlc3BvbnNlLlxuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3knKTtcblxuICAgICAgICB0aGlzLnF1YWRWZXJ0ZXhCdWZmZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5xdWFkVmVydGV4QnVmZmVyID0gbnVsbDtcbiAgICB9XG5cbiAgICBvbkRlc3Ryb3lTaGFkZXIoc2hhZGVyKSB7XG4gICAgICAgIHRoaXMuZmlyZSgnZGVzdHJveTpzaGFkZXInLCBzaGFkZXIpO1xuXG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuc2hhZGVycy5pbmRleE9mKHNoYWRlcik7XG4gICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLnNoYWRlcnMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleGVjdXRlcyBhZnRlciB0aGUgZXh0ZW5kZWQgY2xhc3NlcyBoYXZlIGV4ZWN1dGVkIHRoZWlyIGRlc3Ryb3kgZnVuY3Rpb25cbiAgICBwb3N0RGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zY29wZSA9IG51bGw7XG4gICAgICAgIHRoaXMuY2FudmFzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBkb24ndCBzdHJpbmdpZnkgR3JhcGhpY3NEZXZpY2UgdG8gSlNPTiBieSBKU09OLnN0cmluZ2lmeVxuICAgIHRvSlNPTihrZXkpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29udGV4dENhY2hlcygpIHtcbiAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IG51bGw7XG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVycyA9IFtdO1xuICAgICAgICB0aGlzLnNoYWRlciA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplUmVuZGVyU3RhdGUoKSB7XG4gICAgICAgIC8vIENhY2hlZCB2aWV3cG9ydCBhbmQgc2Npc3NvciBkaW1lbnNpb25zXG4gICAgICAgIHRoaXMudnggPSB0aGlzLnZ5ID0gdGhpcy52dyA9IHRoaXMudmggPSAwO1xuICAgICAgICB0aGlzLnN4ID0gdGhpcy5zeSA9IHRoaXMuc3cgPSB0aGlzLnNoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgcmVuZGVyIHRhcmdldCBvbiB0aGUgZGV2aWNlLiBJZiBudWxsIGlzIHBhc3NlZCBhcyBhIHBhcmFtZXRlciwgdGhlIGJhY2tcbiAgICAgKiBidWZmZXIgYmVjb21lcyB0aGUgY3VycmVudCB0YXJnZXQgZm9yIGFsbCByZW5kZXJpbmcgb3BlcmF0aW9ucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IHJlbmRlclRhcmdldCAtIFRoZSByZW5kZXIgdGFyZ2V0IHRvXG4gICAgICogYWN0aXZhdGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgYSByZW5kZXIgdGFyZ2V0IHRvIHJlY2VpdmUgYWxsIHJlbmRlcmluZyBvdXRwdXRcbiAgICAgKiBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHJlbmRlclRhcmdldCk7XG4gICAgICpcbiAgICAgKiAvLyBTZXQgdGhlIGJhY2sgYnVmZmVyIHRvIHJlY2VpdmUgYWxsIHJlbmRlcmluZyBvdXRwdXRcbiAgICAgKiBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KG51bGwpO1xuICAgICAqL1xuICAgIHNldFJlbmRlclRhcmdldChyZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSByZW5kZXJUYXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3VycmVudCBpbmRleCBidWZmZXIgb24gdGhlIGdyYXBoaWNzIGRldmljZS4gT24gc3Vic2VxdWVudCBjYWxscyB0b1xuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSNkcmF3fSwgdGhlIHNwZWNpZmllZCBpbmRleCBidWZmZXIgd2lsbCBiZSB1c2VkIHRvIHByb3ZpZGUgaW5kZXggZGF0YVxuICAgICAqIGZvciBhbnkgaW5kZXhlZCBwcmltaXRpdmVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vaW5kZXgtYnVmZmVyLmpzJykuSW5kZXhCdWZmZXJ9IGluZGV4QnVmZmVyIC0gVGhlIGluZGV4IGJ1ZmZlciB0byBhc3NpZ24gdG9cbiAgICAgKiB0aGUgZGV2aWNlLlxuICAgICAqL1xuICAgIHNldEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKSB7XG4gICAgICAgIC8vIFN0b3JlIHRoZSBpbmRleCBidWZmZXJcbiAgICAgICAgdGhpcy5pbmRleEJ1ZmZlciA9IGluZGV4QnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGN1cnJlbnQgdmVydGV4IGJ1ZmZlciBvbiB0aGUgZ3JhcGhpY3MgZGV2aWNlLiBPbiBzdWJzZXF1ZW50IGNhbGxzIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI2RyYXd9LCB0aGUgc3BlY2lmaWVkIHZlcnRleCBidWZmZXIocykgd2lsbCBiZSB1c2VkIHRvIHByb3ZpZGUgdmVydGV4XG4gICAgICogZGF0YSBmb3IgYW55IHByaW1pdGl2ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi92ZXJ0ZXgtYnVmZmVyLmpzJykuVmVydGV4QnVmZmVyfSB2ZXJ0ZXhCdWZmZXIgLSBUaGUgdmVydGV4IGJ1ZmZlciB0b1xuICAgICAqIGFzc2lnbiB0byB0aGUgZGV2aWNlLlxuICAgICAqL1xuICAgIHNldFZlcnRleEJ1ZmZlcih2ZXJ0ZXhCdWZmZXIpIHtcblxuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMucHVzaCh2ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgY3VycmVudGx5IHNldCByZW5kZXIgdGFyZ2V0IG9uIHRoZSBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IFRoZSBjdXJyZW50IHJlbmRlciB0YXJnZXQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBHZXQgdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldFxuICAgICAqIHZhciByZW5kZXJUYXJnZXQgPSBkZXZpY2UuZ2V0UmVuZGVyVGFyZ2V0KCk7XG4gICAgICovXG4gICAgZ2V0UmVuZGVyVGFyZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSByZW5kZXIgdGFyZ2V0IGJlZm9yZSBpdCBjYW4gYmUgdXNlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IHRhcmdldCAtIFRoZSByZW5kZXIgdGFyZ2V0IHRvIGJlXG4gICAgICogaW5pdGlhbGl6ZWQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluaXRSZW5kZXJUYXJnZXQodGFyZ2V0KSB7XG5cbiAgICAgICAgaWYgKHRhcmdldC5pbml0aWFsaXplZCkgcmV0dXJuO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIHRoaXMuZmlyZSgnZmJvOmNyZWF0ZScsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogc3RhcnRUaW1lLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzXG4gICAgICAgIH0pO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0YXJnZXQuaW5pdCgpO1xuICAgICAgICB0aGlzLnRhcmdldHMucHVzaCh0YXJnZXQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lICs9IG5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgYSB0ZXh0dXJlIHNvdXJjZSBpcyBhIGNhbnZhcywgaW1hZ2UsIHZpZGVvIG9yIEltYWdlQml0bWFwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSB0ZXh0dXJlIC0gVGV4dHVyZSBzb3VyY2UgZGF0YS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdGV4dHVyZSBpcyBhIGNhbnZhcywgaW1hZ2UsIHZpZGVvIG9yIEltYWdlQml0bWFwIGFuZCBmYWxzZVxuICAgICAqIG90aGVyd2lzZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2lzQnJvd3NlckludGVyZmFjZSh0ZXh0dXJlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc0ltYWdlQnJvd3NlckludGVyZmFjZSh0ZXh0dXJlKSB8fFxuICAgICAgICAgICAgICAgICh0eXBlb2YgSFRNTENhbnZhc0VsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHRleHR1cmUgaW5zdGFuY2VvZiBIVE1MQ2FudmFzRWxlbWVudCkgfHxcbiAgICAgICAgICAgICAgICAodHlwZW9mIEhUTUxWaWRlb0VsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHRleHR1cmUgaW5zdGFuY2VvZiBIVE1MVmlkZW9FbGVtZW50KTtcbiAgICB9XG5cbiAgICBfaXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gKHR5cGVvZiBJbWFnZUJpdG1hcCAhPT0gJ3VuZGVmaW5lZCcgJiYgdGV4dHVyZSBpbnN0YW5jZW9mIEltYWdlQml0bWFwKSB8fFxuICAgICAgICAgICAgICAgKHR5cGVvZiBIVE1MSW1hZ2VFbGVtZW50ICE9PSAndW5kZWZpbmVkJyAmJiB0ZXh0dXJlIGluc3RhbmNlb2YgSFRNTEltYWdlRWxlbWVudCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGUgY2FudmFzLCB0aGVuIGZpcmVzIHRoZSBgcmVzaXplY2FudmFzYCBldmVudC4gTm90ZSB0aGF0IHRoZVxuICAgICAqIHNwZWNpZmllZCB3aWR0aCBhbmQgaGVpZ2h0IHZhbHVlcyB3aWxsIGJlIG11bHRpcGxpZWQgYnkgdGhlIHZhbHVlIG9mXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI21heFBpeGVsUmF0aW99IHRvIGdpdmUgdGhlIGZpbmFsIHJlc3VsdGFudCB3aWR0aCBhbmQgaGVpZ2h0IGZvciB0aGVcbiAgICAgKiBjYW52YXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBuZXcgaGVpZ2h0IG9mIHRoZSBjYW52YXMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcblxuICAgICAgICBjb25zdCByYXRpbyA9IE1hdGgubWluKHRoaXMuX21heFBpeGVsUmF0aW8sIHBsYXRmb3JtLmJyb3dzZXIgPyB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA6IDEpO1xuICAgICAgICB3aWR0aCA9IE1hdGguZmxvb3Iod2lkdGggKiByYXRpbyk7XG4gICAgICAgIGhlaWdodCA9IE1hdGguZmxvb3IoaGVpZ2h0ICogcmF0aW8pO1xuXG4gICAgICAgIGlmICh0aGlzLmNhbnZhcy53aWR0aCAhPT0gd2lkdGggfHwgdGhpcy5jYW52YXMuaGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLmZpcmUoRVZFTlRfUkVTSVpFLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhlIGNhbnZhcywgdGhlbiBmaXJlcyB0aGUgYHJlc2l6ZWNhbnZhc2AgZXZlbnQuIE5vdGUgdGhhdCB0aGVcbiAgICAgKiB2YWx1ZSBvZiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjbWF4UGl4ZWxSYXRpb30gaXMgaWdub3JlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSBuZXcgd2lkdGggb2YgdGhlIGNhbnZhcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIG5ldyBoZWlnaHQgb2YgdGhlIGNhbnZhcy5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0UmVzb2x1dGlvbih3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICAgICAgdGhpcy5jYW52YXMud2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5jYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICB0aGlzLmZpcmUoRVZFTlRfUkVTSVpFLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICB1cGRhdGVDbGllbnRSZWN0KCkge1xuICAgICAgICB0aGlzLmNsaWVudFJlY3QgPSB0aGlzLmNhbnZhcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaWR0aCBvZiB0aGUgYmFjayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIERlYnVnLmVycm9yKFwiR3JhcGhpY3NEZXZpY2Uud2lkdGggaXMgbm90IGltcGxlbWVudGVkIG9uIGN1cnJlbnQgZGV2aWNlLlwiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FudmFzLndpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlaWdodCBvZiB0aGUgYmFjayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICBEZWJ1Zy5lcnJvcihcIkdyYXBoaWNzRGV2aWNlLmhlaWdodCBpcyBub3QgaW1wbGVtZW50ZWQgb24gY3VycmVudCBkZXZpY2UuXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5jYW52YXMuaGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZ1bGxzY3JlZW4gbW9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmdWxsc2NyZWVuKGZ1bGxzY3JlZW4pIHtcbiAgICAgICAgRGVidWcuZXJyb3IoXCJHcmFwaGljc0RldmljZS5mdWxsc2NyZWVuIGlzIG5vdCBpbXBsZW1lbnRlZCBvbiBjdXJyZW50IGRldmljZS5cIik7XG4gICAgfVxuXG4gICAgZ2V0IGZ1bGxzY3JlZW4oKSB7XG4gICAgICAgIERlYnVnLmVycm9yKFwiR3JhcGhpY3NEZXZpY2UuZnVsbHNjcmVlbiBpcyBub3QgaW1wbGVtZW50ZWQgb24gY3VycmVudCBkZXZpY2UuXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWF4aW11bSBwaXhlbCByYXRpby5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1heFBpeGVsUmF0aW8ocmF0aW8pIHtcbiAgICAgICAgdGhpcy5fbWF4UGl4ZWxSYXRpbyA9IHJhdGlvO1xuICAgICAgICB0aGlzLnJlc2l6ZUNhbnZhcyh0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0KTtcbiAgICB9XG5cbiAgICBnZXQgbWF4UGl4ZWxSYXRpbygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21heFBpeGVsUmF0aW87XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgcmVmZXJlbmNlZCBieSBhIHNoYWRlci4gVGhlIHNoYWRlclxuICAgICAqIGdlbmVyYXRvcnMgKHByb2dyYW1saWIpIHVzZSB0aGlzIG51bWJlciB0byBzcGVjaWZ5IHRoZSBtYXRyaXggYXJyYXkgc2l6ZSBvZiB0aGUgdW5pZm9ybVxuICAgICAqICdtYXRyaXhfcG9zZVswXScuIFRoZSB2YWx1ZSBpcyBjYWxjdWxhdGVkIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXZhaWxhYmxlIHVuaWZvcm0gdmVjdG9yc1xuICAgICAqIGF2YWlsYWJsZSBhZnRlciBzdWJ0cmFjdGluZyB0aGUgbnVtYmVyIHRha2VuIGJ5IGEgdHlwaWNhbCBoZWF2eXdlaWdodCBzaGFkZXIuIElmIGEgZGlmZmVyZW50XG4gICAgICogbnVtYmVyIGlzIHJlcXVpcmVkLCBpdCBjYW4gYmUgdHVuZWQgdmlhIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRCb25lTGltaXR9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1heGltdW0gbnVtYmVyIG9mIGJvbmVzIHRoYXQgY2FuIGJlIHN1cHBvcnRlZCBieSB0aGUgaG9zdCBoYXJkd2FyZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Qm9uZUxpbWl0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ib25lTGltaXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyB0aGF0IHRoZSBkZXZpY2UgY2FuIHN1cHBvcnQgb24gdGhlIGN1cnJlbnQgaGFyZHdhcmUuXG4gICAgICogVGhpcyBmdW5jdGlvbiBhbGxvd3MgdGhlIGRlZmF1bHQgY2FsY3VsYXRlZCB2YWx1ZSBiYXNlZCBvbiBhdmFpbGFibGUgdmVjdG9yIHVuaWZvcm1zIHRvIGJlXG4gICAgICogb3ZlcnJpZGRlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhCb25lcyAtIFRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyBzdXBwb3J0ZWQgYnkgdGhlIGhvc3QgaGFyZHdhcmUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEJvbmVMaW1pdChtYXhCb25lcykge1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IG1heEJvbmVzO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgR3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJFVkVOVF9SRVNJWkUiLCJHcmFwaGljc0RldmljZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiY2FudmFzIiwiZGV2aWNlVHlwZSIsInNjb3BlIiwiYm9uZUxpbWl0IiwibWF4QW5pc290cm9weSIsIm1heEN1YmVNYXBTaXplIiwibWF4VGV4dHVyZVNpemUiLCJtYXhWb2x1bWVTaXplIiwicHJlY2lzaW9uIiwicmVuZGVyVGFyZ2V0IiwiaW5zaWRlUmVuZGVyUGFzcyIsInN1cHBvcnRzSW5zdGFuY2luZyIsInN1cHBvcnRzVW5pZm9ybUJ1ZmZlcnMiLCJ0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIiwidGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUiLCJxdWFkVmVydGV4QnVmZmVyIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9tYXhQaXhlbFJhdGlvIiwicGxhdGZvcm0iLCJicm93c2VyIiwiTWF0aCIsIm1pbiIsIndpbmRvdyIsImRldmljZVBpeGVsUmF0aW8iLCJzaGFkZXJzIiwiYnVmZmVycyIsInRleHR1cmVzIiwidGFyZ2V0cyIsIl92cmFtIiwidGV4U2hhZG93IiwidGV4QXNzZXQiLCJ0ZXhMaWdodG1hcCIsInRleCIsInZiIiwiaWIiLCJ1YiIsIl9zaGFkZXJTdGF0cyIsInZzQ29tcGlsZWQiLCJmc0NvbXBpbGVkIiwibGlua2VkIiwibWF0ZXJpYWxTaGFkZXJzIiwiY29tcGlsZVRpbWUiLCJpbml0aWFsaXplQ29udGV4dENhY2hlcyIsIl9kcmF3Q2FsbHNQZXJGcmFtZSIsIl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lIiwiX3ByaW1zUGVyRnJhbWUiLCJpIiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9UUklGQU4iLCJfcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lIiwiU2NvcGVTcGFjZSIsInRleHR1cmVCaWFzIiwicmVzb2x2ZSIsInNldFZhbHVlIiwicG9zdEluaXQiLCJ2ZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhGb3JtYXQiLCJzZW1hbnRpYyIsIlNFTUFOVElDX1BPU0lUSU9OIiwiY29tcG9uZW50cyIsInR5cGUiLCJUWVBFX0ZMT0FUMzIiLCJwb3NpdGlvbnMiLCJGbG9hdDMyQXJyYXkiLCJWZXJ0ZXhCdWZmZXIiLCJCVUZGRVJfU1RBVElDIiwiZGVzdHJveSIsImZpcmUiLCJvbkRlc3Ryb3lTaGFkZXIiLCJzaGFkZXIiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwicG9zdERlc3Ryb3kiLCJ0b0pTT04iLCJrZXkiLCJ1bmRlZmluZWQiLCJpbmRleEJ1ZmZlciIsInZlcnRleEJ1ZmZlcnMiLCJpbml0aWFsaXplUmVuZGVyU3RhdGUiLCJ2eCIsInZ5IiwidnciLCJ2aCIsInN4Iiwic3kiLCJzdyIsInNoIiwic2V0UmVuZGVyVGFyZ2V0Iiwic2V0SW5kZXhCdWZmZXIiLCJzZXRWZXJ0ZXhCdWZmZXIiLCJ2ZXJ0ZXhCdWZmZXIiLCJwdXNoIiwiZ2V0UmVuZGVyVGFyZ2V0IiwiaW5pdFJlbmRlclRhcmdldCIsInRhcmdldCIsImluaXRpYWxpemVkIiwic3RhcnRUaW1lIiwibm93IiwidGltZXN0YW1wIiwiaW5pdCIsIl9pc0Jyb3dzZXJJbnRlcmZhY2UiLCJ0ZXh0dXJlIiwiX2lzSW1hZ2VCcm93c2VySW50ZXJmYWNlIiwiSFRNTENhbnZhc0VsZW1lbnQiLCJIVE1MVmlkZW9FbGVtZW50IiwiSW1hZ2VCaXRtYXAiLCJIVE1MSW1hZ2VFbGVtZW50IiwicmVzaXplQ2FudmFzIiwid2lkdGgiLCJoZWlnaHQiLCJyYXRpbyIsImZsb29yIiwic2V0UmVzb2x1dGlvbiIsInVwZGF0ZUNsaWVudFJlY3QiLCJjbGllbnRSZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiRGVidWciLCJlcnJvciIsImZ1bGxzY3JlZW4i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
