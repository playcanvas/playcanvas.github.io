/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { Vec3 } from '../math/vec3.js';

class Ray {
  constructor(origin = new Vec3(), direction = new Vec3(0, 0, -1)) {
    Debug.assert(!Object.isFrozen(origin), 'The constructor of \'Ray\' does not accept a constant (frozen) object as a \'origin\' parameter');
    Debug.assert(!Object.isFrozen(direction), 'The constructor of \'Ray\' does not accept a constant (frozen) object as a \'direction\' parameter');
    this.origin = origin;
    this.direction = direction;
  }

  set(origin, direction) {
    this.origin.copy(origin);
    this.direction.copy(direction);
    return this;
  }

}

export { Ray };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmF5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2hhcGUvcmF5LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vbWF0aC92ZWMzLmpzJztcblxuLyoqXG4gKiBBbiBpbmZpbml0ZSByYXkuXG4gKi9cbmNsYXNzIFJheSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBSYXkgaW5zdGFuY2UuIFRoZSByYXkgaXMgaW5maW5pdGUsIHN0YXJ0aW5nIGF0IGEgZ2l2ZW4gb3JpZ2luIGFuZCBwb2ludGluZyBpblxuICAgICAqIGEgZ2l2ZW4gZGlyZWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbb3JpZ2luXSAtIFRoZSBzdGFydGluZyBwb2ludCBvZiB0aGUgcmF5LiBUaGUgY29uc3RydWN0b3IgdGFrZXMgYSByZWZlcmVuY2Ugb2ZcbiAgICAgKiB0aGlzIHBhcmFtZXRlci4gRGVmYXVsdHMgdG8gdGhlIG9yaWdpbiAoMCwgMCwgMCkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbZGlyZWN0aW9uXSAtIFRoZSBkaXJlY3Rpb24gb2YgdGhlIHJheS4gVGhlIGNvbnN0cnVjdG9yIHRha2VzIGEgcmVmZXJlbmNlIG9mXG4gICAgICogdGhpcyBwYXJhbWV0ZXIuIERlZmF1bHRzIHRvIGEgZGlyZWN0aW9uIGRvd24gdGhlIHdvcmxkIG5lZ2F0aXZlIFogYXhpcyAoMCwgMCwgLTEpLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgbmV3IHJheSBzdGFydGluZyBhdCB0aGUgcG9zaXRpb24gb2YgdGhpcyBlbnRpdHkgYW5kIHBvaW50aW5nIGRvd25cbiAgICAgKiAvLyB0aGUgZW50aXR5J3MgbmVnYXRpdmUgWiBheGlzXG4gICAgICogdmFyIHJheSA9IG5ldyBwYy5SYXkodGhpcy5lbnRpdHkuZ2V0UG9zaXRpb24oKSwgdGhpcy5lbnRpdHkuZm9yd2FyZCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3Iob3JpZ2luID0gbmV3IFZlYzMoKSwgZGlyZWN0aW9uID0gbmV3IFZlYzMoMCwgMCwgLTEpKSB7XG4gICAgICAgIERlYnVnLmFzc2VydCghT2JqZWN0LmlzRnJvemVuKG9yaWdpbiksICdUaGUgY29uc3RydWN0b3Igb2YgXFwnUmF5XFwnIGRvZXMgbm90IGFjY2VwdCBhIGNvbnN0YW50IChmcm96ZW4pIG9iamVjdCBhcyBhIFxcJ29yaWdpblxcJyBwYXJhbWV0ZXInKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCFPYmplY3QuaXNGcm96ZW4oZGlyZWN0aW9uKSwgJ1RoZSBjb25zdHJ1Y3RvciBvZiBcXCdSYXlcXCcgZG9lcyBub3QgYWNjZXB0IGEgY29uc3RhbnQgKGZyb3plbikgb2JqZWN0IGFzIGEgXFwnZGlyZWN0aW9uXFwnIHBhcmFtZXRlcicpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc3RhcnRpbmcgcG9pbnQgb2YgdGhlIHJheS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9yaWdpbiA9IG9yaWdpbjtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBkaXJlY3Rpb24gb2YgdGhlIHJheS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1ZlYzN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmRpcmVjdGlvbiA9IGRpcmVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIG9yaWdpbiBhbmQgZGlyZWN0aW9uIHRvIHRoZSBzdXBwbGllZCB2ZWN0b3IgdmFsdWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBvcmlnaW4gLSBUaGUgc3RhcnRpbmcgcG9pbnQgb2YgdGhlIHJheS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGRpcmVjdGlvbiAtIFRoZSBkaXJlY3Rpb24gb2YgdGhlIHJheS5cbiAgICAgKiBAcmV0dXJucyB7UmF5fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBzZXQob3JpZ2luLCBkaXJlY3Rpb24pIHtcbiAgICAgICAgdGhpcy5vcmlnaW4uY29weShvcmlnaW4pO1xuICAgICAgICB0aGlzLmRpcmVjdGlvbi5jb3B5KGRpcmVjdGlvbik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmF5IH07XG4iXSwibmFtZXMiOlsiUmF5IiwiY29uc3RydWN0b3IiLCJvcmlnaW4iLCJWZWMzIiwiZGlyZWN0aW9uIiwiRGVidWciLCJhc3NlcnQiLCJPYmplY3QiLCJpc0Zyb3plbiIsInNldCIsImNvcHkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBTUEsTUFBTUEsR0FBTixDQUFVO0FBY05DLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBTSxHQUFHLElBQUlDLElBQUosRUFBVixFQUFzQkMsU0FBUyxHQUFHLElBQUlELElBQUosQ0FBUyxDQUFULEVBQVksQ0FBWixFQUFlLENBQUMsQ0FBaEIsQ0FBbEMsRUFBc0Q7SUFDN0RFLEtBQUssQ0FBQ0MsTUFBTixDQUFhLENBQUNDLE1BQU0sQ0FBQ0MsUUFBUCxDQUFnQk4sTUFBaEIsQ0FBZCxFQUF1QyxpR0FBdkMsQ0FBQSxDQUFBO0lBQ0FHLEtBQUssQ0FBQ0MsTUFBTixDQUFhLENBQUNDLE1BQU0sQ0FBQ0MsUUFBUCxDQUFnQkosU0FBaEIsQ0FBZCxFQUEwQyxvR0FBMUMsQ0FBQSxDQUFBO0lBT0EsSUFBS0YsQ0FBQUEsTUFBTCxHQUFjQSxNQUFkLENBQUE7SUFNQSxJQUFLRSxDQUFBQSxTQUFMLEdBQWlCQSxTQUFqQixDQUFBO0FBQ0gsR0FBQTs7QUFTREssRUFBQUEsR0FBRyxDQUFDUCxNQUFELEVBQVNFLFNBQVQsRUFBb0I7QUFDbkIsSUFBQSxJQUFBLENBQUtGLE1BQUwsQ0FBWVEsSUFBWixDQUFpQlIsTUFBakIsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtFLFNBQUwsQ0FBZU0sSUFBZixDQUFvQk4sU0FBcEIsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxPQUFPLElBQVAsQ0FBQTtBQUNILEdBQUE7O0FBM0NLOzs7OyJ9
