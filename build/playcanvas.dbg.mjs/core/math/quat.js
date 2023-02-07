/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { math } from './math.js';
import { Vec3 } from './vec3.js';

/**
 * A quaternion.
 */
class Quat {
  /**
   * The x component of the quaternion.
   *
   * @type {number}
   */

  /**
   * The y component of the quaternion.
   *
   * @type {number}
   */

  /**
   * The z component of the quaternion.
   *
   * @type {number}
   */

  /**
   * The w component of the quaternion.
   *
   * @type {number}
   */

  /**
   * Create a new Quat instance.
   *
   * @param {number|number[]} [x] - The quaternion's x component. Defaults to 0. If x is an array
   * of length 4, the array will be used to populate all components.
   * @param {number} [y] - The quaternion's y component. Defaults to 0.
   * @param {number} [z] - The quaternion's z component. Defaults to 0.
   * @param {number} [w] - The quaternion's w component. Defaults to 1.
   */
  constructor(x = 0, y = 0, z = 0, w = 1) {
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
   * Returns an identical copy of the specified quaternion.
   *
   * @returns {this} A quaternion containing the result of the cloning.
   * @example
   * var q = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
   * var qclone = q.clone();
   *
   * console.log("The result of the cloning is: " + q.toString());
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr(this.x, this.y, this.z, this.w);
  }
  conjugate() {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this;
  }

