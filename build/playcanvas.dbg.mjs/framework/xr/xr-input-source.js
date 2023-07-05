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
   * Create a new XrInputSource instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @param {*} xrInputSource - [XRInputSource](https://developer.mozilla.org/en-US/docs/Web/API/XRInputSource)
   * object that is created by WebXR API.
   * @hideconstructor
   */
  constructor(manager, xrInputSource) {
    super();
    /**
     * @type {number}
     * @private
     */
    this._id = void 0;
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    this._manager = void 0;
    /**
     * @type {XRInputSource}
     * @private
     */
    this._xrInputSource = void 0;
    /**
     * @type {Ray}
     * @private
     */
    this._ray = new Ray();
    /**
     * @type {Ray}
     * @private
     */
    this._rayLocal = new Ray();
    /**
     * @type {boolean}
     * @private
     */
    this._grip = false;
    /**
     * @type {XrHand}
     * @private
     */
    this._hand = null;
    /**
     * @type {Mat4|null}
     * @private
     */
    this._localTransform = null;
    /**
     * @type {Mat4|null}
     * @private
     */
    this._worldTransform = null;
    /**
     * @type {Vec3}
     * @private
     */
    this._position = new Vec3();
    /**
     * @type {Quat}
     * @private
     */
    this._rotation = new Quat();
    /**
     * @type {Mat4|null}
     * @private
     */
    this._localPosition = null;
    /**
     * @type {Mat4|null}
     * @private
     */
    this._localRotation = null;
    /**
     * @type {boolean}
     * @private
     */
    this._dirtyLocal = true;
    /**
     * @type {boolean}
     * @private
     */
    this._dirtyRay = false;
    /**
     * @type {boolean}
     * @private
     */
    this._selecting = false;
    /**
     * @type {boolean}
     * @private
     */
    this._squeezing = false;
    /**
     * @type {boolean}
     * @private
     */
    this._elementInput = true;
    /**
     * @type {import('../entity.js').Entity|null}
     * @private
     */
    this._elementEntity = null;
    /**
     * @type {import('./xr-hit-test-source.js').XrHitTestSource[]}
     * @private
     */
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
   * const ray = new pc.Ray();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItaW5wdXQtc291cmNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3hyL3hyLWlucHV0LXNvdXJjZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgUmF5IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9yYXkuanMnO1xuXG5pbXBvcnQgeyBYckhhbmQgfSBmcm9tICcuL3hyLWhhbmQuanMnO1xuXG5jb25zdCBxdWF0ID0gbmV3IFF1YXQoKTtcbmxldCBpZHMgPSAwO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgWFIgaW5wdXQgc291cmNlLCB3aGljaCBpcyBhbnkgaW5wdXQgbWVjaGFuaXNtIHdoaWNoIGFsbG93cyB0aGUgdXNlciB0byBwZXJmb3JtXG4gKiB0YXJnZXRlZCBhY3Rpb25zIGluIHRoZSBzYW1lIHZpcnR1YWwgc3BhY2UgYXMgdGhlIHZpZXdlci4gRXhhbXBsZSBYUiBpbnB1dCBzb3VyY2VzIGluY2x1ZGUsIGJ1dFxuICogYXJlIG5vdCBsaW1pdGVkIHRvLCBoYW5kaGVsZCBjb250cm9sbGVycywgb3B0aWNhbGx5IHRyYWNrZWQgaGFuZHMsIGFuZCBnYXplLWJhc2VkIGlucHV0IG1ldGhvZHNcbiAqIHRoYXQgb3BlcmF0ZSBvbiB0aGUgdmlld2VyJ3MgcG9zZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFhySW5wdXRTb3VyY2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaWQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWFuYWdlcjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUklucHV0U291cmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3hySW5wdXRTb3VyY2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmF5fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JheSA9IG5ldyBSYXkoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtSYXl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmF5TG9jYWwgPSBuZXcgUmF5KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9ncmlwID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WHJIYW5kfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhbmQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01hdDR8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFRyYW5zZm9ybSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dvcmxkVHJhbnNmb3JtID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Bvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9jYWxQb3NpdGlvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUm90YXRpb24gPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGlydHlMb2NhbCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9kaXJ0eVJheSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2VsZWN0aW5nID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zcXVlZXppbmcgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2VsZW1lbnRJbnB1dCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9lbGVtZW50RW50aXR5ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItaGl0LXRlc3Qtc291cmNlLmpzJykuWHJIaXRUZXN0U291cmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGl0VGVzdFNvdXJjZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYcklucHV0U291cmNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gbWFuYWdlciAtIFdlYlhSIE1hbmFnZXIuXG4gICAgICogQHBhcmFtIHsqfSB4cklucHV0U291cmNlIC0gW1hSSW5wdXRTb3VyY2VdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9YUklucHV0U291cmNlKVxuICAgICAqIG9iamVjdCB0aGF0IGlzIGNyZWF0ZWQgYnkgV2ViWFIgQVBJLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyLCB4cklucHV0U291cmNlKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5faWQgPSArK2lkcztcblxuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcbiAgICAgICAgdGhpcy5feHJJbnB1dFNvdXJjZSA9IHhySW5wdXRTb3VyY2U7XG5cbiAgICAgICAgaWYgKHhySW5wdXRTb3VyY2UuaGFuZClcbiAgICAgICAgICAgIHRoaXMuX2hhbmQgPSBuZXcgWHJIYW5kKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4ge0BsaW5rIFhySW5wdXRTb3VyY2V9IGlzIHJlbW92ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNyZW1vdmVcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uY2UoJ3JlbW92ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gaW5wdXQgc291cmNlIGlzIG5vdCBhdmFpbGFibGUgYW55bW9yZVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbnB1dCBzb3VyY2UgaGFzIHRyaWdnZXJlZCBwcmltYXJ5IGFjdGlvbi4gVGhpcyBjb3VsZCBiZSBwcmVzc2luZyBhIHRyaWdnZXJcbiAgICAgKiBidXR0b24sIG9yIHRvdWNoaW5nIGEgc2NyZWVuLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySW5wdXRTb3VyY2Ujc2VsZWN0XG4gICAgICogQHBhcmFtIHtvYmplY3R9IGV2dCAtIFhSSW5wdXRTb3VyY2VFdmVudCBldmVudCBkYXRhIGZyb20gV2ViWFIgQVBJLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcmF5ID0gbmV3IHBjLlJheSgpO1xuICAgICAqIGlucHV0U291cmNlLm9uKCdzZWxlY3QnLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICogICAgIHJheS5zZXQoaW5wdXRTb3VyY2UuZ2V0T3JpZ2luKCksIGlucHV0U291cmNlLmdldERpcmVjdGlvbigpKTtcbiAgICAgKiAgICAgaWYgKG9iai5pbnRlcnNlY3RzUmF5KHJheSkpIHtcbiAgICAgKiAgICAgICAgIC8vIHNlbGVjdGVkIGFuIG9iamVjdCB3aXRoIGlucHV0IHNvdXJjZVxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGlucHV0IHNvdXJjZSBoYXMgc3RhcnRlZCB0byB0cmlnZ2VyIHByaW1hcnkgYWN0aW9uLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySW5wdXRTb3VyY2Ujc2VsZWN0c3RhcnRcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZ0IC0gWFJJbnB1dFNvdXJjZUV2ZW50IGV2ZW50IGRhdGEgZnJvbSBXZWJYUiBBUEkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGlucHV0IHNvdXJjZSBoYXMgZW5kZWQgdHJpZ2dlcmluZyBwcmltYXJ5IGFjdGlvbi5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0U291cmNlI3NlbGVjdGVuZFxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldnQgLSBYUklucHV0U291cmNlRXZlbnQgZXZlbnQgZGF0YSBmcm9tIFdlYlhSIEFQSS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaW5wdXQgc291cmNlIGhhcyB0cmlnZ2VyZWQgc3F1ZWV6ZSBhY3Rpb24uIFRoaXMgaXMgYXNzb2NpYXRlZCB3aXRoIFwiZ3JhYmJpbmdcIlxuICAgICAqIGFjdGlvbiBvbiB0aGUgY29udHJvbGxlcnMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNzcXVlZXplXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGV2dCAtIFhSSW5wdXRTb3VyY2VFdmVudCBldmVudCBkYXRhIGZyb20gV2ViWFIgQVBJLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbnB1dCBzb3VyY2UgaGFzIHN0YXJ0ZWQgdG8gdHJpZ2dlciBzcXVlZXplIGFjdGlvbi5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0U291cmNlI3NxdWVlemVzdGFydFxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldnQgLSBYUklucHV0U291cmNlRXZlbnQgZXZlbnQgZGF0YSBmcm9tIFdlYlhSIEFQSS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uKCdzcXVlZXplc3RhcnQnLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICogICAgIGlmIChvYmouY29udGFpbnNQb2ludChpbnB1dFNvdXJjZS5nZXRQb3NpdGlvbigpKSkge1xuICAgICAqICAgICAgICAgLy8gZ3JhYmJlZCBhbiBvYmplY3RcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBpbnB1dCBzb3VyY2UgaGFzIGVuZGVkIHRyaWdnZXJpbmcgc3F1ZWV6ZSBhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dFNvdXJjZSNzcXVlZXplZW5kXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGV2dCAtIFhSSW5wdXRTb3VyY2VFdmVudCBldmVudCBkYXRhIGZyb20gV2ViWFIgQVBJLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBuZXcge0BsaW5rIFhySGl0VGVzdFNvdXJjZX0gaXMgYWRkZWQgdG8gdGhlIGlucHV0IHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0U291cmNlI2hpdHRlc3Q6YWRkXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItaGl0LXRlc3Qtc291cmNlLmpzJykuWHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlXG4gICAgICogdGhhdCBoYXMgYmVlbiBhZGRlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlucHV0U291cmNlLm9uKCdoaXR0ZXN0OmFkZCcsIGZ1bmN0aW9uIChoaXRUZXN0U291cmNlKSB7XG4gICAgICogICAgIC8vIG5ldyBoaXQgdGVzdCBzb3VyY2UgaXMgYWRkZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4ge0BsaW5rIFhySGl0VGVzdFNvdXJjZX0gaXMgcmVtb3ZlZCB0byB0aGUgdGhlIGlucHV0IHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0U291cmNlI2hpdHRlc3Q6cmVtb3ZlXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItaGl0LXRlc3Qtc291cmNlLmpzJykuWHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlXG4gICAgICogdGhhdCBoYXMgYmVlbiByZW1vdmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaW5wdXRTb3VyY2Uub24oJ3JlbW92ZScsIGZ1bmN0aW9uIChoaXRUZXN0U291cmNlKSB7XG4gICAgICogICAgIC8vIGhpdCB0ZXN0IHNvdXJjZSBpcyByZW1vdmVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGhpdCB0ZXN0IHNvdXJjZSByZWNlaXZlcyBuZXcgcmVzdWx0cy4gSXQgcHJvdmlkZXMgdHJhbnNmb3JtIGluZm9ybWF0aW9uIHRoYXRcbiAgICAgKiB0cmllcyB0byBtYXRjaCByZWFsIHdvcmxkIHBpY2tlZCBnZW9tZXRyeS5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0U291cmNlI2hpdHRlc3Q6cmVzdWx0XG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItaGl0LXRlc3Qtc291cmNlLmpzJykuWHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlXG4gICAgICogdGhhdCBwcm9kdWNlZCB0aGUgaGl0IHJlc3VsdC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHBvc2l0aW9uIC0gUG9zaXRpb24gb2YgaGl0IHRlc3QuXG4gICAgICogQHBhcmFtIHtRdWF0fSByb3RhdGlvbiAtIFJvdGF0aW9uIG9mIGhpdCB0ZXN0LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaW5wdXRTb3VyY2Uub24oJ2hpdHRlc3Q6cmVzdWx0JywgZnVuY3Rpb24gKGhpdFRlc3RTb3VyY2UsIHBvc2l0aW9uLCByb3RhdGlvbikge1xuICAgICAqICAgICB0YXJnZXQuc2V0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAqICAgICB0YXJnZXQuc2V0Um90YXRpb24ocm90YXRpb24pO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVW5pcXVlIG51bWJlciBhc3NvY2lhdGVkIHdpdGggaW5zdGFuY2Ugb2YgaW5wdXQgc291cmNlLiBTYW1lIHBoeXNpY2FsIGRldmljZXMgd2hlblxuICAgICAqIHJlY29ubmVjdGVkIHdpbGwgbm90IHNoYXJlIHRoaXMgSUQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBpZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFhSSW5wdXRTb3VyY2Ugb2JqZWN0IHRoYXQgaXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgaW5wdXQgc291cmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKi9cbiAgICBnZXQgaW5wdXRTb3VyY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cklucHV0U291cmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFR5cGUgb2YgcmF5IElucHV0IERldmljZSBpcyBiYXNlZCBvbi4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJUQVJHRVRSQVlfR0FaRX06IEdhemUgLSBpbmRpY2F0ZXMgdGhlIHRhcmdldCByYXkgd2lsbCBvcmlnaW5hdGUgYXQgdGhlIHZpZXdlciBhbmRcbiAgICAgKiBmb2xsb3cgdGhlIGRpcmVjdGlvbiBpdCBpcyBmYWNpbmcuIFRoaXMgaXMgY29tbW9ubHkgcmVmZXJyZWQgdG8gYXMgYSBcImdhemUgaW5wdXRcIiBkZXZpY2UgaW5cbiAgICAgKiB0aGUgY29udGV4dCBvZiBoZWFkLW1vdW50ZWQgZGlzcGxheXMuXG4gICAgICogLSB7QGxpbmsgWFJUQVJHRVRSQVlfU0NSRUVOfTogU2NyZWVuIC0gaW5kaWNhdGVzIHRoYXQgdGhlIGlucHV0IHNvdXJjZSB3YXMgYW4gaW50ZXJhY3Rpb25cbiAgICAgKiB3aXRoIHRoZSBjYW52YXMgZWxlbWVudCBhc3NvY2lhdGVkIHdpdGggYW4gaW5saW5lIHNlc3Npb24ncyBvdXRwdXQgY29udGV4dCwgc3VjaCBhcyBhIG1vdXNlXG4gICAgICogY2xpY2sgb3IgdG91Y2ggZXZlbnQuXG4gICAgICogLSB7QGxpbmsgWFJUQVJHRVRSQVlfUE9JTlRFUn06IFRyYWNrZWQgUG9pbnRlciAtIGluZGljYXRlcyB0aGF0IHRoZSB0YXJnZXQgcmF5IG9yaWdpbmF0ZXNcbiAgICAgKiBmcm9tIGVpdGhlciBhIGhhbmRoZWxkIGRldmljZSBvciBvdGhlciBoYW5kLXRyYWNraW5nIG1lY2hhbmlzbSBhbmQgcmVwcmVzZW50cyB0aGF0IHRoZSB1c2VyXG4gICAgICogaXMgdXNpbmcgdGhlaXIgaGFuZHMgb3IgdGhlIGhlbGQgZGV2aWNlIGZvciBwb2ludGluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHRhcmdldFJheU1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cklucHV0U291cmNlLnRhcmdldFJheU1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzY3JpYmVzIHdoaWNoIGhhbmQgaW5wdXQgc291cmNlIGlzIGFzc29jaWF0ZWQgd2l0aC4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJIQU5EX05PTkV9OiBOb25lIC0gaW5wdXQgc291cmNlIGlzIG5vdCBtZWFudCB0byBiZSBoZWxkIGluIGhhbmRzLlxuICAgICAqIC0ge0BsaW5rIFhSSEFORF9MRUZUfTogTGVmdCAtIGluZGljYXRlcyB0aGF0IGlucHV0IHNvdXJjZSBpcyBtZWFudCB0byBiZSBoZWxkIGluIGxlZnQgaGFuZC5cbiAgICAgKiAtIHtAbGluayBYUkhBTkRfUklHSFR9OiBSaWdodCAtIGluZGljYXRlcyB0aGF0IGlucHV0IHNvdXJjZSBpcyBtZWFudCB0byBiZSBoZWxkIGluIHJpZ2h0XG4gICAgICogaGFuZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IGhhbmRlZG5lc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94cklucHV0U291cmNlLmhhbmRlZG5lc3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBpbnB1dCBwcm9maWxlIG5hbWVzIGluZGljYXRpbmcgYm90aCB0aGUgcHJlZmVycmVkIHZpc3VhbCByZXByZXNlbnRhdGlvbiBhbmQgYmVoYXZpb3JcbiAgICAgKiBvZiB0aGUgaW5wdXQgc291cmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ1tdfVxuICAgICAqL1xuICAgIGdldCBwcm9maWxlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hySW5wdXRTb3VyY2UucHJvZmlsZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgaW5wdXQgc291cmNlIGNhbiBiZSBoZWxkLCB0aGVuIGl0IHdpbGwgaGF2ZSBub2RlIHdpdGggaXRzIHdvcmxkIHRyYW5zZm9ybWF0aW9uLCB0aGF0IGNhblxuICAgICAqIGJlIHVzZWQgdG8gcG9zaXRpb24gYW5kIHJvdGF0ZSB2aXJ0dWFsIGpveXN0aWNrcyBiYXNlZCBvbiBpdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBncmlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ3JpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBpbnB1dCBzb3VyY2UgaXMgYSB0cmFja2VkIGhhbmQsIHRoZW4gaXQgd2lsbCBwb2ludCB0byB7QGxpbmsgWHJIYW5kfSBvdGhlcndpc2UgaXQgaXNcbiAgICAgKiBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge1hySGFuZHxudWxsfVxuICAgICAqL1xuICAgIGdldCBoYW5kKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGFuZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBpbnB1dCBzb3VyY2UgaGFzIGJ1dHRvbnMsIHRyaWdnZXJzLCB0aHVtYnN0aWNrIG9yIHRvdWNocGFkLCB0aGVuIHRoaXMgb2JqZWN0IHByb3ZpZGVzXG4gICAgICogYWNjZXNzIHRvIGl0cyBzdGF0ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7R2FtZXBhZHxudWxsfVxuICAgICAqL1xuICAgIGdldCBnYW1lcGFkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5feHJJbnB1dFNvdXJjZS5nYW1lcGFkIHx8IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBpbnB1dCBzb3VyY2UgaXMgaW4gYWN0aXZlIHByaW1hcnkgYWN0aW9uIGJldHdlZW4gc2VsZWN0c3RhcnQgYW5kIHNlbGVjdGVuZCBldmVudHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc2VsZWN0aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2VsZWN0aW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgaW5wdXQgc291cmNlIGlzIGluIGFjdGl2ZSBzcXVlZXplIGFjdGlvbiBiZXR3ZWVuIHNxdWVlemVzdGFydCBhbmQgc3F1ZWV6ZWVuZCBldmVudHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgc3F1ZWV6aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3F1ZWV6aW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0byB0cnVlIHRvIGFsbG93IGlucHV0IHNvdXJjZSB0byBpbnRlcmFjdCB3aXRoIEVsZW1lbnQgY29tcG9uZW50cy4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBlbGVtZW50SW5wdXQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnRJbnB1dCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZWxlbWVudElucHV0ID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9lbGVtZW50SW5wdXQpXG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50RW50aXR5ID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgZWxlbWVudElucHV0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZWxlbWVudElucHV0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHtAbGluayBYcklucHV0U291cmNlI2VsZW1lbnRJbnB1dH0gaXMgdHJ1ZSwgdGhpcyBwcm9wZXJ0eSB3aWxsIGhvbGQgZW50aXR5IHdpdGggRWxlbWVudFxuICAgICAqIGNvbXBvbmVudCBhdCB3aGljaCB0aGlzIGlucHV0IHNvdXJjZSBpcyBob3ZlcmluZywgb3IgbnVsbCBpZiBub3QgaG92ZXJpbmcgb3ZlciBhbnkgZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eXxudWxsfVxuICAgICAqL1xuICAgIGdldCBlbGVtZW50RW50aXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZWxlbWVudEVudGl0eTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IG9mIGFjdGl2ZSB7QGxpbmsgWHJIaXRUZXN0U291cmNlfSBpbnN0YW5jZXMgY3JlYXRlZCBieSB0aGlzIGlucHV0IHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItaGl0LXRlc3Qtc291cmNlLmpzJykuWHJIaXRUZXN0U291cmNlW119XG4gICAgICovXG4gICAgZ2V0IGhpdFRlc3RTb3VyY2VzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGl0VGVzdFNvdXJjZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICAvLyBoYW5kXG4gICAgICAgIGlmICh0aGlzLl9oYW5kKSB7XG4gICAgICAgICAgICB0aGlzLl9oYW5kLnVwZGF0ZShmcmFtZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBncmlwXG4gICAgICAgICAgICBpZiAodGhpcy5feHJJbnB1dFNvdXJjZS5ncmlwU3BhY2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBncmlwUG9zZSA9IGZyYW1lLmdldFBvc2UodGhpcy5feHJJbnB1dFNvdXJjZS5ncmlwU3BhY2UsIHRoaXMuX21hbmFnZXIuX3JlZmVyZW5jZVNwYWNlKTtcbiAgICAgICAgICAgICAgICBpZiAoZ3JpcFBvc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9ncmlwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9ncmlwID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9jYWxUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fd29ybGRUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2NhbFBvc2l0aW9uID0gbmV3IFZlYzMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2NhbFBvc2l0aW9uLmNvcHkoZ3JpcFBvc2UudHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9jYWxSb3RhdGlvbi5jb3B5KGdyaXBQb3NlLnRyYW5zZm9ybS5vcmllbnRhdGlvbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByYXlcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFJheVBvc2UgPSBmcmFtZS5nZXRQb3NlKHRoaXMuX3hySW5wdXRTb3VyY2UudGFyZ2V0UmF5U3BhY2UsIHRoaXMuX21hbmFnZXIuX3JlZmVyZW5jZVNwYWNlKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRSYXlQb3NlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHlSYXkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JheUxvY2FsLm9yaWdpbi5jb3B5KHRhcmdldFJheVBvc2UudHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yYXlMb2NhbC5kaXJlY3Rpb24uc2V0KDAsIDAsIC0xKTtcbiAgICAgICAgICAgICAgICBxdWF0LmNvcHkodGFyZ2V0UmF5UG9zZS50cmFuc2Zvcm0ub3JpZW50YXRpb24pO1xuICAgICAgICAgICAgICAgIHF1YXQudHJhbnNmb3JtVmVjdG9yKHRoaXMuX3JheUxvY2FsLmRpcmVjdGlvbiwgdGhpcy5fcmF5TG9jYWwuZGlyZWN0aW9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF91cGRhdGVUcmFuc2Zvcm1zKCkge1xuICAgICAgICBpZiAodGhpcy5fZGlydHlMb2NhbCkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fbG9jYWxUcmFuc2Zvcm0uc2V0VFJTKHRoaXMuX2xvY2FsUG9zaXRpb24sIHRoaXMuX2xvY2FsUm90YXRpb24sIFZlYzMuT05FKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX21hbmFnZXIuY2FtZXJhLnBhcmVudDtcbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgdGhpcy5fd29ybGRUcmFuc2Zvcm0ubXVsMihwYXJlbnQuZ2V0V29ybGRUcmFuc2Zvcm0oKSwgdGhpcy5fbG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fd29ybGRUcmFuc2Zvcm0uY29weSh0aGlzLl9sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdXBkYXRlUmF5VHJhbnNmb3JtcygpIHtcbiAgICAgICAgY29uc3QgZGlydHkgPSB0aGlzLl9kaXJ0eVJheTtcbiAgICAgICAgdGhpcy5fZGlydHlSYXkgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLl9tYW5hZ2VyLmNhbWVyYS5wYXJlbnQ7XG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudFRyYW5zZm9ybSA9IHRoaXMuX21hbmFnZXIuY2FtZXJhLnBhcmVudC5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuXG4gICAgICAgICAgICBwYXJlbnRUcmFuc2Zvcm0uZ2V0VHJhbnNsYXRpb24odGhpcy5fcG9zaXRpb24pO1xuICAgICAgICAgICAgdGhpcy5fcm90YXRpb24uc2V0RnJvbU1hdDQocGFyZW50VHJhbnNmb3JtKTtcblxuICAgICAgICAgICAgdGhpcy5fcm90YXRpb24udHJhbnNmb3JtVmVjdG9yKHRoaXMuX3JheUxvY2FsLm9yaWdpbiwgdGhpcy5fcmF5Lm9yaWdpbik7XG4gICAgICAgICAgICB0aGlzLl9yYXkub3JpZ2luLmFkZCh0aGlzLl9wb3NpdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9yb3RhdGlvbi50cmFuc2Zvcm1WZWN0b3IodGhpcy5fcmF5TG9jYWwuZGlyZWN0aW9uLCB0aGlzLl9yYXkuZGlyZWN0aW9uKTtcbiAgICAgICAgfSBlbHNlIGlmIChkaXJ0eSkge1xuICAgICAgICAgICAgdGhpcy5fcmF5Lm9yaWdpbi5jb3B5KHRoaXMuX3JheUxvY2FsLm9yaWdpbik7XG4gICAgICAgICAgICB0aGlzLl9yYXkuZGlyZWN0aW9uLmNvcHkodGhpcy5fcmF5TG9jYWwuZGlyZWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2UgcG9zaXRpb24gb2YgaW5wdXQgc291cmNlIGlmIGl0IGlzIGhhbmRoZWxkICh7QGxpbmsgWHJJbnB1dFNvdXJjZSNncmlwfVxuICAgICAqIGlzIHRydWUpLiBPdGhlcndpc2UgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfG51bGx9IFRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBoYW5kaGVsZCBpbnB1dCBzb3VyY2UuXG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fcG9zaXRpb24pIHJldHVybiBudWxsO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybXMoKTtcbiAgICAgICAgdGhpcy5fd29ybGRUcmFuc2Zvcm0uZ2V0VHJhbnNsYXRpb24odGhpcy5fcG9zaXRpb24pO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9wb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGxvY2FsIHNwYWNlIHBvc2l0aW9uIG9mIGlucHV0IHNvdXJjZSBpZiBpdCBpcyBoYW5kaGVsZCAoe0BsaW5rIFhySW5wdXRTb3VyY2UjZ3JpcH1cbiAgICAgKiBpcyB0cnVlKS4gTG9jYWwgc3BhY2UgaXMgcmVsYXRpdmUgdG8gcGFyZW50IG9mIHRoZSBYUiBjYW1lcmEuIE90aGVyd2lzZSBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN8bnVsbH0gVGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIGhhbmRoZWxkIGlucHV0IHNvdXJjZS5cbiAgICAgKi9cbiAgICBnZXRMb2NhbFBvc2l0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIGlucHV0IHNvdXJjZSBpZiBpdCBpcyBoYW5kaGVsZCAoe0BsaW5rIFhySW5wdXRTb3VyY2UjZ3JpcH1cbiAgICAgKiBpcyB0cnVlKS4gT3RoZXJ3aXNlIGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdHxudWxsfSBUaGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgaGFuZGhlbGQgaW5wdXQgc291cmNlLlxuICAgICAqL1xuICAgIGdldFJvdGF0aW9uKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3JvdGF0aW9uKSByZXR1cm4gbnVsbDtcblxuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm1zKCk7XG4gICAgICAgIHRoaXMuX3JvdGF0aW9uLnNldEZyb21NYXQ0KHRoaXMuX3dvcmxkVHJhbnNmb3JtKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fcm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBsb2NhbCBzcGFjZSByb3RhdGlvbiBvZiBpbnB1dCBzb3VyY2UgaWYgaXQgaXMgaGFuZGhlbGQgKHtAbGluayBYcklucHV0U291cmNlI2dyaXB9XG4gICAgICogaXMgdHJ1ZSkuIExvY2FsIHNwYWNlIGlzIHJlbGF0aXZlIHRvIHBhcmVudCBvZiB0aGUgWFIgY2FtZXJhLiBPdGhlcndpc2UgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfG51bGx9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiBoYW5kaGVsZCBpbnB1dCBzb3VyY2UuXG4gICAgICovXG4gICAgZ2V0TG9jYWxSb3RhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsUm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSBvcmlnaW4gb2YgaW5wdXQgc291cmNlIHJheS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgd29ybGQgc3BhY2Ugb3JpZ2luIG9mIGlucHV0IHNvdXJjZSByYXkuXG4gICAgICovXG4gICAgZ2V0T3JpZ2luKCkge1xuICAgICAgICB0aGlzLl91cGRhdGVSYXlUcmFuc2Zvcm1zKCk7XG4gICAgICAgIHJldHVybiB0aGlzLl9yYXkub3JpZ2luO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2UgZGlyZWN0aW9uIG9mIGlucHV0IHNvdXJjZSByYXkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIGRpcmVjdGlvbiBvZiBpbnB1dCBzb3VyY2UgcmF5LlxuICAgICAqL1xuICAgIGdldERpcmVjdGlvbigpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlUmF5VHJhbnNmb3JtcygpO1xuICAgICAgICByZXR1cm4gdGhpcy5fcmF5LmRpcmVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0cyB0byBzdGFydCBoaXQgdGVzdCBzb3VyY2UgYmFzZWQgb24gdGhpcyBpbnB1dCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IGZvciBwYXNzaW5nIG9wdGlvbmFsIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBbb3B0aW9ucy5lbnRpdHlUeXBlc10gLSBPcHRpb25hbCBsaXN0IG9mIHVuZGVybHlpbmcgZW50aXR5IHR5cGVzIGFnYWluc3RcbiAgICAgKiB3aGljaCBoaXQgdGVzdHMgd2lsbCBiZSBwZXJmb3JtZWQuIERlZmF1bHRzIHRvIFsge0BsaW5rIFhSVFJBQ0tBQkxFX1BMQU5FfSBdLiBDYW4gYmUgYW55XG4gICAgICogY29tYmluYXRpb24gb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFhSVFJBQ0tBQkxFX1BPSU5UfTogUG9pbnQgLSBpbmRpY2F0ZXMgdGhhdCB0aGUgaGl0IHRlc3QgcmVzdWx0cyB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogYmFzZWQgb24gdGhlIGZlYXR1cmUgcG9pbnRzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9QTEFORX06IFBsYW5lIC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBwbGFuZXMgZGV0ZWN0ZWQgYnkgdGhlIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICAgICAqIC0ge0BsaW5rIFhSVFJBQ0tBQkxFX01FU0h9OiBNZXNoIC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBtZXNoZXMgZGV0ZWN0ZWQgYnkgdGhlIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSYXl9IFtvcHRpb25zLm9mZnNldFJheV0gLSBPcHRpb25hbCByYXkgYnkgd2hpY2ggaGl0IHRlc3QgcmF5IGNhbiBiZSBvZmZzZXQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItaGl0LXRlc3QuanMnKS5YckhpdFRlc3RTdGFydENhbGxiYWNrfSBbb3B0aW9ucy5jYWxsYmFja10gLSBPcHRpb25hbFxuICAgICAqIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBvbmNlIGhpdCB0ZXN0IHNvdXJjZSBpcyBjcmVhdGVkIG9yIGZhaWxlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5pbnB1dC5vbignYWRkJywgZnVuY3Rpb24gKGlucHV0U291cmNlKSB7XG4gICAgICogICAgIGlucHV0U291cmNlLmhpdFRlc3RTdGFydCh7XG4gICAgICogICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVyciwgaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAgICAgICAgIGlmIChlcnIpIHJldHVybjtcbiAgICAgKiAgICAgICAgICAgICBoaXRUZXN0U291cmNlLm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocG9zaXRpb24sIHJvdGF0aW9uKSB7XG4gICAgICogICAgICAgICAgICAgICAgIC8vIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiBoaXQgdGVzdCByZXN1bHRcbiAgICAgKiAgICAgICAgICAgICAgICAgLy8gdGhhdCB3aWxsIGJlIGNyZWF0ZWQgZnJvbSB0b3VjaCBvbiBtb2JpbGUgZGV2aWNlc1xuICAgICAqICAgICAgICAgICAgIH0pO1xuICAgICAqICAgICAgICAgfVxuICAgICAqICAgICB9KTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBoaXRUZXN0U3RhcnQob3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIG9wdGlvbnMucHJvZmlsZSA9IHRoaXMuX3hySW5wdXRTb3VyY2UucHJvZmlsZXNbMF07XG5cbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBvcHRpb25zLmNhbGxiYWNrO1xuICAgICAgICBvcHRpb25zLmNhbGxiYWNrID0gKGVyciwgaGl0VGVzdFNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGhpdFRlc3RTb3VyY2UpIHRoaXMub25IaXRUZXN0U291cmNlQWRkKGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIsIGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX21hbmFnZXIuaGl0VGVzdC5zdGFydChvcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1oaXQtdGVzdC1zb3VyY2UuanMnKS5YckhpdFRlc3RTb3VyY2V9IGhpdFRlc3RTb3VyY2UgLSBIaXQgdGVzdCBzb3VyY2VcbiAgICAgKiB0byBiZSBhZGRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uSGl0VGVzdFNvdXJjZUFkZChoaXRUZXN0U291cmNlKSB7XG4gICAgICAgIHRoaXMuX2hpdFRlc3RTb3VyY2VzLnB1c2goaGl0VGVzdFNvdXJjZSk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdoaXR0ZXN0OmFkZCcsIGhpdFRlc3RTb3VyY2UpO1xuXG4gICAgICAgIGhpdFRlc3RTb3VyY2Uub24oJ3Jlc3VsdCcsIGZ1bmN0aW9uIChwb3NpdGlvbiwgcm90YXRpb24sIGlucHV0U291cmNlKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXRTb3VyY2UgIT09IHRoaXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2hpdHRlc3Q6cmVzdWx0JywgaGl0VGVzdFNvdXJjZSwgcG9zaXRpb24sIHJvdGF0aW9uKTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIGhpdFRlc3RTb3VyY2Uub25jZSgncmVtb3ZlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5vbkhpdFRlc3RTb3VyY2VSZW1vdmUoaGl0VGVzdFNvdXJjZSk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2hpdHRlc3Q6cmVtb3ZlJywgaGl0VGVzdFNvdXJjZSk7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWhpdC10ZXN0LXNvdXJjZS5qcycpLlhySGl0VGVzdFNvdXJjZX0gaGl0VGVzdFNvdXJjZSAtIEhpdCB0ZXN0IHNvdXJjZVxuICAgICAqIHRvIGJlIHJlbW92ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkhpdFRlc3RTb3VyY2VSZW1vdmUoaGl0VGVzdFNvdXJjZSkge1xuICAgICAgICBjb25zdCBpbmQgPSB0aGlzLl9oaXRUZXN0U291cmNlcy5pbmRleE9mKGhpdFRlc3RTb3VyY2UpO1xuICAgICAgICBpZiAoaW5kICE9PSAtMSkgdGhpcy5faGl0VGVzdFNvdXJjZXMuc3BsaWNlKGluZCwgMSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBYcklucHV0U291cmNlIH07XG4iXSwibmFtZXMiOlsicXVhdCIsIlF1YXQiLCJpZHMiLCJYcklucHV0U291cmNlIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJtYW5hZ2VyIiwieHJJbnB1dFNvdXJjZSIsIl9pZCIsIl9tYW5hZ2VyIiwiX3hySW5wdXRTb3VyY2UiLCJfcmF5IiwiUmF5IiwiX3JheUxvY2FsIiwiX2dyaXAiLCJfaGFuZCIsIl9sb2NhbFRyYW5zZm9ybSIsIl93b3JsZFRyYW5zZm9ybSIsIl9wb3NpdGlvbiIsIlZlYzMiLCJfcm90YXRpb24iLCJfbG9jYWxQb3NpdGlvbiIsIl9sb2NhbFJvdGF0aW9uIiwiX2RpcnR5TG9jYWwiLCJfZGlydHlSYXkiLCJfc2VsZWN0aW5nIiwiX3NxdWVlemluZyIsIl9lbGVtZW50SW5wdXQiLCJfZWxlbWVudEVudGl0eSIsIl9oaXRUZXN0U291cmNlcyIsImhhbmQiLCJYckhhbmQiLCJpZCIsImlucHV0U291cmNlIiwidGFyZ2V0UmF5TW9kZSIsImhhbmRlZG5lc3MiLCJwcm9maWxlcyIsImdyaXAiLCJnYW1lcGFkIiwic2VsZWN0aW5nIiwic3F1ZWV6aW5nIiwiZWxlbWVudElucHV0IiwidmFsdWUiLCJlbGVtZW50RW50aXR5IiwiaGl0VGVzdFNvdXJjZXMiLCJ1cGRhdGUiLCJmcmFtZSIsImdyaXBTcGFjZSIsImdyaXBQb3NlIiwiZ2V0UG9zZSIsIl9yZWZlcmVuY2VTcGFjZSIsIk1hdDQiLCJjb3B5IiwidHJhbnNmb3JtIiwicG9zaXRpb24iLCJvcmllbnRhdGlvbiIsInRhcmdldFJheVBvc2UiLCJ0YXJnZXRSYXlTcGFjZSIsIm9yaWdpbiIsImRpcmVjdGlvbiIsInNldCIsInRyYW5zZm9ybVZlY3RvciIsIl91cGRhdGVUcmFuc2Zvcm1zIiwic2V0VFJTIiwiT05FIiwicGFyZW50IiwiY2FtZXJhIiwibXVsMiIsImdldFdvcmxkVHJhbnNmb3JtIiwiX3VwZGF0ZVJheVRyYW5zZm9ybXMiLCJkaXJ0eSIsInBhcmVudFRyYW5zZm9ybSIsImdldFRyYW5zbGF0aW9uIiwic2V0RnJvbU1hdDQiLCJhZGQiLCJnZXRQb3NpdGlvbiIsImdldExvY2FsUG9zaXRpb24iLCJnZXRSb3RhdGlvbiIsImdldExvY2FsUm90YXRpb24iLCJnZXRPcmlnaW4iLCJnZXREaXJlY3Rpb24iLCJoaXRUZXN0U3RhcnQiLCJvcHRpb25zIiwicHJvZmlsZSIsImNhbGxiYWNrIiwiZXJyIiwiaGl0VGVzdFNvdXJjZSIsIm9uSGl0VGVzdFNvdXJjZUFkZCIsImhpdFRlc3QiLCJzdGFydCIsInB1c2giLCJmaXJlIiwib24iLCJyb3RhdGlvbiIsIm9uY2UiLCJvbkhpdFRlc3RTb3VyY2VSZW1vdmUiLCJpbmQiLCJpbmRleE9mIiwic3BsaWNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBUUEsTUFBTUEsSUFBSSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3ZCLElBQUlDLEdBQUcsR0FBRyxDQUFDLENBQUE7O0FBRVg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLGFBQWEsU0FBU0MsWUFBWSxDQUFDO0FBeUhyQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLE9BQU8sRUFBRUMsYUFBYSxFQUFFO0FBQ2hDLElBQUEsS0FBSyxFQUFFLENBQUE7QUFqSVg7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsR0FBRyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUg7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsUUFBUSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVI7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsY0FBYyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRWQ7QUFDSjtBQUNBO0FBQ0E7QUFISSxJQUFBLElBQUEsQ0FJQUMsSUFBSSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0FBRWhCO0FBQ0o7QUFDQTtBQUNBO0FBSEksSUFBQSxJQUFBLENBSUFDLFNBQVMsR0FBRyxJQUFJRCxHQUFHLEVBQUUsQ0FBQTtBQUVyQjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFFLENBQUFBLEtBQUssR0FBRyxLQUFLLENBQUE7QUFFYjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLEtBQUssR0FBRyxJQUFJLENBQUE7QUFFWjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLGVBQWUsR0FBRyxJ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
