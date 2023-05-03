import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Mat4 } from '../../core/math/mat4.js';
import { PIXELFORMAT_LA8, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGUSAGE_GPU } from './constants.js';

/**
 * Depth Sensing provides depth information which is reconstructed using the underlying AR system.
 * It provides the ability to query depth values (CPU path) or access a depth texture (GPU path).
 * Depth information can be used (not limited to) for reconstructing real world geometry, virtual
 * object placement, occlusion of virtual objects by real world geometry and more.
 *
 * ```javascript
 * // CPU path
 * const depthSensing = app.xr.depthSensing;
 * if (depthSensing.available) {
 *     // get depth in the middle of the screen, value is in meters
 *     const depth = depthSensing.getDepth(depthSensing.width / 2, depthSensing.height / 2);
 * }
 * ```
 *
 * ```javascript
 * // GPU path, attaching texture to material
 * material.diffuseMap = depthSensing.texture;
 * material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
 * material.setParameter('depth_raw_to_meters', depthSensing.rawValueToMeters);
 * material.update();
 *
 * // update UV transformation matrix on depth texture resize
 * depthSensing.on('resize', function () {
 *     material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
 *     material.setParameter('depth_raw_to_meters', depthSensing.rawValueToMeters);
 * });
 * ```
 *
 * ```javascript
 * // GLSL shader to unpack depth texture
 * varying vec2 vUv0;
 *
 * uniform sampler2D texture_depthSensingMap;
 * uniform mat4 matrix_depth_uv;
 * uniform float depth_raw_to_meters;
 *
 * void main(void) {
 *     // transform UVs using depth matrix
 *     vec2 texCoord = (matrix_depth_uv * vec4(vUv0.xy, 0.0, 1.0)).xy;
 *
 *     // get luminance alpha components from depth texture
 *     vec2 packedDepth = texture2D(texture_depthSensingMap, texCoord).ra;
 *
 *     // unpack into single value in millimeters
 *     float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)) * depth_raw_to_meters; // m
 *
 *     // normalize: 0m to 8m distance
 *     depth = min(depth / 8.0, 1.0); // 0..1 = 0..8
 *
 *     // paint scene from black to white based on distance
 *     gl_FragColor = vec4(depth, depth, depth, 1.0);
 * }
 * ```
 *
 * @augments EventHandler
 */
class XrDepthSensing extends EventHandler {
  /**
   * @type {import('./xr-manager.js').XrManager}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {XRCPUDepthInformation|null}
   * @private
   */

  /**
   * @type {XRCPUDepthInformation|null}
   * @private
   */

  /**
   * @type {string|null}
   * @private
   */

  /**
   * @type {string|null}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {Mat4}
   * @private
   */

  /**
   * @type {Uint8Array}
   * @private
   */

  /**
   * @type {Uint8Array|null}
   * @private
   */

  /**
   * @type {Texture}
   * @private
   */

  /**
   * Create a new XrDepthSensing instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @hideconstructor
   */
  constructor(manager) {
    super();
    this._manager = void 0;
    this._available = false;
    this._depthInfoCpu = null;
    this._depthInfoGpu = null;
    this._usage = null;
    this._dataFormat = null;
    this._matrixDirty = false;
    this._matrix = new Mat4();
    this._emptyBuffer = new Uint8Array(32);
    this._depthBuffer = null;
    this._texture = void 0;
    this._manager = manager;

    // TODO: data format can be different
    this._texture = new Texture(this._manager.app.graphicsDevice, {
      format: PIXELFORMAT_LA8,
      mipmaps: false,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      minFilter: FILTER_LINEAR,
      magFilter: FILTER_LINEAR,
      name: 'XRDepthSensing'
    });
    if (this.supported) {
      this._manager.on('start', this._onSessionStart, this);
      this._manager.on('end', this._onSessionEnd, this);
    }
  }

  /**
   * Fired when depth sensing data becomes available.
   *
   * @event XrDepthSensing#available
   */

  /**
   * Fired when depth sensing data becomes unavailable.
   *
   * @event XrDepthSensing#unavailable
   */

  /**
   * Fired when the depth sensing texture been resized. The {@link XrDepthSensing#uvMatrix} needs
   * to be updated for relevant shaders.
   *
   * @event XrDepthSensing#resize
   * @param {number} width - The new width of the depth texture in pixels.
   * @param {number} height - The new height of the depth texture in pixels.
   * @example
   * depthSensing.on('resize', function () {
   *     material.setParameter('matrix_depth_uv', depthSensing.uvMatrix);
   * });
   */

  /** @ignore */
  destroy() {
    this._texture.destroy();
    this._texture = null;
  }

  /** @private */
  _onSessionStart() {
    const session = this._manager.session;
    try {
      this._usage = session.depthUsage;
      this._dataFormat = session.depthDataFormat;
    } catch (ex) {
      this._usage = null;
      this._dataFormat = null;
      this._available = false;
      this.fire('error', ex);
    }
  }

