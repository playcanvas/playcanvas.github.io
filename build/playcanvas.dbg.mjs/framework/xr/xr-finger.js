/**
 * Represents finger with related joints and index.
 */
class XrFinger {
  /**
   * Create a new XrFinger instance.
   *
   * @param {number} index - Index of a finger.
   * @param {import('./xr-hand.js').XrHand} hand - Hand that finger relates to.
   * @hideconstructor
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItZmluZ2VyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3hyL3hyLWZpbmdlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlcHJlc2VudHMgZmluZ2VyIHdpdGggcmVsYXRlZCBqb2ludHMgYW5kIGluZGV4LlxuICovXG5jbGFzcyBYckZpbmdlciB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbmRleDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItaGFuZC5qcycpLlhySGFuZH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oYW5kO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi94ci1qb2ludC5qcycpLlhySm9pbnRbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9qb2ludHMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItam9pbnQuanMnKS5YckpvaW50fG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdGlwID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYckZpbmdlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluZGV4IG9mIGEgZmluZ2VyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3hyLWhhbmQuanMnKS5YckhhbmR9IGhhbmQgLSBIYW5kIHRoYXQgZmluZ2VyIHJlbGF0ZXMgdG8uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGluZGV4LCBoYW5kKSB7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuX2hhbmQgPSBoYW5kO1xuICAgICAgICB0aGlzLl9oYW5kLl9maW5nZXJzLnB1c2godGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5kZXggb2YgYSBmaW5nZXIsIG51bWVyYXRpb24gaXM6IHRodW1iLCBpbmRleCwgbWlkZGxlLCByaW5nLCBsaXR0bGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBpbmRleCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2luZGV4O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmQgdGhhdCBmaW5nZXIgcmVsYXRlcyB0by5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHItaGFuZC5qcycpLlhySGFuZH1cbiAgICAgKi9cbiAgICBnZXQgaGFuZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hhbmQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBqb2ludHMgdGhhdCByZWxhdGVzIHRvIHRoaXMgZmluZ2VyLCBzdGFydGluZyBmcm9tIGpvaW50IGNsb3Nlc3QgdG8gd3Jpc3QgYWxsIHRoZSB3YXlcbiAgICAgKiB0byB0aGUgdGlwIG9mIGEgZmluZ2VyLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi94ci1qb2ludC5qcycpLlhySm9pbnRbXX1cbiAgICAgKi9cbiAgICBnZXQgam9pbnRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fam9pbnRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRpcCBvZiBhIGZpbmdlciwgb3IgbnVsbCBpZiBub3QgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi94ci1qb2ludC5qcycpLlhySm9pbnR8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgdGlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGlwO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJGaW5nZXIgfTtcbiJdLCJuYW1lcyI6WyJYckZpbmdlciIsImNvbnN0cnVjdG9yIiwiaW5kZXgiLCJoYW5kIiwiX2luZGV4IiwiX2hhbmQiLCJfam9pbnRzIiwiX3RpcCIsIl9maW5nZXJzIiwicHVzaCIsImpvaW50cyIsInRpcCJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsUUFBUSxDQUFDO0FBeUJYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLEtBQUssRUFBRUMsSUFBSSxFQUFFO0FBL0J6QjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTjtBQUNKO0FBQ0E7QUFDQTtBQUhJLElBQUEsSUFBQSxDQUlBQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTDtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLE9BQU8sR0FBRyxFQUFFLENBQUE7QUFFWjtBQUNKO0FBQ0E7QUFDQTtJQUhJLElBSUFDLENBQUFBLElBQUksR0FBRyxJQUFJLENBQUE7SUFVUCxJQUFJLENBQUNILE1BQU0sR0FBR0YsS0FBSyxDQUFBO0lBQ25CLElBQUksQ0FBQ0csS0FBSyxHQUFHRixJQUFJLENBQUE7SUFDakIsSUFBSSxDQUFDRSxLQUFLLENBQUNHLFFBQVEsQ0FBQ0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2xDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlQLEtBQUtBLEdBQUc7SUFDUixPQUFPLElBQUksQ0FBQ0UsTUFBTSxDQUFBO0FBQ3RCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlELElBQUlBLEdBQUc7SUFDUCxPQUFPLElBQUksQ0FBQ0UsS0FBSyxDQUFBO0FBQ3JCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUssTUFBTUEsR0FBRztJQUNULE9BQU8sSUFBSSxDQUFDSixPQUFPLENBQUE7QUFDdkIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUssR0FBR0EsR0FBRztJQUNOLE9BQU8sSUFBSSxDQUFDSixJQUFJLENBQUE7QUFDcEIsR0FBQTtBQUNKOzs7OyJ9
