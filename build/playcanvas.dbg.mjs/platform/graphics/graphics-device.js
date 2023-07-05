import { extends as _extends } from '../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { now } from '../../core/time.js';
import { Tracing } from '../../core/tracing.js';
import { TRACEID_TEXTURES } from '../../core/constants.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, TYPE_FLOAT32, BUFFER_STATIC, CULLFACE_BACK, PRIMITIVE_POINTS } from './constants.js';
import { BlendState } from './blend-state.js';
import { DepthState } from './depth-state.js';
import { ScopeSpace } from './scope-space.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';
import { StencilParameters } from './stencil-parameters.js';
import { GpuProfiler } from './gpu-profiler.js';

/**
 * The graphics device manages the underlying graphics context. It is responsible for submitting
 * render state changes and graphics primitives to the hardware. A graphics device is tied to a
 * specific canvas HTML element. It is valid to have more than one canvas element per page and
 * create a new graphics device against each.
 *
 * @augments EventHandler
 */
class GraphicsDevice extends EventHandler {
  constructor(canvas, options) {
    var _this$initOptions, _this$initOptions$dep, _this$initOptions2, _this$initOptions2$st, _this$initOptions3, _this$initOptions3$an, _this$initOptions4, _this$initOptions4$po;
    super();
    /**
     * The canvas DOM element that provides the underlying WebGL context used by the graphics device.
     *
     * @type {HTMLCanvasElement}
     * @readonly
     */
    this.canvas = void 0;
    /**
     * True if the deviceType is WebGPU
     *
     * @type {boolean}
     * @readonly
     */
    this.isWebGPU = false;
    /**
     * The scope namespace for shader attributes and variables.
     *
     * @type {ScopeSpace}
     * @readonly
     */
    this.scope = void 0;
    /**
     * The maximum number of supported bones using uniform buffers.
     *
     * @type {number}
     * @readonly
     */
    this.boneLimit = void 0;
    /**
     * The maximum supported texture anisotropy setting.
     *
     * @type {number}
     * @readonly
     */
    this.maxAnisotropy = void 0;
    /**
     * The maximum supported dimension of a cube map.
     *
     * @type {number}
     * @readonly
     */
    this.maxCubeMapSize = void 0;
    /**
     * The maximum supported dimension of a texture.
     *
     * @type {number}
     * @readonly
     */
    this.maxTextureSize = void 0;
    /**
     * The maximum supported dimension of a 3D texture (any axis).
     *
     * @type {number}
     * @readonly
     */
    this.maxVolumeSize = void 0;
    /**
     * The maximum supported number of color buffers attached to a render target.
     *
     * @type {number}
     * @readonly
     */
    this.maxColorAttachments = 1;
    /**
     * The highest shader precision supported by this graphics device. Can be 'hiphp', 'mediump' or
     * 'lowp'.
     *
     * @type {string}
     * @readonly
     */
    this.precision = void 0;
    /**
     * The number of hardware anti-aliasing samples used by the frame buffer.
     *
     * @readonly
     * @type {number}
     */
    this.samples = void 0;
    /**
     * True if the main framebuffer contains stencil attachment.
     *
     * @ignore
     * @type {boolean}
     */
    this.supportsStencil = void 0;
    /**
     * True if Multiple Render Targets feature is supported. This refers to the ability to render to
     * multiple color textures with a single draw call.
     *
     * @readonly
     * @type {boolean}
     */
    this.supportsMrt = false;
    /**
     * True if the device supports volume textures.
     *
     * @readonly
     * @type {boolean}
     */
    this.supportsVolumeTextures = false;
    /**
     * Currently active render target.
     *
     * @type {import('./render-target.js').RenderTarget}
     * @ignore
     */
    this.renderTarget = null;
    /**
     * A version number that is incremented every frame. This is used to detect if some object were
     * invalidated.
     *
     * @type {number}
     * @ignore
     */
    this.renderVersion = 0;
    /**
     * Index of the currently active render pass.
     *
     * @type {number}
     * @ignore
     */
    this.renderPassIndex = void 0;
    /** @type {boolean} */
    this.insideRenderPass = false;
    /**
     * True if hardware instancing is supported.
     *
     * @type {boolean}
     * @readonly
     */
    this.supportsInstancing = void 0;
    /**
     * True if the device supports uniform buffers.
     *
     * @type {boolean}
     * @ignore
     */
    this.supportsUniformBuffers = false;
    /**
     * True if 32-bit floating-point textures can be used as a frame buffer.
     *
     * @type {boolean}
     * @readonly
     */
    this.textureFloatRenderable = void 0;
    /**
     * True if 16-bit floating-point textures can be used as a frame buffer.
     *
     * @type {boolean}
     * @readonly
     */
    this.textureHalfFloatRenderable = void 0;
    /**
     * A vertex buffer representing a quad.
     *
     * @type {VertexBuffer}
     * @ignore
     */
    this.quadVertexBuffer = void 0;
    /**
     * An object representing current blend state
     *
     * @ignore
     */
    this.blendState = new BlendState();
    /**
     * The current depth state.
     *
     * @ignore
     */
    this.depthState = new DepthState();
    /**
     * True if stencil is enabled and stencilFront and stencilBack are used
     *
     * @ignore
     */
    this.stencilEnabled = false;
    /**
     * The current front stencil parameters.
     *
     * @ignore
     */
    this.stencilFront = new StencilParameters();
    /**
     * The current back stencil parameters.
     *
     * @ignore
     */
    this.stencilBack = new StencilParameters();
    /**
     * The dynamic buffer manager.
     *
     * @type {import('./dynamic-buffers.js').DynamicBuffers}
     * @ignore
     */
    this.dynamicBuffers = void 0;
    /**
     * @ignore
     */
    this.gpuProfiler = new GpuProfiler();
    this.defaultClearOptions = {
      color: [0, 0, 0, 1],
      depth: 1,
      stencil: 0,
      flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
    };
    this.canvas = canvas;

    // copy options and handle defaults
    this.initOptions = _extends({}, options);
    (_this$initOptions$dep = (_this$initOptions = this.initOptions).depth) != null ? _this$initOptions$dep : _this$initOptions.depth = true;
    (_this$initOptions2$st = (_this$initOptions2 = this.initOptions).stencil) != null ? _this$initOptions2$st : _this$initOptions2.stencil = true;
    (_this$initOptions3$an = (_this$initOptions3 = this.initOptions).antialias) != null ? _this$initOptions3$an : _this$initOptions3.antialias = true;
    (_this$initOptions4$po = (_this$initOptions4 = this.initOptions).powerPreference) != null ? _this$initOptions4$po : _this$initOptions4.powerPreference = 'high-performance';

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
    var _this$quadVertexBuffe, _this$dynamicBuffers, _this$gpuProfiler;
    // fire the destroy event.
    // textures and other device resources may destroy themselves in response.
    this.fire('destroy');
    (_this$quadVertexBuffe = this.quadVertexBuffer) == null ? void 0 : _this$quadVertexBuffe.destroy();
    this.quadVertexBuffer = null;
    (_this$dynamicBuffers = this.dynamicBuffers) == null ? void 0 : _this$dynamicBuffers.destroy();
    this.dynamicBuffers = null;
    (_this$gpuProfiler = this.gpuProfiler) == null ? void 0 : _this$gpuProfiler.destroy();
    this.gpuProfiler = null;
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
    this.cullMode = CULLFACE_BACK;

    // Cached viewport and scissor dimensions
    this.vx = this.vy = this.vw = this.vh = 0;
    this.sx = this.sy = this.sw = this.sh = 0;
  }

