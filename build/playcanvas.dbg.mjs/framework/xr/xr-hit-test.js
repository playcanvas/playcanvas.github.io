/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
   * @type {import('./xr-manager.js').XrManager}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {XRSession}
   * @private
   */

  /**
   * List of active {@link XrHitTestSource}.
   *
   * @type {XrHitTestSource[]}
   */

  /**
   * Create a new XrHitTest instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @hideconstructor
   */
  constructor(manager) {
    super();
    this.manager = void 0;
    this._supported = platform.browser && !!(window.XRSession && window.XRSession.prototype.requestHitTestSource);
    this._session = null;
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
   * @param {Vec3} position - Position of hit test.
   * @param {Quat} rotation - Rotation of hit test.
   * @param {XrInputSource|null} inputSource - If is transient hit test source, then it will provide related input source.
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
   * var ray = new pc.Ray(new pc.Vec3(0, 0, 0), new pc.Vec3(0, -1, 0));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItaGl0LXRlc3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItaGl0LXRlc3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5cbmltcG9ydCB7IFhSU1BBQ0VfVklFV0VSLCBYUlRZUEVfQVIgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBYckhpdFRlc3RTb3VyY2UgfSBmcm9tICcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcyc7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgWHJIaXRUZXN0I3N0YXJ0fSBhbmQge0BsaW5rIFhySGl0VGVzdCNzdGFydEZvcklucHV0U291cmNlfS5cbiAqXG4gKiBAY2FsbGJhY2sgWHJIaXRUZXN0U3RhcnRDYWxsYmFja1xuICogQHBhcmFtIHtFcnJvcnxudWxsfSBlcnIgLSBUaGUgRXJyb3Igb2JqZWN0IGlmIGZhaWxlZCB0byBjcmVhdGUgaGl0IHRlc3Qgc291cmNlIG9yIG51bGwuXG4gKiBAcGFyYW0ge1hySGl0VGVzdFNvdXJjZXxudWxsfSBoaXRUZXN0U291cmNlIC0gT2JqZWN0IHRoYXQgcHJvdmlkZXMgYWNjZXNzIHRvIGhpdCByZXN1bHRzIGFnYWluc3RcbiAqIHJlYWwgd29ybGQgZ2VvbWV0cnkuXG4gKi9cblxuLyoqXG4gKiBIaXQgVGVzdCBwcm92aWRlcyBhYmlsaXR5IHRvIGdldCBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgcmF5IGludGVyc2VjdGluZyBwb2ludCB3aXRoXG4gKiByZXByZXNlbnRhdGlvbiBvZiByZWFsIHdvcmxkIGdlb21ldHJ5IGJ5IHVuZGVybHlpbmcgQVIgc3lzdGVtLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgWHJIaXRUZXN0IGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBtYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhISh3aW5kb3cuWFJTZXNzaW9uICYmIHdpbmRvdy5YUlNlc3Npb24ucHJvdG90eXBlLnJlcXVlc3RIaXRUZXN0U291cmNlKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUlNlc3Npb259XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2Vzc2lvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IG9mIGFjdGl2ZSB7QGxpbmsgWHJIaXRUZXN0U291cmNlfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhpdFRlc3RTb3VyY2VbXX1cbiAgICAgKi9cbiAgICBzb3VyY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgWHJIaXRUZXN0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gbWFuYWdlciAtIFdlYlhSIE1hbmFnZXIuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMubWFuYWdlci5vbignc3RhcnQnLCB0aGlzLl9vblNlc3Npb25TdGFydCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIub24oJ2VuZCcsIHRoaXMuX29uU2Vzc2lvbkVuZCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIG5ldyB7QGxpbmsgWHJIaXRUZXN0U291cmNlfSBpcyBhZGRlZCB0byB0aGUgbGlzdC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYckhpdFRlc3QjYWRkXG4gICAgICogQHBhcmFtIHtYckhpdFRlc3RTb3VyY2V9IGhpdFRlc3RTb3VyY2UgLSBIaXQgdGVzdCBzb3VyY2UgdGhhdCBoYXMgYmVlbiBhZGRlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCdhZGQnLCBmdW5jdGlvbiAoaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAvLyBuZXcgaGl0IHRlc3Qgc291cmNlIGlzIGFkZGVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHtAbGluayBYckhpdFRlc3RTb3VyY2V9IGlzIHJlbW92ZWQgdG8gdGhlIGxpc3QuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJIaXRUZXN0I3JlbW92ZVxuICAgICAqIEBwYXJhbSB7WHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlIHRoYXQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCdyZW1vdmUnLCBmdW5jdGlvbiAoaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAvLyBoaXQgdGVzdCBzb3VyY2UgaXMgcmVtb3ZlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBoaXQgdGVzdCBzb3VyY2UgcmVjZWl2ZXMgbmV3IHJlc3VsdHMuIEl0IHByb3ZpZGVzIHRyYW5zZm9ybSBpbmZvcm1hdGlvbiB0aGF0XG4gICAgICogdHJpZXMgdG8gbWF0Y2ggcmVhbCB3b3JsZCBwaWNrZWQgZ2VvbWV0cnkuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJIaXRUZXN0I3Jlc3VsdFxuICAgICAqIEBwYXJhbSB7WHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlIHRoYXQgcHJvZHVjZWQgdGhlIGhpdCByZXN1bHQuXG4gICAgICogQHBhcmFtIHtWZWMzfSBwb3NpdGlvbiAtIFBvc2l0aW9uIG9mIGhpdCB0ZXN0LlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcm90YXRpb24gLSBSb3RhdGlvbiBvZiBoaXQgdGVzdC5cbiAgICAgKiBAcGFyYW0ge1hySW5wdXRTb3VyY2V8bnVsbH0gaW5wdXRTb3VyY2UgLSBJZiBpcyB0cmFuc2llbnQgaGl0IHRlc3Qgc291cmNlLCB0aGVuIGl0IHdpbGwgcHJvdmlkZSByZWxhdGVkIGlucHV0IHNvdXJjZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0Lm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAoaGl0VGVzdFNvdXJjZSwgcG9zaXRpb24sIHJvdGF0aW9uLCBpbnB1dFNvdXJjZSkge1xuICAgICAqICAgICB0YXJnZXQuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqICAgICB0YXJnZXQuc2V0Um90YXRpb24ocm90YXRpb24pO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBmYWlsZWQgY3JlYXRlIGhpdCB0ZXN0IHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBYckhpdFRlc3QjZXJyb3JcbiAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnJvciAtIEVycm9yIG9iamVjdCByZWxhdGVkIHRvIGZhaWx1cmUgb2YgY3JlYXRpbmcgaGl0IHRlc3Qgc291cmNlLlxuICAgICAqL1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU2Vzc2lvblN0YXJ0KCkge1xuICAgICAgICBpZiAodGhpcy5tYW5hZ2VyLnR5cGUgIT09IFhSVFlQRV9BUilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9zZXNzaW9uID0gdGhpcy5tYW5hZ2VyLnNlc3Npb247XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU2Vzc2lvbkVuZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3Nlc3Npb24gPSBudWxsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZXNbaV0ub25TdG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zb3VyY2VzID0gW107XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIGhpdCB0ZXN0aW5nIGlzIGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gRXJyb3IgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHsqfSBmaXJlRXJyb3IgLSBFdmVudCBoYW5kbGVyIG9uIHdoaWxlIHRvIGZpcmUgZXJyb3IgZXZlbnQuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgaGl0IHRlc3QgaXMgYXZhaWxhYmxlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgaXNBdmFpbGFibGUoY2FsbGJhY2ssIGZpcmVFcnJvcikge1xuICAgICAgICBsZXQgZXJyO1xuXG4gICAgICAgIGlmICghdGhpcy5fc3VwcG9ydGVkKVxuICAgICAgICAgICAgZXJyID0gbmV3IEVycm9yKCdYUiBIaXRUZXN0IGlzIG5vdCBzdXBwb3J0ZWQnKTtcblxuICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pXG4gICAgICAgICAgICBlcnIgPSBuZXcgRXJyb3IoJ1hSIFNlc3Npb24gaXMgbm90IHN0YXJ0ZWQgKDEpJyk7XG5cbiAgICAgICAgaWYgKHRoaXMubWFuYWdlci50eXBlICE9PSBYUlRZUEVfQVIpXG4gICAgICAgICAgICBlcnIgPSBuZXcgRXJyb3IoJ1hSIEhpdFRlc3QgaXMgYXZhaWxhYmxlIG9ubHkgZm9yIEFSJyk7XG5cbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgaWYgKGZpcmVFcnJvcikgZmlyZUVycm9yLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHRzIHRvIHN0YXJ0IGhpdCB0ZXN0IHdpdGggcHJvdmlkZWQgcmVmZXJlbmNlIHNwYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9iamVjdCBmb3IgcGFzc2luZyBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnNwYWNlVHlwZV0gLSBSZWZlcmVuY2Ugc3BhY2UgdHlwZS4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgWFJTUEFDRV9WSUVXRVJ9LiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX1ZJRVdFUn06IFZpZXdlciAtIGhpdCB0ZXN0IHdpbGwgYmUgZmFjaW5nIHJlbGF0aXZlIHRvIHZpZXdlcnMgc3BhY2UuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9MT0NBTH06IExvY2FsIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggYSBuYXRpdmUgb3JpZ2luIG5lYXIgdGhlXG4gICAgICogdmlld2VyIGF0IHRoZSB0aW1lIG9mIGNyZWF0aW9uLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUxGTE9PUn06IExvY2FsIEZsb29yIC0gcmVwcmVzZW50cyBhIHRyYWNraW5nIHNwYWNlIHdpdGggYSBuYXRpdmUgb3JpZ2luXG4gICAgICogYXQgdGhlIGZsb29yIGluIGEgc2FmZSBwb3NpdGlvbiBmb3IgdGhlIHVzZXIgdG8gc3RhbmQuIFRoZSB5IGF4aXMgZXF1YWxzIDAgYXQgZmxvb3IgbGV2ZWwuXG4gICAgICogRmxvb3IgbGV2ZWwgdmFsdWUgbWlnaHQgYmUgZXN0aW1hdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIHBsYXRmb3JtLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfQk9VTkRFREZMT09SfTogQm91bmRlZCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGl0cyBuYXRpdmVcbiAgICAgKiBvcmlnaW4gYXQgdGhlIGZsb29yLCB3aGVyZSB0aGUgdXNlciBpcyBleHBlY3RlZCB0byBtb3ZlIHdpdGhpbiBhIHByZS1lc3RhYmxpc2hlZCBib3VuZGFyeS5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX1VOQk9VTkRFRH06IFVuYm91bmRlZCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aGVyZSB0aGUgdXNlciBpc1xuICAgICAqIGV4cGVjdGVkIHRvIG1vdmUgZnJlZWx5IGFyb3VuZCB0aGVpciBlbnZpcm9ubWVudCwgcG90ZW50aWFsbHkgbG9uZyBkaXN0YW5jZXMgZnJvbSB0aGVpclxuICAgICAqIHN0YXJ0aW5nIHBvaW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnByb2ZpbGVdIC0gaWYgaGl0IHRlc3Qgc291cmNlIG1lYW50IHRvIG1hdGNoIGlucHV0IHNvdXJjZSBpbnN0ZWFkXG4gICAgICogb2YgcmVmZXJlbmNlIHNwYWNlLCB0aGVuIG5hbWUgb2YgcHJvZmlsZSBvZiB0aGUge0BsaW5rIFhySW5wdXRTb3VyY2V9IHNob3VsZCBiZSBwcm92aWRlZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5lbnRpdHlUeXBlc10gLSBPcHRpb25hbCBsaXN0IG9mIHVuZGVybHlpbmcgZW50aXR5IHR5cGVzIGFnYWluc3RcbiAgICAgKiB3aGljaCBoaXQgdGVzdHMgd2lsbCBiZSBwZXJmb3JtZWQuIERlZmF1bHRzIHRvIFsge0BsaW5rIFhSVFJBQ0tBQkxFX1BMQU5FfSBdLiBDYW4gYmUgYW55XG4gICAgICogY29tYmluYXRpb24gb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFJBQ0tBQkxFX1BPSU5UfTogUG9pbnQgLSBpbmRpY2F0ZXMgdGhhdCB0aGUgaGl0IHRlc3QgcmVzdWx0cyB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogYmFzZWQgb24gdGhlIGZlYXR1cmUgcG9pbnRzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9QTEFORX06IFBsYW5lIC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBwbGFuZXMgZGV0ZWN0ZWQgYnkgdGhlIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICAgICAqIC0ge0BsaW5rIFhSVFJBQ0tBQkxFX01FU0h9OiBNZXNoIC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBtZXNoZXMgZGV0ZWN0ZWQgYnkgdGhlIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2NvcmUvc2hhcGUvcmF5LmpzJykuUmF5fSBbb3B0aW9ucy5vZmZzZXRSYXldIC0gT3B0aW9uYWwgcmF5IGJ5IHdoaWNoXG4gICAgICogaGl0IHRlc3QgcmF5IGNhbiBiZSBvZmZzZXQuXG4gICAgICogQHBhcmFtIHtYckhpdFRlc3RTdGFydENhbGxiYWNrfSBbb3B0aW9ucy5jYWxsYmFja10gLSBPcHRpb25hbCBjYWxsYmFjayBmdW5jdGlvbiBjYWxsZWQgb25jZVxuICAgICAqIGhpdCB0ZXN0IHNvdXJjZSBpcyBjcmVhdGVkIG9yIGZhaWxlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5oaXRUZXN0LnN0YXJ0KHtcbiAgICAgKiAgICAgc3BhY2VUeXBlOiBwYy5YUlNQQUNFX1ZJRVdFUixcbiAgICAgKiAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uIChlcnIsIGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgKiAgICAgICAgIGlmIChlcnIpIHJldHVybjtcbiAgICAgKiAgICAgICAgIGhpdFRlc3RTb3VyY2Uub24oJ3Jlc3VsdCcsIGZ1bmN0aW9uIChwb3NpdGlvbiwgcm90YXRpb24pIHtcbiAgICAgKiAgICAgICAgICAgICAvLyBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgaGl0IHRlc3QgcmVzdWx0XG4gICAgICogICAgICAgICAgICAgLy8gYmFzZWQgb24gUmF5IGZhY2luZyBmb3J3YXJkIGZyb20gdGhlIFZpZXdlciByZWZlcmVuY2Ugc3BhY2VcbiAgICAgKiAgICAgICAgIH0pO1xuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcmF5ID0gbmV3IHBjLlJheShuZXcgcGMuVmVjMygwLCAwLCAwKSwgbmV3IHBjLlZlYzMoMCwgLTEsIDApKTtcbiAgICAgKiBhcHAueHIuaGl0VGVzdC5zdGFydCh7XG4gICAgICogICAgIHNwYWNlVHlwZTogcGMuWFJTUEFDRV9MT0NBTCxcbiAgICAgKiAgICAgb2Zmc2V0UmF5OiByYXksXG4gICAgICogICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoZXJyLCBoaXRUZXN0U291cmNlKSB7XG4gICAgICogICAgICAgICAvLyBoaXQgdGVzdCBzb3VyY2UgdGhhdCB3aWxsIHNhbXBsZSByZWFsIHdvcmxkIGdlb21ldHJ5IHN0cmFpZ2h0IGRvd25cbiAgICAgKiAgICAgICAgIC8vIGZyb20gdGhlIHBvc2l0aW9uIHdoZXJlIEFSIHNlc3Npb24gc3RhcnRlZFxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuaGl0VGVzdC5zdGFydCh7XG4gICAgICogICAgIHByb2ZpbGU6ICdnZW5lcmljLXRvdWNoc2NyZWVuJyxcbiAgICAgKiAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uIChlcnIsIGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgKiAgICAgICAgIGlmIChlcnIpIHJldHVybjtcbiAgICAgKiAgICAgICAgIGhpdFRlc3RTb3VyY2Uub24oJ3Jlc3VsdCcsIGZ1bmN0aW9uIChwb3NpdGlvbiwgcm90YXRpb24sIGlucHV0U291cmNlKSB7XG4gICAgICogICAgICAgICAgICAgLy8gcG9zaXRpb24gYW5kIHJvdGF0aW9uIG9mIGhpdCB0ZXN0IHJlc3VsdFxuICAgICAqICAgICAgICAgICAgIC8vIHRoYXQgd2lsbCBiZSBjcmVhdGVkIGZyb20gdG91Y2ggb24gbW9iaWxlIGRldmljZXNcbiAgICAgKiAgICAgICAgIH0pO1xuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhcnQob3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIGlmICghdGhpcy5pc0F2YWlsYWJsZShvcHRpb25zLmNhbGxiYWNrLCB0aGlzKSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAoIW9wdGlvbnMucHJvZmlsZSAmJiAhb3B0aW9ucy5zcGFjZVR5cGUpXG4gICAgICAgICAgICBvcHRpb25zLnNwYWNlVHlwZSA9IFhSU1BBQ0VfVklFV0VSO1xuXG4gICAgICAgIGxldCB4clJheTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0UmF5ID0gb3B0aW9ucy5vZmZzZXRSYXk7XG4gICAgICAgIGlmIChvZmZzZXRSYXkpIHtcbiAgICAgICAgICAgIGNvbnN0IG9yaWdpbiA9IG5ldyBET01Qb2ludChvZmZzZXRSYXkub3JpZ2luLngsIG9mZnNldFJheS5vcmlnaW4ueSwgb2Zmc2V0UmF5Lm9yaWdpbi56LCAxLjApO1xuICAgICAgICAgICAgY29uc3QgZGlyZWN0aW9uID0gbmV3IERPTVBvaW50KG9mZnNldFJheS5kaXJlY3Rpb24ueCwgb2Zmc2V0UmF5LmRpcmVjdGlvbi55LCBvZmZzZXRSYXkuZGlyZWN0aW9uLnosIDAuMCk7XG4gICAgICAgICAgICB4clJheSA9IG5ldyBYUlJheShvcmlnaW4sIGRpcmVjdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuc3BhY2VUeXBlKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXNzaW9uLnJlcXVlc3RSZWZlcmVuY2VTcGFjZShvcHRpb25zLnNwYWNlVHlwZSkudGhlbigocmVmZXJlbmNlU3BhY2UpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX3Nlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBzdGFydGVkICgyKScpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbi5yZXF1ZXN0SGl0VGVzdFNvdXJjZSh7XG4gICAgICAgICAgICAgICAgICAgIHNwYWNlOiByZWZlcmVuY2VTcGFjZSxcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5VHlwZXM6IG9wdGlvbnMuZW50aXR5VHlwZXMgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICBvZmZzZXRSYXk6IHhyUmF5XG4gICAgICAgICAgICAgICAgfSkudGhlbigoeHJIaXRUZXN0U291cmNlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uSGl0VGVzdFNvdXJjZSh4ckhpdFRlc3RTb3VyY2UsIGZhbHNlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhleCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbi5yZXF1ZXN0SGl0VGVzdFNvdXJjZUZvclRyYW5zaWVudElucHV0KHtcbiAgICAgICAgICAgICAgICBwcm9maWxlOiBvcHRpb25zLnByb2ZpbGUsXG4gICAgICAgICAgICAgICAgZW50aXR5VHlwZXM6IG9wdGlvbnMuZW50aXR5VHlwZXMgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIG9mZnNldFJheTogeHJSYXlcbiAgICAgICAgICAgIH0pLnRoZW4oKHhySGl0VGVzdFNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX29uSGl0VGVzdFNvdXJjZSh4ckhpdFRlc3RTb3VyY2UsIHRydWUsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7WFJIaXRUZXN0U291cmNlfSB4ckhpdFRlc3RTb3VyY2UgLSBIaXQgdGVzdCBzb3VyY2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB0cmFuc2llbnQgLSBUcnVlIGlmIGhpdCB0ZXN0IHNvdXJjZSBpcyBjcmVhdGVkIGZyb20gdHJhbnNpZW50IGlucHV0IHNvdXJjZS5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIENhbGxiYWNrIGNhbGxlZCBvbmNlIGhpdCB0ZXN0IHNvdXJjZSBpcyBjcmVhdGVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uSGl0VGVzdFNvdXJjZSh4ckhpdFRlc3RTb3VyY2UsIHRyYW5zaWVudCwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKSB7XG4gICAgICAgICAgICB4ckhpdFRlc3RTb3VyY2UuY2FuY2VsKCk7XG4gICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoJ1hSIFNlc3Npb24gaXMgbm90IHN0YXJ0ZWQgKDMpJyk7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGhpdFRlc3RTb3VyY2UgPSBuZXcgWHJIaXRUZXN0U291cmNlKHRoaXMubWFuYWdlciwgeHJIaXRUZXN0U291cmNlLCB0cmFuc2llbnQpO1xuICAgICAgICB0aGlzLnNvdXJjZXMucHVzaChoaXRUZXN0U291cmNlKTtcblxuICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKG51bGwsIGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGhpdFRlc3RTb3VyY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlc1tpXS51cGRhdGUoZnJhbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBBUiBIaXQgVGVzdCBpcyBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3VwcG9ydGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VwcG9ydGVkO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJIaXRUZXN0IH07XG4iXSwibmFtZXMiOlsiWHJIaXRUZXN0IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJtYW5hZ2VyIiwiX3N1cHBvcnRlZCIsInBsYXRmb3JtIiwiYnJvd3NlciIsIndpbmRvdyIsIlhSU2Vzc2lvbiIsInByb3RvdHlwZSIsInJlcXVlc3RIaXRUZXN0U291cmNlIiwiX3Nlc3Npb24iLCJzb3VyY2VzIiwib24iLCJfb25TZXNzaW9uU3RhcnQiLCJfb25TZXNzaW9uRW5kIiwidHlwZSIsIlhSVFlQRV9BUiIsInNlc3Npb24iLCJpIiwibGVuZ3RoIiwib25TdG9wIiwiaXNBdmFpbGFibGUiLCJjYWxsYmFjayIsImZpcmVFcnJvciIsImVyciIsIkVycm9yIiwiZmlyZSIsInN0YXJ0Iiwib3B0aW9ucyIsInByb2ZpbGUiLCJzcGFjZVR5cGUiLCJYUlNQQUNFX1ZJRVdFUiIsInhyUmF5Iiwib2Zmc2V0UmF5Iiwib3JpZ2luIiwiRE9NUG9pbnQiLCJ4IiwieSIsInoiLCJkaXJlY3Rpb24iLCJYUlJheSIsInJlcXVlc3RSZWZlcmVuY2VTcGFjZSIsInRoZW4iLCJyZWZlcmVuY2VTcGFjZSIsInNwYWNlIiwiZW50aXR5VHlwZXMiLCJ1bmRlZmluZWQiLCJ4ckhpdFRlc3RTb3VyY2UiLCJfb25IaXRUZXN0U291cmNlIiwiY2F0Y2giLCJleCIsInJlcXVlc3RIaXRUZXN0U291cmNlRm9yVHJhbnNpZW50SW5wdXQiLCJ0cmFuc2llbnQiLCJjYW5jZWwiLCJoaXRUZXN0U291cmNlIiwiWHJIaXRUZXN0U291cmNlIiwicHVzaCIsInVwZGF0ZSIsImZyYW1lIiwic3VwcG9ydGVkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxTQUFTLFNBQVNDLFlBQVksQ0FBQztBQUNqQztBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxPQUFPLEVBQUU7QUFDakIsSUFBQSxLQUFLLEVBQUUsQ0FBQTtBQUFDLElBQUEsSUFBQSxDQTVCWkEsT0FBTyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBTVBDLFVBQVUsR0FBR0MsUUFBUSxDQUFDQyxPQUFPLElBQUksQ0FBQyxFQUFFQyxNQUFNLENBQUNDLFNBQVMsSUFBSUQsTUFBTSxDQUFDQyxTQUFTLENBQUNDLFNBQVMsQ0FBQ0Msb0JBQW9CLENBQUMsQ0FBQTtJQUFBLElBTXhHQyxDQUFBQSxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFPZkMsQ0FBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQTtJQVdSLElBQUksQ0FBQ1QsT0FBTyxHQUFHQSxPQUFPLENBQUE7SUFFdEIsSUFBSSxJQUFJLENBQUNDLFVBQVUsRUFBRTtBQUNqQixNQUFBLElBQUksQ0FBQ0QsT0FBTyxDQUFDVSxFQUFFLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQ0MsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3BELE1BQUEsSUFBSSxDQUFDWCxPQUFPLENBQUNVLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDRSxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDcEQsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFSTtBQUNBRCxFQUFBQSxlQUFlQSxHQUFHO0FBQ2QsSUFBQSxJQUFJLElBQUksQ0FBQ1gsT0FBTyxDQUFDYSxJQUFJLEtBQUtDLFNBQVMsRUFDL0IsT0FBQTtBQUVKLElBQUEsSUFBSSxDQUFDTixRQUFRLEdBQUcsSUFBSSxDQUFDUixPQUFPLENBQUNlLE9BQU8sQ0FBQTtBQUN4QyxHQUFBOztBQUVBO0FBQ0FILEVBQUFBLGFBQWFBLEdBQUc7QUFDWixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNKLFFBQVEsRUFDZCxPQUFBO0lBRUosSUFBSSxDQUFDQSxRQUFRLEdBQUcsSUFBSSxDQUFBO0FBRXBCLElBQUEsS0FBSyxJQUFJUSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDUCxPQUFPLENBQUNRLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDMUMsTUFBQSxJQUFJLENBQUNQLE9BQU8sQ0FBQ08sQ0FBQyxDQUFDLENBQUNFLE1BQU0sRUFBRSxDQUFBO0FBQzVCLEtBQUE7SUFDQSxJQUFJLENBQUNULE9BQU8sR0FBRyxFQUFFLENBQUE7QUFDckIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lVLEVBQUFBLFdBQVdBLENBQUNDLFFBQVEsRUFBRUMsU0FBUyxFQUFFO0FBQzdCLElBQUEsSUFBSUMsR0FBRyxDQUFBO0lBRVAsSUFBSSxDQUFDLElBQUksQ0FBQ3JCLFVBQVUsRUFDaEJxQixHQUFHLEdBQUcsSUFBSUMsS0FBSyxDQUFDLDZCQUE2QixDQUFDLENBQUE7SUFFbEQsSUFBSSxDQUFDLElBQUksQ0FBQ2YsUUFBUSxFQUNkYyxHQUFHLEdBQUcsSUFBSUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUE7QUFFcEQsSUFBQSxJQUFJLElBQUksQ0FBQ3ZCLE9BQU8sQ0FBQ2EsSUFBSSxLQUFLQyxTQUFTLEVBQy9CUSxHQUFHLEdBQUcsSUFBSUMsS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUE7QUFFMUQsSUFBQSxJQUFJRCxHQUFHLEVBQUU7QUFDTCxNQUFBLElBQUlGLFFBQVEsRUFBRUEsUUFBUSxDQUFDRSxHQUFHLENBQUMsQ0FBQTtNQUMzQixJQUFJRCxTQUFTLEVBQUVBLFNBQVMsQ0FBQ0csSUFBSSxDQUFDLE9BQU8sRUFBRUYsR0FBRyxDQUFDLENBQUE7QUFDM0MsTUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixLQUFBO0FBRUEsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lHLEVBQUFBLEtBQUtBLENBQUNDLE9BQU8sR0FBRyxFQUFFLEVBQUU7SUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQ1AsV0FBVyxDQUFDTyxPQUFPLENBQUNOLFFBQVEsRUFBRSxJQUFJLENBQUMsRUFDekMsT0FBQTtBQUVKLElBQUEsSUFBSSxDQUFDTSxPQUFPLENBQUNDLE9BQU8sSUFBSSxDQUFDRCxPQUFPLENBQUNFLFNBQVMsRUFDdENGLE9BQU8sQ0FBQ0UsU0FBUyxHQUFHQyxjQUFjLENBQUE7QUFFdEMsSUFBQSxJQUFJQyxLQUFLLENBQUE7QUFDVCxJQUFBLE1BQU1DLFNBQVMsR0FBR0wsT0FBTyxDQUFDSyxTQUFTLENBQUE7QUFDbkMsSUFBQSxJQUFJQSxTQUFTLEVBQUU7TUFDWCxNQUFNQyxNQUFNLEdBQUcsSUFBSUMsUUFBUSxDQUFDRixTQUFTLENBQUNDLE1BQU0sQ0FBQ0UsQ0FBQyxFQUFFSCxTQUFTLENBQUNDLE1BQU0sQ0FBQ0csQ0FBQyxFQUFFSixTQUFTLENBQUNDLE1BQU0sQ0FBQ0ksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBO01BQzVGLE1BQU1DLFNBQVMsR0FBRyxJQUFJSixRQUFRLENBQUNGLFNBQVMsQ0FBQ00sU0FBUyxDQUFDSCxDQUFDLEVBQUVILFNBQVMsQ0FBQ00sU0FBUyxDQUFDRixDQUFDLEVBQUVKLFNBQVMsQ0FBQ00sU0FBUyxDQUFDRCxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7QUFDeEdOLE1BQUFBLEtBQUssR0FBRyxJQUFJUSxLQUFLLENBQUNOLE1BQU0sRUFBRUssU0FBUyxDQUFDLENBQUE7QUFDeEMsS0FBQTtBQUVBLElBQUEsTUFBTWpCLFFBQVEsR0FBR00sT0FBTyxDQUFDTixRQUFRLENBQUE7SUFFakMsSUFBSU0sT0FBTyxDQUFDRSxTQUFTLEVBQUU7QUFDbkIsTUFBQSxJQUFJLENBQUNwQixRQUFRLENBQUMrQixxQkFBcUIsQ0FBQ2IsT0FBTyxDQUFDRSxTQUFTLENBQUMsQ0FBQ1ksSUFBSSxDQUFFQyxjQUFjLElBQUs7QUFDNUUsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDakMsUUFBUSxFQUFFO0FBQ2hCLFVBQUEsTUFBTWMsR0FBRyxHQUFHLElBQUlDLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFBO0FBQ3RELFVBQUEsSUFBSUgsUUFBUSxFQUFFQSxRQUFRLENBQUNFLEdBQUcsQ0FBQyxDQUFBO0FBQzNCLFVBQUEsSUFBSSxDQUFDRSxJQUFJLENBQUMsT0FBTyxFQUFFRixHQUFHLENBQUMsQ0FBQTtBQUN2QixVQUFBLE9BQUE7QUFDSixTQUFBO0FBRUEsUUFBQSxJQUFJLENBQUNkLFFBQVEsQ0FBQ0Qsb0JBQW9CLENBQUM7QUFDL0JtQyxVQUFBQSxLQUFLLEVBQUVELGNBQWM7QUFDckJFLFVBQUFBLFdBQVcsRUFBRWpCLE9BQU8sQ0FBQ2lCLFdBQVcsSUFBSUMsU0FBUztBQUM3Q2IsVUFBQUEsU0FBUyxFQUFFRCxLQUFBQTtBQUNmLFNBQUMsQ0FBQyxDQUFDVSxJQUFJLENBQUVLLGVBQWUsSUFBSztVQUN6QixJQUFJLENBQUNDLGdCQUFnQixDQUFDRCxlQUFlLEVBQUUsS0FBSyxFQUFFekIsUUFBUSxDQUFDLENBQUE7QUFDM0QsU0FBQyxDQUFDLENBQUMyQixLQUFLLENBQUVDLEVBQUUsSUFBSztBQUNiLFVBQUEsSUFBSTVCLFFBQVEsRUFBRUEsUUFBUSxDQUFDNEIsRUFBRSxDQUFDLENBQUE7QUFDMUIsVUFBQSxJQUFJLENBQUN4QixJQUFJLENBQUMsT0FBTyxFQUFFd0IsRUFBRSxDQUFDLENBQUE7QUFDMUIsU0FBQyxDQUFDLENBQUE7QUFDTixPQUFDLENBQUMsQ0FBQ0QsS0FBSyxDQUFFQyxFQUFFLElBQUs7QUFDYixRQUFBLElBQUk1QixRQUFRLEVBQUVBLFFBQVEsQ0FBQzRCLEVBQUUsQ0FBQyxDQUFBO0FBQzFCLFFBQUEsSUFBSSxDQUFDeEIsSUFBSSxDQUFDLE9BQU8sRUFBRXdCLEVBQUUsQ0FBQyxDQUFBO0FBQzFCLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQyxNQUFNO0FBQ0gsTUFBQSxJQUFJLENBQUN4QyxRQUFRLENBQUN5QyxxQ0FBcUMsQ0FBQztRQUNoRHRCLE9BQU8sRUFBRUQsT0FBTyxDQUFDQyxPQUFPO0FBQ3hCZ0IsUUFBQUEsV0FBVyxFQUFFakIsT0FBTyxDQUFDaUIsV0FBVyxJQUFJQyxTQUFTO0FBQzdDYixRQUFBQSxTQUFTLEVBQUVELEtBQUFBO0FBQ2YsT0FBQyxDQUFDLENBQUNVLElBQUksQ0FBRUssZUFBZSxJQUFLO1FBQ3pCLElBQUksQ0FBQ0MsZ0JBQWdCLENBQUNELGVBQWUsRUFBRSxJQUFJLEVBQUV6QixRQUFRLENBQUMsQ0FBQTtBQUMxRCxPQUFDLENBQUMsQ0FBQzJCLEtBQUssQ0FBRUMsRUFBRSxJQUFLO0FBQ2IsUUFBQSxJQUFJNUIsUUFBUSxFQUFFQSxRQUFRLENBQUM0QixFQUFFLENBQUMsQ0FBQTtBQUMxQixRQUFBLElBQUksQ0FBQ3hCLElBQUksQ0FBQyxPQUFPLEVBQUV3QixFQUFFLENBQUMsQ0FBQTtBQUMxQixPQUFDLENBQUMsQ0FBQTtBQUNOLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJRixFQUFBQSxnQkFBZ0JBLENBQUNELGVBQWUsRUFBRUssU0FBUyxFQUFFOUIsUUFBUSxFQUFFO0FBQ25ELElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ1osUUFBUSxFQUFFO01BQ2hCcUMsZUFBZSxDQUFDTSxNQUFNLEVBQUUsQ0FBQTtBQUN4QixNQUFBLE1BQU03QixHQUFHLEdBQUcsSUFBSUMsS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUE7QUFDdEQsTUFBQSxJQUFJSCxRQUFRLEVBQUVBLFFBQVEsQ0FBQ0UsR0FBRyxDQUFDLENBQUE7QUFDM0IsTUFBQSxJQUFJLENBQUNFLElBQUksQ0FBQyxPQUFPLEVBQUVGLEdBQUcsQ0FBQyxDQUFBO0FBQ3ZCLE1BQUEsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLE1BQU04QixhQUFhLEdBQUcsSUFBSUMsZUFBZSxDQUFDLElBQUksQ0FBQ3JELE9BQU8sRUFBRTZDLGVBQWUsRUFBRUssU0FBUyxDQUFDLENBQUE7QUFDbkYsSUFBQSxJQUFJLENBQUN6QyxPQUFPLENBQUM2QyxJQUFJLENBQUNGLGFBQWEsQ0FBQyxDQUFBO0FBRWhDLElBQUEsSUFBSWhDLFFBQVEsRUFBRUEsUUFBUSxDQUFDLElBQUksRUFBRWdDLGFBQWEsQ0FBQyxDQUFBO0FBQzNDLElBQUEsSUFBSSxDQUFDNUIsSUFBSSxDQUFDLEtBQUssRUFBRTRCLGFBQWEsQ0FBQyxDQUFBO0FBQ25DLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7RUFDSUcsTUFBTUEsQ0FBQ0MsS0FBSyxFQUFFO0FBQ1YsSUFBQSxLQUFLLElBQUl4QyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDUCxPQUFPLENBQUNRLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7TUFDMUMsSUFBSSxDQUFDUCxPQUFPLENBQUNPLENBQUMsQ0FBQyxDQUFDdUMsTUFBTSxDQUFDQyxLQUFLLENBQUMsQ0FBQTtBQUNqQyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsU0FBU0EsR0FBRztJQUNaLE9BQU8sSUFBSSxDQUFDeEQsVUFBVSxDQUFBO0FBQzFCLEdBQUE7QUFDSjs7OzsifQ==
