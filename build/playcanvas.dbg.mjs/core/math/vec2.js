/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * A 2-dimensional vector.
 */
class Vec2 {
  /**
   * The first component of the vector.
   *
   * @type {number}
   */

  /**
   * The second component of the vector.
   *
   * @type {number}
   */

  /**
   * Create a new Vec2 instance.
   *
   * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 2, the
   * array will be used to populate all components.
   * @param {number} [y] - The y value. Defaults to 0.
   * @example
   * var v = new pc.Vec2(1, 2);
   */
  constructor(x = 0, y = 0) {
    this.x = void 0;
    this.y = void 0;
    if (x.length === 2) {
      this.x = x[0];
      this.y = x[1];
    } else {
      this.x = x;
      this.y = y;
    }
  }

  /**
   * Adds a 2-dimensional vector to another in place.
   *
   * @param {Vec2} rhs - The vector to add to the specified vector.
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(10, 10);
   * var b = new pc.Vec2(20, 20);
   *
   * a.add(b);
   *
   * // Outputs [30, 30]
   * console.log("The result of the addition is: " + a.toString());
   */
  add(rhs) {
    this.x += rhs.x;
    this.y += rhs.y;
    return this;
  }

  /**
   * Adds two 2-dimensional vectors together and returns the result.
   *
   * @param {Vec2} lhs - The first vector operand for the addition.
   * @param {Vec2} rhs - The second vector operand for the addition.
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(10, 10);
   * var b = new pc.Vec2(20, 20);
   * var r = new pc.Vec2();
   *
   * r.add2(a, b);
   * // Outputs [30, 30]
   *
   * console.log("The result of the addition is: " + r.toString());
   */
  add2(lhs, rhs) {
    this.x = lhs.x + rhs.x;
    this.y = lhs.y + rhs.y;
    return this;
  }