  /** @private */
  _onSessionEnd() {
    this._depthInfoCpu = null;
    this._depthInfoGpu = null;
    this._usage = null;
    this._dataFormat = null;
    if (this._available) {
      this._available = false;
      this.fire('unavailable');
    }
    this._depthBuffer = null;
    this._texture._width = 4;
    this._texture._height = 4;
    this._texture._levels[0] = this._emptyBuffer;
    this._texture.upload();
  }

  /** @private */
  _updateTexture() {
    const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
    if (depthInfo) {
      let resized = false;

      // changed resolution
      if (depthInfo.width !== this._texture.width || depthInfo.height !== this._texture.height) {
        this._texture._width = depthInfo.width;
        this._texture._height = depthInfo.height;
        this._matrixDirty = true;
        resized = true;
      }
      if (this._depthInfoCpu) {
        const dataBuffer = this._depthInfoCpu.data;
        this._depthBuffer = new Uint8Array(dataBuffer);
        this._texture._levels[0] = this._depthBuffer;
        this._texture.upload();
      } else if (this._depthInfoGpu) {
        this._texture._levels[0] = this._depthInfoGpu.texture;
        this._texture.upload();
      }
      if (resized) this.fire('resize', depthInfo.width, depthInfo.height);
    } else if (this._depthBuffer) {
      // depth info not available anymore
      this._depthBuffer = null;
      this._texture._width = 4;
      this._texture._height = 4;
      this._texture._levels[0] = this._emptyBuffer;
      this._texture.upload();
    }
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @param {*} view - First XRView of viewer XRPose.
   * @ignore
   */
  update(frame, view) {
    if (!this._usage) return;
    let depthInfoCpu = null;
    let depthInfoGpu = null;
    if (this._usage === XRDEPTHSENSINGUSAGE_CPU && view) {
      depthInfoCpu = frame.getDepthInformation(view);
    } else if (this._usage === XRDEPTHSENSINGUSAGE_GPU && view) {
      depthInfoGpu = frame.getDepthInformation(view);
    }
    if (this._depthInfoCpu && !depthInfoCpu || !this._depthInfoCpu && depthInfoCpu || this.depthInfoGpu && !depthInfoGpu || !this._depthInfoGpu && depthInfoGpu) {
      this._matrixDirty = true;
    }
    this._depthInfoCpu = depthInfoCpu;
    this._depthInfoGpu = depthInfoGpu;
    this._updateTexture();
    if (this._matrixDirty) {
      this._matrixDirty = false;
      const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
      if (depthInfo) {
        this._matrix.data.set(depthInfo.normDepthBufferFromNormView.matrix);
      } else {
        this._matrix.setIdentity();
      }
    }
    if ((this._depthInfoCpu || this._depthInfoGpu) && !this._available) {
      this._available = true;
      this.fire('available');
    } else if (!this._depthInfoCpu && !this._depthInfoGpu && this._available) {
      this._available = false;
      this.fire('unavailable');
    }
  }

  /**
   * Get depth value from depth information in meters. UV is in range of 0..1, with origin in
   * top-left corner of a texture.
   *
   * @param {number} u - U coordinate of pixel in depth texture, which is in range from 0.0 to
   * 1.0 (left to right).
   * @param {number} v - V coordinate of pixel in depth texture, which is in range from 0.0 to
   * 1.0 (top to bottom).
   * @returns {number|null} Depth in meters or null if depth information is currently not
   * available.
   * @example
   * const depth = app.xr.depthSensing.getDepth(u, v);
   * if (depth !== null) {
   *     // depth in meters
   * }
   */
  getDepth(u, v) {
    // TODO
    // GPU usage

    if (!this._depthInfoCpu) return null;
    return this._depthInfoCpu.getDepthInMeters(u, v);
  }

  /**
   * True if Depth Sensing is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return platform.browser && !!window.XRDepthInformation;
  }

  /**
   * True if depth sensing information is available.
   *
   * @type {boolean}
   * @example
   * if (app.xr.depthSensing.available) {
   *     const depth = app.xr.depthSensing.getDepth(x, y);
   * }
   */
  get available() {
    return this._available;
  }

  /**
   * Whether the usage is CPU or GPU.
   *
   * @type {string}
   * @ignore
   */
  get usage() {
    return this._usage;
  }

  /**
   * The depth sensing data format.
   *
   * @type {string}
   * @ignore
   */
  get dataFormat() {
    return this._dataFormat;
  }

  /**
   * Width of depth texture or 0 if not available.
   *
   * @type {number}
   */
  get width() {
    const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
    return depthInfo && depthInfo.width || 0;
  }

  /**
   * Height of depth texture or 0 if not available.
   *
   * @type {number}
   */
  get height() {
    const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
    return depthInfo && depthInfo.height || 0;
  }

  /* eslint-disable jsdoc/check-examples */
  /**
   * Texture that contains packed depth information. The format of this texture is
   * {@link PIXELFORMAT_LA8}. It is UV transformed based on the underlying AR system which can
   * be normalized using {@link XrDepthSensing#uvMatrix}.
   *
   * @type {Texture}
   * @example
   * material.diffuseMap = depthSensing.texture;
   * @example
   * // GLSL shader to unpack depth texture
   * varying vec2 vUv0;
   *
   * uniform sampler2D texture_depthSensingMap;
   * uniform mat4 matrix_depth_uv;
   * uniform float depth_raw_to_meters;
   *
   * void main(void) {
   *     // transform UVs using depth matrix
   *     vec2 texCoord = (matrix_depth_uv * vec4(vUv0.xy, 0.0, 1.0)).xy;
   *
   *     // get luminance alpha components from depth texture
   *     vec2 packedDepth = texture2D(texture_depthSensingMap, texCoord).ra;
   *
   *     // unpack into single value in millimeters
   *     float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)) * depth_raw_to_meters; // m
   *
   *     // normalize: 0m to 8m distance
   *     depth = min(depth / 8.0, 1.0); // 0..1 = 0m..8m
   *
   *     // paint scene from black to white based on distance
   *     gl_FragColor = vec4(depth, depth, depth, 1.0);
   * }
   */
  get texture() {
    return this._texture;
  }
  /* eslint-enable jsdoc/check-examples */

  /**
   * 4x4 matrix that should be used to transform depth texture UVs to normalized UVs in a shader.
   * It is updated when the depth texture is resized. Refer to {@link XrDepthSensing#resize}.
   *
   * @type {Mat4}
   * @example
   * material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
   */
  get uvMatrix() {
    return this._matrix;
  }

  /**
   * Multiply this coefficient number by raw depth value to get depth in meters.
   *
   * @type {number}
   * @example
   * material.setParameter('depth_raw_to_meters', depthSensing.rawValueToMeters);
   */
  get rawValueToMeters() {
    const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
    return depthInfo && depthInfo.rawValueToMeters || 0;
  }
}

export { XrDepthSensing };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItZGVwdGgtc2Vuc2luZy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1kZXB0aC1zZW5zaW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcblxuaW1wb3J0IHsgQUREUkVTU19DTEFNUF9UT19FREdFLCBQSVhFTEZPUk1BVF9MQTgsIEZJTFRFUl9MSU5FQVIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSwgWFJERVBUSFNFTlNJTkdVU0FHRV9HUFUgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogRGVwdGggU2Vuc2luZyBwcm92aWRlcyBkZXB0aCBpbmZvcm1hdGlvbiB3aGljaCBpcyByZWNvbnN0cnVjdGVkIHVzaW5nIHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbS5cbiAqIEl0IHByb3ZpZGVzIHRoZSBhYmlsaXR5IHRvIHF1ZXJ5IGRlcHRoIHZhbHVlcyAoQ1BVIHBhdGgpIG9yIGFjY2VzcyBhIGRlcHRoIHRleHR1cmUgKEdQVSBwYXRoKS5cbiAqIERlcHRoIGluZm9ybWF0aW9uIGNhbiBiZSB1c2VkIChub3QgbGltaXRlZCB0bykgZm9yIHJlY29uc3RydWN0aW5nIHJlYWwgd29ybGQgZ2VvbWV0cnksIHZpcnR1YWxcbiAqIG9iamVjdCBwbGFjZW1lbnQsIG9jY2x1c2lvbiBvZiB2aXJ0dWFsIG9iamVjdHMgYnkgcmVhbCB3b3JsZCBnZW9tZXRyeSBhbmQgbW9yZS5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBDUFUgcGF0aFxuICogY29uc3QgZGVwdGhTZW5zaW5nID0gYXBwLnhyLmRlcHRoU2Vuc2luZztcbiAqIGlmIChkZXB0aFNlbnNpbmcuYXZhaWxhYmxlKSB7XG4gKiAgICAgLy8gZ2V0IGRlcHRoIGluIHRoZSBtaWRkbGUgb2YgdGhlIHNjcmVlbiwgdmFsdWUgaXMgaW4gbWV0ZXJzXG4gKiAgICAgY29uc3QgZGVwdGggPSBkZXB0aFNlbnNpbmcuZ2V0RGVwdGgoZGVwdGhTZW5zaW5nLndpZHRoIC8gMiwgZGVwdGhTZW5zaW5nLmhlaWdodCAvIDIpO1xuICogfVxuICogYGBgXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gR1BVIHBhdGgsIGF0dGFjaGluZyB0ZXh0dXJlIHRvIG1hdGVyaWFsXG4gKiBtYXRlcmlhbC5kaWZmdXNlTWFwID0gZGVwdGhTZW5zaW5nLnRleHR1cmU7XG4gKiBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ21hdHJpeF9kZXB0aF91dicsIGRlcHRoU2Vuc2luZy51dk1hdHJpeC5kYXRhKTtcbiAqIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZGVwdGhfcmF3X3RvX21ldGVycycsIGRlcHRoU2Vuc2luZy5yYXdWYWx1ZVRvTWV0ZXJzKTtcbiAqIG1hdGVyaWFsLnVwZGF0ZSgpO1xuICpcbiAqIC8vIHVwZGF0ZSBVViB0cmFuc2Zvcm1hdGlvbiBtYXRyaXggb24gZGVwdGggdGV4dHVyZSByZXNpemVcbiAqIGRlcHRoU2Vuc2luZy5vbigncmVzaXplJywgZnVuY3Rpb24gKCkge1xuICogICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbWF0cml4X2RlcHRoX3V2JywgZGVwdGhTZW5zaW5nLnV2TWF0cml4LmRhdGEpO1xuICogICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZGVwdGhfcmF3X3RvX21ldGVycycsIGRlcHRoU2Vuc2luZy5yYXdWYWx1ZVRvTWV0ZXJzKTtcbiAqIH0pO1xuICogYGBgXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gR0xTTCBzaGFkZXIgdG8gdW5wYWNrIGRlcHRoIHRleHR1cmVcbiAqIHZhcnlpbmcgdmVjMiB2VXYwO1xuICpcbiAqIHVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZGVwdGhTZW5zaW5nTWFwO1xuICogdW5pZm9ybSBtYXQ0IG1hdHJpeF9kZXB0aF91djtcbiAqIHVuaWZvcm0gZmxvYXQgZGVwdGhfcmF3X3RvX21ldGVycztcbiAqXG4gKiB2b2lkIG1haW4odm9pZCkge1xuICogICAgIC8vIHRyYW5zZm9ybSBVVnMgdXNpbmcgZGVwdGggbWF0cml4XG4gKiAgICAgdmVjMiB0ZXhDb29yZCA9IChtYXRyaXhfZGVwdGhfdXYgKiB2ZWM0KHZVdjAueHksIDAuMCwgMS4wKSkueHk7XG4gKlxuICogICAgIC8vIGdldCBsdW1pbmFuY2UgYWxwaGEgY29tcG9uZW50cyBmcm9tIGRlcHRoIHRleHR1cmVcbiAqICAgICB2ZWMyIHBhY2tlZERlcHRoID0gdGV4dHVyZTJEKHRleHR1cmVfZGVwdGhTZW5zaW5nTWFwLCB0ZXhDb29yZCkucmE7XG4gKlxuICogICAgIC8vIHVucGFjayBpbnRvIHNpbmdsZSB2YWx1ZSBpbiBtaWxsaW1ldGVyc1xuICogICAgIGZsb2F0IGRlcHRoID0gZG90KHBhY2tlZERlcHRoLCB2ZWMyKDI1NS4wLCAyNTYuMCAqIDI1NS4wKSkgKiBkZXB0aF9yYXdfdG9fbWV0ZXJzOyAvLyBtXG4gKlxuICogICAgIC8vIG5vcm1hbGl6ZTogMG0gdG8gOG0gZGlzdGFuY2VcbiAqICAgICBkZXB0aCA9IG1pbihkZXB0aCAvIDguMCwgMS4wKTsgLy8gMC4uMSA9IDAuLjhcbiAqXG4gKiAgICAgLy8gcGFpbnQgc2NlbmUgZnJvbSBibGFjayB0byB3aGl0ZSBiYXNlZCBvbiBkaXN0YW5jZVxuICogICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZGVwdGgsIGRlcHRoLCBkZXB0aCwgMS4wKTtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgWHJEZXB0aFNlbnNpbmcgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYW5hZ2VyO1xuXG4gICAgIC8qKlxuICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICogQHByaXZhdGVcbiAgICAgICovXG4gICAgX2F2YWlsYWJsZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSQ1BVRGVwdGhJbmZvcm1hdGlvbnxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RlcHRoSW5mb0NwdSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJDUFVEZXB0aEluZm9ybWF0aW9ufG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGVwdGhJbmZvR3B1ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91c2FnZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGF0YUZvcm1hdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRyaXhEaXJ0eSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0cml4ID0gbmV3IE1hdDQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtVaW50OEFycmF5fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VtcHR5QnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoMzIpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1VpbnQ4QXJyYXl8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aEJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VGV4dHVyZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90ZXh0dXJlO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhyRGVwdGhTZW5zaW5nIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gbWFuYWdlciAtIFdlYlhSIE1hbmFnZXIuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcblxuICAgICAgICAvLyBUT0RPOiBkYXRhIGZvcm1hdCBjYW4gYmUgZGlmZmVyZW50XG4gICAgICAgIHRoaXMuX3RleHR1cmUgPSBuZXcgVGV4dHVyZSh0aGlzLl9tYW5hZ2VyLmFwcC5ncmFwaGljc0RldmljZSwge1xuICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9MQTgsXG4gICAgICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTElORUFSLFxuICAgICAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTElORUFSLFxuICAgICAgICAgICAgbmFtZTogJ1hSRGVwdGhTZW5zaW5nJ1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAodGhpcy5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3N0YXJ0JywgdGhpcy5fb25TZXNzaW9uU3RhcnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbignZW5kJywgdGhpcy5fb25TZXNzaW9uRW5kLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gZGVwdGggc2Vuc2luZyBkYXRhIGJlY29tZXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyRGVwdGhTZW5zaW5nI2F2YWlsYWJsZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBkZXB0aCBzZW5zaW5nIGRhdGEgYmVjb21lcyB1bmF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBYckRlcHRoU2Vuc2luZyN1bmF2YWlsYWJsZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgZGVwdGggc2Vuc2luZyB0ZXh0dXJlIGJlZW4gcmVzaXplZC4gVGhlIHtAbGluayBYckRlcHRoU2Vuc2luZyN1dk1hdHJpeH0gbmVlZHNcbiAgICAgKiB0byBiZSB1cGRhdGVkIGZvciByZWxldmFudCBzaGFkZXJzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyRGVwdGhTZW5zaW5nI3Jlc2l6ZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSBuZXcgd2lkdGggb2YgdGhlIGRlcHRoIHRleHR1cmUgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgbmV3IGhlaWdodCBvZiB0aGUgZGVwdGggdGV4dHVyZSBpbiBwaXhlbHMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBkZXB0aFNlbnNpbmcub24oJ3Jlc2l6ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdtYXRyaXhfZGVwdGhfdXYnLCBkZXB0aFNlbnNpbmcudXZNYXRyaXgpO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl90ZXh0dXJlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fdGV4dHVyZSA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU2Vzc2lvblN0YXJ0KCkge1xuICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5fbWFuYWdlci5zZXNzaW9uO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLl91c2FnZSA9IHNlc3Npb24uZGVwdGhVc2FnZTtcbiAgICAgICAgICAgIHRoaXMuX2RhdGFGb3JtYXQgPSBzZXNzaW9uLmRlcHRoRGF0YUZvcm1hdDtcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIHRoaXMuX3VzYWdlID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2RhdGFGb3JtYXQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TZXNzaW9uRW5kKCkge1xuICAgICAgICB0aGlzLl9kZXB0aEluZm9DcHUgPSBudWxsO1xuICAgICAgICB0aGlzLl9kZXB0aEluZm9HcHUgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3VzYWdlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZGF0YUZvcm1hdCA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F2YWlsYWJsZSkge1xuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3VuYXZhaWxhYmxlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kZXB0aEJ1ZmZlciA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RleHR1cmUuX3dpZHRoID0gNDtcbiAgICAgICAgdGhpcy5fdGV4dHVyZS5faGVpZ2h0ID0gNDtcbiAgICAgICAgdGhpcy5fdGV4dHVyZS5fbGV2ZWxzWzBdID0gdGhpcy5fZW1wdHlCdWZmZXI7XG4gICAgICAgIHRoaXMuX3RleHR1cmUudXBsb2FkKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3VwZGF0ZVRleHR1cmUoKSB7XG4gICAgICAgIGNvbnN0IGRlcHRoSW5mbyA9IHRoaXMuX2RlcHRoSW5mb0NwdSB8fCB0aGlzLl9kZXB0aEluZm9HcHU7XG5cbiAgICAgICAgaWYgKGRlcHRoSW5mbykge1xuICAgICAgICAgICAgbGV0IHJlc2l6ZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gY2hhbmdlZCByZXNvbHV0aW9uXG4gICAgICAgICAgICBpZiAoZGVwdGhJbmZvLndpZHRoICE9PSB0aGlzLl90ZXh0dXJlLndpZHRoIHx8IGRlcHRoSW5mby5oZWlnaHQgIT09IHRoaXMuX3RleHR1cmUuaGVpZ2h0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZS5fd2lkdGggPSBkZXB0aEluZm8ud2lkdGg7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZS5faGVpZ2h0ID0gZGVwdGhJbmZvLmhlaWdodDtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRyaXhEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmVzaXplZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9kZXB0aEluZm9DcHUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhQnVmZmVyID0gdGhpcy5fZGVwdGhJbmZvQ3B1LmRhdGE7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGVwdGhCdWZmZXIgPSBuZXcgVWludDhBcnJheShkYXRhQnVmZmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlLl9sZXZlbHNbMF0gPSB0aGlzLl9kZXB0aEJ1ZmZlcjtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlLnVwbG9hZCgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9kZXB0aEluZm9HcHUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlLl9sZXZlbHNbMF0gPSB0aGlzLl9kZXB0aEluZm9HcHUudGV4dHVyZTtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlLnVwbG9hZCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVzaXplZCkgdGhpcy5maXJlKCdyZXNpemUnLCBkZXB0aEluZm8ud2lkdGgsIGRlcHRoSW5mby5oZWlnaHQpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBkZXB0aCBpbmZvIG5vdCBhdmFpbGFibGUgYW55bW9yZVxuICAgICAgICAgICAgdGhpcy5fZGVwdGhCdWZmZXIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZS5fd2lkdGggPSA0O1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZS5faGVpZ2h0ID0gNDtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmUuX2xldmVsc1swXSA9IHRoaXMuX2VtcHR5QnVmZmVyO1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZS51cGxvYWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBwYXJhbSB7Kn0gdmlldyAtIEZpcnN0IFhSVmlldyBvZiB2aWV3ZXIgWFJQb3NlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUsIHZpZXcpIHtcbiAgICAgICAgaWYgKCF0aGlzLl91c2FnZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBsZXQgZGVwdGhJbmZvQ3B1ID0gbnVsbDtcbiAgICAgICAgbGV0IGRlcHRoSW5mb0dwdSA9IG51bGw7XG4gICAgICAgIGlmICh0aGlzLl91c2FnZSA9PT0gWFJERVBUSFNFTlNJTkdVU0FHRV9DUFUgJiYgdmlldykge1xuICAgICAgICAgICAgZGVwdGhJbmZvQ3B1ID0gZnJhbWUuZ2V0RGVwdGhJbmZvcm1hdGlvbih2aWV3KTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl91c2FnZSA9PT0gWFJERVBUSFNFTlNJTkdVU0FHRV9HUFUgJiYgdmlldykge1xuICAgICAgICAgICAgZGVwdGhJbmZvR3B1ID0gZnJhbWUuZ2V0RGVwdGhJbmZvcm1hdGlvbih2aWV3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgodGhpcy5fZGVwdGhJbmZvQ3B1ICYmICFkZXB0aEluZm9DcHUpIHx8ICghdGhpcy5fZGVwdGhJbmZvQ3B1ICYmIGRlcHRoSW5mb0NwdSkgfHwgKHRoaXMuZGVwdGhJbmZvR3B1ICYmICFkZXB0aEluZm9HcHUpIHx8ICghdGhpcy5fZGVwdGhJbmZvR3B1ICYmIGRlcHRoSW5mb0dwdSkpIHtcbiAgICAgICAgICAgIHRoaXMuX21hdHJpeERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kZXB0aEluZm9DcHUgPSBkZXB0aEluZm9DcHU7XG4gICAgICAgIHRoaXMuX2RlcHRoSW5mb0dwdSA9IGRlcHRoSW5mb0dwdTtcblxuICAgICAgICB0aGlzLl91cGRhdGVUZXh0dXJlKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX21hdHJpeERpcnR5KSB7XG4gICAgICAgICAgICB0aGlzLl9tYXRyaXhEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBkZXB0aEluZm8gPSB0aGlzLl9kZXB0aEluZm9DcHUgfHwgdGhpcy5fZGVwdGhJbmZvR3B1O1xuXG4gICAgICAgICAgICBpZiAoZGVwdGhJbmZvKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0cml4LmRhdGEuc2V0KGRlcHRoSW5mby5ub3JtRGVwdGhCdWZmZXJGcm9tTm9ybVZpZXcubWF0cml4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0cml4LnNldElkZW50aXR5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoKHRoaXMuX2RlcHRoSW5mb0NwdSB8fCB0aGlzLl9kZXB0aEluZm9HcHUpICYmICF0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2F2YWlsYWJsZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2F2YWlsYWJsZScpO1xuICAgICAgICB9IGVsc2UgaWYgKCF0aGlzLl9kZXB0aEluZm9DcHUgJiYgIXRoaXMuX2RlcHRoSW5mb0dwdSAmJiB0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCd1bmF2YWlsYWJsZScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGRlcHRoIHZhbHVlIGZyb20gZGVwdGggaW5mb3JtYXRpb24gaW4gbWV0ZXJzLiBVViBpcyBpbiByYW5nZSBvZiAwLi4xLCB3aXRoIG9yaWdpbiBpblxuICAgICAqIHRvcC1sZWZ0IGNvcm5lciBvZiBhIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdSAtIFUgY29vcmRpbmF0ZSBvZiBwaXhlbCBpbiBkZXB0aCB0ZXh0dXJlLCB3aGljaCBpcyBpbiByYW5nZSBmcm9tIDAuMCB0b1xuICAgICAqIDEuMCAobGVmdCB0byByaWdodCkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHYgLSBWIGNvb3JkaW5hdGUgb2YgcGl4ZWwgaW4gZGVwdGggdGV4dHVyZSwgd2hpY2ggaXMgaW4gcmFuZ2UgZnJvbSAwLjAgdG9cbiAgICAgKiAxLjAgKHRvcCB0byBib3R0b20pLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ8bnVsbH0gRGVwdGggaW4gbWV0ZXJzIG9yIG51bGwgaWYgZGVwdGggaW5mb3JtYXRpb24gaXMgY3VycmVudGx5IG5vdFxuICAgICAqIGF2YWlsYWJsZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGRlcHRoID0gYXBwLnhyLmRlcHRoU2Vuc2luZy5nZXREZXB0aCh1LCB2KTtcbiAgICAgKiBpZiAoZGVwdGggIT09IG51bGwpIHtcbiAgICAgKiAgICAgLy8gZGVwdGggaW4gbWV0ZXJzXG4gICAgICogfVxuICAgICAqL1xuICAgIGdldERlcHRoKHUsIHYpIHtcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyBHUFUgdXNhZ2VcblxuICAgICAgICBpZiAoIXRoaXMuX2RlcHRoSW5mb0NwdSlcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aEluZm9DcHUuZ2V0RGVwdGhJbk1ldGVycyh1LCB2KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIERlcHRoIFNlbnNpbmcgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHBsYXRmb3JtLmJyb3dzZXIgJiYgISF3aW5kb3cuWFJEZXB0aEluZm9ybWF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgZGVwdGggc2Vuc2luZyBpbmZvcm1hdGlvbiBpcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChhcHAueHIuZGVwdGhTZW5zaW5nLmF2YWlsYWJsZSkge1xuICAgICAqICAgICBjb25zdCBkZXB0aCA9IGFwcC54ci5kZXB0aFNlbnNpbmcuZ2V0RGVwdGgoeCwgeSk7XG4gICAgICogfVxuICAgICAqL1xuICAgIGdldCBhdmFpbGFibGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdmFpbGFibGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2hldGhlciB0aGUgdXNhZ2UgaXMgQ1BVIG9yIEdQVS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCB1c2FnZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzYWdlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkZXB0aCBzZW5zaW5nIGRhdGEgZm9ybWF0LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IGRhdGFGb3JtYXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhRm9ybWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdpZHRoIG9mIGRlcHRoIHRleHR1cmUgb3IgMCBpZiBub3QgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIGNvbnN0IGRlcHRoSW5mbyA9IHRoaXMuX2RlcHRoSW5mb0NwdSB8fCB0aGlzLl9kZXB0aEluZm9HcHU7XG4gICAgICAgIHJldHVybiBkZXB0aEluZm8gJiYgZGVwdGhJbmZvLndpZHRoIHx8IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGVpZ2h0IG9mIGRlcHRoIHRleHR1cmUgb3IgMCBpZiBub3QgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICBjb25zdCBkZXB0aEluZm8gPSB0aGlzLl9kZXB0aEluZm9DcHUgfHwgdGhpcy5fZGVwdGhJbmZvR3B1O1xuICAgICAgICByZXR1cm4gZGVwdGhJbmZvICYmIGRlcHRoSW5mby5oZWlnaHQgfHwgMDtcbiAgICB9XG5cbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBqc2RvYy9jaGVjay1leGFtcGxlcyAqL1xuICAgIC8qKlxuICAgICAqIFRleHR1cmUgdGhhdCBjb250YWlucyBwYWNrZWQgZGVwdGggaW5mb3JtYXRpb24uIFRoZSBmb3JtYXQgb2YgdGhpcyB0ZXh0dXJlIGlzXG4gICAgICoge0BsaW5rIFBJWEVMRk9STUFUX0xBOH0uIEl0IGlzIFVWIHRyYW5zZm9ybWVkIGJhc2VkIG9uIHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbSB3aGljaCBjYW5cbiAgICAgKiBiZSBub3JtYWxpemVkIHVzaW5nIHtAbGluayBYckRlcHRoU2Vuc2luZyN1dk1hdHJpeH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VGV4dHVyZX1cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSBkZXB0aFNlbnNpbmcudGV4dHVyZTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdMU0wgc2hhZGVyIHRvIHVucGFjayBkZXB0aCB0ZXh0dXJlXG4gICAgICogdmFyeWluZyB2ZWMyIHZVdjA7XG4gICAgICpcbiAgICAgKiB1bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX2RlcHRoU2Vuc2luZ01hcDtcbiAgICAgKiB1bmlmb3JtIG1hdDQgbWF0cml4X2RlcHRoX3V2O1xuICAgICAqIHVuaWZvcm0gZmxvYXQgZGVwdGhfcmF3X3RvX21ldGVycztcbiAgICAgKlxuICAgICAqIHZvaWQgbWFpbih2b2lkKSB7XG4gICAgICogICAgIC8vIHRyYW5zZm9ybSBVVnMgdXNpbmcgZGVwdGggbWF0cml4XG4gICAgICogICAgIHZlYzIgdGV4Q29vcmQgPSAobWF0cml4X2RlcHRoX3V2ICogdmVjNCh2VXYwLnh5LCAwLjAsIDEuMCkpLnh5O1xuICAgICAqXG4gICAgICogICAgIC8vIGdldCBsdW1pbmFuY2UgYWxwaGEgY29tcG9uZW50cyBmcm9tIGRlcHRoIHRleHR1cmVcbiAgICAgKiAgICAgdmVjMiBwYWNrZWREZXB0aCA9IHRleHR1cmUyRCh0ZXh0dXJlX2RlcHRoU2Vuc2luZ01hcCwgdGV4Q29vcmQpLnJhO1xuICAgICAqXG4gICAgICogICAgIC8vIHVucGFjayBpbnRvIHNpbmdsZSB2YWx1ZSBpbiBtaWxsaW1ldGVyc1xuICAgICAqICAgICBmbG9hdCBkZXB0aCA9IGRvdChwYWNrZWREZXB0aCwgdmVjMigyNTUuMCwgMjU2LjAgKiAyNTUuMCkpICogZGVwdGhfcmF3X3RvX21ldGVyczsgLy8gbVxuICAgICAqXG4gICAgICogICAgIC8vIG5vcm1hbGl6ZTogMG0gdG8gOG0gZGlzdGFuY2VcbiAgICAgKiAgICAgZGVwdGggPSBtaW4oZGVwdGggLyA4LjAsIDEuMCk7IC8vIDAuLjEgPSAwbS4uOG1cbiAgICAgKlxuICAgICAqICAgICAvLyBwYWludCBzY2VuZSBmcm9tIGJsYWNrIHRvIHdoaXRlIGJhc2VkIG9uIGRpc3RhbmNlXG4gICAgICogICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZGVwdGgsIGRlcHRoLCBkZXB0aCwgMS4wKTtcbiAgICAgKiB9XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlO1xuICAgIH1cbiAgICAvKiBlc2xpbnQtZW5hYmxlIGpzZG9jL2NoZWNrLWV4YW1wbGVzICovXG5cbiAgICAvKipcbiAgICAgKiA0eDQgbWF0cml4IHRoYXQgc2hvdWxkIGJlIHVzZWQgdG8gdHJhbnNmb3JtIGRlcHRoIHRleHR1cmUgVVZzIHRvIG5vcm1hbGl6ZWQgVVZzIGluIGEgc2hhZGVyLlxuICAgICAqIEl0IGlzIHVwZGF0ZWQgd2hlbiB0aGUgZGVwdGggdGV4dHVyZSBpcyByZXNpemVkLiBSZWZlciB0byB7QGxpbmsgWHJEZXB0aFNlbnNpbmcjcmVzaXplfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBleGFtcGxlXG4gICAgICogbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdtYXRyaXhfZGVwdGhfdXYnLCBkZXB0aFNlbnNpbmcudXZNYXRyaXguZGF0YSk7XG4gICAgICovXG4gICAgZ2V0IHV2TWF0cml4KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0cml4O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGx5IHRoaXMgY29lZmZpY2llbnQgbnVtYmVyIGJ5IHJhdyBkZXB0aCB2YWx1ZSB0byBnZXQgZGVwdGggaW4gbWV0ZXJzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG1hdGVyaWFsLnNldFBhcmFtZXRlcignZGVwdGhfcmF3X3RvX21ldGVycycsIGRlcHRoU2Vuc2luZy5yYXdWYWx1ZVRvTWV0ZXJzKTtcbiAgICAgKi9cbiAgICBnZXQgcmF3VmFsdWVUb01ldGVycygpIHtcbiAgICAgICAgY29uc3QgZGVwdGhJbmZvID0gdGhpcy5fZGVwdGhJbmZvQ3B1IHx8IHRoaXMuX2RlcHRoSW5mb0dwdTtcbiAgICAgICAgcmV0dXJuIGRlcHRoSW5mbyAmJiBkZXB0aEluZm8ucmF3VmFsdWVUb01ldGVycyB8fCAwO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJEZXB0aFNlbnNpbmcgfTtcbiJdLCJuYW1lcyI6WyJYckRlcHRoU2Vuc2luZyIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsIl9tYW5hZ2VyIiwiX2F2YWlsYWJsZSIsIl9kZXB0aEluZm9DcHUiLCJfZGVwdGhJbmZvR3B1IiwiX3VzYWdlIiwiX2RhdGFGb3JtYXQiLCJfbWF0cml4RGlydHkiLCJfbWF0cml4IiwiTWF0NCIsIl9lbXB0eUJ1ZmZlciIsIlVpbnQ4QXJyYXkiLCJfZGVwdGhCdWZmZXIiLCJfdGV4dHVyZSIsIlRleHR1cmUiLCJhcHAiLCJncmFwaGljc0RldmljZSIsImZvcm1hdCIsIlBJWEVMRk9STUFUX0xBOCIsIm1pcG1hcHMiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwibWluRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsIm1hZ0ZpbHRlciIsIm5hbWUiLCJzdXBwb3J0ZWQiLCJvbiIsIl9vblNlc3Npb25TdGFydCIsIl9vblNlc3Npb25FbmQiLCJkZXN0cm95Iiwic2Vzc2lvbiIsImRlcHRoVXNhZ2UiLCJkZXB0aERhdGFGb3JtYXQiLCJleCIsImZpcmUiLCJfd2lkdGgiLCJfaGVpZ2h0IiwiX2xldmVscyIsInVwbG9hZCIsIl91cGRhdGVUZXh0dXJlIiwiZGVwdGhJbmZvIiwicmVzaXplZCIsIndpZHRoIiwiaGVpZ2h0IiwiZGF0YUJ1ZmZlciIsImRhdGEiLCJ0ZXh0dXJlIiwidXBkYXRlIiwiZnJhbWUiLCJ2aWV3IiwiZGVwdGhJbmZvQ3B1IiwiZGVwdGhJbmZvR3B1IiwiWFJERVBUSFNFTlNJTkdVU0FHRV9DUFUiLCJnZXREZXB0aEluZm9ybWF0aW9uIiwiWFJERVBUSFNFTlNJTkdVU0FHRV9HUFUiLCJzZXQiLCJub3JtRGVwdGhCdWZmZXJGcm9tTm9ybVZpZXciLCJtYXRyaXgiLCJzZXRJZGVudGl0eSIsImdldERlcHRoIiwidSIsInYiLCJnZXREZXB0aEluTWV0ZXJzIiwicGxhdGZvcm0iLCJicm93c2VyIiwid2luZG93IiwiWFJEZXB0aEluZm9ybWF0aW9uIiwiYXZhaWxhYmxlIiwidXNhZ2UiLCJkYXRhRm9ybWF0IiwidXZNYXRyaXgiLCJyYXdWYWx1ZVRvTWV0ZXJzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsY0FBYyxTQUFTQyxZQUFZLENBQUM7QUFDdEM7QUFDSjtBQUNB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
