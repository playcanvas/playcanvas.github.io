/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { math } from './math.js';
import { Vec2 } from './vec2.js';
import { Vec3 } from './vec3.js';
import { Vec4 } from './vec4.js';

const _halfSize = new Vec2();
const x = new Vec3();
const y = new Vec3();
const z = new Vec3();
const scale = new Vec3();

/**
 * A 4x4 matrix.
 */
class Mat4 {
  /**
   * Matrix elements in the form of a flat array.
   *
   * @type {Float32Array}
   */

  /**
   * Create a new Mat4 instance. It is initialized to the identity matrix.
   */
  constructor() {
    this.data = new Float32Array(16);
    // Create an identity matrix. Note that a new Float32Array has all elements set
    // to zero by default, so we only need to set the relevant elements to one.
    this.data[0] = this.data[5] = this.data[10] = this.data[15] = 1;
  }

  // Static function which evaluates perspective projection matrix half size at the near plane
  static _getPerspectiveHalfSize(halfSize, fov, aspect, znear, fovIsHorizontal) {
    if (fovIsHorizontal) {
      halfSize.x = znear * Math.tan(fov * Math.PI / 360);
      halfSize.y = halfSize.x / aspect;
    } else {
      halfSize.y = znear * Math.tan(fov * Math.PI / 360);
      halfSize.x = halfSize.y * aspect;
    }
  }

  /**
   * Adds the specified 4x4 matrices together and stores the result in the current instance.
   *
   * @param {Mat4} lhs - The 4x4 matrix used as the first operand of the addition.
   * @param {Mat4} rhs - The 4x4 matrix used as the second operand of the addition.
   * @returns {Mat4} Self for chaining.
   * @example
   * var m = new pc.Mat4();
   *
   * m.add2(pc.Mat4.IDENTITY, pc.Mat4.ONE);
   *
   * console.log("The result of the addition is: " + m.toString());
   */
  add2(lhs, rhs) {
    const a = lhs.data,
      b = rhs.data,
      r = this.data;
    r[0] = a[0] + b[0];
    r[1] = a[1] + b[1];
    r[2] = a[2] + b[2];
    r[3] = a[3] + b[3];
    r[4] = a[4] + b[4];
    r[5] = a[5] + b[5];
    r[6] = a[6] + b[6];
    r[7] = a[7] + b[7];
    r[8] = a[8] + b[8];
    r[9] = a[9] + b[9];
    r[10] = a[10] + b[10];
    r[11] = a[11] + b[11];
    r[12] = a[12] + b[12];
    r[13] = a[13] + b[13];
    r[14] = a[14] + b[14];
    r[15] = a[15] + b[15];
    return this;
  }

  /**
   * Adds the specified 4x4 matrix to the current instance.
   *
   * @param {Mat4} rhs - The 4x4 matrix used as the second operand of the addition.
   * @returns {Mat4} Self for chaining.
   * @example
   * var m = new pc.Mat4();
   *
   * m.add(pc.Mat4.ONE);
   *
   * console.log("The result of the addition is: " + m.toString());
   */
  add(rhs) {
    return this.add2(this, rhs);
  }

  /**
   * Creates a duplicate of the specified matrix.
   *
   * @returns {this} A duplicate matrix.
   * @example
   * var src = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * var dst = src.clone();
   * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
   */
  clone() {
    /** @type {this} */
    const cstr = this.constructor;
    return new cstr().copy(this);
  }

  /**
   * Copies the contents of a source 4x4 matrix to a destination 4x4 matrix.
   *
   * @param {Mat4} rhs - A 4x4 matrix to be copied.
   * @returns {Mat4} Self for chaining.
   * @example
   * var src = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * var dst = new pc.Mat4();
   * dst.copy(src);
   * console.log("The two matrices are " + (src.equals(dst) ? "equal" : "different"));
   */
  copy(rhs) {
    const src = rhs.data,
      dst = this.data;
    dst[0] = src[0];
    dst[1] = src[1];
    dst[2] = src[2];
    dst[3] = src[3];
    dst[4] = src[4];
    dst[5] = src[5];
    dst[6] = src[6];
    dst[7] = src[7];
    dst[8] = src[8];
    dst[9] = src[9];
    dst[10] = src[10];
    dst[11] = src[11];
    dst[12] = src[12];
    dst[13] = src[13];
    dst[14] = src[14];
    dst[15] = src[15];
    return this;
  }

  /**
   * Reports whether two matrices are equal.
   *
   * @param {Mat4} rhs - The other matrix.
   * @returns {boolean} True if the matrices are equal and false otherwise.
   * @example
   * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * var b = new pc.Mat4();
   * console.log("The two matrices are " + (a.equals(b) ? "equal" : "different"));
   */
  equals(rhs) {
    const l = this.data,
      r = rhs.data;
    return l[0] === r[0] && l[1] === r[1] && l[2] === r[2] && l[3] === r[3] && l[4] === r[4] && l[5] === r[5] && l[6] === r[6] && l[7] === r[7] && l[8] === r[8] && l[9] === r[9] && l[10] === r[10] && l[11] === r[11] && l[12] === r[12] && l[13] === r[13] && l[14] === r[14] && l[15] === r[15];
  }

  /**
   * Reports whether the specified matrix is the identity matrix.
   *
   * @returns {boolean} True if the matrix is identity and false otherwise.
   * @example
   * var m = new pc.Mat4();
   * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
   */
  isIdentity() {
    const m = this.data;
    return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 0 && m[5] === 1 && m[6] === 0 && m[7] === 0 && m[8] === 0 && m[9] === 0 && m[10] === 1 && m[11] === 0 && m[12] === 0 && m[13] === 0 && m[14] === 0 && m[15] === 1;
  }

