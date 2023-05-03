/**
 * 3-dimensional vector.
 */
class Vec3 {
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
   * Creates a new Vec3 object.
   *
   * @param {number|number[]} [x] - The x value. Defaults to 0. If x is an array of length 3, the
   * array will be used to populate all components.
   * @param {number} [y] - The y value. Defaults to 0.
   * @param {number} [z] - The z value. Defaults to 0.
   * @example
   * const v = new pc.Vec3(1, 2, 3);
   */
  constructor(x = 0, y = 0, z = 0) {
    this.x = void 0;
    this.y = void 0;
    this.z = void 0;
    if (x.length === 3) {
      this.x = x[0];
      this.y = x[1];
      this.z = x[2];
    } else {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }

  /**
   * Adds a 3-dimensional vector to another in place.
   *
   * @param {Vec3} rhs - The vector to add to the specified vector.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(10, 10, 10);
   * const b = new pc.Vec3(20, 20, 20);
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
    return this;
  }

  /**
   * Adds two 3-dimensional vectors together and returns the result.
   *
   * @param {Vec3} lhs - The first vector operand for the addition.
   * @param {Vec3} rhs - The second vector operand for the addition.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(10, 10, 10);
   * const b = new pc.Vec3(20, 20, 20);
   * const r = new pc.Vec3();
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
    return this;
  }

  /**
   * Adds a number to each element of a vector.
   *
   * @param {number} scalar - The number to add.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(3, 4, 5);
   *
   * vec.addScalar(2);
   *
   * // Outputs [5, 6, 7]
   * console.log("The result of the addition is: " + vec.toString());
   */
  addScalar(scalar) {
    this.x += scalar;
    this.y += scalar;
    this.z += scalar;
    return this;
  }

  /**
   * Returns an identical copy of the specified 3-dimensional vector.
   *
   * @returns {this} A 3-dimensional vector containing the result of the cloning.
   * @example
   * const v = new pc.Vec3(10, 20, 30);
   * const vclone = v.clone();
   * console.log("The result of the cloning is: " + vclone.toString());
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr(this.x, this.y, this.z);
  }

  /**
   * Copies the contents of a source 3-dimensional vector to a destination 3-dimensional vector.
   *
   * @param {Vec3} rhs - A vector to copy to the specified vector.
   * @returns {Vec3} Self for chaining.
   * @example
   * const src = new pc.Vec3(10, 20, 30);
   * const dst = new pc.Vec3();
   *
   * dst.copy(src);
   *
   * console.log("The two vectors are " + (dst.equals(src) ? "equal" : "different"));
   */
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    return this;
  }

  /**
   * Returns the result of a cross product operation performed on the two specified 3-dimensional
   * vectors.
   *
   * @param {Vec3} lhs - The first 3-dimensional vector operand of the cross product.
   * @param {Vec3} rhs - The second 3-dimensional vector operand of the cross product.
   * @returns {Vec3} Self for chaining.
   * @example
   * const back = new pc.Vec3().cross(pc.Vec3.RIGHT, pc.Vec3.UP);
   *
   * // Prints the Z axis (i.e. [0, 0, 1])
   * console.log("The result of the cross product is: " + back.toString());
   */
  cross(lhs, rhs) {
    // Create temporary variables in case lhs or rhs are 'this'
    const lx = lhs.x;
    const ly = lhs.y;
    const lz = lhs.z;
    const rx = rhs.x;
    const ry = rhs.y;
    const rz = rhs.z;
    this.x = ly * rz - ry * lz;
    this.y = lz * rx - rz * lx;
    this.z = lx * ry - rx * ly;
    return this;
  }

  /**
   * Returns the distance between the two specified 3-dimensional vectors.
   *
   * @param {Vec3} rhs - The second 3-dimensional vector to test.
   * @returns {number} The distance between the two vectors.
   * @example
   * const v1 = new pc.Vec3(5, 10, 20);
   * const v2 = new pc.Vec3(10, 20, 40);
   * const d = v1.distance(v2);
   * console.log("The distance between v1 and v2 is: " + d);
   */
  distance(rhs) {
    const x = this.x - rhs.x;
    const y = this.y - rhs.y;
    const z = this.z - rhs.z;
    return Math.sqrt(x * x + y * y + z * z);
  }

  /**
   * Divides a 3-dimensional vector by another in place.
   *
   * @param {Vec3} rhs - The vector to divide the specified vector by.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(4, 9, 16);
   * const b = new pc.Vec3(2, 3, 4);
   *
   * a.div(b);
   *
   * // Outputs [2, 3, 4]
   * console.log("The result of the division is: " + a.toString());
   */
  div(rhs) {
    this.x /= rhs.x;
    this.y /= rhs.y;
    this.z /= rhs.z;
    return this;
  }

  /**
   * Divides one 3-dimensional vector by another and writes the result to the specified vector.
   *
   * @param {Vec3} lhs - The dividend vector (the vector being divided).
   * @param {Vec3} rhs - The divisor vector (the vector dividing the dividend).
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(4, 9, 16);
   * const b = new pc.Vec3(2, 3, 4);
   * const r = new pc.Vec3();
   *
   * r.div2(a, b);
   * // Outputs [2, 3, 4]
   *
   * console.log("The result of the division is: " + r.toString());
   */
  div2(lhs, rhs) {
    this.x = lhs.x / rhs.x;
    this.y = lhs.y / rhs.y;
    this.z = lhs.z / rhs.z;
    return this;
  }

