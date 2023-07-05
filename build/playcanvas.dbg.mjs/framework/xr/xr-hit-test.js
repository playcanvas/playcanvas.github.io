import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XRTYPE_AR, XRSPACE_VIEWER } from './constants.js';
import { XrHitTestSource } from './xr-hit-test-source.js';

/**
 * Callback used by {@link XrHitTest#start} and {@link XrHitTest#startForInputSource}.
 *
 * @callback XrHitTestStartCallback
 * @param {Error|null} err - The Error object if failed to create hit test source or null.
 * @param {XrHitTestSource|null} hitTestSource - Object that provides access to hit results against
 * real world geometry.
 */

/**
 * Hit Test provides ability to get position and rotation of ray intersecting point with
 * representation of real world geometry by underlying AR system.
 *
 * @augments EventHandler
 */
class XrHitTest extends EventHandler {
  /**
   * Create a new XrHitTest instance.
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
    this.manager = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._supported = platform.browser && !!(window.XRSession && window.XRSession.prototype.requestHitTestSource);
    /**
     * @type {XRSession}
     * @private
     */
    this._session = null;
    /**
     * List of active {@link XrHitTestSource}.
     *
     * @type {XrHitTestSource[]}
     */
    this.sources = [];
    this.manager = manager;
    if (this._supported) {
      this.manager.on('start', this._onSessionStart, this);
      this.manager.on('end', this._onSessionEnd, this);
    }
  }

  /**
   * Fired when new {@link XrHitTestSource} is added to the list.
   *
   * @event XrHitTest#add
   * @param {XrHitTestSource} hitTestSource - Hit test source that has been added.
   * @example
   * app.xr.hitTest.on('add', function (hitTestSource) {
   *     // new hit test source is added
   * });
   */

  /**
   * Fired when {@link XrHitTestSource} is removed to the list.
   *
   * @event XrHitTest#remove
   * @param {XrHitTestSource} hitTestSource - Hit test source that has been removed.
   * @example
   * app.xr.hitTest.on('remove', function (hitTestSource) {
   *     // hit test source is removed
   * });
   */

  /**
   * Fired when hit test source receives new results. It provides transform information that
   * tries to match real world picked geometry.
   *
   * @event XrHitTest#result
   * @param {XrHitTestSource} hitTestSource - Hit test source that produced the hit result.
   * @param {import('../../core/math/vec3.js').Vec3} position - Position of hit test.
   * @param {import('../../core/math/quat.js').Quat} rotation - Rotation of hit test.
   * @param {import('./xr-input-source.js').XrInputSource|null} inputSource - If is transient hit
   * test source, then it will provide related input source.
   * @example
   * app.xr.hitTest.on('result', function (hitTestSource, position, rotation, inputSource) {
   *     target.setPosition(position);
   *     target.setRotation(rotation);
   * });
   */

  /**
   * Fired when failed create hit test source.
   *
   * @event XrHitTest#error
   * @param {Error} error - Error object related to failure of creating hit test source.
   */

  /** @private */
  _onSessionStart() {
    if (this.manager.type !== XRTYPE_AR) return;
    this._session = this.manager.session;
  }

  /** @private */
  _onSessionEnd() {
    if (!this._session) return;
    this._session = null;
    for (let i = 0; i < this.sources.length; i++) {
      this.sources[i].onStop();
    }
    this.sources = [];
  }

  /**
   * Checks if hit testing is available.
   *
   * @param {Function} callback - Error callback.
   * @param {*} fireError - Event handler on while to fire error event.
   * @returns {boolean} True if hit test is available.
   * @private
   */
  isAvailable(callback, fireError) {
    let err;
    if (!this._supported) err = new Error('XR HitTest is not supported');
    if (!this._session) err = new Error('XR Session is not started (1)');
    if (this.manager.type !== XRTYPE_AR) err = new Error('XR HitTest is available only for AR');
    if (err) {
      if (callback) callback(err);
      if (fireError) fireError.fire('error', err);
      return false;
    }
    return true;
  }

  /**
   * Attempts to start hit test with provided reference space.
   *
   * @param {object} [options] - Optional object for passing arguments.
   * @param {string} [options.spaceType] - Reference space type. Defaults to
   * {@link XRSPACE_VIEWER}. Can be one of the following:
   *
   * - {@link XRSPACE_VIEWER}: Viewer - hit test will be facing relative to viewers space.
   * - {@link XRSPACE_LOCAL}: Local - represents a tracking space with a native origin near the
   * viewer at the time of creation.
   * - {@link XRSPACE_LOCALFLOOR}: Local Floor - represents a tracking space with a native origin
   * at the floor in a safe position for the user to stand. The y axis equals 0 at floor level.
   * Floor level value might be estimated by the underlying platform.
   * - {@link XRSPACE_BOUNDEDFLOOR}: Bounded Floor - represents a tracking space with its native
   * origin at the floor, where the user is expected to move within a pre-established boundary.
   * - {@link XRSPACE_UNBOUNDED}: Unbounded - represents a tracking space where the user is
   * expected to move freely around their environment, potentially long distances from their
   * starting point.
   *
   * @param {string} [options.profile] - if hit test source meant to match input source instead
   * of reference space, then name of profile of the {@link XrInputSource} should be provided.
   * @param {string[]} [options.entityTypes] - Optional list of underlying entity types against
   * which hit tests will be performed. Defaults to [ {@link XRTRACKABLE_PLANE} ]. Can be any
   * combination of the following:
   *
   * - {@link XRTRACKABLE_POINT}: Point - indicates that the hit test results will be computed
   * based on the feature points detected by the underlying Augmented Reality system.
   * - {@link XRTRACKABLE_PLANE}: Plane - indicates that the hit test results will be computed
   * based on the planes detected by the underlying Augmented Reality system.
   * - {@link XRTRACKABLE_MESH}: Mesh - indicates that the hit test results will be computed
   * based on the meshes detected by the underlying Augmented Reality system.
   *
   * @param {import('../../core/shape/ray.js').Ray} [options.offsetRay] - Optional ray by which
   * hit test ray can be offset.
   * @param {XrHitTestStartCallback} [options.callback] - Optional callback function called once
   * hit test source is created or failed.
   * @example
   * app.xr.hitTest.start({
   *     spaceType: pc.XRSPACE_VIEWER,
   *     callback: function (err, hitTestSource) {
   *         if (err) return;
   *         hitTestSource.on('result', function (position, rotation) {
   *             // position and rotation of hit test result
   *             // based on Ray facing forward from the Viewer reference space
   *         });
   *     }
   * });
   * @example
   * const ray = new pc.Ray(new pc.Vec3(0, 0, 0), new pc.Vec3(0, -1, 0));
   * app.xr.hitTest.start({
   *     spaceType: pc.XRSPACE_LOCAL,
   *     offsetRay: ray,
   *     callback: function (err, hitTestSource) {
   *         // hit test source that will sample real world geometry straight down
   *         // from the position where AR session started
   *     }
   * });
   * @example
   * app.xr.hitTest.start({
   *     profile: 'generic-touchscreen',
   *     callback: function (err, hitTestSource) {
   *         if (err) return;
   *         hitTestSource.on('result', function (position, rotation, inputSource) {
   *             // position and rotation of hit test result
   *             // that will be created from touch on mobile devices
   *         });
   *     }
   * });
   */
  start(options = {}) {
    if (!this.isAvailable(options.callback, this)) return;
    if (!options.profile && !options.spaceType) options.spaceType = XRSPACE_VIEWER;
    let xrRay;
    const offsetRay = options.offsetRay;
    if (offsetRay) {
      const origin = new DOMPoint(offsetRay.origin.x, offsetRay.origin.y, offsetRay.origin.z, 1.0);
      const direction = new DOMPoint(offsetRay.direction.x, offsetRay.direction.y, offsetRay.direction.z, 0.0);
      xrRay = new XRRay(origin, direction);
    }
    const callback = options.callback;
    if (options.spaceType) {
      this._session.requestReferenceSpace(options.spaceType).then(referenceSpace => {
        if (!this._session) {
          const err = new Error('XR Session is not started (2)');
          if (callback) callback(err);
          this.fire('error', err);
          return;
        }
        this._session.requestHitTestSource({
          space: referenceSpace,
          entityTypes: options.entityTypes || undefined,
          offsetRay: xrRay
        }).then(xrHitTestSource => {
          this._onHitTestSource(xrHitTestSource, false, callback);
        }).catch(ex => {
          if (callback) callback(ex);
          this.fire('error', ex);
        });
      }).catch(ex => {
        if (callback) callback(ex);
        this.fire('error', ex);
      });
    } else {
      this._session.requestHitTestSourceForTransientInput({
        profile: options.profile,
        entityTypes: options.entityTypes || undefined,
        offsetRay: xrRay
      }).then(xrHitTestSource => {
        this._onHitTestSource(xrHitTestSource, true, callback);
      }).catch(ex => {
        if (callback) callback(ex);
        this.fire('error', ex);
      });
    }
  }

  /**
   * @param {XRHitTestSource} xrHitTestSource - Hit test source.
   * @param {boolean} transient - True if hit test source is created from transient input source.
   * @param {Function} callback - Callback called once hit test source is created.
   * @private
   */
  _onHitTestSource(xrHitTestSource, transient, callback) {
    if (!this._session) {
      xrHitTestSource.cancel();
      const err = new Error('XR Session is not started (3)');
      if (callback) callback(err);
      this.fire('error', err);
      return;
    }
    const hitTestSource = new XrHitTestSource(this.manager, xrHitTestSource, transient);
    this.sources.push(hitTestSource);
    if (callback) callback(null, hitTestSource);
    this.fire('add', hitTestSource);
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    for (let i = 0; i < this.sources.length; i++) {
      this.sources[i].update(frame);
    }
  }

  /**
   * True if AR Hit Test is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }
}

export { XrHitTest };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItaGl0LXRlc3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItaGl0LXRlc3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5cbmltcG9ydCB7IFhSU1BBQ0VfVklFV0VSLCBYUlRZUEVfQVIgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBYckhpdFRlc3RTb3VyY2UgfSBmcm9tICcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcyc7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgWHJIaXRUZXN0I3N0YXJ0fSBhbmQge0BsaW5rIFhySGl0VGVzdCNzdGFydEZvcklucHV0U291cmNlfS5cbiAqXG4gKiBAY2FsbGJhY2sgWHJIaXRUZXN0U3RhcnRDYWxsYmFja1xuICogQHBhcmFtIHtFcnJvcnxudWxsfSBlcnIgLSBUaGUgRXJyb3Igb2JqZWN0IGlmIGZhaWxlZCB0byBjcmVhdGUgaGl0IHRlc3Qgc291cmNlIG9yIG51bGwuXG4gKiBAcGFyYW0ge1hySGl0VGVzdFNvdXJjZXxudWxsfSBoaXRUZXN0U291cmNlIC0gT2JqZWN0IHRoYXQgcHJvdmlkZXMgYWNjZXNzIHRvIGhpdCByZXN1bHRzIGFnYWluc3RcbiAqIHJlYWwgd29ybGQgZ2VvbWV0cnkuXG4gKi9cblxuLyoqXG4gKiBIaXQgVGVzdCBwcm92aWRlcyBhYmlsaXR5IHRvIGdldCBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgcmF5IGludGVyc2VjdGluZyBwb2ludCB3aXRoXG4gKiByZXByZXNlbnRhdGlvbiBvZiByZWFsIHdvcmxkIGdlb21ldHJ5IGJ5IHVuZGVybHlpbmcgQVIgc3lzdGVtLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgWHJIaXRUZXN0IGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBtYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhISh3aW5kb3cuWFJTZXNzaW9uICYmIHdpbmRvdy5YUlNlc3Npb24ucHJvdG90eXBlLnJlcXVlc3RIaXRUZXN0U291cmNlKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUlNlc3Npb259XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2Vzc2lvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IG9mIGFjdGl2ZSB7QGxpbmsgWHJIaXRUZXN0U291cmNlfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhpdFRlc3RTb3VyY2VbXX1cbiAgICAgKi9cbiAgICBzb3VyY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgWHJIaXRUZXN0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gbWFuYWdlciAtIFdlYlhSIE1hbmFnZXIuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5vbignc3RhcnQnLCB0aGlzLl9vblNlc3Npb25TdGFydCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIub24oJ2VuZCcsIHRoaXMuX29uU2Vzc2lvbkVuZCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIG5ldyB7QGxpbmsgWHJIaXRUZXN0U291cmNlfSBpcyBhZGRlZCB0byB0aGUgbGlzdC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYckhpdFRlc3QjYWRkXG4gICAgICogQHBhcmFtIHtYckhpdFRlc3RTb3VyY2V9IGhpdFRlc3RTb3VyY2UgLSBIaXQgdGVzdCBzb3VyY2UgdGhhdCBoYXMgYmVlbiBhZGRlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCdhZGQnLCBmdW5jdGlvbiAoaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAvLyBuZXcgaGl0IHRlc3Qgc291cmNlIGlzIGFkZGVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHtAbGluayBYckhpdFRlc3RTb3VyY2V9IGlzIHJlbW92ZWQgdG8gdGhlIGxpc3QuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJIaXRUZXN0I3JlbW92ZVxuICAgICAqIEBwYXJhbSB7WHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlIHRoYXQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCdyZW1vdmUnLCBmdW5jdGlvbiAoaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAvLyBoaXQgdGVzdCBzb3VyY2UgaXMgcmVtb3ZlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBoaXQgdGVzdCBzb3VyY2UgcmVjZWl2ZXMgbmV3IHJlc3VsdHMuIEl0IHByb3ZpZGVzIHRyYW5zZm9ybSBpbmZvcm1hdGlvbiB0aGF0XG4gICAgICogdHJpZXMgdG8gbWF0Y2ggcmVhbCB3b3JsZCBwaWNrZWQgZ2VvbWV0cnkuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJIaXRUZXN0I3Jlc3VsdFxuICAgICAqIEBwYXJhbSB7WHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlIHRoYXQgcHJvZHVjZWQgdGhlIGhpdCByZXN1bHQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gcG9zaXRpb24gLSBQb3NpdGlvbiBvZiBoaXQgdGVzdC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vY29yZS9tYXRoL3F1YXQuanMnKS5RdWF0fSByb3RhdGlvbiAtIFJvdGF0aW9uIG9mIGhpdCB0ZXN0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWlucHV0LXNvdXJjZS5qcycpLlhySW5wdXRTb3VyY2V8bnVsbH0gaW5wdXRTb3VyY2UgLSBJZiBpcyB0cmFuc2llbnQgaGl0XG4gICAgICogdGVzdCBzb3VyY2UsIHRoZW4gaXQgd2lsbCBwcm92aWRlIHJlbGF0ZWQgaW5wdXQgc291cmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmhpdFRlc3Qub24oJ3Jlc3VsdCcsIGZ1bmN0aW9uIChoaXRUZXN0U291cmNlLCBwb3NpdGlvbiwgcm90YXRpb24sIGlucHV0U291cmNlKSB7XG4gICAgICogICAgIHRhcmdldC5zZXRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICogICAgIHRhcmdldC5zZXRSb3RhdGlvbihyb3RhdGlvbik7XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGZhaWxlZCBjcmVhdGUgaGl0IHRlc3Qgc291cmNlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySGl0VGVzdCNlcnJvclxuICAgICAqIEBwYXJhbSB7RXJyb3J9IGVycm9yIC0gRXJyb3Igb2JqZWN0IHJlbGF0ZWQgdG8gZmFpbHVyZSBvZiBjcmVhdGluZyBoaXQgdGVzdCBzb3VyY2UuXG4gICAgICovXG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TZXNzaW9uU3RhcnQoKSB7XG4gICAgICAgIGlmICh0aGlzLm1hbmFnZXIudHlwZSAhPT0gWFJUWVBFX0FSKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3Nlc3Npb24gPSB0aGlzLm1hbmFnZXIuc2Vzc2lvbjtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TZXNzaW9uRW5kKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbiA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlc1tpXS5vblN0b3AoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNvdXJjZXMgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgaGl0IHRlc3RpbmcgaXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBFcnJvciBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0geyp9IGZpcmVFcnJvciAtIEV2ZW50IGhhbmRsZXIgb24gd2hpbGUgdG8gZmlyZSBlcnJvciBldmVudC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBoaXQgdGVzdCBpcyBhdmFpbGFibGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBpc0F2YWlsYWJsZShjYWxsYmFjaywgZmlyZUVycm9yKSB7XG4gICAgICAgIGxldCBlcnI7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zdXBwb3J0ZWQpXG4gICAgICAgICAgICBlcnIgPSBuZXcgRXJyb3IoJ1hSIEhpdFRlc3QgaXMgbm90IHN1cHBvcnRlZCcpO1xuXG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIGVyciA9IG5ldyBFcnJvcignWFIgU2Vzc2lvbiBpcyBub3Qgc3RhcnRlZCAoMSknKTtcblxuICAgICAgICBpZiAodGhpcy5tYW5hZ2VyLnR5cGUgIT09IFhSVFlQRV9BUilcbiAgICAgICAgICAgIGVyciA9IG5ldyBFcnJvcignWFIgSGl0VGVzdCBpcyBhdmFpbGFibGUgb25seSBmb3IgQVInKTtcblxuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICBpZiAoZmlyZUVycm9yKSBmaXJlRXJyb3IuZmlyZSgnZXJyb3InLCBlcnIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gc3RhcnQgaGl0IHRlc3Qgd2l0aCBwcm92aWRlZCByZWZlcmVuY2Ugc3BhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgb2JqZWN0IGZvciBwYXNzaW5nIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuc3BhY2VUeXBlXSAtIFJlZmVyZW5jZSBzcGFjZSB0eXBlLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBYUlNQQUNFX1ZJRVdFUn0uIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfVklFV0VSfTogVmlld2VyIC0gaGl0IHRlc3Qgd2lsbCBiZSBmYWNpbmcgcmVsYXRpdmUgdG8gdmlld2VycyBzcGFjZS5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMfTogTG9jYWwgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW4gbmVhciB0aGVcbiAgICAgKiB2aWV3ZXIgYXQgdGhlIHRpbWUgb2YgY3JlYXRpb24uXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTEZMT09SfTogTG9jYWwgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW5cbiAgICAgKiBhdCB0aGUgZmxvb3IgaW4gYSBzYWZlIHBvc2l0aW9uIGZvciB0aGUgdXNlciB0byBzdGFuZC4gVGhlIHkgYXhpcyBlcXVhbHMgMCBhdCBmbG9vciBsZXZlbC5cbiAgICAgKiBGbG9vciBsZXZlbCB2YWx1ZSBtaWdodCBiZSBlc3RpbWF0ZWQgYnkgdGhlIHVuZGVybHlpbmcgcGxhdGZvcm0uXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9CT1VOREVERkxPT1J9OiBCb3VuZGVkIEZsb29yIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggaXRzIG5hdGl2ZVxuICAgICAqIG9yaWdpbiBhdCB0aGUgZmxvb3IsIHdoZXJlIHRoZSB1c2VyIGlzIGV4cGVjdGVkIHRvIG1vdmUgd2l0aGluIGEgcHJlLWVzdGFibGlzaGVkIGJvdW5kYXJ5LlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfVU5CT1VOREVEfTogVW5ib3VuZGVkIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdoZXJlIHRoZSB1c2VyIGlzXG4gICAgICogZXhwZWN0ZWQgdG8gbW92ZSBmcmVlbHkgYXJvdW5kIHRoZWlyIGVudmlyb25tZW50LCBwb3RlbnRpYWxseSBsb25nIGRpc3RhbmNlcyBmcm9tIHRoZWlyXG4gICAgICogc3RhcnRpbmcgcG9pbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucHJvZmlsZV0gLSBpZiBoaXQgdGVzdCBzb3VyY2UgbWVhbnQgdG8gbWF0Y2ggaW5wdXQgc291cmNlIGluc3RlYWRcbiAgICAgKiBvZiByZWZlcmVuY2Ugc3BhY2UsIHRoZW4gbmFtZSBvZiBwcm9maWxlIG9mIHRoZSB7QGxpbmsgWHJJbnB1dFNvdXJjZX0gc2hvdWxkIGJlIHByb3ZpZGVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IFtvcHRpb25zLmVudGl0eVR5cGVzXSAtIE9wdGlvbmFsIGxpc3Qgb2YgdW5kZXJseWluZyBlbnRpdHkgdHlwZXMgYWdhaW5zdFxuICAgICAqIHdoaWNoIGhpdCB0ZXN0cyB3aWxsIGJlIHBlcmZvcm1lZC4gRGVmYXVsdHMgdG8gWyB7QGxpbmsgWFJUUkFDS0FCTEVfUExBTkV9IF0uIENhbiBiZSBhbnlcbiAgICAgKiBjb21iaW5hdGlvbiBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJUUkFDS0FCTEVfUE9JTlR9OiBQb2ludCAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBiYXNlZCBvbiB0aGUgZmVhdHVyZSBwb2ludHMgZGV0ZWN0ZWQgYnkgdGhlIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICAgICAqIC0ge0BsaW5rIFhSVFJBQ0tBQkxFX1BMQU5FfTogUGxhbmUgLSBpbmRpY2F0ZXMgdGhhdCB0aGUgaGl0IHRlc3QgcmVzdWx0cyB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogYmFzZWQgb24gdGhlIHBsYW5lcyBkZXRlY3RlZCBieSB0aGUgdW5kZXJseWluZyBBdWdtZW50ZWQgUmVhbGl0eSBzeXN0ZW0uXG4gICAgICogLSB7QGxpbmsgWFJUUkFDS0FCTEVfTUVTSH06IE1lc2ggLSBpbmRpY2F0ZXMgdGhhdCB0aGUgaGl0IHRlc3QgcmVzdWx0cyB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogYmFzZWQgb24gdGhlIG1lc2hlcyBkZXRlY3RlZCBieSB0aGUgdW5kZXJseWluZyBBdWdtZW50ZWQgUmVhbGl0eSBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vY29yZS9zaGFwZS9yYXkuanMnKS5SYXl9IFtvcHRpb25zLm9mZnNldFJheV0gLSBPcHRpb25hbCByYXkgYnkgd2hpY2hcbiAgICAgKiBoaXQgdGVzdCByYXkgY2FuIGJlIG9mZnNldC5cbiAgICAgKiBAcGFyYW0ge1hySGl0VGVzdFN0YXJ0Q2FsbGJhY2t9IFtvcHRpb25zLmNhbGxiYWNrXSAtIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlXG4gICAgICogaGl0IHRlc3Qgc291cmNlIGlzIGNyZWF0ZWQgb3IgZmFpbGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmhpdFRlc3Quc3RhcnQoe1xuICAgICAqICAgICBzcGFjZVR5cGU6IHBjLlhSU1BBQ0VfVklFV0VSLFxuICAgICAqICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVyciwgaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAgICAgaWYgKGVycikgcmV0dXJuO1xuICAgICAqICAgICAgICAgaGl0VGVzdFNvdXJjZS5vbigncmVzdWx0JywgZnVuY3Rpb24gKHBvc2l0aW9uLCByb3RhdGlvbikge1xuICAgICAqICAgICAgICAgICAgIC8vIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiBoaXQgdGVzdCByZXN1bHRcbiAgICAgKiAgICAgICAgICAgICAvLyBiYXNlZCBvbiBSYXkgZmFjaW5nIGZvcndhcmQgZnJvbSB0aGUgVmlld2VyIHJlZmVyZW5jZSBzcGFjZVxuICAgICAqICAgICAgICAgfSk7XG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJheSA9IG5ldyBwYy5SYXkobmV3IHBjLlZlYzMoMCwgMCwgMCksIG5ldyBwYy5WZWMzKDAsIC0xLCAwKSk7XG4gICAgICogYXBwLnhyLmhpdFRlc3Quc3RhcnQoe1xuICAgICAqICAgICBzcGFjZVR5cGU6IHBjLlhSU1BBQ0VfTE9DQUwsXG4gICAgICogICAgIG9mZnNldFJheTogcmF5LFxuICAgICAqICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVyciwgaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAgICAgLy8gaGl0IHRlc3Qgc291cmNlIHRoYXQgd2lsbCBzYW1wbGUgcmVhbCB3b3JsZCBnZW9tZXRyeSBzdHJhaWdodCBkb3duXG4gICAgICogICAgICAgICAvLyBmcm9tIHRoZSBwb3NpdGlvbiB3aGVyZSBBUiBzZXNzaW9uIHN0YXJ0ZWRcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmhpdFRlc3Quc3RhcnQoe1xuICAgICAqICAgICBwcm9maWxlOiAnZ2VuZXJpYy10b3VjaHNjcmVlbicsXG4gICAgICogICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoZXJyLCBoaXRUZXN0U291cmNlKSB7XG4gICAgICogICAgICAgICBpZiAoZXJyKSByZXR1cm47XG4gICAgICogICAgICAgICBoaXRUZXN0U291cmNlLm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocG9zaXRpb24sIHJvdGF0aW9uLCBpbnB1dFNvdXJjZSkge1xuICAgICAqICAgICAgICAgICAgIC8vIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiBoaXQgdGVzdCByZXN1bHRcbiAgICAgKiAgICAgICAgICAgICAvLyB0aGF0IHdpbGwgYmUgY3JlYXRlZCBmcm9tIHRvdWNoIG9uIG1vYmlsZSBkZXZpY2VzXG4gICAgICogICAgICAgICB9KTtcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXJ0KG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBpZiAoIXRoaXMuaXNBdmFpbGFibGUob3B0aW9ucy5jYWxsYmFjaywgdGhpcykpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLnByb2ZpbGUgJiYgIW9wdGlvbnMuc3BhY2VUeXBlKVxuICAgICAgICAgICAgb3B0aW9ucy5zcGFjZVR5cGUgPSBYUlNQQUNFX1ZJRVdFUjtcblxuICAgICAgICBsZXQgeHJSYXk7XG4gICAgICAgIGNvbnN0IG9mZnNldFJheSA9IG9wdGlvbnMub2Zmc2V0UmF5O1xuICAgICAgICBpZiAob2Zmc2V0UmF5KSB7XG4gICAgICAgICAgICBjb25zdCBvcmlnaW4gPSBuZXcgRE9NUG9pbnQob2Zmc2V0UmF5Lm9yaWdpbi54LCBvZmZzZXRSYXkub3JpZ2luLnksIG9mZnNldFJheS5vcmlnaW4ueiwgMS4wKTtcbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IG5ldyBET01Qb2ludChvZmZzZXRSYXkuZGlyZWN0aW9uLngsIG9mZnNldFJheS5kaXJlY3Rpb24ueSwgb2Zmc2V0UmF5LmRpcmVjdGlvbi56LCAwLjApO1xuICAgICAgICAgICAgeHJSYXkgPSBuZXcgWFJSYXkob3JpZ2luLCBkaXJlY3Rpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBvcHRpb25zLmNhbGxiYWNrO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnNwYWNlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbi5yZXF1ZXN0UmVmZXJlbmNlU3BhY2Uob3B0aW9ucy5zcGFjZVR5cGUpLnRoZW4oKHJlZmVyZW5jZVNwYWNlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignWFIgU2Vzc2lvbiBpcyBub3Qgc3RhcnRlZCAoMiknKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX3Nlc3Npb24ucmVxdWVzdEhpdFRlc3RTb3VyY2Uoe1xuICAgICAgICAgICAgICAgICAgICBzcGFjZTogcmVmZXJlbmNlU3BhY2UsXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eVR5cGVzOiBvcHRpb25zLmVudGl0eVR5cGVzIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0UmF5OiB4clJheVxuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHhySGl0VGVzdFNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkhpdFRlc3RTb3VyY2UoeHJIaXRUZXN0U291cmNlLCBmYWxzZSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGV4KTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb24ucmVxdWVzdEhpdFRlc3RTb3VyY2VGb3JUcmFuc2llbnRJbnB1dCh7XG4gICAgICAgICAgICAgICAgcHJvZmlsZTogb3B0aW9ucy5wcm9maWxlLFxuICAgICAgICAgICAgICAgIGVudGl0eVR5cGVzOiBvcHRpb25zLmVudGl0eVR5cGVzIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBvZmZzZXRSYXk6IHhyUmF5XG4gICAgICAgICAgICB9KS50aGVuKCh4ckhpdFRlc3RTb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vbkhpdFRlc3RTb3VyY2UoeHJIaXRUZXN0U291cmNlLCB0cnVlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSSGl0VGVzdFNvdXJjZX0geHJIaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdHJhbnNpZW50IC0gVHJ1ZSBpZiBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZCBmcm9tIHRyYW5zaWVudCBpbnB1dCBzb3VyY2UuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayBjYWxsZWQgb25jZSBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkhpdFRlc3RTb3VyY2UoeHJIaXRUZXN0U291cmNlLCB0cmFuc2llbnQsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbikge1xuICAgICAgICAgICAgeHJIaXRUZXN0U291cmNlLmNhbmNlbCgpO1xuICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBzdGFydGVkICgzKScpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGVycik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoaXRUZXN0U291cmNlID0gbmV3IFhySGl0VGVzdFNvdXJjZSh0aGlzLm1hbmFnZXIsIHhySGl0VGVzdFNvdXJjZSwgdHJhbnNpZW50KTtcbiAgICAgICAgdGhpcy5zb3VyY2VzLnB1c2goaGl0VGVzdFNvdXJjZSk7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBoaXRUZXN0U291cmNlKTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBoaXRUZXN0U291cmNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0geyp9IGZyYW1lIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGZyYW1lKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZXNbaV0udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgQVIgSGl0IFRlc3QgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhySGl0VGVzdCB9O1xuIl0sIm5hbWVzIjpbIlhySGl0VGVzdCIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJ3aW5kb3ciLCJYUlNlc3Npb24iLCJwcm90b3R5cGUiLCJyZXF1ZXN0SGl0VGVzdFNvdXJjZSIsIl9zZXNzaW9uIiwic291cmNlcyIsIm9uIiwiX29uU2Vzc2lvblN0YXJ0IiwiX29uU2Vzc2lvbkVuZCIsInR5cGUiLCJYUlRZUEVfQVIiLCJzZXNzaW9uIiwiaSIsImxlbmd0aCIsIm9uU3RvcCIsImlzQXZhaWxhYmxlIiwiY2FsbGJhY2siLCJmaXJlRXJyb3IiLCJlcnIiLCJFcnJvciIsImZpcmUiLCJzdGFydCIsIm9wdGlvbnMiLCJwcm9maWxlIiwic3BhY2VUeXBlIiwiWFJTUEFDRV9WSUVXRVIiLCJ4clJheSIsIm9mZnNldFJheSIsIm9yaWdpbiIsIkRPTVBvaW50IiwieCIsInkiLCJ6IiwiZGlyZWN0aW9uIiwiWFJSYXkiLCJyZXF1ZXN0UmVmZXJlbmNlU3BhY2UiLCJ0aGVuIiwicmVmZXJlbmNlU3BhY2UiLCJzcGFjZSIsImVudGl0eVR5cGVzIiwidW5kZWZpbmVkIiwieHJIaXRUZXN0U291cmNlIiwiX29uSGl0VGVzdFNvdXJjZSIsImNhdGNoIiwiZXgiLCJyZXF1ZXN0SGl0VGVzdFNvdXJjZUZvclRyYW5zaWVudElucHV0IiwidHJhbnNpZW50IiwiY2FuY2VsIiwiaGl0VGVzdFNvdXJjZSIsIlhySGl0VGVzdFNvdXJjZSIsInB1c2giLCJ1cGRhdGUiLCJmcmFtZSIsInN1cHBvcnRlZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFNBQVMsU0FBU0MsWUFBWSxDQUFDO0FBMEJqQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsT0FBTyxFQUFFO0FBQ2pCLElBQUEsS0FBSyxFQUFFLENBQUE7QUFoQ1g7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUEsT0FBTyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVA7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsVUFBVSxHQUFHQyxRQUFRLENBQUNDLE9BQU8sSUFBSSxDQUFDLEVBQUVDLE1BQU0sQ0FBQ0MsU0FBUyxJQUFJRCxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsU0FBUyxDQUFDQyxvQkFBb0IsQ0FBQyxDQUFBO0FBRXhHO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsUUFBUSxHQUFHLElBQUksQ0FBQTtBQUVmO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxPQUFPLEdBQUcsRUFBRSxDQUFBO0lBV1IsSUFBSSxDQUFDVCxPQUFPLEdBQUdBLE9BQU8sQ0FBQTtJQUV0QixJQUFJLElBQUksQ0FBQ0MsVUFBVSxFQUFFO0FBQ2pCLE1BQUEsSUFBSSxD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
