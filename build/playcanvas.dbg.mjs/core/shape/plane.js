/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();

/**
 * An infinite plane.
 *
 * @ignore
 */
class Plane {
  /**
   * The starting point of the plane.
   *
   * @readonly
   * @type {Vec3}
   */

  /**
   * The normal of the plane.
   *
   * @readonly
   * @type {Vec3}
   */

  /**
   * Create a new Plane instance.
   *
   * @param {Vec3} [point] - Point position on the plane. The constructor copies this parameter.
   * @param {Vec3} [normal] - Normal of the plane. The constructor copies this parameter.
   */
  constructor(point, normal) {
    this.point = new Vec3();
    this.normal = Vec3.BACK.clone();
    if (point) {
      this.point.copy(point);
    }
    if (normal) {
      this.normal.copy(normal);
    }
  }

  /**
   * Sets point and normal to the supplied vector values.
   *
   * @param {Vec3} point - The starting point of the plane.
   * @param {Vec3} normal - The normal of the plane.
   * @returns {Plane} Self for chaining.
   */
  set(point, normal) {
    this.point.copy(point);
    this.normal.copy(normal);
    return this;
  }

  /**
   * Test if the plane intersects between two points.
   *
   * @param {Vec3} start - Start position of line.
   * @param {Vec3} end - End position of line.
   * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
   * into here.
   * @returns {boolean} True if there is an intersection.
   */
  intersectsLine(start, end, point) {
    const d = -this.normal.dot(this.point);
    const d0 = this.normal.dot(start) + d;
    const d1 = this.normal.dot(end) + d;
    const t = d0 / (d0 - d1);
    const intersects = t >= 0 && t <= 1;
    if (intersects && point) point.lerp(start, end, t);
    return intersects;
  }

  /**
   * Test if a ray intersects with the infinite plane.
   *
   * @param {import('./ray.js').Ray} ray - Ray to test against (direction must be normalized).
   * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
   * into here.
   * @returns {boolean} True if there is an intersection.
   */
  intersectsRay(ray, point) {
    const pointToOrigin = tmpVecA.sub2(this.point, ray.origin);
    const t = this.normal.dot(pointToOrigin) / this.normal.dot(ray.direction);
    const intersects = t >= 0;
    if (intersects && point) point.copy(ray.direction).mulScalar(t).add(ray.origin);
    return intersects;
  }

  /**
   * Copies the contents of a source Plane.
   *
   * @param {Plane} src - The Plane to copy from.
   * @returns {Plane} Self for chaining.
   */
  copy(src) {
    return this.set(src.point, src.normal);
  }

  /**
   * Returns a clone of the Plane.
   *
   * @returns {this} A duplicate Plane.
   */
  clone() {
    return new this.constructor(this.point, this.normal);
  }
}