  /**
   * Divides each element of a vector by a number.
   *
   * @param {number} scalar - The number to divide by.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(3, 6, 9);
   *
   * vec.divScalar(3);
   *
   * // Outputs [1, 2, 3]
   * console.log("The result of the division is: " + vec.toString());
   */
  divScalar(scalar) {
    this.x /= scalar;
    this.y /= scalar;
    this.z /= scalar;
    return this;
  }

  /**
   * Returns the result of a dot product operation performed on the two specified 3-dimensional
   * vectors.
   *
   * @param {Vec3} rhs - The second 3-dimensional vector operand of the dot product.
   * @returns {number} The result of the dot product operation.
   * @example
   * const v1 = new pc.Vec3(5, 10, 20);
   * const v2 = new pc.Vec3(10, 20, 40);
   * const v1dotv2 = v1.dot(v2);
   * console.log("The result of the dot product is: " + v1dotv2);
   */
  dot(rhs) {
    return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
  }

  /**
   * Reports whether two vectors are equal.
   *
   * @param {Vec3} rhs - The vector to compare to the specified vector.
   * @returns {boolean} True if the vectors are equal and false otherwise.
   * @example
   * const a = new pc.Vec3(1, 2, 3);
   * const b = new pc.Vec3(4, 5, 6);
   * console.log("The two vectors are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
  }

  /**
   * Returns the magnitude of the specified 3-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 3-dimensional vector.
   * @example
   * const vec = new pc.Vec3(3, 4, 0);
   * const len = vec.length();
   * // Outputs 5
   * console.log("The length of the vector is: " + len);
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /**
   * Returns the magnitude squared of the specified 3-dimensional vector.
   *
   * @returns {number} The magnitude of the specified 3-dimensional vector.
   * @example
   * const vec = new pc.Vec3(3, 4, 0);
   * const len = vec.lengthSq();
   * // Outputs 25
   * console.log("The length squared of the vector is: " + len);
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * Returns the result of a linear interpolation between two specified 3-dimensional vectors.
   *
   * @param {Vec3} lhs - The 3-dimensional to interpolate from.
   * @param {Vec3} rhs - The 3-dimensional to interpolate to.
   * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
   * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
   * range, the linear interpolant will occur on a ray extrapolated from this line.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(0, 0, 0);
   * const b = new pc.Vec3(10, 10, 10);
   * const r = new pc.Vec3();
   *
   * r.lerp(a, b, 0);   // r is equal to a
   * r.lerp(a, b, 0.5); // r is 5, 5, 5
   * r.lerp(a, b, 1);   // r is equal to b
   */
  lerp(lhs, rhs, alpha) {
    this.x = lhs.x + alpha * (rhs.x - lhs.x);
    this.y = lhs.y + alpha * (rhs.y - lhs.y);
    this.z = lhs.z + alpha * (rhs.z - lhs.z);
    return this;
  }

  /**
   * Multiplies a 3-dimensional vector to another in place.
   *
   * @param {Vec3} rhs - The 3-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(2, 3, 4);
   * const b = new pc.Vec3(4, 5, 6);
   *
   * a.mul(b);
   *
   * // Outputs 8, 15, 24
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    this.x *= rhs.x;
    this.y *= rhs.y;
    this.z *= rhs.z;
    return this;
  }

  /**
   * Returns the result of multiplying the specified 3-dimensional vectors together.
   *
   * @param {Vec3} lhs - The 3-dimensional vector used as the first multiplicand of the operation.
   * @param {Vec3} rhs - The 3-dimensional vector used as the second multiplicand of the operation.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(2, 3, 4);
   * const b = new pc.Vec3(4, 5, 6);
   * const r = new pc.Vec3();
   *
   * r.mul2(a, b);
   *
   * // Outputs 8, 15, 24
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    this.x = lhs.x * rhs.x;
    this.y = lhs.y * rhs.y;
    this.z = lhs.z * rhs.z;
    return this;
  }

  /**
   * Multiplies each element of a vector by a number.
   *
   * @param {number} scalar - The number to multiply by.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(3, 6, 9);
   *
   * vec.mulScalar(3);
   *
   * // Outputs [9, 18, 27]
   * console.log("The result of the multiplication is: " + vec.toString());
   */
  mulScalar(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  /**
   * Returns this 3-dimensional vector converted to a unit vector in place. If the vector has a
   * length of zero, the vector's elements will be set to zero.
   *
   * @returns {Vec3} Self for chaining.
   * @example
   * const v = new pc.Vec3(25, 0, 0);
   *
   * v.normalize();
   *
   * // Outputs 1, 0, 0
   * console.log("The result of the vector normalization is: " + v.toString());
   */
  normalize() {
    const lengthSq = this.x * this.x + this.y * this.y + this.z * this.z;
    if (lengthSq > 0) {
      const invLength = 1 / Math.sqrt(lengthSq);
      this.x *= invLength;
      this.y *= invLength;
      this.z *= invLength;
    }
    return this;
  }

  /**
   * Each element is set to the largest integer less than or equal to its value.
   *
   * @returns {Vec3} Self for chaining.
   */
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    return this;
  }