  /**
   * Adds a number to each element of a vector.
   *
   * @param {number} scalar - The number to add.
   * @returns {Vec2} Self for chaining.
   * @example
   * var vec = new pc.Vec2(3, 4);
   *
   * vec.addScalar(2);
   *
   * // Outputs [5, 6]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScalar(scalar) {
    this.x += scalar;
    this.y += scalar;
    return this;
  }

  /**
   * Returns an identical copy of the specified 2-dimensional vector.
   *
   * @returns {this} A 2-dimensional vector containing the result of the cloning.
   * @example
   * var v = new pc.Vec2(10, 20);
   * var vclone = v.clone();
   * console.log("The result of the cloning is: " + vclone.toString());
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr(this.x, this.y);
  }

  /**
   * Copies the contents of a source 2-dimensional vector to a destination 2-dimensional vector.
   *
   * @param {Vec2} rhs - A vector to copy to the specified vector.
   * @returns {Vec2} Self for chaining.
   * @example
   * var src = new pc.Vec2(10, 20);
   * var dst = new pc.Vec2();
   *
   * dst.copy(src);
   *
   * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
   */
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    return this;
  }

  /**
   * Returns the result of a cross product operation performed on the two specified 2-dimensional
   * vectors.
   *
   * @param {Vec2} rhs - The second 2-dimensional vector operand of the cross product.
   * @returns {number} The cross product of the two vectors.
   * @example
   * var right = new pc.Vec2(1, 0);
   * var up = new pc.Vec2(0, 1);
   * var crossProduct = right.cross(up);
   *
   * // Prints 1
   * console.log("The result of the cross product is: " + crossProduct);
   */
  cross(rhs) {
    return this.x * rhs.y - this.y * rhs.x;
  }

  /**
   * Returns the distance between the two specified 2-dimensional vectors.
   *
   * @param {Vec2} rhs - The second 2-dimensional vector to test.
   * @returns {number} The distance between the two vectors.
   * @example
   * var v1 = new pc.Vec2(5, 10);
   * var v2 = new pc.Vec2(10, 20);
   * var d = v1.distance(v2);
   * console.log("The distance between v1 and v2 is: " + d);
   */
  distance(rhs) {
    const x = this.x - rhs.x;
    const y = this.y - rhs.y;
    return Math.sqrt(x * x + y * y);
  }

  /**
   * Divides a 2-dimensional vector by another in place.
   *
   * @param {Vec2} rhs - The vector to divide the specified vector by.
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(4, 9);
   * var b = new pc.Vec2(2, 3);
   *
   * a.div(b);
   *
   * // Outputs [2, 3]
   * console.log("The result of the division is: " + a.toString());
   */
  div(rhs) {
    this.x /= rhs.x;
    this.y /= rhs.y;
    return this;
  }

  /**
   * Divides one 2-dimensional vector by another and writes the result to the specified vector.
   *
   * @param {Vec2} lhs - The dividend vector (the vector being divided).
   * @param {Vec2} rhs - The divisor vector (the vector dividing the dividend).
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(4, 9);
   * var b = new pc.Vec2(2, 3);
   * var r = new pc.Vec2();
   *
   * r.div2(a, b);
   * // Outputs [2, 3]
   *
   * console.log("The result of the division is: " + r.toString());
   */
  div2(lhs, rhs) {
    this.x = lhs.x / rhs.x;
    this.y = lhs.y / rhs.y;
    return this;
  }

  /**
   * Divides each element of a vector by a number.
   *
   * @param {number} scalar - The number to divide by.
   * @returns {Vec2} Self for chaining.
   * @example
   * var vec = new pc.Vec2(3, 6);
   *
   * vec.divScalar(3);
   *
   * // Outputs [1, 2]
   * console.log("The result of the division is: " + vec.toString());
   */
  divScalar(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }

  /**
   * Returns the result of a dot product operation performed on the two specified 2-dimensional
   * vectors.
   *
   * @param {Vec2} rhs - The second 2-dimensional vector operand of the dot product.
   * @returns {number} The result of the dot product operation.
   * @example
   * var v1 = new pc.Vec2(5, 10);
   * var v2 = new pc.Vec2(10, 20);
   * var v1dotv2 = v1.dot(v2);
   * console.log("The result of the dot product is: " + v1dotv2);
   */
  dot(rhs) {
    return this.x * rhs.x + this.y * rhs.y;
  }

  /**
   * Reports whether two vectors are equal.
   *
   * @param {Vec2} rhs - The vector to compare to the specified vector.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * var a = new pc.Vec2(1, 2);
   * var b = new pc.Vec2(4, 5);
   * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y;
  }

  /**
   * Returns the magnitude of the specified 2-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 2-dimensional vector.
   * @example
   * var vec = new pc.Vec2(3, 4);
   * var len = vec.length();
   * // Outputs 5
   * console.log("The length of the vector is: " + len);
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /**
   * Returns the magnitude squared of the specified 2-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 2-dimensional vector.
   * @example
   * var vec = new pc.Vec2(3, 4);
   * var len = vec.lengthSq();
   * // Outputs 25
   * console.log("The length squared of the vector is: " + len);
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Returns the result of a linear interpolation between two specified 2-dimensional vectors.
   *
   * @param {Vec2} lhs - The 2-dimensional to interpolate from.
   * @param {Vec2} rhs - The 2-dimensional to interpolate to.
   * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
   * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
   * range, the linear interpolant will occur on a ray extrapolated from this line.
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(0, 0);
   * var b = new pc.Vec2(10, 10);
   * var r = new pc.Vec2();
   *
   * r.lerp(a, b, 0);   // r is equal to a
   * r.lerp(a, b, 0.5); // r is 5, 5
   * r.lerp(a, b, 1);   // r is equal to b
   */
  lerp(lhs, rhs, alpha) {
    this.x = lhs.x + alpha * (rhs.x - lhs.x);
    this.y = lhs.y + alpha * (rhs.y - lhs.y);
    return this;
  }

  /**
   * Multiplies a 2-dimensional vector to another in place.
   *
   * @param {Vec2} rhs - The 2-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(2, 3);
   * var b = new pc.Vec2(4, 5);
   *
   * a.mul(b);
   *
   * // Outputs 8, 15
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    this.x *= rhs.x;
    this.y *= rhs.y;
    return this;
  }

  /**
   * Returns the result of multiplying the specified 2-dimensional vectors together.
   *
   * @param {Vec2} lhs - The 2-dimensional vector used as the first multiplicand of the operation.
   * @param {Vec2} rhs - The 2-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(2, 3);
   * var b = new pc.Vec2(4, 5);
   * var r = new pc.Vec2();
   *
   * r.mul2(a, b);
   *
   * // Outputs 8, 15
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    this.x = lhs.x * rhs.x;
    this.y = lhs.y * rhs.y;
    return this;
  }

  /**
   * Multiplies each element of a vector by a number.
   *
   * @param {number} scalar - The number to multiply by.
   * @returns {Vec2} Self for chaining.
   * @example
   * var vec = new pc.Vec2(3, 6);
   *
   * vec.mulScalar(3);
   *
   * // Outputs [9, 18]
   * console.log("The result of the multiplication is: " + vec.toString());
   */
  mulScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  /**
   * Returns this 2-dimensional vector converted to a unit vector in place. If the vector has a
   * length of zero, the vector's elements will be set to zero.
   *
   * @returns {Vec2} Self for chaining.
   * @example
   * var v = new pc.Vec2(25, 0);
   *
   * v.normalize();
   *
   * // Outputs 1, 0
   * console.log("The result of the vector normalization is: " + v.toString());
   */
  normalize() {
    const lengthSq = this.x * this.x + this.y * this.y;
    if (lengthSq > 0) {
      const invLength = 1 / Math.sqrt(lengthSq);
      this.x *= invLength;
      this.y *= invLength;
    }
    return this;
  }

  /**
   * Each element is set to the largest integer less than or equal to its value.
   *
   * @returns {Vec2} Self for chaining.
   */
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
  }

  /**
   * Each element is rounded up to the next largest integer.
   *
   * @returns {Vec2} Self for chaining.
   */
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
  }

  /**
   * Each element is rounded up or down to the nearest integer.
   *
   * @returns {Vec2} Self for chaining.
   */
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is smaller.
   *
   * @param {Vec2} rhs - The 2-dimensional vector used as the source of elements to compare to.
   * @returns {Vec2} Self for chaining.
   */
  min(rhs) {
    if (rhs.x < this.x) this.x = rhs.x;
    if (rhs.y < this.y) this.y = rhs.y;
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is larger.
   *
   * @param {Vec2} rhs - The 2-dimensional vector used as the source of elements to compare to.
   * @returns {Vec2} Self for chaining.
   */
  max(rhs) {
    if (rhs.x > this.x) this.x = rhs.x;
    if (rhs.y > this.y) this.y = rhs.y;
    return this;
  }

  /**
   * Sets the specified 2-dimensional vector to the supplied numerical values.
   *
   * @param {number} x - The value to set on the first component of the vector.
   * @param {number} y - The value to set on the second component of the vector.
   * @returns {Vec2} Self for chaining.
   * @example
   * var v = new pc.Vec2();
   * v.set(5, 10);
   *
   * // Outputs 5, 10
   * console.log("The result of the vector set is: " + v.toString());
   */
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /**
   * Subtracts a 2-dimensional vector from another in place.
   *
   * @param {Vec2} rhs - The vector to subtract from the specified vector.
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(10, 10);
   * var b = new pc.Vec2(20, 20);
   *
   * a.sub(b);
   *
   * // Outputs [-10, -10]
   * console.log("The result of the subtraction is: " + a.toString());
   */
  sub(rhs) {
    this.x -= rhs.x;
    this.y -= rhs.y;
    return this;
  }

  /**
   * Subtracts two 2-dimensional vectors from one another and returns the result.
   *
   * @param {Vec2} lhs - The first vector operand for the subtraction.
   * @param {Vec2} rhs - The second vector operand for the subtraction.
   * @returns {Vec2} Self for chaining.
   * @example
   * var a = new pc.Vec2(10, 10);
   * var b = new pc.Vec2(20, 20);
   * var r = new pc.Vec2();
   *
   * r.sub2(a, b);
   *
   * // Outputs [-10, -10]
   * console.log("The result of the subtraction is: " + r.toString());
   */
  sub2(lhs, rhs) {
    this.x = lhs.x - rhs.x;
    this.y = lhs.y - rhs.y;
    return this;
  }

  /**
   * Subtracts a number from each element of a vector.
   *
   * @param {number} scalar - The number to subtract.
   * @returns {Vec2} Self for chaining.
   * @example
   * var vec = new pc.Vec2(3, 4);
   *
   * vec.subScalar(2);
   *
   * // Outputs [1, 2]
   * console.log("The result of the subtraction is: " + vec.toString());
   */
  subScalar(scalar) {
    this.x -= scalar;
    this.y -= scalar;
    return this;
  }

  /**
   * Converts the vector to string form.
   *
   * @returns {string} The vector in string form.
   * @example
   * var v = new pc.Vec2(20, 10);
   * // Outputs [20, 10]
   * console.log(v.toString());
   */
  toString() {
    return `[${this.x}, ${this.y}]`;
  }

  /**
   * Calculates the angle between two Vec2's in radians.
   *
   * @param {Vec2} lhs - The first vector operand for the calculation.
   * @param {Vec2} rhs - The second vector operand for the calculation.
   * @returns {number} The calculated angle in radians.
   * @ignore
   */
  static angleRad(lhs, rhs) {
    return Math.atan2(lhs.x * rhs.y - lhs.y * rhs.x, lhs.x * rhs.x + lhs.y * rhs.y);
  }

  /**
   * A constant vector set to [0, 0].
   *
   * @type {Vec2}
   * @readonly
   */
}
Vec2.ZERO = Object.freeze(new Vec2(0, 0));
Vec2.ONE = Object.freeze(new Vec2(1, 1));
Vec2.UP = Object.freeze(new Vec2(0, 1));
Vec2.DOWN = Object.freeze(new Vec2(0, -1));
Vec2.RIGHT = Object.freeze(new Vec2(1, 0));
Vec2.LEFT = Object.freeze(new Vec2(-1, 0));

