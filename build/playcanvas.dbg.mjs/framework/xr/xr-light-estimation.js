import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { XRTYPE_AR } from './constants.js';

const vec3A = new Vec3();
const vec3B = new Vec3();
const mat4A = new Mat4();
const mat4B = new Mat4();

/**
 * Light Estimation provides illumination data from the real world, which is estimated by the
 * underlying AR system. It provides a reflection Cube Map, that represents the reflection
 * estimation from the viewer position. A more simplified approximation of light is provided by L2
 * Spherical Harmonics data. And the most simple level of light estimation is the most prominent
 * directional light, its rotation, intensity and color.
 *
 * @augments EventHandler
 */
class XrLightEstimation extends EventHandler {
  /**
   * Create a new XrLightEstimation instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @hideconstructor
   */
  constructor(manager) {
    super();
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    this._manager = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = false;
    /**
     * @type {boolean}
     * @private
     */
    this._available = false;
    /**
     * @type {boolean}
     * @private
     */
    this._lightProbeRequested = false;
    /**
     * @type {XRLightProbe|null}
     * @private
     */
    this._lightProbe = null;
    /**
     * @type {number}
     * @private
     */
    this._intensity = 0;
    /**
     * @type {Quat}
     * @private
     */
    this._rotation = new Quat();
    /**
     * @type {Color}
     * @private
     */
    this._color = new Color();
    /**
     * @type {Float32Array}
     * @private
     */
    this._sphericalHarmonics = new Float32Array(27);
    this._manager = manager;
    this._manager.on('start', this._onSessionStart, this);
    this._manager.on('end', this._onSessionEnd, this);
  }

  /**
   * Fired when light estimation data becomes available.
   *
   * @event XrLightEstimation#available
   */

  /**
   * Fired when light estimation has failed to start.
   *
   * @event XrLightEstimation#error
   * @param {Error} error - Error object related to failure of light estimation start.
   * @example
   * app.xr.lightEstimation.on('error', function (ex) {
   *     // has failed to start
   * });
   */

  /** @private */
  _onSessionStart() {
    const supported = !!this._manager.session.requestLightProbe;
    if (!supported) return;
    this._supported = true;
  }

  /** @private */
  _onSessionEnd() {
    this._supported = false;
    this._available = false;
    this._lightProbeRequested = false;
    this._lightProbe = null;
  }

  /**
   * Start estimation of illumination data. Availability of such data will come later and an
   * `available` event will be fired. If it failed to start estimation, an `error` event will be
   * fired.
   *
   * @example
   * app.xr.on('start', function () {
   *     if (app.xr.lightEstimation.supported) {
   *         app.xr.lightEstimation.start();
   *     }
   * });
   */
  start() {
    let err;
    if (!this._manager.session) err = new Error('XR session is not running');
    if (!err && this._manager.type !== XRTYPE_AR) err = new Error('XR session type is not AR');
    if (!err && !this._supported) err = new Error('light-estimation is not supported');
    if (!err && this._lightProbe || this._lightProbeRequested) err = new Error('light estimation is already requested');
    if (err) {
      this.fire('error', err);
      return;
    }
    this._lightProbeRequested = true;
    this._manager.session.requestLightProbe().then(lightProbe => {
      const wasRequested = this._lightProbeRequested;
      this._lightProbeRequested = false;
      if (this._manager.active) {
        if (wasRequested) {
          this._lightProbe = lightProbe;
        }
      } else {
        this.fire('error', new Error('XR session is not active'));
      }
    }).catch(ex => {
      this._lightProbeRequested = false;
      this.fire('error', ex);
    });
  }

  /**
   * End estimation of illumination data.
   */
  end() {
    this._lightProbeRequested = false;
    this._lightProbe = null;
    this._available = false;
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    if (!this._lightProbe) return;
    const lightEstimate = frame.getLightEstimate(this._lightProbe);
    if (!lightEstimate) return;
    if (!this._available) {
      this._available = true;
      this.fire('available');
    }

    // intensity
    const pli = lightEstimate.primaryLightIntensity;
    this._intensity = Math.max(1.0, Math.max(pli.x, Math.max(pli.y, pli.z)));

    // color
    vec3A.copy(pli).mulScalar(1 / this._intensity);
    this._color.set(vec3A.x, vec3A.y, vec3A.z);

    // rotation
    vec3A.set(0, 0, 0);
    vec3B.copy(lightEstimate.primaryLightDirection);
    mat4A.setLookAt(vec3B, vec3A, Vec3.UP);
    mat4B.setFromAxisAngle(Vec3.RIGHT, 90); // directional light is looking down
    mat4A.mul(mat4B);
    this._rotation.setFromMat4(mat4A);

    // spherical harmonics
    this._sphericalHarmonics.set(lightEstimate.sphericalHarmonicsCoefficients);
  }

