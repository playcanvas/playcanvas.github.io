/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../math/vec3.js';

/**
 * An infinite plane. Internally it's represented in a parametric equation form:
 * ax + by + cz + distance = 0.
 */
class Plane {
  /**
   * The normal of the plane.
   *
   * @readonly
   * @type {Vec3}
   */

  /**
   * The distance from the plane to the origin, along its normal.
   *
   * @readonly
   * @type {number}
   */

  /**
   * Create a new Plane instance.
   *
   * @param {Vec3} [normal] - Normal of the plane. The constructor copies this parameter. Defaults
   * to {@link Vec3#UP}.
   * @param {Vec3} [distance] - The distance from the plane to the origin, along its normal.
   * Defaults to 0.
   */
  constructor(normal = Vec3.UP, distance = 0) {
    this.normal = new Vec3();
    this.distance = void 0;
    this.normal.copy(normal);
    this.distance = distance;
  }

  /**
   * Sets the plane based on a specified normal and a point on the plane.
   *
   * @param {Vec3} point - The point on the plane.
   * @param {Vec3} normal - The normal of the plane.
   * @returns {Plane} Self for chaining.
   */
  setFromPointNormal(point, normal) {
    this.normal.copy(normal);
    this.distance = -this.normal.dot(point);
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
    const d = this.distance;
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
    const denominator = this.normal.dot(ray.direction);
    if (denominator === 0) return false;
    const t = -(this.normal.dot(ray.origin) + this.distance) / denominator;
    if (t >= 0 && point) {
      point.copy(ray.direction).mulScalar(t).add(ray.origin);
    }
    return t >= 0;
  }

  /**
   * Copies the contents of a source Plane.
   *
   * @param {Plane} src - The Plane to copy from.
   * @returns {Plane} Self for chaining.
   */
  copy(src) {
    this.normal.copy(src.normal);
    this.distance = src.distance;
    return this;
  }