  /**
   * Each element is rounded up to the next largest integer.
   *
   * @returns {Vec3} Self for chaining.
   */
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    return this;
  }

  /**
   * Each element is rounded up or down to the nearest integer.
   *
   * @returns {Vec3} Self for chaining.
   */
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is smaller.
   *
   * @param {Vec3} rhs - The 3-dimensional vector used as the source of elements to compare to.
   * @returns {Vec3} Self for chaining.
   */
  min(rhs) {
    if (rhs.x < this.x) this.x = rhs.x;
    if (rhs.y < this.y) this.y = rhs.y;
    if (rhs.z < this.z) this.z = rhs.z;
    return this;
  }

  /**
   * Each element is assigned a value from rhs parameter if it is larger.
   *
   * @param {Vec3} rhs - The 3-dimensional vector used as the source of elements to compare to.
   * @returns {Vec3} Self for chaining.
   */
  max(rhs) {
    if (rhs.x > this.x) this.x = rhs.x;
    if (rhs.y > this.y) this.y = rhs.y;
    if (rhs.z > this.z) this.z = rhs.z;
    return this;
  }

  /**
   * Projects this 3-dimensional vector onto the specified vector.
   *
   * @param {Vec3} rhs - The vector onto which the original vector will be projected on.
   * @returns {Vec3} Self for chaining.
   * @example
   * const v = new pc.Vec3(5, 5, 5);
   * const normal = new pc.Vec3(1, 0, 0);
   *
   * v.project(normal);
   *
   * // Outputs 5, 0, 0
   * console.log("The result of the vector projection is: " + v.toString());
   */
  project(rhs) {
    const a_dot_b = this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
    const b_dot_b = rhs.x * rhs.x + rhs.y * rhs.y + rhs.z * rhs.z;
    const s = a_dot_b / b_dot_b;
    this.x = rhs.x * s;
    this.y = rhs.y * s;
    this.z = rhs.z * s;
    return this;
  }

  /**
   * Sets the specified 3-dimensional vector to the supplied numerical values.
   *
   * @param {number} x - The value to set on the first component of the vector.
   * @param {number} y - The value to set on the second component of the vector.
   * @param {number} z - The value to set on the third component of the vector.
   * @returns {Vec3} Self for chaining.
   * @example
   * const v = new pc.Vec3();
   * v.set(5, 10, 20);
   *
   * // Outputs 5, 10, 20
   * console.log("The result of the vector set is: " + v.toString());
   */
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  /**
   * Subtracts a 3-dimensional vector from another in place.
   *
   * @param {Vec3} rhs - The vector to subtract from the specified vector.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(10, 10, 10);
   * const b = new pc.Vec3(20, 20, 20);
   *
   * a.sub(b);
   *
   * // Outputs [-10, -10, -10]
   * console.log("The result of the subtraction is: " + a.toString());
   */
  sub(rhs) {
    this.x -= rhs.x;
    this.y -= rhs.y;
    this.z -= rhs.z;
    return this;
  }

  /**
   * Subtracts two 3-dimensional vectors from one another and returns the result.
   *
   * @param {Vec3} lhs - The first vector operand for the subtraction.
   * @param {Vec3} rhs - The second vector operand for the subtraction.
   * @returns {Vec3} Self for chaining.
   * @example
   * const a = new pc.Vec3(10, 10, 10);
   * const b = new pc.Vec3(20, 20, 20);
   * const r = new pc.Vec3();
   *
   * r.sub2(a, b);
   *
   * // Outputs [-10, -10, -10]
   * console.log("The result of the subtraction is: " + r.toString());
   */
  sub2(lhs, rhs) {
    this.x = lhs.x - rhs.x;
    this.y = lhs.y - rhs.y;
    this.z = lhs.z - rhs.z;
    return this;
  }

  /**
   * Subtracts a number from each element of a vector.
   *
   * @param {number} scalar - The number to subtract.
   * @returns {Vec3} Self for chaining.
   * @example
   * const vec = new pc.Vec3(3, 4, 5);
   *
   * vec.subScalar(2);
   *
   * // Outputs [1, 2, 3]
   * console.log("The result of the subtraction is: " + vec.toString());
   */
  subScalar(scalar) {
    this.x -= scalar;
    this.y -= scalar;
    this.z -= scalar;
    return this;
  }

  /**
   * Converts the vector to string form.
   *
   * @returns {string} The vector in string form.
   * @example
   * const v = new pc.Vec3(20, 10, 5);
   * // Outputs [20, 10, 5]
   * console.log(v.toString());
   */
  toString() {
    return `[${this.x}, ${this.y}, ${this.z}]`;
  }

  /**
   * A constant vector set to [0, 0, 0].
   *
   * @type {Vec3}
   * @readonly
   */
}
Vec3.ZERO = Object.freeze(new Vec3(0, 0, 0));
Vec3.ONE = Object.freeze(new Vec3(1, 1, 1));
Vec3.UP = Object.freeze(new Vec3(0, 1, 0));
Vec3.DOWN = Object.freeze(new Vec3(0, -1, 0));
Vec3.RIGHT = Object.freeze(new Vec3(1, 0, 0));
Vec3.LEFT = Object.freeze(new Vec3(-1, 0, 0));
Vec3.FORWARD = Object.freeze(new Vec3(0, 0, -1));
Vec3.BACK = Object.freeze(new Vec3(0, 0, 1));