  /**
   * Multiplies the specified 4x4 matrices together and stores the result in the current
   * instance.
   *
   * @param {Mat4} lhs - The 4x4 matrix used as the first multiplicand of the operation.
   * @param {Mat4} rhs - The 4x4 matrix used as the second multiplicand of the operation.
   * @returns {Mat4} Self for chaining.
   * @example
   * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * var b = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
   * var r = new pc.Mat4();
   *
   * // r = a * b
   * r.mul2(a, b);
   *
   * console.log("The result of the multiplication is: " + r.toString());
   */
  mul2(lhs, rhs) {
    const a = lhs.data;
    const b = rhs.data;
    const r = this.data;
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];
    let b0, b1, b2, b3;
    b0 = b[0];
    b1 = b[1];
    b2 = b[2];
    b3 = b[3];
    r[0] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    r[1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    r[2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    r[3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    b3 = b[7];
    r[4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    r[5] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    r[6] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    r[7] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    b3 = b[11];
    r[8] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    r[9] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    r[10] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    r[11] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    b3 = b[15];
    r[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    r[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    r[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    r[15] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    return this;
  }

  /**
   * Multiplies the specified 4x4 matrices together and stores the result in the current
   * instance. This function assumes the matrices are affine transformation matrices, where the
   * upper left 3x3 elements are a rotation matrix, and the bottom left 3 elements are
   * translation. The rightmost column is assumed to be [0, 0, 0, 1]. The parameters are not
   * verified to be in the expected format. This function is faster than general
   * {@link Mat4#mul2}.
   *
   * @param {Mat4} lhs - The affine transformation 4x4 matrix used as the first multiplicand of
   * the operation.
   * @param {Mat4} rhs - The affine transformation 4x4 matrix used as the second multiplicand of
   * the operation.
   * @returns {Mat4} Self for chaining.
   */
  mulAffine2(lhs, rhs) {
    const a = lhs.data;
    const b = rhs.data;
    const r = this.data;
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    let b0, b1, b2;
    b0 = b[0];
    b1 = b[1];
    b2 = b[2];
    r[0] = a00 * b0 + a10 * b1 + a20 * b2;
    r[1] = a01 * b0 + a11 * b1 + a21 * b2;
    r[2] = a02 * b0 + a12 * b1 + a22 * b2;
    r[3] = 0;
    b0 = b[4];
    b1 = b[5];
    b2 = b[6];
    r[4] = a00 * b0 + a10 * b1 + a20 * b2;
    r[5] = a01 * b0 + a11 * b1 + a21 * b2;
    r[6] = a02 * b0 + a12 * b1 + a22 * b2;
    r[7] = 0;
    b0 = b[8];
    b1 = b[9];
    b2 = b[10];
    r[8] = a00 * b0 + a10 * b1 + a20 * b2;
    r[9] = a01 * b0 + a11 * b1 + a21 * b2;
    r[10] = a02 * b0 + a12 * b1 + a22 * b2;
    r[11] = 0;
    b0 = b[12];
    b1 = b[13];
    b2 = b[14];
    r[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30;
    r[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31;
    r[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32;
    r[15] = 1;
    return this;
  }

  /**
   * Multiplies the current instance by the specified 4x4 matrix.
   *
   * @param {Mat4} rhs - The 4x4 matrix used as the second multiplicand of the operation.
   * @returns {Mat4} Self for chaining.
   * @example
   * var a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * var b = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
   *
   * // a = a * b
   * a.mul(b);
   *
   * console.log("The result of the multiplication is: " + a.toString());
   */
  mul(rhs) {
    return this.mul2(this, rhs);
  }

  /**
   * Transforms a 3-dimensional point by a 4x4 matrix.
   *
   * @param {Vec3} vec - The 3-dimensional point to be transformed.
   * @param {Vec3} [res] - An optional 3-dimensional point to receive the result of the
   * transformation.
   * @returns {Vec3} The input point v transformed by the current instance.
   * @example
   * // Create a 3-dimensional point
   * var v = new pc.Vec3(1, 2, 3);
   *
   * // Create a 4x4 rotation matrix
   * var m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   *
   * var tv = m.transformPoint(v);
   */
  transformPoint(vec, res = new Vec3()) {
    const m = this.data;
    const x = vec.x;
    const y = vec.y;
    const z = vec.z;
    res.x = x * m[0] + y * m[4] + z * m[8] + m[12];
    res.y = x * m[1] + y * m[5] + z * m[9] + m[13];
    res.z = x * m[2] + y * m[6] + z * m[10] + m[14];
    return res;
  }

  /**
   * Transforms a 3-dimensional vector by a 4x4 matrix.
   *
   * @param {Vec3} vec - The 3-dimensional vector to be transformed.
   * @param {Vec3} [res] - An optional 3-dimensional vector to receive the result of the
   * transformation.
   * @returns {Vec3} The input vector v transformed by the current instance.
   * @example
   * // Create a 3-dimensional vector
   * var v = new pc.Vec3(1, 2, 3);
   *
   * // Create a 4x4 rotation matrix
   * var m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   *
   * var tv = m.transformVector(v);
   */
  transformVector(vec, res = new Vec3()) {
    const m = this.data;
    const x = vec.x;
    const y = vec.y;
    const z = vec.z;
    res.x = x * m[0] + y * m[4] + z * m[8];
    res.y = x * m[1] + y * m[5] + z * m[9];
    res.z = x * m[2] + y * m[6] + z * m[10];
    return res;
  }

  /**
   * Transforms a 4-dimensional vector by a 4x4 matrix.
   *
   * @param {Vec4} vec - The 4-dimensional vector to be transformed.
   * @param {Vec4} [res] - An optional 4-dimensional vector to receive the result of the
   * transformation.
   * @returns {Vec4} The input vector v transformed by the current instance.
   * @example
   * // Create an input 4-dimensional vector
   * var v = new pc.Vec4(1, 2, 3, 4);
   *
   * // Create an output 4-dimensional vector
   * var result = new pc.Vec4();
   *
   * // Create a 4x4 rotation matrix
   * var m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   *
   * m.transformVec4(v, result);
   */
  transformVec4(vec, res = new Vec4()) {
    const m = this.data;
    const x = vec.x;
    const y = vec.y;
    const z = vec.z;
    const w = vec.w;
    res.x = x * m[0] + y * m[4] + z * m[8] + w * m[12];
    res.y = x * m[1] + y * m[5] + z * m[9] + w * m[13];
    res.z = x * m[2] + y * m[6] + z * m[10] + w * m[14];
    res.w = x * m[3] + y * m[7] + z * m[11] + w * m[15];
    return res;
  }

  /**
   * Sets the specified matrix to a viewing matrix derived from an eye point, a target point and
   * an up vector. The matrix maps the target point to the negative z-axis and the eye point to
   * the origin, so that when you use a typical projection matrix, the center of the scene maps
   * to the center of the viewport. Similarly, the direction described by the up vector projected
   * onto the viewing plane is mapped to the positive y-axis so that it points upward in the
   * viewport. The up vector must not be parallel to the line of sight from the eye to the
   * reference point.
   *
   * @param {Vec3} position - 3-d vector holding view position.
   * @param {Vec3} target - 3-d vector holding reference point.
   * @param {Vec3} up - 3-d vector holding the up direction.
   * @returns {Mat4} Self for chaining.
   * @example
   * var position = new pc.Vec3(10, 10, 10);
   * var target = new pc.Vec3(0, 0, 0);
   * var up = new pc.Vec3(0, 1, 0);
   * var m = new pc.Mat4().setLookAt(position, target, up);
   */
  setLookAt(position, target, up) {
    z.sub2(position, target).normalize();
    y.copy(up).normalize();
    x.cross(y, z).normalize();
    y.cross(z, x);
    const r = this.data;
    r[0] = x.x;
    r[1] = x.y;
    r[2] = x.z;
    r[3] = 0;
    r[4] = y.x;
    r[5] = y.y;
    r[6] = y.z;
    r[7] = 0;
    r[8] = z.x;
    r[9] = z.y;
    r[10] = z.z;
    r[11] = 0;
    r[12] = position.x;
    r[13] = position.y;
    r[14] = position.z;
    r[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to a perspective projection matrix. The function's parameters
   * define the shape of a frustum.
   *
   * @param {number} left - The x-coordinate for the left edge of the camera's projection plane
   * in eye space.
   * @param {number} right - The x-coordinate for the right edge of the camera's projection plane
   * in eye space.
   * @param {number} bottom - The y-coordinate for the bottom edge of the camera's projection
   * plane in eye space.
   * @param {number} top - The y-coordinate for the top edge of the camera's projection plane in
   * eye space.
   * @param {number} znear - The near clip plane in eye coordinates.
   * @param {number} zfar - The far clip plane in eye coordinates.
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 perspective projection matrix
   * var f = pc.Mat4().setFrustum(-2, 2, -1, 1, 1, 1000);
   * @ignore
   */
  setFrustum(left, right, bottom, top, znear, zfar) {
    const temp1 = 2 * znear;
    const temp2 = right - left;
    const temp3 = top - bottom;
    const temp4 = zfar - znear;
    const r = this.data;
    r[0] = temp1 / temp2;
    r[1] = 0;
    r[2] = 0;
    r[3] = 0;
    r[4] = 0;
    r[5] = temp1 / temp3;
    r[6] = 0;
    r[7] = 0;
    r[8] = (right + left) / temp2;
    r[9] = (top + bottom) / temp3;
    r[10] = (-zfar - znear) / temp4;
    r[11] = -1;
    r[12] = 0;
    r[13] = 0;
    r[14] = -temp1 * zfar / temp4;
    r[15] = 0;
    return this;
  }

  /**
   * Sets the specified matrix to a perspective projection matrix. The function's parameters
   * define the shape of a frustum.
   *
   * @param {number} fov - The frustum's field of view in degrees. The fovIsHorizontal parameter
   * controls whether this is a vertical or horizontal field of view. By default, it's a vertical
   * field of view.
   * @param {number} aspect - The aspect ratio of the frustum's projection plane
   * (width / height).
   * @param {number} znear - The near clip plane in eye coordinates.
   * @param {number} zfar - The far clip plane in eye coordinates.
   * @param {boolean} [fovIsHorizontal=false] - Set to true to treat the fov as horizontal
   * (x-axis) and false for vertical (y-axis). Defaults to false.
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 perspective projection matrix
   * var persp = pc.Mat4().setPerspective(45, 16 / 9, 1, 1000);
   */
  setPerspective(fov, aspect, znear, zfar, fovIsHorizontal) {
    Mat4._getPerspectiveHalfSize(_halfSize, fov, aspect, znear, fovIsHorizontal);
    return this.setFrustum(-_halfSize.x, _halfSize.x, -_halfSize.y, _halfSize.y, znear, zfar);
  }

  /**
   * Sets the specified matrix to an orthographic projection matrix. The function's parameters
   * define the shape of a cuboid-shaped frustum.
   *
   * @param {number} left - The x-coordinate for the left edge of the camera's projection plane
   * in eye space.
   * @param {number} right - The x-coordinate for the right edge of the camera's projection plane
   * in eye space.
   * @param {number} bottom - The y-coordinate for the bottom edge of the camera's projection
   * plane in eye space.
   * @param {number} top - The y-coordinate for the top edge of the camera's projection plane in
   * eye space.
   * @param {number} near - The near clip plane in eye coordinates.
   * @param {number} far - The far clip plane in eye coordinates.
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 orthographic projection matrix
   * var ortho = pc.Mat4().ortho(-2, 2, -2, 2, 1, 1000);
   */
  setOrtho(left, right, bottom, top, near, far) {
    const r = this.data;
    r[0] = 2 / (right - left);
    r[1] = 0;
    r[2] = 0;
    r[3] = 0;
    r[4] = 0;
    r[5] = 2 / (top - bottom);
    r[6] = 0;
    r[7] = 0;
    r[8] = 0;
    r[9] = 0;
    r[10] = -2 / (far - near);
    r[11] = 0;
    r[12] = -(right + left) / (right - left);
    r[13] = -(top + bottom) / (top - bottom);
    r[14] = -(far + near) / (far - near);
    r[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to a rotation matrix equivalent to a rotation around an axis. The
   * axis must be normalized (unit length) and the angle must be specified in degrees.
   *
   * @param {Vec3} axis - The normalized axis vector around which to rotate.
   * @param {number} angle - The angle of rotation in degrees.
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 rotation matrix
   * var rm = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 90);
   */
  setFromAxisAngle(axis, angle) {
    angle *= math.DEG_TO_RAD;
    const x = axis.x;
    const y = axis.y;
    const z = axis.z;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    const tx = t * x;
    const ty = t * y;
    const m = this.data;
    m[0] = tx * x + c;
    m[1] = tx * y + s * z;
    m[2] = tx * z - s * y;
    m[3] = 0;
    m[4] = tx * y - s * z;
    m[5] = ty * y + c;
    m[6] = ty * z + s * x;
    m[7] = 0;
    m[8] = tx * z + s * y;
    m[9] = ty * z - x * s;
    m[10] = t * z * z + c;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to a translation matrix.
   *
   * @param {number} x - The x-component of the translation.
   * @param {number} y - The y-component of the translation.
   * @param {number} z - The z-component of the translation.
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 translation matrix
   * var tm = new pc.Mat4().setTranslate(10, 10, 10);
   * @ignore
   */
  setTranslate(x, y, z) {
    const m = this.data;
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = 1;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = 1;
    m[11] = 0;
    m[12] = x;
    m[13] = y;
    m[14] = z;
    m[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to a scale matrix.
   *
   * @param {number} x - The x-component of the scale.
   * @param {number} y - The y-component of the scale.
   * @param {number} z - The z-component of the scale.
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 scale matrix
   * var sm = new pc.Mat4().setScale(10, 10, 10);
   * @ignore
   */
  setScale(x, y, z) {
    const m = this.data;
    m[0] = x;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = y;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = z;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to a matrix transforming a normalized view volume (in range of
   * -1 .. 1) to their position inside a viewport (in range of 0 .. 1). This encapsulates a
   * scaling to the size of the viewport and a translation to the position of the viewport.
   *
   * @param {number} x - The x-component of the position of the viewport (in 0..1 range).
   * @param {number} y - The y-component of the position of the viewport (in 0..1 range).
   * @param {number} width - The width of the viewport (in 0..1 range).
   * @param {number} height - The height of the viewport (in 0..1 range).
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 viewport matrix which scales normalized view volume to full texture viewport
   * var vm = new pc.Mat4().setViewport(0, 0, 1, 1);
   * @ignore
   */
  setViewport(x, y, width, height) {
    const m = this.data;
    m[0] = width * 0.5;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = height * 0.5;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = 0.5;
    m[11] = 0;
    m[12] = x + width * 0.5;
    m[13] = y + height * 0.5;
    m[14] = 0.5;
    m[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to its inverse.
   *
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
   * var rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
   *
   * // Invert in place
   * rot.invert();
   */
  invert() {
    const m = this.data;
    const a00 = m[0];
    const a01 = m[1];
    const a02 = m[2];
    const a03 = m[3];
    const a10 = m[4];
    const a11 = m[5];
    const a12 = m[6];
    const a13 = m[7];
    const a20 = m[8];
    const a21 = m[9];
    const a22 = m[10];
    const a23 = m[11];
    const a30 = m[12];
    const a31 = m[13];
    const a32 = m[14];
    const a33 = m[15];
    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;
    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (det === 0) {
      this.setIdentity();
    } else {
      const invDet = 1 / det;
      m[0] = (a11 * b11 - a12 * b10 + a13 * b09) * invDet;
      m[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * invDet;
      m[2] = (a31 * b05 - a32 * b04 + a33 * b03) * invDet;
      m[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * invDet;
      m[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * invDet;
      m[5] = (a00 * b11 - a02 * b08 + a03 * b07) * invDet;
      m[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * invDet;
      m[7] = (a20 * b05 - a22 * b02 + a23 * b01) * invDet;
      m[8] = (a10 * b10 - a11 * b08 + a13 * b06) * invDet;
      m[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * invDet;
      m[10] = (a30 * b04 - a31 * b02 + a33 * b00) * invDet;
      m[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * invDet;
      m[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * invDet;
      m[13] = (a00 * b09 - a01 * b07 + a02 * b06) * invDet;
      m[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * invDet;
      m[15] = (a20 * b03 - a21 * b01 + a22 * b00) * invDet;
    }
    return this;
  }

  /**
   * Sets matrix data from an array.
   *
   * @param {number[]} src - Source array. Must have 16 values.
   * @returns {Mat4} Self for chaining.
   */
  set(src) {
    const dst = this.data;
    dst[0] = src[0];
    dst[1] = src[1];
    dst[2] = src[2];
    dst[3] = src[3];
    dst[4] = src[4];
    dst[5] = src[5];
    dst[6] = src[6];
    dst[7] = src[7];
    dst[8] = src[8];
    dst[9] = src[9];
    dst[10] = src[10];
    dst[11] = src[11];
    dst[12] = src[12];
    dst[13] = src[13];
    dst[14] = src[14];
    dst[15] = src[15];
    return this;
  }

  /**
   * Sets the specified matrix to the identity matrix.
   *
   * @returns {Mat4} Self for chaining.
   * @example
   * m.setIdentity();
   * console.log("The matrix is " + (m.isIdentity() ? "identity" : "not identity"));
   */
  setIdentity() {
    const m = this.data;
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 0;
    m[5] = 1;
    m[6] = 0;
    m[7] = 0;
    m[8] = 0;
    m[9] = 0;
    m[10] = 1;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to the concatenation of a translation, a quaternion rotation and a
   * scale.
   *
   * @param {Vec3} t - A 3-d vector translation.
   * @param {import('./quat.js').Quat} r - A quaternion rotation.
   * @param {Vec3} s - A 3-d vector scale.
   * @returns {Mat4} Self for chaining.
   * @example
   * var t = new pc.Vec3(10, 20, 30);
   * var r = new pc.Quat();
   * var s = new pc.Vec3(2, 2, 2);
   *
   * var m = new pc.Mat4();
   * m.setTRS(t, r, s);
   */
  setTRS(t, r, s) {
    const qx = r.x;
    const qy = r.y;
    const qz = r.z;
    const qw = r.w;
    const sx = s.x;
    const sy = s.y;
    const sz = s.z;
    const x2 = qx + qx;
    const y2 = qy + qy;
    const z2 = qz + qz;
    const xx = qx * x2;
    const xy = qx * y2;
    const xz = qx * z2;
    const yy = qy * y2;
    const yz = qy * z2;
    const zz = qz * z2;
    const wx = qw * x2;
    const wy = qw * y2;
    const wz = qw * z2;
    const m = this.data;
    m[0] = (1 - (yy + zz)) * sx;
    m[1] = (xy + wz) * sx;
    m[2] = (xz - wy) * sx;
    m[3] = 0;
    m[4] = (xy - wz) * sy;
    m[5] = (1 - (xx + zz)) * sy;
    m[6] = (yz + wx) * sy;
    m[7] = 0;
    m[8] = (xz + wy) * sz;
    m[9] = (yz - wx) * sz;
    m[10] = (1 - (xx + yy)) * sz;
    m[11] = 0;
    m[12] = t.x;
    m[13] = t.y;
    m[14] = t.z;
    m[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to its transpose.
   *
   * @returns {Mat4} Self for chaining.
   * @example
   * var m = new pc.Mat4();
   *
   * // Transpose in place
   * m.transpose();
   */
  transpose() {
    let tmp;
    const m = this.data;
    tmp = m[1];
    m[1] = m[4];
    m[4] = tmp;
    tmp = m[2];
    m[2] = m[8];
    m[8] = tmp;
    tmp = m[3];
    m[3] = m[12];
    m[12] = tmp;
    tmp = m[6];
    m[6] = m[9];
    m[9] = tmp;
    tmp = m[7];
    m[7] = m[13];
    m[13] = tmp;
    tmp = m[11];
    m[11] = m[14];
    m[14] = tmp;
    return this;
  }
  invertTo3x3(res) {
    const m = this.data;
    const r = res.data;
    const m0 = m[0];
    const m1 = m[1];
    const m2 = m[2];
    const m4 = m[4];
    const m5 = m[5];
    const m6 = m[6];
    const m8 = m[8];
    const m9 = m[9];
    const m10 = m[10];
    const a11 = m10 * m5 - m6 * m9;
    const a21 = -m10 * m1 + m2 * m9;
    const a31 = m6 * m1 - m2 * m5;
    const a12 = -m10 * m4 + m6 * m8;
    const a22 = m10 * m0 - m2 * m8;
    const a32 = -m6 * m0 + m2 * m4;
    const a13 = m9 * m4 - m5 * m8;
    const a23 = -m9 * m0 + m1 * m8;
    const a33 = m5 * m0 - m1 * m4;
    const det = m0 * a11 + m1 * a12 + m2 * a13;
    if (det === 0) {
      // no inverse
      return this;
    }
    const idet = 1 / det;
    r[0] = idet * a11;
    r[1] = idet * a21;
    r[2] = idet * a31;
    r[3] = idet * a12;
    r[4] = idet * a22;
    r[5] = idet * a32;
    r[6] = idet * a13;
    r[7] = idet * a23;
    r[8] = idet * a33;
    return this;
  }

  /**
   * Extracts the translational component from the specified 4x4 matrix.
   *
   * @param {Vec3} [t] - The vector to receive the translation of the matrix.
   * @returns {Vec3} The translation of the specified 4x4 matrix.
   * @example
   * // Create a 4x4 matrix
   * var m = new pc.Mat4();
   *
   * // Query the translation component
   * var t = new pc.Vec3();
   * m.getTranslation(t);
   */
  getTranslation(t = new Vec3()) {
    return t.set(this.data[12], this.data[13], this.data[14]);
  }

  /**
   * Extracts the x-axis from the specified 4x4 matrix.
   *
   * @param {Vec3} [x] - The vector to receive the x axis of the matrix.
   * @returns {Vec3} The x-axis of the specified 4x4 matrix.
   * @example
   * // Create a 4x4 matrix
   * var m = new pc.Mat4();
   *
   * // Query the x-axis component
   * var x = new pc.Vec3();
   * m.getX(x);
   */
  getX(x = new Vec3()) {
    return x.set(this.data[0], this.data[1], this.data[2]);
  }

  /**
   * Extracts the y-axis from the specified 4x4 matrix.
   *
   * @param {Vec3} [y] - The vector to receive the y axis of the matrix.
   * @returns {Vec3} The y-axis of the specified 4x4 matrix.
   * @example
   * // Create a 4x4 matrix
   * var m = new pc.Mat4();
   *
   * // Query the y-axis component
   * var y = new pc.Vec3();
   * m.getY(y);
   */
  getY(y = new Vec3()) {
    return y.set(this.data[4], this.data[5], this.data[6]);
  }

  /**
   * Extracts the z-axis from the specified 4x4 matrix.
   *
   * @param {Vec3} [z] - The vector to receive the z axis of the matrix.
   * @returns {Vec3} The z-axis of the specified 4x4 matrix.
   * @example
   * // Create a 4x4 matrix
   * var m = new pc.Mat4();
   *
   * // Query the z-axis component
   * var z = new pc.Vec3();
   * m.getZ(z);
   */
  getZ(z = new Vec3()) {
    return z.set(this.data[8], this.data[9], this.data[10]);
  }

  /**
   * Extracts the scale component from the specified 4x4 matrix.
   *
   * @param {Vec3} [scale] - Vector to receive the scale.
   * @returns {Vec3} The scale in X, Y and Z of the specified 4x4 matrix.
   * @example
   * // Query the scale component
   * var scale = m.getScale();
   */
  getScale(scale = new Vec3()) {
    this.getX(x);
    this.getY(y);
    this.getZ(z);
    scale.set(x.length(), y.length(), z.length());
    return scale;
  }

  /**
   * Sets the specified matrix to a rotation matrix defined by Euler angles. The Euler angles are
   * specified in XYZ order and in degrees.
   *
   * @param {number} ex - Angle to rotate around X axis in degrees.
   * @param {number} ey - Angle to rotate around Y axis in degrees.
   * @param {number} ez - Angle to rotate around Z axis in degrees.
   * @returns {Mat4} Self for chaining.
   * @example
   * var m = new pc.Mat4();
   * m.setFromEulerAngles(45, 90, 180);
   */
  setFromEulerAngles(ex, ey, ez) {
    // http://en.wikipedia.org/wiki/Rotation_matrix#Conversion_from_and_to_axis-angle
    // The 3D space is right-handed, so the rotation around each axis will be counterclockwise
    // for an observer placed so that the axis goes in his or her direction (Right-hand rule).
    ex *= math.DEG_TO_RAD;
    ey *= math.DEG_TO_RAD;
    ez *= math.DEG_TO_RAD;

    // Solution taken from http://en.wikipedia.org/wiki/Euler_angles#Matrix_orientation
    const s1 = Math.sin(-ex);
    const c1 = Math.cos(-ex);
    const s2 = Math.sin(-ey);
    const c2 = Math.cos(-ey);
    const s3 = Math.sin(-ez);
    const c3 = Math.cos(-ez);
    const m = this.data;

    // Set rotation elements
    m[0] = c2 * c3;
    m[1] = -c2 * s3;
    m[2] = s2;
    m[3] = 0;
    m[4] = c1 * s3 + c3 * s1 * s2;
    m[5] = c1 * c3 - s1 * s2 * s3;
    m[6] = -c2 * s1;
    m[7] = 0;
    m[8] = s1 * s3 - c1 * c3 * s2;
    m[9] = c3 * s1 + c1 * s2 * s3;
    m[10] = c1 * c2;
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return this;
  }

  /**
   * Extracts the Euler angles equivalent to the rotational portion of the specified matrix. The
   * returned Euler angles are in XYZ order an in degrees.
   *
   * @param {Vec3} [eulers] - A 3-d vector to receive the Euler angles.
   * @returns {Vec3} A 3-d vector containing the Euler angles.
   * @example
   * // Create a 4x4 rotation matrix of 45 degrees around the y-axis
   * var m = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 45);
   *
   * var eulers = m.getEulerAngles();
   */
  getEulerAngles(eulers = new Vec3()) {
    this.getScale(scale);
    const sx = scale.x;
    const sy = scale.y;
    const sz = scale.z;
    if (sx === 0 || sy === 0 || sz === 0) return eulers.set(0, 0, 0);
    const m = this.data;
    const y = Math.asin(-m[2] / sx);
    const halfPi = Math.PI * 0.5;
    let x, z;
    if (y < halfPi) {
      if (y > -halfPi) {
        x = Math.atan2(m[6] / sy, m[10] / sz);
        z = Math.atan2(m[1] / sx, m[0] / sx);
      } else {
        // Not a unique solution
        z = 0;
        x = -Math.atan2(m[4] / sy, m[5] / sy);
      }
    } else {
      // Not a unique solution
      z = 0;
      x = Math.atan2(m[4] / sy, m[5] / sy);
    }
    return eulers.set(x, y, z).mulScalar(math.RAD_TO_DEG);
  }

  /**
   * Converts the specified matrix to string form.
   *
   * @returns {string} The matrix in string form.
   * @example
   * var m = new pc.Mat4();
   * // Outputs [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
   * console.log(m.toString());
   */
  toString() {
    return '[' + this.data.join(', ') + ']';
  }

  /**
   * A constant matrix set to the identity.
   *
   * @type {Mat4}
   * @readonly
   */
}
Mat4.IDENTITY = Object.freeze(new Mat4());
Mat4.ZERO = Object.freeze(new Mat4().set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

export { Mat4 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0NC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9tYXQ0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4vdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuL3ZlYzQuanMnO1xuXG5jb25zdCBfaGFsZlNpemUgPSBuZXcgVmVjMigpO1xuY29uc3QgeCA9IG5ldyBWZWMzKCk7XG5jb25zdCB5ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHogPSBuZXcgVmVjMygpO1xuY29uc3Qgc2NhbGUgPSBuZXcgVmVjMygpO1xuXG4vKipcbiAqIEEgNHg0IG1hdHJpeC5cbiAqL1xuY2xhc3MgTWF0NCB7XG4gICAgLyoqXG4gICAgICogTWF0cml4IGVsZW1lbnRzIGluIHRoZSBmb3JtIG9mIGEgZmxhdCBhcnJheS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG4gICAgICovXG4gICAgZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMTYpO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1hdDQgaW5zdGFuY2UuIEl0IGlzIGluaXRpYWxpemVkIHRvIHRoZSBpZGVudGl0eSBtYXRyaXguXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhbiBpZGVudGl0eSBtYXRyaXguIE5vdGUgdGhhdCBhIG5ldyBGbG9hdDMyQXJyYXkgaGFzIGFsbCBlbGVtZW50cyBzZXRcbiAgICAgICAgLy8gdG8gemVybyBieSBkZWZhdWx0LCBzbyB3ZSBvbmx5IG5lZWQgdG8gc2V0IHRoZSByZWxldmFudCBlbGVtZW50cyB0byBvbmUuXG4gICAgICAgIHRoaXMuZGF0YVswXSA9IHRoaXMuZGF0YVs1XSA9IHRoaXMuZGF0YVsxMF0gPSB0aGlzLmRhdGFbMTVdID0gMTtcbiAgICB9XG5cbiAgICAvLyBTdGF0aWMgZnVuY3Rpb24gd2hpY2ggZXZhbHVhdGVzIHBlcnNwZWN0aXZlIHByb2plY3Rpb24gbWF0cml4IGhhbGYgc2l6ZSBhdCB0aGUgbmVhciBwbGFuZVxuICAgIHN0YXRpYyBfZ2V0UGVyc3BlY3RpdmVIYWxmU2l6ZShoYWxmU2l6ZSwgZm92LCBhc3BlY3QsIHpuZWFyLCBmb3ZJc0hvcml6b250YWwpIHtcbiAgICAgICAgaWYgKGZvdklzSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgaGFsZlNpemUueCA9IHpuZWFyICogTWF0aC50YW4oZm92ICogTWF0aC5QSSAvIDM2MCk7XG4gICAgICAgICAgICBoYWxmU2l6ZS55ID0gaGFsZlNpemUueCAvIGFzcGVjdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbGZTaXplLnkgPSB6bmVhciAqIE1hdGgudGFuKGZvdiAqIE1hdGguUEkgLyAzNjApO1xuICAgICAgICAgICAgaGFsZlNpemUueCA9IGhhbGZTaXplLnkgKiBhc3BlY3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpY2VzIHRvZ2V0aGVyIGFuZCBzdG9yZXMgdGhlIHJlc3VsdCBpbiB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbGhzIC0gVGhlIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgZmlyc3Qgb3BlcmFuZCBvZiB0aGUgYWRkaXRpb24uXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgNHg0IG1hdHJpeCB1c2VkIGFzIHRoZSBzZWNvbmQgb3BlcmFuZCBvZiB0aGUgYWRkaXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogbS5hZGQyKHBjLk1hdDQuSURFTlRJVFksIHBjLk1hdDQuT05FKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgbS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGQyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IGEgPSBsaHMuZGF0YSxcbiAgICAgICAgICAgIGIgPSByaHMuZGF0YSxcbiAgICAgICAgICAgIHIgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgclswXSA9IGFbMF0gKyBiWzBdO1xuICAgICAgICByWzFdID0gYVsxXSArIGJbMV07XG4gICAgICAgIHJbMl0gPSBhWzJdICsgYlsyXTtcbiAgICAgICAgclszXSA9IGFbM10gKyBiWzNdO1xuICAgICAgICByWzRdID0gYVs0XSArIGJbNF07XG4gICAgICAgIHJbNV0gPSBhWzVdICsgYls1XTtcbiAgICAgICAgcls2XSA9IGFbNl0gKyBiWzZdO1xuICAgICAgICByWzddID0gYVs3XSArIGJbN107XG4gICAgICAgIHJbOF0gPSBhWzhdICsgYls4XTtcbiAgICAgICAgcls5XSA9IGFbOV0gKyBiWzldO1xuICAgICAgICByWzEwXSA9IGFbMTBdICsgYlsxMF07XG4gICAgICAgIHJbMTFdID0gYVsxMV0gKyBiWzExXTtcbiAgICAgICAgclsxMl0gPSBhWzEyXSArIGJbMTJdO1xuICAgICAgICByWzEzXSA9IGFbMTNdICsgYlsxM107XG4gICAgICAgIHJbMTRdID0gYVsxNF0gKyBiWzE0XTtcbiAgICAgICAgclsxNV0gPSBhWzE1XSArIGJbMTVdO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4IHRvIHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgNHg0IG1hdHJpeCB1c2VkIGFzIHRoZSBzZWNvbmQgb3BlcmFuZCBvZiB0aGUgYWRkaXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogbS5hZGQocGMuTWF0NC5PTkUpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyBtLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZChyaHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkMih0aGlzLCByaHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBkdXBsaWNhdGUgb2YgdGhlIHNwZWNpZmllZCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBkdXBsaWNhdGUgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNyYyA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqIHZhciBkc3QgPSBzcmMuY2xvbmUoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gbWF0cmljZXMgYXJlIFwiICsgKHNyYy5lcXVhbHMoZHN0KSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKCkuY29weSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIDR4NCBtYXRyaXggdG8gYSBkZXN0aW5hdGlvbiA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBBIDR4NCBtYXRyaXggdG8gYmUgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBzcmMgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKiB2YXIgZHN0ID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiBkc3QuY29weShzcmMpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byBtYXRyaWNlcyBhcmUgXCIgKyAoc3JjLmVxdWFscyhkc3QpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGNvcHkocmhzKSB7XG4gICAgICAgIGNvbnN0IHNyYyA9IHJocy5kYXRhLFxuICAgICAgICAgICAgZHN0ID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGRzdFswXSA9IHNyY1swXTtcbiAgICAgICAgZHN0WzFdID0gc3JjWzFdO1xuICAgICAgICBkc3RbMl0gPSBzcmNbMl07XG4gICAgICAgIGRzdFszXSA9IHNyY1szXTtcbiAgICAgICAgZHN0WzRdID0gc3JjWzRdO1xuICAgICAgICBkc3RbNV0gPSBzcmNbNV07XG4gICAgICAgIGRzdFs2XSA9IHNyY1s2XTtcbiAgICAgICAgZHN0WzddID0gc3JjWzddO1xuICAgICAgICBkc3RbOF0gPSBzcmNbOF07XG4gICAgICAgIGRzdFs5XSA9IHNyY1s5XTtcbiAgICAgICAgZHN0WzEwXSA9IHNyY1sxMF07XG4gICAgICAgIGRzdFsxMV0gPSBzcmNbMTFdO1xuICAgICAgICBkc3RbMTJdID0gc3JjWzEyXTtcbiAgICAgICAgZHN0WzEzXSA9IHNyY1sxM107XG4gICAgICAgIGRzdFsxNF0gPSBzcmNbMTRdO1xuICAgICAgICBkc3RbMTVdID0gc3JjWzE1XTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIG1hdHJpY2VzIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIG90aGVyIG1hdHJpeC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgbWF0cmljZXMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gbWF0cmljZXMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgY29uc3QgbCA9IHRoaXMuZGF0YSxcbiAgICAgICAgICAgIHIgPSByaHMuZGF0YTtcblxuICAgICAgICByZXR1cm4gKChsWzBdID09PSByWzBdKSAmJlxuICAgICAgICAgICAgICAgIChsWzFdID09PSByWzFdKSAmJlxuICAgICAgICAgICAgICAgIChsWzJdID09PSByWzJdKSAmJlxuICAgICAgICAgICAgICAgIChsWzNdID09PSByWzNdKSAmJlxuICAgICAgICAgICAgICAgIChsWzRdID09PSByWzRdKSAmJlxuICAgICAgICAgICAgICAgIChsWzVdID09PSByWzVdKSAmJlxuICAgICAgICAgICAgICAgIChsWzZdID09PSByWzZdKSAmJlxuICAgICAgICAgICAgICAgIChsWzddID09PSByWzddKSAmJlxuICAgICAgICAgICAgICAgIChsWzhdID09PSByWzhdKSAmJlxuICAgICAgICAgICAgICAgIChsWzldID09PSByWzldKSAmJlxuICAgICAgICAgICAgICAgIChsWzEwXSA9PT0gclsxMF0pICYmXG4gICAgICAgICAgICAgICAgKGxbMTFdID09PSByWzExXSkgJiZcbiAgICAgICAgICAgICAgICAobFsxMl0gPT09IHJbMTJdKSAmJlxuICAgICAgICAgICAgICAgIChsWzEzXSA9PT0gclsxM10pICYmXG4gICAgICAgICAgICAgICAgKGxbMTRdID09PSByWzE0XSkgJiZcbiAgICAgICAgICAgICAgICAobFsxNV0gPT09IHJbMTVdKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHRoZSBzcGVjaWZpZWQgbWF0cml4IGlzIHRoZSBpZGVudGl0eSBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgbWF0cml4IGlzIGlkZW50aXR5IGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbWF0cml4IGlzIFwiICsgKG0uaXNJZGVudGl0eSgpID8gXCJpZGVudGl0eVwiIDogXCJub3QgaWRlbnRpdHlcIikpO1xuICAgICAqL1xuICAgIGlzSWRlbnRpdHkoKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgcmV0dXJuICgobVswXSA9PT0gMSkgJiZcbiAgICAgICAgICAgICAgICAobVsxXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsyXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVszXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs0XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs1XSA9PT0gMSkgJiZcbiAgICAgICAgICAgICAgICAobVs2XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs3XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs4XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs5XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsxMF0gPT09IDEpICYmXG4gICAgICAgICAgICAgICAgKG1bMTFdID09PSAwKSAmJlxuICAgICAgICAgICAgICAgIChtWzEyXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsxM10gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bMTRdID09PSAwKSAmJlxuICAgICAgICAgICAgICAgIChtWzE1XSA9PT0gMSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cmljZXMgdG9nZXRoZXIgYW5kIHN0b3JlcyB0aGUgcmVzdWx0IGluIHRoZSBjdXJyZW50XG4gICAgICogaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IGxocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICogdmFyIGIgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgMTgwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyByID0gYSAqIGJcbiAgICAgKiByLm11bDIoYSwgYik7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsMihsaHMsIHJocykge1xuICAgICAgICBjb25zdCBhID0gbGhzLmRhdGE7XG4gICAgICAgIGNvbnN0IGIgPSByaHMuZGF0YTtcbiAgICAgICAgY29uc3QgciA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCBhMDAgPSBhWzBdO1xuICAgICAgICBjb25zdCBhMDEgPSBhWzFdO1xuICAgICAgICBjb25zdCBhMDIgPSBhWzJdO1xuICAgICAgICBjb25zdCBhMDMgPSBhWzNdO1xuICAgICAgICBjb25zdCBhMTAgPSBhWzRdO1xuICAgICAgICBjb25zdCBhMTEgPSBhWzVdO1xuICAgICAgICBjb25zdCBhMTIgPSBhWzZdO1xuICAgICAgICBjb25zdCBhMTMgPSBhWzddO1xuICAgICAgICBjb25zdCBhMjAgPSBhWzhdO1xuICAgICAgICBjb25zdCBhMjEgPSBhWzldO1xuICAgICAgICBjb25zdCBhMjIgPSBhWzEwXTtcbiAgICAgICAgY29uc3QgYTIzID0gYVsxMV07XG4gICAgICAgIGNvbnN0IGEzMCA9IGFbMTJdO1xuICAgICAgICBjb25zdCBhMzEgPSBhWzEzXTtcbiAgICAgICAgY29uc3QgYTMyID0gYVsxNF07XG4gICAgICAgIGNvbnN0IGEzMyA9IGFbMTVdO1xuXG4gICAgICAgIGxldCBiMCwgYjEsIGIyLCBiMztcblxuICAgICAgICBiMCA9IGJbMF07XG4gICAgICAgIGIxID0gYlsxXTtcbiAgICAgICAgYjIgPSBiWzJdO1xuICAgICAgICBiMyA9IGJbM107XG4gICAgICAgIHJbMF0gID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyICsgYTMwICogYjM7XG4gICAgICAgIHJbMV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyICsgYTMxICogYjM7XG4gICAgICAgIHJbMl0gID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyICogYjM7XG4gICAgICAgIHJbM10gID0gYTAzICogYjAgKyBhMTMgKiBiMSArIGEyMyAqIGIyICsgYTMzICogYjM7XG5cbiAgICAgICAgYjAgPSBiWzRdO1xuICAgICAgICBiMSA9IGJbNV07XG4gICAgICAgIGIyID0gYls2XTtcbiAgICAgICAgYjMgPSBiWzddO1xuICAgICAgICByWzRdICA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMCAqIGIzO1xuICAgICAgICByWzVdICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMiArIGEzMSAqIGIzO1xuICAgICAgICByWzZdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMiAqIGIzO1xuICAgICAgICByWzddICA9IGEwMyAqIGIwICsgYTEzICogYjEgKyBhMjMgKiBiMiArIGEzMyAqIGIzO1xuXG4gICAgICAgIGIwID0gYls4XTtcbiAgICAgICAgYjEgPSBiWzldO1xuICAgICAgICBiMiA9IGJbMTBdO1xuICAgICAgICBiMyA9IGJbMTFdO1xuICAgICAgICByWzhdICA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMCAqIGIzO1xuICAgICAgICByWzldICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMiArIGEzMSAqIGIzO1xuICAgICAgICByWzEwXSA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMiAqIGIzO1xuICAgICAgICByWzExXSA9IGEwMyAqIGIwICsgYTEzICogYjEgKyBhMjMgKiBiMiArIGEzMyAqIGIzO1xuXG4gICAgICAgIGIwID0gYlsxMl07XG4gICAgICAgIGIxID0gYlsxM107XG4gICAgICAgIGIyID0gYlsxNF07XG4gICAgICAgIGIzID0gYlsxNV07XG4gICAgICAgIHJbMTJdID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyICsgYTMwICogYjM7XG4gICAgICAgIHJbMTNdID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyICsgYTMxICogYjM7XG4gICAgICAgIHJbMTRdID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyICogYjM7XG4gICAgICAgIHJbMTVdID0gYTAzICogYjAgKyBhMTMgKiBiMSArIGEyMyAqIGIyICsgYTMzICogYjM7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaWNlcyB0b2dldGhlciBhbmQgc3RvcmVzIHRoZSByZXN1bHQgaW4gdGhlIGN1cnJlbnRcbiAgICAgKiBpbnN0YW5jZS4gVGhpcyBmdW5jdGlvbiBhc3N1bWVzIHRoZSBtYXRyaWNlcyBhcmUgYWZmaW5lIHRyYW5zZm9ybWF0aW9uIG1hdHJpY2VzLCB3aGVyZSB0aGVcbiAgICAgKiB1cHBlciBsZWZ0IDN4MyBlbGVtZW50cyBhcmUgYSByb3RhdGlvbiBtYXRyaXgsIGFuZCB0aGUgYm90dG9tIGxlZnQgMyBlbGVtZW50cyBhcmVcbiAgICAgKiB0cmFuc2xhdGlvbi4gVGhlIHJpZ2h0bW9zdCBjb2x1bW4gaXMgYXNzdW1lZCB0byBiZSBbMCwgMCwgMCwgMV0uIFRoZSBwYXJhbWV0ZXJzIGFyZSBub3RcbiAgICAgKiB2ZXJpZmllZCB0byBiZSBpbiB0aGUgZXhwZWN0ZWQgZm9ybWF0LiBUaGlzIGZ1bmN0aW9uIGlzIGZhc3RlciB0aGFuIGdlbmVyYWxcbiAgICAgKiB7QGxpbmsgTWF0NCNtdWwyfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbGhzIC0gVGhlIGFmZmluZSB0cmFuc2Zvcm1hdGlvbiA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZlxuICAgICAqIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgYWZmaW5lIHRyYW5zZm9ybWF0aW9uIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZlxuICAgICAqIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIG11bEFmZmluZTIobGhzLCByaHMpIHtcbiAgICAgICAgY29uc3QgYSA9IGxocy5kYXRhO1xuICAgICAgICBjb25zdCBiID0gcmhzLmRhdGE7XG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgYTAwID0gYVswXTtcbiAgICAgICAgY29uc3QgYTAxID0gYVsxXTtcbiAgICAgICAgY29uc3QgYTAyID0gYVsyXTtcbiAgICAgICAgY29uc3QgYTEwID0gYVs0XTtcbiAgICAgICAgY29uc3QgYTExID0gYVs1XTtcbiAgICAgICAgY29uc3QgYTEyID0gYVs2XTtcbiAgICAgICAgY29uc3QgYTIwID0gYVs4XTtcbiAgICAgICAgY29uc3QgYTIxID0gYVs5XTtcbiAgICAgICAgY29uc3QgYTIyID0gYVsxMF07XG4gICAgICAgIGNvbnN0IGEzMCA9IGFbMTJdO1xuICAgICAgICBjb25zdCBhMzEgPSBhWzEzXTtcbiAgICAgICAgY29uc3QgYTMyID0gYVsxNF07XG5cbiAgICAgICAgbGV0IGIwLCBiMSwgYjI7XG5cbiAgICAgICAgYjAgPSBiWzBdO1xuICAgICAgICBiMSA9IGJbMV07XG4gICAgICAgIGIyID0gYlsyXTtcbiAgICAgICAgclswXSAgPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjI7XG4gICAgICAgIHJbMV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyO1xuICAgICAgICByWzJdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMjtcbiAgICAgICAgclszXSA9IDA7XG5cbiAgICAgICAgYjAgPSBiWzRdO1xuICAgICAgICBiMSA9IGJbNV07XG4gICAgICAgIGIyID0gYls2XTtcbiAgICAgICAgcls0XSAgPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjI7XG4gICAgICAgIHJbNV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyO1xuICAgICAgICByWzZdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMjtcbiAgICAgICAgcls3XSA9IDA7XG5cbiAgICAgICAgYjAgPSBiWzhdO1xuICAgICAgICBiMSA9IGJbOV07XG4gICAgICAgIGIyID0gYlsxMF07XG4gICAgICAgIHJbOF0gID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyO1xuICAgICAgICByWzldICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMjtcbiAgICAgICAgclsxMF0gPSBhMDIgKiBiMCArIGExMiAqIGIxICsgYTIyICogYjI7XG4gICAgICAgIHJbMTFdID0gMDtcblxuICAgICAgICBiMCA9IGJbMTJdO1xuICAgICAgICBiMSA9IGJbMTNdO1xuICAgICAgICBiMiA9IGJbMTRdO1xuICAgICAgICByWzEyXSA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMDtcbiAgICAgICAgclsxM10gPSBhMDEgKiBiMCArIGExMSAqIGIxICsgYTIxICogYjIgKyBhMzE7XG4gICAgICAgIHJbMTRdID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyO1xuICAgICAgICByWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyB0aGUgY3VycmVudCBpbnN0YW5jZSBieSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IHJocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBhID0gYSAqIGJcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm11bDIodGhpcywgcmhzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2Zvcm1zIGEgMy1kaW1lbnNpb25hbCBwb2ludCBieSBhIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHZlYyAtIFRoZSAzLWRpbWVuc2lvbmFsIHBvaW50IHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3Jlc10gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHBvaW50IHRvIHJlY2VpdmUgdGhlIHJlc3VsdCBvZiB0aGVcbiAgICAgKiB0cmFuc2Zvcm1hdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGlucHV0IHBvaW50IHYgdHJhbnNmb3JtZWQgYnkgdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSAzLWRpbWVuc2lvbmFsIHBvaW50XG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqXG4gICAgICogdmFyIHR2ID0gbS50cmFuc2Zvcm1Qb2ludCh2KTtcbiAgICAgKi9cbiAgICB0cmFuc2Zvcm1Qb2ludCh2ZWMsIHJlcyA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCB4ID0gdmVjLng7XG4gICAgICAgIGNvbnN0IHkgPSB2ZWMueTtcbiAgICAgICAgY29uc3QgeiA9IHZlYy56O1xuXG4gICAgICAgIHJlcy54ID0geCAqIG1bMF0gKyB5ICogbVs0XSArIHogKiBtWzhdICsgbVsxMl07XG4gICAgICAgIHJlcy55ID0geCAqIG1bMV0gKyB5ICogbVs1XSArIHogKiBtWzldICsgbVsxM107XG4gICAgICAgIHJlcy56ID0geCAqIG1bMl0gKyB5ICogbVs2XSArIHogKiBtWzEwXSArIG1bMTRdO1xuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGEgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gdmVjIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3Jlc10gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlXG4gICAgICogdHJhbnNmb3JtYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBpbnB1dCB2ZWN0b3IgdiB0cmFuc2Zvcm1lZCBieSB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDMtZGltZW5zaW9uYWwgdmVjdG9yXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqXG4gICAgICogdmFyIHR2ID0gbS50cmFuc2Zvcm1WZWN0b3Iodik7XG4gICAgICovXG4gICAgdHJhbnNmb3JtVmVjdG9yKHZlYywgcmVzID0gbmV3IFZlYzMoKSkge1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGNvbnN0IHggPSB2ZWMueDtcbiAgICAgICAgY29uc3QgeSA9IHZlYy55O1xuICAgICAgICBjb25zdCB6ID0gdmVjLno7XG5cbiAgICAgICAgcmVzLnggPSB4ICogbVswXSArIHkgKiBtWzRdICsgeiAqIG1bOF07XG4gICAgICAgIHJlcy55ID0geCAqIG1bMV0gKyB5ICogbVs1XSArIHogKiBtWzldO1xuICAgICAgICByZXMueiA9IHggKiBtWzJdICsgeSAqIG1bNl0gKyB6ICogbVsxMF07XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2Zvcm1zIGEgNC1kaW1lbnNpb25hbCB2ZWN0b3IgYnkgYSA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSB2ZWMgLSBUaGUgNC1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYmUgdHJhbnNmb3JtZWQuXG4gICAgICogQHBhcmFtIHtWZWM0fSBbcmVzXSAtIEFuIG9wdGlvbmFsIDQtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIHJlc3VsdCBvZiB0aGVcbiAgICAgKiB0cmFuc2Zvcm1hdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gVGhlIGlucHV0IHZlY3RvciB2IHRyYW5zZm9ybWVkIGJ5IHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGFuIGlucHV0IDQtZGltZW5zaW9uYWwgdmVjdG9yXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjNCgxLCAyLCAzLCA0KTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhbiBvdXRwdXQgNC1kaW1lbnNpb25hbCB2ZWN0b3JcbiAgICAgKiB2YXIgcmVzdWx0ID0gbmV3IHBjLlZlYzQoKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqXG4gICAgICogbS50cmFuc2Zvcm1WZWM0KHYsIHJlc3VsdCk7XG4gICAgICovXG4gICAgdHJhbnNmb3JtVmVjNCh2ZWMsIHJlcyA9IG5ldyBWZWM0KCkpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCB4ID0gdmVjLng7XG4gICAgICAgIGNvbnN0IHkgPSB2ZWMueTtcbiAgICAgICAgY29uc3QgeiA9IHZlYy56O1xuICAgICAgICBjb25zdCB3ID0gdmVjLnc7XG5cbiAgICAgICAgcmVzLnggPSB4ICogbVswXSArIHkgKiBtWzRdICsgeiAqIG1bOF0gKyB3ICogbVsxMl07XG4gICAgICAgIHJlcy55ID0geCAqIG1bMV0gKyB5ICogbVs1XSArIHogKiBtWzldICsgdyAqIG1bMTNdO1xuICAgICAgICByZXMueiA9IHggKiBtWzJdICsgeSAqIG1bNl0gKyB6ICogbVsxMF0gKyB3ICogbVsxNF07XG4gICAgICAgIHJlcy53ID0geCAqIG1bM10gKyB5ICogbVs3XSArIHogKiBtWzExXSArIHcgKiBtWzE1XTtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gYSB2aWV3aW5nIG1hdHJpeCBkZXJpdmVkIGZyb20gYW4gZXllIHBvaW50LCBhIHRhcmdldCBwb2ludCBhbmRcbiAgICAgKiBhbiB1cCB2ZWN0b3IuIFRoZSBtYXRyaXggbWFwcyB0aGUgdGFyZ2V0IHBvaW50IHRvIHRoZSBuZWdhdGl2ZSB6LWF4aXMgYW5kIHRoZSBleWUgcG9pbnQgdG9cbiAgICAgKiB0aGUgb3JpZ2luLCBzbyB0aGF0IHdoZW4geW91IHVzZSBhIHR5cGljYWwgcHJvamVjdGlvbiBtYXRyaXgsIHRoZSBjZW50ZXIgb2YgdGhlIHNjZW5lIG1hcHNcbiAgICAgKiB0byB0aGUgY2VudGVyIG9mIHRoZSB2aWV3cG9ydC4gU2ltaWxhcmx5LCB0aGUgZGlyZWN0aW9uIGRlc2NyaWJlZCBieSB0aGUgdXAgdmVjdG9yIHByb2plY3RlZFxuICAgICAqIG9udG8gdGhlIHZpZXdpbmcgcGxhbmUgaXMgbWFwcGVkIHRvIHRoZSBwb3NpdGl2ZSB5LWF4aXMgc28gdGhhdCBpdCBwb2ludHMgdXB3YXJkIGluIHRoZVxuICAgICAqIHZpZXdwb3J0LiBUaGUgdXAgdmVjdG9yIG11c3Qgbm90IGJlIHBhcmFsbGVsIHRvIHRoZSBsaW5lIG9mIHNpZ2h0IGZyb20gdGhlIGV5ZSB0byB0aGVcbiAgICAgKiByZWZlcmVuY2UgcG9pbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHBvc2l0aW9uIC0gMy1kIHZlY3RvciBob2xkaW5nIHZpZXcgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtWZWMzfSB0YXJnZXQgLSAzLWQgdmVjdG9yIGhvbGRpbmcgcmVmZXJlbmNlIHBvaW50LlxuICAgICAqIEBwYXJhbSB7VmVjM30gdXAgLSAzLWQgdmVjdG9yIGhvbGRpbmcgdGhlIHVwIGRpcmVjdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcG9zaXRpb24gPSBuZXcgcGMuVmVjMygxMCwgMTAsIDEwKTtcbiAgICAgKiB2YXIgdGFyZ2V0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIHVwID0gbmV3IHBjLlZlYzMoMCwgMSwgMCk7XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpLnNldExvb2tBdChwb3NpdGlvbiwgdGFyZ2V0LCB1cCk7XG4gICAgICovXG4gICAgc2V0TG9va0F0KHBvc2l0aW9uLCB0YXJnZXQsIHVwKSB7XG4gICAgICAgIHouc3ViMihwb3NpdGlvbiwgdGFyZ2V0KS5ub3JtYWxpemUoKTtcbiAgICAgICAgeS5jb3B5KHVwKS5ub3JtYWxpemUoKTtcbiAgICAgICAgeC5jcm9zcyh5LCB6KS5ub3JtYWxpemUoKTtcbiAgICAgICAgeS5jcm9zcyh6LCB4KTtcblxuICAgICAgICBjb25zdCByID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIHJbMF0gID0geC54O1xuICAgICAgICByWzFdICA9IHgueTtcbiAgICAgICAgclsyXSAgPSB4Lno7XG4gICAgICAgIHJbM10gID0gMDtcbiAgICAgICAgcls0XSAgPSB5Lng7XG4gICAgICAgIHJbNV0gID0geS55O1xuICAgICAgICByWzZdICA9IHkuejtcbiAgICAgICAgcls3XSAgPSAwO1xuICAgICAgICByWzhdICA9IHoueDtcbiAgICAgICAgcls5XSAgPSB6Lnk7XG4gICAgICAgIHJbMTBdID0gei56O1xuICAgICAgICByWzExXSA9IDA7XG4gICAgICAgIHJbMTJdID0gcG9zaXRpb24ueDtcbiAgICAgICAgclsxM10gPSBwb3NpdGlvbi55O1xuICAgICAgICByWzE0XSA9IHBvc2l0aW9uLno7XG4gICAgICAgIHJbMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgcGVyc3BlY3RpdmUgcHJvamVjdGlvbiBtYXRyaXguIFRoZSBmdW5jdGlvbidzIHBhcmFtZXRlcnNcbiAgICAgKiBkZWZpbmUgdGhlIHNoYXBlIG9mIGEgZnJ1c3R1bS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZWZ0IC0gVGhlIHgtY29vcmRpbmF0ZSBmb3IgdGhlIGxlZnQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmlnaHQgLSBUaGUgeC1jb29yZGluYXRlIGZvciB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYm90dG9tIC0gVGhlIHktY29vcmRpbmF0ZSBmb3IgdGhlIGJvdHRvbSBlZGdlIG9mIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uXG4gICAgICogcGxhbmUgaW4gZXllIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0b3AgLSBUaGUgeS1jb29yZGluYXRlIGZvciB0aGUgdG9wIGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmUgaW5cbiAgICAgKiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpuZWFyIC0gVGhlIG5lYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYXIgLSBUaGUgZmFyIGNsaXAgcGxhbmUgaW4gZXllIGNvb3JkaW5hdGVzLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAqIHZhciBmID0gcGMuTWF0NCgpLnNldEZydXN0dW0oLTIsIDIsIC0xLCAxLCAxLCAxMDAwKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0RnJ1c3R1bShsZWZ0LCByaWdodCwgYm90dG9tLCB0b3AsIHpuZWFyLCB6ZmFyKSB7XG4gICAgICAgIGNvbnN0IHRlbXAxID0gMiAqIHpuZWFyO1xuICAgICAgICBjb25zdCB0ZW1wMiA9IHJpZ2h0IC0gbGVmdDtcbiAgICAgICAgY29uc3QgdGVtcDMgPSB0b3AgLSBib3R0b207XG4gICAgICAgIGNvbnN0IHRlbXA0ID0gemZhciAtIHpuZWFyO1xuXG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLmRhdGE7XG4gICAgICAgIHJbMF0gPSB0ZW1wMSAvIHRlbXAyO1xuICAgICAgICByWzFdID0gMDtcbiAgICAgICAgclsyXSA9IDA7XG4gICAgICAgIHJbM10gPSAwO1xuICAgICAgICByWzRdID0gMDtcbiAgICAgICAgcls1XSA9IHRlbXAxIC8gdGVtcDM7XG4gICAgICAgIHJbNl0gPSAwO1xuICAgICAgICByWzddID0gMDtcbiAgICAgICAgcls4XSA9IChyaWdodCArIGxlZnQpIC8gdGVtcDI7XG4gICAgICAgIHJbOV0gPSAodG9wICsgYm90dG9tKSAvIHRlbXAzO1xuICAgICAgICByWzEwXSA9ICgtemZhciAtIHpuZWFyKSAvIHRlbXA0O1xuICAgICAgICByWzExXSA9IC0xO1xuICAgICAgICByWzEyXSA9IDA7XG4gICAgICAgIHJbMTNdID0gMDtcbiAgICAgICAgclsxNF0gPSAoLXRlbXAxICogemZhcikgLyB0ZW1wNDtcbiAgICAgICAgclsxNV0gPSAwO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gYSBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeC4gVGhlIGZ1bmN0aW9uJ3MgcGFyYW1ldGVyc1xuICAgICAqIGRlZmluZSB0aGUgc2hhcGUgb2YgYSBmcnVzdHVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZvdiAtIFRoZSBmcnVzdHVtJ3MgZmllbGQgb2YgdmlldyBpbiBkZWdyZWVzLiBUaGUgZm92SXNIb3Jpem9udGFsIHBhcmFtZXRlclxuICAgICAqIGNvbnRyb2xzIHdoZXRoZXIgdGhpcyBpcyBhIHZlcnRpY2FsIG9yIGhvcml6b250YWwgZmllbGQgb2Ygdmlldy4gQnkgZGVmYXVsdCwgaXQncyBhIHZlcnRpY2FsXG4gICAgICogZmllbGQgb2Ygdmlldy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYXNwZWN0IC0gVGhlIGFzcGVjdCByYXRpbyBvZiB0aGUgZnJ1c3R1bSdzIHByb2plY3Rpb24gcGxhbmVcbiAgICAgKiAod2lkdGggLyBoZWlnaHQpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6bmVhciAtIFRoZSBuZWFyIGNsaXAgcGxhbmUgaW4gZXllIGNvb3JkaW5hdGVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6ZmFyIC0gVGhlIGZhciBjbGlwIHBsYW5lIGluIGV5ZSBjb29yZGluYXRlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtmb3ZJc0hvcml6b250YWw9ZmFsc2VdIC0gU2V0IHRvIHRydWUgdG8gdHJlYXQgdGhlIGZvdiBhcyBob3Jpem9udGFsXG4gICAgICogKHgtYXhpcykgYW5kIGZhbHNlIGZvciB2ZXJ0aWNhbCAoeS1heGlzKS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHBlcnNwZWN0aXZlIHByb2plY3Rpb24gbWF0cml4XG4gICAgICogdmFyIHBlcnNwID0gcGMuTWF0NCgpLnNldFBlcnNwZWN0aXZlKDQ1LCAxNiAvIDksIDEsIDEwMDApO1xuICAgICAqL1xuICAgIHNldFBlcnNwZWN0aXZlKGZvdiwgYXNwZWN0LCB6bmVhciwgemZhciwgZm92SXNIb3Jpem9udGFsKSB7XG4gICAgICAgIE1hdDQuX2dldFBlcnNwZWN0aXZlSGFsZlNpemUoX2hhbGZTaXplLCBmb3YsIGFzcGVjdCwgem5lYXIsIGZvdklzSG9yaXpvbnRhbCk7XG4gICAgICAgIHJldHVybiB0aGlzLnNldEZydXN0dW0oLV9oYWxmU2l6ZS54LCBfaGFsZlNpemUueCwgLV9oYWxmU2l6ZS55LCBfaGFsZlNpemUueSwgem5lYXIsIHpmYXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gYW4gb3J0aG9ncmFwaGljIHByb2plY3Rpb24gbWF0cml4LiBUaGUgZnVuY3Rpb24ncyBwYXJhbWV0ZXJzXG4gICAgICogZGVmaW5lIHRoZSBzaGFwZSBvZiBhIGN1Ym9pZC1zaGFwZWQgZnJ1c3R1bS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZWZ0IC0gVGhlIHgtY29vcmRpbmF0ZSBmb3IgdGhlIGxlZnQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmlnaHQgLSBUaGUgeC1jb29yZGluYXRlIGZvciB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYm90dG9tIC0gVGhlIHktY29vcmRpbmF0ZSBmb3IgdGhlIGJvdHRvbSBlZGdlIG9mIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uXG4gICAgICogcGxhbmUgaW4gZXllIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0b3AgLSBUaGUgeS1jb29yZGluYXRlIGZvciB0aGUgdG9wIGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmUgaW5cbiAgICAgKiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5lYXIgLSBUaGUgbmVhciBjbGlwIHBsYW5lIGluIGV5ZSBjb29yZGluYXRlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFyIC0gVGhlIGZhciBjbGlwIHBsYW5lIGluIGV5ZSBjb29yZGluYXRlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgb3J0aG9ncmFwaGljIHByb2plY3Rpb24gbWF0cml4XG4gICAgICogdmFyIG9ydGhvID0gcGMuTWF0NCgpLm9ydGhvKC0yLCAyLCAtMiwgMiwgMSwgMTAwMCk7XG4gICAgICovXG4gICAgc2V0T3J0aG8obGVmdCwgcmlnaHQsIGJvdHRvbSwgdG9wLCBuZWFyLCBmYXIpIHtcbiAgICAgICAgY29uc3QgciA9IHRoaXMuZGF0YTtcblxuICAgICAgICByWzBdID0gMiAvIChyaWdodCAtIGxlZnQpO1xuICAgICAgICByWzFdID0gMDtcbiAgICAgICAgclsyXSA9IDA7XG4gICAgICAgIHJbM10gPSAwO1xuICAgICAgICByWzRdID0gMDtcbiAgICAgICAgcls1XSA9IDIgLyAodG9wIC0gYm90dG9tKTtcbiAgICAgICAgcls2XSA9IDA7XG4gICAgICAgIHJbN10gPSAwO1xuICAgICAgICByWzhdID0gMDtcbiAgICAgICAgcls5XSA9IDA7XG4gICAgICAgIHJbMTBdID0gLTIgLyAoZmFyIC0gbmVhcik7XG4gICAgICAgIHJbMTFdID0gMDtcbiAgICAgICAgclsxMl0gPSAtKHJpZ2h0ICsgbGVmdCkgLyAocmlnaHQgLSBsZWZ0KTtcbiAgICAgICAgclsxM10gPSAtKHRvcCArIGJvdHRvbSkgLyAodG9wIC0gYm90dG9tKTtcbiAgICAgICAgclsxNF0gPSAtKGZhciArIG5lYXIpIC8gKGZhciAtIG5lYXIpO1xuICAgICAgICByWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHJvdGF0aW9uIG1hdHJpeCBlcXVpdmFsZW50IHRvIGEgcm90YXRpb24gYXJvdW5kIGFuIGF4aXMuIFRoZVxuICAgICAqIGF4aXMgbXVzdCBiZSBub3JtYWxpemVkICh1bml0IGxlbmd0aCkgYW5kIHRoZSBhbmdsZSBtdXN0IGJlIHNwZWNpZmllZCBpbiBkZWdyZWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gVGhlIG5vcm1hbGl6ZWQgYXhpcyB2ZWN0b3IgYXJvdW5kIHdoaWNoIHRvIHJvdGF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYW5nbGUgLSBUaGUgYW5nbGUgb2Ygcm90YXRpb24gaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogdmFyIHJtID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDkwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tQXhpc0FuZ2xlKGF4aXMsIGFuZ2xlKSB7XG4gICAgICAgIGFuZ2xlICo9IG1hdGguREVHX1RPX1JBRDtcblxuICAgICAgICBjb25zdCB4ID0gYXhpcy54O1xuICAgICAgICBjb25zdCB5ID0gYXhpcy55O1xuICAgICAgICBjb25zdCB6ID0gYXhpcy56O1xuICAgICAgICBjb25zdCBjID0gTWF0aC5jb3MoYW5nbGUpO1xuICAgICAgICBjb25zdCBzID0gTWF0aC5zaW4oYW5nbGUpO1xuICAgICAgICBjb25zdCB0ID0gMSAtIGM7XG4gICAgICAgIGNvbnN0IHR4ID0gdCAqIHg7XG4gICAgICAgIGNvbnN0IHR5ID0gdCAqIHk7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9IHR4ICogeCArIGM7XG4gICAgICAgIG1bMV0gPSB0eCAqIHkgKyBzICogejtcbiAgICAgICAgbVsyXSA9IHR4ICogeiAtIHMgKiB5O1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IHR4ICogeSAtIHMgKiB6O1xuICAgICAgICBtWzVdID0gdHkgKiB5ICsgYztcbiAgICAgICAgbVs2XSA9IHR5ICogeiArIHMgKiB4O1xuICAgICAgICBtWzddID0gMDtcbiAgICAgICAgbVs4XSA9IHR4ICogeiArIHMgKiB5O1xuICAgICAgICBtWzldID0gdHkgKiB6IC0geCAqIHM7XG4gICAgICAgIG1bMTBdID0gdCAqIHogKiB6ICsgYztcbiAgICAgICAgbVsxMV0gPSAwO1xuICAgICAgICBtWzEyXSA9IDA7XG4gICAgICAgIG1bMTNdID0gMDtcbiAgICAgICAgbVsxNF0gPSAwO1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHRyYW5zbGF0aW9uIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHgtY29tcG9uZW50IG9mIHRoZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHRyYW5zbGF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCB0cmFuc2xhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgdG0gPSBuZXcgcGMuTWF0NCgpLnNldFRyYW5zbGF0ZSgxMCwgMTAsIDEwKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VHJhbnNsYXRlKHgsIHksIHopIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0gMTtcbiAgICAgICAgbVsxXSA9IDA7XG4gICAgICAgIG1bMl0gPSAwO1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IDA7XG4gICAgICAgIG1bNV0gPSAxO1xuICAgICAgICBtWzZdID0gMDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSAwO1xuICAgICAgICBtWzldID0gMDtcbiAgICAgICAgbVsxMF0gPSAxO1xuICAgICAgICBtWzExXSA9IDA7XG4gICAgICAgIG1bMTJdID0geDtcbiAgICAgICAgbVsxM10gPSB5O1xuICAgICAgICBtWzE0XSA9IHo7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgc2NhbGUgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb21wb25lbnQgb2YgdGhlIHNjYWxlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgc2NhbGUuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHNjYWxlIG1hdHJpeFxuICAgICAqIHZhciBzbSA9IG5ldyBwYy5NYXQ0KCkuc2V0U2NhbGUoMTAsIDEwLCAxMCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFNjYWxlKHgsIHksIHopIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0geDtcbiAgICAgICAgbVsxXSA9IDA7XG4gICAgICAgIG1bMl0gPSAwO1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IDA7XG4gICAgICAgIG1bNV0gPSB5O1xuICAgICAgICBtWzZdID0gMDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSAwO1xuICAgICAgICBtWzldID0gMDtcbiAgICAgICAgbVsxMF0gPSB6O1xuICAgICAgICBtWzExXSA9IDA7XG4gICAgICAgIG1bMTJdID0gMDtcbiAgICAgICAgbVsxM10gPSAwO1xuICAgICAgICBtWzE0XSA9IDA7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgbWF0cml4IHRyYW5zZm9ybWluZyBhIG5vcm1hbGl6ZWQgdmlldyB2b2x1bWUgKGluIHJhbmdlIG9mXG4gICAgICogLTEgLi4gMSkgdG8gdGhlaXIgcG9zaXRpb24gaW5zaWRlIGEgdmlld3BvcnQgKGluIHJhbmdlIG9mIDAgLi4gMSkuIFRoaXMgZW5jYXBzdWxhdGVzIGFcbiAgICAgKiBzY2FsaW5nIHRvIHRoZSBzaXplIG9mIHRoZSB2aWV3cG9ydCBhbmQgYSB0cmFuc2xhdGlvbiB0byB0aGUgcG9zaXRpb24gb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb21wb25lbnQgb2YgdGhlIHBvc2l0aW9uIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHBvc2l0aW9uIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIHdpZHRoIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBoZWlnaHQgb2YgdGhlIHZpZXdwb3J0IChpbiAwLi4xIHJhbmdlKS5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgdmlld3BvcnQgbWF0cml4IHdoaWNoIHNjYWxlcyBub3JtYWxpemVkIHZpZXcgdm9sdW1lIHRvIGZ1bGwgdGV4dHVyZSB2aWV3cG9ydFxuICAgICAqIHZhciB2bSA9IG5ldyBwYy5NYXQ0KCkuc2V0Vmlld3BvcnQoMCwgMCwgMSwgMSk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFZpZXdwb3J0KHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0gd2lkdGggKiAwLjU7XG4gICAgICAgIG1bMV0gPSAwO1xuICAgICAgICBtWzJdID0gMDtcbiAgICAgICAgbVszXSA9IDA7XG4gICAgICAgIG1bNF0gPSAwO1xuICAgICAgICBtWzVdID0gaGVpZ2h0ICogMC41O1xuICAgICAgICBtWzZdID0gMDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSAwO1xuICAgICAgICBtWzldID0gMDtcbiAgICAgICAgbVsxMF0gPSAwLjU7XG4gICAgICAgIG1bMTFdID0gMDtcbiAgICAgICAgbVsxMl0gPSB4ICsgd2lkdGggKiAwLjU7XG4gICAgICAgIG1bMTNdID0geSArIGhlaWdodCAqIDAuNTtcbiAgICAgICAgbVsxNF0gPSAwLjU7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGl0cyBpbnZlcnNlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeCBvZiAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciByb3QgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgMTgwKTtcbiAgICAgKlxuICAgICAqIC8vIEludmVydCBpbiBwbGFjZVxuICAgICAqIHJvdC5pbnZlcnQoKTtcbiAgICAgKi9cbiAgICBpbnZlcnQoKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgYTAwID0gbVswXTtcbiAgICAgICAgY29uc3QgYTAxID0gbVsxXTtcbiAgICAgICAgY29uc3QgYTAyID0gbVsyXTtcbiAgICAgICAgY29uc3QgYTAzID0gbVszXTtcbiAgICAgICAgY29uc3QgYTEwID0gbVs0XTtcbiAgICAgICAgY29uc3QgYTExID0gbVs1XTtcbiAgICAgICAgY29uc3QgYTEyID0gbVs2XTtcbiAgICAgICAgY29uc3QgYTEzID0gbVs3XTtcbiAgICAgICAgY29uc3QgYTIwID0gbVs4XTtcbiAgICAgICAgY29uc3QgYTIxID0gbVs5XTtcbiAgICAgICAgY29uc3QgYTIyID0gbVsxMF07XG4gICAgICAgIGNvbnN0IGEyMyA9IG1bMTFdO1xuICAgICAgICBjb25zdCBhMzAgPSBtWzEyXTtcbiAgICAgICAgY29uc3QgYTMxID0gbVsxM107XG4gICAgICAgIGNvbnN0IGEzMiA9IG1bMTRdO1xuICAgICAgICBjb25zdCBhMzMgPSBtWzE1XTtcblxuICAgICAgICBjb25zdCBiMDAgPSBhMDAgKiBhMTEgLSBhMDEgKiBhMTA7XG4gICAgICAgIGNvbnN0IGIwMSA9IGEwMCAqIGExMiAtIGEwMiAqIGExMDtcbiAgICAgICAgY29uc3QgYjAyID0gYTAwICogYTEzIC0gYTAzICogYTEwO1xuICAgICAgICBjb25zdCBiMDMgPSBhMDEgKiBhMTIgLSBhMDIgKiBhMTE7XG4gICAgICAgIGNvbnN0IGIwNCA9IGEwMSAqIGExMyAtIGEwMyAqIGExMTtcbiAgICAgICAgY29uc3QgYjA1ID0gYTAyICogYTEzIC0gYTAzICogYTEyO1xuICAgICAgICBjb25zdCBiMDYgPSBhMjAgKiBhMzEgLSBhMjEgKiBhMzA7XG4gICAgICAgIGNvbnN0IGIwNyA9IGEyMCAqIGEzMiAtIGEyMiAqIGEzMDtcbiAgICAgICAgY29uc3QgYjA4ID0gYTIwICogYTMzIC0gYTIzICogYTMwO1xuICAgICAgICBjb25zdCBiMDkgPSBhMjEgKiBhMzIgLSBhMjIgKiBhMzE7XG4gICAgICAgIGNvbnN0IGIxMCA9IGEyMSAqIGEzMyAtIGEyMyAqIGEzMTtcbiAgICAgICAgY29uc3QgYjExID0gYTIyICogYTMzIC0gYTIzICogYTMyO1xuXG4gICAgICAgIGNvbnN0IGRldCA9IChiMDAgKiBiMTEgLSBiMDEgKiBiMTAgKyBiMDIgKiBiMDkgKyBiMDMgKiBiMDggLSBiMDQgKiBiMDcgKyBiMDUgKiBiMDYpO1xuICAgICAgICBpZiAoZGV0ID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnNldElkZW50aXR5KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBpbnZEZXQgPSAxIC8gZGV0O1xuXG4gICAgICAgICAgICBtWzBdID0gKGExMSAqIGIxMSAtIGExMiAqIGIxMCArIGExMyAqIGIwOSkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzFdID0gKC1hMDEgKiBiMTEgKyBhMDIgKiBiMTAgLSBhMDMgKiBiMDkpICogaW52RGV0O1xuICAgICAgICAgICAgbVsyXSA9IChhMzEgKiBiMDUgLSBhMzIgKiBiMDQgKyBhMzMgKiBiMDMpICogaW52RGV0O1xuICAgICAgICAgICAgbVszXSA9ICgtYTIxICogYjA1ICsgYTIyICogYjA0IC0gYTIzICogYjAzKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bNF0gPSAoLWExMCAqIGIxMSArIGExMiAqIGIwOCAtIGExMyAqIGIwNykgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzVdID0gKGEwMCAqIGIxMSAtIGEwMiAqIGIwOCArIGEwMyAqIGIwNykgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzZdID0gKC1hMzAgKiBiMDUgKyBhMzIgKiBiMDIgLSBhMzMgKiBiMDEpICogaW52RGV0O1xuICAgICAgICAgICAgbVs3XSA9IChhMjAgKiBiMDUgLSBhMjIgKiBiMDIgKyBhMjMgKiBiMDEpICogaW52RGV0O1xuICAgICAgICAgICAgbVs4XSA9IChhMTAgKiBiMTAgLSBhMTEgKiBiMDggKyBhMTMgKiBiMDYpICogaW52RGV0O1xuICAgICAgICAgICAgbVs5XSA9ICgtYTAwICogYjEwICsgYTAxICogYjA4IC0gYTAzICogYjA2KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTBdID0gKGEzMCAqIGIwNCAtIGEzMSAqIGIwMiArIGEzMyAqIGIwMCkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzExXSA9ICgtYTIwICogYjA0ICsgYTIxICogYjAyIC0gYTIzICogYjAwKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTJdID0gKC1hMTAgKiBiMDkgKyBhMTEgKiBiMDcgLSBhMTIgKiBiMDYpICogaW52RGV0O1xuICAgICAgICAgICAgbVsxM10gPSAoYTAwICogYjA5IC0gYTAxICogYjA3ICsgYTAyICogYjA2KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTRdID0gKC1hMzAgKiBiMDMgKyBhMzEgKiBiMDEgLSBhMzIgKiBiMDApICogaW52RGV0O1xuICAgICAgICAgICAgbVsxNV0gPSAoYTIwICogYjAzIC0gYTIxICogYjAxICsgYTIyICogYjAwKSAqIGludkRldDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgbWF0cml4IGRhdGEgZnJvbSBhbiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNyYyAtIFNvdXJjZSBhcnJheS4gTXVzdCBoYXZlIDE2IHZhbHVlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgc2V0KHNyYykge1xuICAgICAgICBjb25zdCBkc3QgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgZHN0WzBdID0gc3JjWzBdO1xuICAgICAgICBkc3RbMV0gPSBzcmNbMV07XG4gICAgICAgIGRzdFsyXSA9IHNyY1syXTtcbiAgICAgICAgZHN0WzNdID0gc3JjWzNdO1xuICAgICAgICBkc3RbNF0gPSBzcmNbNF07XG4gICAgICAgIGRzdFs1XSA9IHNyY1s1XTtcbiAgICAgICAgZHN0WzZdID0gc3JjWzZdO1xuICAgICAgICBkc3RbN10gPSBzcmNbN107XG4gICAgICAgIGRzdFs4XSA9IHNyY1s4XTtcbiAgICAgICAgZHN0WzldID0gc3JjWzldO1xuICAgICAgICBkc3RbMTBdID0gc3JjWzEwXTtcbiAgICAgICAgZHN0WzExXSA9IHNyY1sxMV07XG4gICAgICAgIGRzdFsxMl0gPSBzcmNbMTJdO1xuICAgICAgICBkc3RbMTNdID0gc3JjWzEzXTtcbiAgICAgICAgZHN0WzE0XSA9IHNyY1sxNF07XG4gICAgICAgIGRzdFsxNV0gPSBzcmNbMTVdO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gdGhlIGlkZW50aXR5IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG0uc2V0SWRlbnRpdHkoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBtYXRyaXggaXMgXCIgKyAobS5pc0lkZW50aXR5KCkgPyBcImlkZW50aXR5XCIgOiBcIm5vdCBpZGVudGl0eVwiKSk7XG4gICAgICovXG4gICAgc2V0SWRlbnRpdHkoKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9IDE7XG4gICAgICAgIG1bMV0gPSAwO1xuICAgICAgICBtWzJdID0gMDtcbiAgICAgICAgbVszXSA9IDA7XG4gICAgICAgIG1bNF0gPSAwO1xuICAgICAgICBtWzVdID0gMTtcbiAgICAgICAgbVs2XSA9IDA7XG4gICAgICAgIG1bN10gPSAwO1xuICAgICAgICBtWzhdID0gMDtcbiAgICAgICAgbVs5XSA9IDA7XG4gICAgICAgIG1bMTBdID0gMTtcbiAgICAgICAgbVsxMV0gPSAwO1xuICAgICAgICBtWzEyXSA9IDA7XG4gICAgICAgIG1bMTNdID0gMDtcbiAgICAgICAgbVsxNF0gPSAwO1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byB0aGUgY29uY2F0ZW5hdGlvbiBvZiBhIHRyYW5zbGF0aW9uLCBhIHF1YXRlcm5pb24gcm90YXRpb24gYW5kIGFcbiAgICAgKiBzY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gdCAtIEEgMy1kIHZlY3RvciB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9xdWF0LmpzJykuUXVhdH0gciAtIEEgcXVhdGVybmlvbiByb3RhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHMgLSBBIDMtZCB2ZWN0b3Igc2NhbGUuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHQgPSBuZXcgcGMuVmVjMygxMCwgMjAsIDMwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogdmFyIHMgPSBuZXcgcGMuVmVjMygyLCAyLCAyKTtcbiAgICAgKlxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiBtLnNldFRSUyh0LCByLCBzKTtcbiAgICAgKi9cbiAgICBzZXRUUlModCwgciwgcykge1xuICAgICAgICBjb25zdCBxeCA9IHIueDtcbiAgICAgICAgY29uc3QgcXkgPSByLnk7XG4gICAgICAgIGNvbnN0IHF6ID0gci56O1xuICAgICAgICBjb25zdCBxdyA9IHIudztcblxuICAgICAgICBjb25zdCBzeCA9IHMueDtcbiAgICAgICAgY29uc3Qgc3kgPSBzLnk7XG4gICAgICAgIGNvbnN0IHN6ID0gcy56O1xuXG4gICAgICAgIGNvbnN0IHgyID0gcXggKyBxeDtcbiAgICAgICAgY29uc3QgeTIgPSBxeSArIHF5O1xuICAgICAgICBjb25zdCB6MiA9IHF6ICsgcXo7XG4gICAgICAgIGNvbnN0IHh4ID0gcXggKiB4MjtcbiAgICAgICAgY29uc3QgeHkgPSBxeCAqIHkyO1xuICAgICAgICBjb25zdCB4eiA9IHF4ICogejI7XG4gICAgICAgIGNvbnN0IHl5ID0gcXkgKiB5MjtcbiAgICAgICAgY29uc3QgeXogPSBxeSAqIHoyO1xuICAgICAgICBjb25zdCB6eiA9IHF6ICogejI7XG4gICAgICAgIGNvbnN0IHd4ID0gcXcgKiB4MjtcbiAgICAgICAgY29uc3Qgd3kgPSBxdyAqIHkyO1xuICAgICAgICBjb25zdCB3eiA9IHF3ICogejI7XG5cbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0gKDEgLSAoeXkgKyB6eikpICogc3g7XG4gICAgICAgIG1bMV0gPSAoeHkgKyB3eikgKiBzeDtcbiAgICAgICAgbVsyXSA9ICh4eiAtIHd5KSAqIHN4O1xuICAgICAgICBtWzNdID0gMDtcblxuICAgICAgICBtWzRdID0gKHh5IC0gd3opICogc3k7XG4gICAgICAgIG1bNV0gPSAoMSAtICh4eCArIHp6KSkgKiBzeTtcbiAgICAgICAgbVs2XSA9ICh5eiArIHd4KSAqIHN5O1xuICAgICAgICBtWzddID0gMDtcblxuICAgICAgICBtWzhdID0gKHh6ICsgd3kpICogc3o7XG4gICAgICAgIG1bOV0gPSAoeXogLSB3eCkgKiBzejtcbiAgICAgICAgbVsxMF0gPSAoMSAtICh4eCArIHl5KSkgKiBzejtcbiAgICAgICAgbVsxMV0gPSAwO1xuXG4gICAgICAgIG1bMTJdID0gdC54O1xuICAgICAgICBtWzEzXSA9IHQueTtcbiAgICAgICAgbVsxNF0gPSB0Lno7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGl0cyB0cmFuc3Bvc2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyBUcmFuc3Bvc2UgaW4gcGxhY2VcbiAgICAgKiBtLnRyYW5zcG9zZSgpO1xuICAgICAqL1xuICAgIHRyYW5zcG9zZSgpIHtcbiAgICAgICAgbGV0IHRtcDtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICB0bXAgPSBtWzFdO1xuICAgICAgICBtWzFdID0gbVs0XTtcbiAgICAgICAgbVs0XSA9IHRtcDtcblxuICAgICAgICB0bXAgPSBtWzJdO1xuICAgICAgICBtWzJdID0gbVs4XTtcbiAgICAgICAgbVs4XSA9IHRtcDtcblxuICAgICAgICB0bXAgPSBtWzNdO1xuICAgICAgICBtWzNdID0gbVsxMl07XG4gICAgICAgIG1bMTJdID0gdG1wO1xuXG4gICAgICAgIHRtcCA9IG1bNl07XG4gICAgICAgIG1bNl0gPSBtWzldO1xuICAgICAgICBtWzldID0gdG1wO1xuXG4gICAgICAgIHRtcCA9IG1bN107XG4gICAgICAgIG1bN10gPSBtWzEzXTtcbiAgICAgICAgbVsxM10gPSB0bXA7XG5cbiAgICAgICAgdG1wID0gbVsxMV07XG4gICAgICAgIG1bMTFdID0gbVsxNF07XG4gICAgICAgIG1bMTRdID0gdG1wO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGludmVydFRvM3gzKHJlcykge1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuICAgICAgICBjb25zdCByID0gcmVzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgbTAgPSBtWzBdO1xuICAgICAgICBjb25zdCBtMSA9IG1bMV07XG4gICAgICAgIGNvbnN0IG0yID0gbVsyXTtcblxuICAgICAgICBjb25zdCBtNCA9IG1bNF07XG4gICAgICAgIGNvbnN0IG01ID0gbVs1XTtcbiAgICAgICAgY29uc3QgbTYgPSBtWzZdO1xuXG4gICAgICAgIGNvbnN0IG04ID0gbVs4XTtcbiAgICAgICAgY29uc3QgbTkgPSBtWzldO1xuICAgICAgICBjb25zdCBtMTAgPSBtWzEwXTtcblxuICAgICAgICBjb25zdCBhMTEgPSAgbTEwICogbTUgLSBtNiAqIG05O1xuICAgICAgICBjb25zdCBhMjEgPSAtbTEwICogbTEgKyBtMiAqIG05O1xuICAgICAgICBjb25zdCBhMzEgPSAgbTYgICogbTEgLSBtMiAqIG01O1xuICAgICAgICBjb25zdCBhMTIgPSAtbTEwICogbTQgKyBtNiAqIG04O1xuICAgICAgICBjb25zdCBhMjIgPSAgbTEwICogbTAgLSBtMiAqIG04O1xuICAgICAgICBjb25zdCBhMzIgPSAtbTYgICogbTAgKyBtMiAqIG00O1xuICAgICAgICBjb25zdCBhMTMgPSAgbTkgICogbTQgLSBtNSAqIG04O1xuICAgICAgICBjb25zdCBhMjMgPSAtbTkgICogbTAgKyBtMSAqIG04O1xuICAgICAgICBjb25zdCBhMzMgPSAgbTUgICogbTAgLSBtMSAqIG00O1xuXG4gICAgICAgIGNvbnN0IGRldCA9ICBtMCAqIGExMSArIG0xICogYTEyICsgbTIgKiBhMTM7XG4gICAgICAgIGlmIChkZXQgPT09IDApIHsgLy8gbm8gaW52ZXJzZVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpZGV0ID0gMSAvIGRldDtcblxuICAgICAgICByWzBdID0gaWRldCAqIGExMTtcbiAgICAgICAgclsxXSA9IGlkZXQgKiBhMjE7XG4gICAgICAgIHJbMl0gPSBpZGV0ICogYTMxO1xuICAgICAgICByWzNdID0gaWRldCAqIGExMjtcbiAgICAgICAgcls0XSA9IGlkZXQgKiBhMjI7XG4gICAgICAgIHJbNV0gPSBpZGV0ICogYTMyO1xuICAgICAgICByWzZdID0gaWRldCAqIGExMztcbiAgICAgICAgcls3XSA9IGlkZXQgKiBhMjM7XG4gICAgICAgIHJbOF0gPSBpZGV0ICogYTMzO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSB0cmFuc2xhdGlvbmFsIGNvbXBvbmVudCBmcm9tIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3RdIC0gVGhlIHZlY3RvciB0byByZWNlaXZlIHRoZSB0cmFuc2xhdGlvbiBvZiB0aGUgbWF0cml4LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgdHJhbnNsYXRpb24gb2YgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IG1hdHJpeFxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIC8vIFF1ZXJ5IHRoZSB0cmFuc2xhdGlvbiBjb21wb25lbnRcbiAgICAgKiB2YXIgdCA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogbS5nZXRUcmFuc2xhdGlvbih0KTtcbiAgICAgKi9cbiAgICBnZXRUcmFuc2xhdGlvbih0ID0gbmV3IFZlYzMoKSkge1xuICAgICAgICByZXR1cm4gdC5zZXQodGhpcy5kYXRhWzEyXSwgdGhpcy5kYXRhWzEzXSwgdGhpcy5kYXRhWzE0XSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdHMgdGhlIHgtYXhpcyBmcm9tIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3hdIC0gVGhlIHZlY3RvciB0byByZWNlaXZlIHRoZSB4IGF4aXMgb2YgdGhlIG1hdHJpeC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHgtYXhpcyBvZiB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgbWF0cml4XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogLy8gUXVlcnkgdGhlIHgtYXhpcyBjb21wb25lbnRcbiAgICAgKiB2YXIgeCA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogbS5nZXRYKHgpO1xuICAgICAqL1xuICAgIGdldFgoeCA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgcmV0dXJuIHguc2V0KHRoaXMuZGF0YVswXSwgdGhpcy5kYXRhWzFdLCB0aGlzLmRhdGFbMl0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSB5LWF4aXMgZnJvbSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFt5XSAtIFRoZSB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgeSBheGlzIG9mIHRoZSBtYXRyaXguXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB5LWF4aXMgb2YgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IG1hdHJpeFxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIC8vIFF1ZXJ5IHRoZSB5LWF4aXMgY29tcG9uZW50XG4gICAgICogdmFyIHkgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIG0uZ2V0WSh5KTtcbiAgICAgKi9cbiAgICBnZXRZKHkgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHJldHVybiB5LnNldCh0aGlzLmRhdGFbNF0sIHRoaXMuZGF0YVs1XSwgdGhpcy5kYXRhWzZdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyB0aGUgei1heGlzIGZyb20gdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbel0gLSBUaGUgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIHogYXhpcyBvZiB0aGUgbWF0cml4LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgei1heGlzIG9mIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyBRdWVyeSB0aGUgei1heGlzIGNvbXBvbmVudFxuICAgICAqIHZhciB6ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBtLmdldFooeik7XG4gICAgICovXG4gICAgZ2V0Wih6ID0gbmV3IFZlYzMoKSkge1xuICAgICAgICByZXR1cm4gei5zZXQodGhpcy5kYXRhWzhdLCB0aGlzLmRhdGFbOV0sIHRoaXMuZGF0YVsxMF0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSBzY2FsZSBjb21wb25lbnQgZnJvbSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtzY2FsZV0gLSBWZWN0b3IgdG8gcmVjZWl2ZSB0aGUgc2NhbGUuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBzY2FsZSBpbiBYLCBZIGFuZCBaIG9mIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFF1ZXJ5IHRoZSBzY2FsZSBjb21wb25lbnRcbiAgICAgKiB2YXIgc2NhbGUgPSBtLmdldFNjYWxlKCk7XG4gICAgICovXG4gICAgZ2V0U2NhbGUoc2NhbGUgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHRoaXMuZ2V0WCh4KTtcbiAgICAgICAgdGhpcy5nZXRZKHkpO1xuICAgICAgICB0aGlzLmdldFooeik7XG4gICAgICAgIHNjYWxlLnNldCh4Lmxlbmd0aCgpLCB5Lmxlbmd0aCgpLCB6Lmxlbmd0aCgpKTtcblxuICAgICAgICByZXR1cm4gc2NhbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHJvdGF0aW9uIG1hdHJpeCBkZWZpbmVkIGJ5IEV1bGVyIGFuZ2xlcy4gVGhlIEV1bGVyIGFuZ2xlcyBhcmVcbiAgICAgKiBzcGVjaWZpZWQgaW4gWFlaIG9yZGVyIGFuZCBpbiBkZWdyZWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGV4IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBYIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZXkgLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFkgYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBleiAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWiBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqIG0uc2V0RnJvbUV1bGVyQW5nbGVzKDQ1LCA5MCwgMTgwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tRXVsZXJBbmdsZXMoZXgsIGV5LCBleikge1xuICAgICAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1JvdGF0aW9uX21hdHJpeCNDb252ZXJzaW9uX2Zyb21fYW5kX3RvX2F4aXMtYW5nbGVcbiAgICAgICAgLy8gVGhlIDNEIHNwYWNlIGlzIHJpZ2h0LWhhbmRlZCwgc28gdGhlIHJvdGF0aW9uIGFyb3VuZCBlYWNoIGF4aXMgd2lsbCBiZSBjb3VudGVyY2xvY2t3aXNlXG4gICAgICAgIC8vIGZvciBhbiBvYnNlcnZlciBwbGFjZWQgc28gdGhhdCB0aGUgYXhpcyBnb2VzIGluIGhpcyBvciBoZXIgZGlyZWN0aW9uIChSaWdodC1oYW5kIHJ1bGUpLlxuICAgICAgICBleCAqPSBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGV5ICo9IG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgZXogKj0gbWF0aC5ERUdfVE9fUkFEO1xuXG4gICAgICAgIC8vIFNvbHV0aW9uIHRha2VuIGZyb20gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9FdWxlcl9hbmdsZXMjTWF0cml4X29yaWVudGF0aW9uXG4gICAgICAgIGNvbnN0IHMxID0gTWF0aC5zaW4oLWV4KTtcbiAgICAgICAgY29uc3QgYzEgPSBNYXRoLmNvcygtZXgpO1xuICAgICAgICBjb25zdCBzMiA9IE1hdGguc2luKC1leSk7XG4gICAgICAgIGNvbnN0IGMyID0gTWF0aC5jb3MoLWV5KTtcbiAgICAgICAgY29uc3QgczMgPSBNYXRoLnNpbigtZXopO1xuICAgICAgICBjb25zdCBjMyA9IE1hdGguY29zKC1leik7XG5cbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICAvLyBTZXQgcm90YXRpb24gZWxlbWVudHNcbiAgICAgICAgbVswXSA9IGMyICogYzM7XG4gICAgICAgIG1bMV0gPSAtYzIgKiBzMztcbiAgICAgICAgbVsyXSA9IHMyO1xuICAgICAgICBtWzNdID0gMDtcblxuICAgICAgICBtWzRdID0gYzEgKiBzMyArIGMzICogczEgKiBzMjtcbiAgICAgICAgbVs1XSA9IGMxICogYzMgLSBzMSAqIHMyICogczM7XG4gICAgICAgIG1bNl0gPSAtYzIgKiBzMTtcbiAgICAgICAgbVs3XSA9IDA7XG5cbiAgICAgICAgbVs4XSA9IHMxICogczMgLSBjMSAqIGMzICogczI7XG4gICAgICAgIG1bOV0gPSBjMyAqIHMxICsgYzEgKiBzMiAqIHMzO1xuICAgICAgICBtWzEwXSA9IGMxICogYzI7XG4gICAgICAgIG1bMTFdID0gMDtcblxuICAgICAgICBtWzEyXSA9IDA7XG4gICAgICAgIG1bMTNdID0gMDtcbiAgICAgICAgbVsxNF0gPSAwO1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdHMgdGhlIEV1bGVyIGFuZ2xlcyBlcXVpdmFsZW50IHRvIHRoZSByb3RhdGlvbmFsIHBvcnRpb24gb2YgdGhlIHNwZWNpZmllZCBtYXRyaXguIFRoZVxuICAgICAqIHJldHVybmVkIEV1bGVyIGFuZ2xlcyBhcmUgaW4gWFlaIG9yZGVyIGFuIGluIGRlZ3JlZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtldWxlcnNdIC0gQSAzLWQgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIEV1bGVyIGFuZ2xlcy5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gQSAzLWQgdmVjdG9yIGNvbnRhaW5pbmcgdGhlIEV1bGVyIGFuZ2xlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXggb2YgNDUgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDQ1KTtcbiAgICAgKlxuICAgICAqIHZhciBldWxlcnMgPSBtLmdldEV1bGVyQW5nbGVzKCk7XG4gICAgICovXG4gICAgZ2V0RXVsZXJBbmdsZXMoZXVsZXJzID0gbmV3IFZlYzMoKSkge1xuICAgICAgICB0aGlzLmdldFNjYWxlKHNjYWxlKTtcbiAgICAgICAgY29uc3Qgc3ggPSBzY2FsZS54O1xuICAgICAgICBjb25zdCBzeSA9IHNjYWxlLnk7XG4gICAgICAgIGNvbnN0IHN6ID0gc2NhbGUuejtcblxuICAgICAgICBpZiAoc3ggPT09IDAgfHwgc3kgPT09IDAgfHwgc3ogPT09IDApXG4gICAgICAgICAgICByZXR1cm4gZXVsZXJzLnNldCgwLCAwLCAwKTtcblxuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGNvbnN0IHkgPSBNYXRoLmFzaW4oLW1bMl0gLyBzeCk7XG4gICAgICAgIGNvbnN0IGhhbGZQaSA9IE1hdGguUEkgKiAwLjU7XG5cbiAgICAgICAgbGV0IHgsIHo7XG5cbiAgICAgICAgaWYgKHkgPCBoYWxmUGkpIHtcbiAgICAgICAgICAgIGlmICh5ID4gLWhhbGZQaSkge1xuICAgICAgICAgICAgICAgIHggPSBNYXRoLmF0YW4yKG1bNl0gLyBzeSwgbVsxMF0gLyBzeik7XG4gICAgICAgICAgICAgICAgeiA9IE1hdGguYXRhbjIobVsxXSAvIHN4LCBtWzBdIC8gc3gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBOb3QgYSB1bmlxdWUgc29sdXRpb25cbiAgICAgICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgICAgICAgICB4ID0gLU1hdGguYXRhbjIobVs0XSAvIHN5LCBtWzVdIC8gc3kpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gTm90IGEgdW5pcXVlIHNvbHV0aW9uXG4gICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgICAgIHggPSBNYXRoLmF0YW4yKG1bNF0gLyBzeSwgbVs1XSAvIHN5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBldWxlcnMuc2V0KHgsIHksIHopLm11bFNjYWxhcihtYXRoLlJBRF9UT19ERUcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIHN0cmluZyBmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIG1hdHJpeCBpbiBzdHJpbmcgZm9ybS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiAvLyBPdXRwdXRzIFsxLCAwLCAwLCAwLCAwLCAxLCAwLCAwLCAwLCAwLCAxLCAwLCAwLCAwLCAwLCAxXVxuICAgICAqIGNvbnNvbGUubG9nKG0udG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiAnWycgKyB0aGlzLmRhdGEuam9pbignLCAnKSArICddJztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IG1hdHJpeCBzZXQgdG8gdGhlIGlkZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIElERU5USVRZID0gT2JqZWN0LmZyZWV6ZShuZXcgTWF0NCgpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgbWF0cml4IHdpdGggYWxsIGVsZW1lbnRzIHNldCB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFpFUk8gPSBPYmplY3QuZnJlZXplKG5ldyBNYXQ0KCkuc2V0KFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSkpO1xufVxuXG5leHBvcnQgeyBNYXQ0IH07XG4iXSwibmFtZXMiOlsiX2hhbGZTaXplIiwiVmVjMiIsIngiLCJWZWMzIiwieSIsInoiLCJzY2FsZSIsIk1hdDQiLCJjb25zdHJ1Y3RvciIsImRhdGEiLCJGbG9hdDMyQXJyYXkiLCJfZ2V0UGVyc3BlY3RpdmVIYWxmU2l6ZSIsImhhbGZTaXplIiwiZm92IiwiYXNwZWN0Iiwiem5lYXIiLCJmb3ZJc0hvcml6b250YWwiLCJNYXRoIiwidGFuIiwiUEkiLCJhZGQyIiwibGhzIiwicmhzIiwiYSIsImIiLCJyIiwiYWRkIiwiY2xvbmUiLCJjc3RyIiwiY29weSIsInNyYyIsImRzdCIsImVxdWFscyIsImwiLCJpc0lkZW50aXR5IiwibSIsIm11bDIiLCJhMDAiLCJhMDEiLCJhMDIiLCJhMDMiLCJhMTAiLCJhMTEiLCJhMTIiLCJhMTMiLCJhMjAiLCJhMjEiLCJhMjIiLCJhMjMiLCJhMzAiLCJhMzEiLCJhMzIiLCJhMzMiLCJiMCIsImIxIiwiYjIiLCJiMyIsIm11bEFmZmluZTIiLCJtdWwiLCJ0cmFuc2Zvcm1Qb2ludCIsInZlYyIsInJlcyIsInRyYW5zZm9ybVZlY3RvciIsInRyYW5zZm9ybVZlYzQiLCJWZWM0IiwidyIsInNldExvb2tBdCIsInBvc2l0aW9uIiwidGFyZ2V0IiwidXAiLCJzdWIyIiwibm9ybWFsaXplIiwiY3Jvc3MiLCJzZXRGcnVzdHVtIiwibGVmdCIsInJpZ2h0IiwiYm90dG9tIiwidG9wIiwiemZhciIsInRlbXAxIiwidGVtcDIiLCJ0ZW1wMyIsInRlbXA0Iiwic2V0UGVyc3BlY3RpdmUiLCJzZXRPcnRobyIsIm5lYXIiLCJmYXIiLCJzZXRGcm9tQXhpc0FuZ2xlIiwiYXhpcyIsImFuZ2xlIiwibWF0aCIsIkRFR19UT19SQUQiLCJjIiwiY29zIiwicyIsInNpbiIsInQiLCJ0eCIsInR5Iiwic2V0VHJhbnNsYXRlIiwic2V0U2NhbGUiLCJzZXRWaWV3cG9ydCIsIndpZHRoIiwiaGVpZ2h0IiwiaW52ZXJ0IiwiYjAwIiwiYjAxIiwiYjAyIiwiYjAzIiwiYjA0IiwiYjA1IiwiYjA2IiwiYjA3IiwiYjA4IiwiYjA5IiwiYjEwIiwiYjExIiwiZGV0Iiwic2V0SWRlbnRpdHkiLCJpbnZEZXQiLCJzZXQiLCJzZXRUUlMiLCJxeCIsInF5IiwicXoiLCJxdyIsInN4Iiwic3kiLCJzeiIsIngyIiwieTIiLCJ6MiIsInh4IiwieHkiLCJ4eiIsInl5IiwieXoiLCJ6eiIsInd4Iiwid3kiLCJ3eiIsInRyYW5zcG9zZSIsInRtcCIsImludmVydFRvM3gzIiwibTAiLCJtMSIsIm0yIiwibTQiLCJtNSIsIm02IiwibTgiLCJtOSIsIm0xMCIsImlkZXQiLCJnZXRUcmFuc2xhdGlvbiIsImdldFgiLCJnZXRZIiwiZ2V0WiIsImdldFNjYWxlIiwibGVuZ3RoIiwic2V0RnJvbUV1bGVyQW5nbGVzIiwiZXgiLCJleSIsImV6IiwiczEiLCJjMSIsInMyIiwiYzIiLCJzMyIsImMzIiwiZ2V0RXVsZXJBbmdsZXMiLCJldWxlcnMiLCJhc2luIiwiaGFsZlBpIiwiYXRhbjIiLCJtdWxTY2FsYXIiLCJSQURfVE9fREVHIiwidG9TdHJpbmciLCJqb2luIiwiSURFTlRJVFkiLCJPYmplY3QiLCJmcmVlemUiLCJaRVJPIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBS0EsTUFBTUEsU0FBUyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzVCLE1BQU1DLENBQUMsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUNwQixNQUFNQyxDQUFDLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDcEIsTUFBTUUsQ0FBQyxHQUFHLElBQUlGLElBQUksRUFBRSxDQUFBO0FBQ3BCLE1BQU1HLEtBQUssR0FBRyxJQUFJSCxJQUFJLEVBQUUsQ0FBQTs7QUFFeEI7QUFDQTtBQUNBO0FBQ0EsTUFBTUksSUFBSSxDQUFDO0FBQ1A7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDSUMsRUFBQUEsV0FBVyxHQUFHO0FBQUEsSUFBQSxJQUFBLENBTGRDLElBQUksR0FBRyxJQUFJQyxZQUFZLENBQUMsRUFBRSxDQUFDLENBQUE7QUFNdkI7QUFDQTtJQUNBLElBQUksQ0FBQ0QsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQ0EsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQ0EsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQ0EsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNuRSxHQUFBOztBQUVBO0VBQ0EsT0FBT0UsdUJBQXVCLENBQUNDLFFBQVEsRUFBRUMsR0FBRyxFQUFFQyxNQUFNLEVBQUVDLEtBQUssRUFBRUMsZUFBZSxFQUFFO0FBQzFFLElBQUEsSUFBSUEsZUFBZSxFQUFFO0FBQ2pCSixNQUFBQSxRQUFRLENBQUNWLENBQUMsR0FBR2EsS0FBSyxHQUFHRSxJQUFJLENBQUNDLEdBQUcsQ0FBQ0wsR0FBRyxHQUFHSSxJQUFJLENBQUNFLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUNsRFAsTUFBQUEsUUFBUSxDQUFDUixDQUFDLEdBQUdRLFFBQVEsQ0FBQ1YsQ0FBQyxHQUFHWSxNQUFNLENBQUE7QUFDcEMsS0FBQyxNQUFNO0FBQ0hGLE1BQUFBLFFBQVEsQ0FBQ1IsQ0FBQyxHQUFHVyxLQUFLLEdBQUdFLElBQUksQ0FBQ0MsR0FBRyxDQUFDTCxHQUFHLEdBQUdJLElBQUksQ0FBQ0UsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFBO0FBQ2xEUCxNQUFBQSxRQUFRLENBQUNWLENBQUMsR0FBR1UsUUFBUSxDQUFDUixDQUFDLEdBQUdVLE1BQU0sQ0FBQTtBQUNwQyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJTSxFQUFBQSxJQUFJLENBQUNDLEdBQUcsRUFBRUMsR0FBRyxFQUFFO0FBQ1gsSUFBQSxNQUFNQyxDQUFDLEdBQUdGLEdBQUcsQ0FBQ1osSUFBSTtNQUNkZSxDQUFDLEdBQUdGLEdBQUcsQ0FBQ2IsSUFBSTtNQUNaZ0IsQ0FBQyxHQUFHLElBQUksQ0FBQ2hCLElBQUksQ0FBQTtBQUVqQmdCLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEJDLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0YsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDckJDLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0YsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDckJDLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0YsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDckJDLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0YsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDckJDLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0YsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDckJDLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0YsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7QUFFckIsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lFLEdBQUcsQ0FBQ0osR0FBRyxFQUFFO0FBQ0wsSUFBQSxPQUFPLElBQUksQ0FBQ0YsSUFBSSxDQUFDLElBQUksRUFBRUUsR0FBRyxDQUFDLENBQUE7QUFDL0IsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUssRUFBQUEsS0FBSyxHQUFHO0FBQ0o7QUFDQSxJQUFBLE1BQU1DLElBQUksR0FBRyxJQUFJLENBQUNwQixXQUFXLENBQUE7QUFDN0IsSUFBQSxPQUFPLElBQUlvQixJQUFJLEVBQUUsQ0FBQ0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2hDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQSxJQUFJLENBQUNQLEdBQUcsRUFBRTtBQUNOLElBQUEsTUFBTVEsR0FBRyxHQUFHUixHQUFHLENBQUNiLElBQUk7TUFDaEJzQixHQUFHLEdBQUcsSUFBSSxDQUFDdEIsSUFBSSxDQUFBO0FBRW5Cc0IsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHRCxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDZkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDakJDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFB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QUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1RBLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDVEEsSUFBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNUQSxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1RBLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDVEEsSUFBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUVULElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lzRixFQUFBQSxNQUFNLENBQUN6QixDQUFDLEVBQUV2RSxDQUFDLEVBQUVxRSxDQUFDLEVBQUU7QUFDWixJQUFBLE1BQU00QixFQUFFLEdBQUdqRyxDQUFDLENBQUN2QixDQUFDLENBQUE7QUFD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
