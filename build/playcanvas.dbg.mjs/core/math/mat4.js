/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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

class Mat4 {
  constructor() {
    const data = new Float32Array(16);
    data[0] = data[5] = data[10] = data[15] = 1;

    this.data = data;
  }

  static _getPerspectiveHalfSize(halfSize, fov, aspect, znear, fovIsHorizontal) {
    if (fovIsHorizontal) {
      halfSize.x = znear * Math.tan(fov * Math.PI / 360);
      halfSize.y = halfSize.x / aspect;
    } else {
      halfSize.y = znear * Math.tan(fov * Math.PI / 360);
      halfSize.x = halfSize.y * aspect;
    }
  }

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

  add(rhs) {
    return this.add2(this, rhs);
  }

  clone() {
    const cstr = this.constructor;
    return new cstr().copy(this);
  }

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

  equals(rhs) {
    const l = this.data,
      r = rhs.data;
    return l[0] === r[0] && l[1] === r[1] && l[2] === r[2] && l[3] === r[3] && l[4] === r[4] && l[5] === r[5] && l[6] === r[6] && l[7] === r[7] && l[8] === r[8] && l[9] === r[9] && l[10] === r[10] && l[11] === r[11] && l[12] === r[12] && l[13] === r[13] && l[14] === r[14] && l[15] === r[15];
  }

  isIdentity() {
    const m = this.data;
    return m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 0 && m[4] === 0 && m[5] === 1 && m[6] === 0 && m[7] === 0 && m[8] === 0 && m[9] === 0 && m[10] === 1 && m[11] === 0 && m[12] === 0 && m[13] === 0 && m[14] === 0 && m[15] === 1;
  }

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

  mul(rhs) {
    return this.mul2(this, rhs);
  }

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

  setPerspective(fov, aspect, znear, zfar, fovIsHorizontal) {
    Mat4._getPerspectiveHalfSize(_halfSize, fov, aspect, znear, fovIsHorizontal);
    return this.setFrustum(-_halfSize.x, _halfSize.x, -_halfSize.y, _halfSize.y, znear, zfar);
  }

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

  getTranslation(t = new Vec3()) {
    return t.set(this.data[12], this.data[13], this.data[14]);
  }

  getX(x = new Vec3()) {
    return x.set(this.data[0], this.data[1], this.data[2]);
  }

  getY(y = new Vec3()) {
    return y.set(this.data[4], this.data[5], this.data[6]);
  }

  getZ(z = new Vec3()) {
    return z.set(this.data[8], this.data[9], this.data[10]);
  }

  getScale(scale = new Vec3()) {
    this.getX(x);
    this.getY(y);
    this.getZ(z);
    scale.set(x.length(), y.length(), z.length());
    return scale;
  }

