import { Debug } from '../../core/debug.js';
import { TRACEID_RENDER_TARGET_ALLOC } from '../../core/constants.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';
import { GraphicsDevice } from './graphics-device.js';

let id = 0;

/**
 * A render target is a rectangular rendering surface.
 */
class RenderTarget {
  /**
   * Creates a new RenderTarget instance. A color buffer or a depth buffer must be set.
   *
   * @param {object} [options] - Object for passing optional arguments.
   * @param {boolean} [options.autoResolve] - If samples > 1, enables or disables automatic MSAA
   * resolve after rendering to this RT (see {@link RenderTarget#resolve}). Defaults to true.
   * @param {import('./texture.js').Texture} [options.colorBuffer] - The texture that this render
   * target will treat as a rendering surface.
   * @param {boolean} [options.depth] - If set to true, depth buffer will be created. Defaults to
   * true. Ignored if depthBuffer is defined.
   * @param {import('./texture.js').Texture} [options.depthBuffer] - The texture that this render
   * target will treat as a depth/stencil surface (WebGL2 only). If set, the 'depth' and
   * 'stencil' properties are ignored. Texture must have {@link PIXELFORMAT_DEPTH} or
   * {@link PIXELFORMAT_DEPTHSTENCIL} format.
   * @param {number} [options.face] - If the colorBuffer parameter is a cubemap, use this option
   * to specify the face of the cubemap to render to. Can be:
   *
   * - {@link CUBEFACE_POSX}
   * - {@link CUBEFACE_NEGX}
   * - {@link CUBEFACE_POSY}
   * - {@link CUBEFACE_NEGY}
   * - {@link CUBEFACE_POSZ}
   * - {@link CUBEFACE_NEGZ}
   *
   * Defaults to {@link CUBEFACE_POSX}.
   * @param {boolean} [options.flipY] - When set to true the image will be flipped in Y. Default
   * is false.
   * @param {string} [options.name] - The name of the render target.
   * @param {number} [options.samples] - Number of hardware anti-aliasing samples (WebGL2 only).
   * Default is 1.
   * @param {boolean} [options.stencil] - If set to true, depth buffer will include stencil.
   * Defaults to false. Ignored if depthBuffer is defined or depth is false.
   * @example
   * // Create a 512x512x24-bit render target with a depth buffer
   * const colorBuffer = new pc.Texture(graphicsDevice, {
   *     width: 512,
   *     height: 512,
   *     format: pc.PIXELFORMAT_RGB8
   * });
   * const renderTarget = new pc.RenderTarget({
   *     colorBuffer: colorBuffer,
   *     depth: true
   * });
   *
   * // Set the render target on a camera component
   * camera.renderTarget = renderTarget;
   *
   * // Destroy render target at a later stage. Note that the color buffer needs
   * // to be destroyed separately.
   * renderTarget.colorBuffer.destroy();
   * renderTarget.destroy();
   * camera.renderTarget = null;
   */
  constructor(options = {}) {
    var _options$face, _this$_colorBuffer, _this$_depthBuffer, _options$samples, _options$autoResolve, _options$flipY;
    this.id = id++;
    const _arg2 = arguments[1];
    const _arg3 = arguments[2];
    if (options instanceof GraphicsDevice) {
      // old constructor
      this._colorBuffer = _arg2;
      options = _arg3;
      Debug.deprecated('pc.RenderTarget constructor no longer accepts GraphicsDevice parameter.');
    } else {
      // new constructor
      this._colorBuffer = options.colorBuffer;
    }

    // mark color buffer texture as render target
    if (this._colorBuffer) {
      this._colorBuffer._isRenderTarget = true;
    }

    // Process optional arguments
    this._depthBuffer = options.depthBuffer;
    this._face = (_options$face = options.face) != null ? _options$face : 0;
    if (this._depthBuffer) {
      const format = this._depthBuffer._format;
      if (format === PIXELFORMAT_DEPTH) {
        this._depth = true;
        this._stencil = false;
      } else if (format === PIXELFORMAT_DEPTHSTENCIL) {
        this._depth = true;
        this._stencil = true;
      } else {
        Debug.warn('Incorrect depthBuffer format. Must be pc.PIXELFORMAT_DEPTH or pc.PIXELFORMAT_DEPTHSTENCIL');
        this._depth = false;
        this._stencil = false;
      }
    } else {
      var _options$depth, _options$stencil;
      this._depth = (_options$depth = options.depth) != null ? _options$depth : true;
      this._stencil = (_options$stencil = options.stencil) != null ? _options$stencil : false;
    }

    // device, from one of the buffers
    const device = ((_this$_colorBuffer = this._colorBuffer) == null ? void 0 : _this$_colorBuffer.device) || ((_this$_depthBuffer = this._depthBuffer) == null ? void 0 : _this$_depthBuffer.device) || options.graphicsDevice;
    Debug.assert(device, "Failed to obtain the device, colorBuffer nor depthBuffer store it.");
    this._device = device;
    const {
      maxSamples
    } = this._device;
    this._samples = Math.min((_options$samples = options.samples) != null ? _options$samples : 1, maxSamples);

    // WebGPU only supports values of 1 or 4 for samples
    if (device.isWebGPU) {
      this._samples = this._samples > 1 ? maxSamples : 1;
    }
    this.autoResolve = (_options$autoResolve = options.autoResolve) != null ? _options$autoResolve : true;

    // use specified name, otherwise get one from color or depth buffer
    this.name = options.name;
    if (!this.name) {
      var _this$_colorBuffer2;
      this.name = (_this$_colorBuffer2 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer2.name;
    }
    if (!this.name) {
      var _this$_depthBuffer2;
      this.name = (_this$_depthBuffer2 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer2.name;
    }
    if (!this.name) {
      this.name = "Untitled";
    }

    // render image flipped in Y
    this.flipY = (_options$flipY = options.flipY) != null ? _options$flipY : false;

    // device specific implementation
    this.impl = device.createRenderTargetImpl(this);
    Debug.trace(TRACEID_RENDER_TARGET_ALLOC, `Alloc: Id ${this.id} ${this.name}: ${this.width}x${this.height} samples: ${this.samples} ` + `${this.colorBuffer ? '[Color]' : ''}` + `${this.depth ? '[Depth]' : ''}` + `${this.stencil ? '[Stencil]' : ''}` + `[Face:${this.face}]`);
  }

  /**
   * Frees resources associated with this render target.
   */
  destroy() {
    Debug.trace(TRACEID_RENDER_TARGET_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
    const device = this._device;
    if (device) {
      const idx = device.targets.indexOf(this);
      if (idx !== -1) {
        device.targets.splice(idx, 1);
      }
      if (device.renderTarget === this) {
        device.setRenderTarget(null);
      }
      this.destroyFrameBuffers();
    }
  }

  /**
   * Free device resources associated with this render target.
   *
   * @ignore
   */
  destroyFrameBuffers() {
    const device = this._device;
    if (device) {
      this.impl.destroy(device);
    }
  }

  /**
   * Free textures associated with this render target.
   *
   * @ignore
   */
  destroyTextureBuffers() {
    if (this._depthBuffer) {
      this._depthBuffer.destroy();
      this._depthBuffer = null;
    }
    if (this._colorBuffer) {
      this._colorBuffer.destroy();
      this._colorBuffer = null;
    }
  }

  /**
   * Initializes the resources associated with this render target.
   *
   * @ignore
   */
  init() {
    this.impl.init(this._device, this);
  }
  get initialized() {
    return this.impl.initialized;
  }

  /**
   * Called when the device context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    this.impl.loseContext();
  }

  /**
   * If samples > 1, resolves the anti-aliased render target (WebGL2 only). When you're rendering
   * to an anti-aliased render target, pixels aren't written directly to the readable texture.
   * Instead, they're first written to a MSAA buffer, where each sample for each pixel is stored
   * independently. In order to read the results, you first need to 'resolve' the buffer - to
   * average all samples and create a simple texture with one color per pixel. This function
   * performs this averaging and updates the colorBuffer and the depthBuffer. If autoResolve is
   * set to true, the resolve will happen after every rendering to this render target, otherwise
   * you can do it manually, during the app update or inside a {@link Command}.
   *
   * @param {boolean} [color] - Resolve color buffer. Defaults to true.
   * @param {boolean} [depth] - Resolve depth buffer. Defaults to true if the render target has a
   * depth buffer.
   */
  resolve(color = true, depth = !!this._depthBuffer) {
    if (this._device && this._samples > 1) {
      DebugGraphics.pushGpuMarker(this._device, `RESOLVE-RT:${this.name}`);
      this.impl.resolve(this._device, this, color, depth);
      DebugGraphics.popGpuMarker(this._device);
    }
  }

  /**
   * Copies color and/or depth contents of source render target to this one. Formats, sizes and
   * anti-aliasing samples must match. Depth buffer can only be copied on WebGL 2.0.
   *
   * @param {RenderTarget} source - Source render target to copy from.
   * @param {boolean} [color] - If true will copy the color buffer. Defaults to false.
   * @param {boolean} [depth] - If true will copy the depth buffer. Defaults to false.
   * @returns {boolean} True if the copy was successful, false otherwise.
   */
  copy(source, color, depth) {
    if (!this._device) {
      if (source._device) {
        this._device = source._device;
      } else {
        Debug.error("Render targets are not initialized");
        return false;
      }
    }
    DebugGraphics.pushGpuMarker(this._device, `COPY-RT:${source.name}->${this.name}`);
    const success = this._device.copyRenderTarget(source, this, color, depth);
    DebugGraphics.popGpuMarker(this._device);
    return success;
  }

  /**
   * Number of antialiasing samples the render target uses.
   *
   * @type {number}
   */
  get samples() {
    return this._samples;
  }

  /**
   * True if the render target contains the depth attachment.
   *
   * @type {boolean}
   */
  get depth() {
    return this._depth;
  }

  /**
   * True if the render target contains the stencil attachment.
   *
   * @type {boolean}
   */
  get stencil() {
    return this._stencil;
  }

  /**
   * Color buffer set up on the render target.
   *
   * @type {import('./texture.js').Texture}
   */
  get colorBuffer() {
    return this._colorBuffer;
  }

  /**
   * Depth buffer set up on the render target. Only available, if depthBuffer was set in
   * constructor. Not available if depth property was used instead.
   *
   * @type {import('./texture.js').Texture}
   */
  get depthBuffer() {
    return this._depthBuffer;
  }

  /**
   * If the render target is bound to a cubemap, this property specifies which face of the
   * cubemap is rendered to. Can be:
   *
   * - {@link CUBEFACE_POSX}
   * - {@link CUBEFACE_NEGX}
   * - {@link CUBEFACE_POSY}
   * - {@link CUBEFACE_NEGY}
   * - {@link CUBEFACE_POSZ}
   * - {@link CUBEFACE_NEGZ}
   *
   * @type {number}
   */
  get face() {
    return this._face;
  }

  /**
   * Width of the render target in pixels.
   *
   * @type {number}
   */
  get width() {
    var _this$_colorBuffer3, _this$_depthBuffer3;
    return ((_this$_colorBuffer3 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer3.width) || ((_this$_depthBuffer3 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer3.width) || this._device.width;
  }

  /**
   * Height of the render target in pixels.
   *
   * @type {number}
   */
  get height() {
    var _this$_colorBuffer4, _this$_depthBuffer4;
    return ((_this$_colorBuffer4 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer4.height) || ((_this$_depthBuffer4 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer4.height) || this._device.height;
  }
}

export { RenderTarget };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXRhcmdldC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfUkVOREVSX1RBUkdFVF9BTExPQyB9IGZyb20gJy4uLy4uL2NvcmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFBJWEVMRk9STUFUX0RFUFRILCBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJztcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHJlbmRlciB0YXJnZXQgaXMgYSByZWN0YW5ndWxhciByZW5kZXJpbmcgc3VyZmFjZS5cbiAqL1xuY2xhc3MgUmVuZGVyVGFyZ2V0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFJlbmRlclRhcmdldCBpbnN0YW5jZS4gQSBjb2xvciBidWZmZXIgb3IgYSBkZXB0aCBidWZmZXIgbXVzdCBiZSBzZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IGZvciBwYXNzaW5nIG9wdGlvbmFsIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmF1dG9SZXNvbHZlXSAtIElmIHNhbXBsZXMgPiAxLCBlbmFibGVzIG9yIGRpc2FibGVzIGF1dG9tYXRpYyBNU0FBXG4gICAgICogcmVzb2x2ZSBhZnRlciByZW5kZXJpbmcgdG8gdGhpcyBSVCAoc2VlIHtAbGluayBSZW5kZXJUYXJnZXQjcmVzb2x2ZX0pLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3RleHR1cmUuanMnKS5UZXh0dXJlfSBbb3B0aW9ucy5jb2xvckJ1ZmZlcl0gLSBUaGUgdGV4dHVyZSB0aGF0IHRoaXMgcmVuZGVyXG4gICAgICogdGFyZ2V0IHdpbGwgdHJlYXQgYXMgYSByZW5kZXJpbmcgc3VyZmFjZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRlcHRoXSAtIElmIHNldCB0byB0cnVlLCBkZXB0aCBidWZmZXIgd2lsbCBiZSBjcmVhdGVkLiBEZWZhdWx0cyB0b1xuICAgICAqIHRydWUuIElnbm9yZWQgaWYgZGVwdGhCdWZmZXIgaXMgZGVmaW5lZC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi90ZXh0dXJlLmpzJykuVGV4dHVyZX0gW29wdGlvbnMuZGVwdGhCdWZmZXJdIC0gVGhlIHRleHR1cmUgdGhhdCB0aGlzIHJlbmRlclxuICAgICAqIHRhcmdldCB3aWxsIHRyZWF0IGFzIGEgZGVwdGgvc3RlbmNpbCBzdXJmYWNlIChXZWJHTDIgb25seSkuIElmIHNldCwgdGhlICdkZXB0aCcgYW5kXG4gICAgICogJ3N0ZW5jaWwnIHByb3BlcnRpZXMgYXJlIGlnbm9yZWQuIFRleHR1cmUgbXVzdCBoYXZlIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSH0gb3JcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMfSBmb3JtYXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZhY2VdIC0gSWYgdGhlIGNvbG9yQnVmZmVyIHBhcmFtZXRlciBpcyBhIGN1YmVtYXAsIHVzZSB0aGlzIG9wdGlvblxuICAgICAqIHRvIHNwZWNpZnkgdGhlIGZhY2Ugb2YgdGhlIGN1YmVtYXAgdG8gcmVuZGVyIHRvLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBDVUJFRkFDRV9QT1NYfVxuICAgICAqIC0ge0BsaW5rIENVQkVGQUNFX05FR1h9XG4gICAgICogLSB7QGxpbmsgQ1VCRUZBQ0VfUE9TWX1cbiAgICAgKiAtIHtAbGluayBDVUJFRkFDRV9ORUdZfVxuICAgICAqIC0ge0BsaW5rIENVQkVGQUNFX1BPU1p9XG4gICAgICogLSB7QGxpbmsgQ1VCRUZBQ0VfTkVHWn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBDVUJFRkFDRV9QT1NYfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZsaXBZXSAtIFdoZW4gc2V0IHRvIHRydWUgdGhlIGltYWdlIHdpbGwgYmUgZmxpcHBlZCBpbiBZLiBEZWZhdWx0XG4gICAgICogaXMgZmFsc2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLm5hbWVdIC0gVGhlIG5hbWUgb2YgdGhlIHJlbmRlciB0YXJnZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnNhbXBsZXNdIC0gTnVtYmVyIG9mIGhhcmR3YXJlIGFudGktYWxpYXNpbmcgc2FtcGxlcyAoV2ViR0wyIG9ubHkpLlxuICAgICAqIERlZmF1bHQgaXMgMS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN0ZW5jaWxdIC0gSWYgc2V0IHRvIHRydWUsIGRlcHRoIGJ1ZmZlciB3aWxsIGluY2x1ZGUgc3RlbmNpbC5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS4gSWdub3JlZCBpZiBkZXB0aEJ1ZmZlciBpcyBkZWZpbmVkIG9yIGRlcHRoIGlzIGZhbHNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNTEyeDUxMngyNC1iaXQgcmVuZGVyIHRhcmdldCB3aXRoIGEgZGVwdGggYnVmZmVyXG4gICAgICogY29uc3QgY29sb3JCdWZmZXIgPSBuZXcgcGMuVGV4dHVyZShncmFwaGljc0RldmljZSwge1xuICAgICAqICAgICB3aWR0aDogNTEyLFxuICAgICAqICAgICBoZWlnaHQ6IDUxMixcbiAgICAgKiAgICAgZm9ybWF0OiBwYy5QSVhFTEZPUk1BVF9SR0I4XG4gICAgICogfSk7XG4gICAgICogY29uc3QgcmVuZGVyVGFyZ2V0ID0gbmV3IHBjLlJlbmRlclRhcmdldCh7XG4gICAgICogICAgIGNvbG9yQnVmZmVyOiBjb2xvckJ1ZmZlcixcbiAgICAgKiAgICAgZGVwdGg6IHRydWVcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIFNldCB0aGUgcmVuZGVyIHRhcmdldCBvbiBhIGNhbWVyYSBjb21wb25lbnRcbiAgICAgKiBjYW1lcmEucmVuZGVyVGFyZ2V0ID0gcmVuZGVyVGFyZ2V0O1xuICAgICAqXG4gICAgICogLy8gRGVzdHJveSByZW5kZXIgdGFyZ2V0IGF0IGEgbGF0ZXIgc3RhZ2UuIE5vdGUgdGhhdCB0aGUgY29sb3IgYnVmZmVyIG5lZWRzXG4gICAgICogLy8gdG8gYmUgZGVzdHJveWVkIHNlcGFyYXRlbHkuXG4gICAgICogcmVuZGVyVGFyZ2V0LmNvbG9yQnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgKiByZW5kZXJUYXJnZXQuZGVzdHJveSgpO1xuICAgICAqIGNhbWVyYS5yZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgICAgICB0aGlzLmlkID0gaWQrKztcblxuICAgICAgICBjb25zdCBfYXJnMiA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgY29uc3QgX2FyZzMgPSBhcmd1bWVudHNbMl07XG5cbiAgICAgICAgaWYgKG9wdGlvbnMgaW5zdGFuY2VvZiBHcmFwaGljc0RldmljZSkge1xuICAgICAgICAgICAgLy8gb2xkIGNvbnN0cnVjdG9yXG4gICAgICAgICAgICB0aGlzLl9jb2xvckJ1ZmZlciA9IF9hcmcyO1xuICAgICAgICAgICAgb3B0aW9ucyA9IF9hcmczO1xuXG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJUYXJnZXQgY29uc3RydWN0b3Igbm8gbG9uZ2VyIGFjY2VwdHMgR3JhcGhpY3NEZXZpY2UgcGFyYW1ldGVyLicpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBuZXcgY29uc3RydWN0b3JcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yQnVmZmVyID0gb3B0aW9ucy5jb2xvckJ1ZmZlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1hcmsgY29sb3IgYnVmZmVyIHRleHR1cmUgYXMgcmVuZGVyIHRhcmdldFxuICAgICAgICBpZiAodGhpcy5fY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yQnVmZmVyLl9pc1JlbmRlclRhcmdldCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBQcm9jZXNzIG9wdGlvbmFsIGFyZ3VtZW50c1xuICAgICAgICB0aGlzLl9kZXB0aEJ1ZmZlciA9IG9wdGlvbnMuZGVwdGhCdWZmZXI7XG4gICAgICAgIHRoaXMuX2ZhY2UgPSBvcHRpb25zLmZhY2UgPz8gMDtcblxuICAgICAgICBpZiAodGhpcy5fZGVwdGhCdWZmZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IHRoaXMuX2RlcHRoQnVmZmVyLl9mb3JtYXQ7XG4gICAgICAgICAgICBpZiAoZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9ERVBUSCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGVuY2lsID0gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGVwdGggPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0ZW5jaWwgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdJbmNvcnJlY3QgZGVwdGhCdWZmZXIgZm9ybWF0LiBNdXN0IGJlIHBjLlBJWEVMRk9STUFUX0RFUFRIIG9yIHBjLlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCcpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3RlbmNpbCA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fZGVwdGggPSBvcHRpb25zLmRlcHRoID8/IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9zdGVuY2lsID0gb3B0aW9ucy5zdGVuY2lsID8/IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGV2aWNlLCBmcm9tIG9uZSBvZiB0aGUgYnVmZmVyc1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9jb2xvckJ1ZmZlcj8uZGV2aWNlIHx8IHRoaXMuX2RlcHRoQnVmZmVyPy5kZXZpY2UgfHwgb3B0aW9ucy5ncmFwaGljc0RldmljZTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGRldmljZSwgXCJGYWlsZWQgdG8gb2J0YWluIHRoZSBkZXZpY2UsIGNvbG9yQnVmZmVyIG5vciBkZXB0aEJ1ZmZlciBzdG9yZSBpdC5cIik7XG4gICAgICAgIHRoaXMuX2RldmljZSA9IGRldmljZTtcblxuICAgICAgICBjb25zdCB7IG1heFNhbXBsZXMgfSA9IHRoaXMuX2RldmljZTtcbiAgICAgICAgdGhpcy5fc2FtcGxlcyA9IE1hdGgubWluKG9wdGlvbnMuc2FtcGxlcyA/PyAxLCBtYXhTYW1wbGVzKTtcblxuICAgICAgICAvLyBXZWJHUFUgb25seSBzdXBwb3J0cyB2YWx1ZXMgb2YgMSBvciA0IGZvciBzYW1wbGVzXG4gICAgICAgIGlmIChkZXZpY2UuaXNXZWJHUFUpIHtcbiAgICAgICAgICAgIHRoaXMuX3NhbXBsZXMgPSB0aGlzLl9zYW1wbGVzID4gMSA/IG1heFNhbXBsZXMgOiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hdXRvUmVzb2x2ZSA9IG9wdGlvbnMuYXV0b1Jlc29sdmUgPz8gdHJ1ZTtcblxuICAgICAgICAvLyB1c2Ugc3BlY2lmaWVkIG5hbWUsIG90aGVyd2lzZSBnZXQgb25lIGZyb20gY29sb3Igb3IgZGVwdGggYnVmZmVyXG4gICAgICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICAgICAgaWYgKCF0aGlzLm5hbWUpIHtcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IHRoaXMuX2NvbG9yQnVmZmVyPy5uYW1lO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5uYW1lKSB7XG4gICAgICAgICAgICB0aGlzLm5hbWUgPSB0aGlzLl9kZXB0aEJ1ZmZlcj8ubmFtZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMubmFtZSkge1xuICAgICAgICAgICAgdGhpcy5uYW1lID0gXCJVbnRpdGxlZFwiO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVuZGVyIGltYWdlIGZsaXBwZWQgaW4gWVxuICAgICAgICB0aGlzLmZsaXBZID0gb3B0aW9ucy5mbGlwWSA/PyBmYWxzZTtcblxuICAgICAgICAvLyBkZXZpY2Ugc3BlY2lmaWMgaW1wbGVtZW50YXRpb25cbiAgICAgICAgdGhpcy5pbXBsID0gZGV2aWNlLmNyZWF0ZVJlbmRlclRhcmdldEltcGwodGhpcyk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfVEFSR0VUX0FMTE9DLCBgQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9OiAke3RoaXMud2lkdGh9eCR7dGhpcy5oZWlnaHR9IHNhbXBsZXM6ICR7dGhpcy5zYW1wbGVzfSBgICtcbiAgICAgICAgICAgIGAke3RoaXMuY29sb3JCdWZmZXIgPyAnW0NvbG9yXScgOiAnJ31gICtcbiAgICAgICAgICAgIGAke3RoaXMuZGVwdGggPyAnW0RlcHRoXScgOiAnJ31gICtcbiAgICAgICAgICAgIGAke3RoaXMuc3RlbmNpbCA/ICdbU3RlbmNpbF0nIDogJyd9YCArXG4gICAgICAgICAgICBgW0ZhY2U6JHt0aGlzLmZhY2V9XWApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWVzIHJlc291cmNlcyBhc3NvY2lhdGVkIHdpdGggdGhpcyByZW5kZXIgdGFyZ2V0LlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfVEFSR0VUX0FMTE9DLCBgRGVBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX1gKTtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9kZXZpY2U7XG4gICAgICAgIGlmIChkZXZpY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IGRldmljZS50YXJnZXRzLmluZGV4T2YodGhpcyk7XG4gICAgICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGRldmljZS50YXJnZXRzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGV2aWNlLnJlbmRlclRhcmdldCA9PT0gdGhpcykge1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXRSZW5kZXJUYXJnZXQobnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZGVzdHJveUZyYW1lQnVmZmVycygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZSBkZXZpY2UgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVzdHJveUZyYW1lQnVmZmVycygpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9kZXZpY2U7XG4gICAgICAgIGlmIChkZXZpY2UpIHtcbiAgICAgICAgICAgIHRoaXMuaW1wbC5kZXN0cm95KGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlIHRleHR1cmVzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVzdHJveVRleHR1cmVCdWZmZXJzKCkge1xuXG4gICAgICAgIGlmICh0aGlzLl9kZXB0aEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5fZGVwdGhCdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fZGVwdGhCdWZmZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2NvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvckJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9jb2xvckJ1ZmZlciA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyB0aGUgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5pdCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLmluaXQodGhpcy5fZGV2aWNlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBnZXQgaW5pdGlhbGl6ZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmltcGwuaW5pdGlhbGl6ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIGRldmljZSBjb250ZXh0IHdhcyBsb3N0LiBJdCByZWxlYXNlcyBhbGwgY29udGV4dCByZWxhdGVkIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLmxvc2VDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgc2FtcGxlcyA+IDEsIHJlc29sdmVzIHRoZSBhbnRpLWFsaWFzZWQgcmVuZGVyIHRhcmdldCAoV2ViR0wyIG9ubHkpLiBXaGVuIHlvdSdyZSByZW5kZXJpbmdcbiAgICAgKiB0byBhbiBhbnRpLWFsaWFzZWQgcmVuZGVyIHRhcmdldCwgcGl4ZWxzIGFyZW4ndCB3cml0dGVuIGRpcmVjdGx5IHRvIHRoZSByZWFkYWJsZSB0ZXh0dXJlLlxuICAgICAqIEluc3RlYWQsIHRoZXkncmUgZmlyc3Qgd3JpdHRlbiB0byBhIE1TQUEgYnVmZmVyLCB3aGVyZSBlYWNoIHNhbXBsZSBmb3IgZWFjaCBwaXhlbCBpcyBzdG9yZWRcbiAgICAgKiBpbmRlcGVuZGVudGx5LiBJbiBvcmRlciB0byByZWFkIHRoZSByZXN1bHRzLCB5b3UgZmlyc3QgbmVlZCB0byAncmVzb2x2ZScgdGhlIGJ1ZmZlciAtIHRvXG4gICAgICogYXZlcmFnZSBhbGwgc2FtcGxlcyBhbmQgY3JlYXRlIGEgc2ltcGxlIHRleHR1cmUgd2l0aCBvbmUgY29sb3IgcGVyIHBpeGVsLiBUaGlzIGZ1bmN0aW9uXG4gICAgICogcGVyZm9ybXMgdGhpcyBhdmVyYWdpbmcgYW5kIHVwZGF0ZXMgdGhlIGNvbG9yQnVmZmVyIGFuZCB0aGUgZGVwdGhCdWZmZXIuIElmIGF1dG9SZXNvbHZlIGlzXG4gICAgICogc2V0IHRvIHRydWUsIHRoZSByZXNvbHZlIHdpbGwgaGFwcGVuIGFmdGVyIGV2ZXJ5IHJlbmRlcmluZyB0byB0aGlzIHJlbmRlciB0YXJnZXQsIG90aGVyd2lzZVxuICAgICAqIHlvdSBjYW4gZG8gaXQgbWFudWFsbHksIGR1cmluZyB0aGUgYXBwIHVwZGF0ZSBvciBpbnNpZGUgYSB7QGxpbmsgQ29tbWFuZH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjb2xvcl0gLSBSZXNvbHZlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aF0gLSBSZXNvbHZlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZSBpZiB0aGUgcmVuZGVyIHRhcmdldCBoYXMgYVxuICAgICAqIGRlcHRoIGJ1ZmZlci5cbiAgICAgKi9cbiAgICByZXNvbHZlKGNvbG9yID0gdHJ1ZSwgZGVwdGggPSAhIXRoaXMuX2RlcHRoQnVmZmVyKSB7XG4gICAgICAgIGlmICh0aGlzLl9kZXZpY2UgJiYgdGhpcy5fc2FtcGxlcyA+IDEpIHtcbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLl9kZXZpY2UsIGBSRVNPTFZFLVJUOiR7dGhpcy5uYW1lfWApO1xuICAgICAgICAgICAgdGhpcy5pbXBsLnJlc29sdmUodGhpcy5fZGV2aWNlLCB0aGlzLCBjb2xvciwgZGVwdGgpO1xuICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5fZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyBjb2xvciBhbmQvb3IgZGVwdGggY29udGVudHMgb2Ygc291cmNlIHJlbmRlciB0YXJnZXQgdG8gdGhpcyBvbmUuIEZvcm1hdHMsIHNpemVzIGFuZFxuICAgICAqIGFudGktYWxpYXNpbmcgc2FtcGxlcyBtdXN0IG1hdGNoLiBEZXB0aCBidWZmZXIgY2FuIG9ubHkgYmUgY29waWVkIG9uIFdlYkdMIDIuMC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSBzb3VyY2UgLSBTb3VyY2UgcmVuZGVyIHRhcmdldCB0byBjb3B5IGZyb20uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvcHkgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBjb3B5KHNvdXJjZSwgY29sb3IsIGRlcHRoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZGV2aWNlKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlLl9kZXZpY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXZpY2UgPSBzb3VyY2UuX2RldmljZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJSZW5kZXIgdGFyZ2V0cyBhcmUgbm90IGluaXRpYWxpemVkXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLl9kZXZpY2UsIGBDT1BZLVJUOiR7c291cmNlLm5hbWV9LT4ke3RoaXMubmFtZX1gKTtcbiAgICAgICAgY29uc3Qgc3VjY2VzcyA9IHRoaXMuX2RldmljZS5jb3B5UmVuZGVyVGFyZ2V0KHNvdXJjZSwgdGhpcywgY29sb3IsIGRlcHRoKTtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcy5fZGV2aWNlKTtcblxuICAgICAgICByZXR1cm4gc3VjY2VzcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBOdW1iZXIgb2YgYW50aWFsaWFzaW5nIHNhbXBsZXMgdGhlIHJlbmRlciB0YXJnZXQgdXNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHNhbXBsZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zYW1wbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIHJlbmRlciB0YXJnZXQgY29udGFpbnMgdGhlIGRlcHRoIGF0dGFjaG1lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgZGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSByZW5kZXIgdGFyZ2V0IGNvbnRhaW5zIHRoZSBzdGVuY2lsIGF0dGFjaG1lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3RlbmNpbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0ZW5jaWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29sb3IgYnVmZmVyIHNldCB1cCBvbiB0aGUgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vdGV4dHVyZS5qcycpLlRleHR1cmV9XG4gICAgICovXG4gICAgZ2V0IGNvbG9yQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3JCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVwdGggYnVmZmVyIHNldCB1cCBvbiB0aGUgcmVuZGVyIHRhcmdldC4gT25seSBhdmFpbGFibGUsIGlmIGRlcHRoQnVmZmVyIHdhcyBzZXQgaW5cbiAgICAgKiBjb25zdHJ1Y3Rvci4gTm90IGF2YWlsYWJsZSBpZiBkZXB0aCBwcm9wZXJ0eSB3YXMgdXNlZCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgKi9cbiAgICBnZXQgZGVwdGhCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgcmVuZGVyIHRhcmdldCBpcyBib3VuZCB0byBhIGN1YmVtYXAsIHRoaXMgcHJvcGVydHkgc3BlY2lmaWVzIHdoaWNoIGZhY2Ugb2YgdGhlXG4gICAgICogY3ViZW1hcCBpcyByZW5kZXJlZCB0by4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ1VCRUZBQ0VfUE9TWH1cbiAgICAgKiAtIHtAbGluayBDVUJFRkFDRV9ORUdYfVxuICAgICAqIC0ge0BsaW5rIENVQkVGQUNFX1BPU1l9XG4gICAgICogLSB7QGxpbmsgQ1VCRUZBQ0VfTkVHWX1cbiAgICAgKiAtIHtAbGluayBDVUJFRkFDRV9QT1NafVxuICAgICAqIC0ge0BsaW5rIENVQkVGQUNFX05FR1p9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBmYWNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmFjZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaWR0aCBvZiB0aGUgcmVuZGVyIHRhcmdldCBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yQnVmZmVyPy53aWR0aCB8fCB0aGlzLl9kZXB0aEJ1ZmZlcj8ud2lkdGggfHwgdGhpcy5fZGV2aWNlLndpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlaWdodCBvZiB0aGUgcmVuZGVyIHRhcmdldCBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvckJ1ZmZlcj8uaGVpZ2h0IHx8IHRoaXMuX2RlcHRoQnVmZmVyPy5oZWlnaHQgfHwgdGhpcy5fZGV2aWNlLmhlaWdodDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJlbmRlclRhcmdldCB9O1xuIl0sIm5hbWVzIjpbImlkIiwiUmVuZGVyVGFyZ2V0IiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiX29wdGlvbnMkZmFjZSIsIl90aGlzJF9jb2xvckJ1ZmZlciIsIl90aGlzJF9kZXB0aEJ1ZmZlciIsIl9vcHRpb25zJHNhbXBsZXMiLCJfb3B0aW9ucyRhdXRvUmVzb2x2ZSIsIl9vcHRpb25zJGZsaXBZIiwiX2FyZzIiLCJhcmd1bWVudHMiLCJfYXJnMyIsIkdyYXBoaWNzRGV2aWNlIiwiX2NvbG9yQnVmZmVyIiwiRGVidWciLCJkZXByZWNhdGVkIiwiY29sb3JCdWZmZXIiLCJfaXNSZW5kZXJUYXJnZXQiLCJfZGVwdGhCdWZmZXIiLCJkZXB0aEJ1ZmZlciIsIl9mYWNlIiwiZmFjZSIsImZvcm1hdCIsIl9mb3JtYXQiLCJQSVhFTEZPUk1BVF9ERVBUSCIsIl9kZXB0aCIsIl9zdGVuY2lsIiwiUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMIiwid2FybiIsIl9vcHRpb25zJGRlcHRoIiwiX29wdGlvbnMkc3RlbmNpbCIsImRlcHRoIiwic3RlbmNpbCIsImRldmljZSIsImdyYXBoaWNzRGV2aWNlIiwiYXNzZXJ0IiwiX2RldmljZSIsIm1heFNhbXBsZXMiLCJfc2FtcGxlcyIsIk1hdGgiLCJtaW4iLCJzYW1wbGVzIiwiaXNXZWJHUFUiLCJhdXRvUmVzb2x2ZSIsIm5hbWUiLCJfdGhpcyRfY29sb3JCdWZmZXIyIiwiX3RoaXMkX2RlcHRoQnVmZmVyMiIsImZsaXBZIiwiaW1wbCIsImNyZWF0ZVJlbmRlclRhcmdldEltcGwiLCJ0cmFjZSIsIlRSQUNFSURfUkVOREVSX1RBUkdFVF9BTExPQyIsIndpZHRoIiwiaGVpZ2h0IiwiZGVzdHJveSIsImlkeCIsInRhcmdldHMiLCJpbmRleE9mIiwic3BsaWNlIiwicmVuZGVyVGFyZ2V0Iiwic2V0UmVuZGVyVGFyZ2V0IiwiZGVzdHJveUZyYW1lQnVmZmVycyIsImRlc3Ryb3lUZXh0dXJlQnVmZmVycyIsImluaXQiLCJpbml0aWFsaXplZCIsImxvc2VDb250ZXh0IiwicmVzb2x2ZSIsImNvbG9yIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJwb3BHcHVNYXJrZXIiLCJjb3B5Iiwic291cmNlIiwiZXJyb3IiLCJzdWNjZXNzIiwiY29weVJlbmRlclRhcmdldCIsIl90aGlzJF9jb2xvckJ1ZmZlcjMiLCJfdGhpcyRfZGVwdGhCdWZmZXIzIiwiX3RoaXMkX2NvbG9yQnVmZmVyNCIsIl90aGlzJF9kZXB0aEJ1ZmZlcjQiXSwibWFwcGluZ3MiOiI7Ozs7OztBQU1BLElBQUlBLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBRVY7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsWUFBWSxDQUFDO0FBQ2Y7QUFDSjtBQUNBO0FBQ0E7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
