/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../math/vec3.js';

/**
 * An infinite ray.
 */
class Ray {
  /**
   * The starting point of the ray.
   *
   * @readonly
   * @type {Vec3}
   */

  /**
   * The direction of the ray.
   *
   * @readonly
   * @type {Vec3}
   */

  /**
   * Creates a new Ray instance. The ray is infinite, starting at a given origin and pointing in
   * a given direction.
   *
   * @param {Vec3} [origin] - The starting point of the ray. The constructor copies
   * this parameter. Defaults to the origin (0, 0, 0).
   * @param {Vec3} [direction] - The direction of the ray. The constructor copies
   * this parameter. Defaults to a direction down the world negative Z axis (0, 0, -1).
   * @example
   * // Create a new ray starting at the position of this entity and pointing down
   * // the entity's negative Z axis
   * var ray = new pc.Ray(this.entity.getPosition(), this.entity.forward);
   */
  constructor(origin, direction) {
    this.origin = new Vec3();
    this.direction = Vec3.FORWARD.clone();
    if (origin) {
      this.origin.copy(origin);
    }
    if (direction) {
      this.direction.copy(direction);
    }
  }

  /**
   * Sets origin and direction to the supplied vector values.
   *
   * @param {Vec3} origin - The starting point of the ray.
   * @param {Vec3} direction - The direction of the ray.
   * @returns {Ray} Self for chaining.
   */
  set(origin, direction) {
    this.origin.copy(origin);
    this.direction.copy(direction);
    return this;
  }

  /**
   * Copies the contents of a source Ray.
   *
   * @param {Ray} src - The Ray to copy from.
   * @returns {Ray} Self for chaining.
   */
  copy(src) {
    return this.set(src.origin, src.direction);
  }

  /**
   * Returns a clone of the Ray.
   *
   * @returns {this} A duplicate Ray.
   */
  clone() {
    return new this.constructor(this.origin, this.direction);
  }
}

