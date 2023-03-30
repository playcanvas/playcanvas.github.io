/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
 * var depthSensing = app.xr.depthSensing;
 * if (depthSensing.available) {
 *     // get depth in the middle of the screen, value is in meters
 *     var depth = depthSensing.getDepth(depthSensing.width / 2, depthSensing.height / 2);
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
   * var depth = app.xr.depthSensing.getDepth(u, v);
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
   *     var depth = app.xr.depthSensing.getDepth(x, y);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItZGVwdGgtc2Vuc2luZy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1kZXB0aC1zZW5zaW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcblxuaW1wb3J0IHsgQUREUkVTU19DTEFNUF9UT19FREdFLCBQSVhFTEZPUk1BVF9MQTgsIEZJTFRFUl9MSU5FQVIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSwgWFJERVBUSFNFTlNJTkdVU0FHRV9HUFUgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogRGVwdGggU2Vuc2luZyBwcm92aWRlcyBkZXB0aCBpbmZvcm1hdGlvbiB3aGljaCBpcyByZWNvbnN0cnVjdGVkIHVzaW5nIHRoZSB1bmRlcmx5aW5nIEFSIHN5c3RlbS5cbiAqIEl0IHByb3ZpZGVzIHRoZSBhYmlsaXR5IHRvIHF1ZXJ5IGRlcHRoIHZhbHVlcyAoQ1BVIHBhdGgpIG9yIGFjY2VzcyBhIGRlcHRoIHRleHR1cmUgKEdQVSBwYXRoKS5cbiAqIERlcHRoIGluZm9ybWF0aW9uIGNhbiBiZSB1c2VkIChub3QgbGltaXRlZCB0bykgZm9yIHJlY29uc3RydWN0aW5nIHJlYWwgd29ybGQgZ2VvbWV0cnksIHZpcnR1YWxcbiAqIG9iamVjdCBwbGFjZW1lbnQsIG9jY2x1c2lvbiBvZiB2aXJ0dWFsIG9iamVjdHMgYnkgcmVhbCB3b3JsZCBnZW9tZXRyeSBhbmQgbW9yZS5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBDUFUgcGF0aFxuICogdmFyIGRlcHRoU2Vuc2luZyA9IGFwcC54ci5kZXB0aFNlbnNpbmc7XG4gKiBpZiAoZGVwdGhTZW5zaW5nLmF2YWlsYWJsZSkge1xuICogICAgIC8vIGdldCBkZXB0aCBpbiB0aGUgbWlkZGxlIG9mIHRoZSBzY3JlZW4sIHZhbHVlIGlzIGluIG1ldGVyc1xuICogICAgIHZhciBkZXB0aCA9IGRlcHRoU2Vuc2luZy5nZXREZXB0aChkZXB0aFNlbnNpbmcud2lkdGggLyAyLCBkZXB0aFNlbnNpbmcuaGVpZ2h0IC8gMik7XG4gKiB9XG4gKiBgYGBcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBHUFUgcGF0aCwgYXR0YWNoaW5nIHRleHR1cmUgdG8gbWF0ZXJpYWxcbiAqIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSBkZXB0aFNlbnNpbmcudGV4dHVyZTtcbiAqIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbWF0cml4X2RlcHRoX3V2JywgZGVwdGhTZW5zaW5nLnV2TWF0cml4LmRhdGEpO1xuICogbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdkZXB0aF9yYXdfdG9fbWV0ZXJzJywgZGVwdGhTZW5zaW5nLnJhd1ZhbHVlVG9NZXRlcnMpO1xuICogbWF0ZXJpYWwudXBkYXRlKCk7XG4gKlxuICogLy8gdXBkYXRlIFVWIHRyYW5zZm9ybWF0aW9uIG1hdHJpeCBvbiBkZXB0aCB0ZXh0dXJlIHJlc2l6ZVxuICogZGVwdGhTZW5zaW5nLm9uKCdyZXNpemUnLCBmdW5jdGlvbiAoKSB7XG4gKiAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdtYXRyaXhfZGVwdGhfdXYnLCBkZXB0aFNlbnNpbmcudXZNYXRyaXguZGF0YSk7XG4gKiAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKCdkZXB0aF9yYXdfdG9fbWV0ZXJzJywgZGVwdGhTZW5zaW5nLnJhd1ZhbHVlVG9NZXRlcnMpO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBHTFNMIHNoYWRlciB0byB1bnBhY2sgZGVwdGggdGV4dHVyZVxuICogdmFyeWluZyB2ZWMyIHZVdjA7XG4gKlxuICogdW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9kZXB0aFNlbnNpbmdNYXA7XG4gKiB1bmlmb3JtIG1hdDQgbWF0cml4X2RlcHRoX3V2O1xuICogdW5pZm9ybSBmbG9hdCBkZXB0aF9yYXdfdG9fbWV0ZXJzO1xuICpcbiAqIHZvaWQgbWFpbih2b2lkKSB7XG4gKiAgICAgLy8gdHJhbnNmb3JtIFVWcyB1c2luZyBkZXB0aCBtYXRyaXhcbiAqICAgICB2ZWMyIHRleENvb3JkID0gKG1hdHJpeF9kZXB0aF91diAqIHZlYzQodlV2MC54eSwgMC4wLCAxLjApKS54eTtcbiAqXG4gKiAgICAgLy8gZ2V0IGx1bWluYW5jZSBhbHBoYSBjb21wb25lbnRzIGZyb20gZGVwdGggdGV4dHVyZVxuICogICAgIHZlYzIgcGFja2VkRGVwdGggPSB0ZXh0dXJlMkQodGV4dHVyZV9kZXB0aFNlbnNpbmdNYXAsIHRleENvb3JkKS5yYTtcbiAqXG4gKiAgICAgLy8gdW5wYWNrIGludG8gc2luZ2xlIHZhbHVlIGluIG1pbGxpbWV0ZXJzXG4gKiAgICAgZmxvYXQgZGVwdGggPSBkb3QocGFja2VkRGVwdGgsIHZlYzIoMjU1LjAsIDI1Ni4wICogMjU1LjApKSAqIGRlcHRoX3Jhd190b19tZXRlcnM7IC8vIG1cbiAqXG4gKiAgICAgLy8gbm9ybWFsaXplOiAwbSB0byA4bSBkaXN0YW5jZVxuICogICAgIGRlcHRoID0gbWluKGRlcHRoIC8gOC4wLCAxLjApOyAvLyAwLi4xID0gMC4uOFxuICpcbiAqICAgICAvLyBwYWludCBzY2VuZSBmcm9tIGJsYWNrIHRvIHdoaXRlIGJhc2VkIG9uIGRpc3RhbmNlXG4gKiAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChkZXB0aCwgZGVwdGgsIGRlcHRoLCAxLjApO1xuICogfVxuICogYGBgXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBYckRlcHRoU2Vuc2luZyBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hbmFnZXI7XG5cbiAgICAgLyoqXG4gICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgKiBAcHJpdmF0ZVxuICAgICAgKi9cbiAgICBfYXZhaWxhYmxlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJDUFVEZXB0aEluZm9ybWF0aW9ufG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGVwdGhJbmZvQ3B1ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUkNQVURlcHRoSW5mb3JtYXRpb258bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kZXB0aEluZm9HcHUgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VzYWdlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kYXRhRm9ybWF0ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hdHJpeERpcnR5ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRyaXggPSBuZXcgTWF0NCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1VpbnQ4QXJyYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZW1wdHlCdWZmZXIgPSBuZXcgVWludDhBcnJheSgzMik7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VWludDhBcnJheXxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RlcHRoQnVmZmVyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtUZXh0dXJlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RleHR1cmU7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgWHJEZXB0aFNlbnNpbmcgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfSBtYW5hZ2VyIC0gV2ViWFIgTWFuYWdlci5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobWFuYWdlcikge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyO1xuXG4gICAgICAgIC8vIFRPRE86IGRhdGEgZm9ybWF0IGNhbiBiZSBkaWZmZXJlbnRcbiAgICAgICAgdGhpcy5fdGV4dHVyZSA9IG5ldyBUZXh0dXJlKHRoaXMuX21hbmFnZXIuYXBwLmdyYXBoaWNzRGV2aWNlLCB7XG4gICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX0xBOCxcbiAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgYWRkcmVzc1U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIGFkZHJlc3NWOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9MSU5FQVIsXG4gICAgICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9MSU5FQVIsXG4gICAgICAgICAgICBuYW1lOiAnWFJEZXB0aFNlbnNpbmcnXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICh0aGlzLnN1cHBvcnRlZCkge1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbignc3RhcnQnLCB0aGlzLl9vblNlc3Npb25TdGFydCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdlbmQnLCB0aGlzLl9vblNlc3Npb25FbmQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBkZXB0aCBzZW5zaW5nIGRhdGEgYmVjb21lcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJEZXB0aFNlbnNpbmcjYXZhaWxhYmxlXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGRlcHRoIHNlbnNpbmcgZGF0YSBiZWNvbWVzIHVuYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyRGVwdGhTZW5zaW5nI3VuYXZhaWxhYmxlXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBkZXB0aCBzZW5zaW5nIHRleHR1cmUgYmVlbiByZXNpemVkLiBUaGUge0BsaW5rIFhyRGVwdGhTZW5zaW5nI3V2TWF0cml4fSBuZWVkc1xuICAgICAqIHRvIGJlIHVwZGF0ZWQgZm9yIHJlbGV2YW50IHNoYWRlcnMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJEZXB0aFNlbnNpbmcjcmVzaXplXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIG5ldyB3aWR0aCBvZiB0aGUgZGVwdGggdGV4dHVyZSBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBuZXcgaGVpZ2h0IG9mIHRoZSBkZXB0aCB0ZXh0dXJlIGluIHBpeGVscy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGRlcHRoU2Vuc2luZy5vbigncmVzaXplJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ21hdHJpeF9kZXB0aF91dicsIGRlcHRoU2Vuc2luZy51dk1hdHJpeCk7XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX3RleHR1cmUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl90ZXh0dXJlID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TZXNzaW9uU3RhcnQoKSB7XG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLl9tYW5hZ2VyLnNlc3Npb247XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuX3VzYWdlID0gc2Vzc2lvbi5kZXB0aFVzYWdlO1xuICAgICAgICAgICAgdGhpcy5fZGF0YUZvcm1hdCA9IHNlc3Npb24uZGVwdGhEYXRhRm9ybWF0O1xuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgdGhpcy5fdXNhZ2UgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fZGF0YUZvcm1hdCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9hdmFpbGFibGUgPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblNlc3Npb25FbmQoKSB7XG4gICAgICAgIHRoaXMuX2RlcHRoSW5mb0NwdSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2RlcHRoSW5mb0dwdSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fdXNhZ2UgPSBudWxsO1xuICAgICAgICB0aGlzLl9kYXRhRm9ybWF0ID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fYXZhaWxhYmxlKSB7XG4gICAgICAgICAgICB0aGlzLl9hdmFpbGFibGUgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgndW5hdmFpbGFibGUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2RlcHRoQnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdGV4dHVyZS5fd2lkdGggPSA0O1xuICAgICAgICB0aGlzLl90ZXh0dXJlLl9oZWlnaHQgPSA0O1xuICAgICAgICB0aGlzLl90ZXh0dXJlLl9sZXZlbHNbMF0gPSB0aGlzLl9lbXB0eUJ1ZmZlcjtcbiAgICAgICAgdGhpcy5fdGV4dHVyZS51cGxvYWQoKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdXBkYXRlVGV4dHVyZSgpIHtcbiAgICAgICAgY29uc3QgZGVwdGhJbmZvID0gdGhpcy5fZGVwdGhJbmZvQ3B1IHx8IHRoaXMuX2RlcHRoSW5mb0dwdTtcblxuICAgICAgICBpZiAoZGVwdGhJbmZvKSB7XG4gICAgICAgICAgICBsZXQgcmVzaXplZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAvLyBjaGFuZ2VkIHJlc29sdXRpb25cbiAgICAgICAgICAgIGlmIChkZXB0aEluZm8ud2lkdGggIT09IHRoaXMuX3RleHR1cmUud2lkdGggfHwgZGVwdGhJbmZvLmhlaWdodCAhPT0gdGhpcy5fdGV4dHVyZS5oZWlnaHQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlLl93aWR0aCA9IGRlcHRoSW5mby53aWR0aDtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlLl9oZWlnaHQgPSBkZXB0aEluZm8uaGVpZ2h0O1xuICAgICAgICAgICAgICAgIHRoaXMuX21hdHJpeERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXNpemVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2RlcHRoSW5mb0NwdSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFCdWZmZXIgPSB0aGlzLl9kZXB0aEluZm9DcHUuZGF0YTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXB0aEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KGRhdGFCdWZmZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmUuX2xldmVsc1swXSA9IHRoaXMuX2RlcHRoQnVmZmVyO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmUudXBsb2FkKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2RlcHRoSW5mb0dwdSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmUuX2xldmVsc1swXSA9IHRoaXMuX2RlcHRoSW5mb0dwdS50ZXh0dXJlO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmUudXBsb2FkKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZXNpemVkKSB0aGlzLmZpcmUoJ3Jlc2l6ZScsIGRlcHRoSW5mby53aWR0aCwgZGVwdGhJbmZvLmhlaWdodCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fZGVwdGhCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIGRlcHRoIGluZm8gbm90IGF2YWlsYWJsZSBhbnltb3JlXG4gICAgICAgICAgICB0aGlzLl9kZXB0aEJ1ZmZlciA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlLl93aWR0aCA9IDQ7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlLl9oZWlnaHQgPSA0O1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZS5fbGV2ZWxzWzBdID0gdGhpcy5fZW1wdHlCdWZmZXI7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlLnVwbG9hZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHsqfSB2aWV3IC0gRmlyc3QgWFJWaWV3IG9mIHZpZXdlciBYUlBvc2UuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSwgdmlldykge1xuICAgICAgICBpZiAoIXRoaXMuX3VzYWdlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCBkZXB0aEluZm9DcHUgPSBudWxsO1xuICAgICAgICBsZXQgZGVwdGhJbmZvR3B1ID0gbnVsbDtcbiAgICAgICAgaWYgKHRoaXMuX3VzYWdlID09PSBYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSAmJiB2aWV3KSB7XG4gICAgICAgICAgICBkZXB0aEluZm9DcHUgPSBmcmFtZS5nZXREZXB0aEluZm9ybWF0aW9uKHZpZXcpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3VzYWdlID09PSBYUkRFUFRIU0VOU0lOR1VTQUdFX0dQVSAmJiB2aWV3KSB7XG4gICAgICAgICAgICBkZXB0aEluZm9HcHUgPSBmcmFtZS5nZXREZXB0aEluZm9ybWF0aW9uKHZpZXcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCh0aGlzLl9kZXB0aEluZm9DcHUgJiYgIWRlcHRoSW5mb0NwdSkgfHwgKCF0aGlzLl9kZXB0aEluZm9DcHUgJiYgZGVwdGhJbmZvQ3B1KSB8fCAodGhpcy5kZXB0aEluZm9HcHUgJiYgIWRlcHRoSW5mb0dwdSkgfHwgKCF0aGlzLl9kZXB0aEluZm9HcHUgJiYgZGVwdGhJbmZvR3B1KSkge1xuICAgICAgICAgICAgdGhpcy5fbWF0cml4RGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RlcHRoSW5mb0NwdSA9IGRlcHRoSW5mb0NwdTtcbiAgICAgICAgdGhpcy5fZGVwdGhJbmZvR3B1ID0gZGVwdGhJbmZvR3B1O1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVRleHR1cmUoKTtcblxuICAgICAgICBpZiAodGhpcy5fbWF0cml4RGlydHkpIHtcbiAgICAgICAgICAgIHRoaXMuX21hdHJpeERpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IGRlcHRoSW5mbyA9IHRoaXMuX2RlcHRoSW5mb0NwdSB8fCB0aGlzLl9kZXB0aEluZm9HcHU7XG5cbiAgICAgICAgICAgIGlmIChkZXB0aEluZm8pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRyaXguZGF0YS5zZXQoZGVwdGhJbmZvLm5vcm1EZXB0aEJ1ZmZlckZyb21Ob3JtVmlldy5tYXRyaXgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRyaXguc2V0SWRlbnRpdHkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgodGhpcy5fZGVwdGhJbmZvQ3B1IHx8IHRoaXMuX2RlcHRoSW5mb0dwdSkgJiYgIXRoaXMuX2F2YWlsYWJsZSkge1xuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYXZhaWxhYmxlJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuX2RlcHRoSW5mb0NwdSAmJiAhdGhpcy5fZGVwdGhJbmZvR3B1ICYmIHRoaXMuX2F2YWlsYWJsZSkge1xuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3VuYXZhaWxhYmxlJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgZGVwdGggdmFsdWUgZnJvbSBkZXB0aCBpbmZvcm1hdGlvbiBpbiBtZXRlcnMuIFVWIGlzIGluIHJhbmdlIG9mIDAuLjEsIHdpdGggb3JpZ2luIGluXG4gICAgICogdG9wLWxlZnQgY29ybmVyIG9mIGEgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB1IC0gVSBjb29yZGluYXRlIG9mIHBpeGVsIGluIGRlcHRoIHRleHR1cmUsIHdoaWNoIGlzIGluIHJhbmdlIGZyb20gMC4wIHRvXG4gICAgICogMS4wIChsZWZ0IHRvIHJpZ2h0KS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdiAtIFYgY29vcmRpbmF0ZSBvZiBwaXhlbCBpbiBkZXB0aCB0ZXh0dXJlLCB3aGljaCBpcyBpbiByYW5nZSBmcm9tIDAuMCB0b1xuICAgICAqIDEuMCAodG9wIHRvIGJvdHRvbSkuXG4gICAgICogQHJldHVybnMge251bWJlcnxudWxsfSBEZXB0aCBpbiBtZXRlcnMgb3IgbnVsbCBpZiBkZXB0aCBpbmZvcm1hdGlvbiBpcyBjdXJyZW50bHkgbm90XG4gICAgICogYXZhaWxhYmxlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGRlcHRoID0gYXBwLnhyLmRlcHRoU2Vuc2luZy5nZXREZXB0aCh1LCB2KTtcbiAgICAgKiBpZiAoZGVwdGggIT09IG51bGwpIHtcbiAgICAgKiAgICAgLy8gZGVwdGggaW4gbWV0ZXJzXG4gICAgICogfVxuICAgICAqL1xuICAgIGdldERlcHRoKHUsIHYpIHtcbiAgICAgICAgLy8gVE9ET1xuICAgICAgICAvLyBHUFUgdXNhZ2VcblxuICAgICAgICBpZiAoIXRoaXMuX2RlcHRoSW5mb0NwdSlcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aEluZm9DcHUuZ2V0RGVwdGhJbk1ldGVycyh1LCB2KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIERlcHRoIFNlbnNpbmcgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHBsYXRmb3JtLmJyb3dzZXIgJiYgISF3aW5kb3cuWFJEZXB0aEluZm9ybWF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgZGVwdGggc2Vuc2luZyBpbmZvcm1hdGlvbiBpcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmIChhcHAueHIuZGVwdGhTZW5zaW5nLmF2YWlsYWJsZSkge1xuICAgICAqICAgICB2YXIgZGVwdGggPSBhcHAueHIuZGVwdGhTZW5zaW5nLmdldERlcHRoKHgsIHkpO1xuICAgICAqIH1cbiAgICAgKi9cbiAgICBnZXQgYXZhaWxhYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHVzYWdlIGlzIENQVSBvciBHUFUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgdXNhZ2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91c2FnZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGVwdGggc2Vuc2luZyBkYXRhIGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBkYXRhRm9ybWF0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YUZvcm1hdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaWR0aCBvZiBkZXB0aCB0ZXh0dXJlIG9yIDAgaWYgbm90IGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICBjb25zdCBkZXB0aEluZm8gPSB0aGlzLl9kZXB0aEluZm9DcHUgfHwgdGhpcy5fZGVwdGhJbmZvR3B1O1xuICAgICAgICByZXR1cm4gZGVwdGhJbmZvICYmIGRlcHRoSW5mby53aWR0aCB8fCAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlaWdodCBvZiBkZXB0aCB0ZXh0dXJlIG9yIDAgaWYgbm90IGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGhlaWdodCgpIHtcbiAgICAgICAgY29uc3QgZGVwdGhJbmZvID0gdGhpcy5fZGVwdGhJbmZvQ3B1IHx8IHRoaXMuX2RlcHRoSW5mb0dwdTtcbiAgICAgICAgcmV0dXJuIGRlcHRoSW5mbyAmJiBkZXB0aEluZm8uaGVpZ2h0IHx8IDA7XG4gICAgfVxuXG4gICAgLyogZXNsaW50LWRpc2FibGUganNkb2MvY2hlY2stZXhhbXBsZXMgKi9cbiAgICAvKipcbiAgICAgKiBUZXh0dXJlIHRoYXQgY29udGFpbnMgcGFja2VkIGRlcHRoIGluZm9ybWF0aW9uLiBUaGUgZm9ybWF0IG9mIHRoaXMgdGV4dHVyZSBpc1xuICAgICAqIHtAbGluayBQSVhFTEZPUk1BVF9MQTh9LiBJdCBpcyBVViB0cmFuc2Zvcm1lZCBiYXNlZCBvbiB0aGUgdW5kZXJseWluZyBBUiBzeXN0ZW0gd2hpY2ggY2FuXG4gICAgICogYmUgbm9ybWFsaXplZCB1c2luZyB7QGxpbmsgWHJEZXB0aFNlbnNpbmcjdXZNYXRyaXh9LlxuICAgICAqXG4gICAgICogQHR5cGUge1RleHR1cmV9XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBtYXRlcmlhbC5kaWZmdXNlTWFwID0gZGVwdGhTZW5zaW5nLnRleHR1cmU7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBHTFNMIHNoYWRlciB0byB1bnBhY2sgZGVwdGggdGV4dHVyZVxuICAgICAqIHZhcnlpbmcgdmVjMiB2VXYwO1xuICAgICAqXG4gICAgICogdW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9kZXB0aFNlbnNpbmdNYXA7XG4gICAgICogdW5pZm9ybSBtYXQ0IG1hdHJpeF9kZXB0aF91djtcbiAgICAgKiB1bmlmb3JtIGZsb2F0IGRlcHRoX3Jhd190b19tZXRlcnM7XG4gICAgICpcbiAgICAgKiB2b2lkIG1haW4odm9pZCkge1xuICAgICAqICAgICAvLyB0cmFuc2Zvcm0gVVZzIHVzaW5nIGRlcHRoIG1hdHJpeFxuICAgICAqICAgICB2ZWMyIHRleENvb3JkID0gKG1hdHJpeF9kZXB0aF91diAqIHZlYzQodlV2MC54eSwgMC4wLCAxLjApKS54eTtcbiAgICAgKlxuICAgICAqICAgICAvLyBnZXQgbHVtaW5hbmNlIGFscGhhIGNvbXBvbmVudHMgZnJvbSBkZXB0aCB0ZXh0dXJlXG4gICAgICogICAgIHZlYzIgcGFja2VkRGVwdGggPSB0ZXh0dXJlMkQodGV4dHVyZV9kZXB0aFNlbnNpbmdNYXAsIHRleENvb3JkKS5yYTtcbiAgICAgKlxuICAgICAqICAgICAvLyB1bnBhY2sgaW50byBzaW5nbGUgdmFsdWUgaW4gbWlsbGltZXRlcnNcbiAgICAgKiAgICAgZmxvYXQgZGVwdGggPSBkb3QocGFja2VkRGVwdGgsIHZlYzIoMjU1LjAsIDI1Ni4wICogMjU1LjApKSAqIGRlcHRoX3Jhd190b19tZXRlcnM7IC8vIG1cbiAgICAgKlxuICAgICAqICAgICAvLyBub3JtYWxpemU6IDBtIHRvIDhtIGRpc3RhbmNlXG4gICAgICogICAgIGRlcHRoID0gbWluKGRlcHRoIC8gOC4wLCAxLjApOyAvLyAwLi4xID0gMG0uLjhtXG4gICAgICpcbiAgICAgKiAgICAgLy8gcGFpbnQgc2NlbmUgZnJvbSBibGFjayB0byB3aGl0ZSBiYXNlZCBvbiBkaXN0YW5jZVxuICAgICAqICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGRlcHRoLCBkZXB0aCwgZGVwdGgsIDEuMCk7XG4gICAgICogfVxuICAgICAqL1xuICAgIGdldCB0ZXh0dXJlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZTtcbiAgICB9XG4gICAgLyogZXNsaW50LWVuYWJsZSBqc2RvYy9jaGVjay1leGFtcGxlcyAqL1xuXG4gICAgLyoqXG4gICAgICogNHg0IG1hdHJpeCB0aGF0IHNob3VsZCBiZSB1c2VkIHRvIHRyYW5zZm9ybSBkZXB0aCB0ZXh0dXJlIFVWcyB0byBub3JtYWxpemVkIFVWcyBpbiBhIHNoYWRlci5cbiAgICAgKiBJdCBpcyB1cGRhdGVkIHdoZW4gdGhlIGRlcHRoIHRleHR1cmUgaXMgcmVzaXplZC4gUmVmZXIgdG8ge0BsaW5rIFhyRGVwdGhTZW5zaW5nI3Jlc2l6ZX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG1hdGVyaWFsLnNldFBhcmFtZXRlcignbWF0cml4X2RlcHRoX3V2JywgZGVwdGhTZW5zaW5nLnV2TWF0cml4LmRhdGEpO1xuICAgICAqL1xuICAgIGdldCB1dk1hdHJpeCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdHJpeDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBseSB0aGlzIGNvZWZmaWNpZW50IG51bWJlciBieSByYXcgZGVwdGggdmFsdWUgdG8gZ2V0IGRlcHRoIGluIG1ldGVycy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoJ2RlcHRoX3Jhd190b19tZXRlcnMnLCBkZXB0aFNlbnNpbmcucmF3VmFsdWVUb01ldGVycyk7XG4gICAgICovXG4gICAgZ2V0IHJhd1ZhbHVlVG9NZXRlcnMoKSB7XG4gICAgICAgIGNvbnN0IGRlcHRoSW5mbyA9IHRoaXMuX2RlcHRoSW5mb0NwdSB8fCB0aGlzLl9kZXB0aEluZm9HcHU7XG4gICAgICAgIHJldHVybiBkZXB0aEluZm8gJiYgZGVwdGhJbmZvLnJhd1ZhbHVlVG9NZXRlcnMgfHwgMDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyRGVwdGhTZW5zaW5nIH07XG4iXSwibmFtZXMiOlsiWHJEZXB0aFNlbnNpbmciLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIm1hbmFnZXIiLCJfbWFuYWdlciIsIl9hdmFpbGFibGUiLCJfZGVwdGhJbmZvQ3B1IiwiX2RlcHRoSW5mb0dwdSIsIl91c2FnZSIsIl9kYXRhRm9ybWF0IiwiX21hdHJpeERpcnR5IiwiX21hdHJpeCIsIk1hdDQiLCJfZW1wdHlCdWZmZXIiLCJVaW50OEFycmF5IiwiX2RlcHRoQnVmZmVyIiwiX3RleHR1cmUiLCJUZXh0dXJlIiwiYXBwIiwiZ3JhcGhpY3NEZXZpY2UiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9MQTgiLCJtaXBtYXBzIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsIm1pbkZpbHRlciIsIkZJTFRFUl9MSU5FQVIiLCJtYWdGaWx0ZXIiLCJuYW1lIiwic3VwcG9ydGVkIiwib24iLCJfb25TZXNzaW9uU3RhcnQiLCJfb25TZXNzaW9uRW5kIiwiZGVzdHJveSIsInNlc3Npb24iLCJkZXB0aFVzYWdlIiwiZGVwdGhEYXRhRm9ybWF0IiwiZXgiLCJmaXJlIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9sZXZlbHMiLCJ1cGxvYWQiLCJfdXBkYXRlVGV4dHVyZSIsImRlcHRoSW5mbyIsInJlc2l6ZWQiLCJ3aWR0aCIsImhlaWdodCIsImRhdGFCdWZmZXIiLCJkYXRhIiwidGV4dHVyZSIsInVwZGF0ZSIsImZyYW1lIiwidmlldyIsImRlcHRoSW5mb0NwdSIsImRlcHRoSW5mb0dwdSIsIlhSREVQVEhTRU5TSU5HVVNBR0VfQ1BVIiwiZ2V0RGVwdGhJbmZvcm1hdGlvbiIsIlhSREVQVEhTRU5TSU5HVVNBR0VfR1BVIiwic2V0Iiwibm9ybURlcHRoQnVmZmVyRnJvbU5vcm1WaWV3IiwibWF0cml4Iiwic2V0SWRlbnRpdHkiLCJnZXREZXB0aCIsInUiLCJ2IiwiZ2V0RGVwdGhJbk1ldGVycyIsInBsYXRmb3JtIiwiYnJvd3NlciIsIndpbmRvdyIsIlhSRGVwdGhJbmZvcm1hdGlvbiIsImF2YWlsYWJsZSIsInVzYWdlIiwiZGF0YUZvcm1hdCIsInV2TWF0cml4IiwicmF3VmFsdWVUb01ldGVycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsY0FBYyxTQUFTQyxZQUFZLENBQUM7QUFDdEM7QUFDSjtBQUNBO0FB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