  /**
   * Copies the contents of a source quaternion to a destination quaternion.
   *
   * @param {Quat} rhs - The quaternion to be copied.
   * @returns {Quat} Self for chaining.
   * @example
   * var src = new pc.Quat();
   * var dst = new pc.Quat();
   * dst.copy(src, src);
   * console.log("The two quaternions are " + (src.equals(dst) ? "equal" : "different"));
   */
  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    this.w = rhs.w;
    return this;
  }

  /**
   * Reports whether two quaternions are equal.
   *
   * @param {Quat} rhs - The quaternion to be compared against.
   * @returns {boolean} True if the quaternions are equal and false otherwise.
   * @example
   * var a = new pc.Quat();
   * var b = new pc.Quat();
   * console.log("The two quaternions are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
  }

  /**
   * Gets the rotation axis and angle for a given quaternion. If a quaternion is created with
   * `setFromAxisAngle`, this method will return the same values as provided in the original
   * parameter list OR functionally equivalent values.
   *
   * @param {Vec3} axis - The 3-dimensional vector to receive the axis of rotation.
   * @returns {number} Angle, in degrees, of the rotation.
   * @example
   * var q = new pc.Quat();
   * q.setFromAxisAngle(new pc.Vec3(0, 1, 0), 90);
   * var v = new pc.Vec3();
   * var angle = q.getAxisAngle(v);
   * // Outputs 90
   * console.log(angle);
   * // Outputs [0, 1, 0]
   * console.log(v.toString());
   */
  getAxisAngle(axis) {
    let rad = Math.acos(this.w) * 2;
    const s = Math.sin(rad / 2);
    if (s !== 0) {
      axis.x = this.x / s;
      axis.y = this.y / s;
      axis.z = this.z / s;
      if (axis.x < 0 || axis.y < 0 || axis.z < 0) {
        // Flip the sign
        axis.x *= -1;
        axis.y *= -1;
        axis.z *= -1;
        rad *= -1;
      }
    } else {
      // If s is zero, return any axis (no rotation - axis does not matter)
      axis.x = 1;
      axis.y = 0;
      axis.z = 0;
    }
    return rad * math.RAD_TO_DEG;
  }

  /**
   * Converts the supplied quaternion to Euler angles.
   *
   * @param {Vec3} [eulers] - The 3-dimensional vector to receive the Euler angles.
   * @returns {Vec3} The 3-dimensional vector holding the Euler angles that
   * correspond to the supplied quaternion.
   */
  getEulerAngles(eulers = new Vec3()) {
    let x, y, z;
    const qx = this.x;
    const qy = this.y;
    const qz = this.z;
    const qw = this.w;
    const a2 = 2 * (qw * qy - qx * qz);
    if (a2 <= -0.99999) {
      x = 2 * Math.atan2(qx, qw);
      y = -Math.PI / 2;
      z = 0;
    } else if (a2 >= 0.99999) {
      x = 2 * Math.atan2(qx, qw);
      y = Math.PI / 2;
      z = 0;
    } else {
      x = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
      y = Math.asin(a2);
      z = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
    }
    return eulers.set(x, y, z).mulScalar(math.RAD_TO_DEG);
  }

  /**
   * Generates the inverse of the specified quaternion.
   *
   * @returns {Quat} Self for chaining.
   * @example
   * // Create a quaternion rotated 180 degrees around the y-axis
   * var rot = new pc.Quat().setFromEulerAngles(0, 180, 0);
   *
   * // Invert in place
   * rot.invert();
   */
  invert() {
    return this.conjugate().normalize();
  }

  /**
   * Returns the magnitude of the specified quaternion.
   *
   * @returns {number} The magnitude of the specified quaternion.
   * @example
   * var q = new pc.Quat(0, 0, 0, 5);
   * var len = q.length();
   * // Outputs 5
   * console.log("The length of the quaternion is: " + len);
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  /**
   * Returns the magnitude squared of the specified quaternion.
   *
   * @returns {number} The magnitude of the specified quaternion.
   * @example
   * var q = new pc.Quat(3, 4, 0);
   * var lenSq = q.lengthSq();
   * // Outputs 25
   * console.log("The length squared of the quaternion is: " + lenSq);
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  /**
   * Returns the result of multiplying the specified quaternions together.
   *
   * @param {Quat} rhs - The quaternion used as the second multiplicand of the operation.
   * @returns {Quat} Self for chaining.
   * @example
   * var a = new pc.Quat().setFromEulerAngles(0, 30, 0);
   * var b = new pc.Quat().setFromEulerAngles(0, 60, 0);
   *
   * // a becomes a 90 degree rotation around the Y axis
   * // In other words, a = a * b
   * a.mul(b);
   *
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    const q1x = this.x;
    const q1y = this.y;
    const q1z = this.z;
    const q1w = this.w;
    const q2x = rhs.x;
    const q2y = rhs.y;
    const q2z = rhs.z;
    const q2w = rhs.w;
    this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
    this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
    this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
    this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;
    return this;
  }

  /**
   * Returns the result of multiplying the specified quaternions together.
   *
   * @param {Quat} lhs - The quaternion used as the first multiplicand of the operation.
   * @param {Quat} rhs - The quaternion used as the second multiplicand of the operation.
   * @returns {Quat} Self for chaining.
   * @example
   * var a = new pc.Quat().setFromEulerAngles(0, 30, 0);
   * var b = new pc.Quat().setFromEulerAngles(0, 60, 0);
   * var r = new pc.Quat();
   *
   * // r is set to a 90 degree rotation around the Y axis
   * // In other words, r = a * b
   * r.mul2(a, b);
   *
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    const q1x = lhs.x;
    const q1y = lhs.y;
    const q1z = lhs.z;
    const q1w = lhs.w;
    const q2x = rhs.x;
    const q2y = rhs.y;
    const q2z = rhs.z;
    const q2w = rhs.w;
    this.x = q1w * q2x + q1x * q2w + q1y * q2z - q1z * q2y;
    this.y = q1w * q2y + q1y * q2w + q1z * q2x - q1x * q2z;
    this.z = q1w * q2z + q1z * q2w + q1x * q2y - q1y * q2x;
    this.w = q1w * q2w - q1x * q2x - q1y * q2y - q1z * q2z;
    return this;
  }

  /**
   * Returns the specified quaternion converted in place to a unit quaternion.
   *
   * @returns {Quat} The result of the normalization.
   * @example
   * var v = new pc.Quat(0, 0, 0, 5);
   *
   * v.normalize();
   *
   * // Outputs 0, 0, 0, 1
   * console.log("The result of the vector normalization is: " + v.toString());
   */
  normalize() {
    let len = this.length();
    if (len === 0) {
      this.x = this.y = this.z = 0;
      this.w = 1;
    } else {
      len = 1 / len;
      this.x *= len;
      this.y *= len;
      this.z *= len;
      this.w *= len;
    }
    return this;
  }

  /**
   * Sets the specified quaternion to the supplied numerical values.
   *
   * @param {number} x - The x component of the quaternion.
   * @param {number} y - The y component of the quaternion.
   * @param {number} z - The z component of the quaternion.
   * @param {number} w - The w component of the quaternion.
   * @returns {Quat} Self for chaining.
   * @example
   * var q = new pc.Quat();
   * q.set(1, 0, 0, 0);
   *
   * // Outputs 1, 0, 0, 0
   * console.log("The result of the vector set is: " + q.toString());
   */
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  /**
   * Sets a quaternion from an angular rotation around an axis.
   *
   * @param {Vec3} axis - World space axis around which to rotate.
   * @param {number} angle - Angle to rotate around the given axis in degrees.
   * @returns {Quat} Self for chaining.
   * @example
   * var q = new pc.Quat();
   * q.setFromAxisAngle(pc.Vec3.UP, 90);
   */
  setFromAxisAngle(axis, angle) {
    angle *= 0.5 * math.DEG_TO_RAD;
    const sa = Math.sin(angle);
    const ca = Math.cos(angle);
    this.x = sa * axis.x;
    this.y = sa * axis.y;
    this.z = sa * axis.z;
    this.w = ca;
    return this;
  }

  /**
   * Sets a quaternion from Euler angles specified in XYZ order.
   *
   * @param {number|Vec3} ex - Angle to rotate around X axis in degrees. If ex is a Vec3, the
   * three angles will be read from it instead.
   * @param {number} [ey] - Angle to rotate around Y axis in degrees.
   * @param {number} [ez] - Angle to rotate around Z axis in degrees.
   * @returns {Quat} Self for chaining.
   * @example
   * // Create a quaternion from 3 euler angles
   * var q = new pc.Quat();
   * q.setFromEulerAngles(45, 90, 180);
   *
   * // Create the same quaternion from a vector containing the same 3 euler angles
   * var v = new pc.Vec3(45, 90, 180);
   * var r = new pc.Quat();
   * r.setFromEulerAngles(v);
   */
  setFromEulerAngles(ex, ey, ez) {
    if (ex instanceof Vec3) {
      const vec = ex;
      ex = vec.x;
      ey = vec.y;
      ez = vec.z;
    }
    const halfToRad = 0.5 * math.DEG_TO_RAD;
    ex *= halfToRad;
    ey *= halfToRad;
    ez *= halfToRad;
    const sx = Math.sin(ex);
    const cx = Math.cos(ex);
    const sy = Math.sin(ey);
    const cy = Math.cos(ey);
    const sz = Math.sin(ez);
    const cz = Math.cos(ez);
    this.x = sx * cy * cz - cx * sy * sz;
    this.y = cx * sy * cz + sx * cy * sz;
    this.z = cx * cy * sz - sx * sy * cz;
    this.w = cx * cy * cz + sx * sy * sz;
    return this;
  }

  /**
   * Converts the specified 4x4 matrix to a quaternion. Note that since a quaternion is purely a
   * representation for orientation, only the translational part of the matrix is lost.
   *
   * @param {import('./mat4.js').Mat4} m - The 4x4 matrix to convert.
   * @returns {Quat} Self for chaining.
   * @example
   * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
   * var rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
   *
   * // Convert to a quaternion
   * var q = new pc.Quat().setFromMat4(rot);
   */
  setFromMat4(m) {
    let m00, m01, m02, m10, m11, m12, m20, m21, m22, s, rs, lx, ly, lz;
    m = m.data;

    // Cache matrix values for super-speed
    m00 = m[0];
    m01 = m[1];
    m02 = m[2];
    m10 = m[4];
    m11 = m[5];
    m12 = m[6];
    m20 = m[8];
    m21 = m[9];
    m22 = m[10];

    // Remove the scale from the matrix
    lx = m00 * m00 + m01 * m01 + m02 * m02;
    if (lx === 0) return this;
    lx = 1 / Math.sqrt(lx);
    ly = m10 * m10 + m11 * m11 + m12 * m12;
    if (ly === 0) return this;
    ly = 1 / Math.sqrt(ly);
    lz = m20 * m20 + m21 * m21 + m22 * m22;
    if (lz === 0) return this;
    lz = 1 / Math.sqrt(lz);
    m00 *= lx;
    m01 *= lx;
    m02 *= lx;
    m10 *= ly;
    m11 *= ly;
    m12 *= ly;
    m20 *= lz;
    m21 *= lz;
    m22 *= lz;

    // http://www.cs.ucr.edu/~vbz/resources/quatut.pdf

    const tr = m00 + m11 + m22;
    if (tr >= 0) {
      s = Math.sqrt(tr + 1);
      this.w = s * 0.5;
      s = 0.5 / s;
      this.x = (m12 - m21) * s;
      this.y = (m20 - m02) * s;
      this.z = (m01 - m10) * s;
    } else {
      if (m00 > m11) {
        if (m00 > m22) {
          // XDiagDomMatrix
          rs = m00 - (m11 + m22) + 1;
          rs = Math.sqrt(rs);
          this.x = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m12 - m21) * rs;
          this.y = (m01 + m10) * rs;
          this.z = (m02 + m20) * rs;
        } else {
          // ZDiagDomMatrix
          rs = m22 - (m00 + m11) + 1;
          rs = Math.sqrt(rs);
          this.z = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m01 - m10) * rs;
          this.x = (m20 + m02) * rs;
          this.y = (m21 + m12) * rs;
        }
      } else if (m11 > m22) {
        // YDiagDomMatrix
        rs = m11 - (m22 + m00) + 1;
        rs = Math.sqrt(rs);
        this.y = rs * 0.5;
        rs = 0.5 / rs;
        this.w = (m20 - m02) * rs;
        this.z = (m12 + m21) * rs;
        this.x = (m10 + m01) * rs;
      } else {
        // ZDiagDomMatrix
        rs = m22 - (m00 + m11) + 1;
        rs = Math.sqrt(rs);
        this.z = rs * 0.5;
        rs = 0.5 / rs;
        this.w = (m01 - m10) * rs;
        this.x = (m20 + m02) * rs;
        this.y = (m21 + m12) * rs;
      }
    }
    return this;
  }

  /**
   * Performs a spherical interpolation between two quaternions. The result of the interpolation
   * is written to the quaternion calling the function.
   *
   * @param {Quat} lhs - The quaternion to interpolate from.
   * @param {Quat} rhs - The quaternion to interpolate to.
   * @param {number} alpha - The value controlling the interpolation in relation to the two input
   * quaternions. The value is in the range 0 to 1, 0 generating q1, 1 generating q2 and anything
   * in between generating a spherical interpolation between the two.
   * @returns {Quat} Self for chaining.
   * @example
   * var q1 = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
   * var q2 = new pc.Quat(-0.21, -0.21, -0.67, 0.68);
   *
   * var result;
   * result = new pc.Quat().slerp(q1, q2, 0);   // Return q1
   * result = new pc.Quat().slerp(q1, q2, 0.5); // Return the midpoint interpolant
   * result = new pc.Quat().slerp(q1, q2, 1);   // Return q2
   */
  slerp(lhs, rhs, alpha) {
    // Algorithm sourced from:
    // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/
    const lx = lhs.x;
    const ly = lhs.y;
    const lz = lhs.z;
    const lw = lhs.w;
    let rx = rhs.x;
    let ry = rhs.y;
    let rz = rhs.z;
    let rw = rhs.w;

    // Calculate angle between them.
    let cosHalfTheta = lw * rw + lx * rx + ly * ry + lz * rz;
    if (cosHalfTheta < 0) {
      rw = -rw;
      rx = -rx;
      ry = -ry;
      rz = -rz;
      cosHalfTheta = -cosHalfTheta;
    }

    // If lhs == rhs or lhs == -rhs then theta == 0 and we can return lhs
    if (Math.abs(cosHalfTheta) >= 1) {
      this.w = lw;
      this.x = lx;
      this.y = ly;
      this.z = lz;
      return this;
    }

    // Calculate temporary values.
    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);

    // If theta = 180 degrees then result is not fully defined
    // we could rotate around any axis normal to qa or qb
    if (Math.abs(sinHalfTheta) < 0.001) {
      this.w = lw * 0.5 + rw * 0.5;
      this.x = lx * 0.5 + rx * 0.5;
      this.y = ly * 0.5 + ry * 0.5;
      this.z = lz * 0.5 + rz * 0.5;
      return this;
    }
    const ratioA = Math.sin((1 - alpha) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(alpha * halfTheta) / sinHalfTheta;

    // Calculate Quaternion.
    this.w = lw * ratioA + rw * ratioB;
    this.x = lx * ratioA + rx * ratioB;
    this.y = ly * ratioA + ry * ratioB;
    this.z = lz * ratioA + rz * ratioB;
    return this;
  }

  /**
   * Transforms a 3-dimensional vector by the specified quaternion.
   *
   * @param {Vec3} vec - The 3-dimensional vector to be transformed.
   * @param {Vec3} [res] - An optional 3-dimensional vector to receive the result of the transformation.
   * @returns {Vec3} The input vector v transformed by the current instance.
   * @example
   * // Create a 3-dimensional vector
   * var v = new pc.Vec3(1, 2, 3);
   *
   * // Create a 4x4 rotation matrix
   * var q = new pc.Quat().setFromEulerAngles(10, 20, 30);
   *
   * var tv = q.transformVector(v);
   */
  transformVector(vec, res = new Vec3()) {
    const x = vec.x,
      y = vec.y,
      z = vec.z;
    const qx = this.x,
      qy = this.y,
      qz = this.z,
      qw = this.w;

    // calculate quat * vec
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    res.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    res.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    res.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return res;
  }

  /**
   * Converts the quaternion to string form.
   *
   * @returns {string} The quaternion in string form.
   * @example
   * var v = new pc.Quat(0, 0, 0, 1);
   * // Outputs [0, 0, 0, 1]
   * console.log(v.toString());
   */
  toString() {
    return `[${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
  }

  /**
   * A constant quaternion set to [0, 0, 0, 1] (the identity).
   *
   * @type {Quat}
   * @readonly
   */
}
Quat.IDENTITY = Object.freeze(new Quat(0, 0, 0, 1));
Quat.ZERO = Object.freeze(new Quat(0, 0, 0, 0));

export { Quat };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVhdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9xdWF0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4vdmVjMy5qcyc7XG5cbi8qKlxuICogQSBxdWF0ZXJuaW9uLlxuICovXG5jbGFzcyBRdWF0IHtcbiAgICAvKipcbiAgICAgKiBUaGUgeCBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHg7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgeSBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgeiBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHo7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdyBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHc7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUXVhdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bWJlcltdfSBbeF0gLSBUaGUgcXVhdGVybmlvbidzIHggY29tcG9uZW50LiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5XG4gICAgICogb2YgbGVuZ3RoIDQsIHRoZSBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeSBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeiBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgdyBjb21wb25lbnQuIERlZmF1bHRzIHRvIDEuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoeCA9IDAsIHkgPSAwLCB6ID0gMCwgdyA9IDEpIHtcbiAgICAgICAgaWYgKHgubGVuZ3RoID09PSA0KSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4WzBdO1xuICAgICAgICAgICAgdGhpcy55ID0geFsxXTtcbiAgICAgICAgICAgIHRoaXMueiA9IHhbMl07XG4gICAgICAgICAgICB0aGlzLncgPSB4WzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICAgICAgdGhpcy53ID0gdztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gaWRlbnRpY2FsIGNvcHkgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgcXVhdGVybmlvbiBjb250YWluaW5nIHRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KC0wLjExLCAtMC4xNSwgLTAuNDYsIDAuODcpO1xuICAgICAqIHZhciBxY2xvbmUgPSBxLmNsb25lKCk7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcgaXM6IFwiICsgcS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55LCB0aGlzLnosIHRoaXMudyk7XG4gICAgfVxuXG4gICAgY29uanVnYXRlKCkge1xuICAgICAgICB0aGlzLnggKj0gLTE7XG4gICAgICAgIHRoaXMueSAqPSAtMTtcbiAgICAgICAgdGhpcy56ICo9IC0xO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2UgcXVhdGVybmlvbiB0byBhIGRlc3RpbmF0aW9uIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgc3JjID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiB2YXIgZHN0ID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBkc3QuY29weShzcmMsIHNyYyk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHF1YXRlcm5pb25zIGFyZSBcIiArIChzcmMuZXF1YWxzKGRzdCkgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IHJocy55O1xuICAgICAgICB0aGlzLnogPSByaHMuejtcbiAgICAgICAgdGhpcy53ID0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHR3byBxdWF0ZXJuaW9ucyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvbXBhcmVkIGFnYWluc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHF1YXRlcm5pb25zIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gcXVhdGVybmlvbnMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgcmV0dXJuICgodGhpcy54ID09PSByaHMueCkgJiYgKHRoaXMueSA9PT0gcmhzLnkpICYmICh0aGlzLnogPT09IHJocy56KSAmJiAodGhpcy53ID09PSByaHMudykpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHJvdGF0aW9uIGF4aXMgYW5kIGFuZ2xlIGZvciBhIGdpdmVuIHF1YXRlcm5pb24uIElmIGEgcXVhdGVybmlvbiBpcyBjcmVhdGVkIHdpdGhcbiAgICAgKiBgc2V0RnJvbUF4aXNBbmdsZWAsIHRoaXMgbWV0aG9kIHdpbGwgcmV0dXJuIHRoZSBzYW1lIHZhbHVlcyBhcyBwcm92aWRlZCBpbiB0aGUgb3JpZ2luYWxcbiAgICAgKiBwYXJhbWV0ZXIgbGlzdCBPUiBmdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGF4aXMgLSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgYXhpcyBvZiByb3RhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBbmdsZSwgaW4gZGVncmVlcywgb2YgdGhlIHJvdGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHEuc2V0RnJvbUF4aXNBbmdsZShuZXcgcGMuVmVjMygwLCAxLCAwKSwgOTApO1xuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiB2YXIgYW5nbGUgPSBxLmdldEF4aXNBbmdsZSh2KTtcbiAgICAgKiAvLyBPdXRwdXRzIDkwXG4gICAgICogY29uc29sZS5sb2coYW5nbGUpO1xuICAgICAqIC8vIE91dHB1dHMgWzAsIDEsIDBdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBnZXRBeGlzQW5nbGUoYXhpcykge1xuICAgICAgICBsZXQgcmFkID0gTWF0aC5hY29zKHRoaXMudykgKiAyO1xuICAgICAgICBjb25zdCBzID0gTWF0aC5zaW4ocmFkIC8gMik7XG4gICAgICAgIGlmIChzICE9PSAwKSB7XG4gICAgICAgICAgICBheGlzLnggPSB0aGlzLnggLyBzO1xuICAgICAgICAgICAgYXhpcy55ID0gdGhpcy55IC8gcztcbiAgICAgICAgICAgIGF4aXMueiA9IHRoaXMueiAvIHM7XG4gICAgICAgICAgICBpZiAoYXhpcy54IDwgMCB8fCBheGlzLnkgPCAwIHx8IGF4aXMueiA8IDApIHtcbiAgICAgICAgICAgICAgICAvLyBGbGlwIHRoZSBzaWduXG4gICAgICAgICAgICAgICAgYXhpcy54ICo9IC0xO1xuICAgICAgICAgICAgICAgIGF4aXMueSAqPSAtMTtcbiAgICAgICAgICAgICAgICBheGlzLnogKj0gLTE7XG4gICAgICAgICAgICAgICAgcmFkICo9IC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSWYgcyBpcyB6ZXJvLCByZXR1cm4gYW55IGF4aXMgKG5vIHJvdGF0aW9uIC0gYXhpcyBkb2VzIG5vdCBtYXR0ZXIpXG4gICAgICAgICAgICBheGlzLnggPSAxO1xuICAgICAgICAgICAgYXhpcy55ID0gMDtcbiAgICAgICAgICAgIGF4aXMueiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJhZCAqIG1hdGguUkFEX1RPX0RFRztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgc3VwcGxpZWQgcXVhdGVybmlvbiB0byBFdWxlciBhbmdsZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtldWxlcnNdIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIEV1bGVyIGFuZ2xlcy5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgdGhlIEV1bGVyIGFuZ2xlcyB0aGF0XG4gICAgICogY29ycmVzcG9uZCB0byB0aGUgc3VwcGxpZWQgcXVhdGVybmlvbi5cbiAgICAgKi9cbiAgICBnZXRFdWxlckFuZ2xlcyhldWxlcnMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGxldCB4LCB5LCB6O1xuXG4gICAgICAgIGNvbnN0IHF4ID0gdGhpcy54O1xuICAgICAgICBjb25zdCBxeSA9IHRoaXMueTtcbiAgICAgICAgY29uc3QgcXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHF3ID0gdGhpcy53O1xuXG4gICAgICAgIGNvbnN0IGEyID0gMiAqIChxdyAqIHF5IC0gcXggKiBxeik7XG5cbiAgICAgICAgaWYgKGEyIDw9IC0wLjk5OTk5KSB7XG4gICAgICAgICAgICB4ID0gMiAqIE1hdGguYXRhbjIocXgsIHF3KTtcbiAgICAgICAgICAgIHkgPSAtTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgfSBlbHNlIGlmIChhMiA+PSAwLjk5OTk5KSB7XG4gICAgICAgICAgICB4ID0gMiAqIE1hdGguYXRhbjIocXgsIHF3KTtcbiAgICAgICAgICAgIHkgPSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgIHogPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IE1hdGguYXRhbjIoMiAqIChxdyAqIHF4ICsgcXkgKiBxeiksIDEgLSAyICogKHF4ICogcXggKyBxeSAqIHF5KSk7XG4gICAgICAgICAgICB5ID0gTWF0aC5hc2luKGEyKTtcbiAgICAgICAgICAgIHogPSBNYXRoLmF0YW4yKDIgKiAocXcgKiBxeiArIHF4ICogcXkpLCAxIC0gMiAqIChxeSAqIHF5ICsgcXogKiBxeikpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV1bGVycy5zZXQoeCwgeSwgeikubXVsU2NhbGFyKG1hdGguUkFEX1RPX0RFRyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIHRoZSBpbnZlcnNlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gcm90YXRlZCAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciByb3QgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAxODAsIDApO1xuICAgICAqXG4gICAgICogLy8gSW52ZXJ0IGluIHBsYWNlXG4gICAgICogcm90LmludmVydCgpO1xuICAgICAqL1xuICAgIGludmVydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uanVnYXRlKCkubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgwLCAwLCAwLCA1KTtcbiAgICAgKiB2YXIgbGVuID0gcS5sZW5ndGgoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggb2YgdGhlIHF1YXRlcm5pb24gaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgc3F1YXJlZCBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoMywgNCwgMCk7XG4gICAgICogdmFyIGxlblNxID0gcS5sZW5ndGhTcSgpO1xuICAgICAqIC8vIE91dHB1dHMgMjVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggc3F1YXJlZCBvZiB0aGUgcXVhdGVybmlvbiBpczogXCIgKyBsZW5TcSk7XG4gICAgICovXG4gICAgbGVuZ3RoU3EoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkgKyB0aGlzLnogKiB0aGlzLnogKyB0aGlzLncgKiB0aGlzLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDMwLCAwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIGEgYmVjb21lcyBhIDkwIGRlZ3JlZSByb3RhdGlvbiBhcm91bmQgdGhlIFkgYXhpc1xuICAgICAqIC8vIEluIG90aGVyIHdvcmRzLCBhID0gYSAqIGJcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IHRoaXMueDtcbiAgICAgICAgY29uc3QgcTF5ID0gdGhpcy55O1xuICAgICAgICBjb25zdCBxMXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IHRoaXMudztcblxuICAgICAgICBjb25zdCBxMnggPSByaHMueDtcbiAgICAgICAgY29uc3QgcTJ5ID0gcmhzLnk7XG4gICAgICAgIGNvbnN0IHEyeiA9IHJocy56O1xuICAgICAgICBjb25zdCBxMncgPSByaHMudztcblxuICAgICAgICB0aGlzLnggPSBxMXcgKiBxMnggKyBxMXggKiBxMncgKyBxMXkgKiBxMnogLSBxMXogKiBxMnk7XG4gICAgICAgIHRoaXMueSA9IHExdyAqIHEyeSArIHExeSAqIHEydyArIHExeiAqIHEyeCAtIHExeCAqIHEyejtcbiAgICAgICAgdGhpcy56ID0gcTF3ICogcTJ6ICsgcTF6ICogcTJ3ICsgcTF4ICogcTJ5IC0gcTF5ICogcTJ4O1xuICAgICAgICB0aGlzLncgPSBxMXcgKiBxMncgLSBxMXggKiBxMnggLSBxMXkgKiBxMnkgLSBxMXogKiBxMno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IGxocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgMzAsIDApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgNjAsIDApO1xuICAgICAqIHZhciByID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKlxuICAgICAqIC8vIHIgaXMgc2V0IHRvIGEgOTAgZGVncmVlIHJvdGF0aW9uIGFyb3VuZCB0aGUgWSBheGlzXG4gICAgICogLy8gSW4gb3RoZXIgd29yZHMsIHIgPSBhICogYlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IGxocy54O1xuICAgICAgICBjb25zdCBxMXkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgcTF6ID0gbGhzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IGxocy53O1xuXG4gICAgICAgIGNvbnN0IHEyeCA9IHJocy54O1xuICAgICAgICBjb25zdCBxMnkgPSByaHMueTtcbiAgICAgICAgY29uc3QgcTJ6ID0gcmhzLno7XG4gICAgICAgIGNvbnN0IHEydyA9IHJocy53O1xuXG4gICAgICAgIHRoaXMueCA9IHExdyAqIHEyeCArIHExeCAqIHEydyArIHExeSAqIHEyeiAtIHExeiAqIHEyeTtcbiAgICAgICAgdGhpcy55ID0gcTF3ICogcTJ5ICsgcTF5ICogcTJ3ICsgcTF6ICogcTJ4IC0gcTF4ICogcTJ6O1xuICAgICAgICB0aGlzLnogPSBxMXcgKiBxMnogKyBxMXogKiBxMncgKyBxMXggKiBxMnkgLSBxMXkgKiBxMng7XG4gICAgICAgIHRoaXMudyA9IHExdyAqIHEydyAtIHExeCAqIHEyeCAtIHExeSAqIHEyeSAtIHExeiAqIHEyejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiBjb252ZXJ0ZWQgaW4gcGxhY2UgdG8gYSB1bml0IHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHJlc3VsdCBvZiB0aGUgbm9ybWFsaXphdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ID0gbmV3IHBjLlF1YXQoMCwgMCwgMCwgNSk7XG4gICAgICpcbiAgICAgKiB2Lm5vcm1hbGl6ZSgpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyAwLCAwLCAwLCAxXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSB2ZWN0b3Igbm9ybWFsaXphdGlvbiBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG5vcm1hbGl6ZSgpIHtcbiAgICAgICAgbGV0IGxlbiA9IHRoaXMubGVuZ3RoKCk7XG4gICAgICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHRoaXMueSA9IHRoaXMueiA9IDA7XG4gICAgICAgICAgICB0aGlzLncgPSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGVuID0gMSAvIGxlbjtcbiAgICAgICAgICAgIHRoaXMueCAqPSBsZW47XG4gICAgICAgICAgICB0aGlzLnkgKj0gbGVuO1xuICAgICAgICAgICAgdGhpcy56ICo9IGxlbjtcbiAgICAgICAgICAgIHRoaXMudyAqPSBsZW47XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiB0byB0aGUgc3VwcGxpZWQgbnVtZXJpY2FsIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIHogY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHcgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldCgxLCAwLCAwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyBxLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5LCB6LCB3KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgIHRoaXMudyA9IHc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBhbiBhbmd1bGFyIHJvdGF0aW9uIGFyb3VuZCBhbiBheGlzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gV29ybGQgc3BhY2UgYXhpcyBhcm91bmQgd2hpY2ggdG8gcm90YXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbmdsZSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgdGhlIGdpdmVuIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDkwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tQXhpc0FuZ2xlKGF4aXMsIGFuZ2xlKSB7XG4gICAgICAgIGFuZ2xlICo9IDAuNSAqIG1hdGguREVHX1RPX1JBRDtcblxuICAgICAgICBjb25zdCBzYSA9IE1hdGguc2luKGFuZ2xlKTtcbiAgICAgICAgY29uc3QgY2EgPSBNYXRoLmNvcyhhbmdsZSk7XG5cbiAgICAgICAgdGhpcy54ID0gc2EgKiBheGlzLng7XG4gICAgICAgIHRoaXMueSA9IHNhICogYXhpcy55O1xuICAgICAgICB0aGlzLnogPSBzYSAqIGF4aXMuejtcbiAgICAgICAgdGhpcy53ID0gY2E7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBFdWxlciBhbmdsZXMgc3BlY2lmaWVkIGluIFhZWiBvcmRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfFZlYzN9IGV4IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBYIGF4aXMgaW4gZGVncmVlcy4gSWYgZXggaXMgYSBWZWMzLCB0aGVcbiAgICAgKiB0aHJlZSBhbmdsZXMgd2lsbCBiZSByZWFkIGZyb20gaXQgaW5zdGVhZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2V5XSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWSBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtlel0gLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFogYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gZnJvbSAzIGV1bGVyIGFuZ2xlc1xuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldEZyb21FdWxlckFuZ2xlcyg0NSwgOTAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgdGhlIHNhbWUgcXVhdGVybmlvbiBmcm9tIGEgdmVjdG9yIGNvbnRhaW5pbmcgdGhlIHNhbWUgMyBldWxlciBhbmdsZXNcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMzKDQ1LCA5MCwgMTgwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogci5zZXRGcm9tRXVsZXJBbmdsZXModik7XG4gICAgICovXG4gICAgc2V0RnJvbUV1bGVyQW5nbGVzKGV4LCBleSwgZXopIHtcbiAgICAgICAgaWYgKGV4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgY29uc3QgdmVjID0gZXg7XG4gICAgICAgICAgICBleCA9IHZlYy54O1xuICAgICAgICAgICAgZXkgPSB2ZWMueTtcbiAgICAgICAgICAgIGV6ID0gdmVjLno7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYWxmVG9SYWQgPSAwLjUgKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGV4ICo9IGhhbGZUb1JhZDtcbiAgICAgICAgZXkgKj0gaGFsZlRvUmFkO1xuICAgICAgICBleiAqPSBoYWxmVG9SYWQ7XG5cbiAgICAgICAgY29uc3Qgc3ggPSBNYXRoLnNpbihleCk7XG4gICAgICAgIGNvbnN0IGN4ID0gTWF0aC5jb3MoZXgpO1xuICAgICAgICBjb25zdCBzeSA9IE1hdGguc2luKGV5KTtcbiAgICAgICAgY29uc3QgY3kgPSBNYXRoLmNvcyhleSk7XG4gICAgICAgIGNvbnN0IHN6ID0gTWF0aC5zaW4oZXopO1xuICAgICAgICBjb25zdCBjeiA9IE1hdGguY29zKGV6KTtcblxuICAgICAgICB0aGlzLnggPSBzeCAqIGN5ICogY3ogLSBjeCAqIHN5ICogc3o7XG4gICAgICAgIHRoaXMueSA9IGN4ICogc3kgKiBjeiArIHN4ICogY3kgKiBzejtcbiAgICAgICAgdGhpcy56ID0gY3ggKiBjeSAqIHN6IC0gc3ggKiBzeSAqIGN6O1xuICAgICAgICB0aGlzLncgPSBjeCAqIGN5ICogY3ogKyBzeCAqIHN5ICogc3o7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4IHRvIGEgcXVhdGVybmlvbi4gTm90ZSB0aGF0IHNpbmNlIGEgcXVhdGVybmlvbiBpcyBwdXJlbHkgYVxuICAgICAqIHJlcHJlc2VudGF0aW9uIGZvciBvcmllbnRhdGlvbiwgb25seSB0aGUgdHJhbnNsYXRpb25hbCBwYXJ0IG9mIHRoZSBtYXRyaXggaXMgbG9zdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21hdDQuanMnKS5NYXQ0fSBtIC0gVGhlIDR4NCBtYXRyaXggdG8gY29udmVydC5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4IG9mIDE4MCBkZWdyZWVzIGFyb3VuZCB0aGUgeS1heGlzXG4gICAgICogdmFyIHJvdCA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUF4aXNBbmdsZShwYy5WZWMzLlVQLCAxODApO1xuICAgICAqXG4gICAgICogLy8gQ29udmVydCB0byBhIHF1YXRlcm5pb25cbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbU1hdDQocm90KTtcbiAgICAgKi9cbiAgICBzZXRGcm9tTWF0NChtKSB7XG4gICAgICAgIGxldCBtMDAsIG0wMSwgbTAyLCBtMTAsIG0xMSwgbTEyLCBtMjAsIG0yMSwgbTIyLFxuICAgICAgICAgICAgcywgcnMsIGx4LCBseSwgbHo7XG5cbiAgICAgICAgbSA9IG0uZGF0YTtcblxuICAgICAgICAvLyBDYWNoZSBtYXRyaXggdmFsdWVzIGZvciBzdXBlci1zcGVlZFxuICAgICAgICBtMDAgPSBtWzBdO1xuICAgICAgICBtMDEgPSBtWzFdO1xuICAgICAgICBtMDIgPSBtWzJdO1xuICAgICAgICBtMTAgPSBtWzRdO1xuICAgICAgICBtMTEgPSBtWzVdO1xuICAgICAgICBtMTIgPSBtWzZdO1xuICAgICAgICBtMjAgPSBtWzhdO1xuICAgICAgICBtMjEgPSBtWzldO1xuICAgICAgICBtMjIgPSBtWzEwXTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHNjYWxlIGZyb20gdGhlIG1hdHJpeFxuICAgICAgICBseCA9IG0wMCAqIG0wMCArIG0wMSAqIG0wMSArIG0wMiAqIG0wMjtcbiAgICAgICAgaWYgKGx4ID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGx4ID0gMSAvIE1hdGguc3FydChseCk7XG4gICAgICAgIGx5ID0gbTEwICogbTEwICsgbTExICogbTExICsgbTEyICogbTEyO1xuICAgICAgICBpZiAobHkgPT09IDApXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgbHkgPSAxIC8gTWF0aC5zcXJ0KGx5KTtcbiAgICAgICAgbHogPSBtMjAgKiBtMjAgKyBtMjEgKiBtMjEgKyBtMjIgKiBtMjI7XG4gICAgICAgIGlmIChseiA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICBseiA9IDEgLyBNYXRoLnNxcnQobHopO1xuXG4gICAgICAgIG0wMCAqPSBseDtcbiAgICAgICAgbTAxICo9IGx4O1xuICAgICAgICBtMDIgKj0gbHg7XG4gICAgICAgIG0xMCAqPSBseTtcbiAgICAgICAgbTExICo9IGx5O1xuICAgICAgICBtMTIgKj0gbHk7XG4gICAgICAgIG0yMCAqPSBsejtcbiAgICAgICAgbTIxICo9IGx6O1xuICAgICAgICBtMjIgKj0gbHo7XG5cbiAgICAgICAgLy8gaHR0cDovL3d3dy5jcy51Y3IuZWR1L352YnovcmVzb3VyY2VzL3F1YXR1dC5wZGZcblxuICAgICAgICBjb25zdCB0ciA9IG0wMCArIG0xMSArIG0yMjtcbiAgICAgICAgaWYgKHRyID49IDApIHtcbiAgICAgICAgICAgIHMgPSBNYXRoLnNxcnQodHIgKyAxKTtcbiAgICAgICAgICAgIHRoaXMudyA9IHMgKiAwLjU7XG4gICAgICAgICAgICBzID0gMC41IC8gcztcbiAgICAgICAgICAgIHRoaXMueCA9IChtMTIgLSBtMjEpICogcztcbiAgICAgICAgICAgIHRoaXMueSA9IChtMjAgLSBtMDIpICogcztcbiAgICAgICAgICAgIHRoaXMueiA9IChtMDEgLSBtMTApICogcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtMDAgPiBtMTEpIHtcbiAgICAgICAgICAgICAgICBpZiAobTAwID4gbTIyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFhEaWFnRG9tTWF0cml4XG4gICAgICAgICAgICAgICAgICAgIHJzID0gKG0wMCAtIChtMTEgKyBtMjIpKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnggPSBycyAqIDAuNTtcbiAgICAgICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53ID0gKG0xMiAtIG0yMSkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy55ID0gKG0wMSArIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy56ID0gKG0wMiArIG0yMCkgKiBycztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBaRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgICAgICBycyA9IChtMjIgLSAobTAwICsgbTExKSkgKyAxO1xuICAgICAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy56ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMDEgLSBtMTApICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueCA9IChtMjAgKyBtMDIpICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMjEgKyBtMTIpICogcnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChtMTEgPiBtMjIpIHtcbiAgICAgICAgICAgICAgICAvLyBZRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgIHJzID0gKG0xMSAtIChtMjIgKyBtMDApKSArIDE7XG4gICAgICAgICAgICAgICAgcnMgPSBNYXRoLnNxcnQocnMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy55ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICB0aGlzLncgPSAobTIwIC0gbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueiA9IChtMTIgKyBtMjEpICogcnM7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gKG0xMCArIG0wMSkgKiBycztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gWkRpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICBycyA9IChtMjIgLSAobTAwICsgbTExKSkgKyAxO1xuICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMueiA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gKG0wMSAtIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnggPSAobTIwICsgbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMjEgKyBtMTIpICogcnM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQZXJmb3JtcyBhIHNwaGVyaWNhbCBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdHdvIHF1YXRlcm5pb25zLiBUaGUgcmVzdWx0IG9mIHRoZSBpbnRlcnBvbGF0aW9uXG4gICAgICogaXMgd3JpdHRlbiB0byB0aGUgcXVhdGVybmlvbiBjYWxsaW5nIHRoZSBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gbGhzIC0gVGhlIHF1YXRlcm5pb24gdG8gaW50ZXJwb2xhdGUgZnJvbS5cbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGludGVycG9sYXRlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbHBoYSAtIFRoZSB2YWx1ZSBjb250cm9sbGluZyB0aGUgaW50ZXJwb2xhdGlvbiBpbiByZWxhdGlvbiB0byB0aGUgdHdvIGlucHV0XG4gICAgICogcXVhdGVybmlvbnMuIFRoZSB2YWx1ZSBpcyBpbiB0aGUgcmFuZ2UgMCB0byAxLCAwIGdlbmVyYXRpbmcgcTEsIDEgZ2VuZXJhdGluZyBxMiBhbmQgYW55dGhpbmdcbiAgICAgKiBpbiBiZXR3ZWVuIGdlbmVyYXRpbmcgYSBzcGhlcmljYWwgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHRoZSB0d28uXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHExID0gbmV3IHBjLlF1YXQoLTAuMTEsIC0wLjE1LCAtMC40NiwgMC44Nyk7XG4gICAgICogdmFyIHEyID0gbmV3IHBjLlF1YXQoLTAuMjEsIC0wLjIxLCAtMC42NywgMC42OCk7XG4gICAgICpcbiAgICAgKiB2YXIgcmVzdWx0O1xuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAwKTsgICAvLyBSZXR1cm4gcTFcbiAgICAgKiByZXN1bHQgPSBuZXcgcGMuUXVhdCgpLnNsZXJwKHExLCBxMiwgMC41KTsgLy8gUmV0dXJuIHRoZSBtaWRwb2ludCBpbnRlcnBvbGFudFxuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAxKTsgICAvLyBSZXR1cm4gcTJcbiAgICAgKi9cbiAgICBzbGVycChsaHMsIHJocywgYWxwaGEpIHtcbiAgICAgICAgLy8gQWxnb3JpdGhtIHNvdXJjZWQgZnJvbTpcbiAgICAgICAgLy8gaHR0cDovL3d3dy5ldWNsaWRlYW5zcGFjZS5jb20vbWF0aHMvYWxnZWJyYS9yZWFsTm9ybWVkQWxnZWJyYS9xdWF0ZXJuaW9ucy9zbGVycC9cbiAgICAgICAgY29uc3QgbHggPSBsaHMueDtcbiAgICAgICAgY29uc3QgbHkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgbHogPSBsaHMuejtcbiAgICAgICAgY29uc3QgbHcgPSBsaHMudztcbiAgICAgICAgbGV0IHJ4ID0gcmhzLng7XG4gICAgICAgIGxldCByeSA9IHJocy55O1xuICAgICAgICBsZXQgcnogPSByaHMuejtcbiAgICAgICAgbGV0IHJ3ID0gcmhzLnc7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGFuZ2xlIGJldHdlZW4gdGhlbS5cbiAgICAgICAgbGV0IGNvc0hhbGZUaGV0YSA9IGx3ICogcncgKyBseCAqIHJ4ICsgbHkgKiByeSArIGx6ICogcno7XG5cbiAgICAgICAgaWYgKGNvc0hhbGZUaGV0YSA8IDApIHtcbiAgICAgICAgICAgIHJ3ID0gLXJ3O1xuICAgICAgICAgICAgcnggPSAtcng7XG4gICAgICAgICAgICByeSA9IC1yeTtcbiAgICAgICAgICAgIHJ6ID0gLXJ6O1xuICAgICAgICAgICAgY29zSGFsZlRoZXRhID0gLWNvc0hhbGZUaGV0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGxocyA9PSByaHMgb3IgbGhzID09IC1yaHMgdGhlbiB0aGV0YSA9PSAwIGFuZCB3ZSBjYW4gcmV0dXJuIGxoc1xuICAgICAgICBpZiAoTWF0aC5hYnMoY29zSGFsZlRoZXRhKSA+PSAxKSB7XG4gICAgICAgICAgICB0aGlzLncgPSBsdztcbiAgICAgICAgICAgIHRoaXMueCA9IGx4O1xuICAgICAgICAgICAgdGhpcy55ID0gbHk7XG4gICAgICAgICAgICB0aGlzLnogPSBsejtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIHRlbXBvcmFyeSB2YWx1ZXMuXG4gICAgICAgIGNvbnN0IGhhbGZUaGV0YSA9IE1hdGguYWNvcyhjb3NIYWxmVGhldGEpO1xuICAgICAgICBjb25zdCBzaW5IYWxmVGhldGEgPSBNYXRoLnNxcnQoMSAtIGNvc0hhbGZUaGV0YSAqIGNvc0hhbGZUaGV0YSk7XG5cbiAgICAgICAgLy8gSWYgdGhldGEgPSAxODAgZGVncmVlcyB0aGVuIHJlc3VsdCBpcyBub3QgZnVsbHkgZGVmaW5lZFxuICAgICAgICAvLyB3ZSBjb3VsZCByb3RhdGUgYXJvdW5kIGFueSBheGlzIG5vcm1hbCB0byBxYSBvciBxYlxuICAgICAgICBpZiAoTWF0aC5hYnMoc2luSGFsZlRoZXRhKSA8IDAuMDAxKSB7XG4gICAgICAgICAgICB0aGlzLncgPSAobHcgKiAwLjUgKyBydyAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnggPSAobHggKiAwLjUgKyByeCAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnkgPSAobHkgKiAwLjUgKyByeSAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnogPSAobHogKiAwLjUgKyByeiAqIDAuNSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJhdGlvQSA9IE1hdGguc2luKCgxIC0gYWxwaGEpICogaGFsZlRoZXRhKSAvIHNpbkhhbGZUaGV0YTtcbiAgICAgICAgY29uc3QgcmF0aW9CID0gTWF0aC5zaW4oYWxwaGEgKiBoYWxmVGhldGEpIC8gc2luSGFsZlRoZXRhO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBRdWF0ZXJuaW9uLlxuICAgICAgICB0aGlzLncgPSAobHcgKiByYXRpb0EgKyBydyAqIHJhdGlvQik7XG4gICAgICAgIHRoaXMueCA9IChseCAqIHJhdGlvQSArIHJ4ICogcmF0aW9CKTtcbiAgICAgICAgdGhpcy55ID0gKGx5ICogcmF0aW9BICsgcnkgKiByYXRpb0IpO1xuICAgICAgICB0aGlzLnogPSAobHogKiByYXRpb0EgKyByeiAqIHJhdGlvQik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBieSB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHZlYyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byBiZSB0cmFuc2Zvcm1lZC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtyZXNdIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgcmVzdWx0IG9mIHRoZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGlucHV0IHZlY3RvciB2IHRyYW5zZm9ybWVkIGJ5IHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3JcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMzKDEsIDIsIDMpO1xuICAgICAqXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeFxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICpcbiAgICAgKiB2YXIgdHYgPSBxLnRyYW5zZm9ybVZlY3Rvcih2KTtcbiAgICAgKi9cbiAgICB0cmFuc2Zvcm1WZWN0b3IodmVjLCByZXMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGNvbnN0IHggPSB2ZWMueCwgeSA9IHZlYy55LCB6ID0gdmVjLno7XG4gICAgICAgIGNvbnN0IHF4ID0gdGhpcy54LCBxeSA9IHRoaXMueSwgcXogPSB0aGlzLnosIHF3ID0gdGhpcy53O1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBxdWF0ICogdmVjXG4gICAgICAgIGNvbnN0IGl4ID0gcXcgKiB4ICsgcXkgKiB6IC0gcXogKiB5O1xuICAgICAgICBjb25zdCBpeSA9IHF3ICogeSArIHF6ICogeCAtIHF4ICogejtcbiAgICAgICAgY29uc3QgaXogPSBxdyAqIHogKyBxeCAqIHkgLSBxeSAqIHg7XG4gICAgICAgIGNvbnN0IGl3ID0gLXF4ICogeCAtIHF5ICogeSAtIHF6ICogejtcblxuICAgICAgICAvLyBjYWxjdWxhdGUgcmVzdWx0ICogaW52ZXJzZSBxdWF0XG4gICAgICAgIHJlcy54ID0gaXggKiBxdyArIGl3ICogLXF4ICsgaXkgKiAtcXogLSBpeiAqIC1xeTtcbiAgICAgICAgcmVzLnkgPSBpeSAqIHF3ICsgaXcgKiAtcXkgKyBpeiAqIC1xeCAtIGl4ICogLXF6O1xuICAgICAgICByZXMueiA9IGl6ICogcXcgKyBpdyAqIC1xeiArIGl4ICogLXF5IC0gaXkgKiAtcXg7XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgcXVhdGVybmlvbiB0byBzdHJpbmcgZm9ybS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBxdWF0ZXJuaW9uIGluIHN0cmluZyBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHYgPSBuZXcgcGMuUXVhdCgwLCAwLCAwLCAxKTtcbiAgICAgKiAvLyBPdXRwdXRzIFswLCAwLCAwLCAxXVxuICAgICAqIGNvbnNvbGUubG9nKHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiBgWyR7dGhpcy54fSwgJHt0aGlzLnl9LCAke3RoaXMuen0sICR7dGhpcy53fV1gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgcXVhdGVybmlvbiBzZXQgdG8gWzAsIDAsIDAsIDFdICh0aGUgaWRlbnRpdHkpLlxuICAgICAqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIElERU5USVRZID0gT2JqZWN0LmZyZWV6ZShuZXcgUXVhdCgwLCAwLCAwLCAxKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHF1YXRlcm5pb24gc2V0IHRvIFswLCAwLCAwLCAwXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBaRVJPID0gT2JqZWN0LmZyZWV6ZShuZXcgUXVhdCgwLCAwLCAwLCAwKSk7XG59XG5cbmV4cG9ydCB7IFF1YXQgfTtcbiJdLCJuYW1lcyI6WyJRdWF0IiwiY29uc3RydWN0b3IiLCJ4IiwieSIsInoiLCJ3IiwibGVuZ3RoIiwiY2xvbmUiLCJjc3RyIiwiY29uanVnYXRlIiwiY29weSIsInJocyIsImVxdWFscyIsImdldEF4aXNBbmdsZSIsImF4aXMiLCJyYWQiLCJNYXRoIiwiYWNvcyIsInMiLCJzaW4iLCJtYXRoIiwiUkFEX1RPX0RFRyIsImdldEV1bGVyQW5nbGVzIiwiZXVsZXJzIiwiVmVjMyIsInF4IiwicXkiLCJxeiIsInF3IiwiYTIiLCJhdGFuMiIsIlBJIiwiYXNpbiIsInNldCIsIm11bFNjYWxhciIsImludmVydCIsIm5vcm1hbGl6ZSIsInNxcnQiLCJsZW5ndGhTcSIsIm11bCIsInExeCIsInExeSIsInExeiIsInExdyIsInEyeCIsInEyeSIsInEyeiIsInEydyIsIm11bDIiLCJsaHMiLCJsZW4iLCJzZXRGcm9tQXhpc0FuZ2xlIiwiYW5nbGUiLCJERUdfVE9fUkFEIiwic2EiLCJjYSIsImNvcyIsInNldEZyb21FdWxlckFuZ2xlcyIsImV4IiwiZXkiLCJleiIsInZlYyIsImhhbGZUb1JhZCIsInN4IiwiY3giLCJzeSIsImN5Iiwic3oiLCJjeiIsInNldEZyb21NYXQ0IiwibSIsIm0wMCIsIm0wMSIsIm0wMiIsIm0xMCIsIm0xMSIsIm0xMiIsIm0yMCIsIm0yMSIsIm0yMiIsInJzIiwibHgiLCJseSIsImx6IiwiZGF0YSIsInRyIiwic2xlcnAiLCJhbHBoYSIsImx3IiwicngiLCJyeSIsInJ6IiwicnciLCJjb3NIYWxmVGhldGEiLCJhYnMiLCJoYWxmVGhldGEiLCJzaW5IYWxmVGhldGEiLCJyYXRpb0EiLCJyYXRpb0IiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJyZXMiLCJpeCIsIml5IiwiaXoiLCJpdyIsInRvU3RyaW5nIiwiSURFTlRJVFkiLCJPYmplY3QiLCJmcmVlemUiLCJaRVJPIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUdBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLElBQUksQ0FBQztBQUNQO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUFBLElBQUEs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
