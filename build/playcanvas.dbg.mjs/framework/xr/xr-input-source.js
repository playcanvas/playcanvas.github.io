/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../core/event-handler.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Ray } from '../../core/shape/ray.js';
import { XrHand } from './xr-hand.js';

const quat = new Quat();
let ids = 0;

/**
 * Represents XR input source, which is any input mechanism which allows the user to perform
 * targeted actions in the same virtual space as the viewer. Example XR input sources include, but
 * are not limited to, handheld controllers, optically tracked hands, and gaze-based input methods
 * that operate on the viewer's pose.
 *
 * @augments EventHandler
 */
class XrInputSource extends EventHandler {
  /**
   * @type {number}
   * @private
   */

  /**
   * @type {import('./xr-manager.js').XrManager}
   * @private
   */

  /**
   * @type {XRInputSource}
   * @private
   */

  /**
   * @type {Ray}
   * @private
   */

  /**
   * @type {Ray}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {XrHand}
   * @private
   */

  /**
   * @type {Mat4|null}
   * @private
   */

  /**
   * @type {Mat4|null}
   * @private
   */

  /**
   * @type {Vec3}
   * @private
   */

  /**
   * @type {Quat}
   * @private
   */

  /**
   * @type {Mat4|null}
   * @private
   */

  /**
   * @type {Mat4|null}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {import('../entity.js').Entity|null}
   * @private
   */

  /**
   * @type {import('./xr-hit-test-source.js').XrHitTestSource[]}
   * @private
   */

  /**
   * Create a new XrInputSource instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @param {*} xrInputSource - [XRInputSource](https://developer.mozilla.org/en-US/docs/Web/API/XRInputSource)
   * object that is created by WebXR API.
   * @hideconstructor
   */
  constructor(manager, xrInputSource) {
    super();
    this._id = void 0;
    this._manager = void 0;
    this._xrInputSource = void 0;
    this._ray = new Ray();
    this._rayLocal = new Ray();
    this._grip = false;
    this._hand = null;
    this._localTransform = null;
    this._worldTransform = null;
    this._position = new Vec3();
    this._rotation = new Quat();
    this._localPosition = null;
    this._localRotation = null;
    this._dirtyLocal = true;
    this._dirtyRay = false;
    this._selecting = false;
    this._squeezing = false;
    this._elementInput = true;
    this._elementEntity = null;
    this._hitTestSources = [];
    this._id = ++ids;
    this._manager = manager;
    this._xrInputSource = xrInputSource;
    if (xrInputSource.hand) this._hand = new XrHand(this);
  }

  /**
   * Fired when {@link XrInputSource} is removed.
   *
   * @event XrInputSource#remove
   * @example
   * inputSource.once('remove', function () {
   *     // input source is not available anymore
   * });
   */

  /**
   * Fired when input source has triggered primary action. This could be pressing a trigger
   * button, or touching a screen.
   *
   * @event XrInputSource#select
   * @param {object} evt - XRInputSourceEvent event data from WebXR API.
   * @example
   * var ray = new pc.Ray();
   * inputSource.on('select', function (evt) {
   *     ray.set(inputSource.getOrigin(), inputSource.getDirection());
   *     if (obj.intersectsRay(ray)) {
   *         // selected an object with input source
   *     }
   * });
   */

  /**
   * Fired when input source has started to trigger primary action.
   *
   * @event XrInputSource#selectstart
   * @param {object} evt - XRInputSourceEvent event data from WebXR API.
   */

  /**
   * Fired when input source has ended triggering primary action.
   *
   * @event XrInputSource#selectend
   * @param {object} evt - XRInputSourceEvent event data from WebXR API.
   */

  /**
   * Fired when input source has triggered squeeze action. This is associated with "grabbing"
   * action on the controllers.
   *
   * @event XrInputSource#squeeze
   * @param {object} evt - XRInputSourceEvent event data from WebXR API.
   */

  /**
   * Fired when input source has started to trigger squeeze action.
   *
   * @event XrInputSource#squeezestart
   * @param {object} evt - XRInputSourceEvent event data from WebXR API.
   * @example
   * inputSource.on('squeezestart', function (evt) {
   *     if (obj.containsPoint(inputSource.getPosition())) {
   *         // grabbed an object
   *     }
   * });
   */

  /**
   * Fired when input source has ended triggering squeeze action.
   *
   * @event XrInputSource#squeezeend
   * @param {object} evt - XRInputSourceEvent event data from WebXR API.
   */

  /**
   * Fired when new {@link XrHitTestSource} is added to the input source.
   *
   * @event XrInputSource#hittest:add
   * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
   * that has been added.
   * @example
   * inputSource.on('hittest:add', function (hitTestSource) {
   *     // new hit test source is added
   * });
   */

  /**
   * Fired when {@link XrHitTestSource} is removed to the the input source.
   *
   * @event XrInputSource#hittest:remove
   * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
   * that has been removed.
   * @example
   * inputSource.on('remove', function (hitTestSource) {
   *     // hit test source is removed
   * });
   */

  /**
   * Fired when hit test source receives new results. It provides transform information that
   * tries to match real world picked geometry.
   *
   * @event XrInputSource#hittest:result
   * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
   * that produced the hit result.
   * @param {Vec3} position - Position of hit test.
   * @param {Quat} rotation - Rotation of hit test.
   * @example
   * inputSource.on('hittest:result', function (hitTestSource, position, rotation) {
   *     target.setPosition(position);
   *     target.setRotation(rotation);
   * });
   */

  /**
   * Unique number associated with instance of input source. Same physical devices when
   * reconnected will not share this ID.
   *
   * @type {number}
   */
  get id() {
    return this._id;
  }

  /**
   * XRInputSource object that is associated with this input source.
   *
   * @type {object}
   */
  get inputSource() {
    return this._xrInputSource;
  }

  /**
   * Type of ray Input Device is based on. Can be one of the following:
   *
   * - {@link XRTARGETRAY_GAZE}: Gaze - indicates the target ray will originate at the viewer and
   * follow the direction it is facing. This is commonly referred to as a "gaze input" device in
   * the context of head-mounted displays.
   * - {@link XRTARGETRAY_SCREEN}: Screen - indicates that the input source was an interaction
   * with the canvas element associated with an inline session's output context, such as a mouse
   * click or touch event.
   * - {@link XRTARGETRAY_POINTER}: Tracked Pointer - indicates that the target ray originates
   * from either a handheld device or other hand-tracking mechanism and represents that the user
   * is using their hands or the held device for pointing.
   *
   * @type {string}
   */
  get targetRayMode() {
    return this._xrInputSource.targetRayMode;
  }

