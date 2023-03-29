/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class Key {
  constructor(time, position, rotation, scale) {
    this.time = time;
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
  }
}

/**
 * A animation node has a name and contains an array of keyframes.
 */
class Node {
  /**
   * Create a new Node instance.
   */
  constructor() {
    this._name = '';
    this._keys = [];
  }
}

/**
 * An animation is a sequence of keyframe arrays which map to the nodes of a skeletal hierarchy. It
 * controls how the nodes of the hierarchy are transformed over time.
 */
class Animation {
  /**
   * Human-readable name of the animation.
   *
   * @type {string}
   */

  /**
   * Duration of the animation in seconds.
   *
   * @type {number}
   */

  /**
   * Create a new Animation instance.
   */
  constructor() {
    this.name = '';
    this.duration = 0;
    this._nodes = [];
    this._nodeDict = {};
  }

  /**
   * Gets a {@link Node} by name.
   *
   * @param {string} name - The name of the {@link Node}.
   * @returns {Node} The {@link Node} with the specified name.
   */
  getNode(name) {
    return this._nodeDict[name];
  }

  /**
   * Adds a node to the internal nodes array.
   *
   * @param {Node} node - The node to add.
   */
  addNode(node) {
    this._nodes.push(node);
    this._nodeDict[node._name] = node;
  }

  /**
   * A read-only property to get array of animation nodes.
   *
   * @type {Node[]}
   */
  get nodes() {
    return this._nodes;
  }
}

