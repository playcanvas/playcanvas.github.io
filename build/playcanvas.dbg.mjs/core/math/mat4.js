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
   * Create a new Mat4 instance. It is initialized to the identity matrix.
   */
  constructor() {
    /**
     * Matrix elements in the form of a flat array.
     *
     * @type {Float32Array}
     */
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
   * const m = new pc.Mat4();
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
   * const m = new pc.Mat4();
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
   * const src = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * const dst = src.clone();
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
   * const src = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * const dst = new pc.Mat4();
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
   * const a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * const b = new pc.Mat4();
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
   * const m = new pc.Mat4();
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
   * const a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * const b = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
   * const r = new pc.Mat4();
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
   * const a = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   * const b = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
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
   * const v = new pc.Vec3(1, 2, 3);
   *
   * // Create a 4x4 rotation matrix
   * const m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   *
   * const tv = m.transformPoint(v);
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
   * const v = new pc.Vec3(1, 2, 3);
   *
   * // Create a 4x4 rotation matrix
   * const m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
   *
   * const tv = m.transformVector(v);
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
   * const v = new pc.Vec4(1, 2, 3, 4);
   *
   * // Create an output 4-dimensional vector
   * const result = new pc.Vec4();
   *
   * // Create a 4x4 rotation matrix
   * const m = new pc.Mat4().setFromEulerAngles(10, 20, 30);
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
   * const position = new pc.Vec3(10, 10, 10);
   * const target = new pc.Vec3(0, 0, 0);
   * const up = new pc.Vec3(0, 1, 0);
   * const m = new pc.Mat4().setLookAt(position, target, up);
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
   * const f = pc.Mat4().setFrustum(-2, 2, -1, 1, 1, 1000);
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
   * const persp = pc.Mat4().setPerspective(45, 16 / 9, 1, 1000);
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
   * const ortho = pc.Mat4().ortho(-2, 2, -2, 2, 1, 1000);
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
   * const rm = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 90);
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
   * const tm = new pc.Mat4().setTranslate(10, 10, 10);
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
   * const sm = new pc.Mat4().setScale(10, 10, 10);
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
   * const vm = new pc.Mat4().setViewport(0, 0, 1, 1);
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
   * Sets the matrix to a reflection matrix, which can be used as a mirror transformation by the
   * plane.
   *
   * @param {Vec3} normal - The normal of the plane to reflect by.
   * @param {number} distance - The distance of plane to reflect by.
   * @returns {Mat4} Self for chaining.
   */
  setReflection(normal, distance) {
    const a = normal.x;
    const b = normal.y;
    const c = normal.z;
    const data = this.data;
    data[0] = 1.0 - 2 * a * a;
    data[1] = -2 * a * b;
    data[2] = -2 * a * c;
    data[3] = 0;
    data[4] = -2 * a * b;
    data[5] = 1.0 - 2 * b * b;
    data[6] = -2 * b * c;
    data[7] = 0;
    data[8] = -2 * a * c;
    data[9] = -2 * b * c;
    data[10] = 1.0 - 2 * c * c;
    data[11] = 0;
    data[12] = -2 * a * distance;
    data[13] = -2 * b * distance;
    data[14] = -2 * c * distance;
    data[15] = 1;
    return this;
  }

  /**
   * Sets the specified matrix to its inverse.
   *
   * @returns {Mat4} Self for chaining.
   * @example
   * // Create a 4x4 rotation matrix of 180 degrees around the y-axis
   * const rot = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 180);
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
   * const t = new pc.Vec3(10, 20, 30);
   * const r = new pc.Quat();
   * const s = new pc.Vec3(2, 2, 2);
   *
   * const m = new pc.Mat4();
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
   * const m = new pc.Mat4();
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
   * const m = new pc.Mat4();
   *
   * // Query the translation component
   * const t = new pc.Vec3();
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
   * const m = new pc.Mat4();
   *
   * // Query the x-axis component
   * const x = new pc.Vec3();
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
   * const m = new pc.Mat4();
   *
   * // Query the y-axis component
   * const y = new pc.Vec3();
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
   * const m = new pc.Mat4();
   *
   * // Query the z-axis component
   * const z = new pc.Vec3();
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
   * const scale = m.getScale();
   */
  getScale(scale = new Vec3()) {
    this.getX(x);
    this.getY(y);
    this.getZ(z);
    scale.set(x.length(), y.length(), z.length());
    return scale;
  }

  /**
   * -1 if the the matrix has an odd number of negative scales (mirrored); 1 otherwise.
   *
   * @type {number}
   * @ignore
   */
  get scaleSign() {
    this.getX(x);
    this.getY(y);
    this.getZ(z);
    x.cross(x, y);
    return x.dot(z) < 0 ? -1 : 1;
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
   * const m = new pc.Mat4();
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
   * const m = new pc.Mat4().setFromAxisAngle(pc.Vec3.UP, 45);
   *
   * const eulers = m.getEulerAngles();
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
   * const m = new pc.Mat4();
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
/**
 * A constant matrix with all elements set to 0.
 *
 * @type {Mat4}
 * @readonly
 */
Mat4.ZERO = Object.freeze(new Mat4().set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

export { Mat4 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0NC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9tYXQ0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4vdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuL3ZlYzQuanMnO1xuXG5jb25zdCBfaGFsZlNpemUgPSBuZXcgVmVjMigpO1xuY29uc3QgeCA9IG5ldyBWZWMzKCk7XG5jb25zdCB5ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHogPSBuZXcgVmVjMygpO1xuY29uc3Qgc2NhbGUgPSBuZXcgVmVjMygpO1xuXG4vKipcbiAqIEEgNHg0IG1hdHJpeC5cbiAqL1xuY2xhc3MgTWF0NCB7XG4gICAgLyoqXG4gICAgICogTWF0cml4IGVsZW1lbnRzIGluIHRoZSBmb3JtIG9mIGEgZmxhdCBhcnJheS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG4gICAgICovXG4gICAgZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMTYpO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1hdDQgaW5zdGFuY2UuIEl0IGlzIGluaXRpYWxpemVkIHRvIHRoZSBpZGVudGl0eSBtYXRyaXguXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhbiBpZGVudGl0eSBtYXRyaXguIE5vdGUgdGhhdCBhIG5ldyBGbG9hdDMyQXJyYXkgaGFzIGFsbCBlbGVtZW50cyBzZXRcbiAgICAgICAgLy8gdG8gemVybyBieSBkZWZhdWx0LCBzbyB3ZSBvbmx5IG5lZWQgdG8gc2V0IHRoZSByZWxldmFudCBlbGVtZW50cyB0byBvbmUuXG4gICAgICAgIHRoaXMuZGF0YVswXSA9IHRoaXMuZGF0YVs1XSA9IHRoaXMuZGF0YVsxMF0gPSB0aGlzLmRhdGFbMTVdID0gMTtcbiAgICB9XG5cbiAgICAvLyBTdGF0aWMgZnVuY3Rpb24gd2hpY2ggZXZhbHVhdGVzIHBlcnNwZWN0aXZlIHByb2plY3Rpb24gbWF0cml4IGhhbGYgc2l6ZSBhdCB0aGUgbmVhciBwbGFuZVxuICAgIHN0YXRpYyBfZ2V0UGVyc3BlY3RpdmVIYWxmU2l6ZShoYWxmU2l6ZSwgZm92LCBhc3BlY3QsIHpuZWFyLCBmb3ZJc0hvcml6b250YWwpIHtcbiAgICAgICAgaWYgKGZvdklzSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgaGFsZlNpemUueCA9IHpuZWFyICogTWF0aC50YW4oZm92ICogTWF0aC5QSSAvIDM2MCk7XG4gICAgICAgICAgICBoYWxmU2l6ZS55ID0gaGFsZlNpemUueCAvIGFzcGVjdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbGZTaXplLnkgPSB6bmVhciAqIE1hdGgudGFuKGZvdiAqIE1hdGguUEkgLyAzNjApO1xuICAgICAgICAgICAgaGFsZlNpemUueCA9IGhhbGZTaXplLnkgKiBhc3BlY3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpY2VzIHRvZ2V0aGVyIGFuZCBzdG9yZXMgdGhlIHJlc3VsdCBpbiB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbGhzIC0gVGhlIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgZmlyc3Qgb3BlcmFuZCBvZiB0aGUgYWRkaXRpb24uXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgNHg0IG1hdHJpeCB1c2VkIGFzIHRoZSBzZWNvbmQgb3BlcmFuZCBvZiB0aGUgYWRkaXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiBtLmFkZDIocGMuTWF0NC5JREVOVElUWSwgcGMuTWF0NC5PTkUpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyBtLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZDIobGhzLCByaHMpIHtcbiAgICAgICAgY29uc3QgYSA9IGxocy5kYXRhLFxuICAgICAgICAgICAgYiA9IHJocy5kYXRhLFxuICAgICAgICAgICAgciA9IHRoaXMuZGF0YTtcblxuICAgICAgICByWzBdID0gYVswXSArIGJbMF07XG4gICAgICAgIHJbMV0gPSBhWzFdICsgYlsxXTtcbiAgICAgICAgclsyXSA9IGFbMl0gKyBiWzJdO1xuICAgICAgICByWzNdID0gYVszXSArIGJbM107XG4gICAgICAgIHJbNF0gPSBhWzRdICsgYls0XTtcbiAgICAgICAgcls1XSA9IGFbNV0gKyBiWzVdO1xuICAgICAgICByWzZdID0gYVs2XSArIGJbNl07XG4gICAgICAgIHJbN10gPSBhWzddICsgYls3XTtcbiAgICAgICAgcls4XSA9IGFbOF0gKyBiWzhdO1xuICAgICAgICByWzldID0gYVs5XSArIGJbOV07XG4gICAgICAgIHJbMTBdID0gYVsxMF0gKyBiWzEwXTtcbiAgICAgICAgclsxMV0gPSBhWzExXSArIGJbMTFdO1xuICAgICAgICByWzEyXSA9IGFbMTJdICsgYlsxMl07XG4gICAgICAgIHJbMTNdID0gYVsxM10gKyBiWzEzXTtcbiAgICAgICAgclsxNF0gPSBhWzE0XSArIGJbMTRdO1xuICAgICAgICByWzE1XSA9IGFbMTVdICsgYlsxNV07XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXggdG8gdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IHJocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIHNlY29uZCBvcGVyYW5kIG9mIHRoZSBhZGRpdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIG0uYWRkKHBjLk1hdDQuT05FKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgbS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGQocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFkZDIodGhpcywgcmhzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZHVwbGljYXRlIG9mIHRoZSBzcGVjaWZpZWQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgZHVwbGljYXRlIG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNyYyA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqIGNvbnN0IGRzdCA9IHNyYy5jbG9uZSgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byBtYXRyaWNlcyBhcmUgXCIgKyAoc3JjLmVxdWFscyhkc3QpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICAvKiogQHR5cGUge3RoaXN9ICovXG4gICAgICAgIGNvbnN0IGNzdHIgPSB0aGlzLmNvbnN0cnVjdG9yO1xuICAgICAgICByZXR1cm4gbmV3IGNzdHIoKS5jb3B5KHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2UgNHg0IG1hdHJpeCB0byBhIGRlc3RpbmF0aW9uIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IHJocyAtIEEgNHg0IG1hdHJpeCB0byBiZSBjb3BpZWQuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgc3JjID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICogY29uc3QgZHN0ID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiBkc3QuY29weShzcmMpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byBtYXRyaWNlcyBhcmUgXCIgKyAoc3JjLmVxdWFscyhkc3QpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGNvcHkocmhzKSB7XG4gICAgICAgIGNvbnN0IHNyYyA9IHJocy5kYXRhLFxuICAgICAgICAgICAgZHN0ID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGRzdFswXSA9IHNyY1swXTtcbiAgICAgICAgZHN0WzFdID0gc3JjWzFdO1xuICAgICAgICBkc3RbMl0gPSBzcmNbMl07XG4gICAgICAgIGRzdFszXSA9IHNyY1szXTtcbiAgICAgICAgZHN0WzRdID0gc3JjWzRdO1xuICAgICAgICBkc3RbNV0gPSBzcmNbNV07XG4gICAgICAgIGRzdFs2XSA9IHNyY1s2XTtcbiAgICAgICAgZHN0WzddID0gc3JjWzddO1xuICAgICAgICBkc3RbOF0gPSBzcmNbOF07XG4gICAgICAgIGRzdFs5XSA9IHNyY1s5XTtcbiAgICAgICAgZHN0WzEwXSA9IHNyY1sxMF07XG4gICAgICAgIGRzdFsxMV0gPSBzcmNbMTFdO1xuICAgICAgICBkc3RbMTJdID0gc3JjWzEyXTtcbiAgICAgICAgZHN0WzEzXSA9IHNyY1sxM107XG4gICAgICAgIGRzdFsxNF0gPSBzcmNbMTRdO1xuICAgICAgICBkc3RbMTVdID0gc3JjWzE1XTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIG1hdHJpY2VzIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIG90aGVyIG1hdHJpeC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgbWF0cmljZXMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIG1hdHJpY2VzIGFyZSBcIiArIChhLmVxdWFscyhiKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIGNvbnN0IGwgPSB0aGlzLmRhdGEsXG4gICAgICAgICAgICByID0gcmhzLmRhdGE7XG5cbiAgICAgICAgcmV0dXJuICgobFswXSA9PT0gclswXSkgJiZcbiAgICAgICAgICAgICAgICAobFsxXSA9PT0gclsxXSkgJiZcbiAgICAgICAgICAgICAgICAobFsyXSA9PT0gclsyXSkgJiZcbiAgICAgICAgICAgICAgICAobFszXSA9PT0gclszXSkgJiZcbiAgICAgICAgICAgICAgICAobFs0XSA9PT0gcls0XSkgJiZcbiAgICAgICAgICAgICAgICAobFs1XSA9PT0gcls1XSkgJiZcbiAgICAgICAgICAgICAgICAobFs2XSA9PT0gcls2XSkgJiZcbiAgICAgICAgICAgICAgICAobFs3XSA9PT0gcls3XSkgJiZcbiAgICAgICAgICAgICAgICAobFs4XSA9PT0gcls4XSkgJiZcbiAgICAgICAgICAgICAgICAobFs5XSA9PT0gcls5XSkgJiZcbiAgICAgICAgICAgICAgICAobFsxMF0gPT09IHJbMTBdKSAmJlxuICAgICAgICAgICAgICAgIChsWzExXSA9PT0gclsxMV0pICYmXG4gICAgICAgICAgICAgICAgKGxbMTJdID09PSByWzEyXSkgJiZcbiAgICAgICAgICAgICAgICAobFsxM10gPT09IHJbMTNdKSAmJlxuICAgICAgICAgICAgICAgIChsWzE0XSA9PT0gclsxNF0pICYmXG4gICAgICAgICAgICAgICAgKGxbMTVdID09PSByWzE1XSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0aGUgc3BlY2lmaWVkIG1hdHJpeCBpcyB0aGUgaWRlbnRpdHkgbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIG1hdHJpeCBpcyBpZGVudGl0eSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbWF0cml4IGlzIFwiICsgKG0uaXNJZGVudGl0eSgpID8gXCJpZGVudGl0eVwiIDogXCJub3QgaWRlbnRpdHlcIikpO1xuICAgICAqL1xuICAgIGlzSWRlbnRpdHkoKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgcmV0dXJuICgobVswXSA9PT0gMSkgJiZcbiAgICAgICAgICAgICAgICAobVsxXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsyXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVszXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs0XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs1XSA9PT0gMSkgJiZcbiAgICAgICAgICAgICAgICAobVs2XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs3XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs4XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs5XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsxMF0gPT09IDEpICYmXG4gICAgICAgICAgICAgICAgKG1bMTFdID09PSAwKSAmJlxuICAgICAgICAgICAgICAgIChtWzEyXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsxM10gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bMTRdID09PSAwKSAmJlxuICAgICAgICAgICAgICAgIChtWzE1XSA9PT0gMSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cmljZXMgdG9nZXRoZXIgYW5kIHN0b3JlcyB0aGUgcmVzdWx0IGluIHRoZSBjdXJyZW50XG4gICAgICogaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IGxocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGEgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKiBjb25zdCBiID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDE4MCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyByID0gYSAqIGJcbiAgICAgKiByLm11bDIoYSwgYik7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsMihsaHMsIHJocykge1xuICAgICAgICBjb25zdCBhID0gbGhzLmRhdGE7XG4gICAgICAgIGNvbnN0IGIgPSByaHMuZGF0YTtcbiAgICAgICAgY29uc3QgciA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCBhMDAgPSBhWzBdO1xuICAgICAgICBjb25zdCBhMDEgPSBhWzFdO1xuICAgICAgICBjb25zdCBhMDIgPSBhWzJdO1xuICAgICAgICBjb25zdCBhMDMgPSBhWzNdO1xuICAgICAgICBjb25zdCBhMTAgPSBhWzRdO1xuICAgICAgICBjb25zdCBhMTEgPSBhWzVdO1xuICAgICAgICBjb25zdCBhMTIgPSBhWzZdO1xuICAgICAgICBjb25zdCBhMTMgPSBhWzddO1xuICAgICAgICBjb25zdCBhMjAgPSBhWzhdO1xuICAgICAgICBjb25zdCBhMjEgPSBhWzldO1xuICAgICAgICBjb25zdCBhMjIgPSBhWzEwXTtcbiAgICAgICAgY29uc3QgYTIzID0gYVsxMV07XG4gICAgICAgIGNvbnN0IGEzMCA9IGFbMTJdO1xuICAgICAgICBjb25zdCBhMzEgPSBhWzEzXTtcbiAgICAgICAgY29uc3QgYTMyID0gYVsxNF07XG4gICAgICAgIGNvbnN0IGEzMyA9IGFbMTVdO1xuXG4gICAgICAgIGxldCBiMCwgYjEsIGIyLCBiMztcblxuICAgICAgICBiMCA9IGJbMF07XG4gICAgICAgIGIxID0gYlsxXTtcbiAgICAgICAgYjIgPSBiWzJdO1xuICAgICAgICBiMyA9IGJbM107XG4gICAgICAgIHJbMF0gID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyICsgYTMwICogYjM7XG4gICAgICAgIHJbMV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyICsgYTMxICogYjM7XG4gICAgICAgIHJbMl0gID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyICogYjM7XG4gICAgICAgIHJbM10gID0gYTAzICogYjAgKyBhMTMgKiBiMSArIGEyMyAqIGIyICsgYTMzICogYjM7XG5cbiAgICAgICAgYjAgPSBiWzRdO1xuICAgICAgICBiMSA9IGJbNV07XG4gICAgICAgIGIyID0gYls2XTtcbiAgICAgICAgYjMgPSBiWzddO1xuICAgICAgICByWzRdICA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMCAqIGIzO1xuICAgICAgICByWzVdICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMiArIGEzMSAqIGIzO1xuICAgICAgICByWzZdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMiAqIGIzO1xuICAgICAgICByWzddICA9IGEwMyAqIGIwICsgYTEzICogYjEgKyBhMjMgKiBiMiArIGEzMyAqIGIzO1xuXG4gICAgICAgIGIwID0gYls4XTtcbiAgICAgICAgYjEgPSBiWzldO1xuICAgICAgICBiMiA9IGJbMTBdO1xuICAgICAgICBiMyA9IGJbMTFdO1xuICAgICAgICByWzhdICA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMCAqIGIzO1xuICAgICAgICByWzldICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMiArIGEzMSAqIGIzO1xuICAgICAgICByWzEwXSA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMiAqIGIzO1xuICAgICAgICByWzExXSA9IGEwMyAqIGIwICsgYTEzICogYjEgKyBhMjMgKiBiMiArIGEzMyAqIGIzO1xuXG4gICAgICAgIGIwID0gYlsxMl07XG4gICAgICAgIGIxID0gYlsxM107XG4gICAgICAgIGIyID0gYlsxNF07XG4gICAgICAgIGIzID0gYlsxNV07XG4gICAgICAgIHJbMTJdID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyICsgYTMwICogYjM7XG4gICAgICAgIHJbMTNdID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyICsgYTMxICogYjM7XG4gICAgICAgIHJbMTRdID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyICogYjM7XG4gICAgICAgIHJbMTVdID0gYTAzICogYjAgKyBhMTMgKiBiMSArIGEyMyAqIGIyICsgYTMzICogYjM7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaWNlcyB0b2dldGhlciBhbmQgc3RvcmVzIHRoZSByZXN1bHQgaW4gdGhlIGN1cnJlbnRcbiAgICAgKiBpbnN0YW5jZS4gVGhpcyBmdW5jdGlvbiBhc3N1bWVzIHRoZSBtYXRyaWNlcyBhcmUgYWZmaW5lIHRyYW5zZm9ybWF0aW9uIG1hdHJpY2VzLCB3aGVyZSB0aGVcbiAgICAgKiB1cHBlciBsZWZ0IDN4MyBlbGVtZW50cyBhcmUgYSByb3RhdGlvbiBtYXRyaXgsIGFuZCB0aGUgYm90dG9tIGxlZnQgMyBlbGVtZW50cyBhcmVcbiAgICAgKiB0cmFuc2xhdGlvbi4gVGhlIHJpZ2h0bW9zdCBjb2x1bW4gaXMgYXNzdW1lZCB0byBiZSBbMCwgMCwgMCwgMV0uIFRoZSBwYXJhbWV0ZXJzIGFyZSBub3RcbiAgICAgKiB2ZXJpZmllZCB0byBiZSBpbiB0aGUgZXhwZWN0ZWQgZm9ybWF0LiBUaGlzIGZ1bmN0aW9uIGlzIGZhc3RlciB0aGFuIGdlbmVyYWxcbiAgICAgKiB7QGxpbmsgTWF0NCNtdWwyfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbGhzIC0gVGhlIGFmZmluZSB0cmFuc2Zvcm1hdGlvbiA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZlxuICAgICAqIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgYWZmaW5lIHRyYW5zZm9ybWF0aW9uIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZlxuICAgICAqIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIG11bEFmZmluZTIobGhzLCByaHMpIHtcbiAgICAgICAgY29uc3QgYSA9IGxocy5kYXRhO1xuICAgICAgICBjb25zdCBiID0gcmhzLmRhdGE7XG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgYTAwID0gYVswXTtcbiAgICAgICAgY29uc3QgYTAxID0gYVsxXTtcbiAgICAgICAgY29uc3QgYTAyID0gYVsyXTtcbiAgICAgICAgY29uc3QgYTEwID0gYVs0XTtcbiAgICAgICAgY29uc3QgYTExID0gYVs1XTtcbiAgICAgICAgY29uc3QgYTEyID0gYVs2XTtcbiAgICAgICAgY29uc3QgYTIwID0gYVs4XTtcbiAgICAgICAgY29uc3QgYTIxID0gYVs5XTtcbiAgICAgICAgY29uc3QgYTIyID0gYVsxMF07XG4gICAgICAgIGNvbnN0IGEzMCA9IGFbMTJdO1xuICAgICAgICBjb25zdCBhMzEgPSBhWzEzXTtcbiAgICAgICAgY29uc3QgYTMyID0gYVsxNF07XG5cbiAgICAgICAgbGV0IGIwLCBiMSwgYjI7XG5cbiAgICAgICAgYjAgPSBiWzBdO1xuICAgICAgICBiMSA9IGJbMV07XG4gICAgICAgIGIyID0gYlsyXTtcbiAgICAgICAgclswXSAgPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjI7XG4gICAgICAgIHJbMV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyO1xuICAgICAgICByWzJdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMjtcbiAgICAgICAgclszXSA9IDA7XG5cbiAgICAgICAgYjAgPSBiWzRdO1xuICAgICAgICBiMSA9IGJbNV07XG4gICAgICAgIGIyID0gYls2XTtcbiAgICAgICAgcls0XSAgPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjI7XG4gICAgICAgIHJbNV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyO1xuICAgICAgICByWzZdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMjtcbiAgICAgICAgcls3XSA9IDA7XG5cbiAgICAgICAgYjAgPSBiWzhdO1xuICAgICAgICBiMSA9IGJbOV07XG4gICAgICAgIGIyID0gYlsxMF07XG4gICAgICAgIHJbOF0gID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyO1xuICAgICAgICByWzldICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMjtcbiAgICAgICAgclsxMF0gPSBhMDIgKiBiMCArIGExMiAqIGIxICsgYTIyICogYjI7XG4gICAgICAgIHJbMTFdID0gMDtcblxuICAgICAgICBiMCA9IGJbMTJdO1xuICAgICAgICBiMSA9IGJbMTNdO1xuICAgICAgICBiMiA9IGJbMTRdO1xuICAgICAgICByWzEyXSA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMDtcbiAgICAgICAgclsxM10gPSBhMDEgKiBiMCArIGExMSAqIGIxICsgYTIxICogYjIgKyBhMzE7XG4gICAgICAgIHJbMTRdID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyO1xuICAgICAgICByWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyB0aGUgY3VycmVudCBpbnN0YW5jZSBieSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IHJocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICogY29uc3QgYiA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUF4aXNBbmdsZShwYy5WZWMzLlVQLCAxODApO1xuICAgICAqXG4gICAgICogLy8gYSA9IGEgKiBiXG4gICAgICogYS5tdWwoYik7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsKHJocykge1xuICAgICAgICByZXR1cm4gdGhpcy5tdWwyKHRoaXMsIHJocyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDMtZGltZW5zaW9uYWwgcG9pbnQgYnkgYSA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSB2ZWMgLSBUaGUgMy1kaW1lbnNpb25hbCBwb2ludCB0byBiZSB0cmFuc2Zvcm1lZC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtyZXNdIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCBwb2ludCB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlXG4gICAgICogdHJhbnNmb3JtYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBpbnB1dCBwb2ludCB2IHRyYW5zZm9ybWVkIGJ5IHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgMy1kaW1lbnNpb25hbCBwb2ludFxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiBjb25zdCBtID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICpcbiAgICAgKiBjb25zdCB0diA9IG0udHJhbnNmb3JtUG9pbnQodik7XG4gICAgICovXG4gICAgdHJhbnNmb3JtUG9pbnQodmVjLCByZXMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgeCA9IHZlYy54O1xuICAgICAgICBjb25zdCB5ID0gdmVjLnk7XG4gICAgICAgIGNvbnN0IHogPSB2ZWMuejtcblxuICAgICAgICByZXMueCA9IHggKiBtWzBdICsgeSAqIG1bNF0gKyB6ICogbVs4XSArIG1bMTJdO1xuICAgICAgICByZXMueSA9IHggKiBtWzFdICsgeSAqIG1bNV0gKyB6ICogbVs5XSArIG1bMTNdO1xuICAgICAgICByZXMueiA9IHggKiBtWzJdICsgeSAqIG1bNl0gKyB6ICogbVsxMF0gKyBtWzE0XTtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBieSBhIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHZlYyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byBiZSB0cmFuc2Zvcm1lZC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtyZXNdIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgcmVzdWx0IG9mIHRoZVxuICAgICAqIHRyYW5zZm9ybWF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgaW5wdXQgdmVjdG9yIHYgdHJhbnNmb3JtZWQgYnkgdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSAzLWRpbWVuc2lvbmFsIHZlY3RvclxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiBjb25zdCBtID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICpcbiAgICAgKiBjb25zdCB0diA9IG0udHJhbnNmb3JtVmVjdG9yKHYpO1xuICAgICAqL1xuICAgIHRyYW5zZm9ybVZlY3Rvcih2ZWMsIHJlcyA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCB4ID0gdmVjLng7XG4gICAgICAgIGNvbnN0IHkgPSB2ZWMueTtcbiAgICAgICAgY29uc3QgeiA9IHZlYy56O1xuXG4gICAgICAgIHJlcy54ID0geCAqIG1bMF0gKyB5ICogbVs0XSArIHogKiBtWzhdO1xuICAgICAgICByZXMueSA9IHggKiBtWzFdICsgeSAqIG1bNV0gKyB6ICogbVs5XTtcbiAgICAgICAgcmVzLnogPSB4ICogbVsyXSArIHkgKiBtWzZdICsgeiAqIG1bMTBdO1xuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDQtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGEgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gdmVjIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gW3Jlc10gLSBBbiBvcHRpb25hbCA0LWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlXG4gICAgICogdHJhbnNmb3JtYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzR9IFRoZSBpbnB1dCB2ZWN0b3IgdiB0cmFuc2Zvcm1lZCBieSB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhbiBpbnB1dCA0LWRpbWVuc2lvbmFsIHZlY3RvclxuICAgICAqIGNvbnN0IHYgPSBuZXcgcGMuVmVjNCgxLCAyLCAzLCA0KTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhbiBvdXRwdXQgNC1kaW1lbnNpb25hbCB2ZWN0b3JcbiAgICAgKiBjb25zdCByZXN1bHQgPSBuZXcgcGMuVmVjNCgpO1xuICAgICAqXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeFxuICAgICAqIGNvbnN0IG0gPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKlxuICAgICAqIG0udHJhbnNmb3JtVmVjNCh2LCByZXN1bHQpO1xuICAgICAqL1xuICAgIHRyYW5zZm9ybVZlYzQodmVjLCByZXMgPSBuZXcgVmVjNCgpKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgeCA9IHZlYy54O1xuICAgICAgICBjb25zdCB5ID0gdmVjLnk7XG4gICAgICAgIGNvbnN0IHogPSB2ZWMuejtcbiAgICAgICAgY29uc3QgdyA9IHZlYy53O1xuXG4gICAgICAgIHJlcy54ID0geCAqIG1bMF0gKyB5ICogbVs0XSArIHogKiBtWzhdICsgdyAqIG1bMTJdO1xuICAgICAgICByZXMueSA9IHggKiBtWzFdICsgeSAqIG1bNV0gKyB6ICogbVs5XSArIHcgKiBtWzEzXTtcbiAgICAgICAgcmVzLnogPSB4ICogbVsyXSArIHkgKiBtWzZdICsgeiAqIG1bMTBdICsgdyAqIG1bMTRdO1xuICAgICAgICByZXMudyA9IHggKiBtWzNdICsgeSAqIG1bN10gKyB6ICogbVsxMV0gKyB3ICogbVsxNV07XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgdmlld2luZyBtYXRyaXggZGVyaXZlZCBmcm9tIGFuIGV5ZSBwb2ludCwgYSB0YXJnZXQgcG9pbnQgYW5kXG4gICAgICogYW4gdXAgdmVjdG9yLiBUaGUgbWF0cml4IG1hcHMgdGhlIHRhcmdldCBwb2ludCB0byB0aGUgbmVnYXRpdmUgei1heGlzIGFuZCB0aGUgZXllIHBvaW50IHRvXG4gICAgICogdGhlIG9yaWdpbiwgc28gdGhhdCB3aGVuIHlvdSB1c2UgYSB0eXBpY2FsIHByb2plY3Rpb24gbWF0cml4LCB0aGUgY2VudGVyIG9mIHRoZSBzY2VuZSBtYXBzXG4gICAgICogdG8gdGhlIGNlbnRlciBvZiB0aGUgdmlld3BvcnQuIFNpbWlsYXJseSwgdGhlIGRpcmVjdGlvbiBkZXNjcmliZWQgYnkgdGhlIHVwIHZlY3RvciBwcm9qZWN0ZWRcbiAgICAgKiBvbnRvIHRoZSB2aWV3aW5nIHBsYW5lIGlzIG1hcHBlZCB0byB0aGUgcG9zaXRpdmUgeS1heGlzIHNvIHRoYXQgaXQgcG9pbnRzIHVwd2FyZCBpbiB0aGVcbiAgICAgKiB2aWV3cG9ydC4gVGhlIHVwIHZlY3RvciBtdXN0IG5vdCBiZSBwYXJhbGxlbCB0byB0aGUgbGluZSBvZiBzaWdodCBmcm9tIHRoZSBleWUgdG8gdGhlXG4gICAgICogcmVmZXJlbmNlIHBvaW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBwb3NpdGlvbiAtIDMtZCB2ZWN0b3IgaG9sZGluZyB2aWV3IHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjM30gdGFyZ2V0IC0gMy1kIHZlY3RvciBob2xkaW5nIHJlZmVyZW5jZSBwb2ludC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHVwIC0gMy1kIHZlY3RvciBob2xkaW5nIHRoZSB1cCBkaXJlY3Rpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgcG9zaXRpb24gPSBuZXcgcGMuVmVjMygxMCwgMTAsIDEwKTtcbiAgICAgKiBjb25zdCB0YXJnZXQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBjb25zdCB1cCA9IG5ldyBwYy5WZWMzKDAsIDEsIDApO1xuICAgICAqIGNvbnN0IG0gPSBuZXcgcGMuTWF0NCgpLnNldExvb2tBdChwb3NpdGlvbiwgdGFyZ2V0LCB1cCk7XG4gICAgICovXG4gICAgc2V0TG9va0F0KHBvc2l0aW9uLCB0YXJnZXQsIHVwKSB7XG4gICAgICAgIHouc3ViMihwb3NpdGlvbiwgdGFyZ2V0KS5ub3JtYWxpemUoKTtcbiAgICAgICAgeS5jb3B5KHVwKS5ub3JtYWxpemUoKTtcbiAgICAgICAgeC5jcm9zcyh5LCB6KS5ub3JtYWxpemUoKTtcbiAgICAgICAgeS5jcm9zcyh6LCB4KTtcblxuICAgICAgICBjb25zdCByID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIHJbMF0gID0geC54O1xuICAgICAgICByWzFdICA9IHgueTtcbiAgICAgICAgclsyXSAgPSB4Lno7XG4gICAgICAgIHJbM10gID0gMDtcbiAgICAgICAgcls0XSAgPSB5Lng7XG4gICAgICAgIHJbNV0gID0geS55O1xuICAgICAgICByWzZdICA9IHkuejtcbiAgICAgICAgcls3XSAgPSAwO1xuICAgICAgICByWzhdICA9IHoueDtcbiAgICAgICAgcls5XSAgPSB6Lnk7XG4gICAgICAgIHJbMTBdID0gei56O1xuICAgICAgICByWzExXSA9IDA7XG4gICAgICAgIHJbMTJdID0gcG9zaXRpb24ueDtcbiAgICAgICAgclsxM10gPSBwb3NpdGlvbi55O1xuICAgICAgICByWzE0XSA9IHBvc2l0aW9uLno7XG4gICAgICAgIHJbMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgcGVyc3BlY3RpdmUgcHJvamVjdGlvbiBtYXRyaXguIFRoZSBmdW5jdGlvbidzIHBhcmFtZXRlcnNcbiAgICAgKiBkZWZpbmUgdGhlIHNoYXBlIG9mIGEgZnJ1c3R1bS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZWZ0IC0gVGhlIHgtY29vcmRpbmF0ZSBmb3IgdGhlIGxlZnQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmlnaHQgLSBUaGUgeC1jb29yZGluYXRlIGZvciB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYm90dG9tIC0gVGhlIHktY29vcmRpbmF0ZSBmb3IgdGhlIGJvdHRvbSBlZGdlIG9mIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uXG4gICAgICogcGxhbmUgaW4gZXllIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0b3AgLSBUaGUgeS1jb29yZGluYXRlIGZvciB0aGUgdG9wIGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmUgaW5cbiAgICAgKiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpuZWFyIC0gVGhlIG5lYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYXIgLSBUaGUgZmFyIGNsaXAgcGxhbmUgaW4gZXllIGNvb3JkaW5hdGVzLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAqIGNvbnN0IGYgPSBwYy5NYXQ0KCkuc2V0RnJ1c3R1bSgtMiwgMiwgLTEsIDEsIDEsIDEwMDApO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRGcnVzdHVtKGxlZnQsIHJpZ2h0LCBib3R0b20sIHRvcCwgem5lYXIsIHpmYXIpIHtcbiAgICAgICAgY29uc3QgdGVtcDEgPSAyICogem5lYXI7XG4gICAgICAgIGNvbnN0IHRlbXAyID0gcmlnaHQgLSBsZWZ0O1xuICAgICAgICBjb25zdCB0ZW1wMyA9IHRvcCAtIGJvdHRvbTtcbiAgICAgICAgY29uc3QgdGVtcDQgPSB6ZmFyIC0gem5lYXI7XG5cbiAgICAgICAgY29uc3QgciA9IHRoaXMuZGF0YTtcbiAgICAgICAgclswXSA9IHRlbXAxIC8gdGVtcDI7XG4gICAgICAgIHJbMV0gPSAwO1xuICAgICAgICByWzJdID0gMDtcbiAgICAgICAgclszXSA9IDA7XG4gICAgICAgIHJbNF0gPSAwO1xuICAgICAgICByWzVdID0gdGVtcDEgLyB0ZW1wMztcbiAgICAgICAgcls2XSA9IDA7XG4gICAgICAgIHJbN10gPSAwO1xuICAgICAgICByWzhdID0gKHJpZ2h0ICsgbGVmdCkgLyB0ZW1wMjtcbiAgICAgICAgcls5XSA9ICh0b3AgKyBib3R0b20pIC8gdGVtcDM7XG4gICAgICAgIHJbMTBdID0gKC16ZmFyIC0gem5lYXIpIC8gdGVtcDQ7XG4gICAgICAgIHJbMTFdID0gLTE7XG4gICAgICAgIHJbMTJdID0gMDtcbiAgICAgICAgclsxM10gPSAwO1xuICAgICAgICByWzE0XSA9ICgtdGVtcDEgKiB6ZmFyKSAvIHRlbXA0O1xuICAgICAgICByWzE1XSA9IDA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHBlcnNwZWN0aXZlIHByb2plY3Rpb24gbWF0cml4LiBUaGUgZnVuY3Rpb24ncyBwYXJhbWV0ZXJzXG4gICAgICogZGVmaW5lIHRoZSBzaGFwZSBvZiBhIGZydXN0dW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZm92IC0gVGhlIGZydXN0dW0ncyBmaWVsZCBvZiB2aWV3IGluIGRlZ3JlZXMuIFRoZSBmb3ZJc0hvcml6b250YWwgcGFyYW1ldGVyXG4gICAgICogY29udHJvbHMgd2hldGhlciB0aGlzIGlzIGEgdmVydGljYWwgb3IgaG9yaXpvbnRhbCBmaWVsZCBvZiB2aWV3LiBCeSBkZWZhdWx0LCBpdCdzIGEgdmVydGljYWxcbiAgICAgKiBmaWVsZCBvZiB2aWV3LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhc3BlY3QgLSBUaGUgYXNwZWN0IHJhdGlvIG9mIHRoZSBmcnVzdHVtJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqICh3aWR0aCAvIGhlaWdodCkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpuZWFyIC0gVGhlIG5lYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYXIgLSBUaGUgZmFyIGNsaXAgcGxhbmUgaW4gZXllIGNvb3JkaW5hdGVzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2ZvdklzSG9yaXpvbnRhbD1mYWxzZV0gLSBTZXQgdG8gdHJ1ZSB0byB0cmVhdCB0aGUgZm92IGFzIGhvcml6b250YWxcbiAgICAgKiAoeC1heGlzKSBhbmQgZmFsc2UgZm9yIHZlcnRpY2FsICh5LWF4aXMpLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcGVyc3BlY3RpdmUgcHJvamVjdGlvbiBtYXRyaXhcbiAgICAgKiBjb25zdCBwZXJzcCA9IHBjLk1hdDQoKS5zZXRQZXJzcGVjdGl2ZSg0NSwgMTYgLyA5LCAxLCAxMDAwKTtcbiAgICAgKi9cbiAgICBzZXRQZXJzcGVjdGl2ZShmb3YsIGFzcGVjdCwgem5lYXIsIHpmYXIsIGZvdklzSG9yaXpvbnRhbCkge1xuICAgICAgICBNYXQ0Ll9nZXRQZXJzcGVjdGl2ZUhhbGZTaXplKF9oYWxmU2l6ZSwgZm92LCBhc3BlY3QsIHpuZWFyLCBmb3ZJc0hvcml6b250YWwpO1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRGcnVzdHVtKC1faGFsZlNpemUueCwgX2hhbGZTaXplLngsIC1faGFsZlNpemUueSwgX2hhbGZTaXplLnksIHpuZWFyLCB6ZmFyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGFuIG9ydGhvZ3JhcGhpYyBwcm9qZWN0aW9uIG1hdHJpeC4gVGhlIGZ1bmN0aW9uJ3MgcGFyYW1ldGVyc1xuICAgICAqIGRlZmluZSB0aGUgc2hhcGUgb2YgYSBjdWJvaWQtc2hhcGVkIGZydXN0dW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGVmdCAtIFRoZSB4LWNvb3JkaW5hdGUgZm9yIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmVcbiAgICAgKiBpbiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJpZ2h0IC0gVGhlIHgtY29vcmRpbmF0ZSBmb3IgdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmVcbiAgICAgKiBpbiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJvdHRvbSAtIFRoZSB5LWNvb3JkaW5hdGUgZm9yIHRoZSBib3R0b20gZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvblxuICAgICAqIHBsYW5lIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdG9wIC0gVGhlIHktY29vcmRpbmF0ZSBmb3IgdGhlIHRvcCBlZGdlIG9mIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uIHBsYW5lIGluXG4gICAgICogZXllIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZWFyIC0gVGhlIG5lYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZhciAtIFRoZSBmYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IG9ydGhvZ3JhcGhpYyBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAqIGNvbnN0IG9ydGhvID0gcGMuTWF0NCgpLm9ydGhvKC0yLCAyLCAtMiwgMiwgMSwgMTAwMCk7XG4gICAgICovXG4gICAgc2V0T3J0aG8obGVmdCwgcmlnaHQsIGJvdHRvbSwgdG9wLCBuZWFyLCBmYXIpIHtcbiAgICAgICAgY29uc3QgciA9IHRoaXMuZGF0YTtcblxuICAgICAgICByWzBdID0gMiAvIChyaWdodCAtIGxlZnQpO1xuICAgICAgICByWzFdID0gMDtcbiAgICAgICAgclsyXSA9IDA7XG4gICAgICAgIHJbM10gPSAwO1xuICAgICAgICByWzRdID0gMDtcbiAgICAgICAgcls1XSA9IDIgLyAodG9wIC0gYm90dG9tKTtcbiAgICAgICAgcls2XSA9IDA7XG4gICAgICAgIHJbN10gPSAwO1xuICAgICAgICByWzhdID0gMDtcbiAgICAgICAgcls5XSA9IDA7XG4gICAgICAgIHJbMTBdID0gLTIgLyAoZmFyIC0gbmVhcik7XG4gICAgICAgIHJbMTFdID0gMDtcbiAgICAgICAgclsxMl0gPSAtKHJpZ2h0ICsgbGVmdCkgLyAocmlnaHQgLSBsZWZ0KTtcbiAgICAgICAgclsxM10gPSAtKHRvcCArIGJvdHRvbSkgLyAodG9wIC0gYm90dG9tKTtcbiAgICAgICAgclsxNF0gPSAtKGZhciArIG5lYXIpIC8gKGZhciAtIG5lYXIpO1xuICAgICAgICByWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHJvdGF0aW9uIG1hdHJpeCBlcXVpdmFsZW50IHRvIGEgcm90YXRpb24gYXJvdW5kIGFuIGF4aXMuIFRoZVxuICAgICAqIGF4aXMgbXVzdCBiZSBub3JtYWxpemVkICh1bml0IGxlbmd0aCkgYW5kIHRoZSBhbmdsZSBtdXN0IGJlIHNwZWNpZmllZCBpbiBkZWdyZWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gVGhlIG5vcm1hbGl6ZWQgYXhpcyB2ZWN0b3IgYXJvdW5kIHdoaWNoIHRvIHJvdGF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYW5nbGUgLSBUaGUgYW5nbGUgb2Ygcm90YXRpb24gaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogY29uc3Qgcm0gPSBuZXcgcGMuTWF0NCgpLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgOTApO1xuICAgICAqL1xuICAgIHNldEZyb21BeGlzQW5nbGUoYXhpcywgYW5nbGUpIHtcbiAgICAgICAgYW5nbGUgKj0gbWF0aC5ERUdfVE9fUkFEO1xuXG4gICAgICAgIGNvbnN0IHggPSBheGlzLng7XG4gICAgICAgIGNvbnN0IHkgPSBheGlzLnk7XG4gICAgICAgIGNvbnN0IHogPSBheGlzLno7XG4gICAgICAgIGNvbnN0IGMgPSBNYXRoLmNvcyhhbmdsZSk7XG4gICAgICAgIGNvbnN0IHMgPSBNYXRoLnNpbihhbmdsZSk7XG4gICAgICAgIGNvbnN0IHQgPSAxIC0gYztcbiAgICAgICAgY29uc3QgdHggPSB0ICogeDtcbiAgICAgICAgY29uc3QgdHkgPSB0ICogeTtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0gdHggKiB4ICsgYztcbiAgICAgICAgbVsxXSA9IHR4ICogeSArIHMgKiB6O1xuICAgICAgICBtWzJdID0gdHggKiB6IC0gcyAqIHk7XG4gICAgICAgIG1bM10gPSAwO1xuICAgICAgICBtWzRdID0gdHggKiB5IC0gcyAqIHo7XG4gICAgICAgIG1bNV0gPSB0eSAqIHkgKyBjO1xuICAgICAgICBtWzZdID0gdHkgKiB6ICsgcyAqIHg7XG4gICAgICAgIG1bN10gPSAwO1xuICAgICAgICBtWzhdID0gdHggKiB6ICsgcyAqIHk7XG4gICAgICAgIG1bOV0gPSB0eSAqIHogLSB4ICogcztcbiAgICAgICAgbVsxMF0gPSB0ICogeiAqIHogKyBjO1xuICAgICAgICBtWzExXSA9IDA7XG4gICAgICAgIG1bMTJdID0gMDtcbiAgICAgICAgbVsxM10gPSAwO1xuICAgICAgICBtWzE0XSA9IDA7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgdHJhbnNsYXRpb24gbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb21wb25lbnQgb2YgdGhlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgdHJhbnNsYXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHRyYW5zbGF0aW9uIG1hdHJpeFxuICAgICAqIGNvbnN0IHRtID0gbmV3IHBjLk1hdDQoKS5zZXRUcmFuc2xhdGUoMTAsIDEwLCAxMCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFRyYW5zbGF0ZSh4LCB5LCB6KSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9IDE7XG4gICAgICAgIG1bMV0gPSAwO1xuICAgICAgICBtWzJdID0gMDtcbiAgICAgICAgbVszXSA9IDA7XG4gICAgICAgIG1bNF0gPSAwO1xuICAgICAgICBtWzVdID0gMTtcbiAgICAgICAgbVs2XSA9IDA7XG4gICAgICAgIG1bN10gPSAwO1xuICAgICAgICBtWzhdID0gMDtcbiAgICAgICAgbVs5XSA9IDA7XG4gICAgICAgIG1bMTBdID0gMTtcbiAgICAgICAgbVsxMV0gPSAwO1xuICAgICAgICBtWzEyXSA9IHg7XG4gICAgICAgIG1bMTNdID0geTtcbiAgICAgICAgbVsxNF0gPSB6O1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHNjYWxlIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHgtY29tcG9uZW50IG9mIHRoZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgc2NhbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHNjYWxlLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBzY2FsZSBtYXRyaXhcbiAgICAgKiBjb25zdCBzbSA9IG5ldyBwYy5NYXQ0KCkuc2V0U2NhbGUoMTAsIDEwLCAxMCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFNjYWxlKHgsIHksIHopIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0geDtcbiAgICAgICAgbVsxXSA9IDA7XG4gICAgICAgIG1bMl0gPSAwO1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IDA7XG4gICAgICAgIG1bNV0gPSB5O1xuICAgICAgICBtWzZdID0gMDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSAwO1xuICAgICAgICBtWzldID0gMDtcbiAgICAgICAgbVsxMF0gPSB6O1xuICAgICAgICBtWzExXSA9IDA7XG4gICAgICAgIG1bMTJdID0gMDtcbiAgICAgICAgbVsxM10gPSAwO1xuICAgICAgICBtWzE0XSA9IDA7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgbWF0cml4IHRyYW5zZm9ybWluZyBhIG5vcm1hbGl6ZWQgdmlldyB2b2x1bWUgKGluIHJhbmdlIG9mXG4gICAgICogLTEgLi4gMSkgdG8gdGhlaXIgcG9zaXRpb24gaW5zaWRlIGEgdmlld3BvcnQgKGluIHJhbmdlIG9mIDAgLi4gMSkuIFRoaXMgZW5jYXBzdWxhdGVzIGFcbiAgICAgKiBzY2FsaW5nIHRvIHRoZSBzaXplIG9mIHRoZSB2aWV3cG9ydCBhbmQgYSB0cmFuc2xhdGlvbiB0byB0aGUgcG9zaXRpb24gb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb21wb25lbnQgb2YgdGhlIHBvc2l0aW9uIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHBvc2l0aW9uIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIHdpZHRoIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBoZWlnaHQgb2YgdGhlIHZpZXdwb3J0IChpbiAwLi4xIHJhbmdlKS5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgdmlld3BvcnQgbWF0cml4IHdoaWNoIHNjYWxlcyBub3JtYWxpemVkIHZpZXcgdm9sdW1lIHRvIGZ1bGwgdGV4dHVyZSB2aWV3cG9ydFxuICAgICAqIGNvbnN0IHZtID0gbmV3IHBjLk1hdDQoKS5zZXRWaWV3cG9ydCgwLCAwLCAxLCAxKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0Vmlld3BvcnQoeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIG1bMF0gPSB3aWR0aCAqIDAuNTtcbiAgICAgICAgbVsxXSA9IDA7XG4gICAgICAgIG1bMl0gPSAwO1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IDA7XG4gICAgICAgIG1bNV0gPSBoZWlnaHQgKiAwLjU7XG4gICAgICAgIG1bNl0gPSAwO1xuICAgICAgICBtWzddID0gMDtcbiAgICAgICAgbVs4XSA9IDA7XG4gICAgICAgIG1bOV0gPSAwO1xuICAgICAgICBtWzEwXSA9IDAuNTtcbiAgICAgICAgbVsxMV0gPSAwO1xuICAgICAgICBtWzEyXSA9IHggKyB3aWR0aCAqIDAuNTtcbiAgICAgICAgbVsxM10gPSB5ICsgaGVpZ2h0ICogMC41O1xuICAgICAgICBtWzE0XSA9IDAuNTtcbiAgICAgICAgbVsxNV0gPSAxO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIG1hdHJpeCB0byBhIHJlZmxlY3Rpb24gbWF0cml4LCB3aGljaCBjYW4gYmUgdXNlZCBhcyBhIG1pcnJvciB0cmFuc2Zvcm1hdGlvbiBieSB0aGVcbiAgICAgKiBwbGFuZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gbm9ybWFsIC0gVGhlIG5vcm1hbCBvZiB0aGUgcGxhbmUgdG8gcmVmbGVjdCBieS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGlzdGFuY2UgLSBUaGUgZGlzdGFuY2Ugb2YgcGxhbmUgdG8gcmVmbGVjdCBieS5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgc2V0UmVmbGVjdGlvbihub3JtYWwsIGRpc3RhbmNlKSB7XG5cbiAgICAgICAgY29uc3QgYSA9IG5vcm1hbC54O1xuICAgICAgICBjb25zdCBiID0gbm9ybWFsLnk7XG4gICAgICAgIGNvbnN0IGMgPSBub3JtYWwuejtcbiAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBkYXRhWzBdID0gMS4wIC0gMiAqIGEgKiBhO1xuICAgICAgICBkYXRhWzFdID0gLTIgKiBhICogYjtcbiAgICAgICAgZGF0YVsyXSA9IC0yICogYSAqIGM7XG4gICAgICAgIGRhdGFbM10gPSAwO1xuICAgICAgICBkYXRhWzRdID0gLTIgKiBhICogYjtcbiAgICAgICAgZGF0YVs1XSA9IDEuMCAtIDIgKiBiICogYjtcbiAgICAgICAgZGF0YVs2XSA9IC0yICogYiAqIGM7XG4gICAgICAgIGRhdGFbN10gPSAwO1xuICAgICAgICBkYXRhWzhdID0gLTIgKiBhICogYztcbiAgICAgICAgZGF0YVs5XSA9IC0yICogYiAqIGM7XG4gICAgICAgIGRhdGFbMTBdID0gMS4wIC0gMiAqIGMgKiBjO1xuICAgICAgICBkYXRhWzExXSA9IDA7XG4gICAgICAgIGRhdGFbMTJdID0gLTIgKiBhICogZGlzdGFuY2U7XG4gICAgICAgIGRhdGFbMTNdID0gLTIgKiBiICogZGlzdGFuY2U7XG4gICAgICAgIGRhdGFbMTRdID0gLTIgKiBjICogZGlzdGFuY2U7XG4gICAgICAgIGRhdGFbMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGl0cyBpbnZlcnNlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeCBvZiAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIGNvbnN0IHJvdCA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUF4aXNBbmdsZShwYy5WZWMzLlVQLCAxODApO1xuICAgICAqXG4gICAgICogLy8gSW52ZXJ0IGluIHBsYWNlXG4gICAgICogcm90LmludmVydCgpO1xuICAgICAqL1xuICAgIGludmVydCgpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCBhMDAgPSBtWzBdO1xuICAgICAgICBjb25zdCBhMDEgPSBtWzFdO1xuICAgICAgICBjb25zdCBhMDIgPSBtWzJdO1xuICAgICAgICBjb25zdCBhMDMgPSBtWzNdO1xuICAgICAgICBjb25zdCBhMTAgPSBtWzRdO1xuICAgICAgICBjb25zdCBhMTEgPSBtWzVdO1xuICAgICAgICBjb25zdCBhMTIgPSBtWzZdO1xuICAgICAgICBjb25zdCBhMTMgPSBtWzddO1xuICAgICAgICBjb25zdCBhMjAgPSBtWzhdO1xuICAgICAgICBjb25zdCBhMjEgPSBtWzldO1xuICAgICAgICBjb25zdCBhMjIgPSBtWzEwXTtcbiAgICAgICAgY29uc3QgYTIzID0gbVsxMV07XG4gICAgICAgIGNvbnN0IGEzMCA9IG1bMTJdO1xuICAgICAgICBjb25zdCBhMzEgPSBtWzEzXTtcbiAgICAgICAgY29uc3QgYTMyID0gbVsxNF07XG4gICAgICAgIGNvbnN0IGEzMyA9IG1bMTVdO1xuXG4gICAgICAgIGNvbnN0IGIwMCA9IGEwMCAqIGExMSAtIGEwMSAqIGExMDtcbiAgICAgICAgY29uc3QgYjAxID0gYTAwICogYTEyIC0gYTAyICogYTEwO1xuICAgICAgICBjb25zdCBiMDIgPSBhMDAgKiBhMTMgLSBhMDMgKiBhMTA7XG4gICAgICAgIGNvbnN0IGIwMyA9IGEwMSAqIGExMiAtIGEwMiAqIGExMTtcbiAgICAgICAgY29uc3QgYjA0ID0gYTAxICogYTEzIC0gYTAzICogYTExO1xuICAgICAgICBjb25zdCBiMDUgPSBhMDIgKiBhMTMgLSBhMDMgKiBhMTI7XG4gICAgICAgIGNvbnN0IGIwNiA9IGEyMCAqIGEzMSAtIGEyMSAqIGEzMDtcbiAgICAgICAgY29uc3QgYjA3ID0gYTIwICogYTMyIC0gYTIyICogYTMwO1xuICAgICAgICBjb25zdCBiMDggPSBhMjAgKiBhMzMgLSBhMjMgKiBhMzA7XG4gICAgICAgIGNvbnN0IGIwOSA9IGEyMSAqIGEzMiAtIGEyMiAqIGEzMTtcbiAgICAgICAgY29uc3QgYjEwID0gYTIxICogYTMzIC0gYTIzICogYTMxO1xuICAgICAgICBjb25zdCBiMTEgPSBhMjIgKiBhMzMgLSBhMjMgKiBhMzI7XG5cbiAgICAgICAgY29uc3QgZGV0ID0gKGIwMCAqIGIxMSAtIGIwMSAqIGIxMCArIGIwMiAqIGIwOSArIGIwMyAqIGIwOCAtIGIwNCAqIGIwNyArIGIwNSAqIGIwNik7XG4gICAgICAgIGlmIChkZXQgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuc2V0SWRlbnRpdHkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGludkRldCA9IDEgLyBkZXQ7XG5cbiAgICAgICAgICAgIG1bMF0gPSAoYTExICogYjExIC0gYTEyICogYjEwICsgYTEzICogYjA5KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMV0gPSAoLWEwMSAqIGIxMSArIGEwMiAqIGIxMCAtIGEwMyAqIGIwOSkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzJdID0gKGEzMSAqIGIwNSAtIGEzMiAqIGIwNCArIGEzMyAqIGIwMykgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzNdID0gKC1hMjEgKiBiMDUgKyBhMjIgKiBiMDQgLSBhMjMgKiBiMDMpICogaW52RGV0O1xuICAgICAgICAgICAgbVs0XSA9ICgtYTEwICogYjExICsgYTEyICogYjA4IC0gYTEzICogYjA3KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bNV0gPSAoYTAwICogYjExIC0gYTAyICogYjA4ICsgYTAzICogYjA3KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bNl0gPSAoLWEzMCAqIGIwNSArIGEzMiAqIGIwMiAtIGEzMyAqIGIwMSkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzddID0gKGEyMCAqIGIwNSAtIGEyMiAqIGIwMiArIGEyMyAqIGIwMSkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzhdID0gKGExMCAqIGIxMCAtIGExMSAqIGIwOCArIGExMyAqIGIwNikgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzldID0gKC1hMDAgKiBiMTAgKyBhMDEgKiBiMDggLSBhMDMgKiBiMDYpICogaW52RGV0O1xuICAgICAgICAgICAgbVsxMF0gPSAoYTMwICogYjA0IC0gYTMxICogYjAyICsgYTMzICogYjAwKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTFdID0gKC1hMjAgKiBiMDQgKyBhMjEgKiBiMDIgLSBhMjMgKiBiMDApICogaW52RGV0O1xuICAgICAgICAgICAgbVsxMl0gPSAoLWExMCAqIGIwOSArIGExMSAqIGIwNyAtIGExMiAqIGIwNikgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzEzXSA9IChhMDAgKiBiMDkgLSBhMDEgKiBiMDcgKyBhMDIgKiBiMDYpICogaW52RGV0O1xuICAgICAgICAgICAgbVsxNF0gPSAoLWEzMCAqIGIwMyArIGEzMSAqIGIwMSAtIGEzMiAqIGIwMCkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzE1XSA9IChhMjAgKiBiMDMgLSBhMjEgKiBiMDEgKyBhMjIgKiBiMDApICogaW52RGV0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBtYXRyaXggZGF0YSBmcm9tIGFuIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc3JjIC0gU291cmNlIGFycmF5LiBNdXN0IGhhdmUgMTYgdmFsdWVzLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBzZXQoc3JjKSB7XG4gICAgICAgIGNvbnN0IGRzdCA9IHRoaXMuZGF0YTtcblxuICAgICAgICBkc3RbMF0gPSBzcmNbMF07XG4gICAgICAgIGRzdFsxXSA9IHNyY1sxXTtcbiAgICAgICAgZHN0WzJdID0gc3JjWzJdO1xuICAgICAgICBkc3RbM10gPSBzcmNbM107XG4gICAgICAgIGRzdFs0XSA9IHNyY1s0XTtcbiAgICAgICAgZHN0WzVdID0gc3JjWzVdO1xuICAgICAgICBkc3RbNl0gPSBzcmNbNl07XG4gICAgICAgIGRzdFs3XSA9IHNyY1s3XTtcbiAgICAgICAgZHN0WzhdID0gc3JjWzhdO1xuICAgICAgICBkc3RbOV0gPSBzcmNbOV07XG4gICAgICAgIGRzdFsxMF0gPSBzcmNbMTBdO1xuICAgICAgICBkc3RbMTFdID0gc3JjWzExXTtcbiAgICAgICAgZHN0WzEyXSA9IHNyY1sxMl07XG4gICAgICAgIGRzdFsxM10gPSBzcmNbMTNdO1xuICAgICAgICBkc3RbMTRdID0gc3JjWzE0XTtcbiAgICAgICAgZHN0WzE1XSA9IHNyY1sxNV07XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byB0aGUgaWRlbnRpdHkgbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogbS5zZXRJZGVudGl0eSgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIG1hdHJpeCBpcyBcIiArIChtLmlzSWRlbnRpdHkoKSA/IFwiaWRlbnRpdHlcIiA6IFwibm90IGlkZW50aXR5XCIpKTtcbiAgICAgKi9cbiAgICBzZXRJZGVudGl0eSgpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0gMTtcbiAgICAgICAgbVsxXSA9IDA7XG4gICAgICAgIG1bMl0gPSAwO1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IDA7XG4gICAgICAgIG1bNV0gPSAxO1xuICAgICAgICBtWzZdID0gMDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSAwO1xuICAgICAgICBtWzldID0gMDtcbiAgICAgICAgbVsxMF0gPSAxO1xuICAgICAgICBtWzExXSA9IDA7XG4gICAgICAgIG1bMTJdID0gMDtcbiAgICAgICAgbVsxM10gPSAwO1xuICAgICAgICBtWzE0XSA9IDA7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIHRoZSBjb25jYXRlbmF0aW9uIG9mIGEgdHJhbnNsYXRpb24sIGEgcXVhdGVybmlvbiByb3RhdGlvbiBhbmQgYVxuICAgICAqIHNjYWxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSB0IC0gQSAzLWQgdmVjdG9yIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3F1YXQuanMnKS5RdWF0fSByIC0gQSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjM30gcyAtIEEgMy1kIHZlY3RvciBzY2FsZS5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCB0ID0gbmV3IHBjLlZlYzMoMTAsIDIwLCAzMCk7XG4gICAgICogY29uc3QgciA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogY29uc3QgcyA9IG5ldyBwYy5WZWMzKDIsIDIsIDIpO1xuICAgICAqXG4gICAgICogY29uc3QgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogbS5zZXRUUlModCwgciwgcyk7XG4gICAgICovXG4gICAgc2V0VFJTKHQsIHIsIHMpIHtcbiAgICAgICAgY29uc3QgcXggPSByLng7XG4gICAgICAgIGNvbnN0IHF5ID0gci55O1xuICAgICAgICBjb25zdCBxeiA9IHIuejtcbiAgICAgICAgY29uc3QgcXcgPSByLnc7XG5cbiAgICAgICAgY29uc3Qgc3ggPSBzLng7XG4gICAgICAgIGNvbnN0IHN5ID0gcy55O1xuICAgICAgICBjb25zdCBzeiA9IHMuejtcblxuICAgICAgICBjb25zdCB4MiA9IHF4ICsgcXg7XG4gICAgICAgIGNvbnN0IHkyID0gcXkgKyBxeTtcbiAgICAgICAgY29uc3QgejIgPSBxeiArIHF6O1xuICAgICAgICBjb25zdCB4eCA9IHF4ICogeDI7XG4gICAgICAgIGNvbnN0IHh5ID0gcXggKiB5MjtcbiAgICAgICAgY29uc3QgeHogPSBxeCAqIHoyO1xuICAgICAgICBjb25zdCB5eSA9IHF5ICogeTI7XG4gICAgICAgIGNvbnN0IHl6ID0gcXkgKiB6MjtcbiAgICAgICAgY29uc3QgenogPSBxeiAqIHoyO1xuICAgICAgICBjb25zdCB3eCA9IHF3ICogeDI7XG4gICAgICAgIGNvbnN0IHd5ID0gcXcgKiB5MjtcbiAgICAgICAgY29uc3Qgd3ogPSBxdyAqIHoyO1xuXG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9ICgxIC0gKHl5ICsgenopKSAqIHN4O1xuICAgICAgICBtWzFdID0gKHh5ICsgd3opICogc3g7XG4gICAgICAgIG1bMl0gPSAoeHogLSB3eSkgKiBzeDtcbiAgICAgICAgbVszXSA9IDA7XG5cbiAgICAgICAgbVs0XSA9ICh4eSAtIHd6KSAqIHN5O1xuICAgICAgICBtWzVdID0gKDEgLSAoeHggKyB6eikpICogc3k7XG4gICAgICAgIG1bNl0gPSAoeXogKyB3eCkgKiBzeTtcbiAgICAgICAgbVs3XSA9IDA7XG5cbiAgICAgICAgbVs4XSA9ICh4eiArIHd5KSAqIHN6O1xuICAgICAgICBtWzldID0gKHl6IC0gd3gpICogc3o7XG4gICAgICAgIG1bMTBdID0gKDEgLSAoeHggKyB5eSkpICogc3o7XG4gICAgICAgIG1bMTFdID0gMDtcblxuICAgICAgICBtWzEyXSA9IHQueDtcbiAgICAgICAgbVsxM10gPSB0Lnk7XG4gICAgICAgIG1bMTRdID0gdC56O1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBpdHMgdHJhbnNwb3NlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyBUcmFuc3Bvc2UgaW4gcGxhY2VcbiAgICAgKiBtLnRyYW5zcG9zZSgpO1xuICAgICAqL1xuICAgIHRyYW5zcG9zZSgpIHtcbiAgICAgICAgbGV0IHRtcDtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICB0bXAgPSBtWzFdO1xuICAgICAgICBtWzFdID0gbVs0XTtcbiAgICAgICAgbVs0XSA9IHRtcDtcblxuICAgICAgICB0bXAgPSBtWzJdO1xuICAgICAgICBtWzJdID0gbVs4XTtcbiAgICAgICAgbVs4XSA9IHRtcDtcblxuICAgICAgICB0bXAgPSBtWzNdO1xuICAgICAgICBtWzNdID0gbVsxMl07XG4gICAgICAgIG1bMTJdID0gdG1wO1xuXG4gICAgICAgIHRtcCA9IG1bNl07XG4gICAgICAgIG1bNl0gPSBtWzldO1xuICAgICAgICBtWzldID0gdG1wO1xuXG4gICAgICAgIHRtcCA9IG1bN107XG4gICAgICAgIG1bN10gPSBtWzEzXTtcbiAgICAgICAgbVsxM10gPSB0bXA7XG5cbiAgICAgICAgdG1wID0gbVsxMV07XG4gICAgICAgIG1bMTFdID0gbVsxNF07XG4gICAgICAgIG1bMTRdID0gdG1wO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIGludmVydFRvM3gzKHJlcykge1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuICAgICAgICBjb25zdCByID0gcmVzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgbTAgPSBtWzBdO1xuICAgICAgICBjb25zdCBtMSA9IG1bMV07XG4gICAgICAgIGNvbnN0IG0yID0gbVsyXTtcblxuICAgICAgICBjb25zdCBtNCA9IG1bNF07XG4gICAgICAgIGNvbnN0IG01ID0gbVs1XTtcbiAgICAgICAgY29uc3QgbTYgPSBtWzZdO1xuXG4gICAgICAgIGNvbnN0IG04ID0gbVs4XTtcbiAgICAgICAgY29uc3QgbTkgPSBtWzldO1xuICAgICAgICBjb25zdCBtMTAgPSBtWzEwXTtcblxuICAgICAgICBjb25zdCBhMTEgPSAgbTEwICogbTUgLSBtNiAqIG05O1xuICAgICAgICBjb25zdCBhMjEgPSAtbTEwICogbTEgKyBtMiAqIG05O1xuICAgICAgICBjb25zdCBhMzEgPSAgbTYgICogbTEgLSBtMiAqIG01O1xuICAgICAgICBjb25zdCBhMTIgPSAtbTEwICogbTQgKyBtNiAqIG04O1xuICAgICAgICBjb25zdCBhMjIgPSAgbTEwICogbTAgLSBtMiAqIG04O1xuICAgICAgICBjb25zdCBhMzIgPSAtbTYgICogbTAgKyBtMiAqIG00O1xuICAgICAgICBjb25zdCBhMTMgPSAgbTkgICogbTQgLSBtNSAqIG04O1xuICAgICAgICBjb25zdCBhMjMgPSAtbTkgICogbTAgKyBtMSAqIG04O1xuICAgICAgICBjb25zdCBhMzMgPSAgbTUgICogbTAgLSBtMSAqIG00O1xuXG4gICAgICAgIGNvbnN0IGRldCA9ICBtMCAqIGExMSArIG0xICogYTEyICsgbTIgKiBhMTM7XG4gICAgICAgIGlmIChkZXQgPT09IDApIHsgLy8gbm8gaW52ZXJzZVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpZGV0ID0gMSAvIGRldDtcblxuICAgICAgICByWzBdID0gaWRldCAqIGExMTtcbiAgICAgICAgclsxXSA9IGlkZXQgKiBhMjE7XG4gICAgICAgIHJbMl0gPSBpZGV0ICogYTMxO1xuICAgICAgICByWzNdID0gaWRldCAqIGExMjtcbiAgICAgICAgcls0XSA9IGlkZXQgKiBhMjI7XG4gICAgICAgIHJbNV0gPSBpZGV0ICogYTMyO1xuICAgICAgICByWzZdID0gaWRldCAqIGExMztcbiAgICAgICAgcls3XSA9IGlkZXQgKiBhMjM7XG4gICAgICAgIHJbOF0gPSBpZGV0ICogYTMzO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSB0cmFuc2xhdGlvbmFsIGNvbXBvbmVudCBmcm9tIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3RdIC0gVGhlIHZlY3RvciB0byByZWNlaXZlIHRoZSB0cmFuc2xhdGlvbiBvZiB0aGUgbWF0cml4LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgdHJhbnNsYXRpb24gb2YgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IG1hdHJpeFxuICAgICAqIGNvbnN0IG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogLy8gUXVlcnkgdGhlIHRyYW5zbGF0aW9uIGNvbXBvbmVudFxuICAgICAqIGNvbnN0IHQgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIG0uZ2V0VHJhbnNsYXRpb24odCk7XG4gICAgICovXG4gICAgZ2V0VHJhbnNsYXRpb24odCA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgcmV0dXJuIHQuc2V0KHRoaXMuZGF0YVsxMl0sIHRoaXMuZGF0YVsxM10sIHRoaXMuZGF0YVsxNF0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSB4LWF4aXMgZnJvbSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFt4XSAtIFRoZSB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgeCBheGlzIG9mIHRoZSBtYXRyaXguXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB4LWF4aXMgb2YgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IG1hdHJpeFxuICAgICAqIGNvbnN0IG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogLy8gUXVlcnkgdGhlIHgtYXhpcyBjb21wb25lbnRcbiAgICAgKiBjb25zdCB4ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBtLmdldFgoeCk7XG4gICAgICovXG4gICAgZ2V0WCh4ID0gbmV3IFZlYzMoKSkge1xuICAgICAgICByZXR1cm4geC5zZXQodGhpcy5kYXRhWzBdLCB0aGlzLmRhdGFbMV0sIHRoaXMuZGF0YVsyXSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdHMgdGhlIHktYXhpcyBmcm9tIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3ldIC0gVGhlIHZlY3RvciB0byByZWNlaXZlIHRoZSB5IGF4aXMgb2YgdGhlIG1hdHJpeC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHktYXhpcyBvZiB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgbWF0cml4XG4gICAgICogY29uc3QgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyBRdWVyeSB0aGUgeS1heGlzIGNvbXBvbmVudFxuICAgICAqIGNvbnN0IHkgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIG0uZ2V0WSh5KTtcbiAgICAgKi9cbiAgICBnZXRZKHkgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHJldHVybiB5LnNldCh0aGlzLmRhdGFbNF0sIHRoaXMuZGF0YVs1XSwgdGhpcy5kYXRhWzZdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyB0aGUgei1heGlzIGZyb20gdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbel0gLSBUaGUgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIHogYXhpcyBvZiB0aGUgbWF0cml4LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgei1heGlzIG9mIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBtYXRyaXhcbiAgICAgKiBjb25zdCBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIC8vIFF1ZXJ5IHRoZSB6LWF4aXMgY29tcG9uZW50XG4gICAgICogY29uc3QgeiA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogbS5nZXRaKHopO1xuICAgICAqL1xuICAgIGdldFooeiA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgcmV0dXJuIHouc2V0KHRoaXMuZGF0YVs4XSwgdGhpcy5kYXRhWzldLCB0aGlzLmRhdGFbMTBdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyB0aGUgc2NhbGUgY29tcG9uZW50IGZyb20gdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbc2NhbGVdIC0gVmVjdG9yIHRvIHJlY2VpdmUgdGhlIHNjYWxlLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgc2NhbGUgaW4gWCwgWSBhbmQgWiBvZiB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBRdWVyeSB0aGUgc2NhbGUgY29tcG9uZW50XG4gICAgICogY29uc3Qgc2NhbGUgPSBtLmdldFNjYWxlKCk7XG4gICAgICovXG4gICAgZ2V0U2NhbGUoc2NhbGUgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHRoaXMuZ2V0WCh4KTtcbiAgICAgICAgdGhpcy5nZXRZKHkpO1xuICAgICAgICB0aGlzLmdldFooeik7XG4gICAgICAgIHNjYWxlLnNldCh4Lmxlbmd0aCgpLCB5Lmxlbmd0aCgpLCB6Lmxlbmd0aCgpKTtcblxuICAgICAgICByZXR1cm4gc2NhbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogLTEgaWYgdGhlIHRoZSBtYXRyaXggaGFzIGFuIG9kZCBudW1iZXIgb2YgbmVnYXRpdmUgc2NhbGVzIChtaXJyb3JlZCk7IDEgb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHNjYWxlU2lnbigpIHtcbiAgICAgICAgdGhpcy5nZXRYKHgpO1xuICAgICAgICB0aGlzLmdldFkoeSk7XG4gICAgICAgIHRoaXMuZ2V0Wih6KTtcbiAgICAgICAgeC5jcm9zcyh4LCB5KTtcbiAgICAgICAgcmV0dXJuIHguZG90KHopIDwgMCA/IC0xIDogMTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgcm90YXRpb24gbWF0cml4IGRlZmluZWQgYnkgRXVsZXIgYW5nbGVzLiBUaGUgRXVsZXIgYW5nbGVzIGFyZVxuICAgICAqIHNwZWNpZmllZCBpbiBYWVogb3JkZXIgYW5kIGluIGRlZ3JlZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZXggLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFggYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBleSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWSBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGV6IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBaIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiBtLnNldEZyb21FdWxlckFuZ2xlcyg0NSwgOTAsIDE4MCk7XG4gICAgICovXG4gICAgc2V0RnJvbUV1bGVyQW5nbGVzKGV4LCBleSwgZXopIHtcbiAgICAgICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Sb3RhdGlvbl9tYXRyaXgjQ29udmVyc2lvbl9mcm9tX2FuZF90b19heGlzLWFuZ2xlXG4gICAgICAgIC8vIFRoZSAzRCBzcGFjZSBpcyByaWdodC1oYW5kZWQsIHNvIHRoZSByb3RhdGlvbiBhcm91bmQgZWFjaCBheGlzIHdpbGwgYmUgY291bnRlcmNsb2Nrd2lzZVxuICAgICAgICAvLyBmb3IgYW4gb2JzZXJ2ZXIgcGxhY2VkIHNvIHRoYXQgdGhlIGF4aXMgZ29lcyBpbiBoaXMgb3IgaGVyIGRpcmVjdGlvbiAoUmlnaHQtaGFuZCBydWxlKS5cbiAgICAgICAgZXggKj0gbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICBleSAqPSBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGV6ICo9IG1hdGguREVHX1RPX1JBRDtcblxuICAgICAgICAvLyBTb2x1dGlvbiB0YWtlbiBmcm9tIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRXVsZXJfYW5nbGVzI01hdHJpeF9vcmllbnRhdGlvblxuICAgICAgICBjb25zdCBzMSA9IE1hdGguc2luKC1leCk7XG4gICAgICAgIGNvbnN0IGMxID0gTWF0aC5jb3MoLWV4KTtcbiAgICAgICAgY29uc3QgczIgPSBNYXRoLnNpbigtZXkpO1xuICAgICAgICBjb25zdCBjMiA9IE1hdGguY29zKC1leSk7XG4gICAgICAgIGNvbnN0IHMzID0gTWF0aC5zaW4oLWV6KTtcbiAgICAgICAgY29uc3QgYzMgPSBNYXRoLmNvcygtZXopO1xuXG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgLy8gU2V0IHJvdGF0aW9uIGVsZW1lbnRzXG4gICAgICAgIG1bMF0gPSBjMiAqIGMzO1xuICAgICAgICBtWzFdID0gLWMyICogczM7XG4gICAgICAgIG1bMl0gPSBzMjtcbiAgICAgICAgbVszXSA9IDA7XG5cbiAgICAgICAgbVs0XSA9IGMxICogczMgKyBjMyAqIHMxICogczI7XG4gICAgICAgIG1bNV0gPSBjMSAqIGMzIC0gczEgKiBzMiAqIHMzO1xuICAgICAgICBtWzZdID0gLWMyICogczE7XG4gICAgICAgIG1bN10gPSAwO1xuXG4gICAgICAgIG1bOF0gPSBzMSAqIHMzIC0gYzEgKiBjMyAqIHMyO1xuICAgICAgICBtWzldID0gYzMgKiBzMSArIGMxICogczIgKiBzMztcbiAgICAgICAgbVsxMF0gPSBjMSAqIGMyO1xuICAgICAgICBtWzExXSA9IDA7XG5cbiAgICAgICAgbVsxMl0gPSAwO1xuICAgICAgICBtWzEzXSA9IDA7XG4gICAgICAgIG1bMTRdID0gMDtcbiAgICAgICAgbVsxNV0gPSAxO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSBFdWxlciBhbmdsZXMgZXF1aXZhbGVudCB0byB0aGUgcm90YXRpb25hbCBwb3J0aW9uIG9mIHRoZSBzcGVjaWZpZWQgbWF0cml4LiBUaGVcbiAgICAgKiByZXR1cm5lZCBFdWxlciBhbmdsZXMgYXJlIGluIFhZWiBvcmRlciBhbiBpbiBkZWdyZWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbZXVsZXJzXSAtIEEgMy1kIHZlY3RvciB0byByZWNlaXZlIHRoZSBFdWxlciBhbmdsZXMuXG4gICAgICogQHJldHVybnMge1ZlYzN9IEEgMy1kIHZlY3RvciBjb250YWluaW5nIHRoZSBFdWxlciBhbmdsZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4IG9mIDQ1IGRlZ3JlZXMgYXJvdW5kIHRoZSB5LWF4aXNcbiAgICAgKiBjb25zdCBtID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDQ1KTtcbiAgICAgKlxuICAgICAqIGNvbnN0IGV1bGVycyA9IG0uZ2V0RXVsZXJBbmdsZXMoKTtcbiAgICAgKi9cbiAgICBnZXRFdWxlckFuZ2xlcyhldWxlcnMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHRoaXMuZ2V0U2NhbGUoc2NhbGUpO1xuICAgICAgICBjb25zdCBzeCA9IHNjYWxlLng7XG4gICAgICAgIGNvbnN0IHN5ID0gc2NhbGUueTtcbiAgICAgICAgY29uc3Qgc3ogPSBzY2FsZS56O1xuXG4gICAgICAgIGlmIChzeCA9PT0gMCB8fCBzeSA9PT0gMCB8fCBzeiA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiBldWxlcnMuc2V0KDAsIDAsIDApO1xuXG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgeSA9IE1hdGguYXNpbigtbVsyXSAvIHN4KTtcbiAgICAgICAgY29uc3QgaGFsZlBpID0gTWF0aC5QSSAqIDAuNTtcblxuICAgICAgICBsZXQgeCwgejtcblxuICAgICAgICBpZiAoeSA8IGhhbGZQaSkge1xuICAgICAgICAgICAgaWYgKHkgPiAtaGFsZlBpKSB7XG4gICAgICAgICAgICAgICAgeCA9IE1hdGguYXRhbjIobVs2XSAvIHN5LCBtWzEwXSAvIHN6KTtcbiAgICAgICAgICAgICAgICB6ID0gTWF0aC5hdGFuMihtWzFdIC8gc3gsIG1bMF0gLyBzeCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE5vdCBhIHVuaXF1ZSBzb2x1dGlvblxuICAgICAgICAgICAgICAgIHogPSAwO1xuICAgICAgICAgICAgICAgIHggPSAtTWF0aC5hdGFuMihtWzRdIC8gc3ksIG1bNV0gLyBzeSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBOb3QgYSB1bmlxdWUgc29sdXRpb25cbiAgICAgICAgICAgIHogPSAwO1xuICAgICAgICAgICAgeCA9IE1hdGguYXRhbjIobVs0XSAvIHN5LCBtWzVdIC8gc3kpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV1bGVycy5zZXQoeCwgeSwgeikubXVsU2NhbGFyKG1hdGguUkFEX1RPX0RFRyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gc3RyaW5nIGZvcm0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgbWF0cml4IGluIHN0cmluZyBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogLy8gT3V0cHV0cyBbMSwgMCwgMCwgMCwgMCwgMSwgMCwgMCwgMCwgMCwgMSwgMCwgMCwgMCwgMCwgMV1cbiAgICAgKiBjb25zb2xlLmxvZyhtLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gJ1snICsgdGhpcy5kYXRhLmpvaW4oJywgJykgKyAnXSc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCBtYXRyaXggc2V0IHRvIHRoZSBpZGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBJREVOVElUWSA9IE9iamVjdC5mcmVlemUobmV3IE1hdDQoKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IG1hdHJpeCB3aXRoIGFsbCBlbGVtZW50cyBzZXQgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBaRVJPID0gT2JqZWN0LmZyZWV6ZShuZXcgTWF0NCgpLnNldChbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pKTtcbn1cblxuZXhwb3J0IHsgTWF0NCB9O1xuIl0sIm5hbWVzIjpbIl9oYWxmU2l6ZSIsIlZlYzIiLCJ4IiwiVmVjMyIsInkiLCJ6Iiwic2NhbGUiLCJNYXQ0IiwiY29uc3RydWN0b3IiLCJkYXRhIiwiRmxvYXQzMkFycmF5IiwiX2dldFBlcnNwZWN0aXZlSGFsZlNpemUiLCJoYWxmU2l6ZSIsImZvdiIsImFzcGVjdCIsInpuZWFyIiwiZm92SXNIb3Jpem9udGFsIiwiTWF0aCIsInRhbiIsIlBJIiwiYWRkMiIsImxocyIsInJocyIsImEiLCJiIiwiciIsImFkZCIsImNsb25lIiwiY3N0ciIsImNvcHkiLCJzcmMiLCJkc3QiLCJlcXVhbHMiLCJsIiwiaXNJZGVudGl0eSIsIm0iLCJtdWwyIiwiYTAwIiwiYTAxIiwiYTAyIiwiYTAzIiwiYTEwIiwiYTExIiwiYTEyIiwiYTEzIiwiYTIwIiwiYTIxIiwiYTIyIiwiYTIzIiwiYTMwIiwiYTMxIiwiYTMyIiwiYTMzIiwiYjAiLCJiMSIsImIyIiwiYjMiLCJtdWxBZmZpbmUyIiwibXVsIiwidHJhbnNmb3JtUG9pbnQiLCJ2ZWMiLCJyZXMiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJ0cmFuc2Zvcm1WZWM0IiwiVmVjNCIsInciLCJzZXRMb29rQXQiLCJwb3NpdGlvbiIsInRhcmdldCIsInVwIiwic3ViMiIsIm5vcm1hbGl6ZSIsImNyb3NzIiwic2V0RnJ1c3R1bSIsImxlZnQiLCJyaWdodCIsImJvdHRvbSIsInRvcCIsInpmYXIiLCJ0ZW1wMSIsInRlbXAyIiwidGVtcDMiLCJ0ZW1wNCIsInNldFBlcnNwZWN0aXZlIiwic2V0T3J0aG8iLCJuZWFyIiwiZmFyIiwic2V0RnJvbUF4aXNBbmdsZSIsImF4aXMiLCJhbmdsZSIsIm1hdGgiLCJERUdfVE9fUkFEIiwiYyIsImNvcyIsInMiLCJzaW4iLCJ0IiwidHgiLCJ0eSIsInNldFRyYW5zbGF0ZSIsInNldFNjYWxlIiwic2V0Vmlld3BvcnQiLCJ3aWR0aCIsImhlaWdodCIsInNldFJlZmxlY3Rpb24iLCJub3JtYWwiLCJkaXN0YW5jZSIsImludmVydCIsImIwMCIsImIwMSIsImIwMiIsImIwMyIsImIwNCIsImIwNSIsImIwNiIsImIwNyIsImIwOCIsImIwOSIsImIxMCIsImIxMSIsImRldCIsInNldElkZW50aXR5IiwiaW52RGV0Iiwic2V0Iiwic2V0VFJTIiwicXgiLCJxeSIsInF6IiwicXciLCJzeCIsInN5Iiwic3oiLCJ4MiIsInkyIiwiejIiLCJ4eCIsInh5IiwieHoiLCJ5eSIsInl6IiwienoiLCJ3eCIsInd5Iiwid3oiLCJ0cmFuc3Bvc2UiLCJ0bXAiLCJpbnZlcnRUbzN4MyIsIm0wIiwibTEiLCJtMiIsIm00IiwibTUiLCJtNiIsIm04IiwibTkiLCJtMTAiLCJpZGV0IiwiZ2V0VHJhbnNsYXRpb24iLCJnZXRYIiwiZ2V0WSIsImdldFoiLCJnZXRTY2FsZSIsImxlbmd0aCIsInNjYWxlU2lnbiIsImRvdCIsInNldEZyb21FdWxlckFuZ2xlcyIsImV4IiwiZXkiLCJleiIsInMxIiwiYzEiLCJzMiIsImMyIiwiczMiLCJjMyIsImdldEV1bGVyQW5nbGVzIiwiZXVsZXJzIiwiYXNpbiIsImhhbGZQaSIsImF0YW4yIiwibXVsU2NhbGFyIiwiUkFEX1RPX0RFRyIsInRvU3RyaW5nIiwiam9pbiIsIklERU5USVRZIiwiT2JqZWN0IiwiZnJlZXplIiwiWkVSTyJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFLQSxNQUFNQSxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDNUIsTUFBTUMsQ0FBQyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3BCLE1BQU1DLENBQUMsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUNwQixNQUFNRSxDQUFDLEdBQUcsSUFBSUYsSUFBSSxFQUFFLENBQUE7QUFDcEIsTUFBTUcsS0FBSyxHQUFHLElBQUlILElBQUksRUFBRSxDQUFBOztBQUV4QjtBQUNBO0FBQ0E7QUFDQSxNQUFNSSxJQUFJLENBQUM7QUFRUDtBQUNKO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsR0FBRztBQVZkO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsSUFBSSxHQUFHLElBQUlDLFlBQVksQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQU12QjtBQUNBO0lBQ0EsSUFBSSxDQUFDRCxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDQSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDQSxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDQSxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ25FLEdBQUE7O0FBRUE7RUFDQSxPQUFPRSx1QkFBdUJBLENBQUNDLFFBQVEsRUFBRUMsR0FBRyxFQUFFQyxNQUFNLEVBQUVDLEtBQUssRUFBRUMsZUFBZSxFQUFFO0FBQzFFLElBQUEsSUFBSUEsZUFBZSxFQUFFO0FBQ2pCSixNQUFBQSxRQUFRLENBQUNWLENBQUMsR0FBR2EsS0FBSyxHQUFHRSxJQUFJLENBQUNDLEdBQUcsQ0FBQ0wsR0FBRyxHQUFHSSxJQUFJLENBQUNFLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUNsRFAsTUFBQUEsUUFBUSxDQUFDUixDQUFDLEdBQUdRLFFBQVEsQ0FBQ1YsQ0FBQyxHQUFHWSxNQUFNLENBQUE7QUFDcEMsS0FBQyxNQUFNO0FBQ0hGLE1BQUFBLFFBQVEsQ0FBQ1IsQ0FBQyxHQUFHVyxLQUFLLEdBQUdFLElBQUksQ0FBQ0MsR0FBRyxDQUFDTCxHQUFHLEdBQUdJLElBQUksQ0FBQ0UsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFBO0FBQ2xEUCxNQUFBQSxRQUFRLENBQUNWLENBQUMsR0FBR1UsUUFBUSxDQUFDUixDQUFDLEdBQUdVLE1BQU0sQ0FBQTtBQUNwQyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJTSxFQUFBQSxJQUFJQSxDQUFDQyxHQUFHLEVBQUVDLEdBQUcsRUFBRTtBQUNYLElBQUEsTUFBTUMsQ0FBQyxHQUFHRixHQUFHLENBQUNaLElBQUk7TUFDZGUsQ0FBQyxHQUFHRixHQUFHLENBQUNiLElBQUk7TUFDWmdCLENBQUMsR0FBRyxJQUFJLENBQUNoQixJQUFJLENBQUE7QUFFakJnQixJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBRXJCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJRSxHQUFHQSxDQUFDSixHQUFHLEVBQUU7QUFDTCxJQUFBLE9BQU8sSUFBSSxDQUFDRixJQUFJLENBQUMsSUFBSSxFQUFFRSxHQUFHLENBQUMsQ0FBQTtBQUMvQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJSyxFQUFBQSxLQUFLQSxHQUFHO0FBQ0o7QUFDQSxJQUFBLE1BQU1DLElBQUksR0FBRyxJQUFJLENBQUNwQixXQUFXLENBQUE7SUFDN0IsT0FBTyxJQUFJb0IsSUFBSSxFQUFFLENBQUNDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNoQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUEsSUFBSUEsQ0FBQ1AsR0FBRyxFQUFFO0FBQ04sSUFBQSxNQUFNUSxHQUFHLEdBQUdSLEdBQUcsQ0FBQ2IsSUFBSTtNQUNoQnNCLEdBQUcsR0FBRyxJQUFJLENBQUN0QixJQUFJLENBQUE7QUFFbkJzQixJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUdELEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqQkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDakJDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ2pCQyxJQUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUdELEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqQkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDakJDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBRWpCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lFLE1BQU1BLENBQUNWLEdBQUcsRUFBRTtBQUNSLElBQUEsTUFBTVcsQ0FBQyxHQUFHLElBQUksQ0FBQ3hCLElBQUk7TUFDZmdCLENBQUMsR0FBR0gsR0FBRyxDQUFDYixJQUFJLENBQUE7QUFFaEIsSUFBQSxPQUFTd0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLUixDQUFDLENBQUMsQ0FBQyxDQUFDLElBQ2JRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBS1IsQ0FBQyxDQUFDLENBQUMsQ0FBRSxJQUNkUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUtSLENBQUMsQ0FBQyxDQUFDLENBQUUsSUFDZFEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLUixDQUFDLENBQUMsQ0FBQyxDQUFFLElBQ2RRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBS1IsQ0FBQyxDQUFDLENBQUMsQ0FBRSxJQUNkUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUtSLENBQUMsQ0FBQyxDQUFDLENBQUUsSUFDZFEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLUixDQUFDLENBQUMsQ0FBQyxDQUFFLElBQ2RRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBS1IsQ0FBQyxDQUFDLENBQUMsQ0FBRSxJQUNkUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUtSLENBQUMsQ0FBQyxDQUFDLENBQUUsSUFDZFEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLUixDQUFDLENBQUMsQ0FBQyxDQUFFLElBQ2RRLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBS1IsQ0FBQyxDQUFDLEVBQUUsQ0FBRSxJQUNoQlEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLUixDQUFDLENBQUMsRUFBRSxDQUFFLElBQ2hCUSxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUtSLENBQUMsQ0FBQyxFQUFFLENBQUUsSUFDaEJRLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBS1IsQ0FBQyxDQUFDLEVBQUUsQ0FBRSxJQUNoQlEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLUixDQUFDLENBQUMsRUFBRSxDQUFFLElBQ2hCUSxDQUFDLENBQUMsRUFBRSxDQUFDLEtBQUtSLENBQUMsQ0FBQyxFQUFFLENBQUUsQ0FBQTtBQUM3QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSVMsRUFBQUEsVUFBVUEsR0FBRztBQUNULElBQUEsTUFBTUMsQ0FBQyxHQUFHLElBQUksQ0FBQzFCLElBQUksQ0FBQTtJQUVuQixPQUFTMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFDVkEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUUsSUFDWEEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUUsSUFDWkEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUUsSUFDWkEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUUsSUFDWkEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUUsSUFDWkEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUUsSUFDWkEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUUsQ0FBQTtBQUN6QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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QUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1RBLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDVEEsSUFBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNUQSxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBRVQsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lnRSxFQUFBQSxZQUFZQSxDQUFDakcsQ0FBQyxFQUFFRSxDQUFDLEVBQUVDLENBQUMsRUFBRTtBQUNsQixJQUFBLE1BQU04QixDQUFDLEdBQUcsSUFBSSxDQUFDMUIsSUFBSSxDQUFBO0FBRW5CMEIsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1RBLElBQUFBLENBQUMs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R0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ2pCQyxJQUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUdELEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqQkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDakJDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ2pCQyxJQUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUdELEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqQkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFFakIsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJMkYsRUFBQUEsV0FBV0EsR0FBRztBQUNWLElBQUEsTUFBTXRGLENBQUMsR0FBRyxJQUFJLENBQUMxQixJQUFJLENBQUE7QUFFbkIwQixJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDVEEsSUFBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNUQSxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1RBLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDVEEsSUFBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNUQSxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBRVQsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFD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