  /**
   * True if Light Estimation is supported. This information is available only during an active AR
   * session.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if estimated light information is available.
   *
   * @type {boolean}
   * @example
   * if (app.xr.lightEstimation.available) {
   *     entity.light.intensity = app.xr.lightEstimation.intensity;
   * }
   */
  get available() {
    return this._available;
  }

  /**
   * Intensity of what is estimated to be the most prominent directional light. Or null if data
   * is not available.
   *
   * @type {number|null}
   */
  get intensity() {
    return this._available ? this._intensity : null;
  }

  /**
   * Color of what is estimated to be the most prominent directional light. Or null if data is
   * not available.
   *
   * @type {Color|null}
   */
  get color() {
    return this._available ? this._color : null;
  }

  /**
   * Rotation of what is estimated to be the most prominent directional light. Or null if data is
   * not available.
   *
   * @type {Quat|null}
   */
  get rotation() {
    return this._available ? this._rotation : null;
  }

  /**
   * Spherical harmonics coefficients of what is estimated to be the most prominent directional
   * light. Or null if data is not available.
   *
   * @type {Float32Array|null}
   * @ignore
   */
  get sphericalHarmonics() {
    return this._available ? this._sphericalHarmonics : null;
  }
}

export { XrLightEstimation };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItbGlnaHQtZXN0aW1hdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay94ci94ci1saWdodC1lc3RpbWF0aW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IFhSVFlQRV9BUiB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuY29uc3QgdmVjM0EgPSBuZXcgVmVjMygpO1xuY29uc3QgdmVjM0IgPSBuZXcgVmVjMygpO1xuY29uc3QgbWF0NEEgPSBuZXcgTWF0NCgpO1xuY29uc3QgbWF0NEIgPSBuZXcgTWF0NCgpO1xuXG4vKipcbiAqIExpZ2h0IEVzdGltYXRpb24gcHJvdmlkZXMgaWxsdW1pbmF0aW9uIGRhdGEgZnJvbSB0aGUgcmVhbCB3b3JsZCwgd2hpY2ggaXMgZXN0aW1hdGVkIGJ5IHRoZVxuICogdW5kZXJseWluZyBBUiBzeXN0ZW0uIEl0IHByb3ZpZGVzIGEgcmVmbGVjdGlvbiBDdWJlIE1hcCwgdGhhdCByZXByZXNlbnRzIHRoZSByZWZsZWN0aW9uXG4gKiBlc3RpbWF0aW9uIGZyb20gdGhlIHZpZXdlciBwb3NpdGlvbi4gQSBtb3JlIHNpbXBsaWZpZWQgYXBwcm94aW1hdGlvbiBvZiBsaWdodCBpcyBwcm92aWRlZCBieSBMMlxuICogU3BoZXJpY2FsIEhhcm1vbmljcyBkYXRhLiBBbmQgdGhlIG1vc3Qgc2ltcGxlIGxldmVsIG9mIGxpZ2h0IGVzdGltYXRpb24gaXMgdGhlIG1vc3QgcHJvbWluZW50XG4gKiBkaXJlY3Rpb25hbCBsaWdodCwgaXRzIHJvdGF0aW9uLCBpbnRlbnNpdHkgYW5kIGNvbG9yLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgWHJMaWdodEVzdGltYXRpb24gZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hdmFpbGFibGUgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xpZ2h0UHJvYmVSZXF1ZXN0ZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUkxpZ2h0UHJvYmV8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9saWdodFByb2JlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW50ZW5zaXR5ID0gMDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDb2xvcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jb2xvciA9IG5ldyBDb2xvcigpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Zsb2F0MzJBcnJheX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zcGhlcmljYWxIYXJtb25pY3MgPSBuZXcgRmxvYXQzMkFycmF5KDI3KTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYckxpZ2h0RXN0aW1hdGlvbiBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9IG1hbmFnZXIgLSBXZWJYUiBNYW5hZ2VyLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5fbWFuYWdlciA9IG1hbmFnZXI7XG5cbiAgICAgICAgdGhpcy5fbWFuYWdlci5vbignc3RhcnQnLCB0aGlzLl9vblNlc3Npb25TdGFydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ2VuZCcsIHRoaXMuX29uU2Vzc2lvbkVuZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBsaWdodCBlc3RpbWF0aW9uIGRhdGEgYmVjb21lcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJMaWdodEVzdGltYXRpb24jYXZhaWxhYmxlXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGxpZ2h0IGVzdGltYXRpb24gaGFzIGZhaWxlZCB0byBzdGFydC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYckxpZ2h0RXN0aW1hdGlvbiNlcnJvclxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGVycm9yIC0gRXJyb3Igb2JqZWN0IHJlbGF0ZWQgdG8gZmFpbHVyZSBvZiBsaWdodCBlc3RpbWF0aW9uIHN0YXJ0LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmxpZ2h0RXN0aW1hdGlvbi5vbignZXJyb3InLCBmdW5jdGlvbiAoZXgpIHtcbiAgICAgKiAgICAgLy8gaGFzIGZhaWxlZCB0byBzdGFydFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU2Vzc2lvblN0YXJ0KCkge1xuICAgICAgICBjb25zdCBzdXBwb3J0ZWQgPSAhIXRoaXMuX21hbmFnZXIuc2Vzc2lvbi5yZXF1ZXN0TGlnaHRQcm9iZTtcbiAgICAgICAgaWYgKCFzdXBwb3J0ZWQpIHJldHVybjtcbiAgICAgICAgdGhpcy5fc3VwcG9ydGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TZXNzaW9uRW5kKCkge1xuICAgICAgICB0aGlzLl9zdXBwb3J0ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbGlnaHRQcm9iZVJlcXVlc3RlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9saWdodFByb2JlID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBlc3RpbWF0aW9uIG9mIGlsbHVtaW5hdGlvbiBkYXRhLiBBdmFpbGFiaWxpdHkgb2Ygc3VjaCBkYXRhIHdpbGwgY29tZSBsYXRlciBhbmQgYW5cbiAgICAgKiBgYXZhaWxhYmxlYCBldmVudCB3aWxsIGJlIGZpcmVkLiBJZiBpdCBmYWlsZWQgdG8gc3RhcnQgZXN0aW1hdGlvbiwgYW4gYGVycm9yYCBldmVudCB3aWxsIGJlXG4gICAgICogZmlyZWQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5vbignc3RhcnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIGlmIChhcHAueHIubGlnaHRFc3RpbWF0aW9uLnN1cHBvcnRlZCkge1xuICAgICAqICAgICAgICAgYXBwLnhyLmxpZ2h0RXN0aW1hdGlvbi5zdGFydCgpO1xuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhcnQoKSB7XG4gICAgICAgIGxldCBlcnI7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9tYW5hZ2VyLnNlc3Npb24pXG4gICAgICAgICAgICBlcnIgPSBuZXcgRXJyb3IoJ1hSIHNlc3Npb24gaXMgbm90IHJ1bm5pbmcnKTtcblxuICAgICAgICBpZiAoIWVyciAmJiB0aGlzLl9tYW5hZ2VyLnR5cGUgIT09IFhSVFlQRV9BUilcbiAgICAgICAgICAgIGVyciA9IG5ldyBFcnJvcignWFIgc2Vzc2lvbiB0eXBlIGlzIG5vdCBBUicpO1xuXG4gICAgICAgIGlmICghZXJyICYmICF0aGlzLl9zdXBwb3J0ZWQpXG4gICAgICAgICAgICBlcnIgPSBuZXcgRXJyb3IoJ2xpZ2h0LWVzdGltYXRpb24gaXMgbm90IHN1cHBvcnRlZCcpO1xuXG4gICAgICAgIGlmICghZXJyICYmIHRoaXMuX2xpZ2h0UHJvYmUgfHwgdGhpcy5fbGlnaHRQcm9iZVJlcXVlc3RlZClcbiAgICAgICAgICAgIGVyciA9IG5ldyBFcnJvcignbGlnaHQgZXN0aW1hdGlvbiBpcyBhbHJlYWR5IHJlcXVlc3RlZCcpO1xuXG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBlcnIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbGlnaHRQcm9iZVJlcXVlc3RlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fbWFuYWdlci5zZXNzaW9uLnJlcXVlc3RMaWdodFByb2JlKFxuICAgICAgICApLnRoZW4oKGxpZ2h0UHJvYmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdhc1JlcXVlc3RlZCA9IHRoaXMuX2xpZ2h0UHJvYmVSZXF1ZXN0ZWQ7XG4gICAgICAgICAgICB0aGlzLl9saWdodFByb2JlUmVxdWVzdGVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9tYW5hZ2VyLmFjdGl2ZSkge1xuICAgICAgICAgICAgICAgIGlmICh3YXNSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRQcm9iZSA9IGxpZ2h0UHJvYmU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgbmV3IEVycm9yKCdYUiBzZXNzaW9uIGlzIG5vdCBhY3RpdmUnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRQcm9iZVJlcXVlc3RlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5kIGVzdGltYXRpb24gb2YgaWxsdW1pbmF0aW9uIGRhdGEuXG4gICAgICovXG4gICAgZW5kKCkge1xuICAgICAgICB0aGlzLl9saWdodFByb2JlUmVxdWVzdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xpZ2h0UHJvYmUgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdmFpbGFibGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0geyp9IGZyYW1lIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGZyYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5fbGlnaHRQcm9iZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGxpZ2h0RXN0aW1hdGUgPSBmcmFtZS5nZXRMaWdodEVzdGltYXRlKHRoaXMuX2xpZ2h0UHJvYmUpO1xuICAgICAgICBpZiAoIWxpZ2h0RXN0aW1hdGUpIHJldHVybjtcblxuICAgICAgICBpZiAoIXRoaXMuX2F2YWlsYWJsZSkge1xuICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYXZhaWxhYmxlJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnRlbnNpdHlcbiAgICAgICAgY29uc3QgcGxpID0gbGlnaHRFc3RpbWF0ZS5wcmltYXJ5TGlnaHRJbnRlbnNpdHk7XG4gICAgICAgIHRoaXMuX2ludGVuc2l0eSA9IE1hdGgubWF4KDEuMCwgTWF0aC5tYXgocGxpLngsIE1hdGgubWF4KHBsaS55LCBwbGkueikpKTtcblxuICAgICAgICAvLyBjb2xvclxuICAgICAgICB2ZWMzQS5jb3B5KHBsaSkubXVsU2NhbGFyKDEgLyB0aGlzLl9pbnRlbnNpdHkpO1xuICAgICAgICB0aGlzLl9jb2xvci5zZXQodmVjM0EueCwgdmVjM0EueSwgdmVjM0Eueik7XG5cbiAgICAgICAgLy8gcm90YXRpb25cbiAgICAgICAgdmVjM0Euc2V0KDAsIDAsIDApO1xuICAgICAgICB2ZWMzQi5jb3B5KGxpZ2h0RXN0aW1hdGUucHJpbWFyeUxpZ2h0RGlyZWN0aW9uKTtcbiAgICAgICAgbWF0NEEuc2V0TG9va0F0KHZlYzNCLCB2ZWMzQSwgVmVjMy5VUCk7XG4gICAgICAgIG1hdDRCLnNldEZyb21BeGlzQW5nbGUoVmVjMy5SSUdIVCwgOTApOyAvLyBkaXJlY3Rpb25hbCBsaWdodCBpcyBsb29raW5nIGRvd25cbiAgICAgICAgbWF0NEEubXVsKG1hdDRCKTtcbiAgICAgICAgdGhpcy5fcm90YXRpb24uc2V0RnJvbU1hdDQobWF0NEEpO1xuXG4gICAgICAgIC8vIHNwaGVyaWNhbCBoYXJtb25pY3NcbiAgICAgICAgdGhpcy5fc3BoZXJpY2FsSGFybW9uaWNzLnNldChsaWdodEVzdGltYXRlLnNwaGVyaWNhbEhhcm1vbmljc0NvZWZmaWNpZW50cyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBMaWdodCBFc3RpbWF0aW9uIGlzIHN1cHBvcnRlZC4gVGhpcyBpbmZvcm1hdGlvbiBpcyBhdmFpbGFibGUgb25seSBkdXJpbmcgYW4gYWN0aXZlIEFSXG4gICAgICogc2Vzc2lvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBzdXBwb3J0ZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdXBwb3J0ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBlc3RpbWF0ZWQgbGlnaHQgaW5mb3JtYXRpb24gaXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpZiAoYXBwLnhyLmxpZ2h0RXN0aW1hdGlvbi5hdmFpbGFibGUpIHtcbiAgICAgKiAgICAgZW50aXR5LmxpZ2h0LmludGVuc2l0eSA9IGFwcC54ci5saWdodEVzdGltYXRpb24uaW50ZW5zaXR5O1xuICAgICAqIH1cbiAgICAgKi9cbiAgICBnZXQgYXZhaWxhYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVuc2l0eSBvZiB3aGF0IGlzIGVzdGltYXRlZCB0byBiZSB0aGUgbW9zdCBwcm9taW5lbnQgZGlyZWN0aW9uYWwgbGlnaHQuIE9yIG51bGwgaWYgZGF0YVxuICAgICAqIGlzIG5vdCBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfG51bGx9XG4gICAgICovXG4gICAgZ2V0IGludGVuc2l0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F2YWlsYWJsZSA/IHRoaXMuX2ludGVuc2l0eSA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29sb3Igb2Ygd2hhdCBpcyBlc3RpbWF0ZWQgdG8gYmUgdGhlIG1vc3QgcHJvbWluZW50IGRpcmVjdGlvbmFsIGxpZ2h0LiBPciBudWxsIGlmIGRhdGEgaXNcbiAgICAgKiBub3QgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge0NvbG9yfG51bGx9XG4gICAgICovXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlID8gdGhpcy5fY29sb3IgOiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJvdGF0aW9uIG9mIHdoYXQgaXMgZXN0aW1hdGVkIHRvIGJlIHRoZSBtb3N0IHByb21pbmVudCBkaXJlY3Rpb25hbCBsaWdodC4gT3IgbnVsbCBpZiBkYXRhIGlzXG4gICAgICogbm90IGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtRdWF0fG51bGx9XG4gICAgICovXG4gICAgZ2V0IHJvdGF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlID8gdGhpcy5fcm90YXRpb24gOiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNwaGVyaWNhbCBoYXJtb25pY3MgY29lZmZpY2llbnRzIG9mIHdoYXQgaXMgZXN0aW1hdGVkIHRvIGJlIHRoZSBtb3N0IHByb21pbmVudCBkaXJlY3Rpb25hbFxuICAgICAqIGxpZ2h0LiBPciBudWxsIGlmIGRhdGEgaXMgbm90IGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtGbG9hdDMyQXJyYXl8bnVsbH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHNwaGVyaWNhbEhhcm1vbmljcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F2YWlsYWJsZSA/IHRoaXMuX3NwaGVyaWNhbEhhcm1vbmljcyA6IG51bGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBYckxpZ2h0RXN0aW1hdGlvbiB9O1xuIl0sIm5hbWVzIjpbInZlYzNBIiwiVmVjMyIsInZlYzNCIiwibWF0NEEiLCJNYXQ0IiwibWF0NEIiLCJYckxpZ2h0RXN0aW1hdGlvbiIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsIl9tYW5hZ2VyIiwiX3N1cHBvcnRlZCIsIl9hdmFpbGFibGUiLCJfbGlnaHRQcm9iZVJlcXVlc3RlZCIsIl9saWdodFByb2JlIiwiX2ludGVuc2l0eSIsIl9yb3RhdGlvbiIsIlF1YXQiLCJfY29sb3IiLCJDb2xvciIsIl9zcGhlcmljYWxIYXJtb25pY3MiLCJGbG9hdDMyQXJyYXkiLCJvbiIsIl9vblNlc3Npb25TdGFydCIsIl9vblNlc3Npb25FbmQiLCJzdXBwb3J0ZWQiLCJzZXNzaW9uIiwicmVxdWVzdExpZ2h0UHJvYmUiLCJzdGFydCIsImVyciIsIkVycm9yIiwidHlwZSIsIlhSVFlQRV9BUiIsImZpcmUiLCJ0aGVuIiwibGlnaHRQcm9iZSIsIndhc1JlcXVlc3RlZCIsImFjdGl2ZSIsImNhdGNoIiwiZXgiLCJlbmQiLCJ1cGRhdGUiLCJmcmFtZSIsImxpZ2h0RXN0aW1hdGUiLCJnZXRMaWdodEVzdGltYXRlIiwicGxpIiwicHJpbWFyeUxpZ2h0SW50ZW5zaXR5IiwiTWF0aCIsIm1heCIsIngiLCJ5IiwieiIsImNvcHkiLCJtdWxTY2FsYXIiLCJzZXQiLCJwcmltYXJ5TGlnaHREaXJlY3Rpb24iLCJzZXRMb29rQXQiLCJVUCIsInNldEZyb21BeGlzQW5nbGUiLCJSSUdIVCIsIm11bCIsInNldEZyb21NYXQ0Iiwic3BoZXJpY2FsSGFybW9uaWNzQ29lZmZpY2llbnRzIiwiYXZhaWxhYmxlIiwiaW50ZW5zaXR5IiwiY29sb3IiLCJyb3RhdGlvbiIsInNwaGVyaWNhbEhhcm1vbmljcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQVFBLE1BQU1BLEtBQUssR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN4QixNQUFNQyxLQUFLLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDeEIsTUFBTUUsS0FBSyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3hCLE1BQU1DLEtBQUssR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTs7QUFFeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUUsaUJBQWlCLFNBQVNDLFlBQVksQ0FBQztBQXVEekM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLE9BQU8sRUFBRTtBQUNqQixJQUFBLEtBQUssRUFB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
