import { platform } from '../../core/platform.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

const tipJointIds = platform.browser && window.XRHand ? ['thumb-tip', 'index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'] : [];
const tipJointIdsIndex = {};
for (let i = 0; i < tipJointIds.length; i++) {
  tipJointIdsIndex[tipJointIds[i]] = true;
}

/**
 * Represents the joint of a finger.
 *
 * @category XR
 */
class XrJoint {
  /**
   * Create an XrJoint instance.
   *
   * @param {number} index - Index of a joint within a finger.
   * @param {string} id - Id of a joint based on WebXR Hand Input Specs.
   * @param {import('./xr-hand.js').XrHand} hand - Hand that joint relates to.
   * @param {import('./xr-finger.js').XrFinger|null} finger - Finger that joint is related to.
   * Can be null in the case of the wrist joint.
   * @ignore
   */
  constructor(index, id, hand, finger = null) {
    /**
     * @type {number}
     * @private
     */
    this._index = void 0;
    /**
     * @type {string}
     * @private
     */
    this._id = void 0;
    /**
     * @type {import('./xr-hand.js').XrHand}
     * @private
     */
    this._hand = void 0;
    /**
     * @type {import('./xr-finger.js').XrFinger}
     * @private
     */
    this._finger = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._wrist = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._tip = void 0;
    /**
     * @type {number}
     * @private
     */
    this._radius = null;
    /**
     * @type {Mat4}
     * @private
     */
    this._localTransform = new Mat4();
    /**
     * @type {Mat4}
     * @private
     */
    this._worldTransform = new Mat4();
    /**
     * @type {Vec3}
     * @private
     */
    this._localPosition = new Vec3();
    /**
     * @type {Quat}
     * @private
     */
    this._localRotation = new Quat();
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
     * @type {boolean}
     * @private
     */
    this._dirtyLocal = true;
    this._index = index;
    this._id = id;
    this._hand = hand;
    this._finger = finger;
    this._wrist = id === 'wrist';
    this._tip = this._finger && !!tipJointIdsIndex[id];
  }

  /**
   * @param {*} pose - XRJointPose of this joint.
   * @ignore
   */
  update(pose) {
    this._dirtyLocal = true;
    this._radius = pose.radius;
    this._localPosition.copy(pose.transform.position);
    this._localRotation.copy(pose.transform.orientation);
  }

  /** @private */
  _updateTransforms() {
    if (this._dirtyLocal) {
      this._dirtyLocal = false;
      this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
    }
    const manager = this._hand._manager;
    const parent = manager.camera.parent;
    if (parent) {
      this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
    } else {
      this._worldTransform.copy(this._localTransform);
    }
  }

  /**
   * Get the world space position of a joint.
   *
   * @returns {Vec3} The world space position of a joint.
   */
  getPosition() {
    this._updateTransforms();
    this._worldTransform.getTranslation(this._position);
    return this._position;
  }

  /**
   * Get the world space rotation of a joint.
   *
   * @returns {Quat} The world space rotation of a joint.
   */
  getRotation() {
    this._updateTransforms();
    this._rotation.setFromMat4(this._worldTransform);
    return this._rotation;
  }

  /**
   * Index of a joint within a finger, starting from 0 (root of a finger) all the way to tip of
   * the finger.
   *
   * @type {number}
   */
  get index() {
    return this._index;
  }

  /**
   * Hand that joint relates to.
   *
   * @type {import('./xr-hand.js').XrHand}
   */
  get hand() {
    return this._hand;
  }

  /**
   * Finger that joint relates to.
   *
   * @type {import('./xr-finger.js').XrFinger|null}
   */
  get finger() {
    return this._finger;
  }

  /**
   * True if joint is a wrist.
   *
   * @type {boolean}
   */
  get wrist() {
    return this._wrist;
  }

  /**
   * True if joint is a tip of a finger.
   *
   * @type {boolean}
   */
  get tip() {
    return this._tip;
  }

  /**
   * The radius of a joint, which is a distance from joint to the edge of a skin.
   *
   * @type {number}
   */
  get radius() {
    return this._radius || 0.005;
  }
}

export { XrJoint };