  /**
   * Describes which hand input source is associated with. Can be one of the following:
   *
   * - {@link XRHAND_NONE}: None - input source is not meant to be held in hands.
   * - {@link XRHAND_LEFT}: Left - indicates that input source is meant to be held in left hand.
   * - {@link XRHAND_RIGHT}: Right - indicates that input source is meant to be held in right
   * hand.
   *
   * @type {string}
   */
  get handedness() {
    return this._xrInputSource.handedness;
  }

  /**
   * List of input profile names indicating both the preferred visual representation and behavior
   * of the input source.
   *
   * @type {string[]}
   */
  get profiles() {
    return this._xrInputSource.profiles;
  }

  /**
   * If input source can be held, then it will have node with its world transformation, that can
   * be used to position and rotate virtual joysticks based on it.
   *
   * @type {boolean}
   */
  get grip() {
    return this._grip;
  }

  /**
   * If input source is a tracked hand, then it will point to {@link XrHand} otherwise it is
   * null.
   *
   * @type {XrHand|null}
   */
  get hand() {
    return this._hand;
  }

  /**
   * If input source has buttons, triggers, thumbstick or touchpad, then this object provides
   * access to its states.
   *
   * @type {Gamepad|null}
   */
  get gamepad() {
    return this._xrInputSource.gamepad || null;
  }

  /**
   * True if input source is in active primary action between selectstart and selectend events.
   *
   * @type {boolean}
   */
  get selecting() {
    return this._selecting;
  }

  /**
   * True if input source is in active squeeze action between squeezestart and squeezeend events.
   *
   * @type {boolean}
   */
  get squeezing() {
    return this._squeezing;
  }

  /**
   * Set to true to allow input source to interact with Element components. Defaults to true.
   *
   * @type {boolean}
   */
  set elementInput(value) {
    if (this._elementInput === value) return;
    this._elementInput = value;
    if (!this._elementInput) this._elementEntity = null;
  }
  get elementInput() {
    return this._elementInput;
  }

  /**
   * If {@link XrInputSource#elementInput} is true, this property will hold entity with Element
   * component at which this input source is hovering, or null if not hovering over any element.
   *
   * @type {import('../entity.js').Entity|null}
   */
  get elementEntity() {
    return this._elementEntity;
  }

  /**
   * List of active {@link XrHitTestSource} instances created by this input source.
   *
   * @type {import('./xr-hit-test-source.js').XrHitTestSource[]}
   */
  get hitTestSources() {
    return this._hitTestSources;
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    // hand
    if (this._hand) {
      this._hand.update(frame);
    } else {
      // grip
      if (this._xrInputSource.gripSpace) {
        const gripPose = frame.getPose(this._xrInputSource.gripSpace, this._manager._referenceSpace);
        if (gripPose) {
          if (!this._grip) {
            this._grip = true;
            this._localTransform = new Mat4();
            this._worldTransform = new Mat4();
            this._localPosition = new Vec3();
            this._localRotation = new Quat();
          }
          this._dirtyLocal = true;
          this._localPosition.copy(gripPose.transform.position);
          this._localRotation.copy(gripPose.transform.orientation);
        }
      }

      // ray
      const targetRayPose = frame.getPose(this._xrInputSource.targetRaySpace, this._manager._referenceSpace);
      if (targetRayPose) {
        this._dirtyRay = true;
        this._rayLocal.origin.copy(targetRayPose.transform.position);
        this._rayLocal.direction.set(0, 0, -1);
        quat.copy(targetRayPose.transform.orientation);
        quat.transformVector(this._rayLocal.direction, this._rayLocal.direction);
      }
    }
  }

  /** @private */
  _updateTransforms() {
    if (this._dirtyLocal) {
      this._dirtyLocal = false;
      this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
    }
    const parent = this._manager.camera.parent;
    if (parent) {
      this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
    } else {
      this._worldTransform.copy(this._localTransform);
    }
  }

  /** @private */
  _updateRayTransforms() {
    const dirty = this._dirtyRay;
    this._dirtyRay = false;
    const parent = this._manager.camera.parent;
    if (parent) {
      const parentTransform = this._manager.camera.parent.getWorldTransform();
      parentTransform.getTranslation(this._position);
      this._rotation.setFromMat4(parentTransform);
      this._rotation.transformVector(this._rayLocal.origin, this._ray.origin);
      this._ray.origin.add(this._position);
      this._rotation.transformVector(this._rayLocal.direction, this._ray.direction);
    } else if (dirty) {
      this._ray.origin.copy(this._rayLocal.origin);
      this._ray.direction.copy(this._rayLocal.direction);
    }
  }

  /**
   * Get the world space position of input source if it is handheld ({@link XrInputSource#grip}
   * is true). Otherwise it will return null.
   *
   * @returns {Vec3|null} The world space position of handheld input source.
   */
  getPosition() {
    if (!this._position) return null;
    this._updateTransforms();
    this._worldTransform.getTranslation(this._position);
    return this._position;
  }

  /**
   * Get the local space position of input source if it is handheld ({@link XrInputSource#grip}
   * is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
   *
   * @returns {Vec3|null} The world space position of handheld input source.
   */
  getLocalPosition() {
    return this._localPosition;
  }

  /**
   * Get the world space rotation of input source if it is handheld ({@link XrInputSource#grip}
   * is true). Otherwise it will return null.
   *
   * @returns {Quat|null} The world space rotation of handheld input source.
   */
  getRotation() {
    if (!this._rotation) return null;
    this._updateTransforms();
    this._rotation.setFromMat4(this._worldTransform);
    return this._rotation;
  }

  /**
   * Get the local space rotation of input source if it is handheld ({@link XrInputSource#grip}
   * is true). Local space is relative to parent of the XR camera. Otherwise it will return null.
   *
   * @returns {Vec3|null} The world space rotation of handheld input source.
   */
  getLocalRotation() {
    return this._localRotation;
  }

  /**
   * Get the world space origin of input source ray.
   *
   * @returns {Vec3} The world space origin of input source ray.
   */
  getOrigin() {
    this._updateRayTransforms();
    return this._ray.origin;
  }

  /**
   * Get the world space direction of input source ray.
   *
   * @returns {Vec3} The world space direction of input source ray.
   */
  getDirection() {
    this._updateRayTransforms();
    return this._ray.direction;
  }