  /**
   * Returns a clone of the Plane.
   *
   * @returns {this} A duplicate Plane.
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr().copy(this);
  }
}

export { Plane };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9jb3JlL3NoYXBlL3BsYW5lLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9tYXRoL3ZlYzMuanMnO1xuXG4vKipcbiAqIEFuIGluZmluaXRlIHBsYW5lLiBJbnRlcm5hbGx5IGl0J3MgcmVwcmVzZW50ZWQgaW4gYSBwYXJhbWV0cmljIGVxdWF0aW9uIGZvcm06XG4gKiBheCArIGJ5ICsgY3ogKyBkaXN0YW5jZSA9IDAuXG4gKi9cbmNsYXNzIFBsYW5lIHtcbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsIG9mIHRoZSBwbGFuZS5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIG5vcm1hbCA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgcGxhbmUgdG8gdGhlIG9yaWdpbiwgYWxvbmcgaXRzIG5vcm1hbC5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZGlzdGFuY2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUGxhbmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtub3JtYWxdIC0gTm9ybWFsIG9mIHRoZSBwbGFuZS4gVGhlIGNvbnN0cnVjdG9yIGNvcGllcyB0aGlzIHBhcmFtZXRlci4gRGVmYXVsdHNcbiAgICAgKiB0byB7QGxpbmsgVmVjMyNVUH0uXG4gICAgICogQHBhcmFtIHtWZWMzfSBbZGlzdGFuY2VdIC0gVGhlIGRpc3RhbmNlIGZyb20gdGhlIHBsYW5lIHRvIHRoZSBvcmlnaW4sIGFsb25nIGl0cyBub3JtYWwuXG4gICAgICogRGVmYXVsdHMgdG8gMC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihub3JtYWwgPSBWZWMzLlVQLCBkaXN0YW5jZSA9IDApIHtcbiAgICAgICAgdGhpcy5ub3JtYWwuY29weShub3JtYWwpO1xuICAgICAgICB0aGlzLmRpc3RhbmNlID0gZGlzdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgcGxhbmUgYmFzZWQgb24gYSBzcGVjaWZpZWQgbm9ybWFsIGFuZCBhIHBvaW50IG9uIHRoZSBwbGFuZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9pbnQgLSBUaGUgcG9pbnQgb24gdGhlIHBsYW5lLlxuICAgICAqIEBwYXJhbSB7VmVjM30gbm9ybWFsIC0gVGhlIG5vcm1hbCBvZiB0aGUgcGxhbmUuXG4gICAgICogQHJldHVybnMge1BsYW5lfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBzZXRGcm9tUG9pbnROb3JtYWwocG9pbnQsIG5vcm1hbCkge1xuICAgICAgICB0aGlzLm5vcm1hbC5jb3B5KG5vcm1hbCk7XG4gICAgICAgIHRoaXMuZGlzdGFuY2UgPSAtdGhpcy5ub3JtYWwuZG90KHBvaW50KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGVzdCBpZiB0aGUgcGxhbmUgaW50ZXJzZWN0cyBiZXR3ZWVuIHR3byBwb2ludHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gU3RhcnQgcG9zaXRpb24gb2YgbGluZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIEVuZCBwb3NpdGlvbiBvZiBsaW5lLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3BvaW50XSAtIElmIHRoZXJlIGlzIGFuIGludGVyc2VjdGlvbiwgdGhlIGludGVyc2VjdGlvbiBwb2ludCB3aWxsIGJlIGNvcGllZFxuICAgICAqIGludG8gaGVyZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGVyZSBpcyBhbiBpbnRlcnNlY3Rpb24uXG4gICAgICovXG4gICAgaW50ZXJzZWN0c0xpbmUoc3RhcnQsIGVuZCwgcG9pbnQpIHtcbiAgICAgICAgY29uc3QgZCA9IHRoaXMuZGlzdGFuY2U7XG4gICAgICAgIGNvbnN0IGQwID0gdGhpcy5ub3JtYWwuZG90KHN0YXJ0KSArIGQ7XG4gICAgICAgIGNvbnN0IGQxID0gdGhpcy5ub3JtYWwuZG90KGVuZCkgKyBkO1xuXG4gICAgICAgIGNvbnN0IHQgPSBkMCAvIChkMCAtIGQxKTtcbiAgICAgICAgY29uc3QgaW50ZXJzZWN0cyA9IHQgPj0gMCAmJiB0IDw9IDE7XG4gICAgICAgIGlmIChpbnRlcnNlY3RzICYmIHBvaW50KVxuICAgICAgICAgICAgcG9pbnQubGVycChzdGFydCwgZW5kLCB0KTtcblxuICAgICAgICByZXR1cm4gaW50ZXJzZWN0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IGlmIGEgcmF5IGludGVyc2VjdHMgd2l0aCB0aGUgaW5maW5pdGUgcGxhbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9yYXkuanMnKS5SYXl9IHJheSAtIFJheSB0byB0ZXN0IGFnYWluc3QgKGRpcmVjdGlvbiBtdXN0IGJlIG5vcm1hbGl6ZWQpLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3BvaW50XSAtIElmIHRoZXJlIGlzIGFuIGludGVyc2VjdGlvbiwgdGhlIGludGVyc2VjdGlvbiBwb2ludCB3aWxsIGJlIGNvcGllZFxuICAgICAqIGludG8gaGVyZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGVyZSBpcyBhbiBpbnRlcnNlY3Rpb24uXG4gICAgICovXG4gICAgaW50ZXJzZWN0c1JheShyYXksIHBvaW50KSB7XG4gICAgICAgIGNvbnN0IGRlbm9taW5hdG9yID0gdGhpcy5ub3JtYWwuZG90KHJheS5kaXJlY3Rpb24pO1xuICAgICAgICBpZiAoZGVub21pbmF0b3IgPT09IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgdCA9IC0odGhpcy5ub3JtYWwuZG90KHJheS5vcmlnaW4pICsgdGhpcy5kaXN0YW5jZSkgLyBkZW5vbWluYXRvcjtcbiAgICAgICAgaWYgKHQgPj0gMCAmJiBwb2ludCkge1xuICAgICAgICAgICAgcG9pbnQuY29weShyYXkuZGlyZWN0aW9uKS5tdWxTY2FsYXIodCkuYWRkKHJheS5vcmlnaW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHQgPj0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIFBsYW5lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtQbGFuZX0gc3JjIC0gVGhlIFBsYW5lIHRvIGNvcHkgZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7UGxhbmV9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIGNvcHkoc3JjKSB7XG4gICAgICAgIHRoaXMubm9ybWFsLmNvcHkoc3JjLm5vcm1hbCk7XG4gICAgICAgIHRoaXMuZGlzdGFuY2UgPSBzcmMuZGlzdGFuY2U7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBjbG9uZSBvZiB0aGUgUGxhbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBkdXBsaWNhdGUgUGxhbmUuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7dGhpc30gKi9cbiAgICAgICAgY29uc3QgY3N0ciA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgICAgIHJldHVybiBuZXcgY3N0cigpLmNvcHkodGhpcyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQbGFuZSB9O1xuIl0sIm5hbWVzIjpbIlBsYW5lIiwiY29uc3RydWN0b3IiLCJub3JtYWwiLCJWZWMzIiwiVVAiLCJkaXN0YW5jZSIsImNvcHkiLCJzZXRGcm9tUG9pbnROb3JtYWwiLCJwb2ludCIsImRvdCIsImludGVyc2VjdHNMaW5lIiwic3RhcnQiLCJlbmQiLCJkIiwiZDAiLCJkMSIsInQiLCJpbnRlcnNlY3RzIiwibGVycCIsImludGVyc2VjdHNSYXkiLCJyYXkiLCJkZW5vbWluYXRvciIsImRpcmVjdGlvbiIsIm9yaWdpbiIsIm11bFNjYWxhciIsImFkZCIsInNyYyIsImNsb25lIiwiY3N0ciJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsS0FBSyxDQUFDO0FBQ1I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLE1BQU0sR0FBR0MsSUFBSSxDQUFDQyxFQUFFLEVBQUVDLFFBQVEsR0FBRyxDQUFDLEVBQUU7QUFBQSxJQUFBLElBQUEsQ0FsQjVDSCxNQUFNLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRbkJFLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQVdKLElBQUEsSUFBSSxDQUFDSCxNQUFNLENBQUNJLElBQUksQ0FBQ0osTUFBTSxDQUFDLENBQUE7SUFDeEIsSUFBSSxDQUFDRyxRQUFRLEdBQUdBLFFBQVEsQ0FBQTtBQUM1QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lFLEVBQUFBLGtCQUFrQkEsQ0FBQ0MsS0FBSyxFQUFFTixNQUFNLEVBQUU7QUFDOUIsSUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ0ksSUFBSSxDQUFDSixNQUFNLENBQUMsQ0FBQTtJQUN4QixJQUFJLENBQUNHLFFBQVEsR0FBRyxDQUFDLElBQUksQ0FBQ0gsTUFBTSxDQUFDTyxHQUFHLENBQUNELEtBQUssQ0FBQyxDQUFBO0FBQ3ZDLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJRSxFQUFBQSxjQUFjQSxDQUFDQyxLQUFLLEVBQUVDLEdBQUcsRUFBRUosS0FBSyxFQUFFO0FBQzlCLElBQUEsTUFBTUssQ0FBQyxHQUFHLElBQUksQ0FBQ1IsUUFBUSxDQUFBO0lBQ3ZCLE1BQU1TLEVBQUUsR0FBRyxJQUFJLENBQUNaLE1BQU0sQ0FBQ08sR0FBRyxDQUFDRSxLQUFLLENBQUMsR0FBR0UsQ0FBQyxDQUFBO0lBQ3JDLE1BQU1FLEVBQUUsR0FBRyxJQUFJLENBQUNiLE1BQU0sQ0FBQ08sR0FBRyxDQUFDRyxHQUFHLENBQUMsR0FBR0MsQ0FBQyxDQUFBO0FBRW5DLElBQUEsTUFBTUcsQ0FBQyxHQUFHRixFQUFFLElBQUlBLEVBQUUsR0FBR0MsRUFBRSxDQUFDLENBQUE7SUFDeEIsTUFBTUUsVUFBVSxHQUFHRCxDQUFDLElBQUksQ0FBQyxJQUFJQSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ25DLElBQUEsSUFBSUMsVUFBVSxJQUFJVCxLQUFLLEVBQ25CQSxLQUFLLENBQUNVLElBQUksQ0FBQ1AsS0FBSyxFQUFFQyxHQUFHLEVBQUVJLENBQUMsQ0FBQyxDQUFBO0FBRTdCLElBQUEsT0FBT0MsVUFBVSxDQUFBO0FBQ3JCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJRSxFQUFBQSxhQUFhQSxDQUFDQyxHQUFHLEVBQUVaLEtBQUssRUFBRTtJQUN0QixNQUFNYSxXQUFXLEdBQUcsSUFBSSxDQUFDbkIsTUFBTSxDQUFDTyxHQUFHLENBQUNXLEdBQUcsQ0FBQ0UsU0FBUyxDQUFDLENBQUE7QUFDbEQsSUFBQSxJQUFJRCxXQUFXLEtBQUssQ0FBQyxFQUNqQixPQUFPLEtBQUssQ0FBQTtBQUVoQixJQUFBLE1BQU1MLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQ2QsTUFBTSxDQUFDTyxHQUFHLENBQUNXLEdBQUcsQ0FBQ0csTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDbEIsUUFBUSxDQUFDLEdBQUdnQixXQUFXLENBQUE7QUFDdEUsSUFBQSxJQUFJTCxDQUFDLElBQUksQ0FBQyxJQUFJUixLQUFLLEVBQUU7QUFDakJBLE1BQUFBLEtBQUssQ0FBQ0YsSUFBSSxDQUFDYyxHQUFHLENBQUNFLFNBQVMsQ0FBQyxDQUFDRSxTQUFTLENBQUNSLENBQUMsQ0FBQyxDQUFDUyxHQUFHLENBQUNMLEdBQUcsQ0FBQ0csTUFBTSxDQUFDLENBQUE7QUFDMUQsS0FBQTtJQUVBLE9BQU9QLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDakIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSVYsSUFBSUEsQ0FBQ29CLEdBQUcsRUFBRTtJQUNOLElBQUksQ0FBQ3hCLE1BQU0sQ0FBQ0ksSUFBSSxDQUFDb0IsR0FBRyxDQUFDeEIsTUFBTSxDQUFDLENBQUE7QUFDNUIsSUFBQSxJQUFJLENBQUNHLFFBQVEsR0FBR3FCLEdBQUcsQ0FBQ3JCLFFBQVEsQ0FBQTtBQUM1QixJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lzQixFQUFBQSxLQUFLQSxHQUFHO0FBQ0o7QUFDQSxJQUFBLE1BQU1DLElBQUksR0FBRyxJQUFJLENBQUMzQixXQUFXLENBQUE7QUFDN0IsSUFBQSxPQUFPLElBQUkyQixJQUFJLEVBQUUsQ0FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNoQyxHQUFBO0FBQ0o7Ozs7In0=
