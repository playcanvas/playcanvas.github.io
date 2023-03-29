/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * A 4-dimensional vector.
 */
class Vec4 {
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
   * The third component of the vector.
   *
   * @type {number}
   */

  /**
   * The fourth component of the vector.
   *
   * @type {number}
   */

  /**
   * Creates a new Vec4 object.
   *
   * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 4, the
   * array will be used to populate all components.
   * @param {number} [y] - The y value. Defaults to 0.
   * @param {number} [z] - The z value. Defaults to 0.
   * @param {number} [w] - The w value. Defaults to 0.
   * @example
   * var v = new pc.Vec4(1, 2, 3, 4);
   */
  constructor(x = 0, y = 0, z = 0, w = 0) {
    this.x = void 0;
    this.y = void 0;
    this.z = void 0;
    this.w = void 0;
    if (x.length === 4) {
      this.x = x[0];
      this.y = x[1];
      this.z = x[2];
      this.w = x[3];
    } else {
      this.x = x;
      this.y = y;
      this.z = z;
      this.w = w;
    }
  }

  /**
   * Adds a 4-dimensional vector to another in place.
   *
   * @param {Vec4} rhs - The vector to add to the specified vector.
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(10, 10, 10, 10);
   * var b = new pc.Vec4(20, 20, 20, 20);
   *
   * a.add(b);
   *
   * // Outputs [30, 30, 30]
   * console.log("The result of the addition is: " + a.toString());
   */
  add(rhs) {
    this.x += rhs.x;
    this.y += rhs.y;
    this.z += rhs.z;
    this.w += rhs.w;
    return this;
  }

  /**
   * Adds two 4-dimensional vectors together and returns the result.
   *
   * @param {Vec4} lhs - The first vector operand for the addition.
   * @param {Vec4} rhs - The second vector operand for the addition.
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(10, 10, 10, 10);
   * var b = new pc.Vec4(20, 20, 20, 20);
   * var r = new pc.Vec4();
   *
   * r.add2(a, b);
   * // Outputs [30, 30, 30]
   *
   * console.log("The result of the addition is: " + r.toString());
   */
  add2(lhs, rhs) {
    this.x = lhs.x + rhs.x;
    this.y = lhs.y + rhs.y;
    this.z = lhs.z + rhs.z;
    this.w = lhs.w + rhs.w;
    return this;
  }

