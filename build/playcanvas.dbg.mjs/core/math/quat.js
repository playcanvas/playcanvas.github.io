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
   * const q = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
   * const qclone = q.clone();
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
   * const src = new pc.Quat();
   * const dst = new pc.Quat();
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
   * const a = new pc.Quat();
   * const b = new pc.Quat();
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
   * const a = new pc.Quat();
   * const b = new pc.Quat();
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
   * const q = new pc.Quat();
   * q.setFromAxisAngle(new pc.Vec3(0, 1, 0), 90);
   * const v = new pc.Vec3();
   * const angle = q.getAxisAngle(v);
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
   * const rot = new pc.Quat().setFromEulerAngles(0, 180, 0);
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
   * const q = new pc.Quat(0, 0, 0, 5);
   * const len = q.length();
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
   * const q = new pc.Quat(3, 4, 0);
   * const lenSq = q.lengthSq();
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
   * const a = new pc.Quat().setFromEulerAngles(0, 30, 0);
   * const b = new pc.Quat().setFromEulerAngles(0, 60, 0);
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
   * const a = new pc.Quat().setFromEulerAngles(0, 30, 0);
   * const b = new pc.Quat().setFromEulerAngles(0, 60, 0);
   * const r = new pc.Quat();
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
   * const v = new pc.Quat(0, 0, 0, 5);
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
   * const q = new pc.Quat();
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
   * const q = new pc.Quat();
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
   * const q = new pc.Quat();
   * q.setFromEulerAngles(45, 90, 180);
   *
   * // Create the same quaternion from a vector containing the same 3 euler angles
   * const v = new pc.Vec3(45, 90, 180);
   * const r = new pc.Quat();
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
   * const rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
   *
   * // Convert to a quaternion
   * const q = new pc.Quat().setFromMat4(rot);
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
   * const q1 = new pc.Quat(-0.11, -0.15, -0.46, 0.87);
   * const q2 = new pc.Quat(-0.21, -0.21, -0.67, 0.68);
   *
   * const result;
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
   * const v = new pc.Vec3(1, 2, 3);
   *
   * // Create a 4x4 rotation matrix
   * const q = new pc.Quat().setFromEulerAngles(10, 20, 30);
   *
   * const tv = q.transformVector(v);
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
   * const v = new pc.Quat(0, 0, 0, 1);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVhdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9xdWF0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4vdmVjMy5qcyc7XG5cbi8qKlxuICogQSBxdWF0ZXJuaW9uLlxuICovXG5jbGFzcyBRdWF0IHtcbiAgICAvKipcbiAgICAgKiBUaGUgeCBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHg7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgeSBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgeiBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHo7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdyBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHc7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUXVhdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bWJlcltdfSBbeF0gLSBUaGUgcXVhdGVybmlvbidzIHggY29tcG9uZW50LiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5XG4gICAgICogb2YgbGVuZ3RoIDQsIHRoZSBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeSBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeiBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgdyBjb21wb25lbnQuIERlZmF1bHRzIHRvIDEuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoeCA9IDAsIHkgPSAwLCB6ID0gMCwgdyA9IDEpIHtcbiAgICAgICAgaWYgKHgubGVuZ3RoID09PSA0KSB7XG4gICAgICAgICAgICB0aGlzLnggPSB4WzBdO1xuICAgICAgICAgICAgdGhpcy55ID0geFsxXTtcbiAgICAgICAgICAgIHRoaXMueiA9IHhbMl07XG4gICAgICAgICAgICB0aGlzLncgPSB4WzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICAgICAgdGhpcy53ID0gdztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gaWRlbnRpY2FsIGNvcHkgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgcXVhdGVybmlvbiBjb250YWluaW5nIHRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBxID0gbmV3IHBjLlF1YXQoLTAuMTEsIC0wLjE1LCAtMC40NiwgMC44Nyk7XG4gICAgICogY29uc3QgcWNsb25lID0gcS5jbG9uZSgpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nIGlzOiBcIiArIHEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7dGhpc30gKi9cbiAgICAgICAgY29uc3QgY3N0ciA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgICAgIHJldHVybiBuZXcgY3N0cih0aGlzLngsIHRoaXMueSwgdGhpcy56LCB0aGlzLncpO1xuICAgIH1cblxuICAgIGNvbmp1Z2F0ZSgpIHtcbiAgICAgICAgdGhpcy54ICo9IC0xO1xuICAgICAgICB0aGlzLnkgKj0gLTE7XG4gICAgICAgIHRoaXMueiAqPSAtMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIHF1YXRlcm5pb24gdG8gYSBkZXN0aW5hdGlvbiBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSByaHMgLSBUaGUgcXVhdGVybmlvbiB0byBiZSBjb3BpZWQuXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgc3JjID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zdCBkc3QgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIGRzdC5jb3B5KHNyYywgc3JjKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gcXVhdGVybmlvbnMgYXJlIFwiICsgKHNyYy5lcXVhbHMoZHN0KSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBjb3B5KHJocykge1xuICAgICAgICB0aGlzLnggPSByaHMueDtcbiAgICAgICAgdGhpcy55ID0gcmhzLnk7XG4gICAgICAgIHRoaXMueiA9IHJocy56O1xuICAgICAgICB0aGlzLncgPSByaHMudztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIHF1YXRlcm5pb25zIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdG8gYmUgY29tcGFyZWQgYWdhaW5zdC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgcXVhdGVybmlvbnMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gcXVhdGVybmlvbnMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgcmV0dXJuICgodGhpcy54ID09PSByaHMueCkgJiYgKHRoaXMueSA9PT0gcmhzLnkpICYmICh0aGlzLnogPT09IHJocy56KSAmJiAodGhpcy53ID09PSByaHMudykpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0d28gcXVhdGVybmlvbnMgYXJlIGVxdWFsIHVzaW5nIGFuIGFic29sdXRlIGVycm9yIHRvbGVyYW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdG8gYmUgY29tcGFyZWQgYWdhaW5zdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2Vwc2lsb249MWUtNl0gLSBUaGUgbWF4aW11bSBkaWZmZXJlbmNlIGJldHdlZW4gZWFjaCBjb21wb25lbnQgb2YgdGhlIHR3byBxdWF0ZXJuaW9ucy4gRGVmYXVsdHMgdG8gMWUtNi5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgcXVhdGVybmlvbnMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gcXVhdGVybmlvbnMgYXJlIGFwcHJveGltYXRlbHkgXCIgKyAoYS5lcXVhbHNBcHByb3goYiwgMWUtOSkgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgZXF1YWxzQXBwcm94KHJocywgZXBzaWxvbiA9IDFlLTYpIHtcbiAgICAgICAgcmV0dXJuIChNYXRoLmFicyh0aGlzLnggLSByaHMueCkgPCBlcHNpbG9uKSAmJlxuICAgICAgICAgICAgKE1hdGguYWJzKHRoaXMueSAtIHJocy55KSA8IGVwc2lsb24pICYmXG4gICAgICAgICAgICAoTWF0aC5hYnModGhpcy56IC0gcmhzLnopIDwgZXBzaWxvbikgJiZcbiAgICAgICAgICAgIChNYXRoLmFicyh0aGlzLncgLSByaHMudykgPCBlcHNpbG9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSByb3RhdGlvbiBheGlzIGFuZCBhbmdsZSBmb3IgYSBnaXZlbiBxdWF0ZXJuaW9uLiBJZiBhIHF1YXRlcm5pb24gaXMgY3JlYXRlZCB3aXRoXG4gICAgICogYHNldEZyb21BeGlzQW5nbGVgLCB0aGlzIG1ldGhvZCB3aWxsIHJldHVybiB0aGUgc2FtZSB2YWx1ZXMgYXMgcHJvdmlkZWQgaW4gdGhlIG9yaWdpbmFsXG4gICAgICogcGFyYW1ldGVyIGxpc3QgT1IgZnVuY3Rpb25hbGx5IGVxdWl2YWxlbnQgdmFsdWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIGF4aXMgb2Ygcm90YXRpb24uXG4gICAgICogQHJldHVybnMge251bWJlcn0gQW5nbGUsIGluIGRlZ3JlZXMsIG9mIHRoZSByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHEuc2V0RnJvbUF4aXNBbmdsZShuZXcgcGMuVmVjMygwLCAxLCAwKSwgOTApO1xuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIGNvbnN0IGFuZ2xlID0gcS5nZXRBeGlzQW5nbGUodik7XG4gICAgICogLy8gT3V0cHV0cyA5MFxuICAgICAqIGNvbnNvbGUubG9nKGFuZ2xlKTtcbiAgICAgKiAvLyBPdXRwdXRzIFswLCAxLCAwXVxuICAgICAqIGNvbnNvbGUubG9nKHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZ2V0QXhpc0FuZ2xlKGF4aXMpIHtcbiAgICAgICAgbGV0IHJhZCA9IE1hdGguYWNvcyh0aGlzLncpICogMjtcbiAgICAgICAgY29uc3QgcyA9IE1hdGguc2luKHJhZCAvIDIpO1xuICAgICAgICBpZiAocyAhPT0gMCkge1xuICAgICAgICAgICAgYXhpcy54ID0gdGhpcy54IC8gcztcbiAgICAgICAgICAgIGF4aXMueSA9IHRoaXMueSAvIHM7XG4gICAgICAgICAgICBheGlzLnogPSB0aGlzLnogLyBzO1xuICAgICAgICAgICAgaWYgKGF4aXMueCA8IDAgfHwgYXhpcy55IDwgMCB8fCBheGlzLnogPCAwKSB7XG4gICAgICAgICAgICAgICAgLy8gRmxpcCB0aGUgc2lnblxuICAgICAgICAgICAgICAgIGF4aXMueCAqPSAtMTtcbiAgICAgICAgICAgICAgICBheGlzLnkgKj0gLTE7XG4gICAgICAgICAgICAgICAgYXhpcy56ICo9IC0xO1xuICAgICAgICAgICAgICAgIHJhZCAqPSAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIElmIHMgaXMgemVybywgcmV0dXJuIGFueSBheGlzIChubyByb3RhdGlvbiAtIGF4aXMgZG9lcyBub3QgbWF0dGVyKVxuICAgICAgICAgICAgYXhpcy54ID0gMTtcbiAgICAgICAgICAgIGF4aXMueSA9IDA7XG4gICAgICAgICAgICBheGlzLnogPSAwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByYWQgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHN1cHBsaWVkIHF1YXRlcm5pb24gdG8gRXVsZXIgYW5nbGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbZXVsZXJzXSAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSBFdWxlciBhbmdsZXMuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHRoZSBFdWxlciBhbmdsZXMgdGhhdFxuICAgICAqIGNvcnJlc3BvbmQgdG8gdGhlIHN1cHBsaWVkIHF1YXRlcm5pb24uXG4gICAgICovXG4gICAgZ2V0RXVsZXJBbmdsZXMoZXVsZXJzID0gbmV3IFZlYzMoKSkge1xuICAgICAgICBsZXQgeCwgeSwgejtcblxuICAgICAgICBjb25zdCBxeCA9IHRoaXMueDtcbiAgICAgICAgY29uc3QgcXkgPSB0aGlzLnk7XG4gICAgICAgIGNvbnN0IHF6ID0gdGhpcy56O1xuICAgICAgICBjb25zdCBxdyA9IHRoaXMudztcblxuICAgICAgICBjb25zdCBhMiA9IDIgKiAocXcgKiBxeSAtIHF4ICogcXopO1xuXG4gICAgICAgIGlmIChhMiA8PSAtMC45OTk5OSkge1xuICAgICAgICAgICAgeCA9IDIgKiBNYXRoLmF0YW4yKHF4LCBxdyk7XG4gICAgICAgICAgICB5ID0gLU1hdGguUEkgLyAyO1xuICAgICAgICAgICAgeiA9IDA7XG4gICAgICAgIH0gZWxzZSBpZiAoYTIgPj0gMC45OTk5OSkge1xuICAgICAgICAgICAgeCA9IDIgKiBNYXRoLmF0YW4yKHF4LCBxdyk7XG4gICAgICAgICAgICB5ID0gTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHggPSBNYXRoLmF0YW4yKDIgKiAocXcgKiBxeCArIHF5ICogcXopLCAxIC0gMiAqIChxeCAqIHF4ICsgcXkgKiBxeSkpO1xuICAgICAgICAgICAgeSA9IE1hdGguYXNpbihhMik7XG4gICAgICAgICAgICB6ID0gTWF0aC5hdGFuMigyICogKHF3ICogcXogKyBxeCAqIHF5KSwgMSAtIDIgKiAocXkgKiBxeSArIHF6ICogcXopKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBldWxlcnMuc2V0KHgsIHksIHopLm11bFNjYWxhcihtYXRoLlJBRF9UT19ERUcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlcyB0aGUgaW52ZXJzZSBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBxdWF0ZXJuaW9uIHJvdGF0ZWQgMTgwIGRlZ3JlZXMgYXJvdW5kIHRoZSB5LWF4aXNcbiAgICAgKiBjb25zdCByb3QgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAxODAsIDApO1xuICAgICAqXG4gICAgICogLy8gSW52ZXJ0IGluIHBsYWNlXG4gICAgICogcm90LmludmVydCgpO1xuICAgICAqL1xuICAgIGludmVydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uanVnYXRlKCkubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcSA9IG5ldyBwYy5RdWF0KDAsIDAsIDAsIDUpO1xuICAgICAqIGNvbnN0IGxlbiA9IHEubGVuZ3RoKCk7XG4gICAgICogLy8gT3V0cHV0cyA1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIG9mIHRoZSBxdWF0ZXJuaW9uIGlzOiBcIiArIGxlbik7XG4gICAgICovXG4gICAgbGVuZ3RoKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSArIHRoaXMueiAqIHRoaXMueiArIHRoaXMudyAqIHRoaXMudyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIHNxdWFyZWQgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBxID0gbmV3IHBjLlF1YXQoMywgNCwgMCk7XG4gICAgICogY29uc3QgbGVuU3EgPSBxLmxlbmd0aFNxKCk7XG4gICAgICogLy8gT3V0cHV0cyAyNVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIGxlbmd0aCBzcXVhcmVkIG9mIHRoZSBxdWF0ZXJuaW9uIGlzOiBcIiArIGxlblNxKTtcbiAgICAgKi9cbiAgICBsZW5ndGhTcSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSArIHRoaXMueiAqIHRoaXMueiArIHRoaXMudyAqIHRoaXMudztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSByZXN1bHQgb2YgbXVsdGlwbHlpbmcgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9ucyB0b2dldGhlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAzMCwgMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIGEgYmVjb21lcyBhIDkwIGRlZ3JlZSByb3RhdGlvbiBhcm91bmQgdGhlIFkgYXhpc1xuICAgICAqIC8vIEluIG90aGVyIHdvcmRzLCBhID0gYSAqIGJcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IHRoaXMueDtcbiAgICAgICAgY29uc3QgcTF5ID0gdGhpcy55O1xuICAgICAgICBjb25zdCBxMXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IHRoaXMudztcblxuICAgICAgICBjb25zdCBxMnggPSByaHMueDtcbiAgICAgICAgY29uc3QgcTJ5ID0gcmhzLnk7XG4gICAgICAgIGNvbnN0IHEyeiA9IHJocy56O1xuICAgICAgICBjb25zdCBxMncgPSByaHMudztcblxuICAgICAgICB0aGlzLnggPSBxMXcgKiBxMnggKyBxMXggKiBxMncgKyBxMXkgKiBxMnogLSBxMXogKiBxMnk7XG4gICAgICAgIHRoaXMueSA9IHExdyAqIHEyeSArIHExeSAqIHEydyArIHExeiAqIHEyeCAtIHExeCAqIHEyejtcbiAgICAgICAgdGhpcy56ID0gcTF3ICogcTJ6ICsgcTF6ICogcTJ3ICsgcTF4ICogcTJ5IC0gcTF5ICogcTJ4O1xuICAgICAgICB0aGlzLncgPSBxMXcgKiBxMncgLSBxMXggKiBxMnggLSBxMXkgKiBxMnkgLSBxMXogKiBxMno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IGxocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAzMCwgMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKiBjb25zdCByID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKlxuICAgICAqIC8vIHIgaXMgc2V0IHRvIGEgOTAgZGVncmVlIHJvdGF0aW9uIGFyb3VuZCB0aGUgWSBheGlzXG4gICAgICogLy8gSW4gb3RoZXIgd29yZHMsIHIgPSBhICogYlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IGxocy54O1xuICAgICAgICBjb25zdCBxMXkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgcTF6ID0gbGhzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IGxocy53O1xuXG4gICAgICAgIGNvbnN0IHEyeCA9IHJocy54O1xuICAgICAgICBjb25zdCBxMnkgPSByaHMueTtcbiAgICAgICAgY29uc3QgcTJ6ID0gcmhzLno7XG4gICAgICAgIGNvbnN0IHEydyA9IHJocy53O1xuXG4gICAgICAgIHRoaXMueCA9IHExdyAqIHEyeCArIHExeCAqIHEydyArIHExeSAqIHEyeiAtIHExeiAqIHEyeTtcbiAgICAgICAgdGhpcy55ID0gcTF3ICogcTJ5ICsgcTF5ICogcTJ3ICsgcTF6ICogcTJ4IC0gcTF4ICogcTJ6O1xuICAgICAgICB0aGlzLnogPSBxMXcgKiBxMnogKyBxMXogKiBxMncgKyBxMXggKiBxMnkgLSBxMXkgKiBxMng7XG4gICAgICAgIHRoaXMudyA9IHExdyAqIHEydyAtIHExeCAqIHEyeCAtIHExeSAqIHEyeSAtIHExeiAqIHEyejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiBjb252ZXJ0ZWQgaW4gcGxhY2UgdG8gYSB1bml0IHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHJlc3VsdCBvZiB0aGUgbm9ybWFsaXphdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuUXVhdCgwLCAwLCAwLCA1KTtcbiAgICAgKlxuICAgICAqIHYubm9ybWFsaXplKCk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIDAsIDAsIDAsIDFcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHZlY3RvciBub3JtYWxpemF0aW9uIGlzOiBcIiArIHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbm9ybWFsaXplKCkge1xuICAgICAgICBsZXQgbGVuID0gdGhpcy5sZW5ndGgoKTtcbiAgICAgICAgaWYgKGxlbiA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy54ID0gdGhpcy55ID0gdGhpcy56ID0gMDtcbiAgICAgICAgICAgIHRoaXMudyA9IDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZW4gPSAxIC8gbGVuO1xuICAgICAgICAgICAgdGhpcy54ICo9IGxlbjtcbiAgICAgICAgICAgIHRoaXMueSAqPSBsZW47XG4gICAgICAgICAgICB0aGlzLnogKj0gbGVuO1xuICAgICAgICAgICAgdGhpcy53ICo9IGxlbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uIHRvIHRoZSBzdXBwbGllZCBudW1lcmljYWwgdmFsdWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeCBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgeiBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgdyBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXQoMSwgMCwgMCwgMCk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIDEsIDAsIDAsIDBcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHZlY3RvciBzZXQgaXM6IFwiICsgcS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzZXQoeCwgeSwgeiwgdykge1xuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICB0aGlzLncgPSB3O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYSBxdWF0ZXJuaW9uIGZyb20gYW4gYW5ndWxhciByb3RhdGlvbiBhcm91bmQgYW4gYXhpcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gYXhpcyAtIFdvcmxkIHNwYWNlIGF4aXMgYXJvdW5kIHdoaWNoIHRvIHJvdGF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYW5nbGUgLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIHRoZSBnaXZlbiBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDkwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tQXhpc0FuZ2xlKGF4aXMsIGFuZ2xlKSB7XG4gICAgICAgIGFuZ2xlICo9IDAuNSAqIG1hdGguREVHX1RPX1JBRDtcblxuICAgICAgICBjb25zdCBzYSA9IE1hdGguc2luKGFuZ2xlKTtcbiAgICAgICAgY29uc3QgY2EgPSBNYXRoLmNvcyhhbmdsZSk7XG5cbiAgICAgICAgdGhpcy54ID0gc2EgKiBheGlzLng7XG4gICAgICAgIHRoaXMueSA9IHNhICogYXhpcy55O1xuICAgICAgICB0aGlzLnogPSBzYSAqIGF4aXMuejtcbiAgICAgICAgdGhpcy53ID0gY2E7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBFdWxlciBhbmdsZXMgc3BlY2lmaWVkIGluIFhZWiBvcmRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfFZlYzN9IGV4IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBYIGF4aXMgaW4gZGVncmVlcy4gSWYgZXggaXMgYSBWZWMzLCB0aGVcbiAgICAgKiB0aHJlZSBhbmdsZXMgd2lsbCBiZSByZWFkIGZyb20gaXQgaW5zdGVhZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2V5XSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWSBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtlel0gLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFogYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gZnJvbSAzIGV1bGVyIGFuZ2xlc1xuICAgICAqIGNvbnN0IHEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHEuc2V0RnJvbUV1bGVyQW5nbGVzKDQ1LCA5MCwgMTgwKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSB0aGUgc2FtZSBxdWF0ZXJuaW9uIGZyb20gYSB2ZWN0b3IgY29udGFpbmluZyB0aGUgc2FtZSAzIGV1bGVyIGFuZ2xlc1xuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMyg0NSwgOTAsIDE4MCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogci5zZXRGcm9tRXVsZXJBbmdsZXModik7XG4gICAgICovXG4gICAgc2V0RnJvbUV1bGVyQW5nbGVzKGV4LCBleSwgZXopIHtcbiAgICAgICAgaWYgKGV4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgY29uc3QgdmVjID0gZXg7XG4gICAgICAgICAgICBleCA9IHZlYy54O1xuICAgICAgICAgICAgZXkgPSB2ZWMueTtcbiAgICAgICAgICAgIGV6ID0gdmVjLno7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYWxmVG9SYWQgPSAwLjUgKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGV4ICo9IGhhbGZUb1JhZDtcbiAgICAgICAgZXkgKj0gaGFsZlRvUmFkO1xuICAgICAgICBleiAqPSBoYWxmVG9SYWQ7XG5cbiAgICAgICAgY29uc3Qgc3ggPSBNYXRoLnNpbihleCk7XG4gICAgICAgIGNvbnN0IGN4ID0gTWF0aC5jb3MoZXgpO1xuICAgICAgICBjb25zdCBzeSA9IE1hdGguc2luKGV5KTtcbiAgICAgICAgY29uc3QgY3kgPSBNYXRoLmNvcyhleSk7XG4gICAgICAgIGNvbnN0IHN6ID0gTWF0aC5zaW4oZXopO1xuICAgICAgICBjb25zdCBjeiA9IE1hdGguY29zKGV6KTtcblxuICAgICAgICB0aGlzLnggPSBzeCAqIGN5ICogY3ogLSBjeCAqIHN5ICogc3o7XG4gICAgICAgIHRoaXMueSA9IGN4ICogc3kgKiBjeiArIHN4ICogY3kgKiBzejtcbiAgICAgICAgdGhpcy56ID0gY3ggKiBjeSAqIHN6IC0gc3ggKiBzeSAqIGN6O1xuICAgICAgICB0aGlzLncgPSBjeCAqIGN5ICogY3ogKyBzeCAqIHN5ICogc3o7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4IHRvIGEgcXVhdGVybmlvbi4gTm90ZSB0aGF0IHNpbmNlIGEgcXVhdGVybmlvbiBpcyBwdXJlbHkgYVxuICAgICAqIHJlcHJlc2VudGF0aW9uIGZvciBvcmllbnRhdGlvbiwgb25seSB0aGUgdHJhbnNsYXRpb25hbCBwYXJ0IG9mIHRoZSBtYXRyaXggaXMgbG9zdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21hdDQuanMnKS5NYXQ0fSBtIC0gVGhlIDR4NCBtYXRyaXggdG8gY29udmVydC5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4IG9mIDE4MCBkZWdyZWVzIGFyb3VuZCB0aGUgeS1heGlzXG4gICAgICogY29uc3Qgcm90ID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBDb252ZXJ0IHRvIGEgcXVhdGVybmlvblxuICAgICAqIGNvbnN0IHEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21NYXQ0KHJvdCk7XG4gICAgICovXG4gICAgc2V0RnJvbU1hdDQobSkge1xuICAgICAgICBsZXQgbTAwLCBtMDEsIG0wMiwgbTEwLCBtMTEsIG0xMiwgbTIwLCBtMjEsIG0yMixcbiAgICAgICAgICAgIHMsIHJzLCBseCwgbHksIGx6O1xuXG4gICAgICAgIG0gPSBtLmRhdGE7XG5cbiAgICAgICAgLy8gQ2FjaGUgbWF0cml4IHZhbHVlcyBmb3Igc3VwZXItc3BlZWRcbiAgICAgICAgbTAwID0gbVswXTtcbiAgICAgICAgbTAxID0gbVsxXTtcbiAgICAgICAgbTAyID0gbVsyXTtcbiAgICAgICAgbTEwID0gbVs0XTtcbiAgICAgICAgbTExID0gbVs1XTtcbiAgICAgICAgbTEyID0gbVs2XTtcbiAgICAgICAgbTIwID0gbVs4XTtcbiAgICAgICAgbTIxID0gbVs5XTtcbiAgICAgICAgbTIyID0gbVsxMF07XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBzY2FsZSBmcm9tIHRoZSBtYXRyaXhcbiAgICAgICAgbHggPSBtMDAgKiBtMDAgKyBtMDEgKiBtMDEgKyBtMDIgKiBtMDI7XG4gICAgICAgIGlmIChseCA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICBseCA9IDEgLyBNYXRoLnNxcnQobHgpO1xuICAgICAgICBseSA9IG0xMCAqIG0xMCArIG0xMSAqIG0xMSArIG0xMiAqIG0xMjtcbiAgICAgICAgaWYgKGx5ID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGx5ID0gMSAvIE1hdGguc3FydChseSk7XG4gICAgICAgIGx6ID0gbTIwICogbTIwICsgbTIxICogbTIxICsgbTIyICogbTIyO1xuICAgICAgICBpZiAobHogPT09IDApXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgbHogPSAxIC8gTWF0aC5zcXJ0KGx6KTtcblxuICAgICAgICBtMDAgKj0gbHg7XG4gICAgICAgIG0wMSAqPSBseDtcbiAgICAgICAgbTAyICo9IGx4O1xuICAgICAgICBtMTAgKj0gbHk7XG4gICAgICAgIG0xMSAqPSBseTtcbiAgICAgICAgbTEyICo9IGx5O1xuICAgICAgICBtMjAgKj0gbHo7XG4gICAgICAgIG0yMSAqPSBsejtcbiAgICAgICAgbTIyICo9IGx6O1xuXG4gICAgICAgIC8vIGh0dHA6Ly93d3cuY3MudWNyLmVkdS9+dmJ6L3Jlc291cmNlcy9xdWF0dXQucGRmXG5cbiAgICAgICAgY29uc3QgdHIgPSBtMDAgKyBtMTEgKyBtMjI7XG4gICAgICAgIGlmICh0ciA+PSAwKSB7XG4gICAgICAgICAgICBzID0gTWF0aC5zcXJ0KHRyICsgMSk7XG4gICAgICAgICAgICB0aGlzLncgPSBzICogMC41O1xuICAgICAgICAgICAgcyA9IDAuNSAvIHM7XG4gICAgICAgICAgICB0aGlzLnggPSAobTEyIC0gbTIxKSAqIHM7XG4gICAgICAgICAgICB0aGlzLnkgPSAobTIwIC0gbTAyKSAqIHM7XG4gICAgICAgICAgICB0aGlzLnogPSAobTAxIC0gbTEwKSAqIHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAobTAwID4gbTExKSB7XG4gICAgICAgICAgICAgICAgaWYgKG0wMCA+IG0yMikge1xuICAgICAgICAgICAgICAgICAgICAvLyBYRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgICAgICBycyA9IChtMDAgLSAobTExICsgbTIyKSkgKyAxO1xuICAgICAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy54ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMTIgLSBtMjEpICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMDEgKyBtMTApICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueiA9IChtMDIgKyBtMjApICogcnM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gWkRpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICAgICAgcnMgPSAobTIyIC0gKG0wMCArIG0xMSkpICsgMTtcbiAgICAgICAgICAgICAgICAgICAgcnMgPSBNYXRoLnNxcnQocnMpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMueiA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgICAgICBycyA9IDAuNSAvIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLncgPSAobTAxIC0gbTEwKSAqIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnggPSAobTIwICsgbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnkgPSAobTIxICsgbTEyKSAqIHJzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAobTExID4gbTIyKSB7XG4gICAgICAgICAgICAgICAgLy8gWURpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICBycyA9IChtMTEgLSAobTIyICsgbTAwKSkgKyAxO1xuICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMueSA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gKG0yMCAtIG0wMikgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnogPSAobTEyICsgbTIxKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IChtMTAgKyBtMDEpICogcnM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFpEaWFnRG9tTWF0cml4XG4gICAgICAgICAgICAgICAgcnMgPSAobTIyIC0gKG0wMCArIG0xMSkpICsgMTtcbiAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnogPSBycyAqIDAuNTtcbiAgICAgICAgICAgICAgICBycyA9IDAuNSAvIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMDEgLSBtMTApICogcnM7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gKG0yMCArIG0wMikgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSAobTIxICsgbTEyKSAqIHJzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBxdWF0ZXJuaW9uIHRoYXQgcmVwcmVzZW50cyB0aGUgc2hvcnRlc3Qgcm90YXRpb24gZnJvbSBvbmUgZGlyZWN0aW9uIHRvIGFub3RoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGZyb20gLSBUaGUgZGlyZWN0aW9uIHRvIHJvdGF0ZSBmcm9tLiBJdCBzaG91bGQgYmUgbm9ybWFsaXplZC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHRvIC0gVGhlIGRpcmVjdGlvbiB0byByb3RhdGUgdG8uIEl0IHNob3VsZCBiZSBub3JtYWxpemVkLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKlxuICAgICAqIHtAbGluayBodHRwczovL3d3dy54YXJnLm9yZy9wcm9vZi9xdWF0ZXJuaW9uLWZyb20tdHdvLXZlY3RvcnMvIFByb29mIG9mIGNvcnJlY3RuZXNzfVxuICAgICAqL1xuICAgIHNldEZyb21EaXJlY3Rpb25zKGZyb20sIHRvKSB7XG4gICAgICAgIGNvbnN0IGRvdFByb2R1Y3QgPSAxICsgZnJvbS5kb3QodG8pO1xuXG4gICAgICAgIGlmIChkb3RQcm9kdWN0IDwgTnVtYmVyLkVQU0lMT04pIHtcbiAgICAgICAgICAgIC8vIHRoZSB2ZWN0b3JzIHBvaW50IGluIG9wcG9zaXRlIGRpcmVjdGlvbnNcbiAgICAgICAgICAgIC8vIHNvIHdlIG5lZWQgdG8gcm90YXRlIDE4MCBkZWdyZWVzIGFyb3VuZCBhbiBhcmJpdHJhcnkgb3J0aG9nb25hbCBheGlzXG4gICAgICAgICAgICBpZiAoTWF0aC5hYnMoZnJvbS54KSA+IE1hdGguYWJzKGZyb20ueSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnggPSAtZnJvbS56O1xuICAgICAgICAgICAgICAgIHRoaXMueSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy56ID0gZnJvbS54O1xuICAgICAgICAgICAgICAgIHRoaXMudyA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy55ID0gLWZyb20uejtcbiAgICAgICAgICAgICAgICB0aGlzLnogPSBmcm9tLnk7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNyb3NzIHByb2R1Y3QgYmV0d2VlbiB0aGUgdHdvIHZlY3RvcnNcbiAgICAgICAgICAgIHRoaXMueCA9IGZyb20ueSAqIHRvLnogLSBmcm9tLnogKiB0by55O1xuICAgICAgICAgICAgdGhpcy55ID0gZnJvbS56ICogdG8ueCAtIGZyb20ueCAqIHRvLno7XG4gICAgICAgICAgICB0aGlzLnogPSBmcm9tLnggKiB0by55IC0gZnJvbS55ICogdG8ueDtcbiAgICAgICAgICAgIHRoaXMudyA9IGRvdFByb2R1Y3Q7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5ub3JtYWxpemUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQZXJmb3JtcyBhIHNwaGVyaWNhbCBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdHdvIHF1YXRlcm5pb25zLiBUaGUgcmVzdWx0IG9mIHRoZSBpbnRlcnBvbGF0aW9uXG4gICAgICogaXMgd3JpdHRlbiB0byB0aGUgcXVhdGVybmlvbiBjYWxsaW5nIHRoZSBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gbGhzIC0gVGhlIHF1YXRlcm5pb24gdG8gaW50ZXJwb2xhdGUgZnJvbS5cbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGludGVycG9sYXRlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbHBoYSAtIFRoZSB2YWx1ZSBjb250cm9sbGluZyB0aGUgaW50ZXJwb2xhdGlvbiBpbiByZWxhdGlvbiB0byB0aGUgdHdvIGlucHV0XG4gICAgICogcXVhdGVybmlvbnMuIFRoZSB2YWx1ZSBpcyBpbiB0aGUgcmFuZ2UgMCB0byAxLCAwIGdlbmVyYXRpbmcgcTEsIDEgZ2VuZXJhdGluZyBxMiBhbmQgYW55dGhpbmdcbiAgICAgKiBpbiBiZXR3ZWVuIGdlbmVyYXRpbmcgYSBzcGhlcmljYWwgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHRoZSB0d28uXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcTEgPSBuZXcgcGMuUXVhdCgtMC4xMSwgLTAuMTUsIC0wLjQ2LCAwLjg3KTtcbiAgICAgKiBjb25zdCBxMiA9IG5ldyBwYy5RdWF0KC0wLjIxLCAtMC4yMSwgLTAuNjcsIDAuNjgpO1xuICAgICAqXG4gICAgICogY29uc3QgcmVzdWx0O1xuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAwKTsgICAvLyBSZXR1cm4gcTFcbiAgICAgKiByZXN1bHQgPSBuZXcgcGMuUXVhdCgpLnNsZXJwKHExLCBxMiwgMC41KTsgLy8gUmV0dXJuIHRoZSBtaWRwb2ludCBpbnRlcnBvbGFudFxuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAxKTsgICAvLyBSZXR1cm4gcTJcbiAgICAgKi9cbiAgICBzbGVycChsaHMsIHJocywgYWxwaGEpIHtcbiAgICAgICAgLy8gQWxnb3JpdGhtIHNvdXJjZWQgZnJvbTpcbiAgICAgICAgLy8gaHR0cDovL3d3dy5ldWNsaWRlYW5zcGFjZS5jb20vbWF0aHMvYWxnZWJyYS9yZWFsTm9ybWVkQWxnZWJyYS9xdWF0ZXJuaW9ucy9zbGVycC9cbiAgICAgICAgY29uc3QgbHggPSBsaHMueDtcbiAgICAgICAgY29uc3QgbHkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgbHogPSBsaHMuejtcbiAgICAgICAgY29uc3QgbHcgPSBsaHMudztcbiAgICAgICAgbGV0IHJ4ID0gcmhzLng7XG4gICAgICAgIGxldCByeSA9IHJocy55O1xuICAgICAgICBsZXQgcnogPSByaHMuejtcbiAgICAgICAgbGV0IHJ3ID0gcmhzLnc7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGFuZ2xlIGJldHdlZW4gdGhlbS5cbiAgICAgICAgbGV0IGNvc0hhbGZUaGV0YSA9IGx3ICogcncgKyBseCAqIHJ4ICsgbHkgKiByeSArIGx6ICogcno7XG5cbiAgICAgICAgaWYgKGNvc0hhbGZUaGV0YSA8IDApIHtcbiAgICAgICAgICAgIHJ3ID0gLXJ3O1xuICAgICAgICAgICAgcnggPSAtcng7XG4gICAgICAgICAgICByeSA9IC1yeTtcbiAgICAgICAgICAgIHJ6ID0gLXJ6O1xuICAgICAgICAgICAgY29zSGFsZlRoZXRhID0gLWNvc0hhbGZUaGV0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGxocyA9PSByaHMgb3IgbGhzID09IC1yaHMgdGhlbiB0aGV0YSA9PSAwIGFuZCB3ZSBjYW4gcmV0dXJuIGxoc1xuICAgICAgICBpZiAoTWF0aC5hYnMoY29zSGFsZlRoZXRhKSA+PSAxKSB7XG4gICAgICAgICAgICB0aGlzLncgPSBsdztcbiAgICAgICAgICAgIHRoaXMueCA9IGx4O1xuICAgICAgICAgICAgdGhpcy55ID0gbHk7XG4gICAgICAgICAgICB0aGlzLnogPSBsejtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIHRlbXBvcmFyeSB2YWx1ZXMuXG4gICAgICAgIGNvbnN0IGhhbGZUaGV0YSA9IE1hdGguYWNvcyhjb3NIYWxmVGhldGEpO1xuICAgICAgICBjb25zdCBzaW5IYWxmVGhldGEgPSBNYXRoLnNxcnQoMSAtIGNvc0hhbGZUaGV0YSAqIGNvc0hhbGZUaGV0YSk7XG5cbiAgICAgICAgLy8gSWYgdGhldGEgPSAxODAgZGVncmVlcyB0aGVuIHJlc3VsdCBpcyBub3QgZnVsbHkgZGVmaW5lZFxuICAgICAgICAvLyB3ZSBjb3VsZCByb3RhdGUgYXJvdW5kIGFueSBheGlzIG5vcm1hbCB0byBxYSBvciBxYlxuICAgICAgICBpZiAoTWF0aC5hYnMoc2luSGFsZlRoZXRhKSA8IDAuMDAxKSB7XG4gICAgICAgICAgICB0aGlzLncgPSAobHcgKiAwLjUgKyBydyAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnggPSAobHggKiAwLjUgKyByeCAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnkgPSAobHkgKiAwLjUgKyByeSAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnogPSAobHogKiAwLjUgKyByeiAqIDAuNSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJhdGlvQSA9IE1hdGguc2luKCgxIC0gYWxwaGEpICogaGFsZlRoZXRhKSAvIHNpbkhhbGZUaGV0YTtcbiAgICAgICAgY29uc3QgcmF0aW9CID0gTWF0aC5zaW4oYWxwaGEgKiBoYWxmVGhldGEpIC8gc2luSGFsZlRoZXRhO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBRdWF0ZXJuaW9uLlxuICAgICAgICB0aGlzLncgPSAobHcgKiByYXRpb0EgKyBydyAqIHJhdGlvQik7XG4gICAgICAgIHRoaXMueCA9IChseCAqIHJhdGlvQSArIHJ4ICogcmF0aW9CKTtcbiAgICAgICAgdGhpcy55ID0gKGx5ICogcmF0aW9BICsgcnkgKiByYXRpb0IpO1xuICAgICAgICB0aGlzLnogPSAobHogKiByYXRpb0EgKyByeiAqIHJhdGlvQik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBieSB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHZlYyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byBiZSB0cmFuc2Zvcm1lZC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtyZXNdIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgcmVzdWx0IG9mIHRoZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGlucHV0IHZlY3RvciB2IHRyYW5zZm9ybWVkIGJ5IHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3JcbiAgICAgKiBjb25zdCB2ID0gbmV3IHBjLlZlYzMoMSwgMiwgMyk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogY29uc3QgcSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqXG4gICAgICogY29uc3QgdHYgPSBxLnRyYW5zZm9ybVZlY3Rvcih2KTtcbiAgICAgKi9cbiAgICB0cmFuc2Zvcm1WZWN0b3IodmVjLCByZXMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGNvbnN0IHggPSB2ZWMueCwgeSA9IHZlYy55LCB6ID0gdmVjLno7XG4gICAgICAgIGNvbnN0IHF4ID0gdGhpcy54LCBxeSA9IHRoaXMueSwgcXogPSB0aGlzLnosIHF3ID0gdGhpcy53O1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBxdWF0ICogdmVjXG4gICAgICAgIGNvbnN0IGl4ID0gcXcgKiB4ICsgcXkgKiB6IC0gcXogKiB5O1xuICAgICAgICBjb25zdCBpeSA9IHF3ICogeSArIHF6ICogeCAtIHF4ICogejtcbiAgICAgICAgY29uc3QgaXogPSBxdyAqIHogKyBxeCAqIHkgLSBxeSAqIHg7XG4gICAgICAgIGNvbnN0IGl3ID0gLXF4ICogeCAtIHF5ICogeSAtIHF6ICogejtcblxuICAgICAgICAvLyBjYWxjdWxhdGUgcmVzdWx0ICogaW52ZXJzZSBxdWF0XG4gICAgICAgIHJlcy54ID0gaXggKiBxdyArIGl3ICogLXF4ICsgaXkgKiAtcXogLSBpeiAqIC1xeTtcbiAgICAgICAgcmVzLnkgPSBpeSAqIHF3ICsgaXcgKiAtcXkgKyBpeiAqIC1xeCAtIGl4ICogLXF6O1xuICAgICAgICByZXMueiA9IGl6ICogcXcgKyBpdyAqIC1xeiArIGl4ICogLXF5IC0gaXkgKiAtcXg7XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgcXVhdGVybmlvbiB0byBzdHJpbmcgZm9ybS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBxdWF0ZXJuaW9uIGluIHN0cmluZyBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgdiA9IG5ldyBwYy5RdWF0KDAsIDAsIDAsIDEpO1xuICAgICAqIC8vIE91dHB1dHMgWzAsIDAsIDAsIDFdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIGBbJHt0aGlzLnh9LCAke3RoaXMueX0sICR7dGhpcy56fSwgJHt0aGlzLnd9XWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCBxdWF0ZXJuaW9uIHNldCB0byBbMCwgMCwgMCwgMV0gKHRoZSBpZGVudGl0eSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgSURFTlRJVFkgPSBPYmplY3QuZnJlZXplKG5ldyBRdWF0KDAsIDAsIDAsIDEpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgcXVhdGVybmlvbiBzZXQgdG8gWzAsIDAsIDAsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFpFUk8gPSBPYmplY3QuZnJlZXplKG5ldyBRdWF0KDAsIDAsIDAsIDApKTtcbn1cblxuZXhwb3J0IHsgUXVhdCB9O1xuIl0sIm5hbWVzIjpbIlF1YXQiLCJjb25zdHJ1Y3RvciIsIngiLCJ5IiwieiIsInciLCJsZW5ndGgiLCJjbG9uZSIsImNzdHIiLCJjb25qdWdhdGUiLCJjb3B5IiwicmhzIiwiZXF1YWxzIiwiZXF1YWxzQXBwcm94IiwiZXBzaWxvbiIsIk1hdGgiLCJhYnMiLCJnZXRBeGlzQW5nbGUiLCJheGlzIiwicmFkIiwiYWNvcyIsInMiLCJzaW4iLCJtYXRoIiwiUkFEX1RPX0RFRyIsImdldEV1bGVyQW5nbGVzIiwiZXVsZXJzIiwiVmVjMyIsInF4IiwicXkiLCJxeiIsInF3IiwiYTIiLCJhdGFuMiIsIlBJIiwiYXNpbiIsInNldCIsIm11bFNjYWxhciIsImludmVydCIsIm5vcm1hbGl6ZSIsInNxcnQiLCJsZW5ndGhTcSIsIm11bCIsInExeCIsInExeSIsInExeiIsInExdyIsInEyeCIsInEyeSIsInEyeiIsInEydyIsIm11bDIiLCJsaHMiLCJsZW4iLCJzZXRGcm9tQXhpc0FuZ2xlIiwiYW5nbGUiLCJERUdfVE9fUkFEIiwic2EiLCJjYSIsImNvcyIsInNldEZyb21FdWxlckFuZ2xlcyIsImV4IiwiZXkiLCJleiIsInZlYyIsImhhbGZUb1JhZCIsInN4IiwiY3giLCJzeSIsImN5Iiwic3oiLCJjeiIsInNldEZyb21NYXQ0IiwibSIsIm0wMCIsIm0wMSIsIm0wMiIsIm0xMCIsIm0xMSIsIm0xMiIsIm0yMCIsIm0yMSIsIm0yMiIsInJzIiwibHgiLCJseSIsImx6IiwiZGF0YSIsInRyIiwic2V0RnJvbURpcmVjdGlvbnMiLCJmcm9tIiwidG8iLCJkb3RQcm9kdWN0IiwiZG90IiwiTnVtYmVyIiwiRVBTSUxPTiIsInNsZXJwIiwiYWxwaGEiLCJsdyIsInJ4IiwicnkiLCJyeiIsInJ3IiwiY29zSGFsZlRoZXRhIiwiaGFsZlRoZXRhIiwic2luSGFsZlRoZXRhIiwicmF0aW9BIiwicmF0aW9CIiwidHJhbnNmb3JtVmVjdG9yIiwicmVzIiwiaXgiLCJpeSIsIml6IiwiaXciLCJ0b1N0cmluZyIsIklERU5USVRZIiwiT2JqZWN0IiwiZnJlZXplIiwiWkVSTyJdLCJtYXBwaW5ncyI6Ijs7O0FBR0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsSUFBSSxDQUFDO0FBQ1A7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUFBLElBQUEsSUFBQSxDQWhDeENILENBQUMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9EQyxDQUFDLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPREMsQ0FBQyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT0RDLENBQUMsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQVlHLElBQUEsSUFBSUgsQ0FBQyxDQUFDSSxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ2hCLE1BQUEsSUFBSSxDQUFDSixDQUFDLEdBQUdBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNiLE1BQUEsSUFBSSxDQUFDQyxDQUFDLEdBQUdELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNiLE1BQUEsSUFBSSxDQUFDRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNiLE1BQUEsSUFBSSxDQUFDRyxDQUFDLEdBQUdILENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQixLQUFDLE1BQU07TUFDSCxJQUFJLENBQUNBLENBQUMsR0FBR0EsQ0FBQyxDQUFBO01BQ1YsSUFBSSxDQUFDQyxDQUFDLEdBQUdBLENBQUMsQ0FBQTtNQUNWLElBQUksQ0FBQ0MsQ0FBQyxHQUFHQSxDQUFDLENBQUE7TUFDVixJQUFJLENBQUNDLENBQUMsR0FBR0EsQ0FBQyxDQUFBO0FBQ2QsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUUsRUFBQUEsS0FBS0EsR0FBRztBQUNKO0FBQ0EsSUFBQSxNQUFNQyxJQUFJLEdBQUcsSUFBSSxDQUFDUCxXQUFXLENBQUE7QUFDN0IsSUFBQSxPQUFPLElBQUlPLElBQUksQ0FBQyxJQUFJLENBQUNOLENBQUMsRUFBRSxJQUFJLENBQUNDLENBQUMsRUFBRSxJQUFJLENBQUNDLENBQUMsRUFBRSxJQUFJLENBQUNDLENBQUMsQ0FBQyxDQUFBO0FBQ25ELEdBQUE7QUFFQUksRUFBQUEsU0FBU0EsR0FBRztBQUNSLElBQUEsSUFBSSxDQUFDUCxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDWixJQUFBLElBQUksQ0FBQ0MsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ1osSUFBQSxJQUFJLENBQUNDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUVaLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSU0sSUFBSUEsQ0FBQ0MsR0FBRyxFQUFFO0FBQ04sSUFBQSxJQUFJLENBQUNULENBQUMsR0FBR1MsR0FBRyxDQUFDVCxDQUFDLENBQUE7QUFDZCxJQUFBLElBQUksQ0FBQ0MsQ0FBQyxHQUFHUSxHQUFHLENBQUNSLENBQUMsQ0FBQTtBQUNkLElBQUEsSUFBSSxDQUFDQyxDQUFDLEdBQUdPLEdBQUcsQ0FBQ1AsQ0FBQyxDQUFBO0FBQ2QsSUFBQSxJQUFJLENBQUNDLENBQUMsR0FBR00sR0FBRyxDQUFDTixDQUFDLENBQUE7QUFFZCxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJTyxNQUFNQSxDQUFDRCxHQUFHLEVBQUU7QUFDUixJQUFBLE9BQVMsSUFBSSxDQUFDVCxDQUFDLEtBQUtTLEdBQUcsQ0FBQ1QsQ0FBQyxJQUFNLElBQUksQ0FBQ0MsQ0FBQyxLQUFLUSxHQUFHLENBQUNSLENBQUUsSUFBSyxJQUFJLENBQUNDLENBQUMsS0FBS08sR0FBRyxDQUFDUCxDQUFFLElBQUssSUFBSSxDQUFDQyxDQUFDLEtBQUtNLEdBQUcsQ0FBQ04sQ0FBRSxDQUFBO0FBQ2hHLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJUSxFQUFBQSxZQUFZQSxDQUFDRixHQUFHLEVBQUVHLE9BQU8sR0FBRyxJQUFJLEVBQUU7SUFDOUIsT0FBUUMsSUFBSSxDQUFDQyxHQUFHLENBQUMsSUFBSSxDQUFDZCxDQUFDLEdBQUdTLEdBQUcsQ0FBQ1QsQ0FBQyxDQUFDLEdBQUdZLE9BQU8sSUFDckNDLElBQUksQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ2IsQ0FBQyxHQUFHUSxHQUFHLENBQUNSLENBQUMsQ0FBQyxHQUFHVyxPQUFRLElBQ25DQyxJQUFJLENBQUNDLEdBQUcsQ0FBQyxJQUFJLENBQUNaLENBQUMsR0FBR08sR0FBRyxDQUFDUCxDQUFDLENBQUMsR0FBR1UsT0FBUSxJQUNuQ0MsSUFBSSxDQUFDQyxHQUFHLENBQUMsSUFBSSxDQUFDWCxDQUFDLEdBQUdNLEdBQUcsQ0FBQ04sQ0FBQyxDQUFDLEdBQUdTLE9BQVEsQ0FBQTtBQUM1QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUcsWUFBWUEsQ0FBQ0MsSUFBSSxFQUFFO0lBQ2YsSUFBSUMsR0FBRyxHQUFHSixJQUFJLENBQUNLLElBQUksQ0FBQyxJQUFJLENBQUNmLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtJQUMvQixNQUFNZ0IsQ0FBQyxHQUFHTixJQUFJLENBQUNPLEdBQUcsQ0FBQ0gsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFBO0lBQzNCLElBQUlFLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFDVEgsTUFBQUEsSUFBSSxDQUFDaEIsQ0FBQyxHQUFHLElBQUksQ0FBQ0EsQ0FBQyxHQUFHbUIsQ0FBQyxDQUFBO0FBQ25CSCxNQUFBQSxJQUFJLENBQUNmLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsR0FBR2tCLENBQUMsQ0FBQTtBQUNuQkgsTUFBQUEsSUFBSSxDQUFDZCxDQUFDLEdBQUcsSUFBSSxDQUFDQSxDQUFDLEdBQUdpQixDQUFDLENBQUE7QUFDbkIsTUFBQSxJQUFJSCxJQUFJLENBQUNoQixDQUFDLEdBQUcsQ0FBQyxJQUFJZ0IsSUFBSSxDQUFDZixDQUFDLEdBQUcsQ0FBQyxJQUFJZSxJQUFJLENBQUNkLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDeEM7QUFDQWMsUUFBQUEsSUFBSSxDQUFDaEIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ1pnQixRQUFBQSxJQUFJLENBQUNmLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUNaZSxRQUFBQSxJQUFJLENBQUNkLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtRQUNaZSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDYixPQUFBO0FBQ0osS0FBQyxNQUFNO0FBQ0g7TUFDQUQsSUFBSSxDQUFDaEIsQ0FBQyxHQUFHLENBQUMsQ0FBQTtNQUNWZ0IsSUFBSSxDQUFDZixDQUFDLEdBQUcsQ0FBQyxDQUFBO01BQ1ZlLElBQUksQ0FBQ2QsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNkLEtBQUE7QUFDQSxJQUFBLE9BQU9lLEdBQUcsR0FBR0ksSUFBSSxDQUFDQyxVQUFVLENBQUE7QUFDaEMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxjQUFjQSxDQUFDQyxNQUFNLEdBQUcsSUFBSUMsSUFBSSxFQUFFLEVBQUU7QUFDaEMsSUFBQSxJQUFJekIsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsQ0FBQTtBQUVYLElBQUEsTUFBTXdCLEVBQUUsR0FBRyxJQUFJLENBQUMxQixDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNMkIsRUFBRSxHQUFHLElBQUksQ0FBQzFCLENBQUMsQ0FBQTtBQUNqQixJQUFBLE1BQU0yQixFQUFFLEdBQUcsSUFBSSxDQUFDMUIsQ0FBQyxDQUFBO0FBQ2pCLElBQUEsTUFBTTJCLEVBQUUsR0FBRyxJQUFJLENBQUMxQixDQUFDLENBQUE7SUFFakIsTUFBTTJCLEVBQUUsR0FBRyxDQUFDLElBQUlELEVBQUUsR0FBR0YsRUFBRSxHQUFHRCxFQUFFLEdBQUdFLEVBQUUsQ0FBQyxDQUFBO0FBRWxDLElBQUEsSUFBSUUsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFO01BQ2hCOUIsQ0FBQyxHQUFHLENBQUMsR0FBR2EsSUFBSSxDQUFDa0IsS0FBSyxDQUFDTCxFQUFFLEVBQUVHLEVBQUUsQ0FBQyxDQUFBO0FBQzFCNUIsTUFBQUEsQ0FBQyxHQUFHLENBQUNZLElBQUksQ0FBQ21CLEVBQUUsR0FBRyxDQUFDLENBQUE7QUFDaEI5QixNQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1QsS0FBQyxNQUFNLElBQUk0QixFQUFFLElBQUksT0FBTyxFQUFFO01BQ3RCOUIsQ0FBQyxHQUFHLENBQUMsR0FBR2EsSUFBSSxDQUFDa0IsS0FBSyxDQUFDTCxFQUFFLEVBQUVHLEVBQUUsQ0FBQyxDQUFBO0FBQzFCNUIsTUFBQUEsQ0FBQyxHQUFHWSxJQUFJLENBQUNtQixFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ2Y5QixNQUFBQSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1QsS0FBQyxNQUFNO0FBQ0hGLE1BQUFBLENBQUMsR0FBR2EsSUFBSSxDQUFDa0IsS0FBSyxDQUFDLENBQUMsSUFBSUYsRUFBRSxHQUFHSCxFQUFFLEdBQUdDLEVBQUUsR0FBR0MsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSUYsRUFBRSxHQUFHQSxFQUFFLEdBQUdDLEVBQUUsR0FBR0EsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNwRTFCLE1BQUFBLENBQUMsR0FBR1ksSUFBSSxDQUFDb0IsSUFBSSxDQUFDSCxFQUFFLENBQUMsQ0FBQTtBQUNqQjVCLE1BQUFBLENBQUMsR0FBR1csSUFBSSxDQUFDa0IsS0FBSyxDQUFDLENBQUMsSUFBSUYsRUFBRSxHQUFHRCxFQUFFLEdBQUdGLEVBQUUsR0FBR0MsRUFBRSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSUEsRUFBRSxHQUFHQSxFQUFFLEdBQUdDLEVBQUUsR0FBR0EsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUN4RSxLQUFBO0FBRUEsSUFBQSxPQUFPSixNQUFNLENBQUNVLEdBQUcsQ0FBQ2xDLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLENBQUMsQ0FBQ2lDLFNBQVMsQ0FBQ2QsSUFBSSxDQUFDQyxVQUFVLENBQUMsQ0FBQTtBQUN6RCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWMsRUFBQUEsTUFBTUEsR0FBRztBQUNMLElBQUEsT0FBTyxJQUFJLENBQUM3QixTQUFTLEVBQUUsQ0FBQzhCLFNBQVMsRUFBRSxDQUFBO0FBQ3ZDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWpDLEVBQUFBLE1BQU1BLEdBQUc7QUFDTCxJQUFBLE9BQU9TLElBQUksQ0FBQ3lCLElBQUksQ0FBQyxJQUFJLENBQUN0QyxDQUFDLEdBQUcsSUFBSSxDQUFDQSxDQUFDLEdBQUcsSUFBSSxDQUFDQyxDQUFDLEdBQUcsSUFBSSxDQUFDQSxDQUFDLEdBQUcsSUFBSSxDQUFDQyxDQUFDLEdBQUcsSUFBSSxDQUFDQSxDQUFDLEdBQUcsSUFBSSxDQUFDQyxDQUFDLEdBQUcsSUFBSSxDQUFDQSxDQUFDLENBQUMsQ0FBQTtBQUMzRixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lvQyxFQUFBQSxRQUFRQSxHQUFHO0FBQ1AsSUFBQSxPQUFPLElBQUksQ0FBQ3ZDLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsR0FBRyxJQUFJLENBQUNDLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsR0FBRyxJQUFJLENBQUNDLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsR0FBRyxJQUFJLENBQUNDLENBQUMsR0FBRyxJQUFJLENBQUNBLENBQUMsQ0FBQTtBQUNoRixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJcUMsR0FBR0EsQ0FBQy9CLEdBQUcsRUFBRTtBQUNMLElBQUEsTUFBTWdDLEdBQUcsR0FBRyxJQUFJLENBQUN6QyxDQUFDLENBQUE7QUFDbEIsSUFBQSxNQUFNMEMsR0FBRyxHQUFHLElBQUksQ0FBQ3pDLENBQUMsQ0FBQTtBQUNsQixJQUFBLE1BQU0wQyxHQUFHLEdBQUcsSUFBSSxDQUFDekMsQ0FBQyxDQUFBO0FBQ2xCLElBQUEsTUFBTTBDLEdBQUcsR0FBRyxJQUFJLENBQUN6QyxDQUFDLENBQUE7QUFFbEIsSUFBQSxNQUFNMEMsR0FBRyxHQUFHcEMsR0FBRyxDQUFDVCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNOEMsR0FBRyxHQUFHckMsR0FBRyxDQUFDUixDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNOEMsR0FBRyxHQUFHdEMsR0FBRyxDQUFDUCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNOEMsR0FBRyxHQUFHdkMsR0FBRyxDQUFDTixDQUFDLENBQUE7QUFFakIsSUFBQSxJQUFJLENBQUNILENBQUMsR0FBRzRDLEdBQUcsR0FBR0MsR0FBRyxHQUFHSixHQUFHLEdBQUdPLEdBQUcsR0FBR04sR0FBRyxHQUFHSyxHQUFHLEdBQUdKLEdBQUcsR0FBR0csR0FBRyxDQUFBO0FBQ3RELElBQUEsSUFBSSxDQUFDN0MsQ0FBQyxHQUFHMkMsR0FBRyxHQUFHRSxHQUFHLEdBQUdKLEdBQUcsR0FBR00sR0FBRyxHQUFHTCxHQUFHLEdBQUdFLEdBQUcsR0FBR0osR0FBRyxHQUFHTSxHQUFHLENBQUE7QUFDdEQsSUFBQSxJQUFJLENBQUM3QyxDQUFDLEdBQUcwQyxHQUFHLEdBQUdHLEdBQUcsR0FBR0osR0FBRyxHQUFHSyxHQUFHLEdBQUdQLEdBQUcsR0FBR0ssR0FBRyxHQUFHSixHQUFHLEdBQUdHLEdBQUcsQ0FBQTtBQUN0RCxJQUFBLElBQUksQ0FBQzFDLENBQUMsR0FBR3lDLEdBQUcsR0FBR0ksR0FBRyxHQUFHUCxHQUFHLEdBQUdJLEdBQUcsR0FBR0gsR0FBRyxHQUFHSSxHQUFHLEdBQUdILEdBQUcsR0FBR0ksR0FBRyxDQUFBO0FBRXRELElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUUsRUFBQUEsSUFBSUEsQ0FBQ0MsR0FBRyxFQUFFekMsR0FBRyxFQUFFO0FBQ1gsSUFBQSxNQUFNZ0MsR0FBRyxHQUFHUyxHQUFHLENBQUNsRCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNMEMsR0FBRyxHQUFHUSxHQUFHLENBQUNqRCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNMEMsR0FBRyxHQUFHTyxHQUFHLENBQUNoRCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNMEMsR0FBRyxHQUFHTSxHQUFHLENBQUMvQyxDQUFDLENBQUE7QUFFakIsSUFBQSxNQUFNMEMsR0FBRyxHQUFHcEMsR0FBRyxDQUFDVCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNOEMsR0FBRyxHQUFHckMsR0FBRyxDQUFDUixDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNOEMsR0FBRyxHQUFHdEMsR0FBRyxDQUFDUCxDQUFDLENBQUE7QUFDakIsSUFBQSxNQUFNOEMsR0FBRyxHQUFHdkMsR0FBRyxDQUFDTixDQUFDLENBQUE7QUFFakIsSUFBQSxJQUFJLENBQUNILENBQUMsR0FBRzRDLEdBQUcsR0FBR0MsR0FBRyxHQUFHSixHQUFHLEdBQUdPLEdBQUcsR0FBR04sR0FBRyxHQUFHSyxHQUFHLEdBQUdKLEdBQUcsR0FBR0csR0FBRyxDQUFBO0FBQ3RELElBQUEsSUFBSSxDQUFDN0MsQ0FBQyxHQUFHMkMsR0FBRyxHQUFHRSxHQUFHLEdBQUdKLEdBQUcsR0FBR00sR0FBRyxHQUFHTCxHQUFHLEdBQUdFLEdBQUcsR0FBR0osR0FBRyxHQUFHTSxHQUFHLENBQUE7QUFDdEQsSUFBQSxJQUFJLENBQUM3QyxDQUFDLEdBQUcwQyxHQUFHLEdBQUdHLEdBQUcsR0FBR0osR0FBRyxHQUFHSyxHQUFHLEdBQUdQLEdBQUcsR0FBR0ssR0FBRyxHQUFHSixHQUFHLEdBQUdHLEdBQUcsQ0FBQTtBQUN0RCxJQUFBLElBQUksQ0FBQzFDLENBQUMsR0FBR3lDLEdBQUcsR0FBR0ksR0FBRyxHQUFHUCxHQUFHLEdBQUdJLEdBQUcsR0FBR0gsR0FBRyxHQUFHSSxHQUFHLEdBQUdILEdBQUcsR0FBR0ksR0FBRyxDQUFBO0FBRXRELElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJVixFQUFBQSxTQUFTQSxHQUFHO0FBQ1IsSUFBQSxJQUFJYyxHQUFHLEdBQUcsSUFBSSxDQUFDL0MsTUFBTSxFQUFFLENBQUE7SUFDdkIsSUFBSStDLEdBQUcsS0FBSyxDQUFDLEVBQUU7TUFDWCxJQUFJLENBQUNuRCxDQUFDLEdBQUcsSUFBSSxDQUFDQyxDQUFDLEdBQUcsSUFBSSxDQUFDQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO01BQzVCLElBQUksQ0FBQ0MsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNkLEtBQUMsTUFBTTtNQUNIZ0QsR0FBRyxHQUFHLENBQUMsR0FBR0EsR0FBRyxDQUFBO01BQ2IsSUFBSSxDQUFDbkQsQ0FBQyxJQUFJbUQsR0FBRyxDQUFBO01BQ2IsSUFBSSxDQUFDbEQsQ0FBQyxJQUFJa0QsR0FBRyxDQUFBO01BQ2IsSUFBSSxDQUFDakQsQ0FBQyxJQUFJaUQsR0FBRyxDQUFBO01BQ2IsSUFBSSxDQUFDaEQsQ0FBQyxJQUFJZ0QsR0FBRyxDQUFBO0FBQ2pCLEtBQUE7QUFFQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSWpCLEdBQUdBLENBQUNsQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7SUFDWixJQUFJLENBQUNILENBQUMsR0FBR0EsQ0FBQyxDQUFBO0lBQ1YsSUFBSSxDQUFDQyxDQUFDLEdBQUdBLENBQUMsQ0FBQTtJQUNWLElBQUksQ0FBQ0MsQ0FBQyxHQUFHQSxDQUFDLENBQUE7SUFDVixJQUFJLENBQUNDLENBQUMsR0FBR0EsQ0FBQyxDQUFBO0FBRVYsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWlELEVBQUFBLGdCQUFnQkEsQ0FBQ3BDLElBQUksRUFBRXFDLEtBQUssRUFBRTtBQUMxQkEsSUFBQUEsS0FBSyxJQUFJLEdBQUcsR0FBR2hDLElBQUksQ0FBQ2lDLFVBQVUsQ0FBQTtBQUU5QixJQUFBLE1BQU1DLEVBQUUsR0FBRzFDLElBQUksQ0FBQ08sR0FBRyxDQUFDaUMsS0FBSyxDQUFDLENBQUE7QUFDMUIsSUFBQSxNQUFNRyxFQUFFLEdBQUczQyxJQUFJLENBQUM0QyxHQUFHLENBQUNKLEtBQUssQ0FBQyxDQUFBO0FBRTFCLElBQUEsSUFBSSxDQUFDckQsQ0FBQyxHQUFHdUQsRUFBRSxHQUFHdkMsSUFBSSxDQUFDaEIsQ0FBQyxDQUFBO0FBQ3BCLElBQUEsSUFBSSxDQUFDQyxDQUFDLEdBQUdzRCxFQUFFLEdBQUd2QyxJQUFJLENBQUNmLENBQUMsQ0FBQTtBQUNwQixJQUFBLElBQUksQ0FBQ0MsQ0FBQyxHQUFHcUQsRUFBRSxHQUFHdkMsSUFBSSxDQUFDZCxDQUFDLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxDQUFDLEdBQUdxRCxFQUFFLENBQUE7QUFFWCxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUUsRUFBQUEsa0JBQWtCQSxDQUFDQyxFQUFFLEVBQUVDLEVBQUUsRUFBRUMsRUFBRSxFQUFFO0lBQzNCLElBQUlGLEVBQUUsWUFBWWxDLElBQUksRUFBRTtNQUNwQixNQUFNcUMsR0FBRyxHQUFHSCxFQUFFLENBQUE7TUFDZEEsRUFBRSxHQUFHRyxHQUFHLENBQUM5RCxDQUFDLENBQUE7TUFDVjRELEVBQUUsR0FBR0UsR0FBRyxDQUFDN0QsQ0FBQyxDQUFBO01BQ1Y0RCxFQUFFLEdBQUdDLEdBQUcsQ0FBQzVELENBQUMsQ0FBQTtBQUNkLEtBQUE7QUFFQSxJQUFBLE1BQU02RCxTQUFTLEdBQUcsR0FBRyxHQUFHMUMsSUFBSSxDQUFDaUMsVUFBVSxDQUFBO0FBQ3ZDSyxJQUFBQSxFQUFFLElBQUlJLFNBQVMsQ0FBQTtBQUNmSCxJQUFBQSxFQUFFLElBQUlHLFNBQVMsQ0FBQTtBQUNmRixJQUFBQSxFQUFFLElBQUlFLFNBQVMsQ0FBQTtBQUVmLElBQUEsTUFBTUMsRUFBRSxHQUFHbkQsSUFBSSxDQUFDTyxHQUFHLENBQUN1QyxFQUFFLENBQUMsQ0FBQTtBQUN2QixJQUFBLE1BQU1NLEVBQUUsR0FBR3BELElBQUksQ0FBQzRDLEdBQUcsQ0FBQ0UsRUFBRSxDQUFDLENBQUE7QUFDdkIsSUFBQSxNQUFNTyxFQUFFLEdBQUdyRCxJQUFJLENBQUNPLEdBQUcsQ0FBQ3dDLEVBQUUsQ0FBQyxDQUFBO0FBQ3ZCLElBQUEsTUFBTU8sRUFBRSxHQUFHdEQsSUFBSSxDQUFDNEMsR0FBRyxDQUFDRyxFQUFFLENBQUMsQ0FBQTtBQUN2QixJQUFBLE1BQU1RLEVBQUUsR0FBR3ZELElBQUksQ0FBQ08sR0FBRyxDQUFDeUMsRUFBRSxDQUFDLENBQUE7QUFDdkIsSUFBQSxNQUFNUSxFQUFFLEdBQUd4RCxJQUFJLENBQUM0QyxHQUFHLENBQUNJLEVBQUUsQ0FBQyxDQUFBO0FBRXZCLElBQUEsSUFBSSxDQUFDN0QsQ0FBQyxHQUFHZ0UsRUFBRSxHQUFHRyxFQUFFLEdBQUdFLEVBQUUsR0FBR0osRUFBRSxHQUFHQyxFQUFFLEdBQUdFLEVBQUUsQ0FBQTtBQUNwQyxJQUFBLElBQUksQ0FBQ25FLENBQUMsR0FBR2dFLEVBQUUsR0FBR0MsRUFBRSxHQUFHRyxFQUFFLEdBQUdMLEVBQUUsR0FBR0csRUFBRSxHQUFHQyxFQUFFLENBQUE7QUFDcEMsSUFBQSxJQUFJLENBQUNsRSxDQUFDLEdBQUcrRCxFQUFFLEdBQUdFLEVBQUUsR0FBR0MsRUFBRSxHQUFHSixFQUFFLEdBQUdFLEVBQUUsR0FBR0csRUFBRSxDQUFBO0FBQ3BDLElBQUEsSUFBSSxDQUFDbEUsQ0FBQyxHQUFHOEQsRUFBRSxHQUFHRSxFQUFFLEdBQUdFLEVBQUUsR0FBR0wsRUFBRSxHQUFHRSxFQUFFLEdBQUdFLEVBQUUsQ0FBQTtBQUVwQyxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJRSxXQUFXQSxDQUFDQyxDQUFDLEVBQUU7SUFDWCxJQUFJQyxHQUFHLEVBQUVDLEdBQUcsRUFBRUMsR0FBRyxFQUFFQyxHQUFHLEVBQUVDLEdBQUcsRUFBRUMsR0FBRyxFQUFFQyxHQUFHLEVBQUVDLEdBQUcsRUFBRUMsR0FBRyxFQUMzQzdELENBQUMsRUFBRThELEVBQUUsRUFBRUMsRUFBRSxFQUFFQyxFQUFFLEVBQUVDLEVBQUUsQ0FBQTtJQUVyQmIsQ0FBQyxHQUFHQSxDQUFDLENBQUNjLElBQUksQ0FBQTs7QUFFVjtBQUNBYixJQUFBQSxHQUFHLEdBQUdELENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNWRSxJQUFBQSxHQUFHLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNWRyxJQUFBQSxHQUFHLEdBQUdILENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNWSSxJQUFBQSxHQUFHLEdBQUdKLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNWSyxJQUFBQSxHQUFHLEdBQUdMLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNWTSxJQUFBQSxHQUFHLEdBQUdOLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNWTyxJQUFBQSxHQUFHLEdBQUdQLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNWUSxJQUFBQSxHQUFHLEdBQUdSLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNWUyxJQUFBQSxHQUFHLEdBQUdULENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQTs7QUFFWDtJQUNBVyxFQUFFLEdBQUdWLEdBQUcsR0FBR0EsR0FBRyxHQUFHQyxHQUFHLEdBQUdBLEdBQUcsR0FBR0MsR0FBRyxHQUFHQSxHQUFHLENBQUE7QUFDdEMsSUFBQSxJQUFJUSxFQUFFLEtBQUssQ0FBQyxFQUNSLE9BQU8sSUFBSSxDQUFBO0lBQ2ZBLEVBQUUsR0FBRyxDQUFDLEdBQUdyRSxJQUFJLENBQUN5QixJQUFJLENBQUM0QyxFQUFFLENBQUMsQ0FBQTtJQUN0QkMsRUFBRSxHQUFHUixHQUFHLEdBQUdBLEdBQUcsR0FBR0MsR0FBRyxHQUFHQSxHQUFHLEdBQUdDLEdBQUcsR0FBR0EsR0FBRyxDQUFBO0FBQ3RDLElBQUEsSUFBSU0sRUFBRSxLQUFLLENBQUMsRUFDUixPQUFPLElBQUksQ0FBQTtJQUNmQSxFQUFFLEdBQUcsQ0FBQyxHQUFHdEUsSUFBSSxDQUFDeUIsSUFBSSxDQUFDNkMsRUFBRSxDQUFDLENBQUE7SUFDdEJDLEVBQUUsR0FBR04sR0FBRyxHQUFHQSxHQUFHLEdBQUdDLEdBQUcsR0FBR0EsR0FBRyxHQUFHQyxHQUFHLEdBQUdBLEdBQUcsQ0FBQTtBQUN0QyxJQUFBLElBQUlJLEVBQUUsS0FBSyxDQUFDLEVBQ1IsT0FBTyxJQUFJLENBQUE7SUFDZkEsRUFBRSxHQUFHLENBQUMsR0FBR3ZFLElBQUksQ0FBQ3lCLElBQUksQ0FBQzhDLEVBQUUsQ0FBQyxDQUFBO0FBRXRCWixJQUFBQSxHQUFHLElBQUlVLEVBQUUsQ0FBQTtBQUNUVCxJQUFBQSxHQUFHLElBQUlTLEVBQUUsQ0FBQTtBQUNUUixJQUFBQSxHQUFHLElBQUlRLEVBQUUsQ0FBQTtBQUNUUCxJQUFBQSxHQUFHLElBQUlRLEVBQUUsQ0FBQTtBQUNUUCxJQUFBQSxHQUFHLElBQUlPLEVBQUUsQ0FBQTtBQUNUTixJQUFBQSxHQUFHLElBQUlNLEVBQUUsQ0FBQTtBQUNUTCxJQUFBQSxHQUFHLElBQUlNLEVBQUUsQ0FBQTtBQUNUTCxJQUFBQSxHQUFHLElBQUlLLEVBQUUsQ0FBQTtBQUNUSixJQUFBQSxHQUFHLElBQUlJLEVBQUUsQ0FBQTs7QUFFVDs7QUFFQSxJQUFBLE1BQU1FLEVBQUUsR0FBR2QsR0FBRyxHQUFHSSxHQUFHLEdBQUdJLEdBQUcsQ0FBQTtJQUMxQixJQUFJTSxFQUFFLElBQUksQ0FBQyxFQUFFO01BQ1RuRSxDQUFDLEdBQUdOLElBQUksQ0FBQ3lCLElBQUksQ0FBQ2dELEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUNyQixNQUFBLElBQUksQ0FBQ25GLENBQUMsR0FBR2dCLENBQUMsR0FBRyxHQUFHLENBQUE7TUFDaEJBLENBQUMsR0FBRyxHQUFHLEdBQUdBLENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQ25CLENBQUMsR0FBRyxDQUFDNkUsR0FBRyxHQUFHRSxHQUFHLElBQUk1RCxDQUFDLENBQUE7TUFDeEIsSUFBSSxDQUFDbEIsQ0FBQyxHQUFHLENBQUM2RSxHQUFHLEdBQUdKLEdBQUcsSUFBSXZELENBQUMsQ0FBQTtNQUN4QixJQUFJLENBQUNqQixDQUFDLEdBQUcsQ0FBQ3VFLEdBQUcsR0FBR0UsR0FBRyxJQUFJeEQsQ0FBQyxDQUFBO0FBQzVCLEtBQUMsTUFBTTtNQUNILElBQUlxRCxHQUFHLEdBQUdJLEdBQUcsRUFBRTtRQUNYLElBQUlKLEdBQUcsR0FBR1EsR0FBRyxFQUFFO0FBQ1g7VUFDQUMsRUFBRSxHQUFJVCxHQUFHLElBQUlJLEdBQUcsR0FBR0ksR0FBRyxDQUFDLEdBQUksQ0FBQyxDQUFBO0FBQzVCQyxVQUFBQSxFQUFFLEdBQUdwRSxJQUFJLENBQUN5QixJQUFJLENBQUMyQyxFQUFFLENBQUMsQ0FBQTtBQUVsQixVQUFBLElBQUksQ0FBQ2pGLENBQUMsR0FBR2lGLEVBQUUsR0FBRyxHQUFHLENBQUE7VUFDakJBLEVBQUUsR0FBRyxHQUFHLEdBQUdBLEVBQUUsQ0FBQTtVQUNiLElBQUksQ0FBQzlFLENBQUMsR0FBRyxDQUFDMEUsR0FBRyxHQUFHRSxHQUFHLElBQUlFLEVBQUUsQ0FBQTtVQUN6QixJQUFJLENBQUNoRixDQUFDLEdBQUcsQ0FBQ3dFLEdBQUcsR0FBR0UsR0FBRyxJQUFJTSxFQUFFLENBQUE7VUFDekIsSUFBSSxDQUFDL0UsQ0FBQyxHQUFHLENBQUN3RSxHQUFHLEdBQUdJLEdBQUcsSUFBSUcsRUFBRSxDQUFBO0FBQzdCLFNBQUMsTUFBTTtBQUNIO1VBQ0FBLEVBQUUsR0FBSUQsR0FBRyxJQUFJUixHQUFHLEdBQUdJLEdBQUcsQ0FBQyxHQUFJLENBQUMsQ0FBQTtBQUM1QkssVUFBQUEsRUFBRSxHQUFHcEUsSUFBSSxDQUFDeUIsSUFBSSxDQUFDMkMsRUFBRSxDQUFDLENBQUE7QUFFbEIsVUFBQSxJQUFJLENBQUMvRSxDQUFDLEdBQUcrRSxFQUFFLEdBQUcsR0FBRyxDQUFBO1VBQ2pCQSxFQUFFLEdBQUcsR0FBRyxHQUFHQSxFQUFFLENBQUE7VUFDYixJQUFJLENBQUM5RSxDQUFDLEdBQUcsQ0FBQ3NFLEdBQUcsR0FBR0UsR0FBRyxJQUFJTSxFQUFFLENBQUE7VUFDekIsSUFBSSxDQUFDakYsQ0FBQyxHQUFHLENBQUM4RSxHQUFHLEdBQUdKLEdBQUcsSUFBSU8sRUFBRSxDQUFBO1VBQ3pCLElBQUksQ0FBQ2hGLENBQUMsR0FBRyxDQUFDOEUsR0FBRyxHQUFHRixHQUFHLElBQUlJLEVBQUUsQ0FBQTtBQUM3QixTQUFBO0FBQ0osT0FBQyxNQUFNLElBQUlMLEdBQUcsR0FBR0ksR0FBRyxFQUFFO0FBQ2xCO1FBQ0FDLEVBQUUsR0FBSUwsR0FBRyxJQUFJSSxHQUFHLEdBQUdSLEdBQUcsQ0FBQyxHQUFJLENBQUMsQ0FBQTtBQUM1QlMsUUFBQUEsRUFBRSxHQUFHcEUsSUFBSSxDQUFDeUIsSUFBSSxDQUFDMkMsRUFBRSxDQUFDLENBQUE7QUFFbEIsUUFBQSxJQUFJLENBQUNoRixDQUFDLEdBQUdnRixFQUFFLEdBQUcsR0FBRyxDQUFBO1FBQ2pCQSxFQUFFLEdBQUcsR0FBRyxHQUFHQSxFQUFFLENBQUE7UUFDYixJQUFJLENBQUM5RSxDQUFDLEdBQUcsQ0FBQzJFLEdBQUcsR0FBR0osR0FBRyxJQUFJTyxFQUFFLENBQUE7UUFDekIsSUFBSSxDQUFDL0UsQ0FBQyxHQUFHLENBQUMyRSxHQUFHLEdBQUdFLEdBQUcsSUFBSUUsRUFBRSxDQUFBO1FBQ3pCLElBQUksQ0FBQ2pGLENBQUMsR0FBRyxDQUFDMkUsR0FBRyxHQUFHRixHQUFHLElBQUlRLEVBQUUsQ0FBQTtBQUM3QixPQUFDLE1BQU07QUFDSDtRQUNBQSxFQUFFLEdBQUlELEdBQUcsSUFBSVIsR0FBRyxHQUFHSSxHQUFHLENBQUMsR0FBSSxDQUFDLENBQUE7QUFDNUJLLFFBQUFBLEVBQUUsR0FBR3BFLElBQUksQ0FBQ3lCLElBQUksQ0FBQzJDLEVBQUUsQ0FBQyxDQUFBO0FBRWxCLFFBQUEsSUFBSSxDQUFDL0UsQ0FBQyxHQUFHK0UsRUFBRSxHQUFHLEdBQUcsQ0FBQTtRQUNqQkEsRUFBRSxHQUFHLEdBQUcsR0FBR0EsRUFBRSxDQUFBO1FBQ2IsSUFBSSxDQUFDOUUsQ0FBQyxHQUFHLENBQUNzRSxHQUFHLEdBQUdFLEdBQUcsSUFBSU0sRUFBRSxDQUFBO1FBQ3pCLElBQUksQ0FBQ2pGLENBQUMsR0FBRyxDQUFDOEUsR0FBRyxHQUFHSixHQUFHLElBQUlPLEVBQUUsQ0FBQTtRQUN6QixJQUFJLENBQUNoRixDQUFDLEdBQUcsQ0FBQzhFLEdBQUcsR0FBR0YsR0FBRyxJQUFJSSxFQUFFLENBQUE7QUFDN0IsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSU0sRUFBQUEsaUJBQWlCQSxDQUFDQyxJQUFJLEVBQUVDLEVBQUUsRUFBRTtJQUN4QixNQUFNQyxVQUFVLEdBQUcsQ0FBQyxHQUFHRixJQUFJLENBQUNHLEdBQUcsQ0FBQ0YsRUFBRSxDQUFDLENBQUE7QUFFbkMsSUFBQSxJQUFJQyxVQUFVLEdBQUdFLE1BQU0sQ0FBQ0MsT0FBTyxFQUFFO0FBQzdCO0FBQ0E7QUFDQSxNQUFBLElBQUloRixJQUFJLENBQUNDLEdBQUcsQ0FBQzBFLElBQUksQ0FBQ3hGLENBQUMsQ0FBQyxHQUFHYSxJQUFJLENBQUNDLEdBQUcsQ0FBQzBFLElBQUksQ0FBQ3ZGLENBQUMsQ0FBQyxFQUFFO0FBQ3JDLFFBQUEsSUFBSSxDQUFDRCxDQUFDLEdBQUcsQ0FBQ3dGLElBQUksQ0FBQ3RGLENBQUMsQ0FBQTtRQUNoQixJQUFJLENBQUNELENBQUMsR0FBRyxDQUFDLENBQUE7QUFDVixRQUFBLElBQUksQ0FBQ0MsQ0FBQyxHQUFHc0YsSUFBSSxDQUFDeEYsQ0FBQyxDQUFBO1FBQ2YsSUFBSSxDQUFDRyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ2QsT0FBQyxNQUFNO1FBQ0gsSUFBSSxDQUFDSCxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1YsUUFBQSxJQUFJLENBQUNDLENBQUMsR0FBRyxDQUFDdUYsSUFBSSxDQUFDdEYsQ0FBQyxDQUFBO0FBQ2hCLFFBQUEsSUFBSSxDQUFDQSxDQUFDLEdBQUdzRixJQUFJLENBQUN2RixDQUFDLENBQUE7UUFDZixJQUFJLENBQUNFLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDZCxPQUFBO0FBQ0osS0FBQyxNQUFNO0FBQ0g7QUFDQSxNQUFBLElBQUksQ0FBQ0gsQ0FBQyxHQUFHd0YsSUFBSSxDQUFDdkYsQ0FBQyxHQUFHd0YsRUFBRSxDQUFDdkYsQ0FBQyxHQUFHc0YsSUFBSSxDQUFDdEYsQ0FBQyxHQUFHdUYsRUFBRSxDQUFDeEYsQ0FBQyxDQUFBO0FBQ3RDLE1BQUEsSUFBSSxDQUFDQSxDQUFDLEdBQUd1RixJQUFJLENBQUN0RixDQUFDLEdBQUd1RixFQUFFLENBQUN6RixDQUFDLEdBQUd3RixJQUFJLENBQUN4RixDQUFDLEdBQUd5RixFQUFFLENBQUN2RixDQUFDLENBQUE7QUFDdEMsTUFBQSxJQUFJLENBQUNBLENBQUMsR0FBR3NGLElBQUksQ0FBQ3hGLENBQUMsR0FBR3lGLEVBQUUsQ0FBQ3hGLENBQUMsR0FBR3VGLElBQUksQ0FBQ3ZGLENBQUMsR0FBR3dGLEVBQUUsQ0FBQ3pGLENBQUMsQ0FBQTtNQUN0QyxJQUFJLENBQUNHLENBQUMsR0FBR3VGLFVBQVUsQ0FBQTtBQUN2QixLQUFBO0lBRUEsT0FBTyxJQUFJLENBQUNyRCxTQUFTLEVBQUUsQ0FBQTtBQUMzQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0l5RCxFQUFBQSxLQUFLQSxDQUFDNUMsR0FBRyxFQUFFekMsR0FBRyxFQUFFc0YsS0FBSyxFQUFFO0FBQ25CO0FBQ0E7QUFDQSxJQUFBLE1BQU1iLEVBQUUsR0FBR2hDLEdBQUcsQ0FBQ2xELENBQUMsQ0FBQTtBQUNoQixJQUFBLE1BQU1tRixFQUFFLEdBQUdqQyxHQUFHLENBQUNqRCxDQUFDLENBQUE7QUFDaEIsSUFBQSxNQUFNbUYsRUFBRSxHQUFHbEMsR0FBRyxDQUFDaEQsQ0FBQyxDQUFBO0FBQ2hCLElBQUEsTUFBTThGLEVBQUUsR0FBRzlDLEdBQUcsQ0FBQy9DLENBQUMsQ0FBQTtBQUNoQixJQUFBLElBQUk4RixFQUFFLEdBQUd4RixHQUFHLENBQUNULENBQUMsQ0FBQTtBQUNkLElBQUEsSUFBSWtHLEVBQUUsR0FBR3pGLEdBQUcsQ0FBQ1IsQ0FBQyxDQUFBO0FBQ2QsSUFBQSxJQUFJa0csRUFBRSxHQUFHMUYsR0FBRyxDQUFDUCxDQUFDLENBQUE7QUFDZCxJQUFBLElBQUlrRyxFQUFFLEdBQUczRixHQUFHLENBQUNOLENBQUMsQ0FBQTs7QUFFZDtBQUNBLElBQUEsSUFBSWtHLFlBQVksR0FBR0wsRUFBRSxHQUFHSSxFQUFFLEdBQUdsQixFQUFFLEdBQUdlLEVBQUUsR0FBR2QsRUFBRSxHQUFHZSxFQUFFLEdBQUdkLEVBQUUsR0FBR2UsRUFBRSxDQUFBO0lBRXhELElBQUlFLFlBQVksR0FBRyxDQUFDLEVBQUU7TUFDbEJELEVBQUUsR0FBRyxDQUFDQSxFQUFFLENBQUE7TUFDUkgsRUFBRSxHQUFHLENBQUNBLEVBQUUsQ0FBQTtNQUNSQyxFQUFFLEdBQUcsQ0FBQ0EsRUFBRSxDQUFBO01BQ1JDLEVBQUUsR0FBRyxDQUFDQSxFQUFFLENBQUE7TUFDUkUsWUFBWSxHQUFHLENBQUNBLFlBQVksQ0FBQTtBQUNoQyxLQUFBOztBQUVBO0lBQ0EsSUFBSXhGLElBQUksQ0FBQ0MsR0FBRyxDQUFDdUYsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFO01BQzdCLElBQUksQ0FBQ2xHLENBQUMsR0FBRzZGLEVBQUUsQ0FBQTtNQUNYLElBQUksQ0FBQ2hHLENBQUMsR0FBR2tGLEVBQUUsQ0FBQTtNQUNYLElBQUksQ0FBQ2pGLENBQUMsR0FBR2tGLEVBQUUsQ0FBQTtNQUNYLElBQUksQ0FBQ2pGLENBQUMsR0FBR2tGLEVBQUUsQ0FBQTtBQUNYLE1BQUEsT0FBTyxJQUFJLENBQUE7QUFDZixLQUFBOztBQUVBO0FBQ0EsSUFBQSxNQUFNa0IsU0FBUyxHQUFHekYsSUFBSSxDQUFDSyxJQUFJLENBQUNtRixZQUFZLENBQUMsQ0FBQTtJQUN6QyxNQUFNRSxZQUFZLEdBQUcxRixJQUFJLENBQUN5QixJQUFJLENBQUMsQ0FBQyxHQUFHK0QsWUFBWSxHQUFHQSxZQUFZLENBQUMsQ0FBQTs7QUFFL0Q7QUFDQTtJQUNBLElBQUl4RixJQUFJLENBQUNDLEdBQUcsQ0FBQ3lGLFlBQVksQ0FBQyxHQUFHLEtBQUssRUFBRTtNQUNoQyxJQUFJLENBQUNwRyxDQUFDLEdBQUk2RixFQUFFLEdBQUcsR0FBRyxHQUFHSSxFQUFFLEdBQUcsR0FBSSxDQUFBO01BQzlCLElBQUksQ0FBQ3BHLENBQUMsR0FBSWtGLEVBQUUsR0FBRyxHQUFHLEdBQUdlLEVBQUUsR0FBRyxHQUFJLENBQUE7TUFDOUIsSUFBSSxDQUFDaEcsQ0FBQyxHQUFJa0YsRUFBRSxHQUFHLEdBQUcsR0FBR2UsRUFBRSxHQUFHLEdBQUksQ0FBQTtNQUM5QixJQUFJLENBQUNoRyxDQUFDLEdBQUlrRixFQUFFLEdBQUcsR0FBRyxHQUFHZSxFQUFFLEdBQUcsR0FBSSxDQUFBO0FBQzlCLE1BQUEsT0FBTyxJQUFJLENBQUE7QUFDZixLQUFBO0FBRUEsSUFBQSxNQUFNSyxNQUFNLEdBQUczRixJQUFJLENBQUNPLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRzJFLEtBQUssSUFBSU8sU0FBUyxDQUFDLEdBQUdDLFlBQVksQ0FBQTtJQUMvRCxNQUFNRSxNQUFNLEdBQUc1RixJQUFJLENBQUNPLEdBQUcsQ0FBQzJFLEtBQUssR0FBR08sU0FBUyxDQUFDLEdBQUdDLFlBQVksQ0FBQTs7QUFFekQ7SUFDQSxJQUFJLENBQUNwRyxDQUFDLEdBQUk2RixFQUFFLEdBQUdRLE1BQU0sR0FBR0osRUFBRSxHQUFHSyxNQUFPLENBQUE7SUFDcEMsSUFBSSxDQUFDekcsQ0FBQyxHQUFJa0YsRUFBRSxHQUFHc0IsTUFBTSxHQUFHUCxFQUFFLEdBQUdRLE1BQU8sQ0FBQTtJQUNwQyxJQUFJLENBQUN4RyxDQUFDLEdBQUlrRixFQUFFLEdBQUdxQixNQUFNLEdBQUdOLEVBQUUsR0FBR08sTUFBTyxDQUFBO0lBQ3BDLElBQUksQ0FBQ3ZHLENBQUMsR0FBSWtGLEVBQUUsR0FBR29CLE1BQU0sR0FBR0wsRUFBRSxHQUFHTSxNQUFPLENBQUE7QUFDcEMsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLGVBQWVBLENBQUM1QyxHQUFHLEVBQUU2QyxHQUFHLEdBQUcsSUFBSWxGLElBQUksRUFBRSxFQUFFO0FBQ25DLElBQUEsTUFBTXpCLENBQUMsR0FBRzhELEdBQUcsQ0FBQzlELENBQUM7TUFBRUMsQ0FBQyxHQUFHNkQsR0FBRyxDQUFDN0QsQ0FBQztNQUFFQyxDQUFDLEdBQUc0RCxHQUFHLENBQUM1RCxDQUFDLENBQUE7QUFDckMsSUFBQSxNQUFNd0IsRUFBRSxHQUFHLElBQUksQ0FBQzFCLENBQUM7TUFBRTJCLEVBQUUsR0FBRyxJQUFJLENBQUMxQixDQUFDO01BQUUyQixFQUFFLEdBQUcsSUFBSSxDQUFDMUIsQ0FBQztNQUFFMkIsRUFBRSxHQUFHLElBQUksQ0FBQzFCLENBQUMsQ0FBQTs7QUFFeEQ7QUFDQSxJQUFBLE1BQU15RyxFQUFFLEdBQUcvRSxFQUFFLEdBQUc3QixDQUFDLEdBQUcyQixFQUFFLEdBQUd6QixDQUFDLEdBQUcwQixFQUFFLEdBQUczQixDQUFDLENBQUE7QUFDbkMsSUFBQSxNQUFNNEcsRUFBRSxHQUFHaEYsRUFBRSxHQUFHNUIsQ0FBQyxHQUFHMkIsRUFBRSxHQUFHNUIsQ0FBQyxHQUFHMEIsRUFBRSxHQUFHeEIsQ0FBQyxDQUFBO0FBQ25DLElBQUEsTUFBTTRHLEVBQUUsR0FBR2pGLEVBQUUsR0FBRzNCLENBQUMsR0FBR3dCLEVBQUUsR0FBR3pCLENBQUMsR0FBRzBCLEVBQUUsR0FBRzNCLENBQUMsQ0FBQTtBQUNuQyxJQUFBLE1BQU0rRyxFQUFFLEdBQUcsQ0FBQ3JGLEVBQUUsR0FBRzFCLENBQUMsR0FBRzJCLEVBQUUsR0FBRzFCLENBQUMsR0FBRzJCLEVBQUUsR0FBRzFCLENBQUMsQ0FBQTs7QUFFcEM7SUFDQXlHLEdBQUcsQ0FBQzNHLENBQUMsR0FBRzRHLEVBQUUsR0FBRy9FLEVBQUUsR0FBR2tGLEVBQUUsR0FBRyxDQUFDckYsRUFBRSxHQUFHbUYsRUFBRSxHQUFHLENBQUNqRixFQUFFLEdBQUdrRixFQUFFLEdBQUcsQ0FBQ25GLEVBQUUsQ0FBQTtJQUNoRGdGLEdBQUcsQ0FBQzFHLENBQUMsR0FBRzRHLEVBQUUsR0FBR2hGLEVBQUUsR0FBR2tGLEVBQUUsR0FBRyxDQUFDcEYsRUFBRSxHQUFHbUYsRUFBRSxHQUFHLENBQUNwRixFQUFFLEdBQUdrRixFQUFFLEdBQUcsQ0FBQ2hGLEVBQUUsQ0FBQTtJQUNoRCtFLEdBQUcsQ0FBQ3pHLENBQUMsR0FBRzRHLEVBQUUsR0FBR2pGLEVBQUUsR0FBR2tGLEVBQUUsR0FBRyxDQUFDbkYsRUFBRSxHQUFHZ0YsRUFBRSxHQUFHLENBQUNqRixFQUFFLEdBQUdrRixFQUFFLEdBQUcsQ0FBQ25GLEVBQUUsQ0FBQTtBQUVoRCxJQUFBLE9BQU9pRixHQUFHLENBQUE7QUFDZCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJSyxFQUFBQSxRQUFRQSxHQUFHO0FBQ1AsSUFBQSxPQUFRLElBQUcsSUFBSSxDQUFDaEgsQ0FBRSxDQUFBLEVBQUEsRUFBSSxJQUFJLENBQUNDLENBQUUsQ0FBSSxFQUFBLEVBQUEsSUFBSSxDQUFDQyxDQUFFLENBQUEsRUFBQSxFQUFJLElBQUksQ0FBQ0MsQ0FBRSxDQUFFLENBQUEsQ0FBQSxDQUFBO0FBQ3pELEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBVUEsQ0FBQTtBQXB0Qk1MLElBQUksQ0Eyc0JDbUgsUUFBUSxHQUFHQyxNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJckgsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUE7QUEzc0JuREEsSUFBSSxDQW10QkNzSCxJQUFJLEdBQUdGLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUlySCxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Ozs7In0=