  /**
   * Attempts to start hit test source based on this input source.
   *
   * @param {object} [options] - Object for passing optional arguments.
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
   * @param {Ray} [options.offsetRay] - Optional ray by which hit test ray can be offset.
   * @param {import('./xr-hit-test.js').XrHitTestStartCallback} [options.callback] - Optional
   * callback function called once hit test source is created or failed.
   * @example
   * app.xr.input.on('add', function (inputSource) {
   *     inputSource.hitTestStart({
   *         callback: function (err, hitTestSource) {
   *             if (err) return;
   *             hitTestSource.on('result', function (position, rotation) {
   *                 // position and rotation of hit test result
   *                 // that will be created from touch on mobile devices
   *             });
   *         }
   *     });
   * });
   */
  hitTestStart(options = {}) {
    options.profile = this._xrInputSource.profiles[0];
    const callback = options.callback;
    options.callback = (err, hitTestSource) => {
      if (hitTestSource) this.onHitTestSourceAdd(hitTestSource);
      if (callback) callback(err, hitTestSource);
    };
    this._manager.hitTest.start(options);
  }

  /**
   * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
   * to be added.
   * @private
   */
  onHitTestSourceAdd(hitTestSource) {
    this._hitTestSources.push(hitTestSource);
    this.fire('hittest:add', hitTestSource);
    hitTestSource.on('result', function (position, rotation, inputSource) {
      if (inputSource !== this) return;
      this.fire('hittest:result', hitTestSource, position, rotation);
    }, this);
    hitTestSource.once('remove', function () {
      this.onHitTestSourceRemove(hitTestSource);
      this.fire('hittest:remove', hitTestSource);
    }, this);
  }

  /**
   * @param {import('./xr-hit-test-source.js').XrHitTestSource} hitTestSource - Hit test source
   * to be removed.
   * @private
   */
  onHitTestSourceRemove(hitTestSource) {
    const ind = this._hitTestSources.indexOf(hitTestSource);
    if (ind !== -1) this._hitTestSources.splice(ind, 1);
  }
}

