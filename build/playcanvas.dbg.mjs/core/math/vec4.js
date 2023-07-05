/**
 * A 4-dimensional vector.
 */
class Vec4 {
  /**
   * Creates a new Vec4 object.
   *
   * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 4, the
   * array will be used to populate all components.
   * @param {number} [y] - The y value. Defaults to 0.
   * @param {number} [z] - The z value. Defaults to 0.
   * @param {number} [w] - The w value. Defaults to 0.
   * @example
   * const v = new pc.Vec4(1, 2, 3, 4);
   */
  constructor(x = 0, y = 0, z = 0, w = 0) {
    /**
     * The first component of the vector.
     *
     * @type {number}
     */
    this.x = void 0;
    /**
     * The second component of the vector.
     *
     * @type {number}
     */
    this.y = void 0;
    /**
     * The third component of the vector.
     *
     * @type {number}
     */
    this.z = void 0;
    /**
     * The fourth component of the vector.
     *
     * @type {number}
     */
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
   * const a = new pc.Vec4(10, 10, 10, 10);
   * const b = new pc.Vec4(20, 20, 20, 20);
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
   * const a = new pc.Vec4(10, 10, 10, 10);
   * const b = new pc.Vec4(20, 20, 20, 20);
   * const r = new pc.Vec4();
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
   * const vec = new pc.Vec4(3, 4, 5, 6);
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
   * const v = new pc.Vec4(10, 20, 30, 40);
   * const vclone = v.clone();
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
   * const src = new pc.Vec4(10, 20, 30, 40);
   * const dst = new pc.Vec4();
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
   * const a = new pc.Vec4(4, 9, 16, 25);
   * const b = new pc.Vec4(2, 3, 4, 5);
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
   * const a = new pc.Vec4(4, 9, 16, 25);
   * const b = new pc.Vec4(2, 3, 4, 5);
   * const r = new pc.Vec4();
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
   * const vec = new pc.Vec4(3, 6, 9, 12);
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
   * const v1 = new pc.Vec4(5, 10, 20, 40);
   * const v2 = new pc.Vec4(10, 20, 40, 80);
   * const v1dotv2 = v1.dot(v2);
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
   * const a = new pc.Vec4(1, 2, 3, 4);
   * const b = new pc.Vec4(5, 6, 7, 8);
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
   * const vec = new pc.Vec4(3, 4, 0, 0);
   * const len = vec.length();
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
   * const vec = new pc.Vec4(3, 4, 0);
   * const len = vec.lengthSq();
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
   * const a = new pc.Vec4(0, 0, 0, 0);
   * const b = new pc.Vec4(10, 10, 10, 10);
   * const r = new pc.Vec4();
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
   * const a = new pc.Vec4(2, 3, 4, 5);
   * const b = new pc.Vec4(4, 5, 6, 7);
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
   * const a = new pc.Vec4(2, 3, 4, 5);
   * const b = new pc.Vec4(4, 5, 6, 7);
   * const r = new pc.Vec4();
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
   * const vec = new pc.Vec4(3, 6, 9, 12);
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
   * const v = new pc.Vec4(25, 0, 0, 0);
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
   * const v = new pc.Vec4();
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
   * const a = new pc.Vec4(10, 10, 10, 10);
   * const b = new pc.Vec4(20, 20, 20, 20);
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
   * const a = new pc.Vec4(10, 10, 10, 10);
   * const b = new pc.Vec4(20, 20, 20, 20);
   * const r = new pc.Vec4();
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
   * const vec = new pc.Vec4(3, 4, 5, 6);
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
   * const v = new pc.Vec4(20, 10, 5, 0);
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
/**
 * A constant vector set to [1, 1, 1, 1].
 *
 * @type {Vec4}
 * @readonly
 */
Vec4.ONE = Object.freeze(new Vec4(1, 1, 1, 1));

export { Vec4 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVjNC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC92ZWM0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSA0LWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAqL1xuY2xhc3MgVmVjNCB7XG4gICAgLyoqXG4gICAgICogVGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB4O1xuXG4gICAgLyoqXG4gICAgICogVGhlIHNlY29uZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgeTtcblxuICAgIC8qKlxuICAgICAqIFRoZSB0aGlyZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgejtcblxuICAgIC8qKlxuICAgICAqIFRoZSBmb3VydGggY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHc7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFZlYzQgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW119IFt4XSAtIFRoZSB4IHZhbHVlLiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5IG9mIGxlbmd0aCA0LCB0aGVcbiAgICAgKiBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5IHZhbHVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgeiB2YWx1ZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3ddIC0gVGhlIHcgdmFsdWUuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzQoMSwgMiwgMywgNCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoeCA9IDAsIHkgPSAwLCB6ID0gMCwgdyA9IDApIHtcbiAgICAgICAgaWYgKHgubGVuZ3RoID09PSA0KSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4WzBdO1xuICAgICAgICAgICAgdGhpcy55ID0geFsxXTtcbiAgICAgICAgICAgIHRoaXMueiA9IHhbMl07XG4gICAgICAgICAgICB0aGlzLncgPSB4WzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICAgICAgdGhpcy53ID0gdztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSA0LWRpbWVuc2lvbmFsIHZlY3RvciB0byBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgdmVjdG9yIHRvIGFkZCB0byB0aGUgc3BlY2lmaWVkIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMTAsIDEwLCAxMCwgMTApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjNCgyMCwgMjAsIDIwLCAyMCk7XG4gICAgICpcbiAgICAgKiBhLmFkZChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzMwLCAzMCwgMzBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZChyaHMpIHtcbiAgICAgICAgdGhpcy54ICs9IHJocy54O1xuICAgICAgICB0aGlzLnkgKz0gcmhzLnk7XG4gICAgICAgIHRoaXMueiArPSByaHMuejtcbiAgICAgICAgdGhpcy53ICs9IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgdHdvIDQtZGltZW5zaW9uYWwgdmVjdG9ycyB0b2dldGhlciBhbmQgcmV0dXJucyB0aGUgcmVzdWx0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSBsaHMgLSBUaGUgZmlyc3QgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBhZGRpdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSBzZWNvbmQgdmVjdG9yIG9wZXJhbmQgZm9yIHRoZSBhZGRpdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMTAsIDEwLCAxMCwgMTApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjNCgyMCwgMjAsIDIwLCAyMCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWM0KCk7XG4gICAgICpcbiAgICAgKiByLmFkZDIoYSwgYik7XG4gICAgICogLy8gT3V0cHV0cyBbMzAsIDMwLCAzMF1cbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGQyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54ICsgcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55ICsgcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IGxocy56ICsgcmhzLno7XG4gICAgICAgIHRoaXMudyA9IGxocy53ICsgcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIG51bWJlciB0byBlYWNoIGVsZW1lbnQgb2YgYSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGFyIC0gVGhlIG51bWJlciB0byBhZGQuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzQoMywgNCwgNSwgNik7XG4gICAgICpcbiAgICAgKiB2ZWMuYWRkU2NhbGFyKDIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbNSwgNiwgNywgOF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGRTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCArPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSArPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueiArPSBzY2FsYXI7XG4gICAgICAgIHRoaXMudyArPSBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBpZGVudGljYWwgY29weSBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgNC1kaW1lbnNpb25hbCB2ZWN0b3IgY29udGFpbmluZyB0aGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWM0KDEwLCAyMCwgMzAsIDQwKTtcbiAgICAgKiBjb25zdCB2Y2xvbmUgPSB2LmNsb25lKCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nIGlzOiBcIiArIHZjbG9uZS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55LCB0aGlzLnosIHRoaXMudyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHRoZSBjb250ZW50cyBvZiBhIHNvdXJjZSA0LWRpbWVuc2lvbmFsIHZlY3RvciB0byBhIGRlc3RpbmF0aW9uIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBBIHZlY3RvciB0byBjb3B5IHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNyYyA9IG5ldyBwYy5WZWM0KDEwLCAyMCwgMzAsIDQwKTtcbiAgICAgKiBjb25zdCBkc3QgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogZHN0LmNvcHkoc3JjKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byB2ZWN0b3JzIGFyZSBcIiArIChkc3QuZXF1YWxzKHNyYykgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IHJocy55O1xuICAgICAgICB0aGlzLnogPSByaHMuejtcbiAgICAgICAgdGhpcy53ID0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGl2aWRlcyBhIDQtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSB2ZWN0b3IgdG8gZGl2aWRlIHRoZSBzcGVjaWZpZWQgdmVjdG9yIGJ5LlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjNCg0LCA5LCAxNiwgMjUpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjNCgyLCAzLCA0LCA1KTtcbiAgICAgKlxuICAgICAqIGEuZGl2KGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMiwgMywgNCwgNV1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRpdmlzaW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZGl2KHJocykge1xuICAgICAgICB0aGlzLnggLz0gcmhzLng7XG4gICAgICAgIHRoaXMueSAvPSByaHMueTtcbiAgICAgICAgdGhpcy56IC89IHJocy56O1xuICAgICAgICB0aGlzLncgLz0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGl2aWRlcyBvbmUgNC1kaW1lbnNpb25hbCB2ZWN0b3IgYnkgYW5vdGhlciBhbmQgd3JpdGVzIHRoZSByZXN1bHQgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IGxocyAtIFRoZSBkaXZpZGVuZCB2ZWN0b3IgKHRoZSB2ZWN0b3IgYmVpbmcgZGl2aWRlZCkuXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgZGl2aXNvciB2ZWN0b3IgKHRoZSB2ZWN0b3IgZGl2aWRpbmcgdGhlIGRpdmlkZW5kKS5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoNCwgOSwgMTYsIDI1KTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzQoMiwgMywgNCwgNSk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5WZWM0KCk7XG4gICAgICpcbiAgICAgKiByLmRpdjIoYSwgYik7XG4gICAgICogLy8gT3V0cHV0cyBbMiwgMywgNCwgNV1cbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZGl2aXNpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBkaXYyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54IC8gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55IC8gcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IGxocy56IC8gcmhzLno7XG4gICAgICAgIHRoaXMudyA9IGxocy53IC8gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGl2aWRlcyBlYWNoIGVsZW1lbnQgb2YgYSB2ZWN0b3IgYnkgYSBudW1iZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGFyIC0gVGhlIG51bWJlciB0byBkaXZpZGUgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzQoMywgNiwgOSwgMTIpO1xuICAgICAqXG4gICAgICogdmVjLmRpdlNjYWxhcigzKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzEsIDIsIDMsIDRdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBkaXZpc2lvbiBpczogXCIgKyB2ZWMudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZGl2U2NhbGFyKHNjYWxhcikge1xuICAgICAgICB0aGlzLnggLz0gc2NhbGFyO1xuICAgICAgICB0aGlzLnkgLz0gc2NhbGFyO1xuICAgICAgICB0aGlzLnogLz0gc2NhbGFyO1xuICAgICAgICB0aGlzLncgLz0gc2NhbGFyO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBhIGRvdCBwcm9kdWN0IG9wZXJhdGlvbiBwZXJmb3JtZWQgb24gdGhlIHR3byBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbFxuICAgICAqIHZlY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSBzZWNvbmQgNC1kaW1lbnNpb25hbCB2ZWN0b3Igb3BlcmFuZCBvZiB0aGUgZG90IHByb2R1Y3QuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIHJlc3VsdCBvZiB0aGUgZG90IHByb2R1Y3Qgb3BlcmF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdjEgPSBuZXcgcGMuVmVjNCg1LCAxMCwgMjAsIDQwKTtcbiAgICAgKiBjb25zdCB2MiA9IG5ldyBwYy5WZWM0KDEwLCAyMCwgNDAsIDgwKTtcbiAgICAgKiBjb25zdCB2MWRvdHYyID0gdjEuZG90KHYyKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGRvdCBwcm9kdWN0IGlzOiBcIiArIHYxZG90djIpO1xuICAgICAqL1xuICAgIGRvdChyaHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCAqIHJocy54ICsgdGhpcy55ICogcmhzLnkgKyB0aGlzLnogKiByaHMueiArIHRoaXMudyAqIHJocy53O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0d28gdmVjdG9ycyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSB2ZWN0b3IgdG8gY29tcGFyZSB0byB0aGUgc3BlY2lmaWVkIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmVjdG9ycyBhcmUgZXF1YWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjNCgxLCAyLCAzLCA0KTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzQoNSwgNiwgNywgOCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHZlY3RvcnMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCA9PT0gcmhzLnggJiYgdGhpcy55ID09PSByaHMueSAmJiB0aGlzLnogPT09IHJocy56ICYmIHRoaXMudyA9PT0gcmhzLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjNCgzLCA0LCAwLCAwKTtcbiAgICAgKiBjb25zdCBsZW4gPSB2ZWMubGVuZ3RoKCk7XG4gICAgICogLy8gT3V0cHV0cyA1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIG9mIHRoZSB2ZWN0b3IgaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgc3F1YXJlZCBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzQoMywgNCwgMCk7XG4gICAgICogY29uc3QgbGVuID0gdmVjLmxlbmd0aFNxKCk7XG4gICAgICogLy8gT3V0cHV0cyAyNVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGxlbmd0aCBzcXVhcmVkIG9mIHRoZSB2ZWN0b3IgaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGhTcSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSArIHRoaXMueiAqIHRoaXMueiArIHRoaXMudyAqIHRoaXMudztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgYSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHR3byBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbCB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSBsaHMgLSBUaGUgNC1kaW1lbnNpb25hbCB0byBpbnRlcnBvbGF0ZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdG8gaW50ZXJwb2xhdGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFscGhhIC0gVGhlIHZhbHVlIGNvbnRyb2xsaW5nIHRoZSBwb2ludCBvZiBpbnRlcnBvbGF0aW9uLiBCZXR3ZWVuIDAgYW5kIDEsXG4gICAgICogdGhlIGxpbmVhciBpbnRlcnBvbGFudCB3aWxsIG9jY3VyIG9uIGEgc3RyYWlnaHQgbGluZSBiZXR3ZWVuIGxocyBhbmQgcmhzLiBPdXRzaWRlIG9mIHRoaXNcbiAgICAgKiByYW5nZSwgdGhlIGxpbmVhciBpbnRlcnBvbGFudCB3aWxsIG9jY3VyIG9uIGEgcmF5IGV4dHJhcG9sYXRlZCBmcm9tIHRoaXMgbGluZS5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMCwgMCwgMCwgMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWM0KDEwLCAxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzQoKTtcbiAgICAgKlxuICAgICAqIHIubGVycChhLCBiLCAwKTsgICAvLyByIGlzIGVxdWFsIHRvIGFcbiAgICAgKiByLmxlcnAoYSwgYiwgMC41KTsgLy8gciBpcyA1LCA1LCA1LCA1XG4gICAgICogci5sZXJwKGEsIGIsIDEpOyAgIC8vIHIgaXMgZXF1YWwgdG8gYlxuICAgICAqL1xuICAgIGxlcnAobGhzLCByaHMsIGFscGhhKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54ICsgYWxwaGEgKiAocmhzLnggLSBsaHMueCk7XG4gICAgICAgIHRoaXMueSA9IGxocy55ICsgYWxwaGEgKiAocmhzLnkgLSBsaHMueSk7XG4gICAgICAgIHRoaXMueiA9IGxocy56ICsgYWxwaGEgKiAocmhzLnogLSBsaHMueik7XG4gICAgICAgIHRoaXMudyA9IGxocy53ICsgYWxwaGEgKiAocmhzLncgLSBsaHMudyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyBhIDQtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSA0LWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWM0KDIsIDMsIDQsIDUpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjNCg0LCA1LCA2LCA3KTtcbiAgICAgKlxuICAgICAqIGEubXVsKGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA4LCAxNSwgMjQsIDM1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bChyaHMpIHtcbiAgICAgICAgdGhpcy54ICo9IHJocy54O1xuICAgICAgICB0aGlzLnkgKj0gcmhzLnk7XG4gICAgICAgIHRoaXMueiAqPSByaHMuejtcbiAgICAgICAgdGhpcy53ICo9IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBtdWx0aXBseWluZyB0aGUgc3BlY2lmaWVkIDQtZGltZW5zaW9uYWwgdmVjdG9ycyB0b2dldGhlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gbGhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzQoMiwgMywgNCwgNSk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWM0KDQsIDUsIDYsIDcpO1xuICAgICAqIGNvbnN0IHIgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogci5tdWwyKGEsIGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA4LCAxNSwgMjQsIDM1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bDIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKiByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKiByaHMueTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogKiByaHMuejtcbiAgICAgICAgdGhpcy53ID0gbGhzLncgKiByaHMudztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBsaWVzIGVhY2ggZWxlbWVudCBvZiBhIHZlY3RvciBieSBhIG51bWJlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIG11bHRpcGx5IGJ5LlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWM0KDMsIDYsIDksIDEyKTtcbiAgICAgKlxuICAgICAqIHZlYy5tdWxTY2FsYXIoMyk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFs5LCAxOCwgMjcsIDM2XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bFNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy55ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy56ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy53ICo9IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoaXMgNC1kaW1lbnNpb25hbCB2ZWN0b3IgY29udmVydGVkIHRvIGEgdW5pdCB2ZWN0b3IgaW4gcGxhY2UuIElmIHRoZSB2ZWN0b3IgaGFzIGFcbiAgICAgKiBsZW5ndGggb2YgemVybywgdGhlIHZlY3RvcidzIGVsZW1lbnRzIHdpbGwgYmUgc2V0IHRvIHplcm8uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzQoMjUsIDAsIDAsIDApO1xuICAgICAqXG4gICAgICogdi5ub3JtYWxpemUoKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIG5vcm1hbGl6YXRpb24gaXM6IFwiICsgdi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBub3JtYWxpemUoKSB7XG4gICAgICAgIGNvbnN0IGxlbmd0aFNxID0gdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53O1xuICAgICAgICBpZiAobGVuZ3RoU3EgPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnZMZW5ndGggPSAxIC8gTWF0aC5zcXJ0KGxlbmd0aFNxKTtcbiAgICAgICAgICAgIHRoaXMueCAqPSBpbnZMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnkgKj0gaW52TGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy56ICo9IGludkxlbmd0aDtcbiAgICAgICAgICAgIHRoaXMudyAqPSBpbnZMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgc2V0IHRvIHRoZSBsYXJnZXN0IGludGVnZXIgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGl0cyB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBmbG9vcigpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5mbG9vcih0aGlzLngpO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLmZsb29yKHRoaXMueSk7XG4gICAgICAgIHRoaXMueiA9IE1hdGguZmxvb3IodGhpcy56KTtcbiAgICAgICAgdGhpcy53ID0gTWF0aC5mbG9vcih0aGlzLncpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgcm91bmRlZCB1cCB0byB0aGUgbmV4dCBsYXJnZXN0IGludGVnZXIuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY2VpbCgpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5jZWlsKHRoaXMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGguY2VpbCh0aGlzLnkpO1xuICAgICAgICB0aGlzLnogPSBNYXRoLmNlaWwodGhpcy56KTtcbiAgICAgICAgdGhpcy53ID0gTWF0aC5jZWlsKHRoaXMudyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyByb3VuZGVkIHVwIG9yIGRvd24gdG8gdGhlIG5lYXJlc3QgaW50ZWdlci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICByb3VuZCgpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5yb3VuZCh0aGlzLngpO1xuICAgICAgICB0aGlzLnkgPSBNYXRoLnJvdW5kKHRoaXMueSk7XG4gICAgICAgIHRoaXMueiA9IE1hdGgucm91bmQodGhpcy56KTtcbiAgICAgICAgdGhpcy53ID0gTWF0aC5yb3VuZCh0aGlzLncpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgYXNzaWduZWQgYSB2YWx1ZSBmcm9tIHJocyBwYXJhbWV0ZXIgaWYgaXQgaXMgc21hbGxlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNvdXJjZSBvZiBlbGVtZW50cyB0byBjb21wYXJlIHRvLlxuICAgICAqIEByZXR1cm5zIHtWZWM0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBtaW4ocmhzKSB7XG4gICAgICAgIGlmIChyaHMueCA8IHRoaXMueCkgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIGlmIChyaHMueSA8IHRoaXMueSkgdGhpcy55ID0gcmhzLnk7XG4gICAgICAgIGlmIChyaHMueiA8IHRoaXMueikgdGhpcy56ID0gcmhzLno7XG4gICAgICAgIGlmIChyaHMudyA8IHRoaXMudykgdGhpcy53ID0gcmhzLnc7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyBhc3NpZ25lZCBhIHZhbHVlIGZyb20gcmhzIHBhcmFtZXRlciBpZiBpdCBpcyBsYXJnZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzR9IHJocyAtIFRoZSA0LWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzb3VyY2Ugb2YgZWxlbWVudHMgdG8gY29tcGFyZSB0by5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgbWF4KHJocykge1xuICAgICAgICBpZiAocmhzLnggPiB0aGlzLngpIHRoaXMueCA9IHJocy54O1xuICAgICAgICBpZiAocmhzLnkgPiB0aGlzLnkpIHRoaXMueSA9IHJocy55O1xuICAgICAgICBpZiAocmhzLnogPiB0aGlzLnopIHRoaXMueiA9IHJocy56O1xuICAgICAgICBpZiAocmhzLncgPiB0aGlzLncpIHRoaXMudyA9IHJocy53O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgNC1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gdGhlIHN1cHBsaWVkIG51bWVyaWNhbCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB2YWx1ZSB0byBzZXQgb24gdGhlIGZpcnN0IGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHZhbHVlIHRvIHNldCBvbiB0aGUgc2Vjb25kIGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIHZhbHVlIHRvIHNldCBvbiB0aGUgdGhpcmQgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSBmb3VydGggY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5WZWM0KCk7XG4gICAgICogdi5zZXQoNSwgMTAsIDIwLCA0MCk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIDUsIDEwLCAyMCwgNDBcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHZlY3RvciBzZXQgaXM6IFwiICsgdi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzZXQoeCwgeSwgeiwgdykge1xuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICB0aGlzLncgPSB3O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0cyBhIDQtZGltZW5zaW9uYWwgdmVjdG9yIGZyb20gYW5vdGhlciBpbiBwbGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gcmhzIC0gVGhlIHZlY3RvciB0byBhZGQgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWM0KDEwLCAxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzQoMjAsIDIwLCAyMCwgMjApO1xuICAgICAqXG4gICAgICogYS5zdWIoYik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFstMTAsIC0xMCwgLTEwLCAtMTBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHN1YihyaHMpIHtcbiAgICAgICAgdGhpcy54IC09IHJocy54O1xuICAgICAgICB0aGlzLnkgLT0gcmhzLnk7XG4gICAgICAgIHRoaXMueiAtPSByaHMuejtcbiAgICAgICAgdGhpcy53IC09IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0cyB0d28gNC1kaW1lbnNpb25hbCB2ZWN0b3JzIGZyb20gb25lIGFub3RoZXIgYW5kIHJldHVybnMgdGhlIHJlc3VsdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gbGhzIC0gVGhlIGZpcnN0IHZlY3RvciBvcGVyYW5kIGZvciB0aGUgc3VidHJhY3Rpb24uXG4gICAgICogQHBhcmFtIHtWZWM0fSByaHMgLSBUaGUgc2Vjb25kIHZlY3RvciBvcGVyYW5kIGZvciB0aGUgc3VidHJhY3Rpb24uXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWM0KDEwLCAxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzQoMjAsIDIwLCAyMCwgMjApO1xuICAgICAqIGNvbnN0IHIgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogci5zdWIyKGEsIGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbLTEwLCAtMTAsIC0xMCwgLTEwXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgc3VidHJhY3Rpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzdWIyKGxocywgcmhzKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54IC0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IGxocy55IC0gcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IGxocy56IC0gcmhzLno7XG4gICAgICAgIHRoaXMudyA9IGxocy53IC0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIGEgbnVtYmVyIGZyb20gZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gc3VidHJhY3QuXG4gICAgICogQHJldHVybnMge1ZlYzR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzQoMywgNCwgNSwgNik7XG4gICAgICpcbiAgICAgKiB2ZWMuc3ViU2NhbGFyKDIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbMSwgMiwgMywgNF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHN1YnRyYWN0aW9uIGlzOiBcIiArIHZlYy50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzdWJTY2FsYXIoc2NhbGFyKSB7XG4gICAgICAgIHRoaXMueCAtPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueSAtPSBzY2FsYXI7XG4gICAgICAgIHRoaXMueiAtPSBzY2FsYXI7XG4gICAgICAgIHRoaXMudyAtPSBzY2FsYXI7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHZlY3RvciB0byBzdHJpbmcgZm9ybS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSB2ZWN0b3IgaW4gc3RyaW5nIGZvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzQoMjAsIDEwLCA1LCAwKTtcbiAgICAgKiAvLyBPdXRwdXRzIFsyMCwgMTAsIDUsIDBdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIGBbJHt0aGlzLnh9LCAke3RoaXMueX0sICR7dGhpcy56fSwgJHt0aGlzLnd9XWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFswLCAwLCAwLCAwXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWM0fVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBaRVJPID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjNCgwLCAwLCAwLCAwKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzEsIDEsIDEsIDFdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIE9ORSA9IE9iamVjdC5mcmVlemUobmV3IFZlYzQoMSwgMSwgMSwgMSkpO1xufVxuXG5leHBvcnQgeyBWZWM0IH07XG4iXSwibmFtZXMiOlsiVmVjNCIsImNvbnN0cnVjdG9yIiwieCIsInkiLCJ6IiwidyIsImxlbmd0aCIsImFkZCIsInJocyIsImFkZDIiLCJsaHMiLCJhZGRTY2FsYXIiLCJzY2FsYXIiLCJjbG9uZSIsImNzdHIiLCJjb3B5IiwiZGl2IiwiZGl2MiIsImRpdlNjYWxhciIsImRvdCIsImVxdWFscyIsIk1hdGgiLCJzcXJ0IiwibGVuZ3RoU3EiLCJsZXJwIiwiYWxwaGEiLCJtdWwiLCJtdWwyIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwiaW52TGVuZ3RoIiwiZmxvb3IiLCJjZWlsIiwicm91bmQiLCJtaW4iLCJtYXgiLCJzZXQiLCJzdWIiLCJzdWIyIiwic3ViU2NhbGFyIiwidG9TdHJpbmciLCJaRVJPIiwiT2JqZWN0IiwiZnJlZXplIiwiT05FIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxJQUFJLENBQUM7QUE2QlA7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBdkN4QztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FILENBQUMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsQ0FBQyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxDQUFDLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLENBQUMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQWNHLElBQUEsSUFBSUgsQ0FBQyxDQUFDSSxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ2hCLE1BQUEsSUFBSSxDQUFDSixDQUFDLEdBQUdBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNiLE1BQUEsSUFB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