  /**
   * Sets the specified stencil state. If both stencilFront and stencilBack are null, stencil
   * operation is disabled.
   *
   * @param {StencilParameters} [stencilFront] - The front stencil parameters. Defaults to
   * {@link StencilParameters.DEFAULT} if not specified.
   * @param {StencilParameters} [stencilBack] - The back stencil parameters. Defaults to
   * {@link StencilParameters.DEFAULT} if not specified.
   */
  setStencilState(stencilFront, stencilBack) {
    Debug.assert(false);
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
   * Controls how triangles are culled based on their face direction. The default cull mode is
   * {@link CULLFACE_BACK}.
   *
   * @param {number} cullMode - The cull mode to set. Can be:
   *
   * - {@link CULLFACE_NONE}
   * - {@link CULLFACE_BACK}
   * - {@link CULLFACE_FRONT}
   */
  setCullMode(cullMode) {
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
   * const renderTarget = device.getRenderTarget();
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
    return this._isImageBrowserInterface(texture) || this._isImageCanvasInterface(texture) || this._isImageVideoInterface(texture);
  }
  _isImageBrowserInterface(texture) {
    return typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap || typeof HTMLImageElement !== 'undefined' && texture instanceof HTMLImageElement;
  }
  _isImageCanvasInterface(texture) {
    return typeof HTMLCanvasElement !== 'undefined' && texture instanceof HTMLCanvasElement;
  }
  _isImageVideoInterface(texture) {
    return typeof HTMLVideoElement !== 'undefined' && texture instanceof HTMLVideoElement;
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
    this.renderVersion++;
    Debug.call(() => {
      // log out all loaded textures, sorted by gpu memory size
      if (Tracing.get(TRACEID_TEXTURES)) {
        const textures = this.textures.slice();
        textures.sort((a, b) => b.gpuSize - a.gpuSize);
        Debug.log(`Textures: ${textures.length}`);
        let textureTotal = 0;
        textures.forEach((texture, index) => {
          const textureSize = texture.gpuSize;
          textureTotal += textureSize;
          Debug.log(`${index}. ${texture.name} ${texture.width}x${texture.height} VRAM: ${(textureSize / 1024 / 1024).toFixed(2)} MB`);
        });
        Debug.log(`Total: ${(textureTotal / 1024 / 1024).toFixed(2)}MB`);
      }
    });
  }

  /**
   * Function which executes at the end of the frame. This should not be called manually, as it is
   * handled by the AppBase instance.
   *
   * @ignore
   */
  frameEnd() {}
}
GraphicsDevice.EVENT_RESIZE = 'resizecanvas';

export { GraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBUcmFjaW5nIH0gZnJvbSAnLi4vLi4vY29yZS90cmFjaW5nLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRVMgfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9CQUNLLFxuICAgIENMRUFSRkxBR19DT0xPUiwgQ0xFQVJGTEFHX0RFUFRILFxuICAgIFBSSU1JVElWRV9QT0lOVFMsIFBSSU1JVElWRV9UUklGQU4sIFNFTUFOVElDX1BPU0lUSU9OLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4vYmxlbmQtc3RhdGUuanMnO1xuaW1wb3J0IHsgRGVwdGhTdGF0ZSB9IGZyb20gJy4vZGVwdGgtc3RhdGUuanMnO1xuaW1wb3J0IHsgU2NvcGVTcGFjZSB9IGZyb20gJy4vc2NvcGUtc3BhY2UuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4vdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBTdGVuY2lsUGFyYW1ldGVycyB9IGZyb20gJy4vc3RlbmNpbC1wYXJhbWV0ZXJzLmpzJztcbmltcG9ydCB7IEdwdVByb2ZpbGVyIH0gZnJvbSAnLi9ncHUtcHJvZmlsZXIuanMnO1xuXG4vKipcbiAqIFRoZSBncmFwaGljcyBkZXZpY2UgbWFuYWdlcyB0aGUgdW5kZXJseWluZyBncmFwaGljcyBjb250ZXh0LiBJdCBpcyByZXNwb25zaWJsZSBmb3Igc3VibWl0dGluZ1xuICogcmVuZGVyIHN0YXRlIGNoYW5nZXMgYW5kIGdyYXBoaWNzIHByaW1pdGl2ZXMgdG8gdGhlIGhhcmR3YXJlLiBBIGdyYXBoaWNzIGRldmljZSBpcyB0aWVkIHRvIGFcbiAqIHNwZWNpZmljIGNhbnZhcyBIVE1MIGVsZW1lbnQuIEl0IGlzIHZhbGlkIHRvIGhhdmUgbW9yZSB0aGFuIG9uZSBjYW52YXMgZWxlbWVudCBwZXIgcGFnZSBhbmRcbiAqIGNyZWF0ZSBhIG5ldyBncmFwaGljcyBkZXZpY2UgYWdhaW5zdCBlYWNoLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgR3JhcGhpY3NEZXZpY2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIFRoZSBjYW52YXMgRE9NIGVsZW1lbnQgdGhhdCBwcm92aWRlcyB0aGUgdW5kZXJseWluZyBXZWJHTCBjb250ZXh0IHVzZWQgYnkgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtIVE1MQ2FudmFzRWxlbWVudH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBjYW52YXM7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBkZXZpY2VUeXBlIGlzIFdlYkdQVVxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgaXNXZWJHUFUgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzY29wZSBuYW1lc3BhY2UgZm9yIHNoYWRlciBhdHRyaWJ1dGVzIGFuZCB2YXJpYWJsZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2NvcGVTcGFjZX1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzY29wZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIG51bWJlciBvZiBzdXBwb3J0ZWQgYm9uZXMgdXNpbmcgdW5pZm9ybSBidWZmZXJzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBib25lTGltaXQ7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBzdXBwb3J0ZWQgdGV4dHVyZSBhbmlzb3Ryb3B5IHNldHRpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIG1heEFuaXNvdHJvcHk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBzdXBwb3J0ZWQgZGltZW5zaW9uIG9mIGEgY3ViZSBtYXAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIG1heEN1YmVNYXBTaXplO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gc3VwcG9ydGVkIGRpbWVuc2lvbiBvZiBhIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIG1heFRleHR1cmVTaXplO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG1heGltdW0gc3VwcG9ydGVkIGRpbWVuc2lvbiBvZiBhIDNEIHRleHR1cmUgKGFueSBheGlzKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgbWF4Vm9sdW1lU2l6ZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIHN1cHBvcnRlZCBudW1iZXIgb2YgY29sb3IgYnVmZmVycyBhdHRhY2hlZCB0byBhIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIG1heENvbG9yQXR0YWNobWVudHMgPSAxO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGhpZ2hlc3Qgc2hhZGVyIHByZWNpc2lvbiBzdXBwb3J0ZWQgYnkgdGhpcyBncmFwaGljcyBkZXZpY2UuIENhbiBiZSAnaGlwaHAnLCAnbWVkaXVtcCcgb3JcbiAgICAgKiAnbG93cCcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHByZWNpc2lvbjtcblxuICAgIC8qKlxuICAgICAqIFRoZSBudW1iZXIgb2YgaGFyZHdhcmUgYW50aS1hbGlhc2luZyBzYW1wbGVzIHVzZWQgYnkgdGhlIGZyYW1lIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2FtcGxlcztcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIG1haW4gZnJhbWVidWZmZXIgY29udGFpbnMgc3RlbmNpbCBhdHRhY2htZW50LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHN1cHBvcnRzU3RlbmNpbDtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgTXVsdGlwbGUgUmVuZGVyIFRhcmdldHMgZmVhdHVyZSBpcyBzdXBwb3J0ZWQuIFRoaXMgcmVmZXJzIHRvIHRoZSBhYmlsaXR5IHRvIHJlbmRlciB0b1xuICAgICAqIG11bHRpcGxlIGNvbG9yIHRleHR1cmVzIHdpdGggYSBzaW5nbGUgZHJhdyBjYWxsLlxuICAgICAqXG4gICAgICogQHJlYWRvbmx5XG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc3VwcG9ydHNNcnQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRldmljZSBzdXBwb3J0cyB2b2x1bWUgdGV4dHVyZXMuXG4gICAgICpcbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzdXBwb3J0c1ZvbHVtZVRleHR1cmVzID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDdXJyZW50bHkgYWN0aXZlIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbmRlclRhcmdldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBBIHZlcnNpb24gbnVtYmVyIHRoYXQgaXMgaW5jcmVtZW50ZWQgZXZlcnkgZnJhbWUuIFRoaXMgaXMgdXNlZCB0byBkZXRlY3QgaWYgc29tZSBvYmplY3Qgd2VyZVxuICAgICAqIGludmFsaWRhdGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyVmVyc2lvbiA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBJbmRleCBvZiB0aGUgY3VycmVudGx5IGFjdGl2ZSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbmRlclBhc3NJbmRleDtcblxuICAgIC8qKiBAdHlwZSB7Ym9vbGVhbn0gKi9cbiAgICBpbnNpZGVSZW5kZXJQYXNzID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIGhhcmR3YXJlIGluc3RhbmNpbmcgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3VwcG9ydHNJbnN0YW5jaW5nO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgZGV2aWNlIHN1cHBvcnRzIHVuaWZvcm0gYnVmZmVycy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdXBwb3J0c1VuaWZvcm1CdWZmZXJzID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIDMyLWJpdCBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBjYW4gYmUgdXNlZCBhcyBhIGZyYW1lIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHRleHR1cmVGbG9hdFJlbmRlcmFibGU7XG5cbiAgICAgLyoqXG4gICAgICAqIFRydWUgaWYgMTYtYml0IGZsb2F0aW5nLXBvaW50IHRleHR1cmVzIGNhbiBiZSB1c2VkIGFzIGEgZnJhbWUgYnVmZmVyLlxuICAgICAgKlxuICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICogQHJlYWRvbmx5XG4gICAgICAqL1xuICAgIHRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlO1xuXG4gICAgLyoqXG4gICAgICogQSB2ZXJ0ZXggYnVmZmVyIHJlcHJlc2VudGluZyBhIHF1YWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVydGV4QnVmZmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBxdWFkVmVydGV4QnVmZmVyO1xuXG4gICAgLyoqXG4gICAgICogQW4gb2JqZWN0IHJlcHJlc2VudGluZyBjdXJyZW50IGJsZW5kIHN0YXRlXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYmxlbmRTdGF0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBkZXB0aCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkZXB0aFN0YXRlID0gbmV3IERlcHRoU3RhdGUoKTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgc3RlbmNpbCBpcyBlbmFibGVkIGFuZCBzdGVuY2lsRnJvbnQgYW5kIHN0ZW5jaWxCYWNrIGFyZSB1c2VkXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RlbmNpbEVuYWJsZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGZyb250IHN0ZW5jaWwgcGFyYW1ldGVycy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGVuY2lsRnJvbnQgPSBuZXcgU3RlbmNpbFBhcmFtZXRlcnMoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGJhY2sgc3RlbmNpbCBwYXJhbWV0ZXJzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0ZW5jaWxCYWNrID0gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZHluYW1pYyBidWZmZXIgbWFuYWdlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vZHluYW1pYy1idWZmZXJzLmpzJykuRHluYW1pY0J1ZmZlcnN9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGR5bmFtaWNCdWZmZXJzO1xuXG4gICAgLyoqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdwdVByb2ZpbGVyID0gbmV3IEdwdVByb2ZpbGVyKCk7XG5cbiAgICBkZWZhdWx0Q2xlYXJPcHRpb25zID0ge1xuICAgICAgICBjb2xvcjogWzAsIDAsIDAsIDFdLFxuICAgICAgICBkZXB0aDogMSxcbiAgICAgICAgc3RlbmNpbDogMCxcbiAgICAgICAgZmxhZ3M6IENMRUFSRkxBR19DT0xPUiB8IENMRUFSRkxBR19ERVBUSFxuICAgIH07XG5cbiAgICBzdGF0aWMgRVZFTlRfUkVTSVpFID0gJ3Jlc2l6ZWNhbnZhcyc7XG5cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMsIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLmNhbnZhcyA9IGNhbnZhcztcblxuICAgICAgICAvLyBjb3B5IG9wdGlvbnMgYW5kIGhhbmRsZSBkZWZhdWx0c1xuICAgICAgICB0aGlzLmluaXRPcHRpb25zID0geyAuLi5vcHRpb25zIH07XG4gICAgICAgIHRoaXMuaW5pdE9wdGlvbnMuZGVwdGggPz89IHRydWU7XG4gICAgICAgIHRoaXMuaW5pdE9wdGlvbnMuc3RlbmNpbCA/Pz0gdHJ1ZTtcbiAgICAgICAgdGhpcy5pbml0T3B0aW9ucy5hbnRpYWxpYXMgPz89IHRydWU7XG4gICAgICAgIHRoaXMuaW5pdE9wdGlvbnMucG93ZXJQcmVmZXJlbmNlID8/PSAnaGlnaC1wZXJmb3JtYW5jZSc7XG5cbiAgICAgICAgLy8gbG9jYWwgd2lkdGgvaGVpZ2h0IHdpdGhvdXQgcGl4ZWxSYXRpbyBhcHBsaWVkXG4gICAgICAgIHRoaXMuX3dpZHRoID0gMDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gMDtcblxuICAgICAgICAvLyBTb21lIGRldmljZXMgd2luZG93LmRldmljZVBpeGVsUmF0aW8gY2FuIGJlIGxlc3MgdGhhbiBvbmVcbiAgICAgICAgLy8gZWcgT2N1bHVzIFF1ZXN0IDEgd2hpY2ggcmV0dXJucyBhIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvIG9mIDAuOFxuICAgICAgICB0aGlzLl9tYXhQaXhlbFJhdGlvID0gcGxhdGZvcm0uYnJvd3NlciA/IE1hdGgubWluKDEsIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvKSA6IDE7XG5cbiAgICAgICAgLy8gQXJyYXkgb2Ygb2JqZWN0cyB0aGF0IG5lZWQgdG8gYmUgcmUtaW5pdGlhbGl6ZWQgYWZ0ZXIgYSBjb250ZXh0IHJlc3RvcmUgZXZlbnRcbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vc2hhZGVyLmpzJykuU2hhZGVyW119ICovXG4gICAgICAgIHRoaXMuc2hhZGVycyA9IFtdO1xuXG4gICAgICAgIHRoaXMuYnVmZmVycyA9IFtdO1xuXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuL3RleHR1cmUuanMnKS5UZXh0dXJlW119ICovXG4gICAgICAgIHRoaXMudGV4dHVyZXMgPSBbXTtcblxuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0W119ICovXG4gICAgICAgIHRoaXMudGFyZ2V0cyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX3ZyYW0gPSB7XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0ZXhTaGFkb3c6IDAsXG4gICAgICAgICAgICB0ZXhBc3NldDogMCxcbiAgICAgICAgICAgIHRleExpZ2h0bWFwOiAwLFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICB0ZXg6IDAsXG4gICAgICAgICAgICB2YjogMCxcbiAgICAgICAgICAgIGliOiAwLFxuICAgICAgICAgICAgdWI6IDBcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9zaGFkZXJTdGF0cyA9IHtcbiAgICAgICAgICAgIHZzQ29tcGlsZWQ6IDAsXG4gICAgICAgICAgICBmc0NvbXBpbGVkOiAwLFxuICAgICAgICAgICAgbGlua2VkOiAwLFxuICAgICAgICAgICAgbWF0ZXJpYWxTaGFkZXJzOiAwLFxuICAgICAgICAgICAgY29tcGlsZVRpbWU6IDBcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gUHJvZmlsZXIgc3RhdHNcbiAgICAgICAgdGhpcy5fZHJhd0NhbGxzUGVyRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lID0gMDtcblxuICAgICAgICB0aGlzLl9wcmltc1BlckZyYW1lID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSBQUklNSVRJVkVfUE9JTlRTOyBpIDw9IFBSSU1JVElWRV9UUklGQU47IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fcHJpbXNQZXJGcmFtZVtpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lID0gMDtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIFNjb3BlTmFtZXNwYWNlIGZvciBzaGFkZXIgYXR0cmlidXRlcyBhbmQgdmFyaWFibGVzXG4gICAgICAgIHRoaXMuc2NvcGUgPSBuZXcgU2NvcGVTcGFjZShcIkRldmljZVwiKTtcblxuICAgICAgICB0aGlzLnRleHR1cmVCaWFzID0gdGhpcy5zY29wZS5yZXNvbHZlKFwidGV4dHVyZUJpYXNcIik7XG4gICAgICAgIHRoaXMudGV4dHVyZUJpYXMuc2V0VmFsdWUoMC4wKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB0aGF0IGV4ZWN1dGVzIGFmdGVyIHRoZSBkZXZpY2UgaGFzIGJlZW4gY3JlYXRlZC5cbiAgICAgKi9cbiAgICBwb3N0SW5pdCgpIHtcblxuICAgICAgICAvLyBjcmVhdGUgcXVhZCB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgIGNvbnN0IHZlcnRleEZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQodGhpcywgW1xuICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfUE9TSVRJT04sIGNvbXBvbmVudHM6IDIsIHR5cGU6IFRZUEVfRkxPQVQzMiB9XG4gICAgICAgIF0pO1xuICAgICAgICBjb25zdCBwb3NpdGlvbnMgPSBuZXcgRmxvYXQzMkFycmF5KFstMSwgLTEsIDEsIC0xLCAtMSwgMSwgMSwgMV0pO1xuICAgICAgICB0aGlzLnF1YWRWZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKHRoaXMsIHZlcnRleEZvcm1hdCwgNCwgQlVGRkVSX1NUQVRJQywgcG9zaXRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBjYW52YXMgaXMgcmVzaXplZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBHcmFwaGljc0RldmljZSNyZXNpemVjYW52YXNcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgbmV3IGhlaWdodCBvZiB0aGUgY2FudmFzIGluIHBpeGVscy5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyBmaXJlIHRoZSBkZXN0cm95IGV2ZW50LlxuICAgICAgICAvLyB0ZXh0dXJlcyBhbmQgb3RoZXIgZGV2aWNlIHJlc291cmNlcyBtYXkgZGVzdHJveSB0aGVtc2VsdmVzIGluIHJlc3BvbnNlLlxuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3knKTtcblxuICAgICAgICB0aGlzLnF1YWRWZXJ0ZXhCdWZmZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5xdWFkVmVydGV4QnVmZmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmR5bmFtaWNCdWZmZXJzPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuZHluYW1pY0J1ZmZlcnMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuZ3B1UHJvZmlsZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5ncHVQcm9maWxlciA9IG51bGw7XG4gICAgfVxuXG4gICAgb25EZXN0cm95U2hhZGVyKHNoYWRlcikge1xuICAgICAgICB0aGlzLmZpcmUoJ2Rlc3Ryb3k6c2hhZGVyJywgc2hhZGVyKTtcblxuICAgICAgICBjb25zdCBpZHggPSB0aGlzLnNoYWRlcnMuaW5kZXhPZihzaGFkZXIpO1xuICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5zaGFkZXJzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZXhlY3V0ZXMgYWZ0ZXIgdGhlIGV4dGVuZGVkIGNsYXNzZXMgaGF2ZSBleGVjdXRlZCB0aGVpciBkZXN0cm95IGZ1bmN0aW9uXG4gICAgcG9zdERlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuc2NvcGUgPSBudWxsO1xuICAgICAgICB0aGlzLmNhbnZhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gZG9uJ3Qgc3RyaW5naWZ5IEdyYXBoaWNzRGV2aWNlIHRvIEpTT04gYnkgSlNPTi5zdHJpbmdpZnlcbiAgICB0b0pTT04oa2V5KSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKSB7XG4gICAgICAgIHRoaXMuaW5kZXhCdWZmZXIgPSBudWxsO1xuICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5zaGFkZXIgPSBudWxsO1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IG51bGw7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCkge1xuXG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG4gICAgICAgIHRoaXMuZGVwdGhTdGF0ZSA9IG5ldyBEZXB0aFN0YXRlKCk7XG4gICAgICAgIHRoaXMuY3VsbE1vZGUgPSBDVUxMRkFDRV9CQUNLO1xuXG4gICAgICAgIC8vIENhY2hlZCB2aWV3cG9ydCBhbmQgc2Npc3NvciBkaW1lbnNpb25zXG4gICAgICAgIHRoaXMudnggPSB0aGlzLnZ5ID0gdGhpcy52dyA9IHRoaXMudmggPSAwO1xuICAgICAgICB0aGlzLnN4ID0gdGhpcy5zeSA9IHRoaXMuc3cgPSB0aGlzLnNoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgc3RlbmNpbCBzdGF0ZS4gSWYgYm90aCBzdGVuY2lsRnJvbnQgYW5kIHN0ZW5jaWxCYWNrIGFyZSBudWxsLCBzdGVuY2lsXG4gICAgICogb3BlcmF0aW9uIGlzIGRpc2FibGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdGVuY2lsUGFyYW1ldGVyc30gW3N0ZW5jaWxGcm9udF0gLSBUaGUgZnJvbnQgc3RlbmNpbCBwYXJhbWV0ZXJzLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBTdGVuY2lsUGFyYW1ldGVycy5ERUZBVUxUfSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7U3RlbmNpbFBhcmFtZXRlcnN9IFtzdGVuY2lsQmFja10gLSBUaGUgYmFjayBzdGVuY2lsIHBhcmFtZXRlcnMuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFR9IGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICovXG4gICAgc2V0U3RlbmNpbFN0YXRlKHN0ZW5jaWxGcm9udCwgc3RlbmNpbEJhY2spIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgYmxlbmQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0JsZW5kU3RhdGV9IGJsZW5kU3RhdGUgLSBOZXcgYmxlbmQgc3RhdGUuXG4gICAgICovXG4gICAgc2V0QmxlbmRTdGF0ZShibGVuZFN0YXRlKSB7XG4gICAgICAgIERlYnVnLmFzc2VydChmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIGRlcHRoIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtEZXB0aFN0YXRlfSBkZXB0aFN0YXRlIC0gTmV3IGRlcHRoIHN0YXRlLlxuICAgICAqL1xuICAgIHNldERlcHRoU3RhdGUoZGVwdGhTdGF0ZSkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyB0cmlhbmdsZXMgYXJlIGN1bGxlZCBiYXNlZCBvbiB0aGVpciBmYWNlIGRpcmVjdGlvbi4gVGhlIGRlZmF1bHQgY3VsbCBtb2RlIGlzXG4gICAgICoge0BsaW5rIENVTExGQUNFX0JBQ0t9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGN1bGxNb2RlIC0gVGhlIGN1bGwgbW9kZSB0byBzZXQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX05PTkV9XG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfQkFDS31cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9GUk9OVH1cbiAgICAgKi9cbiAgICBzZXRDdWxsTW9kZShjdWxsTW9kZSkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCByZW5kZXIgdGFyZ2V0IG9uIHRoZSBkZXZpY2UuIElmIG51bGwgaXMgcGFzc2VkIGFzIGEgcGFyYW1ldGVyLCB0aGUgYmFja1xuICAgICAqIGJ1ZmZlciBiZWNvbWVzIHRoZSBjdXJyZW50IHRhcmdldCBmb3IgYWxsIHJlbmRlcmluZyBvcGVyYXRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gcmVuZGVyVGFyZ2V0IC0gVGhlIHJlbmRlciB0YXJnZXQgdG9cbiAgICAgKiBhY3RpdmF0ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCBhIHJlbmRlciB0YXJnZXQgdG8gcmVjZWl2ZSBhbGwgcmVuZGVyaW5nIG91dHB1dFxuICAgICAqIGRldmljZS5zZXRSZW5kZXJUYXJnZXQocmVuZGVyVGFyZ2V0KTtcbiAgICAgKlxuICAgICAqIC8vIFNldCB0aGUgYmFjayBidWZmZXIgdG8gcmVjZWl2ZSBhbGwgcmVuZGVyaW5nIG91dHB1dFxuICAgICAqIGRldmljZS5zZXRSZW5kZXJUYXJnZXQobnVsbCk7XG4gICAgICovXG4gICAgc2V0UmVuZGVyVGFyZ2V0KHJlbmRlclRhcmdldCkge1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHJlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjdXJyZW50IGluZGV4IGJ1ZmZlciBvbiB0aGUgZ3JhcGhpY3MgZGV2aWNlLiBPbiBzdWJzZXF1ZW50IGNhbGxzIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI2RyYXd9LCB0aGUgc3BlY2lmaWVkIGluZGV4IGJ1ZmZlciB3aWxsIGJlIHVzZWQgdG8gcHJvdmlkZSBpbmRleCBkYXRhXG4gICAgICogZm9yIGFueSBpbmRleGVkIHByaW1pdGl2ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9pbmRleC1idWZmZXIuanMnKS5JbmRleEJ1ZmZlcn0gaW5kZXhCdWZmZXIgLSBUaGUgaW5kZXggYnVmZmVyIHRvIGFzc2lnbiB0b1xuICAgICAqIHRoZSBkZXZpY2UuXG4gICAgICovXG4gICAgc2V0SW5kZXhCdWZmZXIoaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgLy8gU3RvcmUgdGhlIGluZGV4IGJ1ZmZlclxuICAgICAgICB0aGlzLmluZGV4QnVmZmVyID0gaW5kZXhCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3VycmVudCB2ZXJ0ZXggYnVmZmVyIG9uIHRoZSBncmFwaGljcyBkZXZpY2UuIE9uIHN1YnNlcXVlbnQgY2FsbHMgdG9cbiAgICAgKiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjZHJhd30sIHRoZSBzcGVjaWZpZWQgdmVydGV4IGJ1ZmZlcihzKSB3aWxsIGJlIHVzZWQgdG8gcHJvdmlkZSB2ZXJ0ZXhcbiAgICAgKiBkYXRhIGZvciBhbnkgcHJpbWl0aXZlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3ZlcnRleC1idWZmZXIuanMnKS5WZXJ0ZXhCdWZmZXJ9IHZlcnRleEJ1ZmZlciAtIFRoZSB2ZXJ0ZXggYnVmZmVyIHRvXG4gICAgICogYXNzaWduIHRvIHRoZSBkZXZpY2UuXG4gICAgICovXG4gICAgc2V0VmVydGV4QnVmZmVyKHZlcnRleEJ1ZmZlcikge1xuXG4gICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMudmVydGV4QnVmZmVycy5wdXNoKHZlcnRleEJ1ZmZlcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSBjdXJyZW50bHkgc2V0IHJlbmRlciB0YXJnZXQgb24gdGhlIGRldmljZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4vcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldH0gVGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCB0aGUgY3VycmVudCByZW5kZXIgdGFyZ2V0XG4gICAgICogY29uc3QgcmVuZGVyVGFyZ2V0ID0gZGV2aWNlLmdldFJlbmRlclRhcmdldCgpO1xuICAgICAqL1xuICAgIGdldFJlbmRlclRhcmdldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgcmVuZGVyIHRhcmdldCBiZWZvcmUgaXQgY2FuIGJlIHVzZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fSB0YXJnZXQgLSBUaGUgcmVuZGVyIHRhcmdldCB0byBiZVxuICAgICAqIGluaXRpYWxpemVkLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0UmVuZGVyVGFyZ2V0KHRhcmdldCkge1xuXG4gICAgICAgIGlmICh0YXJnZXQuaW5pdGlhbGl6ZWQpIHJldHVybjtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICB0aGlzLmZpcmUoJ2ZibzpjcmVhdGUnLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IHN0YXJ0VGltZSxcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGFyZ2V0LmluaXQoKTtcbiAgICAgICAgdGhpcy50YXJnZXRzLnB1c2godGFyZ2V0KTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3JlbmRlclRhcmdldENyZWF0aW9uVGltZSArPSBub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIGEgdGV4dHVyZSBzb3VyY2UgaXMgYSBjYW52YXMsIGltYWdlLCB2aWRlbyBvciBJbWFnZUJpdG1hcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdGV4dHVyZSAtIFRleHR1cmUgc291cmNlIGRhdGEuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHRleHR1cmUgaXMgYSBjYW52YXMsIGltYWdlLCB2aWRlbyBvciBJbWFnZUJpdG1hcCBhbmQgZmFsc2VcbiAgICAgKiBvdGhlcndpc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9pc0Jyb3dzZXJJbnRlcmZhY2UodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNJbWFnZUJyb3dzZXJJbnRlcmZhY2UodGV4dHVyZSkgfHxcbiAgICAgICAgICAgICAgICB0aGlzLl9pc0ltYWdlQ2FudmFzSW50ZXJmYWNlKHRleHR1cmUpIHx8XG4gICAgICAgICAgICAgICAgdGhpcy5faXNJbWFnZVZpZGVvSW50ZXJmYWNlKHRleHR1cmUpO1xuICAgIH1cblxuICAgIF9pc0ltYWdlQnJvd3NlckludGVyZmFjZSh0ZXh0dXJlKSB7XG4gICAgICAgIHJldHVybiAodHlwZW9mIEltYWdlQml0bWFwICE9PSAndW5kZWZpbmVkJyAmJiB0ZXh0dXJlIGluc3RhbmNlb2YgSW1hZ2VCaXRtYXApIHx8XG4gICAgICAgICAgICAgICAodHlwZW9mIEhUTUxJbWFnZUVsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHRleHR1cmUgaW5zdGFuY2VvZiBIVE1MSW1hZ2VFbGVtZW50KTtcbiAgICB9XG5cbiAgICBfaXNJbWFnZUNhbnZhc0ludGVyZmFjZSh0ZXh0dXJlKSB7XG4gICAgICAgIHJldHVybiAodHlwZW9mIEhUTUxDYW52YXNFbGVtZW50ICE9PSAndW5kZWZpbmVkJyAmJiB0ZXh0dXJlIGluc3RhbmNlb2YgSFRNTENhbnZhc0VsZW1lbnQpO1xuICAgIH1cblxuICAgIF9pc0ltYWdlVmlkZW9JbnRlcmZhY2UodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gKHR5cGVvZiBIVE1MVmlkZW9FbGVtZW50ICE9PSAndW5kZWZpbmVkJyAmJiB0ZXh0dXJlIGluc3RhbmNlb2YgSFRNTFZpZGVvRWxlbWVudCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGUgY2FudmFzLCB0aGVuIGZpcmVzIHRoZSBgcmVzaXplY2FudmFzYCBldmVudC4gTm90ZSB0aGF0IHRoZVxuICAgICAqIHNwZWNpZmllZCB3aWR0aCBhbmQgaGVpZ2h0IHZhbHVlcyB3aWxsIGJlIG11bHRpcGxpZWQgYnkgdGhlIHZhbHVlIG9mXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI21heFBpeGVsUmF0aW99IHRvIGdpdmUgdGhlIGZpbmFsIHJlc3VsdGFudCB3aWR0aCBhbmQgaGVpZ2h0IGZvciB0aGVcbiAgICAgKiBjYW52YXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgbmV3IHdpZHRoIG9mIHRoZSBjYW52YXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBuZXcgaGVpZ2h0IG9mIHRoZSBjYW52YXMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KSB7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGUgY2FudmFzLCB0aGVuIGZpcmVzIHRoZSBgcmVzaXplY2FudmFzYCBldmVudC4gTm90ZSB0aGF0IHRoZVxuICAgICAqIHZhbHVlIG9mIHtAbGluayBHcmFwaGljc0RldmljZSNtYXhQaXhlbFJhdGlvfSBpcyBpZ25vcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIG5ldyB3aWR0aCBvZiB0aGUgY2FudmFzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgbmV3IGhlaWdodCBvZiB0aGUgY2FudmFzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRSZXNvbHV0aW9uKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICB0aGlzLmNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgIHRoaXMuZmlyZShHcmFwaGljc0RldmljZS5FVkVOVF9SRVNJWkUsIHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIHVwZGF0ZUNsaWVudFJlY3QoKSB7XG4gICAgICAgIHRoaXMuY2xpZW50UmVjdCA9IHRoaXMuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdpZHRoIG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgRGVidWcuZXJyb3IoXCJHcmFwaGljc0RldmljZS53aWR0aCBpcyBub3QgaW1wbGVtZW50ZWQgb24gY3VycmVudCBkZXZpY2UuXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5jYW52YXMud2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGVpZ2h0IG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIERlYnVnLmVycm9yKFwiR3JhcGhpY3NEZXZpY2UuaGVpZ2h0IGlzIG5vdCBpbXBsZW1lbnRlZCBvbiBjdXJyZW50IGRldmljZS5cIik7XG4gICAgICAgIHJldHVybiB0aGlzLmNhbnZhcy5oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVsbHNjcmVlbiBtb2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZ1bGxzY3JlZW4oZnVsbHNjcmVlbikge1xuICAgICAgICBEZWJ1Zy5lcnJvcihcIkdyYXBoaWNzRGV2aWNlLmZ1bGxzY3JlZW4gaXMgbm90IGltcGxlbWVudGVkIG9uIGN1cnJlbnQgZGV2aWNlLlwiKTtcbiAgICB9XG5cbiAgICBnZXQgZnVsbHNjcmVlbigpIHtcbiAgICAgICAgRGVidWcuZXJyb3IoXCJHcmFwaGljc0RldmljZS5mdWxsc2NyZWVuIGlzIG5vdCBpbXBsZW1lbnRlZCBvbiBjdXJyZW50IGRldmljZS5cIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXhpbXVtIHBpeGVsIHJhdGlvLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWF4UGl4ZWxSYXRpbyhyYXRpbykge1xuICAgICAgICBpZiAodGhpcy5fbWF4UGl4ZWxSYXRpbyAhPT0gcmF0aW8pIHtcbiAgICAgICAgICAgIHRoaXMuX21heFBpeGVsUmF0aW8gPSByYXRpbztcbiAgICAgICAgICAgIHRoaXMucmVzaXplQ2FudmFzKHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1heFBpeGVsUmF0aW8oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXhQaXhlbFJhdGlvO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRoZSBkZXZpY2UuIENhbiBiZSBvbmUgb2YgcGMuREVWSUNFVFlQRV9XRUJHTDEsIHBjLkRFVklDRVRZUEVfV0VCR0wyIG9yIHBjLkRFVklDRVRZUEVfV0VCR1BVLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdMMSB8IGltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdMMiB8IGltcG9ydCgnLi9jb25zdGFudHMuanMnKS5ERVZJQ0VUWVBFX1dFQkdQVX1cbiAgICAgKi9cbiAgICBnZXQgZGV2aWNlVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RldmljZVR5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgcmVmZXJlbmNlZCBieSBhIHNoYWRlci4gVGhlIHNoYWRlclxuICAgICAqIGdlbmVyYXRvcnMgKHByb2dyYW1saWIpIHVzZSB0aGlzIG51bWJlciB0byBzcGVjaWZ5IHRoZSBtYXRyaXggYXJyYXkgc2l6ZSBvZiB0aGUgdW5pZm9ybVxuICAgICAqICdtYXRyaXhfcG9zZVswXScuIFRoZSB2YWx1ZSBpcyBjYWxjdWxhdGVkIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXZhaWxhYmxlIHVuaWZvcm0gdmVjdG9yc1xuICAgICAqIGF2YWlsYWJsZSBhZnRlciBzdWJ0cmFjdGluZyB0aGUgbnVtYmVyIHRha2VuIGJ5IGEgdHlwaWNhbCBoZWF2eXdlaWdodCBzaGFkZXIuIElmIGEgZGlmZmVyZW50XG4gICAgICogbnVtYmVyIGlzIHJlcXVpcmVkLCBpdCBjYW4gYmUgdHVuZWQgdmlhIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRCb25lTGltaXR9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1heGltdW0gbnVtYmVyIG9mIGJvbmVzIHRoYXQgY2FuIGJlIHN1cHBvcnRlZCBieSB0aGUgaG9zdCBoYXJkd2FyZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Qm9uZUxpbWl0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ib25lTGltaXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyB0aGF0IHRoZSBkZXZpY2UgY2FuIHN1cHBvcnQgb24gdGhlIGN1cnJlbnQgaGFyZHdhcmUuXG4gICAgICogVGhpcyBmdW5jdGlvbiBhbGxvd3MgdGhlIGRlZmF1bHQgY2FsY3VsYXRlZCB2YWx1ZSBiYXNlZCBvbiBhdmFpbGFibGUgdmVjdG9yIHVuaWZvcm1zIHRvIGJlXG4gICAgICogb3ZlcnJpZGRlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhCb25lcyAtIFRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyBzdXBwb3J0ZWQgYnkgdGhlIGhvc3QgaGFyZHdhcmUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEJvbmVMaW1pdChtYXhCb25lcykge1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IG1heEJvbmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIHdoaWNoIGV4ZWN1dGVzIGF0IHRoZSBzdGFydCBvZiB0aGUgZnJhbWUuIFRoaXMgc2hvdWxkIG5vdCBiZSBjYWxsZWQgbWFudWFsbHksIGFzXG4gICAgICogaXQgaXMgaGFuZGxlZCBieSB0aGUgQXBwQmFzZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBmcmFtZVN0YXJ0KCkge1xuICAgICAgICB0aGlzLnJlbmRlclBhc3NJbmRleCA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyVmVyc2lvbisrO1xuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuXG4gICAgICAgICAgICAvLyBsb2cgb3V0IGFsbCBsb2FkZWQgdGV4dHVyZXMsIHNvcnRlZCBieSBncHUgbWVtb3J5IHNpemVcbiAgICAgICAgICAgIGlmIChUcmFjaW5nLmdldChUUkFDRUlEX1RFWFRVUkVTKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleHR1cmVzID0gdGhpcy50ZXh0dXJlcy5zbGljZSgpO1xuICAgICAgICAgICAgICAgIHRleHR1cmVzLnNvcnQoKGEsIGIpID0+IGIuZ3B1U2l6ZSAtIGEuZ3B1U2l6ZSk7XG4gICAgICAgICAgICAgICAgRGVidWcubG9nKGBUZXh0dXJlczogJHt0ZXh0dXJlcy5sZW5ndGh9YCk7XG4gICAgICAgICAgICAgICAgbGV0IHRleHR1cmVUb3RhbCA9IDA7XG4gICAgICAgICAgICAgICAgdGV4dHVyZXMuZm9yRWFjaCgodGV4dHVyZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZVNpemUgID0gdGV4dHVyZS5ncHVTaXplO1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlVG90YWwgKz0gdGV4dHVyZVNpemU7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmxvZyhgJHtpbmRleH0uICR7dGV4dHVyZS5uYW1lfSAke3RleHR1cmUud2lkdGh9eCR7dGV4dHVyZS5oZWlnaHR9IFZSQU06ICR7KHRleHR1cmVTaXplIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMil9IE1CYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgRGVidWcubG9nKGBUb3RhbDogJHsodGV4dHVyZVRvdGFsIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMil9TUJgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVuY3Rpb24gd2hpY2ggZXhlY3V0ZXMgYXQgdGhlIGVuZCBvZiB0aGUgZnJhbWUuIFRoaXMgc2hvdWxkIG5vdCBiZSBjYWxsZWQgbWFudWFsbHksIGFzIGl0IGlzXG4gICAgICogaGFuZGxlZCBieSB0aGUgQXBwQmFzZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBmcmFtZUVuZCgpIHtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEdyYXBoaWNzRGV2aWNlIH07XG4iXSwibmFtZXMiOlsiR3JhcGhpY3NEZXZpY2UiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImNhbnZhcyIsIm9wdGlvbnMiLCJfdGhpcyRpbml0T3B0aW9ucyIsIl90aGlzJGluaXRPcHRpb25zJGRlcCIsIl90aGlzJGluaXRPcHRpb25zMiIsIl90aGlzJGluaXRPcHRpb25zMiRzdCIsIl90aGlzJGluaXRPcHRpb25zMyIsIl90aGlzJGluaXRPcHRpb25zMyRhbiIsIl90aGlzJGluaXRPcHRpb25zNCIsIl90aGlzJGluaXRPcHRpb25zNCRwbyIsImlzV2ViR1BVIiwic2NvcGUiLCJib25lTGltaXQiLCJtYXhBbmlzb3Ryb3B5IiwibWF4Q3ViZU1hcFNpemUiLCJtYXhUZXh0dXJlU2l6ZSIsIm1heFZvbHVtZVNpemUiLCJtYXhDb2xvckF0dGFjaG1lbnRzIiwicHJlY2lzaW9uIiwic2FtcGxlcyIsInN1cHBvcnRzU3RlbmNpbCIsInN1cHBvcnRzTXJ0Iiwic3VwcG9ydHNWb2x1bWVUZXh0dXJlcyIsInJlbmRlclRhcmdldCIsInJlbmRlclZlcnNpb24iLCJyZW5kZXJQYXNzSW5kZXgiLCJpbnNpZGVSZW5kZXJQYXNzIiwic3VwcG9ydHNJbnN0YW5jaW5nIiwic3VwcG9ydHNVbmlmb3JtQnVmZmVycyIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsInF1YWRWZXJ0ZXhCdWZmZXIiLCJibGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsImRlcHRoU3RhdGUiLCJEZXB0aFN0YXRlIiwic3RlbmNpbEVuYWJsZWQiLCJzdGVuY2lsRnJvbnQiLCJTdGVuY2lsUGFyYW1ldGVycyIsInN0ZW5jaWxCYWNrIiwiZHluYW1pY0J1ZmZlcnMiLCJncHVQcm9maWxlciIsIkdwdVByb2ZpbGVyIiwiZGVmYXVsdENsZWFyT3B0aW9ucyIsImNvbG9yIiwiZGVwdGgiLCJzdGVuY2lsIiwiZmxhZ3MiLCJDTEVBUkZMQUdfQ09MT1IiLCJDTEVBUkZMQUdfREVQVEgiLCJpbml0T3B0aW9ucyIsIl9leHRlbmRzIiwiYW50aWFsaWFzIiwicG93ZXJQcmVmZXJlbmNlIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9tYXhQaXhlbFJhdGlvIiwicGxhdGZvcm0iLCJicm93c2VyIiwiTWF0aCIsIm1pbiIsIndpbmRvdyIsImRldmljZVBpeGVsUmF0aW8iLCJzaGFkZXJzIiwiYnVmZmVycyIsInRleHR1cmVzIiwidGFyZ2V0cyIsIl92cmFtIiwidGV4U2hhZG93IiwidGV4QXNzZXQiLCJ0ZXhMaWdodG1hcCIsInRleCIsInZiIiwiaWIiLCJ1YiIsIl9zaGFkZXJTdGF0cyIsInZzQ29tcGlsZWQiLCJmc0NvbXBpbGVkIiwibGlua2VkIiwibWF0ZXJpYWxTaGFkZXJzIiwiY29tcGlsZVRpbWUiLCJpbml0aWFsaXplQ29udGV4dENhY2hlcyIsIl9kcmF3Q2FsbHNQZXJGcmFtZSIsIl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lIiwiX3ByaW1zUGVyRnJhbWUiLCJpIiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9UUklGQU4iLCJfcmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lIiwiU2NvcGVTcGFjZSIsInRleHR1cmVCaWFzIiwicmVzb2x2ZSIsInNldFZhbHVlIiwicG9zdEluaXQiLCJ2ZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhGb3JtYXQiLCJzZW1hbnRpYyIsIlNFTUFOVElDX1BPU0lUSU9OIiwiY29tcG9uZW50cyIsInR5cGUiLCJUWVBFX0ZMT0FUMzIiLCJwb3NpdGlvbnMiLCJGbG9hdDMyQXJyYXkiLCJWZXJ0ZXhCdWZmZXIiLCJCVUZGRVJfU1RBVElDIiwiZGVzdHJveSIsIl90aGlzJHF1YWRWZXJ0ZXhCdWZmZSIsIl90aGlzJGR5bmFtaWNCdWZmZXJzIiwiX3RoaXMkZ3B1UHJvZmlsZXIiLCJmaXJlIiwib25EZXN0cm95U2hhZGVyIiwic2hhZGVyIiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInBvc3REZXN0cm95IiwidG9KU09OIiwia2V5IiwidW5kZWZpbmVkIiwiaW5kZXhCdWZmZXIiLCJ2ZXJ0ZXhCdWZmZXJzIiwiaW5pdGlhbGl6ZVJlbmRlclN0YXRlIiwiY3VsbE1vZGUiLCJDVUxMRkFDRV9CQUNLIiwidngiLCJ2eSIsInZ3IiwidmgiLCJzeCIsInN5Iiwic3ciLCJzaCIsInNldFN0ZW5jaWxTdGF0ZSIsIkRlYnVnIiwiYXNzZXJ0Iiwic2V0QmxlbmRTdGF0ZSIsInNldERlcHRoU3RhdGUiLCJzZXRDdWxsTW9kZSIsInNldFJlbmRlclRhcmdldCIsInNldEluZGV4QnVmZmVyIiwic2V0VmVydGV4QnVmZmVyIiwidmVydGV4QnVmZmVyIiwicHVzaCIsImdldFJlbmRlclRhcmdldCIsImluaXRSZW5kZXJUYXJnZXQiLCJ0YXJnZXQiLCJpbml0aWFsaXplZCIsInN0YXJ0VGltZSIsIm5vdyIsInRpbWVzdGFtcCIsImluaXQiLCJfaXNCcm93c2VySW50ZXJmYWNlIiwidGV4dHVyZSIsIl9pc0ltYWdlQnJvd3NlckludGVyZmFjZSIsIl9pc0ltYWdlQ2FudmFzSW50ZXJmYWNlIiwiX2lzSW1hZ2VWaWRlb0ludGVyZmFjZSIsIkltYWdlQml0bWFwIiwiSFRNTEltYWdlRWxlbWVudCIsIkhUTUxDYW52YXNFbGVtZW50IiwiSFRNTFZpZGVvRWxlbWVudCIsInJlc2l6ZUNhbnZhcyIsIndpZHRoIiwiaGVpZ2h0Iiwic2V0UmVzb2x1dGlvbiIsIkVWRU5UX1JFU0laRSIsInVwZGF0ZUNsaWVudFJlY3QiLCJjbGllbnRSZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiZXJyb3IiLCJmdWxsc2NyZWVuIiwibWF4UGl4ZWxSYXRpbyIsInJhdGlvIiwiZGV2aWNlVHlwZSIsIl9kZXZpY2VUeXBlIiwiZ2V0Qm9uZUxpbWl0Iiwic2V0Qm9uZUxpbWl0IiwibWF4Qm9uZXMiLCJmcmFtZVN0YXJ0IiwiY2FsbCIsIlRyYWNpbmciLCJnZXQiLCJUUkFDRUlEX1RFWFRVUkVTIiwic2xpY2UiLCJzb3J0IiwiYSIsImIiLCJncHVTaXplIiwibG9nIiwibGVuZ3RoIiwidGV4dHVyZVRvdGFsIiwiZm9yRWFjaCIsImluZGV4IiwidGV4dHVyZVNpemUiLCJuYW1lIiwidG9GaXhlZCIsImZyYW1lRW5kIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBcUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxjQUFjLFNBQVNDLFlBQVksQ0FBQztBQWdQdENDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsT0FBTyxFQUFFO0FBQUEsSUFBQSxJQUFBQyxpQkFBQSxFQUFBQyxxQkFBQSxFQUFBQyxrQkFBQSxFQUFBQyxxQkFBQSxFQUFBQyxrQkFBQSxFQUFBQyxxQkFBQSxFQUFBQyxrQkFBQSxFQUFBQyxxQkFBQSxDQUFBO0FBQ3pCLElBQUEsS0FBSyxFQUFFLENBQUE7QUFoUFg7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFULE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVOO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUxJLElBTUFVLENBQUFBLFFBQVEsR0FBRyxLQUFLLENBQUE7QUFFaEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFDLEtBQUssR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVMO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUxJLElBQUEsSUFBQSxDQU1BQyxTQUFTLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFVDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUMsYUFBYSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRWI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFDLGNBQWMsR0FBQSxLQUFBLENB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
