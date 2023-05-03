import { Vec2 } from '../../../core/math/vec2.js';

/**
 * AnimNodes are used to represent a single animation track in the current state. Each state can
 * contain multiple AnimNodes, in which case they are stored in a BlendTree hierarchy, which will
 * control the weight (contribution to the states final animation) of its child AnimNodes.
 *
 * @ignore
 */
class AnimNode {
  /**
   * Create a new AnimNode instance.
   *
   * @param {AnimState} state - The AnimState that this BlendTree belongs to.
   * @param {BlendTree|null} parent - The parent of the AnimNode. If not null, the AnimNode is
   * stored as part of a {@link BlendTree} hierarchy.
   * @param {string} name - The name of the AnimNode. Used when assigning a {@link AnimTrack} to
   * it.
   * @param {number[]|number} point - The coordinate/vector thats used to determine the weight of
   * this node when it's part of a {@link BlendTree}.
   * @param {number} [speed] - The speed that its {@link AnimTrack} should play at. Defaults to 1.
   */
  constructor(state, parent, name, point, speed = 1) {
    this._state = state;
    this._parent = parent;
    this._name = name;
    if (Array.isArray(point)) {
      this._point = new Vec2(point[0], point[1]);
      this._pointLength = this._point.length();
    } else {
      this._point = point;
      this._pointLength = point;
    }
    this._speed = speed;
    this._weightedSpeed = 1.0;
    this._weight = 1.0;
    this._animTrack = null;
  }
  get parent() {
    return this._parent;
  }
  get name() {
    return this._name;
  }
  get path() {
    return this._parent ? this._parent.path + '.' + this._name : this._name;
  }
  get point() {
    return this._point;
  }
  get pointLength() {
    return this._pointLength;
  }
  set weight(value) {
    this._weight = value;
  }
  get weight() {
    return this._parent ? this._parent.weight * this._weight : this._weight;
  }
  get normalizedWeight() {
    const totalWeight = this._state.totalWeight;
    if (totalWeight === 0.0) return 0.0;
    return this.weight / totalWeight;
  }
  get speed() {
    return this._weightedSpeed * this._speed;
  }
  get absoluteSpeed() {
    return Math.abs(this._speed);
  }
  set weightedSpeed(weightedSpeed) {
    this._weightedSpeed = weightedSpeed;
  }
  get weightedSpeed() {
    return this._weightedSpeed;
  }
  set animTrack(value) {
    this._animTrack = value;
  }
  get animTrack() {
    return this._animTrack;
  }
}