  /**
   * Adds a number to each element of a vector.
   *
   * @param {number} scalar - The number to add.
   * @returns {Vec4} Self for chaining.
   * @example
   * var vec = new pc.Vec4(3, 4, 5, 6);
   *
   * vec.addScalar(2);
   *
   * // Outputs [5, 6, 7, 8]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScalar(scalar) {
    this.x += scalar;
    this.y += scalar;
    this.z += scalar;
    this.w += scalar;
    return this;
  }

  /**
   * Returns an identical copy of the specified 4-dimensional vector.
   *
   * @returns {this} A 4-dimensional vector containing the result of the cloning.
   * @example
   * var v = new pc.Vec4(10, 20, 30, 40);
   * var vclone = v.clone();
   * console.log("The result of the cloning is: " + vclone.toString());
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr(this.x, this.y, this.z, this.w);
  }

  /**
   * Copies the contents of a source 4-dimensional vector to a destination 4-dimensional vector.
   *
   * @param {Vec4} rhs - A vector to copy to the specified vector.
   * @returns {Vec4} Self for chaining.
   * @example
   * var src = new pc.Vec4(10, 20, 30, 40);
   * var dst = new pc.Vec4();
   *
   * dst.copy(src);
   *
   * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
   */
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    this.w = rhs.w;
    return this;
  }

  /**
   * Divides a 4-dimensional vector by another in place.
   *
   * @param {Vec4} rhs - The vector to divide the specified vector by.
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(4, 9, 16, 25);
   * var b = new pc.Vec4(2, 3, 4, 5);
   *
   * a.div(b);
   *
   * // Outputs [2, 3, 4, 5]
   * console.log("The result of the division is: " + a.toString());
   */
  div(rhs) {
    this.x /= rhs.x;
    this.y /= rhs.y;
    this.z /= rhs.z;
    this.w /= rhs.w;
    return this;
  }

  /**
   * Divides one 4-dimensional vector by another and writes the result to the specified vector.
   *
   * @param {Vec4} lhs - The dividend vector (the vector being divided).
   * @param {Vec4} rhs - The divisor vector (the vector dividing the dividend).
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(4, 9, 16, 25);
   * var b = new pc.Vec4(2, 3, 4, 5);
   * var r = new pc.Vec4();
   *
   * r.div2(a, b);
   * // Outputs [2, 3, 4, 5]
   *
   * console.log("The result of the division is: " + r.toString());
   */
  div2(lhs, rhs) {
    this.x = lhs.x / rhs.x;
    this.y = lhs.y / rhs.y;
    this.z = lhs.z / rhs.z;
    this.w = lhs.w / rhs.w;
    return this;
  }

  /**
   * Divides each element of a vector by a number.
   *
   * @param {number} scalar - The number to divide by.
   * @returns {Vec4} Self for chaining.
   * @example
   * var vec = new pc.Vec4(3, 6, 9, 12);
   *
   * vec.divScalar(3);
   *
   * // Outputs [1, 2, 3, 4]
   * console.log("The result of the division is: " + vec.toString());
   */
  divScalar(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
    this.w /= scalar;
    return this;
  }

  /**
   * Returns the result of a dot product operation performed on the two specified 4-dimensional
   * vectors.
   *
   * @param {Vec4} rhs - The second 4-dimensional vector operand of the dot product.
   * @returns {number} The result of the dot product operation.
   * @example
   * var v1 = new pc.Vec4(5, 10, 20, 40);
   * var v2 = new pc.Vec4(10, 20, 40, 80);
   * var v1dotv2 = v1.dot(v2);
   * console.log("The result of the dot product is: " + v1dotv2);
   */
  dot(rhs) {
    return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z + this.w * rhs.w;
  }

  /**
   * Reports whether two vectors are equal.
   *
   * @param {Vec4} rhs - The vector to compare to the specified vector.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * var a = new pc.Vec4(1, 2, 3, 4);
   * var b = new pc.Vec4(5, 6, 7, 8);
   * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
  }

  /**
   * Returns the magnitude of the specified 4-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 4-dimensional vector.
   * @example
   * var vec = new pc.Vec4(3, 4, 0, 0);
   * var len = vec.length();
   * // Outputs 5
   * console.log("The length of the vector is: " + len);
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  /**
   * Returns the magnitude squared of the specified 4-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 4-dimensional vector.
   * @example
   * var vec = new pc.Vec4(3, 4, 0);
   * var len = vec.lengthSq();
   * // Outputs 25
   * console.log("The length squared of the vector is: " + len);
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  /**
   * Returns the result of a linear interpolation between two specified 4-dimensional vectors.
   *
   * @param {Vec4} lhs - The 4-dimensional to interpolate from.
   * @param {Vec4} rhs - The 4-dimensional to interpolate to.
   * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
   * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
   * range, the linear interpolant will occur on a ray extrapolated from this line.
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(0, 0, 0, 0);
   * var b = new pc.Vec4(10, 10, 10, 10);
   * var r = new pc.Vec4();
   *
   * r.lerp(a, b, 0);   // r is equal to a
   * r.lerp(a, b, 0.5); // r is 5, 5, 5, 5
   * r.lerp(a, b, 1);   // r is equal to b
   */
  lerp(lhs, rhs, alpha) {
    this.x = lhs.x + alpha * (rhs.x - lhs.x);
    this.y = lhs.y + alpha * (rhs.y - lhs.y);
    this.z = lhs.z + alpha * (rhs.z - lhs.z);
    this.w = lhs.w + alpha * (rhs.w - lhs.w);
    return this;
  }

  /**
   * Multiplies a 4-dimensional vector to another in place.
   *
   * @param {Vec4} rhs - The 4-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(2, 3, 4, 5);
   * var b = new pc.Vec4(4, 5, 6, 7);
   *
   * a.mul(b);
   *
   * // Outputs 8, 15, 24, 35
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    this.x *= rhs.x;
    this.y *= rhs.y;
    this.z *= rhs.z;
    this.w *= rhs.w;
    return this;
  }

  /**
   * Returns the result of multiplying the specified 4-dimensional vectors together.
   *
   * @param {Vec4} lhs - The 4-dimensional vector used as the first multiplicand of the operation.
   * @param {Vec4} rhs - The 4-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(2, 3, 4, 5);
   * var b = new pc.Vec4(4, 5, 6, 7);
   * var r = new pc.Vec4();
   *
   * r.mul2(a, b);
   *
   * // Outputs 8, 15, 24, 35
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    this.x = lhs.x * rhs.x;
    this.y = lhs.y * rhs.y;
    this.z = lhs.z * rhs.z;
    this.w = lhs.w * rhs.w;
    return this;
  }

  /**
   * Multiplies each element of a vector by a number.
   *
   * @param {number} scalar - The number to multiply by.
   * @returns {Vec4} Self for chaining.
   * @example
   * var vec = new pc.Vec4(3, 6, 9, 12);
   *
   * vec.mulScalar(3);
   *
   * // Outputs [9, 18, 27, 36]
   * console.log("The result of the multiplication is: " + vec.toString());
   */
  mulScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    this.w *= scalar;
    return this;
  }

  /**
   * Returns this 4-dimensional vector converted to a unit vector in place. If the vector has a
   * length of zero, the vector's elements will be set to zero.
   *
   * @returns {Vec4} Self for chaining.
   * @example
   * var v = new pc.Vec4(25, 0, 0, 0);
   *
   * v.normalize();
   *
   * // Outputs 1, 0, 0, 0
   * console.log("The result of the vector normalization is: " + v.toString());
   */
  normalize() {
    const lengthSq = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    if (lengthSq > 0) {
      const invLength = 1 / Math.sqrt(lengthSq);
      this.x *= invLength;
      this.y *= invLength;
      this.z *= invLength;
      this.w *= invLength;
    }
    return this;
  }

  /**
   * Each element is set to the largest integer less than or equal to its value.
   *
   * @returns {Vec4} Self for chaining.
   */
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    this.w = Math.floor(this.w);
    return this;
  }

  /**
   * Each element is rounded up to the next largest integer.
   *
   * @returns {Vec4} Self for chaining.
   */
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    this.w = Math.ceil(this.w);
    return this;
  }

  /**
   * Each element is rounded up or down to the nearest integer.
   *
   * @returns {Vec4} Self for chaining.
   */
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    this.w = Math.round(this.w);
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is smaller.
   *
   * @param {Vec4} rhs - The 4-dimensional vector used as the source of elements to compare to.
   * @returns {Vec4} Self for chaining.
   */
  min(rhs) {
    if (rhs.x < this.x) this.x = rhs.x;
    if (rhs.y < this.y) this.y = rhs.y;
    if (rhs.z < this.z) this.z = rhs.z;
    if (rhs.w < this.w) this.w = rhs.w;
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is larger.
   *
   * @param {Vec4} rhs - The 4-dimensional vector used as the source of elements to compare to.
   * @returns {Vec4} Self for chaining.
   */
  max(rhs) {
    if (rhs.x > this.x) this.x = rhs.x;
    if (rhs.y > this.y) this.y = rhs.y;
    if (rhs.z > this.z) this.z = rhs.z;
    if (rhs.w > this.w) this.w = rhs.w;
    return this;
  }

  /**
   * Sets the specified 4-dimensional vector to the supplied numerical values.
   *
   * @param {number} x - The value to set on the first component of the vector.
   * @param {number} y - The value to set on the second component of the vector.
   * @param {number} z - The value to set on the third component of the vector.
   * @param {number} w - The value to set on the fourth component of the vector.
   * @returns {Vec4} Self for chaining.
   * @example
   * var v = new pc.Vec4();
   * v.set(5, 10, 20, 40);
   *
   * // Outputs 5, 10, 20, 40
   * console.log("The result of the vector set is: " + v.toString());
   */
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  /**
   * Subtracts a 4-dimensional vector from another in place.
   *
   * @param {Vec4} rhs - The vector to add to the specified vector.
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(10, 10, 10, 10);
   * var b = new pc.Vec4(20, 20, 20, 20);
   *
   * a.sub(b);
   *
   * // Outputs [-10, -10, -10, -10]
   * console.log("The result of the subtraction is: " + a.toString());
   */
  sub(rhs) {
    this.x -= rhs.x;
    this.y -= rhs.y;
    this.z -= rhs.z;
    this.w -= rhs.w;
    return this;
  }

  /**
   * Subtracts two 4-dimensional vectors from one another and returns the result.
   *
   * @param {Vec4} lhs - The first vector operand for the subtraction.
   * @param {Vec4} rhs - The second vector operand for the subtraction.
   * @returns {Vec4} Self for chaining.
   * @example
   * var a = new pc.Vec4(10, 10, 10, 10);
   * var b = new pc.Vec4(20, 20, 20, 20);
   * var r = new pc.Vec4();
   *
   * r.sub2(a, b);
   *
   * // Outputs [-10, -10, -10, -10]
   * console.log("The result of the subtraction is: " + r.toString());
   */
  sub2(lhs, rhs) {
    this.x = lhs.x - rhs.x;
    this.y = lhs.y - rhs.y;
    this.z = lhs.z - rhs.z;
    this.w = lhs.w - rhs.w;
    return this;
  }

  /**
   * Subtracts a number from each element of a vector.
   *
   * @param {number} scalar - The number to subtract.
   * @returns {Vec4} Self for chaining.
   * @example
   * var vec = new pc.Vec4(3, 4, 5, 6);
   *
   * vec.subScalar(2);
   *
   * // Outputs [1, 2, 3, 4]
   * console.log("The result of the subtraction is: " + vec.toString());
   */
  subScalar(scalar) {
    this.x -= scalar;
    this.y -= scalar;
    this.z -= scalar;
    this.w -= scalar;
    return this;
  }

  /**
   * Converts the vector to string form.
   *
   * @returns {string} The vector in string form.
   * @example
   * var v = new pc.Vec4(20, 10, 5, 0);
   * // Outputs [20, 10, 5, 0]
   * console.log(v.toString());
   */
  toString() {
    return `[${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
  }

  /**
   * A constant vector set to [0, 0, 0, 0].
   *
   * @type {Vec4}
   * @readonly
   */
}
Vec4.ZERO = Object.freeze(new Vec4(0, 0, 0, 0));
Vec4.ONE = Object.freeze(new Vec4(1, 1, 1, 1));

export { Vec4 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVjNC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC92ZWM0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSA0LWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAqL1xuY2xhc3MgVmVjNCB7XG4gICAgLyoqXG4gICAgICogVGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB4O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNlY29uZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgeTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0aGlyZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgejtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmb3VydGggY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHc7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFZlYzQgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW119IFt4XSAtIFRoZSB4IHZhbHVlLiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5IG9mIGxlbmd0aCA0LCB0aGVcbiAgICAgKiBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5IHZhbHVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgeiB2YWx1ZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVGhlIHcgdmFsdWUuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWM0KDEsIDIsIDMsIDQpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHggPSAwLCB5ID0gMCwgeiA9IDAsIHcgPSAwKSB7XG4gICAgICAgIGlmICh4Lmxlbmd0aCA9PT0gNCkge1xuICAgICAgICAgICAgdGhpcy54ID0geFswXTtcbiAgICAgICAgICAgIHRoaXMueSA9IHhbMV07XG4gICAgICAgICAgICB0aGlzLnogPSB4WzJdO1xuICAgICAgICAgICAgdGhpcy53ID0geFszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICAgICAgdGhpcy56ID0gejtcbiAgICAgICAgICAgIHRoaXMudyA9IHc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgNC1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIHZlY3RvciB0byBhZGQgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjNCgxMCwgMTAsIDEwLCAxMCk7XG4gICAgICogdmFyIGIgPSBuZXcgcGMuVmVjNCgyMCwgMjAsIDIwLCAyMCk7XG4gICAgICpcbiAgICAgKiBhLmFkZChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzMwLCAzMCwgMzBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZChyaHMpIHtcbiAgICAgICAgdGhpcy54ICs9IHJocy54O1xuICAgICAgICB0aGlzLnkgKz0gcmhzLnk7XG4gICAgICAgIHRoaXMueiArPSByaHMuejtcbiAgICAgICAgdGhpcy53ICs9IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgdHdvIDQtZGltZW5zaW9uYWwgdmVjdG9ycyB0b2dldGhlciBhbmQgcmV0dXJucyB0aGUgcmVzdWx0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSBsaHMgLSBUaGUgZmlyc3QgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBhZGRpdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSBzZWNvbmQgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBhZGRpdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5WZWM0KDEwLCAxMCwgMTAsIDEwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5WZWM0KDIwLCAyMCwgMjAsIDIwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5WZWM0KCk7XG4gICAgICpcbiAgICAgKiByLmFkZDIoYSwgYik7XG4gICAgICogLy8gT3V0cHV0cyBbMzAsIDMwLCAzMF1cbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGQyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54ICsgcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55ICsgcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IGxocy56ICsgcmhzLno7XG4gICAgICAgIHRoaXMudyA9IGxocy53ICsgcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIG51bWJlciB0byBlYWNoIGVsZW1lbnQgb2YgYSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGFyIC0gVGhlIG51bWJlciB0byBhZGQuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHZlYyA9IG5ldyBwYy5WZWM0KDMsIDQsIDUsIDYpO1xuICAgICAqXG4gICAgICogdmVjLmFkZFNjYWxhcigyKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzUsIDYsIDcsIDhdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkU2NhbGFyKHNjYWxhcikge1xuICAgICAgICB0aGlzLnggKz0gc2NhbGFyO1xuICAgICAgICB0aGlzLnkgKz0gc2NhbGFyO1xuICAgICAgICB0aGlzLnogKz0gc2NhbGFyO1xuICAgICAgICB0aGlzLncgKz0gc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gaWRlbnRpY2FsIGNvcHkgb2YgdGhlIHNwZWNpZmllZCA0LWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIDQtZGltZW5zaW9uYWwgdmVjdG9yIGNvbnRhaW5pbmcgdGhlIHJlc3VsdCBvZiB0aGUgY2xvbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzQoMTAsIDIwLCAzMCwgNDApO1xuICAgICAqIHZhciB2Y2xvbmUgPSB2LmNsb25lKCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nIGlzOiBcIiArIHZjbG9uZS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55LCB0aGlzLnosIHRoaXMudyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHRoZSBjb250ZW50cyBvZiBhIHNvdXJjZSA0LWRpbWVuc2lvbmFsIHZlY3RvciB0byBhIGRlc3RpbmF0aW9uIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBBIHZlY3RvciB0byBjb3B5IHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBzcmMgPSBuZXcgcGMuVmVjNCgxMCwgMjAsIDMwLCA0MCk7XG4gICAgICogdmFyIGRzdCA9IG5ldyBwYy5WZWM0KCk7XG4gICAgICpcbiAgICAgKiBkc3QuY29weShzcmMpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHZlY3RvcnMgYXJlIFwiICsgKGRzdC5lcXVhbHMoc3JjKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBjb3B5KHJocykge1xuICAgICAgICB0aGlzLnggPSByaHMueDtcbiAgICAgICAgdGhpcy55ID0gcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IHJocy56O1xuICAgICAgICB0aGlzLncgPSByaHMudztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXZpZGVzIGEgNC1kaW1lbnNpb25hbCB2ZWN0b3IgYnkgYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIHZlY3RvciB0byBkaXZpZGUgdGhlIHNwZWNpZmllZCB2ZWN0b3IgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjNCg0LCA5LCAxNiwgMjUpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzQoMiwgMywgNCwgNSk7XG4gICAgICpcbiAgICAgKiBhLmRpdihiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzIsIDMsIDQsIDVdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBkaXZpc2lvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGRpdihyaHMpIHtcbiAgICAgICAgdGhpcy54IC89IHJocy54O1xuICAgICAgICB0aGlzLnkgLz0gcmhzLnk7XG4gICAgICAgIHRoaXMueiAvPSByaHMuejtcbiAgICAgICAgdGhpcy53IC89IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgb25lIDQtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGFub3RoZXIgYW5kIHdyaXRlcyB0aGUgcmVzdWx0IHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSBsaHMgLSBUaGUgZGl2aWRlbmQgdmVjdG9yICh0aGUgdmVjdG9yIGJlaW5nIGRpdmlkZWQpLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIGRpdmlzb3IgdmVjdG9yICh0aGUgdmVjdG9yIGRpdmlkaW5nIHRoZSBkaXZpZGVuZCkuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjNCg0LCA5LCAxNiwgMjUpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzQoMiwgMywgNCwgNSk7XG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogci5kaXYyKGEsIGIpO1xuICAgICAqIC8vIE91dHB1dHMgWzIsIDMsIDQsIDVdXG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZGl2MihsaHMsIHJocykge1xuICAgICAgICB0aGlzLnggPSBsaHMueCAvIHJocy54O1xuICAgICAgICB0aGlzLnkgPSBsaHMueSAvIHJocy55O1xuICAgICAgICB0aGlzLnogPSBsaHMueiAvIHJocy56O1xuICAgICAgICB0aGlzLncgPSBsaHMudyAvIHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERpdmlkZXMgZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yIGJ5IGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gZGl2aWRlIGJ5LlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ZWMgPSBuZXcgcGMuVmVjNCgzLCA2LCA5LCAxMik7XG4gICAgICpcbiAgICAgKiB2ZWMuZGl2U2NhbGFyKDMpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMSwgMiwgMywgNF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBkaXZTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCAvPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSAvPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueiAvPSBzY2FsYXI7XG4gICAgICAgIHRoaXMudyAvPSBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIGEgZG90IHByb2R1Y3Qgb3BlcmF0aW9uIHBlcmZvcm1lZCBvbiB0aGUgdHdvIHNwZWNpZmllZCA0LWRpbWVuc2lvbmFsXG4gICAgICogdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIHNlY29uZCA0LWRpbWVuc2lvbmFsIHZlY3RvciBvcGVyYW5kIG9mIHRoZSBkb3QgcHJvZHVjdC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgcmVzdWx0IG9mIHRoZSBkb3QgcHJvZHVjdCBvcGVyYXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdjEgPSBuZXcgcGMuVmVjNCg1LCAxMCwgMjAsIDQwKTtcbiAgICAgKiB2YXIgdjIgPSBuZXcgcGMuVmVjNCgxMCwgMjAsIDQwLCA4MCk7XG4gICAgICogdmFyIHYxZG90djIgPSB2MS5kb3QodjIpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZG90IHByb2R1Y3QgaXM6IFwiICsgdjFkb3R2Mik7XG4gICAgICovXG4gICAgZG90KHJocykge1xuICAgICAgICByZXR1cm4gdGhpcy54ICogcmhzLnggKyB0aGlzLnkgKiByaHMueSArIHRoaXMueiAqIHJocy56ICsgdGhpcy53ICogcmhzLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHR3byB2ZWN0b3JzIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIHZlY3RvciB0byBjb21wYXJlIHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSB2ZWN0b3JzIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjNCgxLCAyLCAzLCA0KTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5WZWM0KDUsIDYsIDcsIDgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byB2ZWN0b3JzIGFyZSBcIiArIChhLmVxdWFscyhiKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggPT09IHJocy54ICYmIHRoaXMueSA9PT0gcmhzLnkgJiYgdGhpcy56ID09PSByaHMueiAmJiB0aGlzLncgPT09IHJocy53O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHZlYyA9IG5ldyBwYy5WZWM0KDMsIDQsIDAsIDApO1xuICAgICAqIHZhciBsZW4gPSB2ZWMubGVuZ3RoKCk7XG4gICAgICogLy8gT3V0cHV0cyA1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIG9mIHRoZSB2ZWN0b3IgaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgc3F1YXJlZCBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHZlYyA9IG5ldyBwYy5WZWM0KDMsIDQsIDApO1xuICAgICAqIHZhciBsZW4gPSB2ZWMubGVuZ3RoU3EoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDI1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIHNxdWFyZWQgb2YgdGhlIHZlY3RvciBpczogXCIgKyBsZW4pO1xuICAgICAqL1xuICAgIGxlbmd0aFNxKCkge1xuICAgICAgICByZXR1cm4gdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBhIGxpbmVhciBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdHdvIHNwZWNpZmllZCA0LWRpbWVuc2lvbmFsIHZlY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IGxocyAtIFRoZSA0LWRpbWVuc2lvbmFsIHRvIGludGVycG9sYXRlIGZyb20uXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgNC1kaW1lbnNpb25hbCB0byBpbnRlcnBvbGF0ZSB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYWxwaGEgLSBUaGUgdmFsdWUgY29udHJvbGxpbmcgdGhlIHBvaW50IG9mIGludGVycG9sYXRpb24uIEJldHdlZW4gMCBhbmQgMSxcbiAgICAgKiB0aGUgbGluZWFyIGludGVycG9sYW50IHdpbGwgb2NjdXIgb24gYSBzdHJhaWdodCBsaW5lIGJldHdlZW4gbGhzIGFuZCByaHMuIE91dHNpZGUgb2YgdGhpc1xuICAgICAqIHJhbmdlLCB0aGUgbGluZWFyIGludGVycG9sYW50IHdpbGwgb2NjdXIgb24gYSByYXkgZXh0cmFwb2xhdGVkIGZyb20gdGhpcyBsaW5lLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLlZlYzQoMCwgMCwgMCwgMCk7XG4gICAgICogdmFyIGIgPSBuZXcgcGMuVmVjNCgxMCwgMTAsIDEwLCAxMCk7XG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogci5sZXJwKGEsIGIsIDApOyAgIC8vIHIgaXMgZXF1YWwgdG8gYVxuICAgICAqIHIubGVycChhLCBiLCAwLjUpOyAvLyByIGlzIDUsIDUsIDUsIDVcbiAgICAgKiByLmxlcnAoYSwgYiwgMSk7ICAgLy8gciBpcyBlcXVhbCB0byBiXG4gICAgICovXG4gICAgbGVycChsaHMsIHJocywgYWxwaGEpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKyBhbHBoYSAqIChyaHMueCAtIGxocy54KTtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKyBhbHBoYSAqIChyaHMueSAtIGxocy55KTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogKyBhbHBoYSAqIChyaHMueiAtIGxocy56KTtcbiAgICAgICAgdGhpcy53ID0gbGhzLncgKyBhbHBoYSAqIChyaHMudyAtIGxocy53KTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBsaWVzIGEgNC1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5WZWM0KDIsIDMsIDQsIDUpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzQoNCwgNSwgNiwgNyk7XG4gICAgICpcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgOCwgMTUsIDI0LCAzNVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIHRoaXMueCAqPSByaHMueDtcbiAgICAgICAgdGhpcy55ICo9IHJocy55O1xuICAgICAgICB0aGlzLnogKj0gcmhzLno7XG4gICAgICAgIHRoaXMudyAqPSByaHMudztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgbXVsdGlwbHlpbmcgdGhlIHNwZWNpZmllZCA0LWRpbWVuc2lvbmFsIHZlY3RvcnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IGxocyAtIFRoZSA0LWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBmaXJzdCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSA0LWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjNCgyLCAzLCA0LCA1KTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5WZWM0KDQsIDUsIDYsIDcpO1xuICAgICAqIHZhciByID0gbmV3IHBjLlZlYzQoKTtcbiAgICAgKlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgOCwgMTUsIDI0LCAzNVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54ICogcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55ICogcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IGxocy56ICogcmhzLno7XG4gICAgICAgIHRoaXMudyA9IGxocy53ICogcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyBlYWNoIGVsZW1lbnQgb2YgYSB2ZWN0b3IgYnkgYSBudW1iZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGFyIC0gVGhlIG51bWJlciB0byBtdWx0aXBseSBieS5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdmVjID0gbmV3IHBjLlZlYzQoMywgNiwgOSwgMTIpO1xuICAgICAqXG4gICAgICogdmVjLm11bFNjYWxhcigzKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzksIDE4LCAyNywgMzZdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsU2NhbGFyKHNjYWxhcikge1xuICAgICAgICB0aGlzLnggKj0gc2NhbGFyO1xuICAgICAgICB0aGlzLnkgKj0gc2NhbGFyO1xuICAgICAgICB0aGlzLnogKj0gc2NhbGFyO1xuICAgICAgICB0aGlzLncgKj0gc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhpcyA0LWRpbWVuc2lvbmFsIHZlY3RvciBjb252ZXJ0ZWQgdG8gYSB1bml0IHZlY3RvciBpbiBwbGFjZS4gSWYgdGhlIHZlY3RvciBoYXMgYVxuICAgICAqIGxlbmd0aCBvZiB6ZXJvLCB0aGUgdmVjdG9yJ3MgZWxlbWVudHMgd2lsbCBiZSBzZXQgdG8gemVyby5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzQoMjUsIDAsIDAsIDApO1xuICAgICAqXG4gICAgICogdi5ub3JtYWxpemUoKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIG5vcm1hbGl6YXRpb24gaXM6IFwiICsgdi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBub3JtYWxpemUoKSB7XG4gICAgICAgIGNvbnN0IGxlbmd0aFNxID0gdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53O1xuICAgICAgICBpZiAobGVuZ3RoU3EgPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnZMZW5ndGggPSAxIC8gTWF0aC5zcXJ0KGxlbmd0aFNxKTtcbiAgICAgICAgICAgIHRoaXMueCAqPSBpbnZMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnkgKj0gaW52TGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy56ICo9IGludkxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMudyAqPSBpbnZMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgc2V0IHRvIHRoZSBsYXJnZXN0IGludGVnZXIgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGl0cyB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBmbG9vcigpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5mbG9vcih0aGlzLngpO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLmZsb29yKHRoaXMueSk7XG4gICAgICAgIHRoaXMueiA9IE1hdGguZmxvb3IodGhpcy56KTtcbiAgICAgICAgdGhpcy53ID0gTWF0aC5mbG9vcih0aGlzLncpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgcm91bmRlZCB1cCB0byB0aGUgbmV4dCBsYXJnZXN0IGludGVnZXIuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY2VpbCgpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5jZWlsKHRoaXMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGguY2VpbCh0aGlzLnkpO1xuICAgICAgICB0aGlzLnogPSBNYXRoLmNlaWwodGhpcy56KTtcbiAgICAgICAgdGhpcy53ID0gTWF0aC5jZWlsKHRoaXMudyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyByb3VuZGVkIHVwIG9yIGRvd24gdG8gdGhlIG5lYXJlc3QgaW50ZWdlci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICByb3VuZCgpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5yb3VuZCh0aGlzLngpO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLnJvdW5kKHRoaXMueSk7XG4gICAgICAgIHRoaXMueiA9IE1hdGgucm91bmQodGhpcy56KTtcbiAgICAgICAgdGhpcy53ID0gTWF0aC5yb3VuZCh0aGlzLncpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgYXNzaWduZWQgYSB2YWx1ZSBmcm9tIHJocyBwYXJhbWV0ZXIgaWYgaXQgaXMgc21hbGxlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNvdXJjZSBvZiBlbGVtZW50cyB0byBjb21wYXJlIHRvLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBtaW4ocmhzKSB7XG4gICAgICAgIGlmIChyaHMueCA8IHRoaXMueCkgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIGlmIChyaHMueSA8IHRoaXMueSkgdGhpcy55ID0gcmhzLnk7XG4gICAgICAgIGlmIChyaHMueiA8IHRoaXMueikgdGhpcy56ID0gcmhzLno7XG4gICAgICAgIGlmIChyaHMudyA8IHRoaXMudykgdGhpcy53ID0gcmhzLnc7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyBhc3NpZ25lZCBhIHZhbHVlIGZyb20gcmhzIHBhcmFtZXRlciBpZiBpdCBpcyBsYXJnZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSA0LWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzb3VyY2Ugb2YgZWxlbWVudHMgdG8gY29tcGFyZSB0by5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgbWF4KHJocykge1xuICAgICAgICBpZiAocmhzLnggPiB0aGlzLngpIHRoaXMueCA9IHJocy54O1xuICAgICAgICBpZiAocmhzLnkgPiB0aGlzLnkpIHRoaXMueSA9IHJocy55O1xuICAgICAgICBpZiAocmhzLnogPiB0aGlzLnopIHRoaXMueiA9IHJocy56O1xuICAgICAgICBpZiAocmhzLncgPiB0aGlzLncpIHRoaXMudyA9IHJocy53O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gdGhlIHN1cHBsaWVkIG51bWVyaWNhbCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB2YWx1ZSB0byBzZXQgb24gdGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHZhbHVlIHRvIHNldCBvbiB0aGUgc2Vjb25kIGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIHZhbHVlIHRvIHNldCBvbiB0aGUgdGhpcmQgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSBmb3VydGggY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqIHYuc2V0KDUsIDEwLCAyMCwgNDApO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA1LCAxMCwgMjAsIDQwXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSB2ZWN0b3Igc2V0IGlzOiBcIiArIHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgc2V0KHgsIHksIHosIHcpIHtcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgdGhpcy56ID0gejtcbiAgICAgICAgdGhpcy53ID0gdztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdWJ0cmFjdHMgYSA0LWRpbWVuc2lvbmFsIHZlY3RvciBmcm9tIGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSB2ZWN0b3IgdG8gYWRkIHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLlZlYzQoMTAsIDEwLCAxMCwgMTApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlZlYzQoMjAsIDIwLCAyMCwgMjApO1xuICAgICAqXG4gICAgICogYS5zdWIoYik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFstMTAsIC0xMCwgLTEwLCAtMTBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHN1YihyaHMpIHtcbiAgICAgICAgdGhpcy54IC09IHJocy54O1xuICAgICAgICB0aGlzLnkgLT0gcmhzLnk7XG4gICAgICAgIHRoaXMueiAtPSByaHMuejtcbiAgICAgICAgdGhpcy53IC09IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0cyB0d28gNC1kaW1lbnNpb25hbCB2ZWN0b3JzIGZyb20gb25lIGFub3RoZXIgYW5kIHJldHVybnMgdGhlIHJlc3VsdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gbGhzIC0gVGhlIGZpcnN0IHZlY3RvciBvcGVyYW5kIGZvciB0aGUgc3VidHJhY3Rpb24uXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgc2Vjb25kIHZlY3RvciBvcGVyYW5kIGZvciB0aGUgc3VidHJhY3Rpb24uXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuVmVjNCgxMCwgMTAsIDEwLCAxMCk7XG4gICAgICogdmFyIGIgPSBuZXcgcGMuVmVjNCgyMCwgMjAsIDIwLCAyMCk7XG4gICAgICogdmFyIHIgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogci5zdWIyKGEsIGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbLTEwLCAtMTAsIC0xMCwgLTEwXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgc3VidHJhY3Rpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzdWIyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54IC0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55IC0gcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IGxocy56IC0gcmhzLno7XG4gICAgICAgIHRoaXMudyA9IGxocy53IC0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIGEgbnVtYmVyIGZyb20gZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gc3VidHJhY3QuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHZlYyA9IG5ldyBwYy5WZWM0KDMsIDQsIDUsIDYpO1xuICAgICAqXG4gICAgICogdmVjLnN1YlNjYWxhcigyKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzEsIDIsIDMsIDRdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgc3ViU2NhbGFyKHNjYWxhcikge1xuICAgICAgICB0aGlzLnggLT0gc2NhbGFyO1xuICAgICAgICB0aGlzLnkgLT0gc2NhbGFyO1xuICAgICAgICB0aGlzLnogLT0gc2NhbGFyO1xuICAgICAgICB0aGlzLncgLT0gc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSB2ZWN0b3IgdG8gc3RyaW5nIGZvcm0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgdmVjdG9yIGluIHN0cmluZyBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjNCgyMCwgMTAsIDUsIDApO1xuICAgICAqIC8vIE91dHB1dHMgWzIwLCAxMCwgNSwgMF1cbiAgICAgKiBjb25zb2xlLmxvZyh2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gYFske3RoaXMueH0sICR7dGhpcy55fSwgJHt0aGlzLnp9LCAke3RoaXMud31dYDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzAsIDAsIDAsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFpFUk8gPSBPYmplY3QuZnJlZXplKG5ldyBWZWM0KDAsIDAsIDAsIDApKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMSwgMSwgMSwgMV0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjNH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgT05FID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjNCgxLCAxLCAxLCAxKSk7XG59XG5cbmV4cG9ydCB7IFZlYzQgfTtcbiJdLCJuYW1lcyI6WyJWZWM0IiwiY29uc3RydWN0b3IiLCJ4IiwieSIsInoiLCJ3IiwibGVuZ3RoIiwiYWRkIiwicmhzIiwiYWRkMiIsImxocyIsImFkZFNjYWxhciIsInNjYWxhciIsImNsb25lIiwiY3N0ciIsImNvcHkiLCJkaXYiLCJkaXYyIiwiZGl2U2NhbGFyIiwiZG90IiwiZXF1YWxzIiwiTWF0aCIsInNxcnQiLCJsZW5ndGhTcSIsImxlcnAiLCJhbHBoYSIsIm11bCIsIm11bDIiLCJtdWxTY2FsYXIiLCJub3JtYWxpemUiLCJpbnZMZW5ndGgiLCJmbG9vciIsImNlaWwiLCJyb3VuZCIsIm1pbiIsIm1heCIsInNldCIsInN1YiIsInN1YjIiLCJzdWJTY2FsYXIiLCJ0b1N0cmluZyIsIlpFUk8iLCJPYmplY3QiLCJmcmVlemUiLCJPTkUiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsSUFBSSxDQUFDO0FBQ1A7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUFBLElBQUEsSUFBQSxDQWxDeENILENBQUMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9EQyxDQUFDLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPREMsQ0FBQyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT0RDLENBQUMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQWNHLElBQUEsSUFBSUgsQ0FBQyxDQUFDSSxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ2hCLE1BQUEsSUFBSSxDQUFDSixDQUFDLEdBQUdBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNiLE1BQUEsSUFBSSxDQUFDQyxDQUFDLEdBQUdELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNiLE1BQUEsSUFBSSxDQUFDRSxDQUFDLEdBQUdGLENBQUMs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
