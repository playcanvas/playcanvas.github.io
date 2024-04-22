/**
 * Represents finger with related joints and index.
 *
 * @category XR
 */
class XrFinger {
  /**
   * Create a new XrFinger instance.
   *
   * @param {number} index - Index of a finger.
   * @param {import('./xr-hand.js').XrHand} hand - Hand that finger relates to.
   * @ignore
   */
  constructor(index, hand) {
    /**
     * @type {number}
     * @private
     */
    this._index = void 0;
    /**
     * @type {import('./xr-hand.js').XrHand}
     * @private
     */
    this._hand = void 0;
    /**
     * @type {import('./xr-joint.js').XrJoint[]}
     * @private
     */
    this._joints = [];
    /**
     * @type {import('./xr-joint.js').XrJoint|null}
     * @private
     */
    this._tip = null;
    this._index = index;
    this._hand = hand;
    this._hand._fingers.push(this);
  }

  /**
   * Index of a finger, numeration is: thumb, index, middle, ring, little.
   *
   * @type {number}
   */
  get index() {
    return this._index;
  }

  /**
   * Hand that finger relates to.
   *
   * @type {import('./xr-hand.js').XrHand}
   */
  get hand() {
    return this._hand;
  }

  /**
   * List of joints that relates to this finger, starting from joint closest to wrist all the way
   * to the tip of a finger.
   *
   * @type {import('./xr-joint.js').XrJoint[]}
   */
  get joints() {
    return this._joints;
  }

  /**
   * Tip of a finger, or null if not available.
   *
   * @type {import('./xr-joint.js').XrJoint|null}
   */
  get tip() {
    return this._tip;
  }
}

export { XrFinger };