export { AnimNode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1ub2RlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2FuaW0vY29udHJvbGxlci9hbmltLW5vZGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcblxuLyoqXG4gKiBBbmltTm9kZXMgYXJlIHVzZWQgdG8gcmVwcmVzZW50IGEgc2luZ2xlIGFuaW1hdGlvbiB0cmFjayBpbiB0aGUgY3VycmVudCBzdGF0ZS4gRWFjaCBzdGF0ZSBjYW5cbiAqIGNvbnRhaW4gbXVsdGlwbGUgQW5pbU5vZGVzLCBpbiB3aGljaCBjYXNlIHRoZXkgYXJlIHN0b3JlZCBpbiBhIEJsZW5kVHJlZSBoaWVyYXJjaHksIHdoaWNoIHdpbGxcbiAqIGNvbnRyb2wgdGhlIHdlaWdodCAoY29udHJpYnV0aW9uIHRvIHRoZSBzdGF0ZXMgZmluYWwgYW5pbWF0aW9uKSBvZiBpdHMgY2hpbGQgQW5pbU5vZGVzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQW5pbU5vZGUge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltTm9kZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QW5pbVN0YXRlfSBzdGF0ZSAtIFRoZSBBbmltU3RhdGUgdGhhdCB0aGlzIEJsZW5kVHJlZSBiZWxvbmdzIHRvLlxuICAgICAqIEBwYXJhbSB7QmxlbmRUcmVlfG51bGx9IHBhcmVudCAtIFRoZSBwYXJlbnQgb2YgdGhlIEFuaW1Ob2RlLiBJZiBub3QgbnVsbCwgdGhlIEFuaW1Ob2RlIGlzXG4gICAgICogc3RvcmVkIGFzIHBhcnQgb2YgYSB7QGxpbmsgQmxlbmRUcmVlfSBoaWVyYXJjaHkuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgQW5pbU5vZGUuIFVzZWQgd2hlbiBhc3NpZ25pbmcgYSB7QGxpbmsgQW5pbVRyYWNrfSB0b1xuICAgICAqIGl0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW118bnVtYmVyfSBwb2ludCAtIFRoZSBjb29yZGluYXRlL3ZlY3RvciB0aGF0cyB1c2VkIHRvIGRldGVybWluZSB0aGUgd2VpZ2h0IG9mXG4gICAgICogdGhpcyBub2RlIHdoZW4gaXQncyBwYXJ0IG9mIGEge0BsaW5rIEJsZW5kVHJlZX0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzcGVlZF0gLSBUaGUgc3BlZWQgdGhhdCBpdHMge0BsaW5rIEFuaW1UcmFja30gc2hvdWxkIHBsYXkgYXQuIERlZmF1bHRzIHRvIDEuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3RhdGUsIHBhcmVudCwgbmFtZSwgcG9pbnQsIHNwZWVkID0gMSkge1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IHN0YXRlO1xuICAgICAgICB0aGlzLl9wYXJlbnQgPSBwYXJlbnQ7XG4gICAgICAgIHRoaXMuX25hbWUgPSBuYW1lO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwb2ludCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3BvaW50ID0gbmV3IFZlYzIocG9pbnRbMF0sIHBvaW50WzFdKTtcbiAgICAgICAgICAgIHRoaXMuX3BvaW50TGVuZ3RoID0gdGhpcy5fcG9pbnQubGVuZ3RoKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9wb2ludCA9IHBvaW50O1xuICAgICAgICAgICAgdGhpcy5fcG9pbnRMZW5ndGggPSBwb2ludDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NwZWVkID0gc3BlZWQ7XG4gICAgICAgIHRoaXMuX3dlaWdodGVkU3BlZWQgPSAxLjA7XG4gICAgICAgIHRoaXMuX3dlaWdodCA9IDEuMDtcbiAgICAgICAgdGhpcy5fYW5pbVRyYWNrID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgcGFyZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFyZW50O1xuICAgIH1cblxuICAgIGdldCBuYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbmFtZTtcbiAgICB9XG5cbiAgICBnZXQgcGF0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcmVudCA/IHRoaXMuX3BhcmVudC5wYXRoICsgJy4nICsgdGhpcy5fbmFtZSA6IHRoaXMuX25hbWU7XG4gICAgfVxuXG4gICAgZ2V0IHBvaW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcG9pbnQ7XG4gICAgfVxuXG4gICAgZ2V0IHBvaW50TGVuZ3RoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcG9pbnRMZW5ndGg7XG4gICAgfVxuXG4gICAgc2V0IHdlaWdodCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl93ZWlnaHQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgd2VpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFyZW50ID8gdGhpcy5fcGFyZW50LndlaWdodCAqIHRoaXMuX3dlaWdodCA6IHRoaXMuX3dlaWdodDtcbiAgICB9XG5cbiAgICBnZXQgbm9ybWFsaXplZFdlaWdodCgpIHtcbiAgICAgICAgY29uc3QgdG90YWxXZWlnaHQgPSB0aGlzLl9zdGF0ZS50b3RhbFdlaWdodDtcbiAgICAgICAgaWYgKHRvdGFsV2VpZ2h0ID09PSAwLjApIHJldHVybiAwLjA7XG4gICAgICAgIHJldHVybiB0aGlzLndlaWdodCAvIHRvdGFsV2VpZ2h0O1xuICAgIH1cblxuICAgIGdldCBzcGVlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dlaWdodGVkU3BlZWQgKiB0aGlzLl9zcGVlZDtcbiAgICB9XG5cbiAgICBnZXQgYWJzb2x1dGVTcGVlZCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguYWJzKHRoaXMuX3NwZWVkKTtcbiAgICB9XG5cbiAgICBzZXQgd2VpZ2h0ZWRTcGVlZCh3ZWlnaHRlZFNwZWVkKSB7XG4gICAgICAgIHRoaXMuX3dlaWdodGVkU3BlZWQgPSB3ZWlnaHRlZFNwZWVkO1xuICAgIH1cblxuICAgIGdldCB3ZWlnaHRlZFNwZWVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2VpZ2h0ZWRTcGVlZDtcbiAgICB9XG5cbiAgICBzZXQgYW5pbVRyYWNrKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FuaW1UcmFjayA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhbmltVHJhY2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmltVHJhY2s7XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltTm9kZSB9O1xuIl0sIm5hbWVzIjpbIkFuaW1Ob2RlIiwiY29uc3RydWN0b3IiLCJzdGF0ZSIsInBhcmVudCIsIm5hbWUiLCJwb2ludCIsInNwZWVkIiwiX3N0YXRlIiwiX3BhcmVudCIsIl9uYW1lIiwiQXJyYXkiLCJpc0FycmF5IiwiX3BvaW50IiwiVmVjMiIsIl9wb2ludExlbmd0aCIsImxlbmd0aCIsIl9zcGVlZCIsIl93ZWlnaHRlZFNwZWVkIiwiX3dlaWdodCIsIl9hbmltVHJhY2siLCJwYXRoIiwicG9pbnRMZW5ndGgiLCJ3ZWlnaHQiLCJ2YWx1ZSIsIm5vcm1hbGl6ZWRXZWlnaHQiLCJ0b3RhbFdlaWdodCIsImFic29sdXRlU3BlZWQiLCJNYXRoIiwiYWJzIiwid2VpZ2h0ZWRTcGVlZCIsImFuaW1UcmFjayJdLCJtYXBwaW5ncyI6Ijs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFFBQVEsQ0FBQztBQUNYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxLQUFLLEVBQUVDLE1BQU0sRUFBRUMsSUFBSSxFQUFFQyxLQUFLLEVBQUVDLEtBQUssR0FBRyxDQUFDLEVBQUU7SUFDL0MsSUFBSSxDQUFDQyxNQUFNLEdBQUdMLEtBQUssQ0FBQTtJQUNuQixJQUFJLENBQUNNLE9BQU8sR0FBR0wsTUFBTSxDQUFBO0lBQ3JCLElBQUksQ0FBQ00sS0FBSyxHQUFHTCxJQUFJLENBQUE7QUFDakIsSUFBQSxJ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