export { Vec3 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVjMy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC92ZWMzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogMy1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gKi9cbmNsYXNzIFZlYzMge1xuICAgIC8qKlxuICAgICAqIFRoZSBmaXJzdCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgeDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBzZWNvbmQgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdGhpcmQgY29tcG9uZW50IG9mIHRoZSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHo7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFZlYzMgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW119IFt4XSAtIFRoZSB4IHZhbHVlLiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5IG9mIGxlbmd0aCAzLCB0aGVcbiAgICAgKiBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSB5IHZhbHVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgeiB2YWx1ZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih4ID0gMCwgeSA9IDAsIHogPSAwKSB7XG4gICAgICAgIGlmICh4Lmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgdGhpcy54ID0geFswXTtcbiAgICAgICAgICAgIHRoaXMueSA9IHhbMV07XG4gICAgICAgICAgICB0aGlzLnogPSB4WzJdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSB2ZWN0b3IgdG8gYWRkIHRvIHRoZSBzcGVjaWZpZWQgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMygxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzMoMjAsIDIwLCAyMCk7XG4gICAgICpcbiAgICAgKiBhLmFkZChiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWzMwLCAzMCwgMzBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyBhLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZChyaHMpIHtcbiAgICAgICAgdGhpcy54ICs9IHJocy54O1xuICAgICAgICB0aGlzLnkgKz0gcmhzLnk7XG4gICAgICAgIHRoaXMueiArPSByaHMuejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHR3byAzLWRpbWVuc2lvbmFsIHZlY3RvcnMgdG9nZXRoZXIgYW5kIHJldHVybnMgdGhlIHJlc3VsdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gbGhzIC0gVGhlIGZpcnN0IHZlY3RvciBvcGVyYW5kIGZvciB0aGUgYWRkaXRpb24uXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgc2Vjb25kIHZlY3RvciBvcGVyYW5kIGZvciB0aGUgYWRkaXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMygyMCwgMjAsIDIwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKlxuICAgICAqIHIuYWRkMihhLCBiKTtcbiAgICAgKiAvLyBPdXRwdXRzIFszMCwgMzAsIDMwXVxuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZDIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggKyByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgKyByaHMueTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogKyByaHMuejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbnVtYmVyIHRvIGVhY2ggZWxlbWVudCBvZiBhIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIGFkZC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjMygzLCA0LCA1KTtcbiAgICAgKlxuICAgICAqIHZlYy5hZGRTY2FsYXIoMik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFs1LCA2LCA3XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZFNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54ICs9IHNjYWxhcjtcbiAgICAgICAgdGhpcy55ICs9IHNjYWxhcjtcbiAgICAgICAgdGhpcy56ICs9IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIGlkZW50aWNhbCBjb3B5IG9mIHRoZSBzcGVjaWZpZWQgMy1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSAzLWRpbWVuc2lvbmFsIHZlY3RvciBjb250YWluaW5nIHRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzMoMTAsIDIwLCAzMCk7XG4gICAgICogY29uc3QgdmNsb25lID0gdi5jbG9uZSgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgY2xvbmluZyBpczogXCIgKyB2Y2xvbmUudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7dGhpc30gKi9cbiAgICAgICAgY29uc3QgY3N0ciA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgICAgIHJldHVybiBuZXcgY3N0cih0aGlzLngsIHRoaXMueSwgdGhpcy56KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGEgZGVzdGluYXRpb24gMy1kaW1lbnNpb25hbCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIEEgdmVjdG9yIHRvIGNvcHkgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgc3JjID0gbmV3IHBjLlZlYzMoMTAsIDIwLCAzMCk7XG4gICAgICogY29uc3QgZHN0ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKlxuICAgICAqIGRzdC5jb3B5KHNyYyk7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gdmVjdG9ycyBhcmUgXCIgKyAoZHN0LmVxdWFscyhzcmMpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGNvcHkocmhzKSB7XG4gICAgICAgIHRoaXMueCA9IHJocy54O1xuICAgICAgICB0aGlzLnkgPSByaHMueTtcbiAgICAgICAgdGhpcy56ID0gcmhzLno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIGEgY3Jvc3MgcHJvZHVjdCBvcGVyYXRpb24gcGVyZm9ybWVkIG9uIHRoZSB0d28gc3BlY2lmaWVkIDMtZGltZW5zaW9uYWxcbiAgICAgKiB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBsaHMgLSBUaGUgZmlyc3QgMy1kaW1lbnNpb25hbCB2ZWN0b3Igb3BlcmFuZCBvZiB0aGUgY3Jvc3MgcHJvZHVjdC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSBzZWNvbmQgMy1kaW1lbnNpb25hbCB2ZWN0b3Igb3BlcmFuZCBvZiB0aGUgY3Jvc3MgcHJvZHVjdC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBiYWNrID0gbmV3IHBjLlZlYzMoKS5jcm9zcyhwYy5WZWMzLlJJR0hULCBwYy5WZWMzLlVQKTtcbiAgICAgKlxuICAgICAqIC8vIFByaW50cyB0aGUgWiBheGlzIChpLmUuIFswLCAwLCAxXSlcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGNyb3NzIHByb2R1Y3QgaXM6IFwiICsgYmFjay50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjcm9zcyhsaHMsIHJocykge1xuICAgICAgICAvLyBDcmVhdGUgdGVtcG9yYXJ5IHZhcmlhYmxlcyBpbiBjYXNlIGxocyBvciByaHMgYXJlICd0aGlzJ1xuICAgICAgICBjb25zdCBseCA9IGxocy54O1xuICAgICAgICBjb25zdCBseSA9IGxocy55O1xuICAgICAgICBjb25zdCBseiA9IGxocy56O1xuICAgICAgICBjb25zdCByeCA9IHJocy54O1xuICAgICAgICBjb25zdCByeSA9IHJocy55O1xuICAgICAgICBjb25zdCByeiA9IHJocy56O1xuXG4gICAgICAgIHRoaXMueCA9IGx5ICogcnogLSByeSAqIGx6O1xuICAgICAgICB0aGlzLnkgPSBseiAqIHJ4IC0gcnogKiBseDtcbiAgICAgICAgdGhpcy56ID0gbHggKiByeSAtIHJ4ICogbHk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgZGlzdGFuY2UgYmV0d2VlbiB0aGUgdHdvIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsIHZlY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSBzZWNvbmQgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gdGVzdC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgZGlzdGFuY2UgYmV0d2VlbiB0aGUgdHdvIHZlY3RvcnMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2MSA9IG5ldyBwYy5WZWMzKDUsIDEwLCAyMCk7XG4gICAgICogY29uc3QgdjIgPSBuZXcgcGMuVmVjMygxMCwgMjAsIDQwKTtcbiAgICAgKiBjb25zdCBkID0gdjEuZGlzdGFuY2UodjIpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGRpc3RhbmNlIGJldHdlZW4gdjEgYW5kIHYyIGlzOiBcIiArIGQpO1xuICAgICAqL1xuICAgIGRpc3RhbmNlKHJocykge1xuICAgICAgICBjb25zdCB4ID0gdGhpcy54IC0gcmhzLng7XG4gICAgICAgIGNvbnN0IHkgPSB0aGlzLnkgLSByaHMueTtcbiAgICAgICAgY29uc3QgeiA9IHRoaXMueiAtIHJocy56O1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHggKiB4ICsgeSAqIHkgKyB6ICogeik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGl2aWRlcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSB2ZWN0b3IgdG8gZGl2aWRlIHRoZSBzcGVjaWZpZWQgdmVjdG9yIGJ5LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMyg0LCA5LCAxNik7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMzKDIsIDMsIDQpO1xuICAgICAqXG4gICAgICogYS5kaXYoYik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFsyLCAzLCA0XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZGl2aXNpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBkaXYocmhzKSB7XG4gICAgICAgIHRoaXMueCAvPSByaHMueDtcbiAgICAgICAgdGhpcy55IC89IHJocy55O1xuICAgICAgICB0aGlzLnogLz0gcmhzLno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGl2aWRlcyBvbmUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgYnkgYW5vdGhlciBhbmQgd3JpdGVzIHRoZSByZXN1bHQgdG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGxocyAtIFRoZSBkaXZpZGVuZCB2ZWN0b3IgKHRoZSB2ZWN0b3IgYmVpbmcgZGl2aWRlZCkuXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgZGl2aXNvciB2ZWN0b3IgKHRoZSB2ZWN0b3IgZGl2aWRpbmcgdGhlIGRpdmlkZW5kKS5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzMoNCwgOSwgMTYpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMygyLCAzLCA0KTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKlxuICAgICAqIHIuZGl2MihhLCBiKTtcbiAgICAgKiAvLyBPdXRwdXRzIFsyLCAzLCA0XVxuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBkaXZpc2lvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGRpdjIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggLyByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgLyByaHMueTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogLyByaHMuejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXZpZGVzIGVhY2ggZWxlbWVudCBvZiBhIHZlY3RvciBieSBhIG51bWJlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzY2FsYXIgLSBUaGUgbnVtYmVyIHRvIGRpdmlkZSBieS5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjMygzLCA2LCA5KTtcbiAgICAgKlxuICAgICAqIHZlYy5kaXZTY2FsYXIoMyk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFsxLCAyLCAzXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZGl2aXNpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGRpdlNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54IC89IHNjYWxhcjtcbiAgICAgICAgdGhpcy55IC89IHNjYWxhcjtcbiAgICAgICAgdGhpcy56IC89IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgYSBkb3QgcHJvZHVjdCBvcGVyYXRpb24gcGVyZm9ybWVkIG9uIHRoZSB0d28gc3BlY2lmaWVkIDMtZGltZW5zaW9uYWxcbiAgICAgKiB2ZWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgc2Vjb25kIDMtZGltZW5zaW9uYWwgdmVjdG9yIG9wZXJhbmQgb2YgdGhlIGRvdCBwcm9kdWN0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSByZXN1bHQgb2YgdGhlIGRvdCBwcm9kdWN0IG9wZXJhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYxID0gbmV3IHBjLlZlYzMoNSwgMTAsIDIwKTtcbiAgICAgKiBjb25zdCB2MiA9IG5ldyBwYy5WZWMzKDEwLCAyMCwgNDApO1xuICAgICAqIGNvbnN0IHYxZG90djIgPSB2MS5kb3QodjIpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgZG90IHByb2R1Y3QgaXM6IFwiICsgdjFkb3R2Mik7XG4gICAgICovXG4gICAgZG90KHJocykge1xuICAgICAgICByZXR1cm4gdGhpcy54ICogcmhzLnggKyB0aGlzLnkgKiByaHMueSArIHRoaXMueiAqIHJocy56O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0d28gdmVjdG9ycyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSB2ZWN0b3IgdG8gY29tcGFyZSB0byB0aGUgc3BlY2lmaWVkIHZlY3Rvci5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmVjdG9ycyBhcmUgZXF1YWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlZlYzMoNCwgNSwgNik7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHZlY3RvcnMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCA9PT0gcmhzLnggJiYgdGhpcy55ID09PSByaHMueSAmJiB0aGlzLnogPT09IHJocy56O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIDMtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIDMtZGltZW5zaW9uYWwgdmVjdG9yLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzMoMywgNCwgMCk7XG4gICAgICogY29uc3QgbGVuID0gdmVjLmxlbmd0aCgpO1xuICAgICAqIC8vIE91dHB1dHMgNVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGxlbmd0aCBvZiB0aGUgdmVjdG9yIGlzOiBcIiArIGxlbik7XG4gICAgICovXG4gICAgbGVuZ3RoKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSArIHRoaXMueiAqIHRoaXMueik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIHNxdWFyZWQgb2YgdGhlIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCAzLWRpbWVuc2lvbmFsIHZlY3Rvci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHZlYyA9IG5ldyBwYy5WZWMzKDMsIDQsIDApO1xuICAgICAqIGNvbnN0IGxlbiA9IHZlYy5sZW5ndGhTcSgpO1xuICAgICAqIC8vIE91dHB1dHMgMjVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggc3F1YXJlZCBvZiB0aGUgdmVjdG9yIGlzOiBcIiArIGxlbik7XG4gICAgICovXG4gICAgbGVuZ3RoU3EoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkgKyB0aGlzLnogKiB0aGlzLno7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIGEgbGluZWFyIGludGVycG9sYXRpb24gYmV0d2VlbiB0d28gc3BlY2lmaWVkIDMtZGltZW5zaW9uYWwgdmVjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gbGhzIC0gVGhlIDMtZGltZW5zaW9uYWwgdG8gaW50ZXJwb2xhdGUgZnJvbS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSAzLWRpbWVuc2lvbmFsIHRvIGludGVycG9sYXRlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbHBoYSAtIFRoZSB2YWx1ZSBjb250cm9sbGluZyB0aGUgcG9pbnQgb2YgaW50ZXJwb2xhdGlvbi4gQmV0d2VlbiAwIGFuZCAxLFxuICAgICAqIHRoZSBsaW5lYXIgaW50ZXJwb2xhbnQgd2lsbCBvY2N1ciBvbiBhIHN0cmFpZ2h0IGxpbmUgYmV0d2VlbiBsaHMgYW5kIHJocy4gT3V0c2lkZSBvZiB0aGlzXG4gICAgICogcmFuZ2UsIHRoZSBsaW5lYXIgaW50ZXJwb2xhbnQgd2lsbCBvY2N1ciBvbiBhIHJheSBleHRyYXBvbGF0ZWQgZnJvbSB0aGlzIGxpbmUuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMygxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKlxuICAgICAqIHIubGVycChhLCBiLCAwKTsgICAvLyByIGlzIGVxdWFsIHRvIGFcbiAgICAgKiByLmxlcnAoYSwgYiwgMC41KTsgLy8gciBpcyA1LCA1LCA1XG4gICAgICogci5sZXJwKGEsIGIsIDEpOyAgIC8vIHIgaXMgZXF1YWwgdG8gYlxuICAgICAqL1xuICAgIGxlcnAobGhzLCByaHMsIGFscGhhKSB7XG4gICAgICAgIHRoaXMueCA9IGxocy54ICsgYWxwaGEgKiAocmhzLnggLSBsaHMueCk7XG4gICAgICAgIHRoaXMueSA9IGxocy55ICsgYWxwaGEgKiAocmhzLnkgLSBsaHMueSk7XG4gICAgICAgIHRoaXMueiA9IGxocy56ICsgYWxwaGEgKiAocmhzLnogLSBsaHMueik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGFub3RoZXIgaW4gcGxhY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMzKDIsIDMsIDQpO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMyg0LCA1LCA2KTtcbiAgICAgKlxuICAgICAqIGEubXVsKGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA4LCAxNSwgMjRcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsKHJocykge1xuICAgICAgICB0aGlzLnggKj0gcmhzLng7XG4gICAgICAgIHRoaXMueSAqPSByaHMueTtcbiAgICAgICAgdGhpcy56ICo9IHJocy56O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBtdWx0aXBseWluZyB0aGUgc3BlY2lmaWVkIDMtZGltZW5zaW9uYWwgdmVjdG9ycyB0b2dldGhlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gbGhzIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlZlYzMoMiwgMywgNCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5WZWMzKDQsIDUsIDYpO1xuICAgICAqIGNvbnN0IHIgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqXG4gICAgICogci5tdWwyKGEsIGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA4LCAxNSwgMjRcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsMihsaHMsIHJocykge1xuICAgICAgICB0aGlzLnggPSBsaHMueCAqIHJocy54O1xuICAgICAgICB0aGlzLnkgPSBsaHMueSAqIHJocy55O1xuICAgICAgICB0aGlzLnogPSBsaHMueiAqIHJocy56O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgZWFjaCBlbGVtZW50IG9mIGEgdmVjdG9yIGJ5IGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNjYWxhciAtIFRoZSBudW1iZXIgdG8gbXVsdGlwbHkgYnkuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdmVjID0gbmV3IHBjLlZlYzMoMywgNiwgOSk7XG4gICAgICpcbiAgICAgKiB2ZWMubXVsU2NhbGFyKDMpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbOSwgMTgsIDI3XVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bFNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy55ICo9IHNjYWxhcjtcbiAgICAgICAgdGhpcy56ICo9IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoaXMgMy1kaW1lbnNpb25hbCB2ZWN0b3IgY29udmVydGVkIHRvIGEgdW5pdCB2ZWN0b3IgaW4gcGxhY2UuIElmIHRoZSB2ZWN0b3IgaGFzIGFcbiAgICAgKiBsZW5ndGggb2YgemVybywgdGhlIHZlY3RvcidzIGVsZW1lbnRzIHdpbGwgYmUgc2V0IHRvIHplcm8uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzMoMjUsIDAsIDApO1xuICAgICAqXG4gICAgICogdi5ub3JtYWxpemUoKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIG5vcm1hbGl6YXRpb24gaXM6IFwiICsgdi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBub3JtYWxpemUoKSB7XG4gICAgICAgIGNvbnN0IGxlbmd0aFNxID0gdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56O1xuICAgICAgICBpZiAobGVuZ3RoU3EgPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnZMZW5ndGggPSAxIC8gTWF0aC5zcXJ0KGxlbmd0aFNxKTtcbiAgICAgICAgICAgIHRoaXMueCAqPSBpbnZMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnkgKj0gaW52TGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy56ICo9IGludkxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyBzZXQgdG8gdGhlIGxhcmdlc3QgaW50ZWdlciBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gaXRzIHZhbHVlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIGZsb29yKCkge1xuICAgICAgICB0aGlzLnggPSBNYXRoLmZsb29yKHRoaXMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGguZmxvb3IodGhpcy55KTtcbiAgICAgICAgdGhpcy56ID0gTWF0aC5mbG9vcih0aGlzLnopO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgcm91bmRlZCB1cCB0byB0aGUgbmV4dCBsYXJnZXN0IGludGVnZXIuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY2VpbCgpIHtcbiAgICAgICAgdGhpcy54ID0gTWF0aC5jZWlsKHRoaXMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGguY2VpbCh0aGlzLnkpO1xuICAgICAgICB0aGlzLnogPSBNYXRoLmNlaWwodGhpcy56KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRWFjaCBlbGVtZW50IGlzIHJvdW5kZWQgdXAgb3IgZG93biB0byB0aGUgbmVhcmVzdCBpbnRlZ2VyLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIHJvdW5kKCkge1xuICAgICAgICB0aGlzLnggPSBNYXRoLnJvdW5kKHRoaXMueCk7XG4gICAgICAgIHRoaXMueSA9IE1hdGgucm91bmQodGhpcy55KTtcbiAgICAgICAgdGhpcy56ID0gTWF0aC5yb3VuZCh0aGlzLnopO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFYWNoIGVsZW1lbnQgaXMgYXNzaWduZWQgYSB2YWx1ZSBmcm9tIHJocyBwYXJhbWV0ZXIgaWYgaXQgaXMgc21hbGxlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcmhzIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHVzZWQgYXMgdGhlIHNvdXJjZSBvZiBlbGVtZW50cyB0byBjb21wYXJlIHRvLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBtaW4ocmhzKSB7XG4gICAgICAgIGlmIChyaHMueCA8IHRoaXMueCkgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIGlmIChyaHMueSA8IHRoaXMueSkgdGhpcy55ID0gcmhzLnk7XG4gICAgICAgIGlmIChyaHMueiA8IHRoaXMueikgdGhpcy56ID0gcmhzLno7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVhY2ggZWxlbWVudCBpcyBhc3NpZ25lZCBhIHZhbHVlIGZyb20gcmhzIHBhcmFtZXRlciBpZiBpdCBpcyBsYXJnZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB1c2VkIGFzIHRoZSBzb3VyY2Ugb2YgZWxlbWVudHMgdG8gY29tcGFyZSB0by5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgbWF4KHJocykge1xuICAgICAgICBpZiAocmhzLnggPiB0aGlzLngpIHRoaXMueCA9IHJocy54O1xuICAgICAgICBpZiAocmhzLnkgPiB0aGlzLnkpIHRoaXMueSA9IHJocy55O1xuICAgICAgICBpZiAocmhzLnogPiB0aGlzLnopIHRoaXMueiA9IHJocy56O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9qZWN0cyB0aGlzIDMtZGltZW5zaW9uYWwgdmVjdG9yIG9udG8gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHJocyAtIFRoZSB2ZWN0b3Igb250byB3aGljaCB0aGUgb3JpZ2luYWwgdmVjdG9yIHdpbGwgYmUgcHJvamVjdGVkIG9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMyg1LCA1LCA1KTtcbiAgICAgKiBjb25zdCBub3JtYWwgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKlxuICAgICAqIHYucHJvamVjdChub3JtYWwpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyA1LCAwLCAwXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSB2ZWN0b3IgcHJvamVjdGlvbiBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHByb2plY3QocmhzKSB7XG4gICAgICAgIGNvbnN0IGFfZG90X2IgPSB0aGlzLnggKiByaHMueCArIHRoaXMueSAqIHJocy55ICsgdGhpcy56ICogcmhzLno7XG4gICAgICAgIGNvbnN0IGJfZG90X2IgPSByaHMueCAqIHJocy54ICsgcmhzLnkgKiByaHMueSArIHJocy56ICogcmhzLno7XG4gICAgICAgIGNvbnN0IHMgPSBhX2RvdF9iIC8gYl9kb3RfYjtcbiAgICAgICAgdGhpcy54ID0gcmhzLnggKiBzO1xuICAgICAgICB0aGlzLnkgPSByaHMueSAqIHM7XG4gICAgICAgIHRoaXMueiA9IHJocy56ICogcztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHRoZSBzdXBwbGllZCBudW1lcmljYWwgdmFsdWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgdmFsdWUgdG8gc2V0IG9uIHRoZSBmaXJzdCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB2YWx1ZSB0byBzZXQgb24gdGhlIHNlY29uZCBjb21wb25lbnQgb2YgdGhlIHZlY3Rvci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB2YWx1ZSB0byBzZXQgb24gdGhlIHRoaXJkIGNvbXBvbmVudCBvZiB0aGUgdmVjdG9yLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIHYuc2V0KDUsIDEwLCAyMCk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIDUsIDEwLCAyMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5LCB6KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMueiA9IHo7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VidHJhY3RzIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgZnJvbSBhbm90aGVyIGluIHBsYWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgdmVjdG9yIHRvIHN1YnRyYWN0IGZyb20gdGhlIHNwZWNpZmllZCB2ZWN0b3IuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMygyMCwgMjAsIDIwKTtcbiAgICAgKlxuICAgICAqIGEuc3ViKGIpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyBbLTEwLCAtMTAsIC0xMF1cbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHN1YnRyYWN0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgc3ViKHJocykge1xuICAgICAgICB0aGlzLnggLT0gcmhzLng7XG4gICAgICAgIHRoaXMueSAtPSByaHMueTtcbiAgICAgICAgdGhpcy56IC09IHJocy56O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1YnRyYWN0cyB0d28gMy1kaW1lbnNpb25hbCB2ZWN0b3JzIGZyb20gb25lIGFub3RoZXIgYW5kIHJldHVybnMgdGhlIHJlc3VsdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gbGhzIC0gVGhlIGZpcnN0IHZlY3RvciBvcGVyYW5kIGZvciB0aGUgc3VidHJhY3Rpb24uXG4gICAgICogQHBhcmFtIHtWZWMzfSByaHMgLSBUaGUgc2Vjb25kIHZlY3RvciBvcGVyYW5kIGZvciB0aGUgc3VidHJhY3Rpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYSA9IG5ldyBwYy5WZWMzKDEwLCAxMCwgMTApO1xuICAgICAqIGNvbnN0IGIgPSBuZXcgcGMuVmVjMygyMCwgMjAsIDIwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKlxuICAgICAqIHIuc3ViMihhLCBiKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgWy0xMCwgLTEwLCAtMTBdXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBzdWJ0cmFjdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHN1YjIobGhzLCByaHMpIHtcbiAgICAgICAgdGhpcy54ID0gbGhzLnggLSByaHMueDtcbiAgICAgICAgdGhpcy55ID0gbGhzLnkgLSByaHMueTtcbiAgICAgICAgdGhpcy56ID0gbGhzLnogLSByaHMuejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdWJ0cmFjdHMgYSBudW1iZXIgZnJvbSBlYWNoIGVsZW1lbnQgb2YgYSB2ZWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGFyIC0gVGhlIG51bWJlciB0byBzdWJ0cmFjdC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB2ZWMgPSBuZXcgcGMuVmVjMygzLCA0LCA1KTtcbiAgICAgKlxuICAgICAqIHZlYy5zdWJTY2FsYXIoMik7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIFsxLCAyLCAzXVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgc3VidHJhY3Rpb24gaXM6IFwiICsgdmVjLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHN1YlNjYWxhcihzY2FsYXIpIHtcbiAgICAgICAgdGhpcy54IC09IHNjYWxhcjtcbiAgICAgICAgdGhpcy55IC09IHNjYWxhcjtcbiAgICAgICAgdGhpcy56IC09IHNjYWxhcjtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgdmVjdG9yIHRvIHN0cmluZyBmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHZlY3RvciBpbiBzdHJpbmcgZm9ybS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMygyMCwgMTAsIDUpO1xuICAgICAqIC8vIE91dHB1dHMgWzIwLCAxMCwgNV1cbiAgICAgKiBjb25zb2xlLmxvZyh2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gYFske3RoaXMueH0sICR7dGhpcy55fSwgJHt0aGlzLnp9XWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFswLCAwLCAwXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBaRVJPID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMygwLCAwLCAwKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzEsIDEsIDFdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIE9ORSA9IE9iamVjdC5mcmVlemUobmV3IFZlYzMoMSwgMSwgMSkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFswLCAxLCAwXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBVUCA9IE9iamVjdC5mcmVlemUobmV3IFZlYzMoMCwgMSwgMCkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFswLCAtMSwgMF0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgRE9XTiA9IE9iamVjdC5mcmVlemUobmV3IFZlYzMoMCwgLTEsIDApKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbMSwgMCwgMF0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgUklHSFQgPSBPYmplY3QuZnJlZXplKG5ldyBWZWMzKDEsIDAsIDApKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgdmVjdG9yIHNldCB0byBbLTEsIDAsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIExFRlQgPSBPYmplY3QuZnJlZXplKG5ldyBWZWMzKC0xLCAwLCAwKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHZlY3RvciBzZXQgdG8gWzAsIDAsIC0xXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBGT1JXQVJEID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMygwLCAwLCAtMSkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCB2ZWN0b3Igc2V0IHRvIFswLCAwLCAxXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBCQUNLID0gT2JqZWN0LmZyZWV6ZShuZXcgVmVjMygwLCAwLCAxKSk7XG59XG5cbmV4cG9ydCB7IFZlYzMgfTtcbiJdLCJuYW1lcyI6WyJWZWMzIiwiY29uc3RydWN0b3IiLCJ4IiwieSIsInoiLCJsZW5ndGgiLCJhZGQiLCJyaHMiLCJhZGQyIiwibGhzIiwiYWRkU2NhbGFyIiwic2NhbGFyIiwiY2xvbmUiLCJjc3RyIiwiY29weSIsImNyb3NzIiwibHgiLCJseSIsImx6IiwicngiLCJyeSIsInJ6IiwiZGlzdGFuY2UiLCJNYXRoIiwic3FydCIsImRpdiIsImRpdjIiLCJkaXZTY2FsYXIiLCJkb3QiLCJlcXVhbHMiLCJsZW5ndGhTcSIsImxlcnAiLCJhbHBoYSIsIm11bCIsIm11bDIiLCJtdWxTY2FsYXIiLCJub3JtYWxpemUiLCJpbnZMZW5ndGgiLCJmbG9vciIsImNlaWwiLCJyb3VuZCIsIm1pbiIsIm1heCIsInByb2plY3QiLCJhX2RvdF9iIiwiYl9kb3RfYiIsInMiLCJzZXQiLCJzdWIiLCJzdWIyIiwic3ViU2NhbGFyIiwidG9TdHJpbmciLCJaRVJPIiwiT2JqZWN0IiwiZnJlZXplIiwiT05FIiwiVVAiLCJET1dOIiwiUklHSFQiLCJMRUZUIiwiRk9SV0FSRCIsIkJBQ0siXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLElBQUksQ0FBQztBQUNQO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FB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
