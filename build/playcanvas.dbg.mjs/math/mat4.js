/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0NC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL21hdGgvbWF0NC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi9tYXRoLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4vdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi92ZWM0LmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vcXVhdC5qcycpLlF1YXR9IFF1YXQgKi9cblxuY29uc3QgX2hhbGZTaXplID0gbmV3IFZlYzIoKTtcbmNvbnN0IHggPSBuZXcgVmVjMygpO1xuY29uc3QgeSA9IG5ldyBWZWMzKCk7XG5jb25zdCB6ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHNjYWxlID0gbmV3IFZlYzMoKTtcblxuXG4vKipcbiAqIEEgNHg0IG1hdHJpeC5cbiAqL1xuY2xhc3MgTWF0NCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1hdDQgaW5zdGFuY2UuIEl0IGlzIGluaXRpYWxpemVkIHRvIHRoZSBpZGVudGl0eSBtYXRyaXguXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIENyZWF0ZSBhbiBpZGVudGl0eSBtYXRyaXguIE5vdGUgdGhhdCBhIG5ldyBGbG9hdDMyQXJyYXkgaGFzIGFsbCBlbGVtZW50cyBzZXRcbiAgICAgICAgLy8gdG8gemVybyBieSBkZWZhdWx0LCBzbyB3ZSBvbmx5IG5lZWQgdG8gc2V0IHRoZSByZWxldmFudCBlbGVtZW50cyB0byBvbmUuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDE2KTtcbiAgICAgICAgZGF0YVswXSA9IGRhdGFbNV0gPSBkYXRhWzEwXSA9IGRhdGFbMTVdID0gMTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWF0cml4IGVsZW1lbnRzIGluIHRoZSBmb3JtIG9mIGEgZmxhdCBhcnJheS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Zsb2F0MzJBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgfVxuXG4gICAgLy8gU3RhdGljIGZ1bmN0aW9uIHdoaWNoIGV2YWx1YXRlcyBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeCBoYWxmIHNpemUgYXQgdGhlIG5lYXIgcGxhbmVcbiAgICBzdGF0aWMgX2dldFBlcnNwZWN0aXZlSGFsZlNpemUoaGFsZlNpemUsIGZvdiwgYXNwZWN0LCB6bmVhciwgZm92SXNIb3Jpem9udGFsKSB7XG4gICAgICAgIGlmIChmb3ZJc0hvcml6b250YWwpIHtcbiAgICAgICAgICAgIGhhbGZTaXplLnggPSB6bmVhciAqIE1hdGgudGFuKGZvdiAqIE1hdGguUEkgLyAzNjApO1xuICAgICAgICAgICAgaGFsZlNpemUueSA9IGhhbGZTaXplLnggLyBhc3BlY3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoYWxmU2l6ZS55ID0gem5lYXIgKiBNYXRoLnRhbihmb3YgKiBNYXRoLlBJIC8gMzYwKTtcbiAgICAgICAgICAgIGhhbGZTaXplLnggPSBoYWxmU2l6ZS55ICogYXNwZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaWNlcyB0b2dldGhlciBhbmQgc3RvcmVzIHRoZSByZXN1bHQgaW4gdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IGxocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIGZpcnN0IG9wZXJhbmQgb2YgdGhlIGFkZGl0aW9uLlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgc2Vjb25kIG9wZXJhbmQgb2YgdGhlIGFkZGl0aW9uLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIG0uYWRkMihwYy5NYXQ0LklERU5USVRZLCBwYy5NYXQ0Lk9ORSk7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGFkZGl0aW9uIGlzOiBcIiArIG0udG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgYWRkMihsaHMsIHJocykge1xuICAgICAgICBjb25zdCBhID0gbGhzLmRhdGEsXG4gICAgICAgICAgICBiID0gcmhzLmRhdGEsXG4gICAgICAgICAgICByID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIHJbMF0gPSBhWzBdICsgYlswXTtcbiAgICAgICAgclsxXSA9IGFbMV0gKyBiWzFdO1xuICAgICAgICByWzJdID0gYVsyXSArIGJbMl07XG4gICAgICAgIHJbM10gPSBhWzNdICsgYlszXTtcbiAgICAgICAgcls0XSA9IGFbNF0gKyBiWzRdO1xuICAgICAgICByWzVdID0gYVs1XSArIGJbNV07XG4gICAgICAgIHJbNl0gPSBhWzZdICsgYls2XTtcbiAgICAgICAgcls3XSA9IGFbN10gKyBiWzddO1xuICAgICAgICByWzhdID0gYVs4XSArIGJbOF07XG4gICAgICAgIHJbOV0gPSBhWzldICsgYls5XTtcbiAgICAgICAgclsxMF0gPSBhWzEwXSArIGJbMTBdO1xuICAgICAgICByWzExXSA9IGFbMTFdICsgYlsxMV07XG4gICAgICAgIHJbMTJdID0gYVsxMl0gKyBiWzEyXTtcbiAgICAgICAgclsxM10gPSBhWzEzXSArIGJbMTNdO1xuICAgICAgICByWzE0XSA9IGFbMTRdICsgYlsxNF07XG4gICAgICAgIHJbMTVdID0gYVsxNV0gKyBiWzE1XTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeCB0byB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIDR4NCBtYXRyaXggdXNlZCBhcyB0aGUgc2Vjb25kIG9wZXJhbmQgb2YgdGhlIGFkZGl0aW9uLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIG0uYWRkKHBjLk1hdDQuT05FKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgYWRkaXRpb24gaXM6IFwiICsgbS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBhZGQocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFkZDIodGhpcywgcmhzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgZHVwbGljYXRlIG9mIHRoZSBzcGVjaWZpZWQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgZHVwbGljYXRlIG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBzcmMgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKiB2YXIgZHN0ID0gc3JjLmNsb25lKCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIG1hdHJpY2VzIGFyZSBcIiArIChzcmMuZXF1YWxzKGRzdCkgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7dGhpc30gKi9cbiAgICAgICAgY29uc3QgY3N0ciA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgICAgIHJldHVybiBuZXcgY3N0cigpLmNvcHkodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHRoZSBjb250ZW50cyBvZiBhIHNvdXJjZSA0eDQgbWF0cml4IHRvIGEgZGVzdGluYXRpb24gNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gQSA0eDQgbWF0cml4IHRvIGJlIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgc3JjID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICogdmFyIGRzdCA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogZHN0LmNvcHkoc3JjKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gbWF0cmljZXMgYXJlIFwiICsgKHNyYy5lcXVhbHMoZHN0KSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBjb3B5KHJocykge1xuICAgICAgICBjb25zdCBzcmMgPSByaHMuZGF0YSxcbiAgICAgICAgICAgIGRzdCA9IHRoaXMuZGF0YTtcblxuICAgICAgICBkc3RbMF0gPSBzcmNbMF07XG4gICAgICAgIGRzdFsxXSA9IHNyY1sxXTtcbiAgICAgICAgZHN0WzJdID0gc3JjWzJdO1xuICAgICAgICBkc3RbM10gPSBzcmNbM107XG4gICAgICAgIGRzdFs0XSA9IHNyY1s0XTtcbiAgICAgICAgZHN0WzVdID0gc3JjWzVdO1xuICAgICAgICBkc3RbNl0gPSBzcmNbNl07XG4gICAgICAgIGRzdFs3XSA9IHNyY1s3XTtcbiAgICAgICAgZHN0WzhdID0gc3JjWzhdO1xuICAgICAgICBkc3RbOV0gPSBzcmNbOV07XG4gICAgICAgIGRzdFsxMF0gPSBzcmNbMTBdO1xuICAgICAgICBkc3RbMTFdID0gc3JjWzExXTtcbiAgICAgICAgZHN0WzEyXSA9IHNyY1sxMl07XG4gICAgICAgIGRzdFsxM10gPSBzcmNbMTNdO1xuICAgICAgICBkc3RbMTRdID0gc3JjWzE0XTtcbiAgICAgICAgZHN0WzE1XSA9IHNyY1sxNV07XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHR3byBtYXRyaWNlcyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IHJocyAtIFRoZSBvdGhlciBtYXRyaXguXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIG1hdHJpY2VzIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIG1hdHJpY2VzIGFyZSBcIiArIChhLmVxdWFscyhiKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIGNvbnN0IGwgPSB0aGlzLmRhdGEsXG4gICAgICAgICAgICByID0gcmhzLmRhdGE7XG5cbiAgICAgICAgcmV0dXJuICgobFswXSA9PT0gclswXSkgJiZcbiAgICAgICAgICAgICAgICAobFsxXSA9PT0gclsxXSkgJiZcbiAgICAgICAgICAgICAgICAobFsyXSA9PT0gclsyXSkgJiZcbiAgICAgICAgICAgICAgICAobFszXSA9PT0gclszXSkgJiZcbiAgICAgICAgICAgICAgICAobFs0XSA9PT0gcls0XSkgJiZcbiAgICAgICAgICAgICAgICAobFs1XSA9PT0gcls1XSkgJiZcbiAgICAgICAgICAgICAgICAobFs2XSA9PT0gcls2XSkgJiZcbiAgICAgICAgICAgICAgICAobFs3XSA9PT0gcls3XSkgJiZcbiAgICAgICAgICAgICAgICAobFs4XSA9PT0gcls4XSkgJiZcbiAgICAgICAgICAgICAgICAobFs5XSA9PT0gcls5XSkgJiZcbiAgICAgICAgICAgICAgICAobFsxMF0gPT09IHJbMTBdKSAmJlxuICAgICAgICAgICAgICAgIChsWzExXSA9PT0gclsxMV0pICYmXG4gICAgICAgICAgICAgICAgKGxbMTJdID09PSByWzEyXSkgJiZcbiAgICAgICAgICAgICAgICAobFsxM10gPT09IHJbMTNdKSAmJlxuICAgICAgICAgICAgICAgIChsWzE0XSA9PT0gclsxNF0pICYmXG4gICAgICAgICAgICAgICAgKGxbMTVdID09PSByWzE1XSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0aGUgc3BlY2lmaWVkIG1hdHJpeCBpcyB0aGUgaWRlbnRpdHkgbWF0cml4LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIG1hdHJpeCBpcyBpZGVudGl0eSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIG1hdHJpeCBpcyBcIiArIChtLmlzSWRlbnRpdHkoKSA/IFwiaWRlbnRpdHlcIiA6IFwibm90IGlkZW50aXR5XCIpKTtcbiAgICAgKi9cbiAgICBpc0lkZW50aXR5KCkge1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIHJldHVybiAoKG1bMF0gPT09IDEpICYmXG4gICAgICAgICAgICAgICAgKG1bMV0gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bMl0gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bM10gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bNF0gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bNV0gPT09IDEpICYmXG4gICAgICAgICAgICAgICAgKG1bNl0gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bN10gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bOF0gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bOV0gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bMTBdID09PSAxKSAmJlxuICAgICAgICAgICAgICAgIChtWzExXSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsxMl0gPT09IDApICYmXG4gICAgICAgICAgICAgICAgKG1bMTNdID09PSAwKSAmJlxuICAgICAgICAgICAgICAgIChtWzE0XSA9PT0gMCkgJiZcbiAgICAgICAgICAgICAgICAobVsxNV0gPT09IDEpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNdWx0aXBsaWVzIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpY2VzIHRvZ2V0aGVyIGFuZCBzdG9yZXMgdGhlIHJlc3VsdCBpbiB0aGUgY3VycmVudFxuICAgICAqIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNYXQ0fSBsaHMgLSBUaGUgNHg0IG1hdHJpeCB1c2VkIGFzIHRoZSBmaXJzdCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0ge01hdDR9IHJocyAtIFRoZSA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDE4MCk7XG4gICAgICogdmFyIHIgPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogLy8gciA9IGEgKiBiXG4gICAgICogci5tdWwyKGEsIGIpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBtdWx0aXBsaWNhdGlvbiBpczogXCIgKyByLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG11bDIobGhzLCByaHMpIHtcbiAgICAgICAgY29uc3QgYSA9IGxocy5kYXRhO1xuICAgICAgICBjb25zdCBiID0gcmhzLmRhdGE7XG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgYTAwID0gYVswXTtcbiAgICAgICAgY29uc3QgYTAxID0gYVsxXTtcbiAgICAgICAgY29uc3QgYTAyID0gYVsyXTtcbiAgICAgICAgY29uc3QgYTAzID0gYVszXTtcbiAgICAgICAgY29uc3QgYTEwID0gYVs0XTtcbiAgICAgICAgY29uc3QgYTExID0gYVs1XTtcbiAgICAgICAgY29uc3QgYTEyID0gYVs2XTtcbiAgICAgICAgY29uc3QgYTEzID0gYVs3XTtcbiAgICAgICAgY29uc3QgYTIwID0gYVs4XTtcbiAgICAgICAgY29uc3QgYTIxID0gYVs5XTtcbiAgICAgICAgY29uc3QgYTIyID0gYVsxMF07XG4gICAgICAgIGNvbnN0IGEyMyA9IGFbMTFdO1xuICAgICAgICBjb25zdCBhMzAgPSBhWzEyXTtcbiAgICAgICAgY29uc3QgYTMxID0gYVsxM107XG4gICAgICAgIGNvbnN0IGEzMiA9IGFbMTRdO1xuICAgICAgICBjb25zdCBhMzMgPSBhWzE1XTtcblxuICAgICAgICBsZXQgYjAsIGIxLCBiMiwgYjM7XG5cbiAgICAgICAgYjAgPSBiWzBdO1xuICAgICAgICBiMSA9IGJbMV07XG4gICAgICAgIGIyID0gYlsyXTtcbiAgICAgICAgYjMgPSBiWzNdO1xuICAgICAgICByWzBdICA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMCAqIGIzO1xuICAgICAgICByWzFdICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMiArIGEzMSAqIGIzO1xuICAgICAgICByWzJdICA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMiAqIGIzO1xuICAgICAgICByWzNdICA9IGEwMyAqIGIwICsgYTEzICogYjEgKyBhMjMgKiBiMiArIGEzMyAqIGIzO1xuXG4gICAgICAgIGIwID0gYls0XTtcbiAgICAgICAgYjEgPSBiWzVdO1xuICAgICAgICBiMiA9IGJbNl07XG4gICAgICAgIGIzID0gYls3XTtcbiAgICAgICAgcls0XSAgPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjIgKyBhMzAgKiBiMztcbiAgICAgICAgcls1XSAgPSBhMDEgKiBiMCArIGExMSAqIGIxICsgYTIxICogYjIgKyBhMzEgKiBiMztcbiAgICAgICAgcls2XSAgPSBhMDIgKiBiMCArIGExMiAqIGIxICsgYTIyICogYjIgKyBhMzIgKiBiMztcbiAgICAgICAgcls3XSAgPSBhMDMgKiBiMCArIGExMyAqIGIxICsgYTIzICogYjIgKyBhMzMgKiBiMztcblxuICAgICAgICBiMCA9IGJbOF07XG4gICAgICAgIGIxID0gYls5XTtcbiAgICAgICAgYjIgPSBiWzEwXTtcbiAgICAgICAgYjMgPSBiWzExXTtcbiAgICAgICAgcls4XSAgPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjIgKyBhMzAgKiBiMztcbiAgICAgICAgcls5XSAgPSBhMDEgKiBiMCArIGExMSAqIGIxICsgYTIxICogYjIgKyBhMzEgKiBiMztcbiAgICAgICAgclsxMF0gPSBhMDIgKiBiMCArIGExMiAqIGIxICsgYTIyICogYjIgKyBhMzIgKiBiMztcbiAgICAgICAgclsxMV0gPSBhMDMgKiBiMCArIGExMyAqIGIxICsgYTIzICogYjIgKyBhMzMgKiBiMztcblxuICAgICAgICBiMCA9IGJbMTJdO1xuICAgICAgICBiMSA9IGJbMTNdO1xuICAgICAgICBiMiA9IGJbMTRdO1xuICAgICAgICBiMyA9IGJbMTVdO1xuICAgICAgICByWzEyXSA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMiArIGEzMCAqIGIzO1xuICAgICAgICByWzEzXSA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMiArIGEzMSAqIGIzO1xuICAgICAgICByWzE0XSA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMiAqIGIzO1xuICAgICAgICByWzE1XSA9IGEwMyAqIGIwICsgYTEzICogYjEgKyBhMjMgKiBiMiArIGEzMyAqIGIzO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cmljZXMgdG9nZXRoZXIgYW5kIHN0b3JlcyB0aGUgcmVzdWx0IGluIHRoZSBjdXJyZW50XG4gICAgICogaW5zdGFuY2UuIFRoaXMgZnVuY3Rpb24gYXNzdW1lcyB0aGUgbWF0cmljZXMgYXJlIGFmZmluZSB0cmFuc2Zvcm1hdGlvbiBtYXRyaWNlcywgd2hlcmUgdGhlXG4gICAgICogdXBwZXIgbGVmdCAzeDMgZWxlbWVudHMgYXJlIGEgcm90YXRpb24gbWF0cml4LCBhbmQgdGhlIGJvdHRvbSBsZWZ0IDMgZWxlbWVudHMgYXJlXG4gICAgICogdHJhbnNsYXRpb24uIFRoZSByaWdodG1vc3QgY29sdW1uIGlzIGFzc3VtZWQgdG8gYmUgWzAsIDAsIDAsIDFdLiBUaGUgcGFyYW1ldGVycyBhcmUgbm90XG4gICAgICogdmVyaWZpZWQgdG8gYmUgaW4gdGhlIGV4cGVjdGVkIGZvcm1hdC4gVGhpcyBmdW5jdGlvbiBpcyBmYXN0ZXIgdGhhbiBnZW5lcmFsXG4gICAgICoge0BsaW5rIE1hdDQjbXVsMn0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IGxocyAtIFRoZSBhZmZpbmUgdHJhbnNmb3JtYXRpb24gNHg0IG1hdHJpeCB1c2VkIGFzIHRoZSBmaXJzdCBtdWx0aXBsaWNhbmQgb2ZcbiAgICAgKiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7TWF0NH0gcmhzIC0gVGhlIGFmZmluZSB0cmFuc2Zvcm1hdGlvbiA0eDQgbWF0cml4IHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2ZcbiAgICAgKiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBtdWxBZmZpbmUyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IGEgPSBsaHMuZGF0YTtcbiAgICAgICAgY29uc3QgYiA9IHJocy5kYXRhO1xuICAgICAgICBjb25zdCByID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGNvbnN0IGEwMCA9IGFbMF07XG4gICAgICAgIGNvbnN0IGEwMSA9IGFbMV07XG4gICAgICAgIGNvbnN0IGEwMiA9IGFbMl07XG4gICAgICAgIGNvbnN0IGExMCA9IGFbNF07XG4gICAgICAgIGNvbnN0IGExMSA9IGFbNV07XG4gICAgICAgIGNvbnN0IGExMiA9IGFbNl07XG4gICAgICAgIGNvbnN0IGEyMCA9IGFbOF07XG4gICAgICAgIGNvbnN0IGEyMSA9IGFbOV07XG4gICAgICAgIGNvbnN0IGEyMiA9IGFbMTBdO1xuICAgICAgICBjb25zdCBhMzAgPSBhWzEyXTtcbiAgICAgICAgY29uc3QgYTMxID0gYVsxM107XG4gICAgICAgIGNvbnN0IGEzMiA9IGFbMTRdO1xuXG4gICAgICAgIGxldCBiMCwgYjEsIGIyO1xuXG4gICAgICAgIGIwID0gYlswXTtcbiAgICAgICAgYjEgPSBiWzFdO1xuICAgICAgICBiMiA9IGJbMl07XG4gICAgICAgIHJbMF0gID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyO1xuICAgICAgICByWzFdICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMjtcbiAgICAgICAgclsyXSAgPSBhMDIgKiBiMCArIGExMiAqIGIxICsgYTIyICogYjI7XG4gICAgICAgIHJbM10gPSAwO1xuXG4gICAgICAgIGIwID0gYls0XTtcbiAgICAgICAgYjEgPSBiWzVdO1xuICAgICAgICBiMiA9IGJbNl07XG4gICAgICAgIHJbNF0gID0gYTAwICogYjAgKyBhMTAgKiBiMSArIGEyMCAqIGIyO1xuICAgICAgICByWzVdICA9IGEwMSAqIGIwICsgYTExICogYjEgKyBhMjEgKiBiMjtcbiAgICAgICAgcls2XSAgPSBhMDIgKiBiMCArIGExMiAqIGIxICsgYTIyICogYjI7XG4gICAgICAgIHJbN10gPSAwO1xuXG4gICAgICAgIGIwID0gYls4XTtcbiAgICAgICAgYjEgPSBiWzldO1xuICAgICAgICBiMiA9IGJbMTBdO1xuICAgICAgICByWzhdICA9IGEwMCAqIGIwICsgYTEwICogYjEgKyBhMjAgKiBiMjtcbiAgICAgICAgcls5XSAgPSBhMDEgKiBiMCArIGExMSAqIGIxICsgYTIxICogYjI7XG4gICAgICAgIHJbMTBdID0gYTAyICogYjAgKyBhMTIgKiBiMSArIGEyMiAqIGIyO1xuICAgICAgICByWzExXSA9IDA7XG5cbiAgICAgICAgYjAgPSBiWzEyXTtcbiAgICAgICAgYjEgPSBiWzEzXTtcbiAgICAgICAgYjIgPSBiWzE0XTtcbiAgICAgICAgclsxMl0gPSBhMDAgKiBiMCArIGExMCAqIGIxICsgYTIwICogYjIgKyBhMzA7XG4gICAgICAgIHJbMTNdID0gYTAxICogYjAgKyBhMTEgKiBiMSArIGEyMSAqIGIyICsgYTMxO1xuICAgICAgICByWzE0XSA9IGEwMiAqIGIwICsgYTEyICogYjEgKyBhMjIgKiBiMiArIGEzMjtcbiAgICAgICAgclsxNV0gPSAxO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXMgdGhlIGN1cnJlbnQgaW5zdGFuY2UgYnkgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNYXQ0fSByaHMgLSBUaGUgNHg0IG1hdHJpeCB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUF4aXNBbmdsZShwYy5WZWMzLlVQLCAxODApO1xuICAgICAqXG4gICAgICogLy8gYSA9IGEgKiBiXG4gICAgICogYS5tdWwoYik7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsKHJocykge1xuICAgICAgICByZXR1cm4gdGhpcy5tdWwyKHRoaXMsIHJocyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDMtZGltZW5zaW9uYWwgcG9pbnQgYnkgYSA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSB2ZWMgLSBUaGUgMy1kaW1lbnNpb25hbCBwb2ludCB0byBiZSB0cmFuc2Zvcm1lZC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtyZXNdIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCBwb2ludCB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlXG4gICAgICogdHJhbnNmb3JtYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBpbnB1dCBwb2ludCB2IHRyYW5zZm9ybWVkIGJ5IHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgMy1kaW1lbnNpb25hbCBwb2ludFxuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzMoMSwgMiwgMyk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKlxuICAgICAqIHZhciB0diA9IG0udHJhbnNmb3JtUG9pbnQodik7XG4gICAgICovXG4gICAgdHJhbnNmb3JtUG9pbnQodmVjLCByZXMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgeCA9IHZlYy54O1xuICAgICAgICBjb25zdCB5ID0gdmVjLnk7XG4gICAgICAgIGNvbnN0IHogPSB2ZWMuejtcblxuICAgICAgICByZXMueCA9IHggKiBtWzBdICsgeSAqIG1bNF0gKyB6ICogbVs4XSArIG1bMTJdO1xuICAgICAgICByZXMueSA9IHggKiBtWzFdICsgeSAqIG1bNV0gKyB6ICogbVs5XSArIG1bMTNdO1xuICAgICAgICByZXMueiA9IHggKiBtWzJdICsgeSAqIG1bNl0gKyB6ICogbVsxMF0gKyBtWzE0XTtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBieSBhIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHZlYyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byBiZSB0cmFuc2Zvcm1lZC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtyZXNdIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgcmVzdWx0IG9mIHRoZVxuICAgICAqIHRyYW5zZm9ybWF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgaW5wdXQgdmVjdG9yIHYgdHJhbnNmb3JtZWQgYnkgdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSAzLWRpbWVuc2lvbmFsIHZlY3RvclxuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzMoMSwgMiwgMyk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKlxuICAgICAqIHZhciB0diA9IG0udHJhbnNmb3JtVmVjdG9yKHYpO1xuICAgICAqL1xuICAgIHRyYW5zZm9ybVZlY3Rvcih2ZWMsIHJlcyA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICBjb25zdCB4ID0gdmVjLng7XG4gICAgICAgIGNvbnN0IHkgPSB2ZWMueTtcbiAgICAgICAgY29uc3QgeiA9IHZlYy56O1xuXG4gICAgICAgIHJlcy54ID0geCAqIG1bMF0gKyB5ICogbVs0XSArIHogKiBtWzhdO1xuICAgICAgICByZXMueSA9IHggKiBtWzFdICsgeSAqIG1bNV0gKyB6ICogbVs5XTtcbiAgICAgICAgcmVzLnogPSB4ICogbVsyXSArIHkgKiBtWzZdICsgeiAqIG1bMTBdO1xuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDQtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IGEgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjNH0gdmVjIC0gVGhlIDQtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjNH0gW3Jlc10gLSBBbiBvcHRpb25hbCA0LWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlXG4gICAgICogdHJhbnNmb3JtYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzR9IFRoZSBpbnB1dCB2ZWN0b3IgdiB0cmFuc2Zvcm1lZCBieSB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhbiBpbnB1dCA0LWRpbWVuc2lvbmFsIHZlY3RvclxuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzQoMSwgMiwgMywgNCk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgYW4gb3V0cHV0IDQtZGltZW5zaW9uYWwgdmVjdG9yXG4gICAgICogdmFyIHJlc3VsdCA9IG5ldyBwYy5WZWM0KCk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKlxuICAgICAqIG0udHJhbnNmb3JtVmVjNCh2LCByZXN1bHQpO1xuICAgICAqL1xuICAgIHRyYW5zZm9ybVZlYzQodmVjLCByZXMgPSBuZXcgVmVjNCgpKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgY29uc3QgeCA9IHZlYy54O1xuICAgICAgICBjb25zdCB5ID0gdmVjLnk7XG4gICAgICAgIGNvbnN0IHogPSB2ZWMuejtcbiAgICAgICAgY29uc3QgdyA9IHZlYy53O1xuXG4gICAgICAgIHJlcy54ID0geCAqIG1bMF0gKyB5ICogbVs0XSArIHogKiBtWzhdICsgdyAqIG1bMTJdO1xuICAgICAgICByZXMueSA9IHggKiBtWzFdICsgeSAqIG1bNV0gKyB6ICogbVs5XSArIHcgKiBtWzEzXTtcbiAgICAgICAgcmVzLnogPSB4ICogbVsyXSArIHkgKiBtWzZdICsgeiAqIG1bMTBdICsgdyAqIG1bMTRdO1xuICAgICAgICByZXMudyA9IHggKiBtWzNdICsgeSAqIG1bN10gKyB6ICogbVsxMV0gKyB3ICogbVsxNV07XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgdmlld2luZyBtYXRyaXggZGVyaXZlZCBmcm9tIGFuIGV5ZSBwb2ludCwgYSB0YXJnZXQgcG9pbnQgYW5kXG4gICAgICogYW4gdXAgdmVjdG9yLiBUaGUgbWF0cml4IG1hcHMgdGhlIHRhcmdldCBwb2ludCB0byB0aGUgbmVnYXRpdmUgei1heGlzIGFuZCB0aGUgZXllIHBvaW50IHRvXG4gICAgICogdGhlIG9yaWdpbiwgc28gdGhhdCB3aGVuIHlvdSB1c2UgYSB0eXBpY2FsIHByb2plY3Rpb24gbWF0cml4LCB0aGUgY2VudGVyIG9mIHRoZSBzY2VuZSBtYXBzXG4gICAgICogdG8gdGhlIGNlbnRlciBvZiB0aGUgdmlld3BvcnQuIFNpbWlsYXJseSwgdGhlIGRpcmVjdGlvbiBkZXNjcmliZWQgYnkgdGhlIHVwIHZlY3RvciBwcm9qZWN0ZWRcbiAgICAgKiBvbnRvIHRoZSB2aWV3aW5nIHBsYW5lIGlzIG1hcHBlZCB0byB0aGUgcG9zaXRpdmUgeS1heGlzIHNvIHRoYXQgaXQgcG9pbnRzIHVwd2FyZCBpbiB0aGVcbiAgICAgKiB2aWV3cG9ydC4gVGhlIHVwIHZlY3RvciBtdXN0IG5vdCBiZSBwYXJhbGxlbCB0byB0aGUgbGluZSBvZiBzaWdodCBmcm9tIHRoZSBleWUgdG8gdGhlXG4gICAgICogcmVmZXJlbmNlIHBvaW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBwb3NpdGlvbiAtIDMtZCB2ZWN0b3IgaG9sZGluZyB2aWV3IHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjM30gdGFyZ2V0IC0gMy1kIHZlY3RvciBob2xkaW5nIHJlZmVyZW5jZSBwb2ludC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHVwIC0gMy1kIHZlY3RvciBob2xkaW5nIHRoZSB1cCBkaXJlY3Rpb24uXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHBvc2l0aW9uID0gbmV3IHBjLlZlYzMoMTAsIDEwLCAxMCk7XG4gICAgICogdmFyIHRhcmdldCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIHZhciB1cCA9IG5ldyBwYy5WZWMzKDAsIDEsIDApO1xuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKS5zZXRMb29rQXQocG9zaXRpb24sIHRhcmdldCwgdXApO1xuICAgICAqL1xuICAgIHNldExvb2tBdChwb3NpdGlvbiwgdGFyZ2V0LCB1cCkge1xuICAgICAgICB6LnN1YjIocG9zaXRpb24sIHRhcmdldCkubm9ybWFsaXplKCk7XG4gICAgICAgIHkuY29weSh1cCkubm9ybWFsaXplKCk7XG4gICAgICAgIHguY3Jvc3MoeSwgeikubm9ybWFsaXplKCk7XG4gICAgICAgIHkuY3Jvc3MoeiwgeCk7XG5cbiAgICAgICAgY29uc3QgciA9IHRoaXMuZGF0YTtcblxuICAgICAgICByWzBdICA9IHgueDtcbiAgICAgICAgclsxXSAgPSB4Lnk7XG4gICAgICAgIHJbMl0gID0geC56O1xuICAgICAgICByWzNdICA9IDA7XG4gICAgICAgIHJbNF0gID0geS54O1xuICAgICAgICByWzVdICA9IHkueTtcbiAgICAgICAgcls2XSAgPSB5Lno7XG4gICAgICAgIHJbN10gID0gMDtcbiAgICAgICAgcls4XSAgPSB6Lng7XG4gICAgICAgIHJbOV0gID0gei55O1xuICAgICAgICByWzEwXSA9IHouejtcbiAgICAgICAgclsxMV0gPSAwO1xuICAgICAgICByWzEyXSA9IHBvc2l0aW9uLng7XG4gICAgICAgIHJbMTNdID0gcG9zaXRpb24ueTtcbiAgICAgICAgclsxNF0gPSBwb3NpdGlvbi56O1xuICAgICAgICByWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHBlcnNwZWN0aXZlIHByb2plY3Rpb24gbWF0cml4LiBUaGUgZnVuY3Rpb24ncyBwYXJhbWV0ZXJzXG4gICAgICogZGVmaW5lIHRoZSBzaGFwZSBvZiBhIGZydXN0dW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGVmdCAtIFRoZSB4LWNvb3JkaW5hdGUgZm9yIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmVcbiAgICAgKiBpbiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJpZ2h0IC0gVGhlIHgtY29vcmRpbmF0ZSBmb3IgdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmVcbiAgICAgKiBpbiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJvdHRvbSAtIFRoZSB5LWNvb3JkaW5hdGUgZm9yIHRoZSBib3R0b20gZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvblxuICAgICAqIHBsYW5lIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdG9wIC0gVGhlIHktY29vcmRpbmF0ZSBmb3IgdGhlIHRvcCBlZGdlIG9mIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uIHBsYW5lIGluXG4gICAgICogZXllIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6bmVhciAtIFRoZSBuZWFyIGNsaXAgcGxhbmUgaW4gZXllIGNvb3JkaW5hdGVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6ZmFyIC0gVGhlIGZhciBjbGlwIHBsYW5lIGluIGV5ZSBjb29yZGluYXRlcy5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcGVyc3BlY3RpdmUgcHJvamVjdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgZiA9IHBjLk1hdDQoKS5zZXRGcnVzdHVtKC0yLCAyLCAtMSwgMSwgMSwgMTAwMCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEZydXN0dW0obGVmdCwgcmlnaHQsIGJvdHRvbSwgdG9wLCB6bmVhciwgemZhcikge1xuICAgICAgICBjb25zdCB0ZW1wMSA9IDIgKiB6bmVhcjtcbiAgICAgICAgY29uc3QgdGVtcDIgPSByaWdodCAtIGxlZnQ7XG4gICAgICAgIGNvbnN0IHRlbXAzID0gdG9wIC0gYm90dG9tO1xuICAgICAgICBjb25zdCB0ZW1wNCA9IHpmYXIgLSB6bmVhcjtcblxuICAgICAgICBjb25zdCByID0gdGhpcy5kYXRhO1xuICAgICAgICByWzBdID0gdGVtcDEgLyB0ZW1wMjtcbiAgICAgICAgclsxXSA9IDA7XG4gICAgICAgIHJbMl0gPSAwO1xuICAgICAgICByWzNdID0gMDtcbiAgICAgICAgcls0XSA9IDA7XG4gICAgICAgIHJbNV0gPSB0ZW1wMSAvIHRlbXAzO1xuICAgICAgICByWzZdID0gMDtcbiAgICAgICAgcls3XSA9IDA7XG4gICAgICAgIHJbOF0gPSAocmlnaHQgKyBsZWZ0KSAvIHRlbXAyO1xuICAgICAgICByWzldID0gKHRvcCArIGJvdHRvbSkgLyB0ZW1wMztcbiAgICAgICAgclsxMF0gPSAoLXpmYXIgLSB6bmVhcikgLyB0ZW1wNDtcbiAgICAgICAgclsxMV0gPSAtMTtcbiAgICAgICAgclsxMl0gPSAwO1xuICAgICAgICByWzEzXSA9IDA7XG4gICAgICAgIHJbMTRdID0gKC10ZW1wMSAqIHpmYXIpIC8gdGVtcDQ7XG4gICAgICAgIHJbMTVdID0gMDtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGEgcGVyc3BlY3RpdmUgcHJvamVjdGlvbiBtYXRyaXguIFRoZSBmdW5jdGlvbidzIHBhcmFtZXRlcnNcbiAgICAgKiBkZWZpbmUgdGhlIHNoYXBlIG9mIGEgZnJ1c3R1bS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmb3YgLSBUaGUgZnJ1c3R1bSdzIGZpZWxkIG9mIHZpZXcgaW4gZGVncmVlcy4gVGhlIGZvdklzSG9yaXpvbnRhbCBwYXJhbWV0ZXJcbiAgICAgKiBjb250cm9scyB3aGV0aGVyIHRoaXMgaXMgYSB2ZXJ0aWNhbCBvciBob3Jpem9udGFsIGZpZWxkIG9mIHZpZXcuIEJ5IGRlZmF1bHQsIGl0J3MgYSB2ZXJ0aWNhbFxuICAgICAqIGZpZWxkIG9mIHZpZXcuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFzcGVjdCAtIFRoZSBhc3BlY3QgcmF0aW8gb2YgdGhlIGZydXN0dW0ncyBwcm9qZWN0aW9uIHBsYW5lXG4gICAgICogKHdpZHRoIC8gaGVpZ2h0KS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gem5lYXIgLSBUaGUgbmVhciBjbGlwIHBsYW5lIGluIGV5ZSBjb29yZGluYXRlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gemZhciAtIFRoZSBmYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZm92SXNIb3Jpem9udGFsPWZhbHNlXSAtIFNldCB0byB0cnVlIHRvIHRyZWF0IHRoZSBmb3YgYXMgaG9yaXpvbnRhbFxuICAgICAqICh4LWF4aXMpIGFuZCBmYWxzZSBmb3IgdmVydGljYWwgKHktYXhpcykuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBwZXJzcGVjdGl2ZSBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAqIHZhciBwZXJzcCA9IHBjLk1hdDQoKS5zZXRQZXJzcGVjdGl2ZSg0NSwgMTYgLyA5LCAxLCAxMDAwKTtcbiAgICAgKi9cbiAgICBzZXRQZXJzcGVjdGl2ZShmb3YsIGFzcGVjdCwgem5lYXIsIHpmYXIsIGZvdklzSG9yaXpvbnRhbCkge1xuICAgICAgICBNYXQ0Ll9nZXRQZXJzcGVjdGl2ZUhhbGZTaXplKF9oYWxmU2l6ZSwgZm92LCBhc3BlY3QsIHpuZWFyLCBmb3ZJc0hvcml6b250YWwpO1xuICAgICAgICByZXR1cm4gdGhpcy5zZXRGcnVzdHVtKC1faGFsZlNpemUueCwgX2hhbGZTaXplLngsIC1faGFsZlNpemUueSwgX2hhbGZTaXplLnksIHpuZWFyLCB6ZmFyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIGFuIG9ydGhvZ3JhcGhpYyBwcm9qZWN0aW9uIG1hdHJpeC4gVGhlIGZ1bmN0aW9uJ3MgcGFyYW1ldGVyc1xuICAgICAqIGRlZmluZSB0aGUgc2hhcGUgb2YgYSBjdWJvaWQtc2hhcGVkIGZydXN0dW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGVmdCAtIFRoZSB4LWNvb3JkaW5hdGUgZm9yIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmVcbiAgICAgKiBpbiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJpZ2h0IC0gVGhlIHgtY29vcmRpbmF0ZSBmb3IgdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIGNhbWVyYSdzIHByb2plY3Rpb24gcGxhbmVcbiAgICAgKiBpbiBleWUgc3BhY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJvdHRvbSAtIFRoZSB5LWNvb3JkaW5hdGUgZm9yIHRoZSBib3R0b20gZWRnZSBvZiB0aGUgY2FtZXJhJ3MgcHJvamVjdGlvblxuICAgICAqIHBsYW5lIGluIGV5ZSBzcGFjZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdG9wIC0gVGhlIHktY29vcmRpbmF0ZSBmb3IgdGhlIHRvcCBlZGdlIG9mIHRoZSBjYW1lcmEncyBwcm9qZWN0aW9uIHBsYW5lIGluXG4gICAgICogZXllIHNwYWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZWFyIC0gVGhlIG5lYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZhciAtIFRoZSBmYXIgY2xpcCBwbGFuZSBpbiBleWUgY29vcmRpbmF0ZXMuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IG9ydGhvZ3JhcGhpYyBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAqIHZhciBvcnRobyA9IHBjLk1hdDQoKS5vcnRobygtMiwgMiwgLTIsIDIsIDEsIDEwMDApO1xuICAgICAqL1xuICAgIHNldE9ydGhvKGxlZnQsIHJpZ2h0LCBib3R0b20sIHRvcCwgbmVhciwgZmFyKSB7XG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgclswXSA9IDIgLyAocmlnaHQgLSBsZWZ0KTtcbiAgICAgICAgclsxXSA9IDA7XG4gICAgICAgIHJbMl0gPSAwO1xuICAgICAgICByWzNdID0gMDtcbiAgICAgICAgcls0XSA9IDA7XG4gICAgICAgIHJbNV0gPSAyIC8gKHRvcCAtIGJvdHRvbSk7XG4gICAgICAgIHJbNl0gPSAwO1xuICAgICAgICByWzddID0gMDtcbiAgICAgICAgcls4XSA9IDA7XG4gICAgICAgIHJbOV0gPSAwO1xuICAgICAgICByWzEwXSA9IC0yIC8gKGZhciAtIG5lYXIpO1xuICAgICAgICByWzExXSA9IDA7XG4gICAgICAgIHJbMTJdID0gLShyaWdodCArIGxlZnQpIC8gKHJpZ2h0IC0gbGVmdCk7XG4gICAgICAgIHJbMTNdID0gLSh0b3AgKyBib3R0b20pIC8gKHRvcCAtIGJvdHRvbSk7XG4gICAgICAgIHJbMTRdID0gLShmYXIgKyBuZWFyKSAvIChmYXIgLSBuZWFyKTtcbiAgICAgICAgclsxNV0gPSAxO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gYSByb3RhdGlvbiBtYXRyaXggZXF1aXZhbGVudCB0byBhIHJvdGF0aW9uIGFyb3VuZCBhbiBheGlzLiBUaGVcbiAgICAgKiBheGlzIG11c3QgYmUgbm9ybWFsaXplZCAodW5pdCBsZW5ndGgpIGFuZCB0aGUgYW5nbGUgbXVzdCBiZSBzcGVjaWZpZWQgaW4gZGVncmVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gYXhpcyAtIFRoZSBub3JtYWxpemVkIGF4aXMgdmVjdG9yIGFyb3VuZCB3aGljaCB0byByb3RhdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFuZ2xlIC0gVGhlIGFuZ2xlIG9mIHJvdGF0aW9uIGluIGRlZ3JlZXMuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeFxuICAgICAqIHZhciBybSA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUF4aXNBbmdsZShwYy5WZWMzLlVQLCA5MCk7XG4gICAgICovXG4gICAgc2V0RnJvbUF4aXNBbmdsZShheGlzLCBhbmdsZSkge1xuICAgICAgICBhbmdsZSAqPSBtYXRoLkRFR19UT19SQUQ7XG5cbiAgICAgICAgY29uc3QgeCA9IGF4aXMueDtcbiAgICAgICAgY29uc3QgeSA9IGF4aXMueTtcbiAgICAgICAgY29uc3QgeiA9IGF4aXMuejtcbiAgICAgICAgY29uc3QgYyA9IE1hdGguY29zKGFuZ2xlKTtcbiAgICAgICAgY29uc3QgcyA9IE1hdGguc2luKGFuZ2xlKTtcbiAgICAgICAgY29uc3QgdCA9IDEgLSBjO1xuICAgICAgICBjb25zdCB0eCA9IHQgKiB4O1xuICAgICAgICBjb25zdCB0eSA9IHQgKiB5O1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIG1bMF0gPSB0eCAqIHggKyBjO1xuICAgICAgICBtWzFdID0gdHggKiB5ICsgcyAqIHo7XG4gICAgICAgIG1bMl0gPSB0eCAqIHogLSBzICogeTtcbiAgICAgICAgbVszXSA9IDA7XG4gICAgICAgIG1bNF0gPSB0eCAqIHkgLSBzICogejtcbiAgICAgICAgbVs1XSA9IHR5ICogeSArIGM7XG4gICAgICAgIG1bNl0gPSB0eSAqIHogKyBzICogeDtcbiAgICAgICAgbVs3XSA9IDA7XG4gICAgICAgIG1bOF0gPSB0eCAqIHogKyBzICogeTtcbiAgICAgICAgbVs5XSA9IHR5ICogeiAtIHggKiBzO1xuICAgICAgICBtWzEwXSA9IHQgKiB6ICogeiArIGM7XG4gICAgICAgIG1bMTFdID0gMDtcbiAgICAgICAgbVsxMl0gPSAwO1xuICAgICAgICBtWzEzXSA9IDA7XG4gICAgICAgIG1bMTRdID0gMDtcbiAgICAgICAgbVsxNV0gPSAxO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gYSB0cmFuc2xhdGlvbiBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4LWNvbXBvbmVudCBvZiB0aGUgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeS1jb21wb25lbnQgb2YgdGhlIHRyYW5zbGF0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIHotY29tcG9uZW50IG9mIHRoZSB0cmFuc2xhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgdHJhbnNsYXRpb24gbWF0cml4XG4gICAgICogdmFyIHRtID0gbmV3IHBjLk1hdDQoKS5zZXRUcmFuc2xhdGUoMTAsIDEwLCAxMCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFRyYW5zbGF0ZSh4LCB5LCB6KSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9IDE7XG4gICAgICAgIG1bMV0gPSAwO1xuICAgICAgICBtWzJdID0gMDtcbiAgICAgICAgbVszXSA9IDA7XG4gICAgICAgIG1bNF0gPSAwO1xuICAgICAgICBtWzVdID0gMTtcbiAgICAgICAgbVs2XSA9IDA7XG4gICAgICAgIG1bN10gPSAwO1xuICAgICAgICBtWzhdID0gMDtcbiAgICAgICAgbVs5XSA9IDA7XG4gICAgICAgIG1bMTBdID0gMTtcbiAgICAgICAgbVsxMV0gPSAwO1xuICAgICAgICBtWzEyXSA9IHg7XG4gICAgICAgIG1bMTNdID0geTtcbiAgICAgICAgbVsxNF0gPSB6O1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHNjYWxlIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHgtY29tcG9uZW50IG9mIHRoZSBzY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvbXBvbmVudCBvZiB0aGUgc2NhbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgei1jb21wb25lbnQgb2YgdGhlIHNjYWxlLlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBzY2FsZSBtYXRyaXhcbiAgICAgKiB2YXIgc20gPSBuZXcgcGMuTWF0NCgpLnNldFNjYWxlKDEwLCAxMCwgMTApO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRTY2FsZSh4LCB5LCB6KSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9IHg7XG4gICAgICAgIG1bMV0gPSAwO1xuICAgICAgICBtWzJdID0gMDtcbiAgICAgICAgbVszXSA9IDA7XG4gICAgICAgIG1bNF0gPSAwO1xuICAgICAgICBtWzVdID0geTtcbiAgICAgICAgbVs2XSA9IDA7XG4gICAgICAgIG1bN10gPSAwO1xuICAgICAgICBtWzhdID0gMDtcbiAgICAgICAgbVs5XSA9IDA7XG4gICAgICAgIG1bMTBdID0gejtcbiAgICAgICAgbVsxMV0gPSAwO1xuICAgICAgICBtWzEyXSA9IDA7XG4gICAgICAgIG1bMTNdID0gMDtcbiAgICAgICAgbVsxNF0gPSAwO1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIG1hdHJpeCB0cmFuc2Zvcm1pbmcgYSBub3JtYWxpemVkIHZpZXcgdm9sdW1lIChpbiByYW5nZSBvZlxuICAgICAqIC0xIC4uIDEpIHRvIHRoZWlyIHBvc2l0aW9uIGluc2lkZSBhIHZpZXdwb3J0IChpbiByYW5nZSBvZiAwIC4uIDEpLiBUaGlzIGVuY2Fwc3VsYXRlcyBhXG4gICAgICogc2NhbGluZyB0byB0aGUgc2l6ZSBvZiB0aGUgdmlld3BvcnQgYW5kIGEgdHJhbnNsYXRpb24gdG8gdGhlIHBvc2l0aW9uIG9mIHRoZSB2aWV3cG9ydC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHgtY29tcG9uZW50IG9mIHRoZSBwb3NpdGlvbiBvZiB0aGUgdmlld3BvcnQgKGluIDAuLjEgcmFuZ2UpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHktY29tcG9uZW50IG9mIHRoZSBwb3NpdGlvbiBvZiB0aGUgdmlld3BvcnQgKGluIDAuLjEgcmFuZ2UpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgdmlld3BvcnQgKGluIDAuLjEgcmFuZ2UpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSB2aWV3cG9ydCAoaW4gMC4uMSByYW5nZSkuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHZpZXdwb3J0IG1hdHJpeCB3aGljaCBzY2FsZXMgbm9ybWFsaXplZCB2aWV3IHZvbHVtZSB0byBmdWxsIHRleHR1cmUgdmlld3BvcnRcbiAgICAgKiB2YXIgdm0gPSBuZXcgcGMuTWF0NCgpLnNldFZpZXdwb3J0KDAsIDAsIDEsIDEpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRWaWV3cG9ydCh4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG5cbiAgICAgICAgbVswXSA9IHdpZHRoICogMC41O1xuICAgICAgICBtWzFdID0gMDtcbiAgICAgICAgbVsyXSA9IDA7XG4gICAgICAgIG1bM10gPSAwO1xuICAgICAgICBtWzRdID0gMDtcbiAgICAgICAgbVs1XSA9IGhlaWdodCAqIDAuNTtcbiAgICAgICAgbVs2XSA9IDA7XG4gICAgICAgIG1bN10gPSAwO1xuICAgICAgICBtWzhdID0gMDtcbiAgICAgICAgbVs5XSA9IDA7XG4gICAgICAgIG1bMTBdID0gMC41O1xuICAgICAgICBtWzExXSA9IDA7XG4gICAgICAgIG1bMTJdID0geCArIHdpZHRoICogMC41O1xuICAgICAgICBtWzEzXSA9IHkgKyBoZWlnaHQgKiAwLjU7XG4gICAgICAgIG1bMTRdID0gMC41O1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBpdHMgaW52ZXJzZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXggb2YgMTgwIGRlZ3JlZXMgYXJvdW5kIHRoZSB5LWF4aXNcbiAgICAgKiB2YXIgcm90ID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBJbnZlcnQgaW4gcGxhY2VcbiAgICAgKiByb3QuaW52ZXJ0KCk7XG4gICAgICovXG4gICAgaW52ZXJ0KCkge1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGNvbnN0IGEwMCA9IG1bMF07XG4gICAgICAgIGNvbnN0IGEwMSA9IG1bMV07XG4gICAgICAgIGNvbnN0IGEwMiA9IG1bMl07XG4gICAgICAgIGNvbnN0IGEwMyA9IG1bM107XG4gICAgICAgIGNvbnN0IGExMCA9IG1bNF07XG4gICAgICAgIGNvbnN0IGExMSA9IG1bNV07XG4gICAgICAgIGNvbnN0IGExMiA9IG1bNl07XG4gICAgICAgIGNvbnN0IGExMyA9IG1bN107XG4gICAgICAgIGNvbnN0IGEyMCA9IG1bOF07XG4gICAgICAgIGNvbnN0IGEyMSA9IG1bOV07XG4gICAgICAgIGNvbnN0IGEyMiA9IG1bMTBdO1xuICAgICAgICBjb25zdCBhMjMgPSBtWzExXTtcbiAgICAgICAgY29uc3QgYTMwID0gbVsxMl07XG4gICAgICAgIGNvbnN0IGEzMSA9IG1bMTNdO1xuICAgICAgICBjb25zdCBhMzIgPSBtWzE0XTtcbiAgICAgICAgY29uc3QgYTMzID0gbVsxNV07XG5cbiAgICAgICAgY29uc3QgYjAwID0gYTAwICogYTExIC0gYTAxICogYTEwO1xuICAgICAgICBjb25zdCBiMDEgPSBhMDAgKiBhMTIgLSBhMDIgKiBhMTA7XG4gICAgICAgIGNvbnN0IGIwMiA9IGEwMCAqIGExMyAtIGEwMyAqIGExMDtcbiAgICAgICAgY29uc3QgYjAzID0gYTAxICogYTEyIC0gYTAyICogYTExO1xuICAgICAgICBjb25zdCBiMDQgPSBhMDEgKiBhMTMgLSBhMDMgKiBhMTE7XG4gICAgICAgIGNvbnN0IGIwNSA9IGEwMiAqIGExMyAtIGEwMyAqIGExMjtcbiAgICAgICAgY29uc3QgYjA2ID0gYTIwICogYTMxIC0gYTIxICogYTMwO1xuICAgICAgICBjb25zdCBiMDcgPSBhMjAgKiBhMzIgLSBhMjIgKiBhMzA7XG4gICAgICAgIGNvbnN0IGIwOCA9IGEyMCAqIGEzMyAtIGEyMyAqIGEzMDtcbiAgICAgICAgY29uc3QgYjA5ID0gYTIxICogYTMyIC0gYTIyICogYTMxO1xuICAgICAgICBjb25zdCBiMTAgPSBhMjEgKiBhMzMgLSBhMjMgKiBhMzE7XG4gICAgICAgIGNvbnN0IGIxMSA9IGEyMiAqIGEzMyAtIGEyMyAqIGEzMjtcblxuICAgICAgICBjb25zdCBkZXQgPSAoYjAwICogYjExIC0gYjAxICogYjEwICsgYjAyICogYjA5ICsgYjAzICogYjA4IC0gYjA0ICogYjA3ICsgYjA1ICogYjA2KTtcbiAgICAgICAgaWYgKGRldCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zZXRJZGVudGl0eSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgaW52RGV0ID0gMSAvIGRldDtcblxuICAgICAgICAgICAgbVswXSA9IChhMTEgKiBiMTEgLSBhMTIgKiBiMTAgKyBhMTMgKiBiMDkpICogaW52RGV0O1xuICAgICAgICAgICAgbVsxXSA9ICgtYTAxICogYjExICsgYTAyICogYjEwIC0gYTAzICogYjA5KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMl0gPSAoYTMxICogYjA1IC0gYTMyICogYjA0ICsgYTMzICogYjAzKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bM10gPSAoLWEyMSAqIGIwNSArIGEyMiAqIGIwNCAtIGEyMyAqIGIwMykgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzRdID0gKC1hMTAgKiBiMTEgKyBhMTIgKiBiMDggLSBhMTMgKiBiMDcpICogaW52RGV0O1xuICAgICAgICAgICAgbVs1XSA9IChhMDAgKiBiMTEgLSBhMDIgKiBiMDggKyBhMDMgKiBiMDcpICogaW52RGV0O1xuICAgICAgICAgICAgbVs2XSA9ICgtYTMwICogYjA1ICsgYTMyICogYjAyIC0gYTMzICogYjAxKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bN10gPSAoYTIwICogYjA1IC0gYTIyICogYjAyICsgYTIzICogYjAxKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bOF0gPSAoYTEwICogYjEwIC0gYTExICogYjA4ICsgYTEzICogYjA2KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bOV0gPSAoLWEwMCAqIGIxMCArIGEwMSAqIGIwOCAtIGEwMyAqIGIwNikgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzEwXSA9IChhMzAgKiBiMDQgLSBhMzEgKiBiMDIgKyBhMzMgKiBiMDApICogaW52RGV0O1xuICAgICAgICAgICAgbVsxMV0gPSAoLWEyMCAqIGIwNCArIGEyMSAqIGIwMiAtIGEyMyAqIGIwMCkgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzEyXSA9ICgtYTEwICogYjA5ICsgYTExICogYjA3IC0gYTEyICogYjA2KSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTNdID0gKGEwMCAqIGIwOSAtIGEwMSAqIGIwNyArIGEwMiAqIGIwNikgKiBpbnZEZXQ7XG4gICAgICAgICAgICBtWzE0XSA9ICgtYTMwICogYjAzICsgYTMxICogYjAxIC0gYTMyICogYjAwKSAqIGludkRldDtcbiAgICAgICAgICAgIG1bMTVdID0gKGEyMCAqIGIwMyAtIGEyMSAqIGIwMSArIGEyMiAqIGIwMCkgKiBpbnZEZXQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIG1hdHJpeCBkYXRhIGZyb20gYW4gYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzcmMgLSBTb3VyY2UgYXJyYXkuIE11c3QgaGF2ZSAxNiB2YWx1ZXMuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIHNldChzcmMpIHtcbiAgICAgICAgY29uc3QgZHN0ID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGRzdFswXSA9IHNyY1swXTtcbiAgICAgICAgZHN0WzFdID0gc3JjWzFdO1xuICAgICAgICBkc3RbMl0gPSBzcmNbMl07XG4gICAgICAgIGRzdFszXSA9IHNyY1szXTtcbiAgICAgICAgZHN0WzRdID0gc3JjWzRdO1xuICAgICAgICBkc3RbNV0gPSBzcmNbNV07XG4gICAgICAgIGRzdFs2XSA9IHNyY1s2XTtcbiAgICAgICAgZHN0WzddID0gc3JjWzddO1xuICAgICAgICBkc3RbOF0gPSBzcmNbOF07XG4gICAgICAgIGRzdFs5XSA9IHNyY1s5XTtcbiAgICAgICAgZHN0WzEwXSA9IHNyY1sxMF07XG4gICAgICAgIGRzdFsxMV0gPSBzcmNbMTFdO1xuICAgICAgICBkc3RbMTJdID0gc3JjWzEyXTtcbiAgICAgICAgZHN0WzEzXSA9IHNyY1sxM107XG4gICAgICAgIGRzdFsxNF0gPSBzcmNbMTRdO1xuICAgICAgICBkc3RbMTVdID0gc3JjWzE1XTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIHRoZSBpZGVudGl0eSBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBtLnNldElkZW50aXR5KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbWF0cml4IGlzIFwiICsgKG0uaXNJZGVudGl0eSgpID8gXCJpZGVudGl0eVwiIDogXCJub3QgaWRlbnRpdHlcIikpO1xuICAgICAqL1xuICAgIHNldElkZW50aXR5KCkge1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIG1bMF0gPSAxO1xuICAgICAgICBtWzFdID0gMDtcbiAgICAgICAgbVsyXSA9IDA7XG4gICAgICAgIG1bM10gPSAwO1xuICAgICAgICBtWzRdID0gMDtcbiAgICAgICAgbVs1XSA9IDE7XG4gICAgICAgIG1bNl0gPSAwO1xuICAgICAgICBtWzddID0gMDtcbiAgICAgICAgbVs4XSA9IDA7XG4gICAgICAgIG1bOV0gPSAwO1xuICAgICAgICBtWzEwXSA9IDE7XG4gICAgICAgIG1bMTFdID0gMDtcbiAgICAgICAgbVsxMl0gPSAwO1xuICAgICAgICBtWzEzXSA9IDA7XG4gICAgICAgIG1bMTRdID0gMDtcbiAgICAgICAgbVsxNV0gPSAxO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gdGhlIGNvbmNhdGVuYXRpb24gb2YgYSB0cmFuc2xhdGlvbiwgYSBxdWF0ZXJuaW9uIHJvdGF0aW9uIGFuZCBhXG4gICAgICogc2NhbGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHQgLSBBIDMtZCB2ZWN0b3IgdHJhbnNsYXRpb24uXG4gICAgICogQHBhcmFtIHtRdWF0fSByIC0gQSBxdWF0ZXJuaW9uIHJvdGF0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjM30gcyAtIEEgMy1kIHZlY3RvciBzY2FsZS5cbiAgICAgKiBAcmV0dXJucyB7TWF0NH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdCA9IG5ldyBwYy5WZWMzKDEwLCAyMCwgMzApO1xuICAgICAqIHZhciByID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiB2YXIgcyA9IG5ldyBwYy5WZWMzKDIsIDIsIDIpO1xuICAgICAqXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqIG0uc2V0VFJTKHQsIHIsIHMpO1xuICAgICAqL1xuICAgIHNldFRSUyh0LCByLCBzKSB7XG4gICAgICAgIGNvbnN0IHF4ID0gci54O1xuICAgICAgICBjb25zdCBxeSA9IHIueTtcbiAgICAgICAgY29uc3QgcXogPSByLno7XG4gICAgICAgIGNvbnN0IHF3ID0gci53O1xuXG4gICAgICAgIGNvbnN0IHN4ID0gcy54O1xuICAgICAgICBjb25zdCBzeSA9IHMueTtcbiAgICAgICAgY29uc3Qgc3ogPSBzLno7XG5cbiAgICAgICAgY29uc3QgeDIgPSBxeCArIHF4O1xuICAgICAgICBjb25zdCB5MiA9IHF5ICsgcXk7XG4gICAgICAgIGNvbnN0IHoyID0gcXogKyBxejtcbiAgICAgICAgY29uc3QgeHggPSBxeCAqIHgyO1xuICAgICAgICBjb25zdCB4eSA9IHF4ICogeTI7XG4gICAgICAgIGNvbnN0IHh6ID0gcXggKiB6MjtcbiAgICAgICAgY29uc3QgeXkgPSBxeSAqIHkyO1xuICAgICAgICBjb25zdCB5eiA9IHF5ICogejI7XG4gICAgICAgIGNvbnN0IHp6ID0gcXogKiB6MjtcbiAgICAgICAgY29uc3Qgd3ggPSBxdyAqIHgyO1xuICAgICAgICBjb25zdCB3eSA9IHF3ICogeTI7XG4gICAgICAgIGNvbnN0IHd6ID0gcXcgKiB6MjtcblxuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIG1bMF0gPSAoMSAtICh5eSArIHp6KSkgKiBzeDtcbiAgICAgICAgbVsxXSA9ICh4eSArIHd6KSAqIHN4O1xuICAgICAgICBtWzJdID0gKHh6IC0gd3kpICogc3g7XG4gICAgICAgIG1bM10gPSAwO1xuXG4gICAgICAgIG1bNF0gPSAoeHkgLSB3eikgKiBzeTtcbiAgICAgICAgbVs1XSA9ICgxIC0gKHh4ICsgenopKSAqIHN5O1xuICAgICAgICBtWzZdID0gKHl6ICsgd3gpICogc3k7XG4gICAgICAgIG1bN10gPSAwO1xuXG4gICAgICAgIG1bOF0gPSAoeHogKyB3eSkgKiBzejtcbiAgICAgICAgbVs5XSA9ICh5eiAtIHd4KSAqIHN6O1xuICAgICAgICBtWzEwXSA9ICgxIC0gKHh4ICsgeXkpKSAqIHN6O1xuICAgICAgICBtWzExXSA9IDA7XG5cbiAgICAgICAgbVsxMl0gPSB0Lng7XG4gICAgICAgIG1bMTNdID0gdC55O1xuICAgICAgICBtWzE0XSA9IHQuejtcbiAgICAgICAgbVsxNV0gPSAxO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCBtYXRyaXggdG8gaXRzIHRyYW5zcG9zZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtNYXQ0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIC8vIFRyYW5zcG9zZSBpbiBwbGFjZVxuICAgICAqIG0udHJhbnNwb3NlKCk7XG4gICAgICovXG4gICAgdHJhbnNwb3NlKCkge1xuICAgICAgICBsZXQgdG1wO1xuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIHRtcCA9IG1bMV07XG4gICAgICAgIG1bMV0gPSBtWzRdO1xuICAgICAgICBtWzRdID0gdG1wO1xuXG4gICAgICAgIHRtcCA9IG1bMl07XG4gICAgICAgIG1bMl0gPSBtWzhdO1xuICAgICAgICBtWzhdID0gdG1wO1xuXG4gICAgICAgIHRtcCA9IG1bM107XG4gICAgICAgIG1bM10gPSBtWzEyXTtcbiAgICAgICAgbVsxMl0gPSB0bXA7XG5cbiAgICAgICAgdG1wID0gbVs2XTtcbiAgICAgICAgbVs2XSA9IG1bOV07XG4gICAgICAgIG1bOV0gPSB0bXA7XG5cbiAgICAgICAgdG1wID0gbVs3XTtcbiAgICAgICAgbVs3XSA9IG1bMTNdO1xuICAgICAgICBtWzEzXSA9IHRtcDtcblxuICAgICAgICB0bXAgPSBtWzExXTtcbiAgICAgICAgbVsxMV0gPSBtWzE0XTtcbiAgICAgICAgbVsxNF0gPSB0bXA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgaW52ZXJ0VG8zeDMocmVzKSB7XG4gICAgICAgIGNvbnN0IG0gPSB0aGlzLmRhdGE7XG4gICAgICAgIGNvbnN0IHIgPSByZXMuZGF0YTtcblxuICAgICAgICBjb25zdCBtMCA9IG1bMF07XG4gICAgICAgIGNvbnN0IG0xID0gbVsxXTtcbiAgICAgICAgY29uc3QgbTIgPSBtWzJdO1xuXG4gICAgICAgIGNvbnN0IG00ID0gbVs0XTtcbiAgICAgICAgY29uc3QgbTUgPSBtWzVdO1xuICAgICAgICBjb25zdCBtNiA9IG1bNl07XG5cbiAgICAgICAgY29uc3QgbTggPSBtWzhdO1xuICAgICAgICBjb25zdCBtOSA9IG1bOV07XG4gICAgICAgIGNvbnN0IG0xMCA9IG1bMTBdO1xuXG4gICAgICAgIGNvbnN0IGExMSA9ICBtMTAgKiBtNSAtIG02ICogbTk7XG4gICAgICAgIGNvbnN0IGEyMSA9IC1tMTAgKiBtMSArIG0yICogbTk7XG4gICAgICAgIGNvbnN0IGEzMSA9ICBtNiAgKiBtMSAtIG0yICogbTU7XG4gICAgICAgIGNvbnN0IGExMiA9IC1tMTAgKiBtNCArIG02ICogbTg7XG4gICAgICAgIGNvbnN0IGEyMiA9ICBtMTAgKiBtMCAtIG0yICogbTg7XG4gICAgICAgIGNvbnN0IGEzMiA9IC1tNiAgKiBtMCArIG0yICogbTQ7XG4gICAgICAgIGNvbnN0IGExMyA9ICBtOSAgKiBtNCAtIG01ICogbTg7XG4gICAgICAgIGNvbnN0IGEyMyA9IC1tOSAgKiBtMCArIG0xICogbTg7XG4gICAgICAgIGNvbnN0IGEzMyA9ICBtNSAgKiBtMCAtIG0xICogbTQ7XG5cbiAgICAgICAgY29uc3QgZGV0ID0gIG0wICogYTExICsgbTEgKiBhMTIgKyBtMiAqIGExMztcbiAgICAgICAgaWYgKGRldCA9PT0gMCkgeyAvLyBubyBpbnZlcnNlXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlkZXQgPSAxIC8gZGV0O1xuXG4gICAgICAgIHJbMF0gPSBpZGV0ICogYTExO1xuICAgICAgICByWzFdID0gaWRldCAqIGEyMTtcbiAgICAgICAgclsyXSA9IGlkZXQgKiBhMzE7XG4gICAgICAgIHJbM10gPSBpZGV0ICogYTEyO1xuICAgICAgICByWzRdID0gaWRldCAqIGEyMjtcbiAgICAgICAgcls1XSA9IGlkZXQgKiBhMzI7XG4gICAgICAgIHJbNl0gPSBpZGV0ICogYTEzO1xuICAgICAgICByWzddID0gaWRldCAqIGEyMztcbiAgICAgICAgcls4XSA9IGlkZXQgKiBhMzM7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdHMgdGhlIHRyYW5zbGF0aW9uYWwgY29tcG9uZW50IGZyb20gdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbdF0gLSBUaGUgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIHRyYW5zbGF0aW9uIG9mIHRoZSBtYXRyaXguXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB0cmFuc2xhdGlvbiBvZiB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgbWF0cml4XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogLy8gUXVlcnkgdGhlIHotYXhpcyBjb21wb25lbnRcbiAgICAgKiB2YXIgdCA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogbS5nZXRUcmFuc2xhdGlvbih0KTtcbiAgICAgKi9cbiAgICBnZXRUcmFuc2xhdGlvbih0ID0gbmV3IFZlYzMoKSkge1xuICAgICAgICByZXR1cm4gdC5zZXQodGhpcy5kYXRhWzEyXSwgdGhpcy5kYXRhWzEzXSwgdGhpcy5kYXRhWzE0XSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdHMgdGhlIHgtYXhpcyBmcm9tIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3hdIC0gVGhlIHZlY3RvciB0byByZWNlaXZlIHRoZSB4IGF4aXMgb2YgdGhlIG1hdHJpeC5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHgtYXhpcyBvZiB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgbWF0cml4XG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqXG4gICAgICogLy8gUXVlcnkgdGhlIHotYXhpcyBjb21wb25lbnRcbiAgICAgKiB2YXIgeCA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogbS5nZXRYKHgpO1xuICAgICAqL1xuICAgIGdldFgoeCA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgcmV0dXJuIHguc2V0KHRoaXMuZGF0YVswXSwgdGhpcy5kYXRhWzFdLCB0aGlzLmRhdGFbMl0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSB5LWF4aXMgZnJvbSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFt5XSAtIFRoZSB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgeSBheGlzIG9mIHRoZSBtYXRyaXguXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB5LWF4aXMgb2YgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IG1hdHJpeFxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKlxuICAgICAqIC8vIFF1ZXJ5IHRoZSB6LWF4aXMgY29tcG9uZW50XG4gICAgICogdmFyIHkgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIG0uZ2V0WSh5KTtcbiAgICAgKi9cbiAgICBnZXRZKHkgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHJldHVybiB5LnNldCh0aGlzLmRhdGFbNF0sIHRoaXMuZGF0YVs1XSwgdGhpcy5kYXRhWzZdKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeHRyYWN0cyB0aGUgei1heGlzIGZyb20gdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbel0gLSBUaGUgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIHogYXhpcyBvZiB0aGUgbWF0cml4LlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgei1heGlzIG9mIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCBtYXRyaXhcbiAgICAgKiB2YXIgbSA9IG5ldyBwYy5NYXQ0KCk7XG4gICAgICpcbiAgICAgKiAvLyBRdWVyeSB0aGUgei1heGlzIGNvbXBvbmVudFxuICAgICAqIHZhciB6ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiBtLmdldFooeik7XG4gICAgICovXG4gICAgZ2V0Wih6ID0gbmV3IFZlYzMoKSkge1xuICAgICAgICByZXR1cm4gei5zZXQodGhpcy5kYXRhWzhdLCB0aGlzLmRhdGFbOV0sIHRoaXMuZGF0YVsxMF0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV4dHJhY3RzIHRoZSBzY2FsZSBjb21wb25lbnQgZnJvbSB0aGUgc3BlY2lmaWVkIDR4NCBtYXRyaXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtzY2FsZV0gLSBWZWN0b3IgdG8gcmVjZWl2ZSB0aGUgc2NhbGUuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBzY2FsZSBpbiBYLCBZIGFuZCBaIG9mIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFF1ZXJ5IHRoZSBzY2FsZSBjb21wb25lbnRcbiAgICAgKiB2YXIgc2NhbGUgPSBtLmdldFNjYWxlKCk7XG4gICAgICovXG4gICAgZ2V0U2NhbGUoc2NhbGUgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIHRoaXMuZ2V0WCh4KTtcbiAgICAgICAgdGhpcy5nZXRZKHkpO1xuICAgICAgICB0aGlzLmdldFooeik7XG4gICAgICAgIHNjYWxlLnNldCh4Lmxlbmd0aCgpLCB5Lmxlbmd0aCgpLCB6Lmxlbmd0aCgpKTtcblxuICAgICAgICByZXR1cm4gc2NhbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIG1hdHJpeCB0byBhIHJvdGF0aW9uIG1hdHJpeCBkZWZpbmVkIGJ5IEV1bGVyIGFuZ2xlcy4gVGhlIEV1bGVyIGFuZ2xlcyBhcmVcbiAgICAgKiBzcGVjaWZpZWQgaW4gWFlaIG9yZGVyIGFuZCBpbiBkZWdyZWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGV4IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBYIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZXkgLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFkgYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBleiAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWiBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHJldHVybnMge01hdDR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG0gPSBuZXcgcGMuTWF0NCgpO1xuICAgICAqIG0uc2V0RnJvbUV1bGVyQW5nbGVzKDQ1LCA5MCwgMTgwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tRXVsZXJBbmdsZXMoZXgsIGV5LCBleikge1xuICAgICAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1JvdGF0aW9uX21hdHJpeCNDb252ZXJzaW9uX2Zyb21fYW5kX3RvX2F4aXMtYW5nbGVcbiAgICAgICAgLy8gVGhlIDNEIHNwYWNlIGlzIHJpZ2h0LWhhbmRlZCwgc28gdGhlIHJvdGF0aW9uIGFyb3VuZCBlYWNoIGF4aXMgd2lsbCBiZSBjb3VudGVyY2xvY2t3aXNlXG4gICAgICAgIC8vIGZvciBhbiBvYnNlcnZlciBwbGFjZWQgc28gdGhhdCB0aGUgYXhpcyBnb2VzIGluIGhpcyBvciBoZXIgZGlyZWN0aW9uIChSaWdodC1oYW5kIHJ1bGUpLlxuICAgICAgICBleCAqPSBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGV5ICo9IG1hdGguREVHX1RPX1JBRDtcbiAgICAgICAgZXogKj0gbWF0aC5ERUdfVE9fUkFEO1xuXG4gICAgICAgIC8vIFNvbHV0aW9uIHRha2VuIGZyb20gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9FdWxlcl9hbmdsZXMjTWF0cml4X29yaWVudGF0aW9uXG4gICAgICAgIGNvbnN0IHMxID0gTWF0aC5zaW4oLWV4KTtcbiAgICAgICAgY29uc3QgYzEgPSBNYXRoLmNvcygtZXgpO1xuICAgICAgICBjb25zdCBzMiA9IE1hdGguc2luKC1leSk7XG4gICAgICAgIGNvbnN0IGMyID0gTWF0aC5jb3MoLWV5KTtcbiAgICAgICAgY29uc3QgczMgPSBNYXRoLnNpbigtZXopO1xuICAgICAgICBjb25zdCBjMyA9IE1hdGguY29zKC1leik7XG5cbiAgICAgICAgY29uc3QgbSA9IHRoaXMuZGF0YTtcblxuICAgICAgICAvLyBTZXQgcm90YXRpb24gZWxlbWVudHNcbiAgICAgICAgbVswXSA9IGMyICogYzM7XG4gICAgICAgIG1bMV0gPSAtYzIgKiBzMztcbiAgICAgICAgbVsyXSA9IHMyO1xuICAgICAgICBtWzNdID0gMDtcblxuICAgICAgICBtWzRdID0gYzEgKiBzMyArIGMzICogczEgKiBzMjtcbiAgICAgICAgbVs1XSA9IGMxICogYzMgLSBzMSAqIHMyICogczM7XG4gICAgICAgIG1bNl0gPSAtYzIgKiBzMTtcbiAgICAgICAgbVs3XSA9IDA7XG5cbiAgICAgICAgbVs4XSA9IHMxICogczMgLSBjMSAqIGMzICogczI7XG4gICAgICAgIG1bOV0gPSBjMyAqIHMxICsgYzEgKiBzMiAqIHMzO1xuICAgICAgICBtWzEwXSA9IGMxICogYzI7XG4gICAgICAgIG1bMTFdID0gMDtcblxuICAgICAgICBtWzEyXSA9IDA7XG4gICAgICAgIG1bMTNdID0gMDtcbiAgICAgICAgbVsxNF0gPSAwO1xuICAgICAgICBtWzE1XSA9IDE7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXh0cmFjdHMgdGhlIEV1bGVyIGFuZ2xlcyBlcXVpdmFsZW50IHRvIHRoZSByb3RhdGlvbmFsIHBvcnRpb24gb2YgdGhlIHNwZWNpZmllZCBtYXRyaXguIFRoZVxuICAgICAqIHJldHVybmVkIEV1bGVyIGFuZ2xlcyBhcmUgaW4gWFlaIG9yZGVyIGFuIGluIGRlZ3JlZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtldWxlcnNdIC0gQSAzLWQgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIEV1bGVyIGFuZ2xlcy5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gQSAzLWQgdmVjdG9yIGNvbnRhaW5pbmcgdGhlIEV1bGVyIGFuZ2xlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXggb2YgNDUgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDQ1KTtcbiAgICAgKlxuICAgICAqIHZhciBldWxlcnMgPSBtLmdldEV1bGVyQW5nbGVzKCk7XG4gICAgICovXG4gICAgZ2V0RXVsZXJBbmdsZXMoZXVsZXJzID0gbmV3IFZlYzMoKSkge1xuICAgICAgICB0aGlzLmdldFNjYWxlKHNjYWxlKTtcbiAgICAgICAgY29uc3Qgc3ggPSBzY2FsZS54O1xuICAgICAgICBjb25zdCBzeSA9IHNjYWxlLnk7XG4gICAgICAgIGNvbnN0IHN6ID0gc2NhbGUuejtcblxuICAgICAgICBpZiAoc3ggPT09IDAgfHwgc3kgPT09IDAgfHwgc3ogPT09IDApXG4gICAgICAgICAgICByZXR1cm4gZXVsZXJzLnNldCgwLCAwLCAwKTtcblxuICAgICAgICBjb25zdCBtID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIGNvbnN0IHkgPSBNYXRoLmFzaW4oLW1bMl0gLyBzeCk7XG4gICAgICAgIGNvbnN0IGhhbGZQaSA9IE1hdGguUEkgKiAwLjU7XG5cbiAgICAgICAgbGV0IHgsIHo7XG5cbiAgICAgICAgaWYgKHkgPCBoYWxmUGkpIHtcbiAgICAgICAgICAgIGlmICh5ID4gLWhhbGZQaSkge1xuICAgICAgICAgICAgICAgIHggPSBNYXRoLmF0YW4yKG1bNl0gLyBzeSwgbVsxMF0gLyBzeik7XG4gICAgICAgICAgICAgICAgeiA9IE1hdGguYXRhbjIobVsxXSAvIHN4LCBtWzBdIC8gc3gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBOb3QgYSB1bmlxdWUgc29sdXRpb25cbiAgICAgICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgICAgICAgICB4ID0gLU1hdGguYXRhbjIobVs0XSAvIHN5LCBtWzVdIC8gc3kpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gTm90IGEgdW5pcXVlIHNvbHV0aW9uXG4gICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgICAgIHggPSBNYXRoLmF0YW4yKG1bNF0gLyBzeSwgbVs1XSAvIHN5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBldWxlcnMuc2V0KHgsIHksIHopLm11bFNjYWxhcihtYXRoLlJBRF9UT19ERUcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSBzcGVjaWZpZWQgbWF0cml4IHRvIHN0cmluZyBmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIG1hdHJpeCBpbiBzdHJpbmcgZm9ybS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBtID0gbmV3IHBjLk1hdDQoKTtcbiAgICAgKiAvLyBPdXRwdXRzIFsxLCAwLCAwLCAwLCAwLCAxLCAwLCAwLCAwLCAwLCAxLCAwLCAwLCAwLCAwLCAxXVxuICAgICAqIGNvbnNvbGUubG9nKG0udG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiAnWycgKyB0aGlzLmRhdGEuam9pbignLCAnKSArICddJztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IG1hdHJpeCBzZXQgdG8gdGhlIGlkZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIElERU5USVRZID0gT2JqZWN0LmZyZWV6ZShuZXcgTWF0NCgpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgbWF0cml4IHdpdGggYWxsIGVsZW1lbnRzIHNldCB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge01hdDR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFpFUk8gPSBPYmplY3QuZnJlZXplKG5ldyBNYXQ0KCkuc2V0KFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSkpO1xufVxuXG5leHBvcnQgeyBNYXQ0IH07XG4iXSwibmFtZXMiOlsiX2hhbGZTaXplIiwiVmVjMiIsIngiLCJWZWMzIiwieSIsInoiLCJzY2FsZSIsIk1hdDQiLCJjb25zdHJ1Y3RvciIsImRhdGEiLCJGbG9hdDMyQXJyYXkiLCJfZ2V0UGVyc3BlY3RpdmVIYWxmU2l6ZSIsImhhbGZTaXplIiwiZm92IiwiYXNwZWN0Iiwiem5lYXIiLCJmb3ZJc0hvcml6b250YWwiLCJNYXRoIiwidGFuIiwiUEkiLCJhZGQyIiwibGhzIiwicmhzIiwiYSIsImIiLCJyIiwiYWRkIiwiY2xvbmUiLCJjc3RyIiwiY29weSIsInNyYyIsImRzdCIsImVxdWFscyIsImwiLCJpc0lkZW50aXR5IiwibSIsIm11bDIiLCJhMDAiLCJhMDEiLCJhMDIiLCJhMDMiLCJhMTAiLCJhMTEiLCJhMTIiLCJhMTMiLCJhMjAiLCJhMjEiLCJhMjIiLCJhMjMiLCJhMzAiLCJhMzEiLCJhMzIiLCJhMzMiLCJiMCIsImIxIiwiYjIiLCJiMyIsIm11bEFmZmluZTIiLCJtdWwiLCJ0cmFuc2Zvcm1Qb2ludCIsInZlYyIsInJlcyIsInRyYW5zZm9ybVZlY3RvciIsInRyYW5zZm9ybVZlYzQiLCJWZWM0IiwidyIsInNldExvb2tBdCIsInBvc2l0aW9uIiwidGFyZ2V0IiwidXAiLCJzdWIyIiwibm9ybWFsaXplIiwiY3Jvc3MiLCJzZXRGcnVzdHVtIiwibGVmdCIsInJpZ2h0IiwiYm90dG9tIiwidG9wIiwiemZhciIsInRlbXAxIiwidGVtcDIiLCJ0ZW1wMyIsInRlbXA0Iiwic2V0UGVyc3BlY3RpdmUiLCJzZXRPcnRobyIsIm5lYXIiLCJmYXIiLCJzZXRGcm9tQXhpc0FuZ2xlIiwiYXhpcyIsImFuZ2xlIiwibWF0aCIsIkRFR19UT19SQUQiLCJjIiwiY29zIiwicyIsInNpbiIsInQiLCJ0eCIsInR5Iiwic2V0VHJhbnNsYXRlIiwic2V0U2NhbGUiLCJzZXRWaWV3cG9ydCIsIndpZHRoIiwiaGVpZ2h0IiwiaW52ZXJ0IiwiYjAwIiwiYjAxIiwiYjAyIiwiYjAzIiwiYjA0IiwiYjA1IiwiYjA2IiwiYjA3IiwiYjA4IiwiYjA5IiwiYjEwIiwiYjExIiwiZGV0Iiwic2V0SWRlbnRpdHkiLCJpbnZEZXQiLCJzZXQiLCJzZXRUUlMiLCJxeCIsInF5IiwicXoiLCJxdyIsInN4Iiwic3kiLCJzeiIsIngyIiwieTIiLCJ6MiIsInh4IiwieHkiLCJ4eiIsInl5IiwieXoiLCJ6eiIsInd4Iiwid3kiLCJ3eiIsInRyYW5zcG9zZSIsInRtcCIsImludmVydFRvM3gzIiwibTAiLCJtMSIsIm0yIiwibTQiLCJtNSIsIm02IiwibTgiLCJtOSIsIm0xMCIsImlkZXQiLCJnZXRUcmFuc2xhdGlvbiIsImdldFgiLCJnZXRZIiwiZ2V0WiIsImdldFNjYWxlIiwibGVuZ3RoIiwic2V0RnJvbUV1bGVyQW5nbGVzIiwiZXgiLCJleSIsImV6IiwiczEiLCJjMSIsInMyIiwiYzIiLCJzMyIsImMzIiwiZ2V0RXVsZXJBbmdsZXMiLCJldWxlcnMiLCJhc2luIiwiaGFsZlBpIiwiYXRhbjIiLCJtdWxTY2FsYXIiLCJSQURfVE9fREVHIiwidG9TdHJpbmciLCJqb2luIiwiSURFTlRJVFkiLCJPYmplY3QiLCJmcmVlemUiLCJaRVJPIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBT0EsTUFBTUEsU0FBUyxHQUFHLElBQUlDLElBQUosRUFBbEIsQ0FBQTs7QUFDQSxNQUFNQyxDQUFDLEdBQUcsSUFBSUMsSUFBSixFQUFWLENBQUE7QUFDQSxNQUFNQyxDQUFDLEdBQUcsSUFBSUQsSUFBSixFQUFWLENBQUE7QUFDQSxNQUFNRSxDQUFDLEdBQUcsSUFBSUYsSUFBSixFQUFWLENBQUE7QUFDQSxNQUFNRyxLQUFLLEdBQUcsSUFBSUgsSUFBSixFQUFkLENBQUE7O0FBTUEsTUFBTUksSUFBTixDQUFXO0FBSVBDLEVBQUFBLFdBQVcsR0FBRztBQUdWLElBQUEsTUFBTUMsSUFBSSxHQUFHLElBQUlDLFlBQUosQ0FBaUIsRUFBakIsQ0FBYixDQUFBO0FBQ0FELElBQUFBLElBQUksQ0FBQyxDQUFELENBQUosR0FBVUEsSUFBSSxDQUFDLENBQUQsQ0FBSixHQUFVQSxJQUFJLENBQUMsRUFBRCxDQUFKLEdBQVdBLElBQUksQ0FBQyxFQUFELENBQUosR0FBVyxDQUExQyxDQUFBO0lBT0EsSUFBS0EsQ0FBQUEsSUFBTCxHQUFZQSxJQUFaLENBQUE7QUFDSCxHQUFBOztFQUc2QixPQUF2QkUsdUJBQXVCLENBQUNDLFFBQUQsRUFBV0MsR0FBWCxFQUFnQkMsTUFBaEIsRUFBd0JDLEtBQXhCLEVBQStCQyxlQUEvQixFQUFnRDtBQUMxRSxJQUFBLElBQUlBLGVBQUosRUFBcUI7QUFDakJKLE1BQUFBLFFBQVEsQ0FBQ1YsQ0FBVCxHQUFhYSxLQUFLLEdBQUdFLElBQUksQ0FBQ0MsR0FBTCxDQUFTTCxHQUFHLEdBQUdJLElBQUksQ0FBQ0UsRUFBWCxHQUFnQixHQUF6QixDQUFyQixDQUFBO0FBQ0FQLE1BQUFBLFFBQVEsQ0FBQ1IsQ0FBVCxHQUFhUSxRQUFRLENBQUNWLENBQVQsR0FBYVksTUFBMUIsQ0FBQTtBQUNILEtBSEQsTUFHTztBQUNIRixNQUFBQSxRQUFRLENBQUNSLENBQVQsR0FBYVcsS0FBSyxHQUFHRSxJQUFJLENBQUNDLEdBQUwsQ0FBU0wsR0FBRyxHQUFHSSxJQUFJLENBQUNFLEVBQVgsR0FBZ0IsR0FBekIsQ0FBckIsQ0FBQTtBQUNBUCxNQUFBQSxRQUFRLENBQUNWLENBQVQsR0FBYVUsUUFBUSxDQUFDUixDQUFULEdBQWFVLE1BQTFCLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7QUFlRE0sRUFBQUEsSUFBSSxDQUFDQyxHQUFELEVBQU1DLEdBQU4sRUFBVztBQUNYLElBQUEsTUFBTUMsQ0FBQyxHQUFHRixHQUFHLENBQUNaLElBQWQ7QUFBQSxVQUNJZSxDQUFDLEdBQUdGLEdBQUcsQ0FBQ2IsSUFEWjtVQUVJZ0IsQ0FBQyxHQUFHLElBQUEsQ0FBS2hCLElBRmIsQ0FBQTtBQUlBZ0IsSUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRixDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQWYsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9GLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBZixDQUFBO0FBQ0FDLElBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0YsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFmLENBQUE7QUFDQUMsSUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRixDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQWYsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9GLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBZixDQUFBO0FBQ0FDLElBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0YsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFmLENBQUE7QUFDQUMsSUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRixDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQWYsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9GLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0MsQ0FBQyxDQUFDLENBQUQsQ0FBZixDQUFBO0FBQ0FDLElBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBT0YsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPQyxDQUFDLENBQUMsQ0FBRCxDQUFmLENBQUE7QUFDQUMsSUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPRixDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU9DLENBQUMsQ0FBQyxDQUFELENBQWYsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFGLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FBakIsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFGLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FBakIsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFGLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FBakIsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFGLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FBakIsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFGLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FBakIsQ0FBQTtBQUNBQyxJQUFBQSxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVFGLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUUMsQ0FBQyxDQUFDLEVBQUQsQ0FBakIsQ0FBQTtBQUVBLElBQUEsT0FBTyxJQUFQLENBQUE7QUFDSCxHQUFBOztFQWNERSxHQUFHLENBQUNKLEdBQUQsRUFBTTtBQUNMLElBQUEsT0FBTyxLQUFLRixJQUFMLENBQVUsSUFBVixFQUFnQkUsR0FBaEIsQ0FBUCxDQUFBO0FBQ0gsR0FBQTs7QUFXREssRUFBQUEsS0FBSyxHQUFHO0lBRUosTUFBTUMsSUFBSSxHQUFHLElBQUEsQ0FBS3BCLFdBQWxCLENBQUE7QUFDQSxJQUFBLE9BQU8sSUFBSW9CLElBQUosRUFBQSxDQUFXQyxJQUFYLENBQWdCLElBQWhCLENBQVAsQ0FBQTtBQUNILEdBQUE7O0VBYURBLElBQUksQ0FBQ1AsR0FBRCxFQUFNO0FBQ04sSUFBQSxNQUFNUSxHQUFHLEdBQUdSLEdBQUcsQ0FBQ2IsSUFBaEI7VUFDSXNCLEdBQUcsR0FBRyxJQUFBLENBQUt0QixJQURmLENBQUE7QUFHQXNCLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixD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QXNCLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxDQUFELENBQUgsR0FBU0QsR0FBRyxDQUFDLENBQUQsQ0FBWixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBQ0FDLElBQUFBLEdBQUcsQ0FBQyxFQUFELENBQUgsR0FBVUQsR0FBRyxDQUFDLEVBQUQsQ0FBYixDQUFBO0FBRUEsSUFBQSxPQUFPLElBQVAsQ0FBQTtBQUNILEdBQUE7O0FBVUR3RixFQUFBQSxXQUFXLEdBQUc7SUFDVixNQUFNbkYsQ0FBQyxHQUFHLElBQUEsQ0FBSzFCLElBQWYsQ0FBQTtBQUVBMEIsSUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPLENBQVAsQ0FBQTtBQUNBQSxJQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU8sQ0FBUCxDQUFBO0FBQ0FBLElBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBTyxDQUFQLENBQUE7QUFDQUEsSUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPLENBQVAsQ0FBQTtBQUNBQSxJQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU8sQ0FBUCxDQUFBO0FBQ0FBLElBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBTyxDQUFQLENBQUE7QUFDQUEsSUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPLENBQVAsQ0FBQTtBQUNBQSxJQUFBQSxDQUFDLENBQUMsQ0FBRCxDQUFELEdBQU8sQ0FBUCxDQUFBO0FBQ0FBLElBQUFBLENBQUMsQ0FBQyxDQUFELENBQUQsR0FBTyxDQUFQLENBQUE7QUFDQUEsSUFBQUEsQ0FBQyxDQUFDLENBQUQsQ0FBRCxHQUFPLENBQVAsQ0FBQTtBQUNBQSxJQUFBQSxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVEsQ0FBUixDQUFBO0FBQ0FBLElBQUFBLENBQUMsQ0FBQyxFQUFELENBQUQsR0FBUSxDQUFSLENBQUE7QUFDQUEsSUFBQUEsQ0FBQyxDQUFDLEVBQUQsQ0FBRCxHQUFRLENBQVIsQ0FBQTtBQUNBQSxJQUFBQSxDQUFDLENBQUMsRUFBRCxDQUFELEdBQVEsQ0FBUixDQUFBO0FBQ0FBLElBQUFBLENBQUMsQ0FBQyxFQUFELENBQUQs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