export { Animation, Key, Node };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbWF0aW9uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvYW5pbWF0aW9uL2FuaW1hdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjbGFzcyBLZXkge1xuICAgIGNvbnN0cnVjdG9yKHRpbWUsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHtcbiAgICAgICAgdGhpcy50aW1lID0gdGltZTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICAgICAgICB0aGlzLnJvdGF0aW9uID0gcm90YXRpb247XG4gICAgICAgIHRoaXMuc2NhbGUgPSBzY2FsZTtcbiAgICB9XG59XG5cbi8qKlxuICogQSBhbmltYXRpb24gbm9kZSBoYXMgYSBuYW1lIGFuZCBjb250YWlucyBhbiBhcnJheSBvZiBrZXlmcmFtZXMuXG4gKi9cbmNsYXNzIE5vZGUge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBOb2RlIGluc3RhbmNlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLl9uYW1lID0gJyc7XG4gICAgICAgIHRoaXMuX2tleXMgPSBbXTtcbiAgICB9XG59XG5cbi8qKlxuICogQW4gYW5pbWF0aW9uIGlzIGEgc2VxdWVuY2Ugb2Yga2V5ZnJhbWUgYXJyYXlzIHdoaWNoIG1hcCB0byB0aGUgbm9kZXMgb2YgYSBza2VsZXRhbCBoaWVyYXJjaHkuIEl0XG4gKiBjb250cm9scyBob3cgdGhlIG5vZGVzIG9mIHRoZSBoaWVyYXJjaHkgYXJlIHRyYW5zZm9ybWVkIG92ZXIgdGltZS5cbiAqL1xuY2xhc3MgQW5pbWF0aW9uIHtcbiAgICAvKipcbiAgICAgKiBIdW1hbi1yZWFkYWJsZSBuYW1lIG9mIHRoZSBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWUgPSAnJztcblxuICAgIC8qKlxuICAgICAqIER1cmF0aW9uIG9mIHRoZSBhbmltYXRpb24gaW4gc2Vjb25kcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZHVyYXRpb24gPSAwO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEFuaW1hdGlvbiBpbnN0YW5jZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5fbm9kZXMgPSBbXTtcbiAgICAgICAgdGhpcy5fbm9kZURpY3QgPSB7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGEge0BsaW5rIE5vZGV9IGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB7QGxpbmsgTm9kZX0uXG4gICAgICogQHJldHVybnMge05vZGV9IFRoZSB7QGxpbmsgTm9kZX0gd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUuXG4gICAgICovXG4gICAgZ2V0Tm9kZShuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ub2RlRGljdFtuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbm9kZSB0byB0aGUgaW50ZXJuYWwgbm9kZXMgYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge05vZGV9IG5vZGUgLSBUaGUgbm9kZSB0byBhZGQuXG4gICAgICovXG4gICAgYWRkTm9kZShub2RlKSB7XG4gICAgICAgIHRoaXMuX25vZGVzLnB1c2gobm9kZSk7XG4gICAgICAgIHRoaXMuX25vZGVEaWN0W25vZGUuX25hbWVdID0gbm9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB0byBnZXQgYXJyYXkgb2YgYW5pbWF0aW9uIG5vZGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge05vZGVbXX1cbiAgICAgKi9cbiAgICBnZXQgbm9kZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ub2RlcztcbiAgICB9XG59XG5cbmV4cG9ydCB7IEFuaW1hdGlvbiwgS2V5LCBOb2RlIH07XG4iXSwibmFtZXMiOlsiS2V5IiwiY29uc3RydWN0b3IiLCJ0aW1lIiwicG9zaXRpb24iLCJyb3RhdGlvbiIsInNjYWxlIiwiTm9kZSIsIl9uYW1lIiwiX2tleXMiLCJBbmltYXRpb24iLCJuYW1lIiwiZHVyYXRpb24iLCJfbm9kZXMiLCJfbm9kZURpY3QiLCJnZXROb2RlIiwiYWRkTm9kZSIsIm5vZGUiLCJwdXNoIiwibm9kZXMiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsTUFBTUEsR0FBRyxDQUFDO0VBQ05DLFdBQVcsQ0FBQ0MsSUFBSSxFQUFFQyxRQUFRLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFO0lBQ3pDLElBQUksQ0FBQ0gsSUFBSSxHQUFHQSxJQUFJLENBQUE7SUFDaEIsSUFBSSxDQUFDQyxRQUFRLEdBQUdBLFFBQVEsQ0FBQTtJQUN4QixJQUFJLENBQUNDLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsS0FBSyxHQUFHQSxLQUFLLENBQUE7QUFDdEIsR0FBQTtBQUNKLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsSUFBSSxDQUFDO0FBQ1A7QUFDSjtBQUNBO0FBQ0lMLEVBQUFBLFdBQVcsR0FBRztJQUNWLElBQUksQ0FBQ00sS0FBSyxHQUFHLEVBQUUsQ0FBQTtJQUNmLElBQUksQ0FBQ0MsS0FBSyxHQUFHLEVBQUUsQ0FBQTtBQUNuQixHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLFNBQVMsQ0FBQztBQUNaO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDSVIsRUFBQUEsV0FBVyxHQUFHO0lBQUEsSUFaZFMsQ0FBQUEsSUFBSSxHQUFHLEVBQUUsQ0FBQTtJQUFBLElBT1RDLENBQUFBLFFBQVEsR0FBRyxDQUFDLENBQUE7SUFNUixJQUFJLENBQUNDLE1BQU0sR0FBRyxFQUFFLENBQUE7QUFDaEIsSUFBQSxJQUFJLENBQUNDLFNBQVMsR0FBRyxFQUFFLENBQUE7QUFDdkIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsT0FBTyxDQUFDSixJQUFJLEVBQUU7QUFDVixJQUFBLE9BQU8sSUFBSSxDQUFDRyxTQUFTLENBQUNILElBQUksQ0FBQyxDQUFBO0FBQy9CLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJSyxPQUFPLENBQUNDLElBQUksRUFBRTtBQUNWLElBQUEsSUFBSSxDQUFDSixNQUFNLENBQUNLLElBQUksQ0FBQ0QsSUFBSSxDQUFDLENBQUE7SUFDdEIsSUFBSSxDQUFDSCxTQUFTLENBQUNHLElBQUksQ0FBQ1QsS0FBSyxDQUFDLEdBQUdTLElBQUksQ0FBQTtBQUNyQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSSxFQUFBLElBQUlFLEtBQUssR0FBRztJQUNSLE9BQU8sSUFBSSxDQUFDTixNQUFNLENBQUE7QUFDdEIsR0FBQTtBQUNKOzs7OyJ9