  setFromEulerAngles(ex, ey, ez) {
    ex *= math.DEG_TO_RAD;
    ey *= math.DEG_TO_RAD;
    ez *= math.DEG_TO_RAD;

    const s1 = Math.sin(-ex);
    const c1 = Math.cos(-ex);
    const s2 = Math.sin(-ey);
    const c2 = Math.cos(-ey);
    const s3 = Math.sin(-ez);
    const c3 = Math.cos(-ez);
    const m = this.data;

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
        z = 0;
        x = -Math.atan2(m[4] / sy, m[5] / sy);
      }
    } else {
      z = 0;
      x = Math.atan2(m[4] / sy, m[5] / sy);
    }
    return eulers.set(x, y, z).mulScalar(math.RAD_TO_DEG);
  }

  toString() {
    return '[' + this.data.join(', ') + ']';
  }

}
Mat4.IDENTITY = Object.freeze(new Mat4());
Mat4.ZERO = Object.freeze(new Mat4().set([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

export { Mat4 };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0NC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9tYXQ0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4vdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuL3ZlYzQuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9xdWF0LmpzJykuUXVhdH0gUXVhdCAqL1xuXG5jb25zdCBfaGFsZlNpemUgPSBuZXcgVmVjMigpO1xuY29uc3QgeCA9IG5ldyBWZWMzKCk7XG5jb25zdCB5ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHogPSBuZXcgVmVjMygpO1xuY29uc3Qgc2NhbGUgPSBuZXcgVmVjMygpO1xuXG5cbi8qKlxuICogQSA0eDQgbWF0cml4LlxuICovXG5jbGFzcyBNYXQ0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTWF0NCBpbnN0YW5jZS4gSXQgaXMgaW5pdGlhbGl6ZWQgdG8gdGhlIGlkZW50aXR5IG1hdHJpeC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLy8gQ3JlYXRlIGFuIGlkZW50aXR5IG1hdHJpeC4gTm90ZSB0aGF0IGEgbmV3IEZsb2F0MzJBcnJheSBoYXMgYWxsIGVsZW1lbnRzIHNldFxuICAgICAgICAvLyB0byB6ZXJvIGJ5IGRlZmF1bHQsIHNvIHdlIG9ubHkgbmVlZCB0byBzZXQgdGhlIHJlbGV2YW50IGVsZW1lbnRzIHRvIG9uZS5cbiAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMTYpO1xuICAgICAgICBkYXRhWzBdID0gZGF0YVs1XSA9IGRhdGFbMTBdID0gZGF0YVsxNV0gPSAxO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYXRyaXggZWxlbWVudHMgaW4gdGhlIGZvcm0gb2YgYSBmbGF0IGFycmF5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RmxvYXQzMkFycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICB9XG5cbiAgICAvLyBTdGF0aWMgZnVuY3Rpb24gd2hpY2ggZXZhbHVhdGVzIHBlcnNwZWN0aXZlIHByb2plY3Rpb24gbWF0cml4IGhhbGYgc2l6ZSBhdCB0aGUgbmVhciBwbGFuZVxuICAgIHN0YXRpYyBfZ2V0UGVyc3BlY3RpdmVIYWxmU2l6ZShoYWxmU2l6ZSwgZm92LCBhc3BlY3QsIHpuZWFyLCBmb3ZJc0hvcml6b250YWwpIHtcbiAgICAgICAgaWYgKGZvdklzSG9yaXpvbnRhbCkge1xuICAgICAgICAgICAgaGFsZlNpemUueCA9IHpuZWFyICogTWF0aC50YW4oZm92ICogTWF0aC5QSSAvIDM2MCk7XG4gICAgICAgICAgICBoYWxmU2l6ZS55ID0gaGFsZlNpemUueCAvIGFzcGVjdDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbGZTaXplLnkgPSB6bmVhciAqIE1hdGgudGFuKGZvdiAqIE1hdGguUEkgLyAzNjApO1xuICAgICAgICAgICAgaGFsZlNpemUueCA9IGhhbGZTaXplLnkgKiBhc3BlY3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpY2VzIHRvZ2V0aGVyIGFuZCBzdG9yZXMgdGhlIHJlc3VsdCBpbiB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbGhzIC0gVGhlIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgZmlyc3Qgb3BlcmFuZCBvZiB0aGUgYWRkaXRpb24uXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgNHg0IG1hdHJpeCB1c2VkIGFzIHRoZSBzZWNvbmQgb3BlcmFuZCBvZiB0aGUgYWRkaXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogbS5hZGQyKHBjLk1hdDQuSURFTlRJVFksIHBjLk1hdDQuT05FKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgbS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGQyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IGEgPSBsaHMuZGF0YSxcbiAgICAgICAgICAgIGIgPSByaHMuZGF0YSxcbiAgICAgICAgICAgIHIgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgclswXSA9IGFbMF0gKyBiWzBdO1xuICAgICAgICByWzFdID0gYVsxXSArIGJbMV07XG4gICAgICAgIHJbMl0gPSBhWzJdICsgYlsyXTtcbiAgICAgICAgclszXSA9IGFbM10gKyBiWzNdO1xuICAgICAgICByWzRdID0gYVs0XSArIGJbNF07XG4gICAgICAgIHJbNV0gPSBhWzVdICsgYls1XTtcbiAgICAgICAgcls2XSA9IGFbNl0gKyBiWzZdO1xuICAgICAgICByWzddID0gYVs3XSArIGJbN107XG4gICAgICAgIHJbOF0gPSBhWzhdICsgYls4XTtcbiAgICAgICAgcls5XSA9IGFbOV0gKyBiWzldO1xuICAgICAgICByWzEwXSA9IGFbMTBdICsgYlsxMF07XG4gICAgICAgIHJbMTFdID0gYVsxMV0gKyBiWzExXTtcbiAgICAgICAgclsxMl0gPSBhWzEyXSArIGJbMTJdO1xuICAgICAgICByWzEzXSA9IGFbMTNdICsgYlsxM107XG4gICAgICAgIHJbMTRdID0gYVsxNF0gKyBiWzE0XTtcbiAgICAgICAgclsxNV0gPSBhWzE1XSArIGJbMTVdO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4IHRvIHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgNHg0IG1hdHJpeCB1c2VkIGFzIHRoZSBzZWNvbmQgb3BlcmFuZCBvZiB0aGUgYWRkaXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogbS5hZGQocGMuTWF0NC5PTkUpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBhZGRpdGlvbiBpczogXCIgKyBtLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIGFkZChyaHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWRkMih0aGlzLCByaHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBkdXBsaWNhdGUgb2YgdGhlIHNwZWNpZmllZCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7dGhpc30gQSBkdXBsaWNhdGUgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNyYyA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqIHZhciBkc3QgPSBzcmMuY2xvbmUoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gbWF0cmljZXMgYXJlIFwiICsgKHNyYy5lcXVhbHMoZHN0KSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKCkuY29weSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIDR4NCBtYXRyaXggdG8gYSBkZXN0aW5hdGlvbiA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBBIDR4NCBtYXRyaXggdG8gYmUgY29waWVkLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBzcmMgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKiB2YXIgZHN0ID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiBkc3QuY29weShzcmMpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byBtYXRyaWNlcyBhcmUgXCIgKyAoc3JjLmVxdWFscyhkc3QpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGNvcHkocmhzKSB7XG4gICAgICAgIGNvbnN0IHNyYyA9IHJocy5kYXRhLFxuICAgICAgICAgICAgZHN0ID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGRzdFswXSA9IHNyY1swXTtcbiAgICAgICAgZHN0WzFdID0gc3JjWzFdO1xuICAgICAgICBkc3RbMl0gPSBzcmNbMl07XG4gICAgICAgIGRzdFszXSA9IHNyY1szXTtcbiAgICAgICAgZHN0WzRdID0gc3JjWzRdO1xuICAgICAgICBkc3RbNV0gPSBzcmNbNV07XG4gICAgICAgIGRzdFs2XSA9IHNyY1s2XTtcbiAgICAgICAgZHN0WzddID0gc3JjWzddO1xuICAgICAgICBkc3RbOF0gPSBzcmNbOF07XG4gICAgICAgIGRzdFs5XSA9IHNyY1s5XTtcbiAgICAgICAgZHN0WzEwXSA9IHNyY1sxMF07XG4gICAgICAgIGRzdFsxMV0gPSBzcmNbMTFdO1xuICAgICAgICBkc3RbMTJdID0gc3JjWzEyXTtcbiAgICAgICAgZHN0WzEzXSA9IHNyY1sxM107XG4gICAgICAgIGRzdFsxNF0gPSBzcmNbMTRdO1xuICAgICAgICBkc3RbMTVdID0gc3JjWzE1XTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIG1hdHJpY2VzIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIG90aGVyIG1hdHJpeC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgbWF0cmljZXMgYXJlIGVxdWFsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gbWF0cmljZXMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgY29uc3QgbCA9IHRoaXMuZGF0YSxcbiAgICAgICAgICAgIHIgPSByaHMuZGF0YTtcblxuICAgICAgICByZXR1cm4gKChsWzBdID09PSByWzBdKSAmJlxuICAgICAgICAgICAgICAgIChsWzFdID09PSByWzFdKSAmJlxuICAgICAgICAgICAgICAgIChsWzJdID09PSByWzJdKSAmJlxuICAgICAgICAgICAgICAgIChsWzNdID09PSByWzNdKSAmJlxuICAgICAgICAgICAgICAgIChsWzRdID09PSByWzRdKSAmJlxuICAgICAgICAgICAgICAgIChsWzVdID09PSByWzVdKSAmJlxuICAgICAgICAgICAgICAgIChsWzZdID09PSByWzZdKSAmJlxuICAgICAgICAgICAgICAgIChsWzddID09PSByWzddKSAmJlxuICAgICAgICAgICAgICAgIChsWzhdID09PSByWzhdKSAmJlxuICAgICAgICAgICAgICAgIChsWzldID09PSByWzldKSAmJlxuICAgICAgICAgICAgICAgIChsWzEwXSA9PT0gclsxMF0pICYmXG4gICAgICAgICAgICAgICAgKGxbMTFdID09PSByWzExXSkgJiZcbiAgICAgICAgICAgICAgICAobFsxMl0gPT09IHJbMTJdKSAmJlxuICAgICAgICAgICAgICAgIChsWzEzXSA9PT0gclsxM10pICYmXG4gICAgICAgICAgICAgICAgKGxbMTRdID09PSByWzE0XSkgJiZcbiAgICAgICAgICAgICAgICAobFsxNV0gPT09IHJbMTVdKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHRoZSBzcGVjaWZpZWQgbWF0cml4IGlzIHRoZSBpZGVudGl0eSBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgbWF0cml4IGlzIGlkZW50aXR5IGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbWF0cml4IGlzIFwiICsgKG0uaXNJZGVudGl0eSgpID8gXCJpZGVudGl0eVwiIDogXCJub3QgaWRlbnRpdHlcIikpO1xuICAgICAqL1xuICAgIGlzSWRlbnRpdHkoKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgcmV0dXJuICgobVswXSA9PT0gMSkgJiZcbiAgICAgICAgICAgICAgICAobVsxXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsyXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVszXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs0XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs1XSA9PT0gMSkgJiZcbiAgICAgICAgICAgICAgICAobVs2XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs3XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs4XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVs5XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsxMF0gPT09IDEpICYmXG4gICAgICAgICAgICAgICAgKG1bMTFdID09PSAwKSAmJlxuICAgICAgICAgICAgICAgIChtWzEyXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsxM10gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bMTRdID09PSAwKSAmJlxuICAgICAgICAgICAgICAgIChtWzE1XSA9PT0gMSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cmljZXMgdG9nZXRoZXIgYW5kIHN0b3JlcyB0aGUgcmVzdWx0IGluIHRoZSBjdXJyZW50XG4gICAgICogaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IGxocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICogdmFyIGIgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgMTgwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyByID0gYSAqIGJcbiAgICAgKiByLm11bDIoYSwgYik7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsMihsaHMsIHJocykge1xuICAgICAgICBjb25zdCBhID0gbGhzLmRhdGE7XG4gICAgICAgIGNvbnN0IGIgPSByaHMuZGF0YTtcbiAgICAgICAgY29uc3QgciA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCBhMDAgPSBhWzBdO1xuICAgICAgICBjb25zdCBhMDEgPSBhWzFdO1xuICAgICAgICBjb25zdCBhMDIgPSBhWzJdO1xuICAgICAgICBjb25zdCBhMDMgPSBhWzNdO1xuICAgICAgICBjb25zdCBhMTAgPSBhWzRdO1xuICAgICAgICBjb25zdCBhMTEgPSBhWzVdO1xuICAgICAgICBjb25zdCBhMTIgPSBhWzZdO1xuICAgICAgICBjb25zdCBhMTMgPSBhWzddO1xuICAgICAgICBjb25zdCBhMjAgPSBhWzhdO1xuICAgICAgICBjb25zdCBhMjEgPSBhWzldO1xuICAgICAgICBjb25zdCBhMjIgPSBhWzEwXTtcbiAgICAgICAgY29uc3QgYTIzID0gYVsxMV07XG4gICAgICAgIGNvbnN0IGEzMCA9IGFbMTJdO1xuICAgICAgICBjb25zdCBhMzEgPSBhWzEzXTtcbiAgICAgICAgY29uc3QgYTMyID0gYVsxNF07XG4gICAgICAgIGNvbnN0IGEzMyA9IGFbMTVdO1xuXG4gICAgICAgIGxldCBiMCwgYjEsIGIyLCBiMztcblxuICAgICAgICBiMCA9IGJbMF07XG4gICAgICAgIGIxID0gYlsxXTtcbiAgICAgICAgYjIgPSBiWzJdO1xuICAgICAgICBiMyA9IGJbM107XG4gICAgICAgIHJbMF0gID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyICsgYTMwICogYjM7XG4gICAgICAgIHJbMV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyICsgYTMxICogYjM7XG4gICAgICAgIHJbMl0gID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyICogYjM7XG4gICAgICAgIHJbM10gID0gYTAzICogYjAgKyBhMTMgKiBiMSArIGEyMyAqIGIyICsgYTMzICogYjM7XG5cbiAgICAgICAgYjAgPSBiWzRdO1xuICAgICAgICBiMSA9IGJbNV07XG4gICAgICAgIGIyID0gYls2XTtcbiAgICAgICAgYjMgPSBiWzddO1xuICAgICAgICByWzRdICA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMCAqIGIzO1xuICAgICAgICByWzVdICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMiArIGEzMSAqIGIzO1xuICAgICAgICByWzZdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMiAqIGIzO1xuICAgICAgICByWzddICA9IGEwMyAqIGIwICsgYTEzICogYjEgKyBhMjMgKiBiMiArIGEzMyAqIGIzO1xuXG4gICAgICAgIGIwID0gYls4XTtcbiAgICAgICAgYjEgPSBiWzldO1xuICAgICAgICBiMiA9IGJbMTBdO1xuICAgICAgICBiMyA9IGJbMTFdO1xuICAgICAgICByWzhdICA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMCAqIGIzO1xuICAgICAgICByWzldICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMiArIGEzMSAqIGIzO1xuICAgICAgICByWzEwXSA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMiAqIGIzO1xuICAgICAgICByWzExXSA9IGEwMyAqIGIwICsgYTEzICogYjEgKyBhMjMgKiBiMiArIGEzMyAqIGIzO1xuXG4gICAgICAgIGIwID0gYlsxMl07XG4gICAgICAgIGIxID0gYlsxM107XG4gICAgICAgIGIyID0gYlsxNF07XG4gICAgICAgIGIzID0gYlsxNV07XG4gICAgICAgIHJbMTJdID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyICsgYTMwICogYjM7XG4gICAgICAgIHJbMTNdID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyICsgYTMxICogYjM7XG4gICAgICAgIHJbMTRdID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyICogYjM7XG4gICAgICAgIHJbMTVdID0gYTAzICogYjAgKyBhMTMgKiBiMSArIGEyMyAqIGIyICsgYTMzICogYjM7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaWNlcyB0b2dldGhlciBhbmQgc3RvcmVzIHRoZSByZXN1bHQgaW4gdGhlIGN1cnJlbnRcbiAgICAgKiBpbnN0YW5jZS4gVGhpcyBmdW5jdGlvbiBhc3N1bWVzIHRoZSBtYXRyaWNlcyBhcmUgYWZmaW5lIHRyYW5zZm9ybWF0aW9uIG1hdHJpY2VzLCB3aGVyZSB0aGVcbiAgICAgKiB1cHBlciBsZWZ0IDN4MyBlbGVtZW50cyBhcmUgYSByb3RhdGlvbiBtYXRyaXgsIGFuZCB0aGUgYm90dG9tIGxlZnQgMyBlbGVtZW50cyBhcmVcbiAgICAgKiB0cmFuc2xhdGlvbi4gVGhlIHJpZ2h0bW9zdCBjb2x1bW4gaXMgYXNzdW1lZCB0byBiZSBbMCwgMCwgMCwgMV0uIFRoZSBwYXJhbWV0ZXJzIGFyZSBub3RcbiAgICAgKiB2ZXJpZmllZCB0byBiZSBpbiB0aGUgZXhwZWN0ZWQgZm9ybWF0LiBUaGlzIGZ1bmN0aW9uIGlzIGZhc3RlciB0aGFuIGdlbmVyYWxcbiAgICAgKiB7QGxpbmsgTWF0NCNtdWwyfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbGhzIC0gVGhlIGFmZmluZSB0cmFuc2Zvcm1hdGlvbiA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZlxuICAgICAqIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgYWZmaW5lIHRyYW5zZm9ybWF0aW9uIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZlxuICAgICAqIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIG11bEFmZmluZTIobGhzLCByaHMpIHtcbiAgICAgICAgY29uc3QgYSA9IGxocy5kYXRhO1xuICAgICAgICBjb25zdCBiID0gcmhzLmRhdGE7XG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgYTAwID0gYVswXTtcbiAgICAgICAgY29uc3QgYTAxID0gYVsxXTtcbiAgICAgICAgY29uc3QgYTAyID0gYVsyXTtcbiAgICAgICAgY29uc3QgYTEwID0gYVs0XTtcbiAgICAgICAgY29uc3QgYTExID0gYVs1XTtcbiAgICAgICAgY29uc3QgYTEyID0gYVs2XTtcbiAgICAgICAgY29uc3QgYTIwID0gYVs4XTtcbiAgICAgICAgY29uc3QgYTIxID0gYVs5XTtcbiAgICAgICAgY29uc3QgYTIyID0gYVsxMF07XG4gICAgICAgIGNvbnN0IGEzMCA9IGFbMTJdO1xuICAgICAgICBjb25zdCBhMzEgPSBhWzEzXTtcbiAgICAgICAgY29uc3QgYTMyID0gYVsxNF07XG5cbiAgICAgICAgbGV0IGIwLCBiMSwgYjI7XG5cbiAgICAgICAgYjAgPSBiWzBdO1xuICAgICAgICBiMSA9IGJbMV07XG4gICAgICAgIGIyID0gYlsyXTtcbiAgICAgICAgclswXSAgPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjI7XG4gICAgICAgIHJbMV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyO1xuICAgICAgICByWzJdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMjtcbiAgICAgICAgclszXSA9IDA7XG5cbiAgICAgICAgYjAgPSBiWzRdO1xuICAgICAgICBiMSA9IGJbNV07XG4gICAgICAgIGIyID0gYls2XTtcbiAgICAgICAgcls0XSAgPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjI7XG4gICAgICAgIHJbNV0gID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyO1xuICAgICAgICByWzZdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMjtcbiAgICAgICAgcls3XSA9IDA7XG5cbiAgICAgICAgYjAgPSBiWzhdO1xuICAgICAgICBiMSA9IGJbOV07XG4gICAgICAgIGIyID0gYlsxMF07XG4gICAgICAgIHJbOF0gID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyO1xuICAgICAgICByWzldICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMjtcbiAgICAgICAgclsxMF0gPSBhMDIgKiBiMCArIGExMiAqIGIxICsgYTIyICogYjI7XG4gICAgICAgIHJbMTFdID0gMDtcblxuICAgICAgICBiMCA9IGJbMTJdO1xuICAgICAgICBiMSA9IGJbMTNdO1xuICAgICAgICBiMiA9IGJbMTRdO1xuICAgICAgICByWzEyXSA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMDtcbiAgICAgICAgclsxM10gPSBhMDEgKiBiMCArIGExMSAqIGIxICsgYTIxICogYjIgKyBhMzE7XG4gICAgICAgIHJbMTRdID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyICsgYTMyO1xuICAgICAgICByWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllcyB0aGUgY3VycmVudCBpbnN0YW5jZSBieSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IHJocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBhID0gYSAqIGJcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm11bDIodGhpcywgcmhzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2Zvcm1zIGEgMy1kaW1lbnNpb25hbCBwb2ludCBieSBhIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHZlYyAtIFRoZSAzLWRpbWVuc2lvbmFsIHBvaW50IHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3Jlc10gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHBvaW50IHRvIHJlY2VpdmUgdGhlIHJlc3VsdCBvZiB0aGVcbiAgICAgKiB0cmFuc2Zvcm1hdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGlucHV0IHBvaW50IHYgdHJhbnNmb3JtZWQgYnkgdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSAzLWRpbWVuc2lvbmFsIHBvaW50XG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqXG4gICAgICogdmFyIHR2ID0gbS50cmFuc2Zvcm1Qb2ludCh2KTtcbiAgICAgKi9cbiAgICB0cmFuc2Zvcm1Qb2ludCh2ZWMsIHJlcyA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCB4ID0gdmVjLng7XG4gICAgICAgIGNvbnN0IHkgPSB2ZWMueTtcbiAgICAgICAgY29uc3QgeiA9IHZlYy56O1xuXG4gICAgICAgIHJlcy54ID0geCAqIG1bMF0gKyB5ICogbVs0XSArIHogKiBtWzhdICsgbVsxMl07XG4gICAgICAgIHJlcy55ID0geCAqIG1bMV0gKyB5ICogbVs1XSArIHogKiBtWzldICsgbVsxM107XG4gICAgICAgIHJlcy56ID0geCAqIG1bMl0gKyB5ICogbVs2XSArIHogKiBtWzEwXSArIG1bMTRdO1xuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGEgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gdmVjIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3Jlc10gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlXG4gICAgICogdHJhbnNmb3JtYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBpbnB1dCB2ZWN0b3IgdiB0cmFuc2Zvcm1lZCBieSB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDMtZGltZW5zaW9uYWwgdmVjdG9yXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqXG4gICAgICogdmFyIHR2ID0gbS50cmFuc2Zvcm1WZWN0b3Iodik7XG4gICAgICovXG4gICAgdHJhbnNmb3JtVmVjdG9yKHZlYywgcmVzID0gbmV3IFZlYzMoKSkge1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGNvbnN0IHggPSB2ZWMueDtcbiAgICAgICAgY29uc3QgeSA9IHZlYy55O1xuICAgICAgICBjb25zdCB6ID0gdmVjLno7XG5cbiAgICAgICAgcmVzLnggPSB4ICogbVswXSArIHkgKiBtWzRdICsgeiAqIG1bOF07XG4gICAgICAgIHJlcy55ID0geCAqIG1bMV0gKyB5ICogbVs1XSArIHogKiBtWzldO1xuICAgICAgICByZXMueiA9IHggKiBtWzJdICsgeSAqIG1bNl0gKyB6ICogbVsxMF07XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2Zvcm1zIGEgNC1kaW1lbnNpb25hbCB2ZWN0b3IgYnkgYSA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWM0fSB2ZWMgLSBUaGUgNC1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYmUgdHJhbnNmb3JtZWQuXG4gICAgICogQHBhcmFtIHtWZWM0fSBbcmVzXSAtIEFuIG9wdGlvbmFsIDQtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIHJlc3VsdCBvZiB0aGVcbiAgICAgKiB0cmFuc2Zvcm1hdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjNH0gVGhlIGlucHV0IHZlY3RvciB2IHRyYW5zZm9ybWVkIGJ5IHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGFuIGlucHV0IDQtZGltZW5zaW9uYWwgdmVjdG9yXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjNCgxLCAyLCAzLCA0KTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhbiBvdXRwdXQgNC1kaW1lbnNpb25hbCB2ZWN0b3JcbiAgICAgKiB2YXIgcmVzdWx0ID0gbmV3IHBjLlZlYzQoKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqXG4gICAgICogbS50cmFuc2Zvcm1WZWM0KHYsIHJlc3VsdCk7XG4gICAgICovXG4gICAgdHJhbnNmb3JtVmVjNCh2ZWMsIHJlcyA9IG5ldyBWZWM0KCkpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCB4ID0gdmVjLng7XG4gICAgICAgIGNvbnN0IHkgPSB2ZWMueTtcbiAgICAgICAgY29uc3QgeiA9IHZlYy56O1xuICAgICAgICBjb25zdCB3ID0gdmVjLnc7XG5cbiAgICAgICAgcmVzLnggPSB4ICogbVswXSArIHkgKiBtWzRdICsgeiAqIG1bOF0gKyB3ICogbVsxMl07XG4gICAgICAgIHJlcy55ID0geCAqIG1bMV0gKyB5ICogbVs1XSArIHogKiBtWzldICsgdyAqIG1bMTNdO1xuICAgICAgICByZXMueiA9IHggKiBtWzJdICsgeSAqIG1bNl0gKyB6ICogbVsxMF0gKyB3ICogbVsxNF07XG4gICAgICAgIHJlcy53ID0geCAqIG1bM10gKyB5ICogbVs3XSArIHogKiBtWzExXSArIHcgKiBtWzE1XTtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gYSB2aWV3aW5nIG1hdHJpeCBkZXJpdmVkIGZyb20gYW4gZXllIHBvaW50LCBhIHRhcmdldCBwb2ludCBhbmRcbiAgICAgKiBhbiB1cCB2ZWN0b3IuIFRoZSBtYXRyaXggbWFwcyB0aGUgdGFyZ2V0IHBvaW50IHRvIHRoZSBuZWdhdGl2ZSB6LWF4aXMgYW5kIHRoZSBleWUgcG9pbnQgdG9cbiAgICAgKiB0aGUgb3JpZ2luLCBzbyB0aGF0IHdoZW4geW91IHVzZSBhIHR5cGljYWwgcHJvamVjdGlvbiBtYXRyaXgsIHRoZSBjZW50ZXIgb2YgdGhlIHNjZW5lIG1hcHNcbiAgICAgKiB0byB0aGUgY2VudGVyIG9mIHRoZSB2aWV3cG9ydC4gU2ltaWxhcmx5LCB0aGUgZGlyZWN0aW9uIGRlc2NyaWJlZCBieSB0aGUgdXAgdmVjdG9yIHByb2plY3RlZFxuICAgICAqIG9udG8gdGhlIHZpZXdpbmcgcGxhbmUgaXMgbWFwcGVkIHRvIHRoZSBwb3NpdGl2ZSB5LWF4aXMgc28gdGhhdCBpdCBwb2ludHMgdXB3YXJkIGluIHRoZVxuICAgICAqIHZpZXdwb3J0LiBUaGUgdXAgdmVjdG9yIG11c3Qgbm90IGJlIHBhcmFsbGVsIHRvIHRoZSBsaW5lIG9mIHNpZ2h0IGZyb20gdGhlIGV5ZSB0byB0aGVcbiAgICAgKiByZWZlcmVuY2UgcG9pbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHBvc2l0aW9uIC0gMy1kIHZlY3RvciBob2xkaW5nIHZpZXcgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtWZWMzfSB0YXJnZXQgLSAzLWQgdmVjdG9yIGhvbGRpbmcgcmVmZXJlbmNlIHBvaW50LlxuICAgICAqIEBwYXJhbSB7VmVjM30gdXAgLSAzLWQgdmVjdG9yIGhvbGRpbmcgdGhlIHVwIGRpcmVjdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcG9zaXRpb24gPSBuZXcgcGMuVmVjMygxMCwgMTAsIDEwKTtcbiAgICAgKiB2YXIgdGFyZ2V0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIHVwID0gbmV3IHBjLlZlYzMoMCwgMSwgMCk7XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpLnNldExvb2tBdChwb3NpdGlvbiwgdGFyZ2V0LCB1cCk7XG4gICAgICovXG4gICAgc2V0TG9va0F0KHBvc2l0aW9uLCB0YXJnZXQsIHVwKSB7XG4gICAgICAgIHouc3ViMihwb3NpdGlvbiwgdGFyZ2V0KS5ub3JtYWxpemUoKTtcbiAgICAgICAgeS5jb3B5KHVwKS5ub3JtYWxpemUoKTtcbiAgICAgICAgeC5jcm9zcyh5LCB6KS5ub3JtYWxpemUoKTtcbiAgICAgICAgeS5jcm9zcyh6LCB4KTtcblxuICAgICAgICBjb25zdCByID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIHJbMF0gID0geC54O1xuICAgICAgICByWzFdICA9IHgueTtcbiAgICAgICAgclsyXSAgPSB4Lno7XG4gICAgICAgIHJbM10gID0gMDtcbiAgICAgICAgcls0XSAgPSB5Lng7XG4gICAgICAgIHJbNV0gID0geS55O1xuICAgICAgICByWzZdICA9IHkuejtcbiAgICAgICAgcls3XSAgPSAwO1xuICAgICAgICByWzhdICA9IHoueDtcbiAgICAgICAgcls5XSAgPSB6Lnk7XG4gICAgICAgIHJbMTBdID0gei56O1xuICAgICAgICByWzExXSA9IDA7XG4gICAgICAgIHJbMTJdID0gcG9zaXRpb24ueDtcbiAgICAgICAgclsxM10gPSBwb3NpdGlvbi55O1xuICAgICAgICByWzE0XSA9IHBvc2l0aW9uLno7XG4gICAgICAgIHJbMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgcGVyc3BlY3RpdmUgcHJvamVjdGlvbiBtYXRyaXguIFRoZSBmdW5jdGlvbidzIHBhcmFtZXRlcnNcbiAgICAgKiBkZWZpbmUgdGhlIHNoYXBlIG9mIGEgZnJ1c3R1bS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZWZ0IC0gVGhlIHgtY29vcmRpbmF0ZSBmb3IgdGhlIGxlZnQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmlnaHQgLSBUaGUgeC1jb29yZGluYXRlIGZvciB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYm90dG9tIC0gVGhlIHktY29vcmRpbmF0ZSBmb3IgdGhlIGJvdHRvbSBlZGdlIG9mIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uXG4gICAgICogcGxhbmUgaW4gZXllIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0b3AgLSBUaGUgeS1jb29yZGluYXRlIGZvciB0aGUgdG9wIGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmUgaW5cbiAgICAgKiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpuZWFyIC0gVGhlIG5lYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYXIgLSBUaGUgZmFyIGNsaXAgcGxhbmUgaW4gZXllIGNvb3JkaW5hdGVzLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAqIHZhciBmID0gcGMuTWF0NCgpLnNldEZydXN0dW0oLTIsIDIsIC0xLCAxLCAxLCAxMDAwKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0RnJ1c3R1bShsZWZ0LCByaWdodCwgYm90dG9tLCB0b3AsIHpuZWFyLCB6ZmFyKSB7XG4gICAgICAgIGNvbnN0IHRlbXAxID0gMiAqIHpuZWFyO1xuICAgICAgICBjb25zdCB0ZW1wMiA9IHJpZ2h0IC0gbGVmdDtcbiAgICAgICAgY29uc3QgdGVtcDMgPSB0b3AgLSBib3R0b207XG4gICAgICAgIGNvbnN0IHRlbXA0ID0gemZhciAtIHpuZWFyO1xuXG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLmRhdGE7XG4gICAgICAgIHJbMF0gPSB0ZW1wMSAvIHRlbXAyO1xuICAgICAgICByWzFdID0gMDtcbiAgICAgICAgclsyXSA9IDA7XG4gICAgICAgIHJbM10gPSAwO1xuICAgICAgICByWzRdID0gMDtcbiAgICAgICAgcls1XSA9IHRlbXAxIC8gdGVtcDM7XG4gICAgICAgIHJbNl0gPSAwO1xuICAgICAgICByWzddID0gMDtcbiAgICAgICAgcls4XSA9IChyaWdodCArIGxlZnQpIC8gdGVtcDI7XG4gICAgICAgIHJbOV0gPSAodG9wICsgYm90dG9tKSAvIHRlbXAzO1xuICAgICAgICByWzEwXSA9ICgtemZhciAtIHpuZWFyKSAvIHRlbXA0O1xuICAgICAgICByWzExXSA9IC0xO1xuICAgICAgICByWzEyXSA9IDA7XG4gICAgICAgIHJbMTNdID0gMDtcbiAgICAgICAgclsxNF0gPSAoLXRlbXAxICogemZhcikgLyB0ZW1wNDtcbiAgICAgICAgclsxNV0gPSAwO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gYSBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeC4gVGhlIGZ1bmN0aW9uJ3MgcGFyYW1ldGVyc1xuICAgICAqIGRlZmluZSB0aGUgc2hhcGUgb2YgYSBmcnVzdHVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZvdiAtIFRoZSBmcnVzdHVtJ3MgZmllbGQgb2YgdmlldyBpbiBkZWdyZWVzLiBUaGUgZm92SXNIb3Jpem9udGFsIHBhcmFtZXRlclxuICAgICAqIGNvbnRyb2xzIHdoZXRoZXIgdGhpcyBpcyBhIHZlcnRpY2FsIG9yIGhvcml6b250YWwgZmllbGQgb2Ygdmlldy4gQnkgZGVmYXVsdCwgaXQncyBhIHZlcnRpY2FsXG4gICAgICogZmllbGQgb2Ygdmlldy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYXNwZWN0IC0gVGhlIGFzcGVjdCByYXRpbyBvZiB0aGUgZnJ1c3R1bSdzIHByb2plY3Rpb24gcGxhbmVcbiAgICAgKiAod2lkdGggLyBoZWlnaHQpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6bmVhciAtIFRoZSBuZWFyIGNsaXAgcGxhbmUgaW4gZXllIGNvb3JkaW5hdGVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6ZmFyIC0gVGhlIGZhciBjbGlwIHBsYW5lIGluIGV5ZSBjb29yZGluYXRlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtmb3ZJc0hvcml6b250YWw9ZmFsc2VdIC0gU2V0IHRvIHRydWUgdG8gdHJlYXQgdGhlIGZvdiBhcyBob3Jpem9udGFsXG4gICAgICogKHgtYXhpcykgYW5kIGZhbHNlIGZvciB2ZXJ0aWNhbCAoeS1heGlzKS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHBlcnNwZWN0aXZlIHByb2plY3Rpb24gbWF0cml4XG4gICAgICogdmFyIHBlcnNwID0gcGMuTWF0NCgpLnNldFBlcnNwZWN0aXZlKDQ1LCAxNiAvIDksIDEsIDEwMDApO1xuICAgICAqL1xuICAgIHNldFBlcnNwZWN0aXZlKGZvdiwgYXNwZWN0LCB6bmVhciwgemZhciwgZm92SXNIb3Jpem9udGFsKSB7XG4gICAgICAgIE1hdDQuX2dldFBlcnNwZWN0aXZlSGFsZlNpemUoX2hhbGZTaXplLCBmb3YsIGFzcGVjdCwgem5lYXIsIGZvdklzSG9yaXpvbnRhbCk7XG4gICAgICAgIHJldHVybiB0aGlzLnNldEZydXN0dW0oLV9oYWxmU2l6ZS54LCBfaGFsZlNpemUueCwgLV9oYWxmU2l6ZS55LCBfaGFsZlNpemUueSwgem5lYXIsIHpmYXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gYW4gb3J0aG9ncmFwaGljIHByb2plY3Rpb24gbWF0cml4LiBUaGUgZnVuY3Rpb24ncyBwYXJhbWV0ZXJzXG4gICAgICogZGVmaW5lIHRoZSBzaGFwZSBvZiBhIGN1Ym9pZC1zaGFwZWQgZnJ1c3R1bS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsZWZ0IC0gVGhlIHgtY29vcmRpbmF0ZSBmb3IgdGhlIGxlZnQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmlnaHQgLSBUaGUgeC1jb29yZGluYXRlIGZvciB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvbiBwbGFuZVxuICAgICAqIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYm90dG9tIC0gVGhlIHktY29vcmRpbmF0ZSBmb3IgdGhlIGJvdHRvbSBlZGdlIG9mIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uXG4gICAgICogcGxhbmUgaW4gZXllIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0b3AgLSBUaGUgeS1jb29yZGluYXRlIGZvciB0aGUgdG9wIGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmUgaW5cbiAgICAgKiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5lYXIgLSBUaGUgbmVhciBjbGlwIHBsYW5lIGluIGV5ZSBjb29yZGluYXRlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFyIC0gVGhlIGZhciBjbGlwIHBsYW5lIGluIGV5ZSBjb29yZGluYXRlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgb3J0aG9ncmFwaGljIHByb2plY3Rpb24gbWF0cml4XG4gICAgICogdmFyIG9ydGhvID0gcGMuTWF0NCgpLm9ydGhvKC0yLCAyLCAtMiwgMiwgMSwgMTAwMCk7XG4gICAgICovXG4gICAgc2V0T3J0aG8obGVmdCwgcmlnaHQsIGJvdHRvbSwgdG9wLCBuZWFyLCBmYXIpIHtcbiAgICAgICAgY29uc3QgciA9IHRoaXMuZGF0YTtcblxuICAgICAgICByWzBdID0gMiAvIChyaWdodCAtIGxlZnQpO1xuICAgICAgICByWzFdID0gMDtcbiAgICAgICAgclsyXSA9IDA7XG4gICAgICAgIHJbM10gPSAwO1xuICAgICAgICByWzRdID0gMDtcbiAgICAgICAgcls1XSA9IDIgLyAodG9wIC0gYm90dG9tKTtcbiAgICAgICAgcls2XSA9IDA7XG4gICAgICAgIHJbN10gPSAwO1xuICAgICAgICByWzhdID0gMDtcbiAgICAgICAgcls5XSA9IDA7XG4gICAgICAgIHJbMTBdID0gLTIgLyAoZmFyIC0gbmVhcik7XG4gICAgICAgIHJbMTFdID0gMDtcbiAgICAgICAgclsxMl0gPSAtKHJpZ2h0ICsgbGVmdCkgLyAocmlnaHQgLSBsZWZ0KTtcbiAgICAgICAgclsxM10gPSAtKHRvcCArIGJvdHRvbSkgLyAodG9wIC0gYm90dG9tKTtcbiAgICAgICAgclsxNF0gPSAtKGZhciArIG5lYXIpIC8gKGZhciAtIG5lYXIpO1xuICAgICAgICByWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHJvdGF0aW9uIG1hdHJpeCBlcXVpdmFsZW50IHRvIGEgcm90YXRpb24gYXJvdW5kIGFuIGF4aXMuIFRoZVxuICAgICAqIGF4aXMgbXVzdCBiZSBub3JtYWxpemVkICh1bml0IGxlbmd0aCkgYW5kIHRoZSBhbmdsZSBtdXN0IGJlIHNwZWNpZmllZCBpbiBkZWdyZWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gVGhlIG5vcm1hbGl6ZWQgYXhpcyB2ZWN0b3IgYXJvdW5kIHdoaWNoIHRvIHJvdGF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYW5nbGUgLSBUaGUgYW5nbGUgb2Ygcm90YXRpb24gaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogdmFyIHJtID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDkwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tQXhpc0FuZ2xlKGF4aXMsIGFuZ2xlKSB7XG4gICAgICAgIGFuZ2xlICo9IG1hdGguREVHX1RPX1JBRDtcblxuICAgICAgICBjb25zdCB4ID0gYXhpcy54O1xuICAgICAgICBjb25zdCB5ID0gYXhpcy55O1xuICAgICAgICBjb25zdCB6ID0gYXhpcy56O1xuICAgICAgICBjb25zdCBjID0gTWF0aC5jb3MoYW5nbGUpO1xuICAgICAgICBjb25zdCBzID0gTWF0aC5zaW4oYW5nbGUpO1xuICAgICAgICBjb25zdCB0ID0gMSAtIGM7XG4gICAgICAgIGNvbnN0IHR4ID0gdCAqIHg7XG4gICAgICAgIGNvbnN0IHR5ID0gdCAqIHk7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9IHR4ICogeCArIGM7XG4gICAgICAgIG1bMV0gPSB0eCAqIHkgKyBzICogejtcbiAgICAgICAgbVsyXSA9IHR4ICogeiAtIHMgKiB5O1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IHR4ICogeSAtIHMgKiB6O1xuICAgICAgICBtWzVdID0gdHkgKiB5ICsgYztcbiAgICAgICAgbVs2XSA9IHR5ICogeiArIHMgKiB4O1xuICAgICAgICBtWzddID0gMDtcbiAgICAgICAgbVs4XSA9IHR4ICogeiArIHMgKiB5O1xuICAgICAgICBtWzldID0gdHkgKiB6IC0geCAqIHM7XG4gICAgICAgIG1bMTBdID0gdCAqIHogKiB6ICsgYztcbiAgICAgICAgbVsxMV0gPSAwO1xuICAgICAgICBtWzEyXSA9IDA7XG4gICAgICAgIG1bMTNdID0gMDtcbiAgICAgICAgbVsxNF0gPSAwO1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHRyYW5zbGF0aW9uIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHgtY29tcG9uZW50IG9mIHRoZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHRyYW5zbGF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCB0cmFuc2xhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgdG0gPSBuZXcgcGMuTWF0NCgpLnNldFRyYW5zbGF0ZSgxMCwgMTAsIDEwKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VHJhbnNsYXRlKHgsIHksIHopIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0gMTtcbiAgICAgICAgbVsxXSA9IDA7XG4gICAgICAgIG1bMl0gPSAwO1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IDA7XG4gICAgICAgIG1bNV0gPSAxO1xuICAgICAgICBtWzZdID0gMDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSAwO1xuICAgICAgICBtWzldID0gMDtcbiAgICAgICAgbVsxMF0gPSAxO1xuICAgICAgICBtWzExXSA9IDA7XG4gICAgICAgIG1bMTJdID0geDtcbiAgICAgICAgbVsxM10gPSB5O1xuICAgICAgICBtWzE0XSA9IHo7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgc2NhbGUgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb21wb25lbnQgb2YgdGhlIHNjYWxlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB6LWNvbXBvbmVudCBvZiB0aGUgc2NhbGUuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHNjYWxlIG1hdHJpeFxuICAgICAqIHZhciBzbSA9IG5ldyBwYy5NYXQ0KCkuc2V0U2NhbGUoMTAsIDEwLCAxMCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFNjYWxlKHgsIHksIHopIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0geDtcbiAgICAgICAgbVsxXSA9IDA7XG4gICAgICAgIG1bMl0gPSAwO1xuICAgICAgICBtWzNdID0gMDtcbiAgICAgICAgbVs0XSA9IDA7XG4gICAgICAgIG1bNV0gPSB5O1xuICAgICAgICBtWzZdID0gMDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSAwO1xuICAgICAgICBtWzldID0gMDtcbiAgICAgICAgbVsxMF0gPSB6O1xuICAgICAgICBtWzExXSA9IDA7XG4gICAgICAgIG1bMTJdID0gMDtcbiAgICAgICAgbVsxM10gPSAwO1xuICAgICAgICBtWzE0XSA9IDA7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgbWF0cml4IHRyYW5zZm9ybWluZyBhIG5vcm1hbGl6ZWQgdmlldyB2b2x1bWUgKGluIHJhbmdlIG9mXG4gICAgICogLTEgLi4gMSkgdG8gdGhlaXIgcG9zaXRpb24gaW5zaWRlIGEgdmlld3BvcnQgKGluIHJhbmdlIG9mIDAgLi4gMSkuIFRoaXMgZW5jYXBzdWxhdGVzIGFcbiAgICAgKiBzY2FsaW5nIHRvIHRoZSBzaXplIG9mIHRoZSB2aWV3cG9ydCBhbmQgYSB0cmFuc2xhdGlvbiB0byB0aGUgcG9zaXRpb24gb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb21wb25lbnQgb2YgdGhlIHBvc2l0aW9uIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHBvc2l0aW9uIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIHdpZHRoIG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBoZWlnaHQgb2YgdGhlIHZpZXdwb3J0IChpbiAwLi4xIHJhbmdlKS5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgdmlld3BvcnQgbWF0cml4IHdoaWNoIHNjYWxlcyBub3JtYWxpemVkIHZpZXcgdm9sdW1lIHRvIGZ1bGwgdGV4dHVyZSB2aWV3cG9ydFxuICAgICAqIHZhciB2bSA9IG5ldyBwYy5NYXQ0KCkuc2V0Vmlld3BvcnQoMCwgMCwgMSwgMSk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFZpZXdwb3J0KHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBtWzBdID0gd2lkdGggKiAwLjU7XG4gICAgICAgIG1bMV0gPSAwO1xuICAgICAgICBtWzJdID0gMDtcbiAgICAgICAgbVszXSA9IDA7XG4gICAgICAgIG1bNF0gPSAwO1xuICAgICAgICBtWzVdID0gaGVpZ2h0ICogMC41O1xuICAgICAgICBtWzZdID0gMDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSAwO1xuICAgICAgICBtWzldID0gMDtcbiAgICAgICAgbVsxMF0gPSAwLjU7XG4gICAgICAgIG1bMTFdID0gMDtcbiAgICAgICAgbVsxMl0gPSB4ICsgd2lkdGggKiAwLjU7XG4gICAgICAgIG1bMTNdID0geSArIGhlaWdodCAqIDAuNTtcbiAgICAgICAgbVsxNF0gPSAwLjU7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGl0cyBpbnZlcnNlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeCBvZiAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciByb3QgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgMTgwKTtcbiAgICAgKlxuICAgICAqIC8vIEludmVydCBpbiBwbGFjZVxuICAgICAqIHJvdC5pbnZlcnQoKTtcbiAgICAgKi9cbiAgICBpbnZlcnQoKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgYTAwID0gbVswXTtcbiAgICAgICAgY29uc3QgYTAxID0gbVsxXTtcbiAgICAgICAgY29uc3QgYTAyID0gbVsyXTtcbiAgICAgICAgY29uc3QgYTAzID0gbVszXTtcbiAgICAgICAgY29uc3QgYTEwID0gbVs0XTtcbiAgICAgICAgY29uc3QgYTExID0gbVs1XTtcbiAgICAgICAgY29uc3QgYTEyID0gbVs2XTtcbiAgICAgICAgY29uc3QgYTEzID0gbVs3XTtcbiAgICAgICAgY29uc3QgYTIwID0gbVs4XTtcbiAgICAgICAgY29uc3QgYTIxID0gbVs5XTtcbiAgICAgICAgY29uc3QgYTIyID0gbVsxMF07XG4gICAgICAgIGNvbnN0IGEyMyA9IG1bMTFdO1xuICAgICAgICBjb25zdCBhMzAgPSBtWzEyXTtcbiAgICAgICAgY29uc3QgYTMxID0gbVsxM107XG4gICAgICAgIGNvbnN0IGEzMiA9IG1bMTRdO1xuICAgICAgICBjb25zdCBhMzMgPSBtWzE1XTtcblxuICAgICAgICBjb25zdCBiMDAgPSBhMDAgKiBhMTEgLSBhMDEgKiBhMTA7XG4gICAgICAgIGNvbnN0IGIwMSA9IGEwMCAqIGExMiAtIGEwMiAqIGExMDtcbiAgICAgICAgY29uc3QgYjAyID0gYTAwICogYTEzIC0gYTAzICogYTEwO1xuICAgICAgICBjb25zdCBiMDMgPSBhMDEgKiBhMTIgLSBhMDIgKiBhMTE7XG4gICAgICAgIGNvbnN0IGIwNCA9IGEwMSAqIGExMyAtIGEwMyAqIGExMTtcbiAgICAgICAgY29uc3QgYjA1ID0gYTAyICogYTEzIC0gYTAzICogYTEyO1xuICAgICAgICBjb25zdCBiMDYgPSBhMjAgKiBhMzEgLSBhMjEgKiBhMzA7XG4gICAgICAgIGNvbnN0IGIwNyA9IGEyMCAqIGEzMiAtIGEyMiAqIGEzMDtcbiAgICAgICAgY29uc3QgYjA4ID0gYTIwICogYTMzIC0gYTIzICogYTMwO1xuICAgICAgICBjb25zdCBiMDkgPSBhMjEgKiBhMzIgLSBhMjIgKiBhMzE7XG4gICAgICAgIGNvbnN0IGIxMCA9IGEyMSAqIGEzMyAtIGEyMyAqIGEzMTtcbiAgICAgICAgY29uc3QgYjExID0gYTIyICogYTMzIC0gYTIzICogYTMyO1xuXG4gICAgICAgIGNvbnN0IGRldCA9IChiMDAgKiBiMTEgLSBiMDEgKiBiMTAgKyBiMDIgKiBiMDkgKyBiMDMgKiBiMDggLSBiMDQgKiBiMDcgKyBiMDUgKiBiMDYpO1xuICAgICAgICBpZiAoZGV0ID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnNldElkZW50aXR5KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBpbnZEZXQgPSAxIC8gZGV0O1xuXG4gICAgICAgICAgICBtWzBdID0gKGExMSAqIGIxMSAtIGExMiAqIGIxMCArIGExMyAqIGIwOSkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzFdID0gKC1hMDEgKiBiMTEgKyBhMDIgKiBiMTAgLSBhMDMgKiBiMDkpICogaW52RGV0O1xuICAgICAgICAgICAgbVsyXSA9IChhMzEgKiBiMDUgLSBhMzIgKiBiMDQgKyBhMzMgKiBiMDMpICogaW52RGV0O1xuICAgICAgICAgICAgbVszXSA9ICgtYTIxICogYjA1ICsgYTIyICogYjA0IC0gYTIzICogYjAzKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bNF0gPSAoLWExMCAqIGIxMSArIGExMiAqIGIwOCAtIGExMyAqIGIwNykgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzVdID0gKGEwMCAqIGIxMSAtIGEwMiAqIGIwOCArIGEwMyAqIGIwNykgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzZdID0gKC1hMzAgKiBiMDUgKyBhMzIgKiBiMDIgLSBhMzMgKiBiMDEpICogaW52RGV0O1xuICAgICAgICAgICAgbVs3XSA9IChhMjAgKiBiMDUgLSBhMjIgKiBiMDIgKyBhMjMgKiBiMDEpICogaW52RGV0O1xuICAgICAgICAgICAgbVs4XSA9IChhMTAgKiBiMTAgLSBhMTEgKiBiMDggKyBhMTMgKiBiMDYpICogaW52RGV0O1xuICAgICAgICAgICAgbVs5XSA9ICgtYTAwICogYjEwICsgYTAxICogYjA4IC0gYTAzICogYjA2KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTBdID0gKGEzMCAqIGIwNCAtIGEzMSAqIGIwMiArIGEzMyAqIGIwMCkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzExXSA9ICgtYTIwICogYjA0ICsgYTIxICogYjAyIC0gYTIzICogYjAwKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTJdID0gKC1hMTAgKiBiMDkgKyBhMTEgKiBiMDcgLSBhMTIgKiBiMDYpICogaW52RGV0O1xuICAgICAgICAgICAgbVsxM10gPSAoYTAwICogYjA5IC0gYTAxICogYjA3ICsgYTAyICogYjA2KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTRdID0gKC1hMzAgKiBiMDMgKyBhMzEgKiBiMDEgLSBhMzIgKiBiMDApICogaW52RGV0O1xuICAgICAgICAgICAgbVsxNV0gPSAoYTIwICogYjAzIC0gYTIxICogYjAxICsgYTIyICogYjAwKSAqIGludkRldDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgbWF0cml4IGRhdGEgZnJvbSBhbiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNyYyAtIFNvdXJjZSBhcnJheS4gTXVzdCBoYXZlIDE2IHZhbHVlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgc2V0KHNyYykge1xuICAgICAgICBjb25zdCBkc3QgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgZHN0WzBdID0gc3JjWzBdO1xuICAgICAgICBkc3RbMV0gPSBzcmNbMV07XG4gICAgICAgIGRzdFsyXSA9IHNyY1syXTtcbiAgICAgICAgZHN0WzNdID0gc3JjWzNdO1xuICAgICAgICBkc3RbNF0gPSBzcmNbNF07XG4gICAgICAgIGRzdFs1XSA9IHNyY1s1XTtcbiAgICAgICAgZHN0WzZdID0gc3JjWzZdO1xuICAgICAgICBkc3RbN10gPSBzcmNbN107XG4gICAgICAgIGRzdFs4XSA9IHNyY1s4XTtcbiAgICAgICAgZHN0WzldID0gc3JjWzldO1xuICAgICAgICBkc3RbMTBdID0gc3JjWzEwXTtcbiAgICAgICAgZHN0WzExXSA9IHNyY1sxMV07XG4gICAgICAgIGRzdFsxMl0gPSBzcmNbMTJdO1xuICAgICAgICBkc3RbMTNdID0gc3JjWzEzXTtcbiAgICAgICAgZHN0WzE0XSA9IHNyY1sxNF07XG4gICAgICAgIGRzdFsxNV0gPSBzcmNbMTVdO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gdGhlIGlkZW50aXR5IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG0uc2V0SWRlbnRpdHkoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBtYXRyaXggaXMgXCIgKyAobS5pc0lkZW50aXR5KCkgPyBcImlkZW50aXR5XCIgOiBcIm5vdCBpZGVudGl0eVwiKSk7XG4gICAgICovXG4gICAgc2V0SWRlbnRpdHkoKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9IDE7XG4gICAgICAgIG1bMV0gPSAwO1xuICAgICAgICBtWzJdID0gMDtcbiAgICAgICAgbVszXSA9IDA7XG4gICAgICAgIG1bNF0gPSAwO1xuICAgICAgICBtWzVdID0gMTtcbiAgICAgICAgbVs2XSA9IDA7XG4gICAgICAgIG1bN10gPSAwO1xuICAgICAgICBtWzhdID0gMDtcbiAgICAgICAgbVs5XSA9IDA7XG4gICAgICAgIG1bMTBdID0gMTtcbiAgICAgICAgbVsxMV0gPSAwO1xuICAgICAgICBtWzEyXSA9IDA7XG4gICAgICAgIG1bMTNdID0gMDtcbiAgICAgICAgbVsxNF0gPSAwO1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byB0aGUgY29uY2F0ZW5hdGlvbiBvZiBhIHRyYW5zbGF0aW9uLCBhIHF1YXRlcm5pb24gcm90YXRpb24gYW5kIGFcbiAgICAgKiBzY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gdCAtIEEgMy1kIHZlY3RvciB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1F1YXR9IHIgLSBBIHF1YXRlcm5pb24gcm90YXRpb24uXG4gICAgICogQHBhcmFtIHtWZWMzfSBzIC0gQSAzLWQgdmVjdG9yIHNjYWxlLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB0ID0gbmV3IHBjLlZlYzMoMTAsIDIwLCAzMCk7XG4gICAgICogdmFyIHIgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHZhciBzID0gbmV3IHBjLlZlYzMoMiwgMiwgMik7XG4gICAgICpcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogbS5zZXRUUlModCwgciwgcyk7XG4gICAgICovXG4gICAgc2V0VFJTKHQsIHIsIHMpIHtcbiAgICAgICAgY29uc3QgcXggPSByLng7XG4gICAgICAgIGNvbnN0IHF5ID0gci55O1xuICAgICAgICBjb25zdCBxeiA9IHIuejtcbiAgICAgICAgY29uc3QgcXcgPSByLnc7XG5cbiAgICAgICAgY29uc3Qgc3ggPSBzLng7XG4gICAgICAgIGNvbnN0IHN5ID0gcy55O1xuICAgICAgICBjb25zdCBzeiA9IHMuejtcblxuICAgICAgICBjb25zdCB4MiA9IHF4ICsgcXg7XG4gICAgICAgIGNvbnN0IHkyID0gcXkgKyBxeTtcbiAgICAgICAgY29uc3QgejIgPSBxeiArIHF6O1xuICAgICAgICBjb25zdCB4eCA9IHF4ICogeDI7XG4gICAgICAgIGNvbnN0IHh5ID0gcXggKiB5MjtcbiAgICAgICAgY29uc3QgeHogPSBxeCAqIHoyO1xuICAgICAgICBjb25zdCB5eSA9IHF5ICogeTI7XG4gICAgICAgIGNvbnN0IHl6ID0gcXkgKiB6MjtcbiAgICAgICAgY29uc3QgenogPSBxeiAqIHoyO1xuICAgICAgICBjb25zdCB3eCA9IHF3ICogeDI7XG4gICAgICAgIGNvbnN0IHd5ID0gcXcgKiB5MjtcbiAgICAgICAgY29uc3Qgd3ogPSBxdyAqIHoyO1xuXG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9ICgxIC0gKHl5ICsgenopKSAqIHN4O1xuICAgICAgICBtWzFdID0gKHh5ICsgd3opICogc3g7XG4gICAgICAgIG1bMl0gPSAoeHogLSB3eSkgKiBzeDtcbiAgICAgICAgbVszXSA9IDA7XG5cbiAgICAgICAgbVs0XSA9ICh4eSAtIHd6KSAqIHN5O1xuICAgICAgICBtWzVdID0gKDEgLSAoeHggKyB6eikpICogc3k7XG4gICAgICAgIG1bNl0gPSAoeXogKyB3eCkgKiBzeTtcbiAgICAgICAgbVs3XSA9IDA7XG5cbiAgICAgICAgbVs4XSA9ICh4eiArIHd5KSAqIHN6O1xuICAgICAgICBtWzldID0gKHl6IC0gd3gpICogc3o7XG4gICAgICAgIG1bMTBdID0gKDEgLSAoeHggKyB5eSkpICogc3o7XG4gICAgICAgIG1bMTFdID0gMDtcblxuICAgICAgICBtWzEyXSA9IHQueDtcbiAgICAgICAgbVsxM10gPSB0Lnk7XG4gICAgICAgIG1bMTRdID0gdC56O1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBpdHMgdHJhbnNwb3NlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogLy8gVHJhbnNwb3NlIGluIHBsYWNlXG4gICAgICogbS50cmFuc3Bvc2UoKTtcbiAgICAgKi9cbiAgICB0cmFuc3Bvc2UoKSB7XG4gICAgICAgIGxldCB0bXA7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgdG1wID0gbVsxXTtcbiAgICAgICAgbVsxXSA9IG1bNF07XG4gICAgICAgIG1bNF0gPSB0bXA7XG5cbiAgICAgICAgdG1wID0gbVsyXTtcbiAgICAgICAgbVsyXSA9IG1bOF07XG4gICAgICAgIG1bOF0gPSB0bXA7XG5cbiAgICAgICAgdG1wID0gbVszXTtcbiAgICAgICAgbVszXSA9IG1bMTJdO1xuICAgICAgICBtWzEyXSA9IHRtcDtcblxuICAgICAgICB0bXAgPSBtWzZdO1xuICAgICAgICBtWzZdID0gbVs5XTtcbiAgICAgICAgbVs5XSA9IHRtcDtcblxuICAgICAgICB0bXAgPSBtWzddO1xuICAgICAgICBtWzddID0gbVsxM107XG4gICAgICAgIG1bMTNdID0gdG1wO1xuXG4gICAgICAgIHRtcCA9IG1bMTFdO1xuICAgICAgICBtWzExXSA9IG1bMTRdO1xuICAgICAgICBtWzE0XSA9IHRtcDtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICBpbnZlcnRUbzN4MyhyZXMpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcbiAgICAgICAgY29uc3QgciA9IHJlcy5kYXRhO1xuXG4gICAgICAgIGNvbnN0IG0wID0gbVswXTtcbiAgICAgICAgY29uc3QgbTEgPSBtWzFdO1xuICAgICAgICBjb25zdCBtMiA9IG1bMl07XG5cbiAgICAgICAgY29uc3QgbTQgPSBtWzRdO1xuICAgICAgICBjb25zdCBtNSA9IG1bNV07XG4gICAgICAgIGNvbnN0IG02ID0gbVs2XTtcblxuICAgICAgICBjb25zdCBtOCA9IG1bOF07XG4gICAgICAgIGNvbnN0IG05ID0gbVs5XTtcbiAgICAgICAgY29uc3QgbTEwID0gbVsxMF07XG5cbiAgICAgICAgY29uc3QgYTExID0gIG0xMCAqIG01IC0gbTYgKiBtOTtcbiAgICAgICAgY29uc3QgYTIxID0gLW0xMCAqIG0xICsgbTIgKiBtOTtcbiAgICAgICAgY29uc3QgYTMxID0gIG02ICAqIG0xIC0gbTIgKiBtNTtcbiAgICAgICAgY29uc3QgYTEyID0gLW0xMCAqIG00ICsgbTYgKiBtODtcbiAgICAgICAgY29uc3QgYTIyID0gIG0xMCAqIG0wIC0gbTIgKiBtODtcbiAgICAgICAgY29uc3QgYTMyID0gLW02ICAqIG0wICsgbTIgKiBtNDtcbiAgICAgICAgY29uc3QgYTEzID0gIG05ICAqIG00IC0gbTUgKiBtODtcbiAgICAgICAgY29uc3QgYTIzID0gLW05ICAqIG0wICsgbTEgKiBtODtcbiAgICAgICAgY29uc3QgYTMzID0gIG01ICAqIG0wIC0gbTEgKiBtNDtcblxuICAgICAgICBjb25zdCBkZXQgPSAgbTAgKiBhMTEgKyBtMSAqIGExMiArIG0yICogYTEzO1xuICAgICAgICBpZiAoZGV0ID09PSAwKSB7IC8vIG5vIGludmVyc2VcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaWRldCA9IDEgLyBkZXQ7XG5cbiAgICAgICAgclswXSA9IGlkZXQgKiBhMTE7XG4gICAgICAgIHJbMV0gPSBpZGV0ICogYTIxO1xuICAgICAgICByWzJdID0gaWRldCAqIGEzMTtcbiAgICAgICAgclszXSA9IGlkZXQgKiBhMTI7XG4gICAgICAgIHJbNF0gPSBpZGV0ICogYTIyO1xuICAgICAgICByWzVdID0gaWRldCAqIGEzMjtcbiAgICAgICAgcls2XSA9IGlkZXQgKiBhMTM7XG4gICAgICAgIHJbN10gPSBpZGV0ICogYTIzO1xuICAgICAgICByWzhdID0gaWRldCAqIGEzMztcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyB0aGUgdHJhbnNsYXRpb25hbCBjb21wb25lbnQgZnJvbSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFt0XSAtIFRoZSB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgdHJhbnNsYXRpb24gb2YgdGhlIG1hdHJpeC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHRyYW5zbGF0aW9uIG9mIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyBRdWVyeSB0aGUgei1heGlzIGNvbXBvbmVudFxuICAgICAqIHZhciB0ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBtLmdldFRyYW5zbGF0aW9uKHQpO1xuICAgICAqL1xuICAgIGdldFRyYW5zbGF0aW9uKHQgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHJldHVybiB0LnNldCh0aGlzLmRhdGFbMTJdLCB0aGlzLmRhdGFbMTNdLCB0aGlzLmRhdGFbMTRdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyB0aGUgeC1heGlzIGZyb20gdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbeF0gLSBUaGUgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIHggYXhpcyBvZiB0aGUgbWF0cml4LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgeC1heGlzIG9mIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyBRdWVyeSB0aGUgei1heGlzIGNvbXBvbmVudFxuICAgICAqIHZhciB4ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBtLmdldFgoeCk7XG4gICAgICovXG4gICAgZ2V0WCh4ID0gbmV3IFZlYzMoKSkge1xuICAgICAgICByZXR1cm4geC5zZXQodGhpcy5kYXRhWzBdLCB0aGlzLmRhdGFbMV0sIHRoaXMuZGF0YVsyXSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdHMgdGhlIHktYXhpcyBmcm9tIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3ldIC0gVGhlIHZlY3RvciB0byByZWNlaXZlIHRoZSB5IGF4aXMgb2YgdGhlIG1hdHJpeC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHktYXhpcyBvZiB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgbWF0cml4XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogLy8gUXVlcnkgdGhlIHotYXhpcyBjb21wb25lbnRcbiAgICAgKiB2YXIgeSA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogbS5nZXRZKHkpO1xuICAgICAqL1xuICAgIGdldFkoeSA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgcmV0dXJuIHkuc2V0KHRoaXMuZGF0YVs0XSwgdGhpcy5kYXRhWzVdLCB0aGlzLmRhdGFbNl0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSB6LWF4aXMgZnJvbSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFt6XSAtIFRoZSB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgeiBheGlzIG9mIHRoZSBtYXRyaXguXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB6LWF4aXMgb2YgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IG1hdHJpeFxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIC8vIFF1ZXJ5IHRoZSB6LWF4aXMgY29tcG9uZW50XG4gICAgICogdmFyIHogPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIG0uZ2V0Wih6KTtcbiAgICAgKi9cbiAgICBnZXRaKHogPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHJldHVybiB6LnNldCh0aGlzLmRhdGFbOF0sIHRoaXMuZGF0YVs5XSwgdGhpcy5kYXRhWzEwXSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdHMgdGhlIHNjYWxlIGNvbXBvbmVudCBmcm9tIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3NjYWxlXSAtIFZlY3RvciB0byByZWNlaXZlIHRoZSBzY2FsZS5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHNjYWxlIGluIFgsIFkgYW5kIFogb2YgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUXVlcnkgdGhlIHNjYWxlIGNvbXBvbmVudFxuICAgICAqIHZhciBzY2FsZSA9IG0uZ2V0U2NhbGUoKTtcbiAgICAgKi9cbiAgICBnZXRTY2FsZShzY2FsZSA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgdGhpcy5nZXRYKHgpO1xuICAgICAgICB0aGlzLmdldFkoeSk7XG4gICAgICAgIHRoaXMuZ2V0Wih6KTtcbiAgICAgICAgc2NhbGUuc2V0KHgubGVuZ3RoKCksIHkubGVuZ3RoKCksIHoubGVuZ3RoKCkpO1xuXG4gICAgICAgIHJldHVybiBzY2FsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgcm90YXRpb24gbWF0cml4IGRlZmluZWQgYnkgRXVsZXIgYW5nbGVzLiBUaGUgRXVsZXIgYW5nbGVzIGFyZVxuICAgICAqIHNwZWNpZmllZCBpbiBYWVogb3JkZXIgYW5kIGluIGRlZ3JlZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZXggLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFggYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBleSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWSBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGV6IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBaIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogbS5zZXRGcm9tRXVsZXJBbmdsZXMoNDUsIDkwLCAxODApO1xuICAgICAqL1xuICAgIHNldEZyb21FdWxlckFuZ2xlcyhleCwgZXksIGV6KSB7XG4gICAgICAgIC8vIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvUm90YXRpb25fbWF0cml4I0NvbnZlcnNpb25fZnJvbV9hbmRfdG9fYXhpcy1hbmdsZVxuICAgICAgICAvLyBUaGUgM0Qgc3BhY2UgaXMgcmlnaHQtaGFuZGVkLCBzbyB0aGUgcm90YXRpb24gYXJvdW5kIGVhY2ggYXhpcyB3aWxsIGJlIGNvdW50ZXJjbG9ja3dpc2VcbiAgICAgICAgLy8gZm9yIGFuIG9ic2VydmVyIHBsYWNlZCBzbyB0aGF0IHRoZSBheGlzIGdvZXMgaW4gaGlzIG9yIGhlciBkaXJlY3Rpb24gKFJpZ2h0LWhhbmQgcnVsZSkuXG4gICAgICAgIGV4ICo9IG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgZXkgKj0gbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICBleiAqPSBtYXRoLkRFR19UT19SQUQ7XG5cbiAgICAgICAgLy8gU29sdXRpb24gdGFrZW4gZnJvbSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0V1bGVyX2FuZ2xlcyNNYXRyaXhfb3JpZW50YXRpb25cbiAgICAgICAgY29uc3QgczEgPSBNYXRoLnNpbigtZXgpO1xuICAgICAgICBjb25zdCBjMSA9IE1hdGguY29zKC1leCk7XG4gICAgICAgIGNvbnN0IHMyID0gTWF0aC5zaW4oLWV5KTtcbiAgICAgICAgY29uc3QgYzIgPSBNYXRoLmNvcygtZXkpO1xuICAgICAgICBjb25zdCBzMyA9IE1hdGguc2luKC1leik7XG4gICAgICAgIGNvbnN0IGMzID0gTWF0aC5jb3MoLWV6KTtcblxuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIC8vIFNldCByb3RhdGlvbiBlbGVtZW50c1xuICAgICAgICBtWzBdID0gYzIgKiBjMztcbiAgICAgICAgbVsxXSA9IC1jMiAqIHMzO1xuICAgICAgICBtWzJdID0gczI7XG4gICAgICAgIG1bM10gPSAwO1xuXG4gICAgICAgIG1bNF0gPSBjMSAqIHMzICsgYzMgKiBzMSAqIHMyO1xuICAgICAgICBtWzVdID0gYzEgKiBjMyAtIHMxICogczIgKiBzMztcbiAgICAgICAgbVs2XSA9IC1jMiAqIHMxO1xuICAgICAgICBtWzddID0gMDtcblxuICAgICAgICBtWzhdID0gczEgKiBzMyAtIGMxICogYzMgKiBzMjtcbiAgICAgICAgbVs5XSA9IGMzICogczEgKyBjMSAqIHMyICogczM7XG4gICAgICAgIG1bMTBdID0gYzEgKiBjMjtcbiAgICAgICAgbVsxMV0gPSAwO1xuXG4gICAgICAgIG1bMTJdID0gMDtcbiAgICAgICAgbVsxM10gPSAwO1xuICAgICAgICBtWzE0XSA9IDA7XG4gICAgICAgIG1bMTVdID0gMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyB0aGUgRXVsZXIgYW5nbGVzIGVxdWl2YWxlbnQgdG8gdGhlIHJvdGF0aW9uYWwgcG9ydGlvbiBvZiB0aGUgc3BlY2lmaWVkIG1hdHJpeC4gVGhlXG4gICAgICogcmV0dXJuZWQgRXVsZXIgYW5nbGVzIGFyZSBpbiBYWVogb3JkZXIgYW4gaW4gZGVncmVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW2V1bGVyc10gLSBBIDMtZCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgRXVsZXIgYW5nbGVzLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBBIDMtZCB2ZWN0b3IgY29udGFpbmluZyB0aGUgRXVsZXIgYW5nbGVzLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeCBvZiA0NSBkZWdyZWVzIGFyb3VuZCB0aGUgeS1heGlzXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgNDUpO1xuICAgICAqXG4gICAgICogdmFyIGV1bGVycyA9IG0uZ2V0RXVsZXJBbmdsZXMoKTtcbiAgICAgKi9cbiAgICBnZXRFdWxlckFuZ2xlcyhldWxlcnMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHRoaXMuZ2V0U2NhbGUoc2NhbGUpO1xuICAgICAgICBjb25zdCBzeCA9IHNjYWxlLng7XG4gICAgICAgIGNvbnN0IHN5ID0gc2NhbGUueTtcbiAgICAgICAgY29uc3Qgc3ogPSBzY2FsZS56O1xuXG4gICAgICAgIGlmIChzeCA9PT0gMCB8fCBzeSA9PT0gMCB8fCBzeiA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiBldWxlcnMuc2V0KDAsIDAsIDApO1xuXG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgeSA9IE1hdGguYXNpbigtbVsyXSAvIHN4KTtcbiAgICAgICAgY29uc3QgaGFsZlBpID0gTWF0aC5QSSAqIDAuNTtcblxuICAgICAgICBsZXQgeCwgejtcblxuICAgICAgICBpZiAoeSA8IGhhbGZQaSkge1xuICAgICAgICAgICAgaWYgKHkgPiAtaGFsZlBpKSB7XG4gICAgICAgICAgICAgICAgeCA9IE1hdGguYXRhbjIobVs2XSAvIHN5LCBtWzEwXSAvIHN6KTtcbiAgICAgICAgICAgICAgICB6ID0gTWF0aC5hdGFuMihtWzFdIC8gc3gsIG1bMF0gLyBzeCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE5vdCBhIHVuaXF1ZSBzb2x1dGlvblxuICAgICAgICAgICAgICAgIHogPSAwO1xuICAgICAgICAgICAgICAgIHggPSAtTWF0aC5hdGFuMihtWzRdIC8gc3ksIG1bNV0gLyBzeSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBOb3QgYSB1bmlxdWUgc29sdXRpb25cbiAgICAgICAgICAgIHogPSAwO1xuICAgICAgICAgICAgeCA9IE1hdGguYXRhbjIobVs0XSAvIHN5LCBtWzVdIC8gc3kpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV1bGVycy5zZXQoeCwgeSwgeikubXVsU2NhbGFyKG1hdGguUkFEX1RPX0RFRyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gc3RyaW5nIGZvcm0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgbWF0cml4IGluIHN0cmluZyBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqIC8vIE91dHB1dHMgWzEsIDAsIDAsIDAsIDAsIDEsIDAsIDAsIDAsIDAsIDEsIDAsIDAsIDAsIDAsIDFdXG4gICAgICogY29uc29sZS5sb2cobS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuICdbJyArIHRoaXMuZGF0YS5qb2luKCcsICcpICsgJ10nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgbWF0cml4IHNldCB0byB0aGUgaWRlbnRpdHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgSURFTlRJVFkgPSBPYmplY3QuZnJlZXplKG5ldyBNYXQ0KCkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCBtYXRyaXggd2l0aCBhbGwgZWxlbWVudHMgc2V0IHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgWkVSTyA9IE9iamVjdC5mcmVlemUobmV3IE1hdDQoKS5zZXQoWzAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDBdKSk7XG59XG5cbmV4cG9ydCB7IE1hdDQgfTtcbiJdLCJuYW1lcyI6WyJfaGFsZlNpemUiLCJWZWMyIiwieCIsIlZlYzMiLCJ5IiwieiIsInNjYWxlIiwiTWF0NCIsImNvbnN0cnVjdG9yIiwiZGF0YSIsIkZsb2F0MzJBcnJheSIsIl9nZXRQZXJzcGVjdGl2ZUhhbGZTaXplIiwiaGFsZlNpemUiLCJmb3YiLCJhc3BlY3QiLCJ6bmVhciIsImZvdklzSG9yaXpvbnRhbCIsIk1hdGgiLCJ0YW4iLCJQSSIsImFkZDIiLCJsaHMiLCJyaHMiLCJhIiwiYiIsInIiLCJhZGQiLCJjbG9uZSIsImNzdHIiLCJjb3B5Iiwic3JjIiwiZHN0IiwiZXF1YWxzIiwibCIsImlzSWRlbnRpdHkiLCJtIiwibXVsMiIsImEwMCIsImEwMSIsImEwMiIsImEwMyIsImExMCIsImExMSIsImExMiIsImExMyIsImEyMCIsImEyMSIsImEyMiIsImEyMyIsImEzMCIsImEzMSIsImEzMiIsImEzMyIsImIwIiwiYjEiLCJiMiIsImIzIiwibXVsQWZmaW5lMiIsIm11bCIsInRyYW5zZm9ybVBvaW50IiwidmVjIiwicmVzIiwidHJhbnNmb3JtVmVjdG9yIiwidHJhbnNmb3JtVmVjNCIsIlZlYzQiLCJ3Iiwic2V0TG9va0F0IiwicG9zaXRpb24iLCJ0YXJnZXQiLCJ1cCIsInN1YjIiLCJub3JtYWxpemUiLCJjcm9zcyIsInNldEZydXN0dW0iLCJsZWZ0IiwicmlnaHQiLCJib3R0b20iLCJ0b3AiLCJ6ZmFyIiwidGVtcDEiLCJ0ZW1wMiIsInRlbXAzIiwidGVtcDQiLCJzZXRQZXJzcGVjdGl2ZSIsInNldE9ydGhvIiwibmVhciIsImZhciIsInNldEZyb21BeGlzQW5nbGUiLCJheGlzIiwiYW5nbGUiLCJtYXRoIiwiREVHX1RPX1JBRCIsImMiLCJjb3MiLCJzIiwic2luIiwidCIsInR4IiwidHkiLCJzZXRUcmFuc2xhdGUiLCJzZXRTY2FsZSIsInNldFZpZXdwb3J0Iiwid2lkdGgiLCJoZWlnaHQiLCJpbnZlcnQiLCJiMDAiLCJiMDEiLCJiMDIiLCJiMDMiLCJiMDQiLCJiMDUiLCJiMDYiLCJiMDciLCJiMDgiLCJiMDkiLCJiMTAiLCJiMTEiLCJkZXQiLCJzZXRJZGVudGl0eSIsImludkRldCIsInNldCIsInNldFRSUyIsInF4IiwicXkiLCJxeiIsInF3Iiwic3giLCJzeSIsInN6IiwieDIiLCJ5MiIsInoyIiwieHgiLCJ4eSIsInh6IiwieXkiLCJ5eiIsInp6Iiwid3giLCJ3eSIsInd6IiwidHJhbnNwb3NlIiwidG1wIiwiaW52ZXJ0VG8zeDMiLCJtMCIsIm0xIiwibTIiLCJtNCIsIm01IiwibTYiLCJtOCIsIm05IiwibTEwIiwiaWRldCIsImdldFRyYW5zbGF0aW9uIiwiZ2V0WCIsImdldFkiLCJnZXRaIiwiZ2V0U2NhbGUiLCJsZW5ndGgiLCJzZXRGcm9tRXVsZXJBbmdsZXMiLCJleCIsImV5IiwiZXoiLCJzMSIsImMxIiwiczIiLCJjMiIsInMzIiwiYzMiLCJnZXRFdWxlckFuZ2xlcyIsImV1bGVycyIsImFzaW4iLCJoYWxmUGkiLCJhdGFuMiIsIm11bFNjYWxhciIsIlJBRF9UT19ERUciLCJ0b1N0cmluZyIsImpvaW4iLCJJREVOVElUWSIsIk9iamVjdCIsImZyZWV6ZSIsIlpFUk8iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFPQSxNQUFNQSxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDNUIsTUFBTUMsQ0FBQyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3BCLE1BQU1DLENBQUMsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUNwQixNQUFNRSxDQUFDLEdBQUcsSUFBSUYsSUFBSSxFQUFFLENBQUE7QUFDcEIsTUFBTUcsS0FBSyxHQUFHLElBQUlILElBQUksRUFBRSxDQUFBOztBQU14QixNQUFNSSxJQUFJLENBQUM7QUFJUEMsRUFBQUEsV0FBVyxHQUFHO0FBR1YsSUFBQSxNQUFNQyxJQUFJLEdBQUcsSUFBSUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ2pDRCxJQUFBQSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUdBLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBR0EsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHQSxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBOztJQU8zQyxJQUFJLENBQUNBLElBQUksR0FBR0EsSUFBSSxDQUFBO0FBQ3BCLEdBQUE7O0VBR0EsT0FBT0UsdUJBQXVCLENBQUNDLFFBQVEsRUFBRUMsR0FBRyxFQUFFQyxNQUFNLEVBQUVDLEtBQUssRUFBRUMsZUFBZSxFQUFFO0FBQzFFLElBQUEsSUFBSUEsZUFBZSxFQUFFO0FBQ2pCSixNQUFBQSxRQUFRLENBQUNWLENBQUMsR0FBR2EsS0FBSyxHQUFHRSxJQUFJLENBQUNDLEdBQUcsQ0FBQ0wsR0FBRyxHQUFHSSxJQUFJLENBQUNFLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUNsRFAsTUFBQUEsUUFBUSxDQUFDUixDQUFDLEdBQUdRLFFBQVEsQ0FBQ1YsQ0FBQyxHQUFHWSxNQUFNLENBQUE7QUFDcEMsS0FBQyxNQUFNO0FBQ0hGLE1BQUFBLFFBQVEsQ0FBQ1IsQ0FBQyxHQUFHVyxLQUFLLEdBQUdFLElBQUksQ0FBQ0MsR0FBRyxDQUFDTCxHQUFHLEdBQUdJLElBQUksQ0FBQ0UsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFBO0FBQ2xEUCxNQUFBQSxRQUFRLENBQUNWLENBQUMsR0FBR1UsUUFBUSxDQUFDUixDQUFDLEdBQUdVLE1BQU0sQ0FBQTtBQUNwQyxLQUFBO0FBQ0osR0FBQTs7QUFlQU0sRUFBQUEsSUFBSSxDQUFDQyxHQUFHLEVBQUVDLEdBQUcsRUFBRTtBQUNYLElBQUEsTUFBTUMsQ0FBQyxHQUFHRixHQUFHLENBQUNaLElBQUk7TUFDZGUsQ0FBQyxHQUFHRixHQUFHLENBQUNiLElBQUk7TUFDWmdCLENBQUMsR0FBRyxJQUFJLENBQUNoQixJQUFJLENBQUE7QUFFakJnQixJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0MsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCQyxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUdGLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBR0MsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBRXJCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztFQWNBRSxHQUFHLENBQUNKLEdBQUcsRUFBRTtBQUNMLElBQUEsT0FBTyxJQUFJLENBQUNGLElBQUksQ0FBQyxJQUFJLEVBQUVFLEdBQUcsQ0FBQyxDQUFBO0FBQy9CLEdBQUE7O0FBV0FLLEVBQUFBLEtBQUssR0FBRztBQUVKLElBQUEsTUFBTUMsSUFBSSxHQUFHLElBQUksQ0FBQ3BCLFdBQVcsQ0FBQTtBQUM3QixJQUFBLE9BQU8sSUFBSW9CLElBQUksRUFBRSxDQUFDQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDaEMsR0FBQTs7RUFhQUEsSUFBSSxDQUFDUCxHQUFHLEVBQUU7QUFDTixJQUFBLE1BQU1RLEdBQUcsR0FBR1IsR0FBRyxDQUFDYixJQUFJO01BQ2hCc0IsR0FBRyxHQUFHLElBQUksQ0FBQ3RCLElBQUksQ0FBQTtBQUVuQnNCLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBR0QsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2ZDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ2pCQyxJQUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUdELEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqQkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDakJDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ2pCQyxJQUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUdELEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqQkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFH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QUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUdELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNmQyxJQUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUdELEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqQkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDakJDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ2pCQyxJQUFBQSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUdELEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNqQkMsSUFBQUEsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHRCxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDakJDLElBQUFBLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBR0QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBRWpCLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQVVBd0YsRUFBQUEsV0FBVyxHQUFHO0FBQ1YsSUFBQSxNQUFNbkYsQ0FBQyxHQUFHLElBQUksQ0FBQzFCLElBQUksQ0FBQTtBQUVuQjBCLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNSQSxJQUFBQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1JBLElBQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDUkEsSUFBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNUQSxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1RBLElBQUFBLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDVEEsSUFBQUEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNUQSxJQUFBQSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1RBLElBQUFBLENBQUMsQ0FBQyxFQUFF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
