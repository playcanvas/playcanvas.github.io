import { Vec3 } from '../math/vec3.js';

/**
 * An infinite plane. Internally it's represented in a parametric equation form:
 * ax + by + cz + distance = 0.
 */
class Plane {
  /**
   * Create a new Plane instance.
   *
   * @param {Vec3} [normal] - Normal of the plane. The constructor copies this parameter. Defaults
   * to {@link Vec3.UP}.
   * @param {number} [distance] - The distance from the plane to the origin, along its normal.
   * Defaults to 0.
   */
  constructor(normal = Vec3.UP, distance = 0) {
    /**
     * The normal of the plane.
     *
     * @readonly
     * @type {Vec3}
     */
    this.normal = new Vec3();
    /**
     * The distance from the plane to the origin, along its normal.
     *
     * @readonly
     * @type {number}
     */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9jb3JlL3NoYXBlL3BsYW5lLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9tYXRoL3ZlYzMuanMnO1xuXG4vKipcbiAqIEFuIGluZmluaXRlIHBsYW5lLiBJbnRlcm5hbGx5IGl0J3MgcmVwcmVzZW50ZWQgaW4gYSBwYXJhbWV0cmljIGVxdWF0aW9uIGZvcm06XG4gKiBheCArIGJ5ICsgY3ogKyBkaXN0YW5jZSA9IDAuXG4gKi9cbmNsYXNzIFBsYW5lIHtcbiAgICAvKipcbiAgICAgKiBUaGUgbm9ybWFsIG9mIHRoZSBwbGFuZS5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIG5vcm1hbCA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgcGxhbmUgdG8gdGhlIG9yaWdpbiwgYWxvbmcgaXRzIG5vcm1hbC5cbiAgICAgKlxuICAgICAqIEByZWFkb25seVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZGlzdGFuY2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUGxhbmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtub3JtYWxdIC0gTm9ybWFsIG9mIHRoZSBwbGFuZS4gVGhlIGNvbnN0cnVjdG9yIGNvcGllcyB0aGlzIHBhcmFtZXRlci4gRGVmYXVsdHNcbiAgICAgKiB0byB7QGxpbmsgVmVjMy5VUH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtkaXN0YW5jZV0gLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgcGxhbmUgdG8gdGhlIG9yaWdpbiwgYWxvbmcgaXRzIG5vcm1hbC5cbiAgICAgKiBEZWZhdWx0cyB0byAwLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5vcm1hbCA9IFZlYzMuVVAsIGRpc3RhbmNlID0gMCkge1xuICAgICAgICB0aGlzLm5vcm1hbC5jb3B5KG5vcm1hbCk7XG4gICAgICAgIHRoaXMuZGlzdGFuY2UgPSBkaXN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBwbGFuZSBiYXNlZCBvbiBhIHNwZWNpZmllZCBub3JtYWwgYW5kIGEgcG9pbnQgb24gdGhlIHBsYW5lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBwb2ludCAtIFRoZSBwb2ludCBvbiB0aGUgcGxhbmUuXG4gICAgICogQHBhcmFtIHtWZWMzfSBub3JtYWwgLSBUaGUgbm9ybWFsIG9mIHRoZSBwbGFuZS5cbiAgICAgKiBAcmV0dXJucyB7UGxhbmV9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIHNldEZyb21Qb2ludE5vcm1hbChwb2ludCwgbm9ybWFsKSB7XG4gICAgICAgIHRoaXMubm9ybWFsLmNvcHkobm9ybWFsKTtcbiAgICAgICAgdGhpcy5kaXN0YW5jZSA9IC10aGlzLm5vcm1hbC5kb3QocG9pbnQpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IGlmIHRoZSBwbGFuZSBpbnRlcnNlY3RzIGJldHdlZW4gdHdvIHBvaW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc3RhcnQgLSBTdGFydCBwb3NpdGlvbiBvZiBsaW5lLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gRW5kIHBvc2l0aW9uIG9mIGxpbmUuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gSWYgdGhlcmUgaXMgYW4gaW50ZXJzZWN0aW9uLCB0aGUgaW50ZXJzZWN0aW9uIHBvaW50IHdpbGwgYmUgY29waWVkXG4gICAgICogaW50byBoZXJlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZXJlIGlzIGFuIGludGVyc2VjdGlvbi5cbiAgICAgKi9cbiAgICBpbnRlcnNlY3RzTGluZShzdGFydCwgZW5kLCBwb2ludCkge1xuICAgICAgICBjb25zdCBkID0gdGhpcy5kaXN0YW5jZTtcbiAgICAgICAgY29uc3QgZDAgPSB0aGlzLm5vcm1hbC5kb3Qoc3RhcnQpICsgZDtcbiAgICAgICAgY29uc3QgZDEgPSB0aGlzLm5vcm1hbC5kb3QoZW5kKSArIGQ7XG5cbiAgICAgICAgY29uc3QgdCA9IGQwIC8gKGQwIC0gZDEpO1xuICAgICAgICBjb25zdCBpbnRlcnNlY3RzID0gdCA+PSAwICYmIHQgPD0gMTtcbiAgICAgICAgaWYgKGludGVyc2VjdHMgJiYgcG9pbnQpXG4gICAgICAgICAgICBwb2ludC5sZXJwKHN0YXJ0LCBlbmQsIHQpO1xuXG4gICAgICAgIHJldHVybiBpbnRlcnNlY3RzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgYSByYXkgaW50ZXJzZWN0cyB3aXRoIHRoZSBpbmZpbml0ZSBwbGFuZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3JheS5qcycpLlJheX0gcmF5IC0gUmF5IHRvIHRlc3QgYWdhaW5zdCAoZGlyZWN0aW9uIG11c3QgYmUgbm9ybWFsaXplZCkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gSWYgdGhlcmUgaXMgYW4gaW50ZXJzZWN0aW9uLCB0aGUgaW50ZXJzZWN0aW9uIHBvaW50IHdpbGwgYmUgY29waWVkXG4gICAgICogaW50byBoZXJlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZXJlIGlzIGFuIGludGVyc2VjdGlvbi5cbiAgICAgKi9cbiAgICBpbnRlcnNlY3RzUmF5KHJheSwgcG9pbnQpIHtcbiAgICAgICAgY29uc3QgZGVub21pbmF0b3IgPSB0aGlzLm5vcm1hbC5kb3QocmF5LmRpcmVjdGlvbik7XG4gICAgICAgIGlmIChkZW5vbWluYXRvciA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBjb25zdCB0ID0gLSh0aGlzLm5vcm1hbC5kb3QocmF5Lm9yaWdpbikgKyB0aGlzLmRpc3RhbmNlKSAvIGRlbm9taW5hdG9yO1xuICAgICAgICBpZiAodCA+PSAwICYmIHBvaW50KSB7XG4gICAgICAgICAgICBwb2ludC5jb3B5KHJheS5kaXJlY3Rpb24pLm11bFNjYWxhcih0KS5hZGQocmF5Lm9yaWdpbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdCA+PSAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2UgUGxhbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1BsYW5lfSBzcmMgLSBUaGUgUGxhbmUgdG8gY29weSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtQbGFuZX0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY29weShzcmMpIHtcbiAgICAgICAgdGhpcy5ub3JtYWwuY29weShzcmMubm9ybWFsKTtcbiAgICAgICAgdGhpcy5kaXN0YW5jZSA9IHNyYy5kaXN0YW5jZTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIGNsb25lIG9mIHRoZSBQbGFuZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIGR1cGxpY2F0ZSBQbGFuZS5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKCkuY29weSh0aGlzKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFBsYW5lIH07XG4iXSwibmFtZXMiOlsiUGxhbmUiLCJjb25zdHJ1Y3RvciIsIm5vcm1hbCIsIlZlYzMiLCJVUCIsImRpc3RhbmNlIiwiY29weSIsInNldEZyb21Qb2ludE5vcm1hbCIsInBvaW50IiwiZG90IiwiaW50ZXJzZWN0c0xpbmUiLCJzdGFydCIsImVuZCIsImQiLCJkMCIsImQxIiwidCIsImludGVyc2VjdHMiLCJsZXJwIiwiaW50ZXJzZWN0c1JheSIsInJheSIsImRlbm9taW5hdG9yIiwiZGlyZWN0aW9uIiwib3JpZ2luIiwibXVsU2NhbGFyIiwiYWRkIiwic3JjIiwiY2xvbmUiLCJjc3RyIl0sIm1hcHBpbmdzIjoiOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsS0FBSyxDQUFDO0FBaUJSO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsTUFBTSxHQUFHQyxJQUFJLENBQUNDLEVBQUUsRUFBRUMsUUFBUSxHQUFHLENBQUMsRUFBRTtBQXhCNUM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFILE1BQU0sR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUVuQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFMSSxJQUFBLElBQUEsQ0FNQUUsUUFBUSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBV0osSUFBQSxJQUFJLENBQUNILE1BQU0sQ0FBQ0ksSUFBSSxDQUFDSixNQUFNLENBQUMsQ0FBQTtJQUN4QixJQUFJLENBQUNHLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0FBQzVCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUUsRUFBQUEsa0JBQWtCQSxDQUFDQyxLQUFLLEVBQUVOLE1BQU0sRUFBRTtBQUM5QixJQUFBLElBQUksQ0FBQ0EsTUFBTSxDQUFDSSxJQUFJLENBQUNKLE1BQU0sQ0FBQyxDQUFBO0lBQ3hCLElBQUksQ0FBQ0csUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDSCxNQUFNLENBQUNPLEdBQUcsQ0FBQ0QsS0FBSyxDQUFDLENBQUE7QUFDdkMsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lFLEVBQUFBLGNBQWNBLENBQUNDLEtBQUssRUFBRUMsR0FBRyxFQUFFSixLQUFLLEVBQUU7QUFDOUIsSUFBQSxNQUFNSyxDQUFDLEdBQUcsSUFBSSxDQUFDUixRQUFRLENBQUE7SUFDdkIsTUFBTVMsRUFBRSxHQUFHLElBQUksQ0FBQ1osTUFBTSxDQUFDTyxHQUFHLENBQUNFLEtBQUssQ0FBQyxHQUFHRSxDQUFDLENBQUE7SUFDckMsTUFBTUUsRUFBRSxHQUFHLElBQUksQ0FBQ2IsTUFBTSxDQUFDTyxHQUFHLENBQUNHLEdBQUcsQ0FBQyxHQUFHQyxDQUFDLENBQUE7QUFFbkMsSUFBQSxNQUFNRyxDQUFDLEdBQUdGLEVBQUUsSUFBSUEsRUFBRSxHQUFHQyxFQUFFLENBQUMsQ0FBQTtJQUN4QixNQUFNRSxVQUFVLEdBQUdELENBQUMsSUFBSSxDQUFDLElBQUlBLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDbkMsSUFBQSxJQUFJQyxVQUFVLElBQUlULEtBQUssRUFDbkJBLEtBQUssQ0FBQ1UsSUFBSSxDQUFDUCxLQUFLLEVBQUVDLEdBQUcsRUFBRUksQ0FBQyxDQUFDLENBQUE7QUFFN0IsSUFBQSxPQUFPQyxVQUFVLENBQUE7QUFDckIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lFLEVBQUFBLGFBQWFBLENBQUNDLEdBQUcsRUFBRVosS0FBSyxFQUFFO0lBQ3RCLE1BQU1hLFdBQVcsR0FBRyxJQUFJLENBQUNuQixNQUFNLENBQUNPLEdBQUcsQ0FBQ1csR0FBRyxDQUFDRSxTQUFTLENBQUMsQ0FBQTtBQUNsRCxJQUFBLElBQUlELFdBQVcsS0FBSyxDQUFDLEVBQ2pCLE9BQU8sS0FBSyxDQUFBO0FBRWhCLElBQUEsTUFBTUwsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDZCxNQUFNLENBQUNPLEdBQUcsQ0FBQ1csR0FBRyxDQUFDRyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUNsQixRQUFRLENBQUMsR0FBR2dCLFdBQVcsQ0FBQTtBQUN0RSxJQUFBLElBQUlMLENBQUMsSUFBSSxDQUFDLElBQUlSLEtBQUssRUFBRTtBQUNqQkEsTUFBQUEsS0FBSyxDQUFDRixJQUFJLENBQUNjLEdBQUcsQ0FBQ0UsU0FBUyxDQUFDLENBQUNFLFNBQVMsQ0FBQ1IsQ0FBQyxDQUFDLENBQUNTLEdBQUcsQ0FBQ0wsR0FBRyxDQUFDRyxNQUFNLENBQUMsQ0FBQTtBQUMxRCxLQUFBO0lBRUEsT0FBT1AsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNqQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJVixJQUFJQSxDQUFDb0IsR0FBRyxFQUFFO0lBQ04sSUFBSSxDQUFDeEIsTUFBTSxDQUFDSSxJQUFJLENBQUNvQixHQUFHLENBQUN4QixNQUFNLENBQUMsQ0FBQTtBQUM1QixJQUFBLElBQUksQ0FBQ0csUUFBUSxHQUFHcUIsR0FBRyxDQUFDckIsUUFBUSxDQUFBO0FBQzVCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSXNCLEVBQUFBLEtBQUtBLEdBQUc7QUFDSjtBQUNBLElBQUEsTUFBTUMsSUFBSSxHQUFHLElBQUksQ0FBQzNCLFdBQVcsQ0FBQTtJQUM3QixPQUFPLElBQUkyQixJQUFJLEVBQUUsQ0FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNoQyxHQUFBO0FBQ0o7Ozs7In0=