export { XrInputSource };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItaW5wdXQtc291cmNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3hyL3hyLWlucHV0LXNvdXJjZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgUmF5IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9yYXkuanMnO1xuXG5pbXBvcnQgeyBYckhhbmQgfSBmcm9tICcuL3hyLWhhbmQuanMnO1xuXG5jb25zdCBxdWF0ID0gbmV3IFF1YXQoKTtcbmxldCBpZHMgPSAwO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgWFIgaW5wdXQgc291cmNlLCB3aGljaCBpcyBhbnkgaW5wdXQgbWVjaGFuaXNtIHdoaWNoIGFsbG93cyB0aGUgdXNlciB0byBwZXJmb3JtXG4gKiB0YXJnZXRlZCBhY3Rpb25zIGluIHRoZSBzYW1lIHZpcnR1YWwgc3BhY2UgYXMgdGhlIHZpZXdlci4gRXhhbXBsZSBYUiBpbnB1dCBzb3VyY2VzIGluY2x1ZGUsIGJ1dFxuICogYXJlIG5vdCBsaW1pdGVkIHRvLCBoYW5kaGVsZCBjb250cm9sbGVycywgb3B0aWNhbGx5IHRyYWNrZWQgaGFuZHMsIGFuZCBnYXplLWJhc2VkIGlucHV0IG1ldGhvZHNcbiAqIHRoYXQgb3BlcmF0ZSBvbiB0aGUgdmlld2VyJ3MgcG9zZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFhySW5wdXRTb3VyY2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaWQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWFuYWdlcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUklucHV0U291cmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3hySW5wdXRTb3VyY2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmF5fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JheSA9IG5ldyBSYXkoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmF5TG9jYWwgPSBuZXcgUmF5KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ncmlwID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WHJIYW5kfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhbmQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFRyYW5zZm9ybSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dvcmxkVHJhbnNmb3JtID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Bvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9jYWxQb3NpdGlvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUm90YXRpb24gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGlydHlMb2NhbCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eVJheSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2VsZWN0aW5nID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zcXVlZXppbmcgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VsZW1lbnRJbnB1dCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbGVtZW50RW50aXR5ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItaGl0LXRlc3Qtc291cmNlLmpzJykuWHJIaXRUZXN0U291cmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGl0VGVzdFNvdXJjZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYcklucHV0U291cmNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gbWFuYWdlciAtIFdlYlhSIE1hbmFnZXIuXG4gICAgICogQHBhcmFtIHsqfSB4cklucHV0U291cmNlIC0gW1hSSW5wdXRTb3VyY2VdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9YUklucHV0U291cmNlKVxuICAgICAqIG9iamVjdCB0aGF0IGlzIGNyZWF0ZWQgYnkgV2ViWFIgQVBJLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyLCB4cklucHV0U291cmNlKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5faWQgPSArK2lkcztcblxuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcbiAgICAgICAgdGhpcy5feHJJbnB1dFNvdXJjZSA9IHhySW5wdXRTb3VyY2U7XG5cbiAgICAgICAgaWYgKHhySW5wdXRTb3VyY2UuaGFuZClcbiAgICAgICAgICAgIHRoaXMuX2hhbmQgPSBuZXcgWHJIYW5kKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4ge0BsaW5rIFhySW5wdXRTb3VyY2V9IGlzIHJlbW92ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNyZW1vdmVcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uY2UoJ3JlbW92ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gaW5wdXQgc291cmNlIGlzIG5vdCBhdmFpbGFibGUgYW55bW9yZVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbnB1dCBzb3VyY2UgaGFzIHRyaWdnZXJlZCBwcmltYXJ5IGFjdGlvbi4gVGhpcyBjb3VsZCBiZSBwcmVzc2luZyBhIHRyaWdnZXJcbiAgICAgKiBidXR0b24sIG9yIHRvdWNoaW5nIGEgc2NyZWVuLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySW5wdXRTb3VyY2Ujc2VsZWN0XG4gICAgICogQHBhcmFtIHtvYmplY3R9IGV2dCAtIFhSSW5wdXRTb3VyY2VFdmVudCBldmVudCBkYXRhIGZyb20gV2ViWFIgQVBJLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHJheSA9IG5ldyBwYy5SYXkoKTtcbiAgICAgKiBpbnB1dFNvdXJjZS5vbignc2VsZWN0JywgZnVuY3Rpb24gKGV2dCkge1xuICAgICAqICAgICByYXkuc2V0KGlucHV0U291cmNlLmdldE9yaWdpbigpLCBpbnB1dFNvdXJjZS5nZXREaXJlY3Rpb24oKSk7XG4gICAgICogICAgIGlmIChvYmouaW50ZXJzZWN0c1JheShyYXkpKSB7XG4gICAgICogICAgICAgICAvLyBzZWxlY3RlZCBhbiBvYmplY3Qgd2l0aCBpbnB1dCBzb3VyY2VcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbnB1dCBzb3VyY2UgaGFzIHN0YXJ0ZWQgdG8gdHJpZ2dlciBwcmltYXJ5IGFjdGlvbi5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0U291cmNlI3NlbGVjdHN0YXJ0XG4gICAgICogQHBhcmFtIHtvYmplY3R9IGV2dCAtIFhSSW5wdXRTb3VyY2VFdmVudCBldmVudCBkYXRhIGZyb20gV2ViWFIgQVBJLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbnB1dCBzb3VyY2UgaGFzIGVuZGVkIHRyaWdnZXJpbmcgcHJpbWFyeSBhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNzZWxlY3RlbmRcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZ0IC0gWFJJbnB1dFNvdXJjZUV2ZW50IGV2ZW50IGRhdGEgZnJvbSBXZWJYUiBBUEkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGlucHV0IHNvdXJjZSBoYXMgdHJpZ2dlcmVkIHNxdWVlemUgYWN0aW9uLiBUaGlzIGlzIGFzc29jaWF0ZWQgd2l0aCBcImdyYWJiaW5nXCJcbiAgICAgKiBhY3Rpb24gb24gdGhlIGNvbnRyb2xsZXJzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySW5wdXRTb3VyY2Ujc3F1ZWV6ZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldnQgLSBYUklucHV0U291cmNlRXZlbnQgZXZlbnQgZGF0YSBmcm9tIFdlYlhSIEFQSS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaW5wdXQgc291cmNlIGhhcyBzdGFydGVkIHRvIHRyaWdnZXIgc3F1ZWV6ZSBhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNzcXVlZXplc3RhcnRcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZ0IC0gWFJJbnB1dFNvdXJjZUV2ZW50IGV2ZW50IGRhdGEgZnJvbSBXZWJYUiBBUEkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpbnB1dFNvdXJjZS5vbignc3F1ZWV6ZXN0YXJ0JywgZnVuY3Rpb24gKGV2dCkge1xuICAgICAqICAgICBpZiAob2JqLmNvbnRhaW5zUG9pbnQoaW5wdXRTb3VyY2UuZ2V0UG9zaXRpb24oKSkpIHtcbiAgICAgKiAgICAgICAgIC8vIGdyYWJiZWQgYW4gb2JqZWN0XG4gICAgICogICAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaW5wdXQgc291cmNlIGhhcyBlbmRlZCB0cmlnZ2VyaW5nIHNxdWVlemUgYWN0aW9uLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySW5wdXRTb3VyY2Ujc3F1ZWV6ZWVuZFxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldnQgLSBYUklucHV0U291cmNlRXZlbnQgZXZlbnQgZGF0YSBmcm9tIFdlYlhSIEFQSS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gbmV3IHtAbGluayBYckhpdFRlc3RTb3VyY2V9IGlzIGFkZGVkIHRvIHRoZSBpbnB1dCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNoaXR0ZXN0OmFkZFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcycpLlhySGl0VGVzdFNvdXJjZX0gaGl0VGVzdFNvdXJjZSAtIEhpdCB0ZXN0IHNvdXJjZVxuICAgICAqIHRoYXQgaGFzIGJlZW4gYWRkZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpbnB1dFNvdXJjZS5vbignaGl0dGVzdDphZGQnLCBmdW5jdGlvbiAoaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAvLyBuZXcgaGl0IHRlc3Qgc291cmNlIGlzIGFkZGVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHtAbGluayBYckhpdFRlc3RTb3VyY2V9IGlzIHJlbW92ZWQgdG8gdGhlIHRoZSBpbnB1dCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNoaXR0ZXN0OnJlbW92ZVxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcycpLlhySGl0VGVzdFNvdXJjZX0gaGl0VGVzdFNvdXJjZSAtIEhpdCB0ZXN0IHNvdXJjZVxuICAgICAqIHRoYXQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uKCdyZW1vdmUnLCBmdW5jdGlvbiAoaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAvLyBoaXQgdGVzdCBzb3VyY2UgaXMgcmVtb3ZlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBoaXQgdGVzdCBzb3VyY2UgcmVjZWl2ZXMgbmV3IHJlc3VsdHMuIEl0IHByb3ZpZGVzIHRyYW5zZm9ybSBpbmZvcm1hdGlvbiB0aGF0XG4gICAgICogdHJpZXMgdG8gbWF0Y2ggcmVhbCB3b3JsZCBwaWNrZWQgZ2VvbWV0cnkuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNoaXR0ZXN0OnJlc3VsdFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcycpLlhySGl0VGVzdFNvdXJjZX0gaGl0VGVzdFNvdXJjZSAtIEhpdCB0ZXN0IHNvdXJjZVxuICAgICAqIHRoYXQgcHJvZHVjZWQgdGhlIGhpdCByZXN1bHQuXG4gICAgICogQHBhcmFtIHtWZWMzfSBwb3NpdGlvbiAtIFBvc2l0aW9uIG9mIGhpdCB0ZXN0LlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcm90YXRpb24gLSBSb3RhdGlvbiBvZiBoaXQgdGVzdC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uKCdoaXR0ZXN0OnJlc3VsdCcsIGZ1bmN0aW9uIChoaXRUZXN0U291cmNlLCBwb3NpdGlvbiwgcm90YXRpb24pIHtcbiAgICAgKiAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKiAgICAgdGFyZ2V0LnNldFJvdGF0aW9uKHJvdGF0aW9uKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIFVuaXF1ZSBudW1iZXIgYXNzb2NpYXRlZCB3aXRoIGluc3RhbmNlIG9mIGlucHV0IHNvdXJjZS4gU2FtZSBwaHlzaWNhbCBkZXZpY2VzIHdoZW5cbiAgICAgKiByZWNvbm5lY3RlZCB3aWxsIG5vdCBzaGFyZSB0aGlzIElELlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBYUklucHV0U291cmNlIG9iamVjdCB0aGF0IGlzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGlucHV0IHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICovXG4gICAgZ2V0IGlucHV0U291cmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5feHJJbnB1dFNvdXJjZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUeXBlIG9mIHJheSBJbnB1dCBEZXZpY2UgaXMgYmFzZWQgb24uIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVEFSR0VUUkFZX0dBWkV9OiBHYXplIC0gaW5kaWNhdGVzIHRoZSB0YXJnZXQgcmF5IHdpbGwgb3JpZ2luYXRlIGF0IHRoZSB2aWV3ZXIgYW5kXG4gICAgICogZm9sbG93IHRoZSBkaXJlY3Rpb24gaXQgaXMgZmFjaW5nLiBUaGlzIGlzIGNvbW1vbmx5IHJlZmVycmVkIHRvIGFzIGEgXCJnYXplIGlucHV0XCIgZGV2aWNlIGluXG4gICAgICogdGhlIGNvbnRleHQgb2YgaGVhZC1tb3VudGVkIGRpc3BsYXlzLlxuICAgICAqIC0ge0BsaW5rIFhSVEFSR0VUUkFZX1NDUkVFTn06IFNjcmVlbiAtIGluZGljYXRlcyB0aGF0IHRoZSBpbnB1dCBzb3VyY2Ugd2FzIGFuIGludGVyYWN0aW9uXG4gICAgICogd2l0aCB0aGUgY2FudmFzIGVsZW1lbnQgYXNzb2NpYXRlZCB3aXRoIGFuIGlubGluZSBzZXNzaW9uJ3Mgb3V0cHV0IGNvbnRleHQsIHN1Y2ggYXMgYSBtb3VzZVxuICAgICAqIGNsaWNrIG9yIHRvdWNoIGV2ZW50LlxuICAgICAqIC0ge0BsaW5rIFhSVEFSR0VUUkFZX1BPSU5URVJ9OiBUcmFja2VkIFBvaW50ZXIgLSBpbmRpY2F0ZXMgdGhhdCB0aGUgdGFyZ2V0IHJheSBvcmlnaW5hdGVzXG4gICAgICogZnJvbSBlaXRoZXIgYSBoYW5kaGVsZCBkZXZpY2Ugb3Igb3RoZXIgaGFuZC10cmFja2luZyBtZWNoYW5pc20gYW5kIHJlcHJlc2VudHMgdGhhdCB0aGUgdXNlclxuICAgICAqIGlzIHVzaW5nIHRoZWlyIGhhbmRzIG9yIHRoZSBoZWxkIGRldmljZSBmb3IgcG9pbnRpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCB0YXJnZXRSYXlNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5feHJJbnB1dFNvdXJjZS50YXJnZXRSYXlNb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc2NyaWJlcyB3aGljaCBoYW5kIGlucHV0IHNvdXJjZSBpcyBhc3NvY2lhdGVkIHdpdGguIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSSEFORF9OT05FfTogTm9uZSAtIGlucHV0IHNvdXJjZSBpcyBub3QgbWVhbnQgdG8gYmUgaGVsZCBpbiBoYW5kcy5cbiAgICAgKiAtIHtAbGluayBYUkhBTkRfTEVGVH06IExlZnQgLSBpbmRpY2F0ZXMgdGhhdCBpbnB1dCBzb3VyY2UgaXMgbWVhbnQgdG8gYmUgaGVsZCBpbiBsZWZ0IGhhbmQuXG4gICAgICogLSB7QGxpbmsgWFJIQU5EX1JJR0hUfTogUmlnaHQgLSBpbmRpY2F0ZXMgdGhhdCBpbnB1dCBzb3VyY2UgaXMgbWVhbnQgdG8gYmUgaGVsZCBpbiByaWdodFxuICAgICAqIGhhbmQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBoYW5kZWRuZXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5feHJJbnB1dFNvdXJjZS5oYW5kZWRuZXNzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpc3Qgb2YgaW5wdXQgcHJvZmlsZSBuYW1lcyBpbmRpY2F0aW5nIGJvdGggdGhlIHByZWZlcnJlZCB2aXN1YWwgcmVwcmVzZW50YXRpb24gYW5kIGJlaGF2aW9yXG4gICAgICogb2YgdGhlIGlucHV0IHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmdbXX1cbiAgICAgKi9cbiAgICBnZXQgcHJvZmlsZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cklucHV0U291cmNlLnByb2ZpbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIGlucHV0IHNvdXJjZSBjYW4gYmUgaGVsZCwgdGhlbiBpdCB3aWxsIGhhdmUgbm9kZSB3aXRoIGl0cyB3b3JsZCB0cmFuc2Zvcm1hdGlvbiwgdGhhdCBjYW5cbiAgICAgKiBiZSB1c2VkIHRvIHBvc2l0aW9uIGFuZCByb3RhdGUgdmlydHVhbCBqb3lzdGlja3MgYmFzZWQgb24gaXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgZ3JpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dyaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgaW5wdXQgc291cmNlIGlzIGEgdHJhY2tlZCBoYW5kLCB0aGVuIGl0IHdpbGwgcG9pbnQgdG8ge0BsaW5rIFhySGFuZH0gb3RoZXJ3aXNlIGl0IGlzXG4gICAgICogbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhhbmR8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgaGFuZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hhbmQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgaW5wdXQgc291cmNlIGhhcyBidXR0b25zLCB0cmlnZ2VycywgdGh1bWJzdGljayBvciB0b3VjaHBhZCwgdGhlbiB0aGlzIG9iamVjdCBwcm92aWRlc1xuICAgICAqIGFjY2VzcyB0byBpdHMgc3RhdGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge0dhbWVwYWR8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgZ2FtZXBhZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hySW5wdXRTb3VyY2UuZ2FtZXBhZCB8fCBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgaW5wdXQgc291cmNlIGlzIGluIGFjdGl2ZSBwcmltYXJ5IGFjdGlvbiBiZXR3ZWVuIHNlbGVjdHN0YXJ0IGFuZCBzZWxlY3RlbmQgZXZlbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHNlbGVjdGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NlbGVjdGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIGlucHV0IHNvdXJjZSBpcyBpbiBhY3RpdmUgc3F1ZWV6ZSBhY3Rpb24gYmV0d2VlbiBzcXVlZXplc3RhcnQgYW5kIHNxdWVlemVlbmQgZXZlbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHNxdWVlemluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NxdWVlemluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdG8gdHJ1ZSB0byBhbGxvdyBpbnB1dCBzb3VyY2UgdG8gaW50ZXJhY3Qgd2l0aCBFbGVtZW50IGNvbXBvbmVudHMuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZWxlbWVudElucHV0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50SW5wdXQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2VsZW1lbnRJbnB1dCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5fZWxlbWVudElucHV0KVxuICAgICAgICAgICAgdGhpcy5fZWxlbWVudEVudGl0eSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IGVsZW1lbnRJbnB1dCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VsZW1lbnRJbnB1dDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB7QGxpbmsgWHJJbnB1dFNvdXJjZSNlbGVtZW50SW5wdXR9IGlzIHRydWUsIHRoaXMgcHJvcGVydHkgd2lsbCBob2xkIGVudGl0eSB3aXRoIEVsZW1lbnRcbiAgICAgKiBjb21wb25lbnQgYXQgd2hpY2ggdGhpcyBpbnB1dCBzb3VyY2UgaXMgaG92ZXJpbmcsIG9yIG51bGwgaWYgbm90IGhvdmVyaW5nIG92ZXIgYW55IGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgZWxlbWVudEVudGl0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VsZW1lbnRFbnRpdHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBhY3RpdmUge0BsaW5rIFhySGl0VGVzdFNvdXJjZX0gaW5zdGFuY2VzIGNyZWF0ZWQgYnkgdGhpcyBpbnB1dCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcycpLlhySGl0VGVzdFNvdXJjZVtdfVxuICAgICAqL1xuICAgIGdldCBoaXRUZXN0U291cmNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hpdFRlc3RTb3VyY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgLy8gaGFuZFxuICAgICAgICBpZiAodGhpcy5faGFuZCkge1xuICAgICAgICAgICAgdGhpcy5faGFuZC51cGRhdGUoZnJhbWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZ3JpcFxuICAgICAgICAgICAgaWYgKHRoaXMuX3hySW5wdXRTb3VyY2UuZ3JpcFNwYWNlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ3JpcFBvc2UgPSBmcmFtZS5nZXRQb3NlKHRoaXMuX3hySW5wdXRTb3VyY2UuZ3JpcFNwYWNlLCB0aGlzLl9tYW5hZ2VyLl9yZWZlcmVuY2VTcGFjZSk7XG4gICAgICAgICAgICAgICAgaWYgKGdyaXBQb3NlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fZ3JpcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ3JpcCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvY2FsVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3dvcmxkVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9jYWxQb3NpdGlvbiA9IG5ldyBWZWMzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2NhbFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUxvY2FsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9jYWxQb3NpdGlvbi5jb3B5KGdyaXBQb3NlLnRyYW5zZm9ybS5wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvY2FsUm90YXRpb24uY29weShncmlwUG9zZS50cmFuc2Zvcm0ub3JpZW50YXRpb24pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmF5XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRSYXlQb3NlID0gZnJhbWUuZ2V0UG9zZSh0aGlzLl94cklucHV0U291cmNlLnRhcmdldFJheVNwYWNlLCB0aGlzLl9tYW5hZ2VyLl9yZWZlcmVuY2VTcGFjZSk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0UmF5UG9zZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5UmF5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yYXlMb2NhbC5vcmlnaW4uY29weSh0YXJnZXRSYXlQb3NlLnRyYW5zZm9ybS5wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmF5TG9jYWwuZGlyZWN0aW9uLnNldCgwLCAwLCAtMSk7XG4gICAgICAgICAgICAgICAgcXVhdC5jb3B5KHRhcmdldFJheVBvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uKTtcbiAgICAgICAgICAgICAgICBxdWF0LnRyYW5zZm9ybVZlY3Rvcih0aGlzLl9yYXlMb2NhbC5kaXJlY3Rpb24sIHRoaXMuX3JheUxvY2FsLmRpcmVjdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdXBkYXRlVHJhbnNmb3JtcygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2xvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLl9sb2NhbFBvc2l0aW9uLCB0aGlzLl9sb2NhbFJvdGF0aW9uLCBWZWMzLk9ORSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9tYW5hZ2VyLmNhbWVyYS5wYXJlbnQ7XG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3dvcmxkVHJhbnNmb3JtLm11bDIocGFyZW50LmdldFdvcmxkVHJhbnNmb3JtKCksIHRoaXMuX2xvY2FsVHJhbnNmb3JtKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3dvcmxkVHJhbnNmb3JtLmNvcHkodGhpcy5fbG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3VwZGF0ZVJheVRyYW5zZm9ybXMoKSB7XG4gICAgICAgIGNvbnN0IGRpcnR5ID0gdGhpcy5fZGlydHlSYXk7XG4gICAgICAgIHRoaXMuX2RpcnR5UmF5ID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5fbWFuYWdlci5jYW1lcmEucGFyZW50O1xuICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnRUcmFuc2Zvcm0gPSB0aGlzLl9tYW5hZ2VyLmNhbWVyYS5wYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICAgICAgcGFyZW50VHJhbnNmb3JtLmdldFRyYW5zbGF0aW9uKHRoaXMuX3Bvc2l0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuX3JvdGF0aW9uLnNldEZyb21NYXQ0KHBhcmVudFRyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgIHRoaXMuX3JvdGF0aW9uLnRyYW5zZm9ybVZlY3Rvcih0aGlzLl9yYXlMb2NhbC5vcmlnaW4sIHRoaXMuX3JheS5vcmlnaW4pO1xuICAgICAgICAgICAgdGhpcy5fcmF5Lm9yaWdpbi5hZGQodGhpcy5fcG9zaXRpb24pO1xuICAgICAgICAgICAgdGhpcy5fcm90YXRpb24udHJhbnNmb3JtVmVjdG9yKHRoaXMuX3JheUxvY2FsLmRpcmVjdGlvbiwgdGhpcy5fcmF5LmRpcmVjdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAoZGlydHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3JheS5vcmlnaW4uY29weSh0aGlzLl9yYXlMb2NhbC5vcmlnaW4pO1xuICAgICAgICAgICAgdGhpcy5fcmF5LmRpcmVjdGlvbi5jb3B5KHRoaXMuX3JheUxvY2FsLmRpcmVjdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIGlucHV0IHNvdXJjZSBpZiBpdCBpcyBoYW5kaGVsZCAoe0BsaW5rIFhySW5wdXRTb3VyY2UjZ3JpcH1cbiAgICAgKiBpcyB0cnVlKS4gT3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM3xudWxsfSBUaGUgd29ybGQgc3BhY2UgcG9zaXRpb24gb2YgaGFuZGhlbGQgaW5wdXQgc291cmNlLlxuICAgICAqL1xuICAgIGdldFBvc2l0aW9uKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3Bvc2l0aW9uKSByZXR1cm4gbnVsbDtcblxuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm1zKCk7XG4gICAgICAgIHRoaXMuX3dvcmxkVHJhbnNmb3JtLmdldFRyYW5zbGF0aW9uKHRoaXMuX3Bvc2l0aW9uKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fcG9zaXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBsb2NhbCBzcGFjZSBwb3NpdGlvbiBvZiBpbnB1dCBzb3VyY2UgaWYgaXQgaXMgaGFuZGhlbGQgKHtAbGluayBYcklucHV0U291cmNlI2dyaXB9XG4gICAgICogaXMgdHJ1ZSkuIExvY2FsIHNwYWNlIGlzIHJlbGF0aXZlIHRvIHBhcmVudCBvZiB0aGUgWFIgY2FtZXJhLiBPdGhlcndpc2UgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfG51bGx9IFRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBoYW5kaGVsZCBpbnB1dCBzb3VyY2UuXG4gICAgICovXG4gICAgZ2V0TG9jYWxQb3NpdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsUG9zaXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiBpbnB1dCBzb3VyY2UgaWYgaXQgaXMgaGFuZGhlbGQgKHtAbGluayBYcklucHV0U291cmNlI2dyaXB9XG4gICAgICogaXMgdHJ1ZSkuIE90aGVyd2lzZSBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1F1YXR8bnVsbH0gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIGhhbmRoZWxkIGlucHV0IHNvdXJjZS5cbiAgICAgKi9cbiAgICBnZXRSb3RhdGlvbigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9yb3RhdGlvbikgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtcygpO1xuICAgICAgICB0aGlzLl9yb3RhdGlvbi5zZXRGcm9tTWF0NCh0aGlzLl93b3JsZFRyYW5zZm9ybSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX3JvdGF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgbG9jYWwgc3BhY2Ugcm90YXRpb24gb2YgaW5wdXQgc291cmNlIGlmIGl0IGlzIGhhbmRoZWxkICh7QGxpbmsgWHJJbnB1dFNvdXJjZSNncmlwfVxuICAgICAqIGlzIHRydWUpLiBMb2NhbCBzcGFjZSBpcyByZWxhdGl2ZSB0byBwYXJlbnQgb2YgdGhlIFhSIGNhbWVyYS4gT3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM3xudWxsfSBUaGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgaGFuZGhlbGQgaW5wdXQgc291cmNlLlxuICAgICAqL1xuICAgIGdldExvY2FsUm90YXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFJvdGF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugb3JpZ2luIG9mIGlucHV0IHNvdXJjZSByYXkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIG9yaWdpbiBvZiBpbnB1dCBzb3VyY2UgcmF5LlxuICAgICAqL1xuICAgIGdldE9yaWdpbigpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlUmF5VHJhbnNmb3JtcygpO1xuICAgICAgICByZXR1cm4gdGhpcy5fcmF5Lm9yaWdpbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIGRpcmVjdGlvbiBvZiBpbnB1dCBzb3VyY2UgcmF5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBkaXJlY3Rpb24gb2YgaW5wdXQgc291cmNlIHJheS5cbiAgICAgKi9cbiAgICBnZXREaXJlY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVJheVRyYW5zZm9ybXMoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JheS5kaXJlY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdHMgdG8gc3RhcnQgaGl0IHRlc3Qgc291cmNlIGJhc2VkIG9uIHRoaXMgaW5wdXQgc291cmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9iamVjdCBmb3IgcGFzc2luZyBvcHRpb25hbCBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMuZW50aXR5VHlwZXNdIC0gT3B0aW9uYWwgbGlzdCBvZiB1bmRlcmx5aW5nIGVudGl0eSB0eXBlcyBhZ2FpbnN0XG4gICAgICogd2hpY2ggaGl0IHRlc3RzIHdpbGwgYmUgcGVyZm9ybWVkLiBEZWZhdWx0cyB0byBbIHtAbGluayBYUlRSQUNLQUJMRV9QTEFORX0gXS4gQ2FuIGJlIGFueVxuICAgICAqIGNvbWJpbmF0aW9uIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9QT0lOVH06IFBvaW50IC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBmZWF0dXJlIHBvaW50cyBkZXRlY3RlZCBieSB0aGUgdW5kZXJseWluZyBBdWdtZW50ZWQgUmVhbGl0eSBzeXN0ZW0uXG4gICAgICogLSB7QGxpbmsgWFJUUkFDS0FCTEVfUExBTkV9OiBQbGFuZSAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBiYXNlZCBvbiB0aGUgcGxhbmVzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9NRVNIfTogTWVzaCAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBiYXNlZCBvbiB0aGUgbWVzaGVzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmF5fSBbb3B0aW9ucy5vZmZzZXRSYXldIC0gT3B0aW9uYWwgcmF5IGJ5IHdoaWNoIGhpdCB0ZXN0IHJheSBjYW4gYmUgb2Zmc2V0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWhpdC10ZXN0LmpzJykuWHJIaXRUZXN0U3RhcnRDYWxsYmFja30gW29wdGlvbnMuY2FsbGJhY2tdIC0gT3B0aW9uYWxcbiAgICAgKiBjYWxsYmFjayBmdW5jdGlvbiBjYWxsZWQgb25jZSBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZCBvciBmYWlsZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuaW5wdXQub24oJ2FkZCcsIGZ1bmN0aW9uIChpbnB1dFNvdXJjZSkge1xuICAgICAqICAgICBpbnB1dFNvdXJjZS5oaXRUZXN0U3RhcnQoe1xuICAgICAqICAgICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uIChlcnIsIGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgKiAgICAgICAgICAgICBpZiAoZXJyKSByZXR1cm47XG4gICAgICogICAgICAgICAgICAgaGl0VGVzdFNvdXJjZS5vbigncmVzdWx0JywgZnVuY3Rpb24gKHBvc2l0aW9uLCByb3RhdGlvbikge1xuICAgICAqICAgICAgICAgICAgICAgICAvLyBwb3NpdGlvbiBhbmQgcm90YXRpb24gb2YgaGl0IHRlc3QgcmVzdWx0XG4gICAgICogICAgICAgICAgICAgICAgIC8vIHRoYXQgd2lsbCBiZSBjcmVhdGVkIGZyb20gdG91Y2ggb24gbW9iaWxlIGRldmljZXNcbiAgICAgKiAgICAgICAgICAgICB9KTtcbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfSk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgaGl0VGVzdFN0YXJ0KG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBvcHRpb25zLnByb2ZpbGUgPSB0aGlzLl94cklucHV0U291cmNlLnByb2ZpbGVzWzBdO1xuXG4gICAgICAgIGNvbnN0IGNhbGxiYWNrID0gb3B0aW9ucy5jYWxsYmFjaztcbiAgICAgICAgb3B0aW9ucy5jYWxsYmFjayA9IChlcnIsIGhpdFRlc3RTb3VyY2UpID0+IHtcbiAgICAgICAgICAgIGlmIChoaXRUZXN0U291cmNlKSB0aGlzLm9uSGl0VGVzdFNvdXJjZUFkZChoaXRUZXN0U291cmNlKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyLCBoaXRUZXN0U291cmNlKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9tYW5hZ2VyLmhpdFRlc3Quc3RhcnQob3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItaGl0LXRlc3Qtc291cmNlLmpzJykuWHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlXG4gICAgICogdG8gYmUgYWRkZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkhpdFRlc3RTb3VyY2VBZGQoaGl0VGVzdFNvdXJjZSkge1xuICAgICAgICB0aGlzLl9oaXRUZXN0U291cmNlcy5wdXNoKGhpdFRlc3RTb3VyY2UpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnaGl0dGVzdDphZGQnLCBoaXRUZXN0U291cmNlKTtcblxuICAgICAgICBoaXRUZXN0U291cmNlLm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocG9zaXRpb24sIHJvdGF0aW9uLCBpbnB1dFNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKGlucHV0U291cmNlICE9PSB0aGlzKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5maXJlKCdoaXR0ZXN0OnJlc3VsdCcsIGhpdFRlc3RTb3VyY2UsIHBvc2l0aW9uLCByb3RhdGlvbik7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgICBoaXRUZXN0U291cmNlLm9uY2UoJ3JlbW92ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMub25IaXRUZXN0U291cmNlUmVtb3ZlKGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdoaXR0ZXN0OnJlbW92ZScsIGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1oaXQtdGVzdC1zb3VyY2UuanMnKS5YckhpdFRlc3RTb3VyY2V9IGhpdFRlc3RTb3VyY2UgLSBIaXQgdGVzdCBzb3VyY2VcbiAgICAgKiB0byBiZSByZW1vdmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25IaXRUZXN0U291cmNlUmVtb3ZlKGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgICAgY29uc3QgaW5kID0gdGhpcy5faGl0VGVzdFNvdXJjZXMuaW5kZXhPZihoaXRUZXN0U291cmNlKTtcbiAgICAgICAgaWYgKGluZCAhPT0gLTEpIHRoaXMuX2hpdFRlc3RTb3VyY2VzLnNwbGljZShpbmQsIDEpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJJbnB1dFNvdXJjZSB9O1xuIl0sIm5hbWVzIjpbInF1YXQiLCJRdWF0IiwiaWRzIiwiWHJJbnB1dFNvdXJjZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsInhySW5wdXRTb3VyY2UiLCJfaWQiLCJfbWFuYWdlciIsIl94cklucHV0U291cmNlIiwiX3JheSIsIlJheSIsIl9yYXlMb2NhbCIsIl9ncmlwIiwiX2hhbmQiLCJfbG9jYWxUcmFuc2Zvcm0iLCJfd29ybGRUcmFuc2Zvcm0iLCJfcG9zaXRpb24iLCJWZWMzIiwiX3JvdGF0aW9uIiwiX2xvY2FsUG9zaXRpb24iLCJfbG9jYWxSb3RhdGlvbiIsIl9kaXJ0eUxvY2FsIiwiX2RpcnR5UmF5IiwiX3NlbGVjdGluZyIsIl9zcXVlZXppbmciLCJfZWxlbWVudElucHV0IiwiX2VsZW1lbnRFbnRpdHkiLCJfaGl0VGVzdFNvdXJjZXMiLCJoYW5kIiwiWHJIYW5kIiwiaWQiLCJpbnB1dFNvdXJjZSIsInRhcmdldFJheU1vZGUiLCJoYW5kZWRuZXNzIiwicHJvZmlsZXMiLCJncmlwIiwiZ2FtZXBhZCIsInNlbGVjdGluZyIsInNxdWVlemluZyIsImVsZW1lbnRJbnB1dCIsInZhbHVlIiwiZWxlbWVudEVudGl0eSIsImhpdFRlc3RTb3VyY2VzIiwidXBkYXRlIiwiZnJhbWUiLCJncmlwU3BhY2UiLCJncmlwUG9zZSIsImdldFBvc2UiLCJfcmVmZXJlbmNlU3BhY2UiLCJNYXQ0IiwiY29weSIsInRyYW5zZm9ybSIsInBvc2l0aW9uIiwib3JpZW50YXRpb24iLCJ0YXJnZXRSYXlQb3NlIiwidGFyZ2V0UmF5U3BhY2UiLCJvcmlnaW4iLCJkaXJlY3Rpb24iLCJzZXQiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJfdXBkYXRlVHJhbnNmb3JtcyIsInNldFRSUyIsIk9ORSIsInBhcmVudCIsImNhbWVyYSIsIm11bDIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsIl91cGRhdGVSYXlUcmFuc2Zvcm1zIiwiZGlydHkiLCJwYXJlbnRUcmFuc2Zvcm0iLCJnZXRUcmFuc2xhdGlvbiIsInNldEZyb21NYXQ0IiwiYWRkIiwiZ2V0UG9zaXRpb24iLCJnZXRMb2NhbFBvc2l0aW9uIiwiZ2V0Um90YXRpb24iLCJnZXRMb2NhbFJvdGF0aW9uIiwiZ2V0T3JpZ2luIiwiZ2V0RGlyZWN0aW9uIiwiaGl0VGVzdFN0YXJ0Iiwib3B0aW9ucyIsInByb2ZpbGUiLCJjYWxsYmFjayIsImVyciIsImhpdFRlc3RTb3VyY2UiLCJvbkhpdFRlc3RTb3VyY2VBZGQiLCJoaXRUZXN0Iiwic3RhcnQiLCJwdXNoIiwiZmlyZSIsIm9uIiwicm90YXRpb24iLCJvbmNlIiwib25IaXRUZXN0U291cmNlUmVtb3ZlIiwiaW5kIiwiaW5kZXhPZiIsInNwbGljZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBUUEsTUFBTUEsSUFBSSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3ZCLElBQUlDLEdBQUcsR0FBRyxDQUFDLENBQUE7O0FBRVg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGFBQWEsU0FBU0MsWUFBWSxDQUFDO0FBQ3JDO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsT0FBTyxFQUFFQyxhQUFhLEVBQUU7QUFDaEMsSUFBQSxLQUFLLEVBQUUsQ0FBQTtBQUFDLElBQUEsSUFBQSxDQTdIWkMsR0FBRyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBTUhDLFFBQVEsR0FBQSxLQUFBLENB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
