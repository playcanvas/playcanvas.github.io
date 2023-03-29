/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
   * Reports whether two quaternions are equal using an absolute error tolerance.
   *
   * @param {Quat} rhs - The quaternion to be compared against.
   * @param {number} [epsilon=1e-6] - The maximum difference between each component of the two quaternions. Defaults to 1e-6.
   * @returns {boolean} True if the quaternions are equal and false otherwise.
   * @example
   * var a = new pc.Quat();
   * var b = new pc.Quat();
   * console.log("The two quaternions are approximately " + (a.equalsApprox(b, 1e-9) ? "equal" : "different"));
   */
  equalsApprox(rhs, epsilon = 1e-6) {
    return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon && Math.abs(this.w - rhs.w) < epsilon;
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
   * Set the quaternion that represents the shortest rotation from one direction to another.
   *
   * @param {Vec3} from - The direction to rotate from. It should be normalized.
   * @param {Vec3} to - The direction to rotate to. It should be normalized.
   * @returns {Quat} Self for chaining.
   *
   * {@link https://www.xarg.org/proof/quaternion-from-two-vectors/ Proof of correctness}
   */
  setFromDirections(from, to) {
    const dotProduct = 1 + from.dot(to);
    if (dotProduct < Number.EPSILON) {
      // the vectors point in opposite directions
      // so we need to rotate 180 degrees around an arbitrary orthogonal axis
      if (Math.abs(from.x) > Math.abs(from.y)) {
        this.x = -from.z;
        this.y = 0;
        this.z = from.x;
        this.w = 0;
      } else {
        this.x = 0;
        this.y = -from.z;
        this.z = from.y;
        this.w = 0;
      }
    } else {
      // cross product between the two vectors
      this.x = from.y * to.z - from.z * to.y;
      this.y = from.z * to.x - from.x * to.z;
      this.z = from.x * to.y - from.y * to.x;
      this.w = dotProduct;
    }
    return this.normalize();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVhdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9xdWF0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4vdmVjMy5qcyc7XG5cbi8qKlxuICogQSBxdWF0ZXJuaW9uLlxuICovXG5jbGFzcyBRdWF0IHtcbiAgICAvKipcbiAgICAgKiBUaGUgeCBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHg7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgeSBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgeiBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHo7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdyBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHc7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUXVhdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bWJlcltdfSBbeF0gLSBUaGUgcXVhdGVybmlvbidzIHggY29tcG9uZW50LiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5XG4gICAgICogb2YgbGVuZ3RoIDQsIHRoZSBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeSBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeiBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgdyBjb21wb25lbnQuIERlZmF1bHRzIHRvIDEuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoeCA9IDAsIHkgPSAwLCB6ID0gMCwgdyA9IDEpIHtcbiAgICAgICAgaWYgKHgubGVuZ3RoID09PSA0KSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4WzBdO1xuICAgICAgICAgICAgdGhpcy55ID0geFsxXTtcbiAgICAgICAgICAgIHRoaXMueiA9IHhbMl07XG4gICAgICAgICAgICB0aGlzLncgPSB4WzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICAgICAgdGhpcy53ID0gdztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gaWRlbnRpY2FsIGNvcHkgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgcXVhdGVybmlvbiBjb250YWluaW5nIHRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KC0wLjExLCAtMC4xNSwgLTAuNDYsIDAuODcpO1xuICAgICAqIHZhciBxY2xvbmUgPSBxLmNsb25lKCk7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcgaXM6IFwiICsgcS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55LCB0aGlzLnosIHRoaXMudyk7XG4gICAgfVxuXG4gICAgY29uanVnYXRlKCkge1xuICAgICAgICB0aGlzLnggKj0gLTE7XG4gICAgICAgIHRoaXMueSAqPSAtMTtcbiAgICAgICAgdGhpcy56ICo9IC0xO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2UgcXVhdGVybmlvbiB0byBhIGRlc3RpbmF0aW9uIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgc3JjID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiB2YXIgZHN0ID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBkc3QuY29weShzcmMsIHNyYyk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHF1YXRlcm5pb25zIGFyZSBcIiArIChzcmMuZXF1YWxzKGRzdCkgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IHJocy55O1xuICAgICAgICB0aGlzLnogPSByaHMuejtcbiAgICAgICAgdGhpcy53ID0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHR3byBxdWF0ZXJuaW9ucyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvbXBhcmVkIGFnYWluc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHF1YXRlcm5pb25zIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gcXVhdGVybmlvbnMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgcmV0dXJuICgodGhpcy54ID09PSByaHMueCkgJiYgKHRoaXMueSA9PT0gcmhzLnkpICYmICh0aGlzLnogPT09IHJocy56KSAmJiAodGhpcy53ID09PSByaHMudykpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0d28gcXVhdGVybmlvbnMgYXJlIGVxdWFsIHVzaW5nIGFuIGFic29sdXRlIGVycm9yIHRvbGVyYW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdG8gYmUgY29tcGFyZWQgYWdhaW5zdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2Vwc2lsb249MWUtNl0gLSBUaGUgbWF4aW11bSBkaWZmZXJlbmNlIGJldHdlZW4gZWFjaCBjb21wb25lbnQgb2YgdGhlIHR3byBxdWF0ZXJuaW9ucy4gRGVmYXVsdHMgdG8gMWUtNi5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgcXVhdGVybmlvbnMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogdmFyIGIgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byBxdWF0ZXJuaW9ucyBhcmUgYXBwcm94aW1hdGVseSBcIiArIChhLmVxdWFsc0FwcHJveChiLCAxZS05KSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHNBcHByb3gocmhzLCBlcHNpbG9uID0gMWUtNikge1xuICAgICAgICByZXR1cm4gKE1hdGguYWJzKHRoaXMueCAtIHJocy54KSA8IGVwc2lsb24pICYmXG4gICAgICAgICAgICAoTWF0aC5hYnModGhpcy55IC0gcmhzLnkpIDwgZXBzaWxvbikgJiZcbiAgICAgICAgICAgIChNYXRoLmFicyh0aGlzLnogLSByaHMueikgPCBlcHNpbG9uKSAmJlxuICAgICAgICAgICAgKE1hdGguYWJzKHRoaXMudyAtIHJocy53KSA8IGVwc2lsb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHJvdGF0aW9uIGF4aXMgYW5kIGFuZ2xlIGZvciBhIGdpdmVuIHF1YXRlcm5pb24uIElmIGEgcXVhdGVybmlvbiBpcyBjcmVhdGVkIHdpdGhcbiAgICAgKiBgc2V0RnJvbUF4aXNBbmdsZWAsIHRoaXMgbWV0aG9kIHdpbGwgcmV0dXJuIHRoZSBzYW1lIHZhbHVlcyBhcyBwcm92aWRlZCBpbiB0aGUgb3JpZ2luYWxcbiAgICAgKiBwYXJhbWV0ZXIgbGlzdCBPUiBmdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGF4aXMgLSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgYXhpcyBvZiByb3RhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBbmdsZSwgaW4gZGVncmVlcywgb2YgdGhlIHJvdGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHEuc2V0RnJvbUF4aXNBbmdsZShuZXcgcGMuVmVjMygwLCAxLCAwKSwgOTApO1xuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiB2YXIgYW5nbGUgPSBxLmdldEF4aXNBbmdsZSh2KTtcbiAgICAgKiAvLyBPdXRwdXRzIDkwXG4gICAgICogY29uc29sZS5sb2coYW5nbGUpO1xuICAgICAqIC8vIE91dHB1dHMgWzAsIDEsIDBdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBnZXRBeGlzQW5nbGUoYXhpcykge1xuICAgICAgICBsZXQgcmFkID0gTWF0aC5hY29zKHRoaXMudykgKiAyO1xuICAgICAgICBjb25zdCBzID0gTWF0aC5zaW4ocmFkIC8gMik7XG4gICAgICAgIGlmIChzICE9PSAwKSB7XG4gICAgICAgICAgICBheGlzLnggPSB0aGlzLnggLyBzO1xuICAgICAgICAgICAgYXhpcy55ID0gdGhpcy55IC8gcztcbiAgICAgICAgICAgIGF4aXMueiA9IHRoaXMueiAvIHM7XG4gICAgICAgICAgICBpZiAoYXhpcy54IDwgMCB8fCBheGlzLnkgPCAwIHx8IGF4aXMueiA8IDApIHtcbiAgICAgICAgICAgICAgICAvLyBGbGlwIHRoZSBzaWduXG4gICAgICAgICAgICAgICAgYXhpcy54ICo9IC0xO1xuICAgICAgICAgICAgICAgIGF4aXMueSAqPSAtMTtcbiAgICAgICAgICAgICAgICBheGlzLnogKj0gLTE7XG4gICAgICAgICAgICAgICAgcmFkICo9IC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSWYgcyBpcyB6ZXJvLCByZXR1cm4gYW55IGF4aXMgKG5vIHJvdGF0aW9uIC0gYXhpcyBkb2VzIG5vdCBtYXR0ZXIpXG4gICAgICAgICAgICBheGlzLnggPSAxO1xuICAgICAgICAgICAgYXhpcy55ID0gMDtcbiAgICAgICAgICAgIGF4aXMueiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJhZCAqIG1hdGguUkFEX1RPX0RFRztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgc3VwcGxpZWQgcXVhdGVybmlvbiB0byBFdWxlciBhbmdsZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtldWxlcnNdIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIEV1bGVyIGFuZ2xlcy5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgdGhlIEV1bGVyIGFuZ2xlcyB0aGF0XG4gICAgICogY29ycmVzcG9uZCB0byB0aGUgc3VwcGxpZWQgcXVhdGVybmlvbi5cbiAgICAgKi9cbiAgICBnZXRFdWxlckFuZ2xlcyhldWxlcnMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGxldCB4LCB5LCB6O1xuXG4gICAgICAgIGNvbnN0IHF4ID0gdGhpcy54O1xuICAgICAgICBjb25zdCBxeSA9IHRoaXMueTtcbiAgICAgICAgY29uc3QgcXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHF3ID0gdGhpcy53O1xuXG4gICAgICAgIGNvbnN0IGEyID0gMiAqIChxdyAqIHF5IC0gcXggKiBxeik7XG5cbiAgICAgICAgaWYgKGEyIDw9IC0wLjk5OTk5KSB7XG4gICAgICAgICAgICB4ID0gMiAqIE1hdGguYXRhbjIocXgsIHF3KTtcbiAgICAgICAgICAgIHkgPSAtTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgfSBlbHNlIGlmIChhMiA+PSAwLjk5OTk5KSB7XG4gICAgICAgICAgICB4ID0gMiAqIE1hdGguYXRhbjIocXgsIHF3KTtcbiAgICAgICAgICAgIHkgPSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgIHogPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IE1hdGguYXRhbjIoMiAqIChxdyAqIHF4ICsgcXkgKiBxeiksIDEgLSAyICogKHF4ICogcXggKyBxeSAqIHF5KSk7XG4gICAgICAgICAgICB5ID0gTWF0aC5hc2luKGEyKTtcbiAgICAgICAgICAgIHogPSBNYXRoLmF0YW4yKDIgKiAocXcgKiBxeiArIHF4ICogcXkpLCAxIC0gMiAqIChxeSAqIHF5ICsgcXogKiBxeikpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV1bGVycy5zZXQoeCwgeSwgeikubXVsU2NhbGFyKG1hdGguUkFEX1RPX0RFRyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIHRoZSBpbnZlcnNlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gcm90YXRlZCAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciByb3QgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAxODAsIDApO1xuICAgICAqXG4gICAgICogLy8gSW52ZXJ0IGluIHBsYWNlXG4gICAgICogcm90LmludmVydCgpO1xuICAgICAqL1xuICAgIGludmVydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uanVnYXRlKCkubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgwLCAwLCAwLCA1KTtcbiAgICAgKiB2YXIgbGVuID0gcS5sZW5ndGgoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggb2YgdGhlIHF1YXRlcm5pb24gaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgc3F1YXJlZCBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoMywgNCwgMCk7XG4gICAgICogdmFyIGxlblNxID0gcS5sZW5ndGhTcSgpO1xuICAgICAqIC8vIE91dHB1dHMgMjVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggc3F1YXJlZCBvZiB0aGUgcXVhdGVybmlvbiBpczogXCIgKyBsZW5TcSk7XG4gICAgICovXG4gICAgbGVuZ3RoU3EoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkgKyB0aGlzLnogKiB0aGlzLnogKyB0aGlzLncgKiB0aGlzLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDMwLCAwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIGEgYmVjb21lcyBhIDkwIGRlZ3JlZSByb3RhdGlvbiBhcm91bmQgdGhlIFkgYXhpc1xuICAgICAqIC8vIEluIG90aGVyIHdvcmRzLCBhID0gYSAqIGJcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IHRoaXMueDtcbiAgICAgICAgY29uc3QgcTF5ID0gdGhpcy55O1xuICAgICAgICBjb25zdCBxMXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IHRoaXMudztcblxuICAgICAgICBjb25zdCBxMnggPSByaHMueDtcbiAgICAgICAgY29uc3QgcTJ5ID0gcmhzLnk7XG4gICAgICAgIGNvbnN0IHEyeiA9IHJocy56O1xuICAgICAgICBjb25zdCBxMncgPSByaHMudztcblxuICAgICAgICB0aGlzLnggPSBxMXcgKiBxMnggKyBxMXggKiBxMncgKyBxMXkgKiBxMnogLSBxMXogKiBxMnk7XG4gICAgICAgIHRoaXMueSA9IHExdyAqIHEyeSArIHExeSAqIHEydyArIHExeiAqIHEyeCAtIHExeCAqIHEyejtcbiAgICAgICAgdGhpcy56ID0gcTF3ICogcTJ6ICsgcTF6ICogcTJ3ICsgcTF4ICogcTJ5IC0gcTF5ICogcTJ4O1xuICAgICAgICB0aGlzLncgPSBxMXcgKiBxMncgLSBxMXggKiBxMnggLSBxMXkgKiBxMnkgLSBxMXogKiBxMno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IGxocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgMzAsIDApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgNjAsIDApO1xuICAgICAqIHZhciByID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKlxuICAgICAqIC8vIHIgaXMgc2V0IHRvIGEgOTAgZGVncmVlIHJvdGF0aW9uIGFyb3VuZCB0aGUgWSBheGlzXG4gICAgICogLy8gSW4gb3RoZXIgd29yZHMsIHIgPSBhICogYlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IGxocy54O1xuICAgICAgICBjb25zdCBxMXkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgcTF6ID0gbGhzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IGxocy53O1xuXG4gICAgICAgIGNvbnN0IHEyeCA9IHJocy54O1xuICAgICAgICBjb25zdCBxMnkgPSByaHMueTtcbiAgICAgICAgY29uc3QgcTJ6ID0gcmhzLno7XG4gICAgICAgIGNvbnN0IHEydyA9IHJocy53O1xuXG4gICAgICAgIHRoaXMueCA9IHExdyAqIHEyeCArIHExeCAqIHEydyArIHExeSAqIHEyeiAtIHExeiAqIHEyeTtcbiAgICAgICAgdGhpcy55ID0gcTF3ICogcTJ5ICsgcTF5ICogcTJ3ICsgcTF6ICogcTJ4IC0gcTF4ICogcTJ6O1xuICAgICAgICB0aGlzLnogPSBxMXcgKiBxMnogKyBxMXogKiBxMncgKyBxMXggKiBxMnkgLSBxMXkgKiBxMng7XG4gICAgICAgIHRoaXMudyA9IHExdyAqIHEydyAtIHExeCAqIHEyeCAtIHExeSAqIHEyeSAtIHExeiAqIHEyejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiBjb252ZXJ0ZWQgaW4gcGxhY2UgdG8gYSB1bml0IHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHJlc3VsdCBvZiB0aGUgbm9ybWFsaXphdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ID0gbmV3IHBjLlF1YXQoMCwgMCwgMCwgNSk7XG4gICAgICpcbiAgICAgKiB2Lm5vcm1hbGl6ZSgpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyAwLCAwLCAwLCAxXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSB2ZWN0b3Igbm9ybWFsaXphdGlvbiBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG5vcm1hbGl6ZSgpIHtcbiAgICAgICAgbGV0IGxlbiA9IHRoaXMubGVuZ3RoKCk7XG4gICAgICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHRoaXMueSA9IHRoaXMueiA9IDA7XG4gICAgICAgICAgICB0aGlzLncgPSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGVuID0gMSAvIGxlbjtcbiAgICAgICAgICAgIHRoaXMueCAqPSBsZW47XG4gICAgICAgICAgICB0aGlzLnkgKj0gbGVuO1xuICAgICAgICAgICAgdGhpcy56ICo9IGxlbjtcbiAgICAgICAgICAgIHRoaXMudyAqPSBsZW47XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiB0byB0aGUgc3VwcGxpZWQgbnVtZXJpY2FsIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIHogY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHcgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldCgxLCAwLCAwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyBxLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5LCB6LCB3KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgIHRoaXMudyA9IHc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBhbiBhbmd1bGFyIHJvdGF0aW9uIGFyb3VuZCBhbiBheGlzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gV29ybGQgc3BhY2UgYXhpcyBhcm91bmQgd2hpY2ggdG8gcm90YXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbmdsZSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgdGhlIGdpdmVuIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDkwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tQXhpc0FuZ2xlKGF4aXMsIGFuZ2xlKSB7XG4gICAgICAgIGFuZ2xlICo9IDAuNSAqIG1hdGguREVHX1RPX1JBRDtcblxuICAgICAgICBjb25zdCBzYSA9IE1hdGguc2luKGFuZ2xlKTtcbiAgICAgICAgY29uc3QgY2EgPSBNYXRoLmNvcyhhbmdsZSk7XG5cbiAgICAgICAgdGhpcy54ID0gc2EgKiBheGlzLng7XG4gICAgICAgIHRoaXMueSA9IHNhICogYXhpcy55O1xuICAgICAgICB0aGlzLnogPSBzYSAqIGF4aXMuejtcbiAgICAgICAgdGhpcy53ID0gY2E7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBFdWxlciBhbmdsZXMgc3BlY2lmaWVkIGluIFhZWiBvcmRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfFZlYzN9IGV4IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBYIGF4aXMgaW4gZGVncmVlcy4gSWYgZXggaXMgYSBWZWMzLCB0aGVcbiAgICAgKiB0aHJlZSBhbmdsZXMgd2lsbCBiZSByZWFkIGZyb20gaXQgaW5zdGVhZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2V5XSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWSBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtlel0gLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFogYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gZnJvbSAzIGV1bGVyIGFuZ2xlc1xuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldEZyb21FdWxlckFuZ2xlcyg0NSwgOTAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgdGhlIHNhbWUgcXVhdGVybmlvbiBmcm9tIGEgdmVjdG9yIGNvbnRhaW5pbmcgdGhlIHNhbWUgMyBldWxlciBhbmdsZXNcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMzKDQ1LCA5MCwgMTgwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogci5zZXRGcm9tRXVsZXJBbmdsZXModik7XG4gICAgICovXG4gICAgc2V0RnJvbUV1bGVyQW5nbGVzKGV4LCBleSwgZXopIHtcbiAgICAgICAgaWYgKGV4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgY29uc3QgdmVjID0gZXg7XG4gICAgICAgICAgICBleCA9IHZlYy54O1xuICAgICAgICAgICAgZXkgPSB2ZWMueTtcbiAgICAgICAgICAgIGV6ID0gdmVjLno7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYWxmVG9SYWQgPSAwLjUgKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGV4ICo9IGhhbGZUb1JhZDtcbiAgICAgICAgZXkgKj0gaGFsZlRvUmFkO1xuICAgICAgICBleiAqPSBoYWxmVG9SYWQ7XG5cbiAgICAgICAgY29uc3Qgc3ggPSBNYXRoLnNpbihleCk7XG4gICAgICAgIGNvbnN0IGN4ID0gTWF0aC5jb3MoZXgpO1xuICAgICAgICBjb25zdCBzeSA9IE1hdGguc2luKGV5KTtcbiAgICAgICAgY29uc3QgY3kgPSBNYXRoLmNvcyhleSk7XG4gICAgICAgIGNvbnN0IHN6ID0gTWF0aC5zaW4oZXopO1xuICAgICAgICBjb25zdCBjeiA9IE1hdGguY29zKGV6KTtcblxuICAgICAgICB0aGlzLnggPSBzeCAqIGN5ICogY3ogLSBjeCAqIHN5ICogc3o7XG4gICAgICAgIHRoaXMueSA9IGN4ICogc3kgKiBjeiArIHN4ICogY3kgKiBzejtcbiAgICAgICAgdGhpcy56ID0gY3ggKiBjeSAqIHN6IC0gc3ggKiBzeSAqIGN6O1xuICAgICAgICB0aGlzLncgPSBjeCAqIGN5ICogY3ogKyBzeCAqIHN5ICogc3o7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4IHRvIGEgcXVhdGVybmlvbi4gTm90ZSB0aGF0IHNpbmNlIGEgcXVhdGVybmlvbiBpcyBwdXJlbHkgYVxuICAgICAqIHJlcHJlc2VudGF0aW9uIGZvciBvcmllbnRhdGlvbiwgb25seSB0aGUgdHJhbnNsYXRpb25hbCBwYXJ0IG9mIHRoZSBtYXRyaXggaXMgbG9zdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21hdDQuanMnKS5NYXQ0fSBtIC0gVGhlIDR4NCBtYXRyaXggdG8gY29udmVydC5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4IG9mIDE4MCBkZWdyZWVzIGFyb3VuZCB0aGUgeS1heGlzXG4gICAgICogdmFyIHJvdCA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUF4aXNBbmdsZShwYy5WZWMzLlVQLCAxODApO1xuICAgICAqXG4gICAgICogLy8gQ29udmVydCB0byBhIHF1YXRlcm5pb25cbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbU1hdDQocm90KTtcbiAgICAgKi9cbiAgICBzZXRGcm9tTWF0NChtKSB7XG4gICAgICAgIGxldCBtMDAsIG0wMSwgbTAyLCBtMTAsIG0xMSwgbTEyLCBtMjAsIG0yMSwgbTIyLFxuICAgICAgICAgICAgcywgcnMsIGx4LCBseSwgbHo7XG5cbiAgICAgICAgbSA9IG0uZGF0YTtcblxuICAgICAgICAvLyBDYWNoZSBtYXRyaXggdmFsdWVzIGZvciBzdXBlci1zcGVlZFxuICAgICAgICBtMDAgPSBtWzBdO1xuICAgICAgICBtMDEgPSBtWzFdO1xuICAgICAgICBtMDIgPSBtWzJdO1xuICAgICAgICBtMTAgPSBtWzRdO1xuICAgICAgICBtMTEgPSBtWzVdO1xuICAgICAgICBtMTIgPSBtWzZdO1xuICAgICAgICBtMjAgPSBtWzhdO1xuICAgICAgICBtMjEgPSBtWzldO1xuICAgICAgICBtMjIgPSBtWzEwXTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHNjYWxlIGZyb20gdGhlIG1hdHJpeFxuICAgICAgICBseCA9IG0wMCAqIG0wMCArIG0wMSAqIG0wMSArIG0wMiAqIG0wMjtcbiAgICAgICAgaWYgKGx4ID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGx4ID0gMSAvIE1hdGguc3FydChseCk7XG4gICAgICAgIGx5ID0gbTEwICogbTEwICsgbTExICogbTExICsgbTEyICogbTEyO1xuICAgICAgICBpZiAobHkgPT09IDApXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgbHkgPSAxIC8gTWF0aC5zcXJ0KGx5KTtcbiAgICAgICAgbHogPSBtMjAgKiBtMjAgKyBtMjEgKiBtMjEgKyBtMjIgKiBtMjI7XG4gICAgICAgIGlmIChseiA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICBseiA9IDEgLyBNYXRoLnNxcnQobHopO1xuXG4gICAgICAgIG0wMCAqPSBseDtcbiAgICAgICAgbTAxICo9IGx4O1xuICAgICAgICBtMDIgKj0gbHg7XG4gICAgICAgIG0xMCAqPSBseTtcbiAgICAgICAgbTExICo9IGx5O1xuICAgICAgICBtMTIgKj0gbHk7XG4gICAgICAgIG0yMCAqPSBsejtcbiAgICAgICAgbTIxICo9IGx6O1xuICAgICAgICBtMjIgKj0gbHo7XG5cbiAgICAgICAgLy8gaHR0cDovL3d3dy5jcy51Y3IuZWR1L352YnovcmVzb3VyY2VzL3F1YXR1dC5wZGZcblxuICAgICAgICBjb25zdCB0ciA9IG0wMCArIG0xMSArIG0yMjtcbiAgICAgICAgaWYgKHRyID49IDApIHtcbiAgICAgICAgICAgIHMgPSBNYXRoLnNxcnQodHIgKyAxKTtcbiAgICAgICAgICAgIHRoaXMudyA9IHMgKiAwLjU7XG4gICAgICAgICAgICBzID0gMC41IC8gcztcbiAgICAgICAgICAgIHRoaXMueCA9IChtMTIgLSBtMjEpICogcztcbiAgICAgICAgICAgIHRoaXMueSA9IChtMjAgLSBtMDIpICogcztcbiAgICAgICAgICAgIHRoaXMueiA9IChtMDEgLSBtMTApICogcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtMDAgPiBtMTEpIHtcbiAgICAgICAgICAgICAgICBpZiAobTAwID4gbTIyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFhEaWFnRG9tTWF0cml4XG4gICAgICAgICAgICAgICAgICAgIHJzID0gKG0wMCAtIChtMTEgKyBtMjIpKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnggPSBycyAqIDAuNTtcbiAgICAgICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53ID0gKG0xMiAtIG0yMSkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy55ID0gKG0wMSArIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy56ID0gKG0wMiArIG0yMCkgKiBycztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBaRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgICAgICBycyA9IChtMjIgLSAobTAwICsgbTExKSkgKyAxO1xuICAgICAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy56ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMDEgLSBtMTApICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueCA9IChtMjAgKyBtMDIpICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMjEgKyBtMTIpICogcnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChtMTEgPiBtMjIpIHtcbiAgICAgICAgICAgICAgICAvLyBZRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgIHJzID0gKG0xMSAtIChtMjIgKyBtMDApKSArIDE7XG4gICAgICAgICAgICAgICAgcnMgPSBNYXRoLnNxcnQocnMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy55ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICB0aGlzLncgPSAobTIwIC0gbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueiA9IChtMTIgKyBtMjEpICogcnM7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gKG0xMCArIG0wMSkgKiBycztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gWkRpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICBycyA9IChtMjIgLSAobTAwICsgbTExKSkgKyAxO1xuICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMueiA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gKG0wMSAtIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnggPSAobTIwICsgbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMjEgKyBtMTIpICogcnM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHF1YXRlcm5pb24gdGhhdCByZXByZXNlbnRzIHRoZSBzaG9ydGVzdCByb3RhdGlvbiBmcm9tIG9uZSBkaXJlY3Rpb24gdG8gYW5vdGhlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gZnJvbSAtIFRoZSBkaXJlY3Rpb24gdG8gcm90YXRlIGZyb20uIEl0IHNob3VsZCBiZSBub3JtYWxpemVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gdG8gLSBUaGUgZGlyZWN0aW9uIHRvIHJvdGF0ZSB0by4gSXQgc2hvdWxkIGJlIG5vcm1hbGl6ZWQuXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqXG4gICAgICoge0BsaW5rIGh0dHBzOi8vd3d3Lnhhcmcub3JnL3Byb29mL3F1YXRlcm5pb24tZnJvbS10d28tdmVjdG9ycy8gUHJvb2Ygb2YgY29ycmVjdG5lc3N9XG4gICAgICovXG4gICAgc2V0RnJvbURpcmVjdGlvbnMoZnJvbSwgdG8pIHtcbiAgICAgICAgY29uc3QgZG90UHJvZHVjdCA9IDEgKyBmcm9tLmRvdCh0byk7XG5cbiAgICAgICAgaWYgKGRvdFByb2R1Y3QgPCBOdW1iZXIuRVBTSUxPTikge1xuICAgICAgICAgICAgLy8gdGhlIHZlY3RvcnMgcG9pbnQgaW4gb3Bwb3NpdGUgZGlyZWN0aW9uc1xuICAgICAgICAgICAgLy8gc28gd2UgbmVlZCB0byByb3RhdGUgMTgwIGRlZ3JlZXMgYXJvdW5kIGFuIGFyYml0cmFyeSBvcnRob2dvbmFsIGF4aXNcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhmcm9tLngpID4gTWF0aC5hYnMoZnJvbS55KSkge1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IC1mcm9tLno7XG4gICAgICAgICAgICAgICAgdGhpcy55ID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnogPSBmcm9tLng7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSAtZnJvbS56O1xuICAgICAgICAgICAgICAgIHRoaXMueiA9IGZyb20ueTtcbiAgICAgICAgICAgICAgICB0aGlzLncgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY3Jvc3MgcHJvZHVjdCBiZXR3ZWVuIHRoZSB0d28gdmVjdG9yc1xuICAgICAgICAgICAgdGhpcy54ID0gZnJvbS55ICogdG8ueiAtIGZyb20ueiAqIHRvLnk7XG4gICAgICAgICAgICB0aGlzLnkgPSBmcm9tLnogKiB0by54IC0gZnJvbS54ICogdG8uejtcbiAgICAgICAgICAgIHRoaXMueiA9IGZyb20ueCAqIHRvLnkgLSBmcm9tLnkgKiB0by54O1xuICAgICAgICAgICAgdGhpcy53ID0gZG90UHJvZHVjdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLm5vcm1hbGl6ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgc3BoZXJpY2FsIGludGVycG9sYXRpb24gYmV0d2VlbiB0d28gcXVhdGVybmlvbnMuIFRoZSByZXN1bHQgb2YgdGhlIGludGVycG9sYXRpb25cbiAgICAgKiBpcyB3cml0dGVuIHRvIHRoZSBxdWF0ZXJuaW9uIGNhbGxpbmcgdGhlIGZ1bmN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSBsaHMgLSBUaGUgcXVhdGVybmlvbiB0byBpbnRlcnBvbGF0ZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdG8gaW50ZXJwb2xhdGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFscGhhIC0gVGhlIHZhbHVlIGNvbnRyb2xsaW5nIHRoZSBpbnRlcnBvbGF0aW9uIGluIHJlbGF0aW9uIHRvIHRoZSB0d28gaW5wdXRcbiAgICAgKiBxdWF0ZXJuaW9ucy4gVGhlIHZhbHVlIGlzIGluIHRoZSByYW5nZSAwIHRvIDEsIDAgZ2VuZXJhdGluZyBxMSwgMSBnZW5lcmF0aW5nIHEyIGFuZCBhbnl0aGluZ1xuICAgICAqIGluIGJldHdlZW4gZ2VuZXJhdGluZyBhIHNwaGVyaWNhbCBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdGhlIHR3by5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcTEgPSBuZXcgcGMuUXVhdCgtMC4xMSwgLTAuMTUsIC0wLjQ2LCAwLjg3KTtcbiAgICAgKiB2YXIgcTIgPSBuZXcgcGMuUXVhdCgtMC4yMSwgLTAuMjEsIC0wLjY3LCAwLjY4KTtcbiAgICAgKlxuICAgICAqIHZhciByZXN1bHQ7XG4gICAgICogcmVzdWx0ID0gbmV3IHBjLlF1YXQoKS5zbGVycChxMSwgcTIsIDApOyAgIC8vIFJldHVybiBxMVxuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAwLjUpOyAvLyBSZXR1cm4gdGhlIG1pZHBvaW50IGludGVycG9sYW50XG4gICAgICogcmVzdWx0ID0gbmV3IHBjLlF1YXQoKS5zbGVycChxMSwgcTIsIDEpOyAgIC8vIFJldHVybiBxMlxuICAgICAqL1xuICAgIHNsZXJwKGxocywgcmhzLCBhbHBoYSkge1xuICAgICAgICAvLyBBbGdvcml0aG0gc291cmNlZCBmcm9tOlxuICAgICAgICAvLyBodHRwOi8vd3d3LmV1Y2xpZGVhbnNwYWNlLmNvbS9tYXRocy9hbGdlYnJhL3JlYWxOb3JtZWRBbGdlYnJhL3F1YXRlcm5pb25zL3NsZXJwL1xuICAgICAgICBjb25zdCBseCA9IGxocy54O1xuICAgICAgICBjb25zdCBseSA9IGxocy55O1xuICAgICAgICBjb25zdCBseiA9IGxocy56O1xuICAgICAgICBjb25zdCBsdyA9IGxocy53O1xuICAgICAgICBsZXQgcnggPSByaHMueDtcbiAgICAgICAgbGV0IHJ5ID0gcmhzLnk7XG4gICAgICAgIGxldCByeiA9IHJocy56O1xuICAgICAgICBsZXQgcncgPSByaHMudztcblxuICAgICAgICAvLyBDYWxjdWxhdGUgYW5nbGUgYmV0d2VlbiB0aGVtLlxuICAgICAgICBsZXQgY29zSGFsZlRoZXRhID0gbHcgKiBydyArIGx4ICogcnggKyBseSAqIHJ5ICsgbHogKiByejtcblxuICAgICAgICBpZiAoY29zSGFsZlRoZXRhIDwgMCkge1xuICAgICAgICAgICAgcncgPSAtcnc7XG4gICAgICAgICAgICByeCA9IC1yeDtcbiAgICAgICAgICAgIHJ5ID0gLXJ5O1xuICAgICAgICAgICAgcnogPSAtcno7XG4gICAgICAgICAgICBjb3NIYWxmVGhldGEgPSAtY29zSGFsZlRoZXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbGhzID09IHJocyBvciBsaHMgPT0gLXJocyB0aGVuIHRoZXRhID09IDAgYW5kIHdlIGNhbiByZXR1cm4gbGhzXG4gICAgICAgIGlmIChNYXRoLmFicyhjb3NIYWxmVGhldGEpID49IDEpIHtcbiAgICAgICAgICAgIHRoaXMudyA9IGx3O1xuICAgICAgICAgICAgdGhpcy54ID0gbHg7XG4gICAgICAgICAgICB0aGlzLnkgPSBseTtcbiAgICAgICAgICAgIHRoaXMueiA9IGx6O1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxjdWxhdGUgdGVtcG9yYXJ5IHZhbHVlcy5cbiAgICAgICAgY29uc3QgaGFsZlRoZXRhID0gTWF0aC5hY29zKGNvc0hhbGZUaGV0YSk7XG4gICAgICAgIGNvbnN0IHNpbkhhbGZUaGV0YSA9IE1hdGguc3FydCgxIC0gY29zSGFsZlRoZXRhICogY29zSGFsZlRoZXRhKTtcblxuICAgICAgICAvLyBJZiB0aGV0YSA9IDE4MCBkZWdyZWVzIHRoZW4gcmVzdWx0IGlzIG5vdCBmdWxseSBkZWZpbmVkXG4gICAgICAgIC8vIHdlIGNvdWxkIHJvdGF0ZSBhcm91bmQgYW55IGF4aXMgbm9ybWFsIHRvIHFhIG9yIHFiXG4gICAgICAgIGlmIChNYXRoLmFicyhzaW5IYWxmVGhldGEpIDwgMC4wMDEpIHtcbiAgICAgICAgICAgIHRoaXMudyA9IChsdyAqIDAuNSArIHJ3ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueCA9IChseCAqIDAuNSArIHJ4ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueSA9IChseSAqIDAuNSArIHJ5ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueiA9IChseiAqIDAuNSArIHJ6ICogMC41KTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmF0aW9BID0gTWF0aC5zaW4oKDEgLSBhbHBoYSkgKiBoYWxmVGhldGEpIC8gc2luSGFsZlRoZXRhO1xuICAgICAgICBjb25zdCByYXRpb0IgPSBNYXRoLnNpbihhbHBoYSAqIGhhbGZUaGV0YSkgLyBzaW5IYWxmVGhldGE7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIFF1YXRlcm5pb24uXG4gICAgICAgIHRoaXMudyA9IChsdyAqIHJhdGlvQSArIHJ3ICogcmF0aW9CKTtcbiAgICAgICAgdGhpcy54ID0gKGx4ICogcmF0aW9BICsgcnggKiByYXRpb0IpO1xuICAgICAgICB0aGlzLnkgPSAobHkgKiByYXRpb0EgKyByeSAqIHJhdGlvQik7XG4gICAgICAgIHRoaXMueiA9IChseiAqIHJhdGlvQSArIHJ6ICogcmF0aW9CKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gdmVjIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3Jlc10gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlIHRyYW5zZm9ybWF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgaW5wdXQgdmVjdG9yIHYgdHJhbnNmb3JtZWQgYnkgdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSAzLWRpbWVuc2lvbmFsIHZlY3RvclxuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzMoMSwgMiwgMyk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKlxuICAgICAqIHZhciB0diA9IHEudHJhbnNmb3JtVmVjdG9yKHYpO1xuICAgICAqL1xuICAgIHRyYW5zZm9ybVZlY3Rvcih2ZWMsIHJlcyA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgY29uc3QgeCA9IHZlYy54LCB5ID0gdmVjLnksIHogPSB2ZWMuejtcbiAgICAgICAgY29uc3QgcXggPSB0aGlzLngsIHF5ID0gdGhpcy55LCBxeiA9IHRoaXMueiwgcXcgPSB0aGlzLnc7XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIHF1YXQgKiB2ZWNcbiAgICAgICAgY29uc3QgaXggPSBxdyAqIHggKyBxeSAqIHogLSBxeiAqIHk7XG4gICAgICAgIGNvbnN0IGl5ID0gcXcgKiB5ICsgcXogKiB4IC0gcXggKiB6O1xuICAgICAgICBjb25zdCBpeiA9IHF3ICogeiArIHF4ICogeSAtIHF5ICogeDtcbiAgICAgICAgY29uc3QgaXcgPSAtcXggKiB4IC0gcXkgKiB5IC0gcXogKiB6O1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSByZXN1bHQgKiBpbnZlcnNlIHF1YXRcbiAgICAgICAgcmVzLnggPSBpeCAqIHF3ICsgaXcgKiAtcXggKyBpeSAqIC1xeiAtIGl6ICogLXF5O1xuICAgICAgICByZXMueSA9IGl5ICogcXcgKyBpdyAqIC1xeSArIGl6ICogLXF4IC0gaXggKiAtcXo7XG4gICAgICAgIHJlcy56ID0gaXogKiBxdyArIGl3ICogLXF6ICsgaXggKiAtcXkgLSBpeSAqIC1xeDtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSBxdWF0ZXJuaW9uIHRvIHN0cmluZyBmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHF1YXRlcm5pb24gaW4gc3RyaW5nIGZvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5RdWF0KDAsIDAsIDAsIDEpO1xuICAgICAqIC8vIE91dHB1dHMgWzAsIDAsIDAsIDFdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIGBbJHt0aGlzLnh9LCAke3RoaXMueX0sICR7dGhpcy56fSwgJHt0aGlzLnd9XWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCBxdWF0ZXJuaW9uIHNldCB0byBbMCwgMCwgMCwgMV0gKHRoZSBpZGVudGl0eSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgSURFTlRJVFkgPSBPYmplY3QuZnJlZXplKG5ldyBRdWF0KDAsIDAsIDAsIDEpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgcXVhdGVybmlvbiBzZXQgdG8gWzAsIDAsIDAsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFpFUk8gPSBPYmplY3QuZnJlZXplKG5ldyBRdWF0KDAsIDAsIDAsIDApKTtcbn1cblxuZXhwb3J0IHsgUXVhdCB9O1xuIl0sIm5hbWVzIjpbIlF1YXQiLCJjb25zdHJ1Y3RvciIsIngiLCJ5IiwieiIsInciLCJsZW5ndGgiLCJjbG9uZSIsImNzdHIiLCJjb25qdWdhdGUiLCJjb3B5IiwicmhzIiwiZXF1YWxzIiwiZXF1YWxzQXBwcm94IiwiZXBzaWxvbiIsIk1hdGgiLCJhYnMiLCJnZXRBeGlzQW5nbGUiLCJheGlzIiwicmFkIiwiYWNvcyIsInMiLCJzaW4iLCJtYXRoIiwiUkFEX1RPX0RFRyIsImdldEV1bGVyQW5nbGVzIiwiZXVsZXJzIiwiVmVjMyIsInF4IiwicXkiLCJxeiIsInF3IiwiYTIiLCJhdGFuMiIsIlBJIiwiYXNpbiIsInNldCIsIm11bFNjYWxhciIsImludmVydCIsIm5vcm1hbGl6ZSIsInNxcnQiLCJsZW5ndGhTcSIsIm11bCIsInExeCIsInExeSIsInExeiIsInExdyIsInEyeCIsInEyeSIsInEyeiIsInEydyIsIm11bDIiLCJsaHMiLCJsZW4iLCJzZXRGcm9tQXhpc0FuZ2xlIiwiYW5nbGUiLCJERUdfVE9fUkFEIiwic2EiLCJjYSIsImNvcyIsInNldEZyb21FdWxlckFuZ2xlcyIsImV4IiwiZXkiLCJleiIsInZlYyIsImhhbGZUb1JhZCIsInN4IiwiY3giLCJzeSIsImN5Iiwic3oiLCJjeiIsInNldEZyb21NYXQ0IiwibSIsIm0wMCIsIm0wMSIsIm0wMiIsIm0xMCIsIm0xMSIsIm0xMiIsIm0yMCIsIm0yMSIsIm0yMiIsInJzIiwibHgiLCJseSIsImx6IiwiZGF0YSIsInRyIiwic2V0RnJvbURpcmVjdGlvbnMiLCJmcm9tIiwidG8iLCJkb3RQcm9kdWN0IiwiZG90IiwiTnVtYmVyIiwiRVBTSUxPTiIsInNsZXJwIiwiYWxwaGEiLCJsdyIsInJ4IiwicnkiLCJyeiIsInJ3IiwiY29zSGFsZlRoZXRhIiwiaGFsZlRoZXRhIiwic2luSGFsZlRoZXRhIiwicmF0aW9BIiwicmF0aW9CIiwidHJhbnNmb3JtVmVjdG9yIiwicmVzIiwiaXgiLCJpeSIsIml6IiwiaXciLCJ0b1N0cmluZyIsIklERU5USVRZIiwiT2JqZWN0IiwiZnJlZXplIiwiWkVSTyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFHQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxJQUFJLENBQUM7QUFDUDtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXLENBQUNDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFBQSxJQUFBLElBQUEsQ0FoQ3hDSCxDQUFDLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPREMsQ0FBQyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT0RDLENBQUMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9EQyxDQUFDLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFZRyxJQUFBLElBQUlILENBQUMsQ0FBQ0ksTUFBTSxLQUFLLENBQUMsRUFBRTtBQUNoQixNQUFBLElBQUksQ0FBQ0osQ0FBQyxHQUFHQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDYixNQUFBLElBQUksQ0FBQ0MsQ0FBQyxHQUFHRCxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDYixNQUFBLElBQUksQ0FBQ0UsQ0FBQyxHQUFHRixDQUFDLENBQUMsQ0FBQyxD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