export { Vec2 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVjMi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC92ZWMyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSAyLWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAqL1xuY2xhc3MgVmVjMiB7XG4gICAgLyoqXG4gICAgICogVGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB4O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNlY29uZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgeTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBWZWMyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW119IFt4XSAtIFRoZSB4IHZhbHVlLiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5IG9mIGxlbmd0aCAyLCB0aGVcbiAgICAgKiBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5IHZhbHVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMigxLCAyKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih4ID0gMCwgeSA9IDApIHtcbiAgICAgICAgaWYgKHgubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4WzBdO1xuICAgICAgICAgICAgdGhpcy55ID0geFsxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIDItZGltZW5zaW9uYWwgdmVjdG9yIHRvIGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSB2ZWN0b3IgdG8gYWRkIHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLlZlYzIoMTAsIDEwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5WZWMyKDIwLCAyMCk7XG4gICAgICpcbiAgICAgKiBhLmFkZChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzMwLCAzMF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkKHJocykge1xuICAgICAgICB0aGlzLnggKz0gcmhzLng7XG4gICAgICAgIHRoaXMueSArPSByaHMueTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHR3byAyLWRpbWVuc2lvbmFsIHZlY3RvcnMgdG9nZXRoZXIgYW5kIHJldHVybnMgdGhlIHJlc3VsdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gbGhzIC0gVGhlIGZpcnN0IHZlY3RvciBvcGVyYW5kIGZvciB0aGUgYWRkaXRpb24uXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgc2Vjb25kIHZlY3RvciBvcGVyYW5kIGZvciB0aGUgYWRkaXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjMigxMCwgMTApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzIoMjAsIDIwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5WZWMyKCk7XG4gICAgICpcbiAgICAgKiByLmFkZDIoYSwgYik7XG4gICAgICogLy8gT3V0cHV0cyBbMzAsIDMwXVxuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZDIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKyByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKyByaHMueTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbnVtYmVyIHRvIGVhY2ggZWxlbWVudCBvZiBhIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIGFkZC5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdmVjID0gbmV3IHBjLlZlYzIoMywgNCk7XG4gICAgICpcbiAgICAgKiB2ZWMuYWRkU2NhbGFyKDIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbNSwgNl1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGRTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCArPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSArPSBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBpZGVudGljYWwgY29weSBvZiB0aGUgc3BlY2lmaWVkIDItZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgMi1kaW1lbnNpb25hbCB2ZWN0b3IgY29udGFpbmluZyB0aGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMigxMCwgMjApO1xuICAgICAqIHZhciB2Y2xvbmUgPSB2LmNsb25lKCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nIGlzOiBcIiArIHZjbG9uZS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIDItZGltZW5zaW9uYWwgdmVjdG9yIHRvIGEgZGVzdGluYXRpb24gMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIEEgdmVjdG9yIHRvIGNvcHkgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNyYyA9IG5ldyBwYy5WZWMyKDEwLCAyMCk7XG4gICAgICogdmFyIGRzdCA9IG5ldyBwYy5WZWMyKCk7XG4gICAgICpcbiAgICAgKiBkc3QuY29weShzcmMpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHZlY3RvcnMgYXJlIFwiICsgKGRzdC5lcXVhbHMoc3JjKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBjb3B5KHJocykge1xuICAgICAgICB0aGlzLnggPSByaHMueDtcbiAgICAgICAgdGhpcy55ID0gcmhzLnk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIGEgY3Jvc3MgcHJvZHVjdCBvcGVyYXRpb24gcGVyZm9ybWVkIG9uIHRoZSB0d28gc3BlY2lmaWVkIDItZGltZW5zaW9uYWxcbiAgICAgKiB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgc2Vjb25kIDItZGltZW5zaW9uYWwgdmVjdG9yIG9wZXJhbmQgb2YgdGhlIGNyb3NzIHByb2R1Y3QuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGNyb3NzIHByb2R1Y3Qgb2YgdGhlIHR3byB2ZWN0b3JzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHJpZ2h0ID0gbmV3IHBjLlZlYzIoMSwgMCk7XG4gICAgICogdmFyIHVwID0gbmV3IHBjLlZlYzIoMCwgMSk7XG4gICAgICogdmFyIGNyb3NzUHJvZHVjdCA9IHJpZ2h0LmNyb3NzKHVwKTtcbiAgICAgKlxuICAgICAqIC8vIFByaW50cyAxXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBjcm9zcyBwcm9kdWN0IGlzOiBcIiArIGNyb3NzUHJvZHVjdCk7XG4gICAgICovXG4gICAgY3Jvc3MocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiByaHMueSAtIHRoaXMueSAqIHJocy54O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGRpc3RhbmNlIGJldHdlZW4gdGhlIHR3byBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgc2Vjb25kIDItZGltZW5zaW9uYWwgdmVjdG9yIHRvIHRlc3QuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGRpc3RhbmNlIGJldHdlZW4gdGhlIHR3byB2ZWN0b3JzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHYxID0gbmV3IHBjLlZlYzIoNSwgMTApO1xuICAgICAqIHZhciB2MiA9IG5ldyBwYy5WZWMyKDEwLCAyMCk7XG4gICAgICogdmFyIGQgPSB2MS5kaXN0YW5jZSh2Mik7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgZGlzdGFuY2UgYmV0d2VlbiB2MSBhbmQgdjIgaXM6IFwiICsgZCk7XG4gICAgICovXG4gICAgZGlzdGFuY2UocmhzKSB7XG4gICAgICAgIGNvbnN0IHggPSB0aGlzLnggLSByaHMueDtcbiAgICAgICAgY29uc3QgeSA9IHRoaXMueSAtIHJocy55O1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgYSAyLWRpbWVuc2lvbmFsIHZlY3RvciBieSBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgdmVjdG9yIHRvIGRpdmlkZSB0aGUgc3BlY2lmaWVkIHZlY3RvciBieS5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5WZWMyKDQsIDkpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzIoMiwgMyk7XG4gICAgICpcbiAgICAgKiBhLmRpdihiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzIsIDNdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBkaXZpc2lvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGRpdihyaHMpIHtcbiAgICAgICAgdGhpcy54IC89IHJocy54O1xuICAgICAgICB0aGlzLnkgLz0gcmhzLnk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGl2aWRlcyBvbmUgMi1kaW1lbnNpb25hbCB2ZWN0b3IgYnkgYW5vdGhlciBhbmQgd3JpdGVzIHRoZSByZXN1bHQgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IGxocyAtIFRoZSBkaXZpZGVuZCB2ZWN0b3IgKHRoZSB2ZWN0b3IgYmVpbmcgZGl2aWRlZCkuXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgZGl2aXNvciB2ZWN0b3IgKHRoZSB2ZWN0b3IgZGl2aWRpbmcgdGhlIGRpdmlkZW5kKS5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5WZWMyKDQsIDkpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzIoMiwgMyk7XG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjMigpO1xuICAgICAqXG4gICAgICogci5kaXYyKGEsIGIpO1xuICAgICAqIC8vIE91dHB1dHMgWzIsIDNdXG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZGl2MihsaHMsIHJocykge1xuICAgICAgICB0aGlzLnggPSBsaHMueCAvIHJocy54O1xuICAgICAgICB0aGlzLnkgPSBsaHMueSAvIHJocy55O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yIGJ5IGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gZGl2aWRlIGJ5LlxuICAgICAqIEByZXR1cm5zIHtWZWMyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ZWMgPSBuZXcgcGMuVmVjMigzLCA2KTtcbiAgICAgKlxuICAgICAqIHZlYy5kaXZTY2FsYXIoMyk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFsxLCAyXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZGl2aXNpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGRpdlNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54IC89IHNjYWxhcjtcbiAgICAgICAgdGhpcy55IC89IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgYSBkb3QgcHJvZHVjdCBvcGVyYXRpb24gcGVyZm9ybWVkIG9uIHRoZSB0d28gc3BlY2lmaWVkIDItZGltZW5zaW9uYWxcbiAgICAgKiB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgc2Vjb25kIDItZGltZW5zaW9uYWwgdmVjdG9yIG9wZXJhbmQgb2YgdGhlIGRvdCBwcm9kdWN0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSByZXN1bHQgb2YgdGhlIGRvdCBwcm9kdWN0IG9wZXJhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2MSA9IG5ldyBwYy5WZWMyKDUsIDEwKTtcbiAgICAgKiB2YXIgdjIgPSBuZXcgcGMuVmVjMigxMCwgMjApO1xuICAgICAqIHZhciB2MWRvdHYyID0gdjEuZG90KHYyKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRvdCBwcm9kdWN0IGlzOiBcIiArIHYxZG90djIpO1xuICAgICAqL1xuICAgIGRvdChyaHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCAqIHJocy54ICsgdGhpcy55ICogcmhzLnk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHR3byB2ZWN0b3JzIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIHZlY3RvciB0byBjb21wYXJlIHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSB2ZWN0b3JzIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjMigxLCAyKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5WZWMyKDQsIDUpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byB2ZWN0b3JzIGFyZSBcIiArIChhLmVxdWFscyhiKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggPT09IHJocy54ICYmIHRoaXMueSA9PT0gcmhzLnk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdmVjID0gbmV3IHBjLlZlYzIoMywgNCk7XG4gICAgICogdmFyIGxlbiA9IHZlYy5sZW5ndGgoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggb2YgdGhlIHZlY3RvciBpczogXCIgKyBsZW4pO1xuICAgICAqL1xuICAgIGxlbmd0aCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguc3FydCh0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG1hZ25pdHVkZSBzcXVhcmVkIG9mIHRoZSBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgMi1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdmVjID0gbmV3IHBjLlZlYzIoMywgNCk7XG4gICAgICogdmFyIGxlbiA9IHZlYy5sZW5ndGhTcSgpO1xuICAgICAqIC8vIE91dHB1dHMgMjVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggc3F1YXJlZCBvZiB0aGUgdmVjdG9yIGlzOiBcIiArIGxlbik7XG4gICAgICovXG4gICAgbGVuZ3RoU3EoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIGEgbGluZWFyIGludGVycG9sYXRpb24gYmV0d2VlbiB0d28gc3BlY2lmaWVkIDItZGltZW5zaW9uYWwgdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gbGhzIC0gVGhlIDItZGltZW5zaW9uYWwgdG8gaW50ZXJwb2xhdGUgZnJvbS5cbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSAyLWRpbWVuc2lvbmFsIHRvIGludGVycG9sYXRlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbHBoYSAtIFRoZSB2YWx1ZSBjb250cm9sbGluZyB0aGUgcG9pbnQgb2YgaW50ZXJwb2xhdGlvbi4gQmV0d2VlbiAwIGFuZCAxLFxuICAgICAqIHRoZSBsaW5lYXIgaW50ZXJwb2xhbnQgd2lsbCBvY2N1ciBvbiBhIHN0cmFpZ2h0IGxpbmUgYmV0d2VlbiBsaHMgYW5kIHJocy4gT3V0c2lkZSBvZiB0aGlzXG4gICAgICogcmFuZ2UsIHRoZSBsaW5lYXIgaW50ZXJwb2xhbnQgd2lsbCBvY2N1ciBvbiBhIHJheSBleHRyYXBvbGF0ZWQgZnJvbSB0aGlzIGxpbmUuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjMigwLCAwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5WZWMyKDEwLCAxMCk7XG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjMigpO1xuICAgICAqXG4gICAgICogci5sZXJwKGEsIGIsIDApOyAgIC8vIHIgaXMgZXF1YWwgdG8gYVxuICAgICAqIHIubGVycChhLCBiLCAwLjUpOyAvLyByIGlzIDUsIDVcbiAgICAgKiByLmxlcnAoYSwgYiwgMSk7ICAgLy8gciBpcyBlcXVhbCB0byBiXG4gICAgICovXG4gICAgbGVycChsaHMsIHJocywgYWxwaGEpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKyBhbHBoYSAqIChyaHMueCAtIGxocy54KTtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKyBhbHBoYSAqIChyaHMueSAtIGxocy55KTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBsaWVzIGEgMi1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjMn0gcmhzIC0gVGhlIDItZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5WZWMyKDIsIDMpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzIoNCwgNSk7XG4gICAgICpcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgOCwgMTVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsKHJocykge1xuICAgICAgICB0aGlzLnggKj0gcmhzLng7XG4gICAgICAgIHRoaXMueSAqPSByaHMueTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgbXVsdGlwbHlpbmcgdGhlIHNwZWNpZmllZCAyLWRpbWVuc2lvbmFsIHZlY3RvcnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IGxocyAtIFRoZSAyLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBmaXJzdCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSAyLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjMigyLCAzKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5WZWMyKDQsIDUpO1xuICAgICAqIHZhciByID0gbmV3IHBjLlZlYzIoKTtcbiAgICAgKlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgOCwgMTVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsMihsaHMsIHJocykge1xuICAgICAgICB0aGlzLnggPSBsaHMueCAqIHJocy54O1xuICAgICAgICB0aGlzLnkgPSBsaHMueSAqIHJocy55O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yIGJ5IGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gbXVsdGlwbHkgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHZlYyA9IG5ldyBwYy5WZWMyKDMsIDYpO1xuICAgICAqXG4gICAgICogdmVjLm11bFNjYWxhcigzKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzksIDE4XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bFNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy55ICo9IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoaXMgMi1kaW1lbnNpb25hbCB2ZWN0b3IgY29udmVydGVkIHRvIGEgdW5pdCB2ZWN0b3IgaW4gcGxhY2UuIElmIHRoZSB2ZWN0b3IgaGFzIGFcbiAgICAgKiBsZW5ndGggb2YgemVybywgdGhlIHZlY3RvcidzIGVsZW1lbnRzIHdpbGwgYmUgc2V0IHRvIHplcm8uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMyKDI1LCAwKTtcbiAgICAgKlxuICAgICAqIHYubm9ybWFsaXplKCk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIDEsIDBcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHZlY3RvciBub3JtYWxpemF0aW9uIGlzOiBcIiArIHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbm9ybWFsaXplKCkge1xuICAgICAgICBjb25zdCBsZW5ndGhTcSA9IHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueTtcbiAgICAgICAgaWYgKGxlbmd0aFNxID4gMCkge1xuICAgICAgICAgICAgY29uc3QgaW52TGVuZ3RoID0gMSAvIE1hdGguc3FydChsZW5ndGhTcSk7XG4gICAgICAgICAgICB0aGlzLnggKj0gaW52TGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy55ICo9IGludkxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyBzZXQgdG8gdGhlIGxhcmdlc3QgaW50ZWdlciBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gaXRzIHZhbHVlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIGZsb29yKCkge1xuICAgICAgICB0aGlzLnggPSBNYXRoLmZsb29yKHRoaXMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGguZmxvb3IodGhpcy55KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIHJvdW5kZWQgdXAgdG8gdGhlIG5leHQgbGFyZ2VzdCBpbnRlZ2VyLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIGNlaWwoKSB7XG4gICAgICAgIHRoaXMueCA9IE1hdGguY2VpbCh0aGlzLngpO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLmNlaWwodGhpcy55KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIHJvdW5kZWQgdXAgb3IgZG93biB0byB0aGUgbmVhcmVzdCBpbnRlZ2VyLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIHJvdW5kKCkge1xuICAgICAgICB0aGlzLnggPSBNYXRoLnJvdW5kKHRoaXMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGgucm91bmQodGhpcy55KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIGFzc2lnbmVkIGEgdmFsdWUgZnJvbSByaHMgcGFyYW1ldGVyIGlmIGl0IGlzIHNtYWxsZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSAyLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzb3VyY2Ugb2YgZWxlbWVudHMgdG8gY29tcGFyZSB0by5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgbWluKHJocykge1xuICAgICAgICBpZiAocmhzLnggPCB0aGlzLngpIHRoaXMueCA9IHJocy54O1xuICAgICAgICBpZiAocmhzLnkgPCB0aGlzLnkpIHRoaXMueSA9IHJocy55O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgYXNzaWduZWQgYSB2YWx1ZSBmcm9tIHJocyBwYXJhbWV0ZXIgaWYgaXQgaXMgbGFyZ2VyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgMi1kaW1lbnNpb25hbCB2ZWN0b3IgdXNlZCBhcyB0aGUgc291cmNlIG9mIGVsZW1lbnRzIHRvIGNvbXBhcmUgdG8uXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIG1heChyaHMpIHtcbiAgICAgICAgaWYgKHJocy54ID4gdGhpcy54KSB0aGlzLnggPSByaHMueDtcbiAgICAgICAgaWYgKHJocy55ID4gdGhpcy55KSB0aGlzLnkgPSByaHMueTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIDItZGltZW5zaW9uYWwgdmVjdG9yIHRvIHRoZSBzdXBwbGllZCBudW1lcmljYWwgdmFsdWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSBmaXJzdCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB2YWx1ZSB0byBzZXQgb24gdGhlIHNlY29uZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMyKCk7XG4gICAgICogdi5zZXQoNSwgMTApO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA1LCAxMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIGEgMi1kaW1lbnNpb25hbCB2ZWN0b3IgZnJvbSBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSByaHMgLSBUaGUgdmVjdG9yIHRvIHN1YnRyYWN0IGZyb20gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjMigxMCwgMTApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzIoMjAsIDIwKTtcbiAgICAgKlxuICAgICAqIGEuc3ViKGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbLTEwLCAtMTBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHN1YihyaHMpIHtcbiAgICAgICAgdGhpcy54IC09IHJocy54O1xuICAgICAgICB0aGlzLnkgLT0gcmhzLnk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIHR3byAyLWRpbWVuc2lvbmFsIHZlY3RvcnMgZnJvbSBvbmUgYW5vdGhlciBhbmQgcmV0dXJucyB0aGUgcmVzdWx0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSBsaHMgLSBUaGUgZmlyc3QgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBzdWJ0cmFjdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSBzZWNvbmQgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBzdWJ0cmFjdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjMn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5WZWMyKDEwLCAxMCk7XG4gICAgICogdmFyIGIgPSBuZXcgcGMuVmVjMigyMCwgMjApO1xuICAgICAqIHZhciByID0gbmV3IHBjLlZlYzIoKTtcbiAgICAgKlxuICAgICAqIHIuc3ViMihhLCBiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWy0xMCwgLTEwXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgc3VidHJhY3Rpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzdWIyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54IC0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55IC0gcmhzLnk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIGEgbnVtYmVyIGZyb20gZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gc3VidHJhY3QuXG4gICAgICogQHJldHVybnMge1ZlYzJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHZlYyA9IG5ldyBwYy5WZWMyKDMsIDQpO1xuICAgICAqXG4gICAgICogdmVjLnN1YlNjYWxhcigyKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzEsIDJdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgc3ViU2NhbGFyKHNjYWxhcikge1xuICAgICAgICB0aGlzLnggLT0gc2NhbGFyO1xuICAgICAgICB0aGlzLnkgLT0gc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSB2ZWN0b3IgdG8gc3RyaW5nIGZvcm0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgdmVjdG9yIGluIHN0cmluZyBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMigyMCwgMTApO1xuICAgICAqIC8vIE91dHB1dHMgWzIwLCAxMF1cbiAgICAgKiBjb25zb2xlLmxvZyh2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gYFske3RoaXMueH0sICR7dGhpcy55fV1gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZXMgdGhlIGFuZ2xlIGJldHdlZW4gdHdvIFZlYzIncyBpbiByYWRpYW5zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMyfSBsaHMgLSBUaGUgZmlyc3QgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBjYWxjdWxhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzJ9IHJocyAtIFRoZSBzZWNvbmQgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBjYWxjdWxhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgY2FsY3VsYXRlZCBhbmdsZSBpbiByYWRpYW5zLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGF0aWMgYW5nbGVSYWQobGhzLCByaHMpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguYXRhbjIobGhzLnggKiByaHMueSAtIGxocy55ICogcmhzLngsIGxocy54ICogcmhzLnggKyBsaHMueSAqIHJocy55KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzAsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFpFUk8gPSBPYmplY3QuZnJlZXplKG5ldyBWZWMyKDAsIDApKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMSwgMV0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjMn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgT05FID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMigxLCAxKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzAsIDFdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzJ9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFVQID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMigwLCAxKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzAsIC0xXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBET1dOID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMigwLCAtMSkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFsxLCAwXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMyfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBSSUdIVCA9IE9iamVjdC5mcmVlemUobmV3IFZlYzIoMSwgMCkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFstMSwgMF0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjMn1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgTEVGVCA9IE9iamVjdC5mcmVlemUobmV3IFZlYzIoLTEsIDApKTtcbn1cblxuZXhwb3J0IHsgVmVjMiB9O1xuIl0sIm5hbWVzIjpbIlZlYzIiLCJjb25zdHJ1Y3RvciIsIngiLCJ5IiwibGVuZ3RoIiwiYWRkIiwicmhzIiwiYWRkMiIsImxocyIsImFkZFNjYWxhciIsInNjYWxhciIsImNsb25lIiwiY3N0ciIsImNvcHkiLCJjcm9zcyIsImRpc3RhbmNlIiwiTWF0aCIsInNxcnQiLCJkaXYiLCJkaXYyIiwiZGl2U2NhbGFyIiwiZG90IiwiZXF1YWxzIiwibGVuZ3RoU3EiLCJsZXJwIiwiYWxwaGEiLCJtdWwiLCJtdWwyIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwiaW52TGVuZ3RoIiwiZmxvb3IiLCJjZWlsIiwicm91bmQiLCJtaW4iLCJtYXgiLCJzZXQiLCJzdWIiLCJzdWIyIiwic3ViU2NhbGFyIiwidG9TdHJpbmciLCJhbmdsZVJhZCIsImF0YW4yIiwiWkVSTyIsIk9iamVjdCIsImZyZWV6ZSIsIk9ORSIsIlVQIiwiRE9XTiIsIlJJR0hUIiwiTEVGVCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTtBQUNBO0FBQ0E7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Q0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsS0FBS0EsR0FBRztJQUNKLElBQUksQ0FBQzdCLENBQUMsR0FBR2MsSUFBSSxDQUFDZSxLQUFLLENBQUMsSUFBSSxDQUFDN0IsQ0FBQyxDQUFDLENBQUE7SUFDM0IsSUFBSSxDQUFDQyxDQUFDLEdBQUdhLElBQUksQ0FBQ2UsS0FBSyxDQUFDLElBQUksQ0FBQzVCLENBQUMsQ0FBQyxDQUFBO0FBQzNCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSTZCLEVBQUFBLElBQUlBLEdBQUc7SUFDSCxJQUFJLENBQUM5QixDQUFDLEdBQUdjLElBQUksQ0FBQ2dCLElBQUksQ0FBQyxJQUFJLENBQUM5QixDQUFDLENBQUMsQ0FBQTtJQUMxQixJQUFJLENBQUNDLENBQUMsR0FBR2EsSUFBSSxDQUFDZ0IsSUFBSSxDQUFDLElBQUksQ0FBQzdCLENBQUMsQ0FBQyxDQUFBO0FBQzFCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSThCLEVBQUFBLEtBQUtBLEdBQUc7SUFDSixJQUFJLENBQUMvQixDQUFDLEdBQUdjLElBQUksQ0FBQ2lCLEtBQUssQ0FBQyxJQUFJLENBQUMvQixDQUFDLENBQUMsQ0FBQTtJQUMzQixJQUFJLENBQUNDLENBQUMsR0FBR2EsSUFBSSxDQUFDaUIsS0FBSyxDQUFDLElBQUksQ0FBQzlCLENBQUMsQ0FBQyxDQUFBO0FBQzNCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJK0IsR0FBR0EsQ0FBQzVCLEdBQUcsRUFBRTtBQUNMLElBQUEsSUFBSUEsR0FBRyxDQUFDSixDQUFDLEdBQUcsSUFBSSxDQUFDQSxDQUFDLEVBQUUsSUFBSSxDQUFDQSxDQUFDLEdBQUdJLEdBQUcsQ0FBQ0osQ0FBQyxDQUFBO0FBQ2xDLElBQUEsSUFBSUksR0FBRyxDQUFDSCxD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