export { Plane };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9jb3JlL3NoYXBlL3BsYW5lLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9tYXRoL3ZlYzMuanMnO1xuXG5jb25zdCB0bXBWZWNBID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBBbiBpbmZpbml0ZSBwbGFuZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFBsYW5lIHtcbiAgICAvKipcbiAgICAgKiBUaGUgc3RhcnRpbmcgcG9pbnQgb2YgdGhlIHBsYW5lLlxuICAgICAqXG4gICAgICogQHJlYWRvbmx5XG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgcG9pbnQgPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqXG4gICAgICogVGhlIG5vcm1hbCBvZiB0aGUgcGxhbmUuXG4gICAgICpcbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKi9cbiAgICBub3JtYWwgPSBWZWMzLkJBQ0suY2xvbmUoKTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBQbGFuZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3BvaW50XSAtIFBvaW50IHBvc2l0aW9uIG9uIHRoZSBwbGFuZS4gVGhlIGNvbnN0cnVjdG9yIGNvcGllcyB0aGlzIHBhcmFtZXRlci5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtub3JtYWxdIC0gTm9ybWFsIG9mIHRoZSBwbGFuZS4gVGhlIGNvbnN0cnVjdG9yIGNvcGllcyB0aGlzIHBhcmFtZXRlci5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihwb2ludCwgbm9ybWFsKSB7XG4gICAgICAgIGlmIChwb2ludCkge1xuICAgICAgICAgICAgdGhpcy5wb2ludC5jb3B5KHBvaW50KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9ybWFsKSB7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbC5jb3B5KG5vcm1hbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHBvaW50IGFuZCBub3JtYWwgdG8gdGhlIHN1cHBsaWVkIHZlY3RvciB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHBvaW50IC0gVGhlIHN0YXJ0aW5nIHBvaW50IG9mIHRoZSBwbGFuZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG5vcm1hbCAtIFRoZSBub3JtYWwgb2YgdGhlIHBsYW5lLlxuICAgICAqIEByZXR1cm5zIHtQbGFuZX0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgc2V0KHBvaW50LCBub3JtYWwpIHtcbiAgICAgICAgdGhpcy5wb2ludC5jb3B5KHBvaW50KTtcbiAgICAgICAgdGhpcy5ub3JtYWwuY29weShub3JtYWwpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IGlmIHRoZSBwbGFuZSBpbnRlcnNlY3RzIGJldHdlZW4gdHdvIHBvaW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc3RhcnQgLSBTdGFydCBwb3NpdGlvbiBvZiBsaW5lLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gRW5kIHBvc2l0aW9uIG9mIGxpbmUuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gSWYgdGhlcmUgaXMgYW4gaW50ZXJzZWN0aW9uLCB0aGUgaW50ZXJzZWN0aW9uIHBvaW50IHdpbGwgYmUgY29waWVkXG4gICAgICogaW50byBoZXJlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZXJlIGlzIGFuIGludGVyc2VjdGlvbi5cbiAgICAgKi9cbiAgICBpbnRlcnNlY3RzTGluZShzdGFydCwgZW5kLCBwb2ludCkge1xuICAgICAgICBjb25zdCBkID0gLXRoaXMubm9ybWFsLmRvdCh0aGlzLnBvaW50KTtcbiAgICAgICAgY29uc3QgZDAgPSB0aGlzLm5vcm1hbC5kb3Qoc3RhcnQpICsgZDtcbiAgICAgICAgY29uc3QgZDEgPSB0aGlzLm5vcm1hbC5kb3QoZW5kKSArIGQ7XG5cbiAgICAgICAgY29uc3QgdCA9IGQwIC8gKGQwIC0gZDEpO1xuICAgICAgICBjb25zdCBpbnRlcnNlY3RzID0gdCA+PSAwICYmIHQgPD0gMTtcbiAgICAgICAgaWYgKGludGVyc2VjdHMgJiYgcG9pbnQpXG4gICAgICAgICAgICBwb2ludC5sZXJwKHN0YXJ0LCBlbmQsIHQpO1xuXG4gICAgICAgIHJldHVybiBpbnRlcnNlY3RzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgYSByYXkgaW50ZXJzZWN0cyB3aXRoIHRoZSBpbmZpbml0ZSBwbGFuZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JheS5qcycpLlJheX0gcmF5IC0gUmF5IHRvIHRlc3QgYWdhaW5zdCAoZGlyZWN0aW9uIG11c3QgYmUgbm9ybWFsaXplZCkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gSWYgdGhlcmUgaXMgYW4gaW50ZXJzZWN0aW9uLCB0aGUgaW50ZXJzZWN0aW9uIHBvaW50IHdpbGwgYmUgY29waWVkXG4gICAgICogaW50byBoZXJlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZXJlIGlzIGFuIGludGVyc2VjdGlvbi5cbiAgICAgKi9cbiAgICBpbnRlcnNlY3RzUmF5KHJheSwgcG9pbnQpIHtcbiAgICAgICAgY29uc3QgcG9pbnRUb09yaWdpbiA9IHRtcFZlY0Euc3ViMih0aGlzLnBvaW50LCByYXkub3JpZ2luKTtcbiAgICAgICAgY29uc3QgdCA9IHRoaXMubm9ybWFsLmRvdChwb2ludFRvT3JpZ2luKSAvIHRoaXMubm9ybWFsLmRvdChyYXkuZGlyZWN0aW9uKTtcbiAgICAgICAgY29uc3QgaW50ZXJzZWN0cyA9IHQgPj0gMDtcblxuICAgICAgICBpZiAoaW50ZXJzZWN0cyAmJiBwb2ludClcbiAgICAgICAgICAgIHBvaW50LmNvcHkocmF5LmRpcmVjdGlvbikubXVsU2NhbGFyKHQpLmFkZChyYXkub3JpZ2luKTtcblxuICAgICAgICByZXR1cm4gaW50ZXJzZWN0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIFBsYW5lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtQbGFuZX0gc3JjIC0gVGhlIFBsYW5lIHRvIGNvcHkgZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7UGxhbmV9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIGNvcHkoc3JjKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNldChzcmMucG9pbnQsIHNyYy5ub3JtYWwpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBjbG9uZSBvZiB0aGUgUGxhbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBkdXBsaWNhdGUgUGxhbmUuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3Rvcih0aGlzLnBvaW50LCB0aGlzLm5vcm1hbCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQbGFuZSB9O1xuIl0sIm5hbWVzIjpbInRtcFZlY0EiLCJWZWMzIiwiUGxhbmUiLCJjb25zdHJ1Y3RvciIsInBvaW50Iiwibm9ybWFsIiwiQkFDSyIsImNsb25lIiwiY29weSIsInNldCIsImludGVyc2VjdHNMaW5lIiwic3RhcnQiLCJlbmQiLCJkIiwiZG90IiwiZDAiLCJkMSIsInQiLCJpbnRlcnNlY3RzIiwibGVycCIsImludGVyc2VjdHNSYXkiLCJyYXkiLCJwb2ludFRvT3JpZ2luIiwic3ViMiIsIm9yaWdpbiIsImRpcmVjdGlvbiIsIm11bFNjYWxhciIsImFkZCIsInNyYyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBLE1BQU1BLE9BQU8sR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTs7QUFFMUI7QUFDQTtBQUNBO0FBQ0E7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
