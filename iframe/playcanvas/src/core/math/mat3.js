import { Vec3 } from './vec3.js';

var _Mat;
class Mat3 {
  constructor() {
    this.data = new Float32Array(9);
    this.data[0] = this.data[4] = this.data[8] = 1;
  }
  clone() {
    const cstr = this.constructor;
    return new cstr().copy(this);
  }
  copy(rhs) {
    const src = rhs.data;
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
    return this;
  }
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
    return this;
  }
  getX(x = new Vec3()) {
    return x.set(this.data[0], this.data[1], this.data[2]);
  }
  getY(y = new Vec3()) {
    return y.set(this.data[3], this.data[4], this.data[5]);
  }
  getZ(z = new Vec3()) {
    return z.set(this.data[6], this.data[7], this.data[8]);
  }
  equals(rhs) {
    const l = this.data;
    const r = rhs.data;
    return l[0] === r[0] && l[1] === r[1] && l[2] === r[2] && l[3] === r[3] && l[4] === r[4] && l[5] === r[5] && l[6] === r[6] && l[7] === r[7] && l[8] === r[8];
  }
  isIdentity() {
    const m = this.data;
    return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 1 && m[5] === 0 && m[6] === 0 && m[7] === 0 && m[8] === 1;
  }
  setIdentity() {
    const m = this.data;
    m[0] = 1;
    m[1] = 0;
    m[2] = 0;
    m[3] = 0;
    m[4] = 1;
    m[5] = 0;
    m[6] = 0;
    m[7] = 0;
    m[8] = 1;
    return this;
  }
  toString() {
    return '[' + this.data.join(', ') + ']';
  }
  transpose(src = this) {
    const s = src.data;
    const t = this.data;
    if (s === t) {
      let tmp;
      tmp = s[1];
      t[1] = s[3];
      t[3] = tmp;
      tmp = s[2];
      t[2] = s[6];
      t[6] = tmp;
      tmp = s[5];
      t[5] = s[7];
      t[7] = tmp;
    } else {
      t[0] = s[0];
      t[1] = s[3];
      t[2] = s[6];
      t[3] = s[1];
      t[4] = s[4];
      t[5] = s[7];
      t[6] = s[2];
      t[7] = s[5];
      t[8] = s[8];
    }
    return this;
  }
  setFromMat4(m) {
    const src = m.data;
    const dst = this.data;
    dst[0] = src[0];
    dst[1] = src[1];
    dst[2] = src[2];
    dst[3] = src[4];
    dst[4] = src[5];
    dst[5] = src[6];
    dst[6] = src[8];
    dst[7] = src[9];
    dst[8] = src[10];
    return this;
  }
  invertMat4(src) {
    const s = src.data;
    const a0 = s[0];
    const a1 = s[1];
    const a2 = s[2];
    const a4 = s[4];
    const a5 = s[5];
    const a6 = s[6];
    const a8 = s[8];
    const a9 = s[9];
    const a10 = s[10];
    const b11 = a10 * a5 - a6 * a9;
    const b21 = -a10 * a1 + a2 * a9;
    const b31 = a6 * a1 - a2 * a5;
    const b12 = -a10 * a4 + a6 * a8;
    const b22 = a10 * a0 - a2 * a8;
    const b32 = -a6 * a0 + a2 * a4;
    const b13 = a9 * a4 - a5 * a8;
    const b23 = -a9 * a0 + a1 * a8;
    const b33 = a5 * a0 - a1 * a4;
    const det = a0 * b11 + a1 * b12 + a2 * b13;
    if (det === 0) {
      this.setIdentity();
    } else {
      const invDet = 1 / det;
      const t = this.data;
      t[0] = b11 * invDet;
      t[1] = b21 * invDet;
      t[2] = b31 * invDet;
      t[3] = b12 * invDet;
      t[4] = b22 * invDet;
      t[5] = b32 * invDet;
      t[6] = b13 * invDet;
      t[7] = b23 * invDet;
      t[8] = b33 * invDet;
    }
    return this;
  }
  transformVector(vec, res = new Vec3()) {
    const m = this.data;
    const x = vec.x;
    const y = vec.y;
    const z = vec.z;
    res.x = x * m[0] + y * m[3] + z * m[6];
    res.y = x * m[1] + y * m[4] + z * m[7];
    res.z = x * m[2] + y * m[5] + z * m[8];
    return res;
  }
}
_Mat = Mat3;
Mat3.IDENTITY = Object.freeze(new _Mat());
Mat3.ZERO = Object.freeze(new _Mat().set([0, 0, 0, 0, 0, 0, 0, 0, 0]));

export { Mat3 };