export { Ray };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmF5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY29yZS9zaGFwZS9yYXkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL21hdGgvdmVjMy5qcyc7XG5cbi8qKlxuICogQW4gaW5maW5pdGUgcmF5LlxuICovXG5jbGFzcyBSYXkge1xuICAgIC8qKlxuICAgICAqIFRoZSBzdGFydGluZyBwb2ludCBvZiB0aGUgcmF5LlxuICAgICAqXG4gICAgICogQHJlYWRvbmx5XG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgb3JpZ2luID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXJlY3Rpb24gb2YgdGhlIHJheS5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIGRpcmVjdGlvbiA9IFZlYzMuRk9SV0FSRC5jbG9uZSgpO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBSYXkgaW5zdGFuY2UuIFRoZSByYXkgaXMgaW5maW5pdGUsIHN0YXJ0aW5nIGF0IGEgZ2l2ZW4gb3JpZ2luIGFuZCBwb2ludGluZyBpblxuICAgICAqIGEgZ2l2ZW4gZGlyZWN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbb3JpZ2luXSAtIFRoZSBzdGFydGluZyBwb2ludCBvZiB0aGUgcmF5LiBUaGUgY29uc3RydWN0b3IgY29waWVzXG4gICAgICogdGhpcyBwYXJhbWV0ZXIuIERlZmF1bHRzIHRvIHRoZSBvcmlnaW4gKDAsIDAsIDApLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW2RpcmVjdGlvbl0gLSBUaGUgZGlyZWN0aW9uIG9mIHRoZSByYXkuIFRoZSBjb25zdHJ1Y3RvciBjb3BpZXNcbiAgICAgKiB0aGlzIHBhcmFtZXRlci4gRGVmYXVsdHMgdG8gYSBkaXJlY3Rpb24gZG93biB0aGUgd29ybGQgbmVnYXRpdmUgWiBheGlzICgwLCAwLCAtMSkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBuZXcgcmF5IHN0YXJ0aW5nIGF0IHRoZSBwb3NpdGlvbiBvZiB0aGlzIGVudGl0eSBhbmQgcG9pbnRpbmcgZG93blxuICAgICAqIC8vIHRoZSBlbnRpdHkncyBuZWdhdGl2ZSBaIGF4aXNcbiAgICAgKiB2YXIgcmF5ID0gbmV3IHBjLlJheSh0aGlzLmVudGl0eS5nZXRQb3NpdGlvbigpLCB0aGlzLmVudGl0eS5mb3J3YXJkKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihvcmlnaW4sIGRpcmVjdGlvbikge1xuICAgICAgICBpZiAob3JpZ2luKSB7XG4gICAgICAgICAgICB0aGlzLm9yaWdpbi5jb3B5KG9yaWdpbik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRpcmVjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kaXJlY3Rpb24uY29weShkaXJlY3Rpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBvcmlnaW4gYW5kIGRpcmVjdGlvbiB0byB0aGUgc3VwcGxpZWQgdmVjdG9yIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gb3JpZ2luIC0gVGhlIHN0YXJ0aW5nIHBvaW50IG9mIHRoZSByYXkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBkaXJlY3Rpb24gLSBUaGUgZGlyZWN0aW9uIG9mIHRoZSByYXkuXG4gICAgICogQHJldHVybnMge1JheX0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgc2V0KG9yaWdpbiwgZGlyZWN0aW9uKSB7XG4gICAgICAgIHRoaXMub3JpZ2luLmNvcHkob3JpZ2luKTtcbiAgICAgICAgdGhpcy5kaXJlY3Rpb24uY29weShkaXJlY3Rpb24pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIFJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmF5fSBzcmMgLSBUaGUgUmF5IHRvIGNvcHkgZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7UmF5fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBjb3B5KHNyYykge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXQoc3JjLm9yaWdpbiwgc3JjLmRpcmVjdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIGNsb25lIG9mIHRoZSBSYXkuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBkdXBsaWNhdGUgUmF5LlxuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICByZXR1cm4gbmV3IHRoaXMuY29uc3RydWN0b3IodGhpcy5vcmlnaW4sIHRoaXMuZGlyZWN0aW9uKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFJheSB9O1xuIl0sIm5hbWVzIjpbIlJheSIsImNvbnN0cnVjdG9yIiwib3JpZ2luIiwiZGlyZWN0aW9uIiwiVmVjMyIsIkZPUldBUkQiLCJjbG9uZSIsImNvcHkiLCJzZXQiLCJzcmMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxHQUFHLENBQUM7QUFDTjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBTSxFQUFFQyxTQUFTLEVBQUU7QUFBQSxJQUFBLElBQUEsQ0F2Qi9CRCxNQUFNLEdBQUcsSUFBSUUsSUFBSSxFQUFFLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRbkJELFNBQVMsR0FBR0MsSUFBSSxDQUFDQyxPQUFPLENBQUNDLEtBQUssRUFBRSxDQUFBO0FBZ0I1QixJQUFBLElBQUlKLE1BQU0sRUFBRTtBQUNSLE1BQUEsSUFBSSxDQUFDQSxNQUFNLENBQUNLLElBQUksQ0FBQ0wsTUFBTSxDQUFDLENBQUE7QUFDNUIsS0FBQTtBQUNBLElBQUEsSUFBSUMsU0FBUyxFQUFFO0FBQ1gsTUFBQSxJQUFJLENBQUNBLFNBQVMsQ0FBQ0ksSUFBSSxDQUFDSixTQUFTLENBQUMsQ0FBQTtBQUNsQyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJSyxFQUFBQSxHQUFHLENBQUNOLE1BQU0sRUFBRUMsU0FBUyxFQUFFO0FBQ25CLElBQUEsSUFBSSxDQUFDRCxNQUFNLENBQUNLLElBQUksQ0FBQ0wsTUFBTSxDQUFDLENBQUE7QUFDeEIsSUFBQSxJQUFJLENBQUNDLFNBQVMsQ0FBQ0ksSUFBSSxDQUFDSixTQUFTLENBQUMsQ0FBQTtBQUM5QixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUksSUFBSSxDQUFDRSxHQUFHLEVBQUU7SUFDTixPQUFPLElBQUksQ0FBQ0QsR0FBRyxDQUFDQyxHQUFHLENBQUNQLE1BQU0sRUFBRU8sR0FBRyxDQUFDTixTQUFTLENBQUMsQ0FBQTtBQUM5QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUcsRUFBQUEsS0FBSyxHQUFHO0FBQ0osSUFBQSxPQUFPLElBQUksSUFBSSxDQUFDTCxXQUFXLENBQUMsSUFBSSxDQUFDQyxNQUFNLEVBQUUsSUFBSSxDQUFDQyxTQUFTLENBQUMsQ0FBQTtBQUM1RCxHQUFBO0FBQ0o7Ozs7In0=
