/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { math } from './math.js';
import { Vec3 } from './vec3.js';

class Quat {
  constructor(x = 0, y = 0, z = 0, w = 1) {
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

  clone() {
    const cstr = this.constructor;
    return new cstr(this.x, this.y, this.z, this.w);
  }

  conjugate() {
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    return this;
  }

  copy(rhs) {
    this.x = rhs.x;
    this.y = rhs.y;
    this.z = rhs.z;
    this.w = rhs.w;
    return this;
  }

  equals(rhs) {
    return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
  }

  getAxisAngle(axis) {
    let rad = Math.acos(this.w) * 2;
    const s = Math.sin(rad / 2);

    if (s !== 0) {
      axis.x = this.x / s;
      axis.y = this.y / s;
      axis.z = this.z / s;

      if (axis.x < 0 || axis.y < 0 || axis.z < 0) {
        axis.x *= -1;
        axis.y *= -1;
        axis.z *= -1;
        rad *= -1;
      }
    } else {
      axis.x = 1;
      axis.y = 0;
      axis.z = 0;
    }

    return rad * math.RAD_TO_DEG;
  }

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

  invert() {
    return this.conjugate().normalize();
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

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

  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

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

  setFromMat4(m) {
    let m00, m01, m02, m10, m11, m12, m20, m21, m22, s, rs, lx, ly, lz;
    m = m.data;
    m00 = m[0];
    m01 = m[1];
    m02 = m[2];
    m10 = m[4];
    m11 = m[5];
    m12 = m[6];
    m20 = m[8];
    m21 = m[9];
    m22 = m[10];
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
          rs = m00 - (m11 + m22) + 1;
          rs = Math.sqrt(rs);
          this.x = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m12 - m21) * rs;
          this.y = (m01 + m10) * rs;
          this.z = (m02 + m20) * rs;
        } else {
          rs = m22 - (m00 + m11) + 1;
          rs = Math.sqrt(rs);
          this.z = rs * 0.5;
          rs = 0.5 / rs;
          this.w = (m01 - m10) * rs;
          this.x = (m20 + m02) * rs;
          this.y = (m21 + m12) * rs;
        }
      } else if (m11 > m22) {
        rs = m11 - (m22 + m00) + 1;
        rs = Math.sqrt(rs);
        this.y = rs * 0.5;
        rs = 0.5 / rs;
        this.w = (m20 - m02) * rs;
        this.z = (m12 + m21) * rs;
        this.x = (m10 + m01) * rs;
      } else {
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

  slerp(lhs, rhs, alpha) {
    const lx = lhs.x;
    const ly = lhs.y;
    const lz = lhs.z;
    const lw = lhs.w;
    let rx = rhs.x;
    let ry = rhs.y;
    let rz = rhs.z;
    let rw = rhs.w;
    let cosHalfTheta = lw * rw + lx * rx + ly * ry + lz * rz;

    if (cosHalfTheta < 0) {
      rw = -rw;
      rx = -rx;
      ry = -ry;
      rz = -rz;
      cosHalfTheta = -cosHalfTheta;
    }

    if (Math.abs(cosHalfTheta) >= 1) {
      this.w = lw;
      this.x = lx;
      this.y = ly;
      this.z = lz;
      return this;
    }

    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);

    if (Math.abs(sinHalfTheta) < 0.001) {
      this.w = lw * 0.5 + rw * 0.5;
      this.x = lx * 0.5 + rx * 0.5;
      this.y = ly * 0.5 + ry * 0.5;
      this.z = lz * 0.5 + rz * 0.5;
      return this;
    }

    const ratioA = Math.sin((1 - alpha) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(alpha * halfTheta) / sinHalfTheta;
    this.w = lw * ratioA + rw * ratioB;
    this.x = lx * ratioA + rx * ratioB;
    this.y = ly * ratioA + ry * ratioB;
    this.z = lz * ratioA + rz * ratioB;
    return this;
  }

  transformVector(vec, res = new Vec3()) {
    const x = vec.x,
          y = vec.y,
          z = vec.z;
    const qx = this.x,
          qy = this.y,
          qz = this.z,
          qw = this.w;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    res.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    res.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    res.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return res;
  }

  toString() {
    return `[${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
  }

}

Quat.IDENTITY = Object.freeze(new Quat(0, 0, 0, 1));
Quat.ZERO = Object.freeze(new Quat(0, 0, 0, 0));

export { Quat };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVhdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL21hdGgvcXVhdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi9tYXRoLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuL3ZlYzMuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9tYXQ0LmpzJykuTWF0NH0gTWF0NCAqL1xuXG4vKipcbiAqIEEgcXVhdGVybmlvbi5cbiAqL1xuY2xhc3MgUXVhdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFF1YXQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxudW1iZXJbXX0gW3hdIC0gVGhlIHF1YXRlcm5pb24ncyB4IGNvbXBvbmVudC4gRGVmYXVsdHMgdG8gMC4gSWYgeCBpcyBhbiBhcnJheVxuICAgICAqIG9mIGxlbmd0aCA0LCB0aGUgYXJyYXkgd2lsbCBiZSB1c2VkIHRvIHBvcHVsYXRlIGFsbCBjb21wb25lbnRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbeV0gLSBUaGUgcXVhdGVybmlvbidzIHkgY29tcG9uZW50LiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbel0gLSBUaGUgcXVhdGVybmlvbidzIHogY29tcG9uZW50LiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd10gLSBUaGUgcXVhdGVybmlvbidzIHcgY29tcG9uZW50LiBEZWZhdWx0cyB0byAxLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHggPSAwLCB5ID0gMCwgeiA9IDAsIHcgPSAxKSB7XG4gICAgICAgIGlmICh4Lmxlbmd0aCA9PT0gNCkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgeCBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy54ID0geFswXTtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHkgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMueSA9IHhbMV07XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSB6IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLnogPSB4WzJdO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgdyBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy53ID0geFszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICAgICAgdGhpcy56ID0gejtcbiAgICAgICAgICAgIHRoaXMudyA9IHc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIGlkZW50aWNhbCBjb3B5IG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHt0aGlzfSBBIHF1YXRlcm5pb24gY29udGFpbmluZyB0aGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgtMC4xMSwgLTAuMTUsIC0wLjQ2LCAwLjg3KTtcbiAgICAgKiB2YXIgcWNsb25lID0gcS5jbG9uZSgpO1xuICAgICAqXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSBjbG9uaW5nIGlzOiBcIiArIHEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIC8qKiBAdHlwZSB7dGhpc30gKi9cbiAgICAgICAgY29uc3QgY3N0ciA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgICAgIHJldHVybiBuZXcgY3N0cih0aGlzLngsIHRoaXMueSwgdGhpcy56LCB0aGlzLncpO1xuICAgIH1cblxuICAgIGNvbmp1Z2F0ZSgpIHtcbiAgICAgICAgdGhpcy54ICo9IC0xO1xuICAgICAgICB0aGlzLnkgKj0gLTE7XG4gICAgICAgIHRoaXMueiAqPSAtMTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIHF1YXRlcm5pb24gdG8gYSBkZXN0aW5hdGlvbiBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSByaHMgLSBUaGUgcXVhdGVybmlvbiB0byBiZSBjb3BpZWQuXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHNyYyA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogdmFyIGRzdCA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogZHN0LmNvcHkoc3JjLCBzcmMpO1xuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHR3byBxdWF0ZXJuaW9ucyBhcmUgXCIgKyAoc3JjLmVxdWFscyhkc3QpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGNvcHkocmhzKSB7XG4gICAgICAgIHRoaXMueCA9IHJocy54O1xuICAgICAgICB0aGlzLnkgPSByaHMueTtcbiAgICAgICAgdGhpcy56ID0gcmhzLno7XG4gICAgICAgIHRoaXMudyA9IHJocy53O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciB0d28gcXVhdGVybmlvbnMgYXJlIGVxdWFsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSByaHMgLSBUaGUgcXVhdGVybmlvbiB0byBiZSBjb21wYXJlZCBhZ2FpbnN0LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBxdWF0ZXJuaW9ucyBhcmUgZXF1YWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHF1YXRlcm5pb25zIGFyZSBcIiArIChhLmVxdWFscyhiKSA/IFwiZXF1YWxcIiA6IFwiZGlmZmVyZW50XCIpKTtcbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiAoKHRoaXMueCA9PT0gcmhzLngpICYmICh0aGlzLnkgPT09IHJocy55KSAmJiAodGhpcy56ID09PSByaHMueikgJiYgKHRoaXMudyA9PT0gcmhzLncpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSByb3RhdGlvbiBheGlzIGFuZCBhbmdsZSBmb3IgYSBnaXZlbiBxdWF0ZXJuaW9uLiBJZiBhIHF1YXRlcm5pb24gaXMgY3JlYXRlZCB3aXRoXG4gICAgICogYHNldEZyb21BeGlzQW5nbGVgLCB0aGlzIG1ldGhvZCB3aWxsIHJldHVybiB0aGUgc2FtZSB2YWx1ZXMgYXMgcHJvdmlkZWQgaW4gdGhlIG9yaWdpbmFsXG4gICAgICogcGFyYW1ldGVyIGxpc3QgT1IgZnVuY3Rpb25hbGx5IGVxdWl2YWxlbnQgdmFsdWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIGF4aXMgb2Ygcm90YXRpb24uXG4gICAgICogQHJldHVybnMge251bWJlcn0gQW5nbGUsIGluIGRlZ3JlZXMsIG9mIHRoZSByb3RhdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldEZyb21BeGlzQW5nbGUobmV3IHBjLlZlYzMoMCwgMSwgMCksIDkwKTtcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogdmFyIGFuZ2xlID0gcS5nZXRBeGlzQW5nbGUodik7XG4gICAgICogLy8gT3V0cHV0cyA5MFxuICAgICAqIGNvbnNvbGUubG9nKGFuZ2xlKTtcbiAgICAgKiAvLyBPdXRwdXRzIFswLCAxLCAwXVxuICAgICAqIGNvbnNvbGUubG9nKHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgZ2V0QXhpc0FuZ2xlKGF4aXMpIHtcbiAgICAgICAgbGV0IHJhZCA9IE1hdGguYWNvcyh0aGlzLncpICogMjtcbiAgICAgICAgY29uc3QgcyA9IE1hdGguc2luKHJhZCAvIDIpO1xuICAgICAgICBpZiAocyAhPT0gMCkge1xuICAgICAgICAgICAgYXhpcy54ID0gdGhpcy54IC8gcztcbiAgICAgICAgICAgIGF4aXMueSA9IHRoaXMueSAvIHM7XG4gICAgICAgICAgICBheGlzLnogPSB0aGlzLnogLyBzO1xuICAgICAgICAgICAgaWYgKGF4aXMueCA8IDAgfHwgYXhpcy55IDwgMCB8fCBheGlzLnogPCAwKSB7XG4gICAgICAgICAgICAgICAgLy8gRmxpcCB0aGUgc2lnblxuICAgICAgICAgICAgICAgIGF4aXMueCAqPSAtMTtcbiAgICAgICAgICAgICAgICBheGlzLnkgKj0gLTE7XG4gICAgICAgICAgICAgICAgYXhpcy56ICo9IC0xO1xuICAgICAgICAgICAgICAgIHJhZCAqPSAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIElmIHMgaXMgemVybywgcmV0dXJuIGFueSBheGlzIChubyByb3RhdGlvbiAtIGF4aXMgZG9lcyBub3QgbWF0dGVyKVxuICAgICAgICAgICAgYXhpcy54ID0gMTtcbiAgICAgICAgICAgIGF4aXMueSA9IDA7XG4gICAgICAgICAgICBheGlzLnogPSAwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByYWQgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHN1cHBsaWVkIHF1YXRlcm5pb24gdG8gRXVsZXIgYW5nbGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbZXVsZXJzXSAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSBFdWxlciBhbmdsZXMuXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciBob2xkaW5nIHRoZSBFdWxlciBhbmdsZXMgdGhhdFxuICAgICAqIGNvcnJlc3BvbmQgdG8gdGhlIHN1cHBsaWVkIHF1YXRlcm5pb24uXG4gICAgICovXG4gICAgZ2V0RXVsZXJBbmdsZXMoZXVsZXJzID0gbmV3IFZlYzMoKSkge1xuICAgICAgICBsZXQgeCwgeSwgejtcblxuICAgICAgICBjb25zdCBxeCA9IHRoaXMueDtcbiAgICAgICAgY29uc3QgcXkgPSB0aGlzLnk7XG4gICAgICAgIGNvbnN0IHF6ID0gdGhpcy56O1xuICAgICAgICBjb25zdCBxdyA9IHRoaXMudztcblxuICAgICAgICBjb25zdCBhMiA9IDIgKiAocXcgKiBxeSAtIHF4ICogcXopO1xuXG4gICAgICAgIGlmIChhMiA8PSAtMC45OTk5OSkge1xuICAgICAgICAgICAgeCA9IDIgKiBNYXRoLmF0YW4yKHF4LCBxdyk7XG4gICAgICAgICAgICB5ID0gLU1hdGguUEkgLyAyO1xuICAgICAgICAgICAgeiA9IDA7XG4gICAgICAgIH0gZWxzZSBpZiAoYTIgPj0gMC45OTk5OSkge1xuICAgICAgICAgICAgeCA9IDIgKiBNYXRoLmF0YW4yKHF4LCBxdyk7XG4gICAgICAgICAgICB5ID0gTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHggPSBNYXRoLmF0YW4yKDIgKiAocXcgKiBxeCArIHF5ICogcXopLCAxIC0gMiAqIChxeCAqIHF4ICsgcXkgKiBxeSkpO1xuICAgICAgICAgICAgeSA9IE1hdGguYXNpbihhMik7XG4gICAgICAgICAgICB6ID0gTWF0aC5hdGFuMigyICogKHF3ICogcXogKyBxeCAqIHF5KSwgMSAtIDIgKiAocXkgKiBxeSArIHF6ICogcXopKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBldWxlcnMuc2V0KHgsIHksIHopLm11bFNjYWxhcihtYXRoLlJBRF9UT19ERUcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlcyB0aGUgaW52ZXJzZSBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBxdWF0ZXJuaW9uIHJvdGF0ZWQgMTgwIGRlZ3JlZXMgYXJvdW5kIHRoZSB5LWF4aXNcbiAgICAgKiB2YXIgcm90ID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgMTgwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIEludmVydCBpbiBwbGFjZVxuICAgICAqIHJvdC5pbnZlcnQoKTtcbiAgICAgKi9cbiAgICBpbnZlcnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbmp1Z2F0ZSgpLm5vcm1hbGl6ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoMCwgMCwgMCwgNSk7XG4gICAgICogdmFyIGxlbiA9IHEubGVuZ3RoKCk7XG4gICAgICogLy8gT3V0cHV0cyA1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIG9mIHRoZSBxdWF0ZXJuaW9uIGlzOiBcIiArIGxlbik7XG4gICAgICovXG4gICAgbGVuZ3RoKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMueCAqIHRoaXMueCArIHRoaXMueSAqIHRoaXMueSArIHRoaXMueiAqIHRoaXMueiArIHRoaXMudyAqIHRoaXMudyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIHNxdWFyZWQgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG1hZ25pdHVkZSBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KDMsIDQsIDApO1xuICAgICAqIHZhciBsZW5TcSA9IHEubGVuZ3RoU3EoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDI1XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgbGVuZ3RoIHNxdWFyZWQgb2YgdGhlIHF1YXRlcm5pb24gaXM6IFwiICsgbGVuU3EpO1xuICAgICAqL1xuICAgIGxlbmd0aFNxKCkge1xuICAgICAgICByZXR1cm4gdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBtdWx0aXBseWluZyB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb25zIHRvZ2V0aGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSByaHMgLSBUaGUgcXVhdGVybmlvbiB1c2VkIGFzIHRoZSBzZWNvbmQgbXVsdGlwbGljYW5kIG9mIHRoZSBvcGVyYXRpb24uXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAzMCwgMCk7XG4gICAgICogdmFyIGIgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCA2MCwgMCk7XG4gICAgICpcbiAgICAgKiAvLyBhIGJlY29tZXMgYSA5MCBkZWdyZWUgcm90YXRpb24gYXJvdW5kIHRoZSBZIGF4aXNcbiAgICAgKiAvLyBJbiBvdGhlciB3b3JkcywgYSA9IGEgKiBiXG4gICAgICogYS5tdWwoYik7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIGEudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsKHJocykge1xuICAgICAgICBjb25zdCBxMXggPSB0aGlzLng7XG4gICAgICAgIGNvbnN0IHExeSA9IHRoaXMueTtcbiAgICAgICAgY29uc3QgcTF6ID0gdGhpcy56O1xuICAgICAgICBjb25zdCBxMXcgPSB0aGlzLnc7XG5cbiAgICAgICAgY29uc3QgcTJ4ID0gcmhzLng7XG4gICAgICAgIGNvbnN0IHEyeSA9IHJocy55O1xuICAgICAgICBjb25zdCBxMnogPSByaHMuejtcbiAgICAgICAgY29uc3QgcTJ3ID0gcmhzLnc7XG5cbiAgICAgICAgdGhpcy54ID0gcTF3ICogcTJ4ICsgcTF4ICogcTJ3ICsgcTF5ICogcTJ6IC0gcTF6ICogcTJ5O1xuICAgICAgICB0aGlzLnkgPSBxMXcgKiBxMnkgKyBxMXkgKiBxMncgKyBxMXogKiBxMnggLSBxMXggKiBxMno7XG4gICAgICAgIHRoaXMueiA9IHExdyAqIHEyeiArIHExeiAqIHEydyArIHExeCAqIHEyeSAtIHExeSAqIHEyeDtcbiAgICAgICAgdGhpcy53ID0gcTF3ICogcTJ3IC0gcTF4ICogcTJ4IC0gcTF5ICogcTJ5IC0gcTF6ICogcTJ6O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHJlc3VsdCBvZiBtdWx0aXBseWluZyB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb25zIHRvZ2V0aGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSBsaHMgLSBUaGUgcXVhdGVybmlvbiB1c2VkIGFzIHRoZSBmaXJzdCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDMwLCAwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICpcbiAgICAgKiAvLyByIGlzIHNldCB0byBhIDkwIGRlZ3JlZSByb3RhdGlvbiBhcm91bmQgdGhlIFkgYXhpc1xuICAgICAqIC8vIEluIG90aGVyIHdvcmRzLCByID0gYSAqIGJcbiAgICAgKiByLm11bDIoYSwgYik7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIG11bHRpcGxpY2F0aW9uIGlzOiBcIiArIHIudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgbXVsMihsaHMsIHJocykge1xuICAgICAgICBjb25zdCBxMXggPSBsaHMueDtcbiAgICAgICAgY29uc3QgcTF5ID0gbGhzLnk7XG4gICAgICAgIGNvbnN0IHExeiA9IGxocy56O1xuICAgICAgICBjb25zdCBxMXcgPSBsaHMudztcblxuICAgICAgICBjb25zdCBxMnggPSByaHMueDtcbiAgICAgICAgY29uc3QgcTJ5ID0gcmhzLnk7XG4gICAgICAgIGNvbnN0IHEyeiA9IHJocy56O1xuICAgICAgICBjb25zdCBxMncgPSByaHMudztcblxuICAgICAgICB0aGlzLnggPSBxMXcgKiBxMnggKyBxMXggKiBxMncgKyBxMXkgKiBxMnogLSBxMXogKiBxMnk7XG4gICAgICAgIHRoaXMueSA9IHExdyAqIHEyeSArIHExeSAqIHEydyArIHExeiAqIHEyeCAtIHExeCAqIHEyejtcbiAgICAgICAgdGhpcy56ID0gcTF3ICogcTJ6ICsgcTF6ICogcTJ3ICsgcTF4ICogcTJ5IC0gcTF5ICogcTJ4O1xuICAgICAgICB0aGlzLncgPSBxMXcgKiBxMncgLSBxMXggKiBxMnggLSBxMXkgKiBxMnkgLSBxMXogKiBxMno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24gY29udmVydGVkIGluIHBsYWNlIHRvIGEgdW5pdCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1F1YXR9IFRoZSByZXN1bHQgb2YgdGhlIG5vcm1hbGl6YXRpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5RdWF0KDAsIDAsIDAsIDUpO1xuICAgICAqXG4gICAgICogdi5ub3JtYWxpemUoKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMCwgMCwgMCwgMVxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIG5vcm1hbGl6YXRpb24gaXM6IFwiICsgdi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBub3JtYWxpemUoKSB7XG4gICAgICAgIGxldCBsZW4gPSB0aGlzLmxlbmd0aCgpO1xuICAgICAgICBpZiAobGVuID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnggPSB0aGlzLnkgPSB0aGlzLnogPSAwO1xuICAgICAgICAgICAgdGhpcy53ID0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxlbiA9IDEgLyBsZW47XG4gICAgICAgICAgICB0aGlzLnggKj0gbGVuO1xuICAgICAgICAgICAgdGhpcy55ICo9IGxlbjtcbiAgICAgICAgICAgIHRoaXMueiAqPSBsZW47XG4gICAgICAgICAgICB0aGlzLncgKj0gbGVuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24gdG8gdGhlIHN1cHBsaWVkIG51bWVyaWNhbCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB6IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXQoMSwgMCwgMCwgMCk7XG4gICAgICpcbiAgICAgKiAvLyBPdXRwdXRzIDEsIDAsIDAsIDBcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIHZlY3RvciBzZXQgaXM6IFwiICsgcS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBzZXQoeCwgeSwgeiwgdykge1xuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICB0aGlzLncgPSB3O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYSBxdWF0ZXJuaW9uIGZyb20gYW4gYW5ndWxhciByb3RhdGlvbiBhcm91bmQgYW4gYXhpcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gYXhpcyAtIFdvcmxkIHNwYWNlIGF4aXMgYXJvdW5kIHdoaWNoIHRvIHJvdGF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYW5nbGUgLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIHRoZSBnaXZlbiBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHEuc2V0RnJvbUF4aXNBbmdsZShwYy5WZWMzLlVQLCA5MCk7XG4gICAgICovXG4gICAgc2V0RnJvbUF4aXNBbmdsZShheGlzLCBhbmdsZSkge1xuICAgICAgICBhbmdsZSAqPSAwLjUgKiBtYXRoLkRFR19UT19SQUQ7XG5cbiAgICAgICAgY29uc3Qgc2EgPSBNYXRoLnNpbihhbmdsZSk7XG4gICAgICAgIGNvbnN0IGNhID0gTWF0aC5jb3MoYW5nbGUpO1xuXG4gICAgICAgIHRoaXMueCA9IHNhICogYXhpcy54O1xuICAgICAgICB0aGlzLnkgPSBzYSAqIGF4aXMueTtcbiAgICAgICAgdGhpcy56ID0gc2EgKiBheGlzLno7XG4gICAgICAgIHRoaXMudyA9IGNhO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYSBxdWF0ZXJuaW9uIGZyb20gRXVsZXIgYW5nbGVzIHNwZWNpZmllZCBpbiBYWVogb3JkZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxWZWMzfSBleCAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWCBheGlzIGluIGRlZ3JlZXMuIElmIGV4IGlzIGEgVmVjMywgdGhlXG4gICAgICogdGhyZWUgYW5nbGVzIHdpbGwgYmUgcmVhZCBmcm9tIGl0IGluc3RlYWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtleV0gLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFkgYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZXpdIC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBaIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBxdWF0ZXJuaW9uIGZyb20gMyBldWxlciBhbmdsZXNcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXRGcm9tRXVsZXJBbmdsZXMoNDUsIDkwLCAxODApO1xuICAgICAqXG4gICAgICogLy8gQ3JlYXRlIHRoZSBzYW1lIHF1YXRlcm5pb24gZnJvbSBhIHZlY3RvciBjb250YWluaW5nIHRoZSBzYW1lIDMgZXVsZXIgYW5nbGVzXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMyg0NSwgOTAsIDE4MCk7XG4gICAgICogdmFyIHIgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHIuc2V0RnJvbUV1bGVyQW5nbGVzKHYpO1xuICAgICAqL1xuICAgIHNldEZyb21FdWxlckFuZ2xlcyhleCwgZXksIGV6KSB7XG4gICAgICAgIGlmIChleCBpbnN0YW5jZW9mIFZlYzMpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlYyA9IGV4O1xuICAgICAgICAgICAgZXggPSB2ZWMueDtcbiAgICAgICAgICAgIGV5ID0gdmVjLnk7XG4gICAgICAgICAgICBleiA9IHZlYy56O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaGFsZlRvUmFkID0gMC41ICogbWF0aC5ERUdfVE9fUkFEO1xuICAgICAgICBleCAqPSBoYWxmVG9SYWQ7XG4gICAgICAgIGV5ICo9IGhhbGZUb1JhZDtcbiAgICAgICAgZXogKj0gaGFsZlRvUmFkO1xuXG4gICAgICAgIGNvbnN0IHN4ID0gTWF0aC5zaW4oZXgpO1xuICAgICAgICBjb25zdCBjeCA9IE1hdGguY29zKGV4KTtcbiAgICAgICAgY29uc3Qgc3kgPSBNYXRoLnNpbihleSk7XG4gICAgICAgIGNvbnN0IGN5ID0gTWF0aC5jb3MoZXkpO1xuICAgICAgICBjb25zdCBzeiA9IE1hdGguc2luKGV6KTtcbiAgICAgICAgY29uc3QgY3ogPSBNYXRoLmNvcyhleik7XG5cbiAgICAgICAgdGhpcy54ID0gc3ggKiBjeSAqIGN6IC0gY3ggKiBzeSAqIHN6O1xuICAgICAgICB0aGlzLnkgPSBjeCAqIHN5ICogY3ogKyBzeCAqIGN5ICogc3o7XG4gICAgICAgIHRoaXMueiA9IGN4ICogY3kgKiBzeiAtIHN4ICogc3kgKiBjejtcbiAgICAgICAgdGhpcy53ID0gY3ggKiBjeSAqIGN6ICsgc3ggKiBzeSAqIHN6O1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSBzcGVjaWZpZWQgNHg0IG1hdHJpeCB0byBhIHF1YXRlcm5pb24uIE5vdGUgdGhhdCBzaW5jZSBhIHF1YXRlcm5pb24gaXMgcHVyZWx5IGFcbiAgICAgKiByZXByZXNlbnRhdGlvbiBmb3Igb3JpZW50YXRpb24sIG9ubHkgdGhlIHRyYW5zbGF0aW9uYWwgcGFydCBvZiB0aGUgbWF0cml4IGlzIGxvc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IG0gLSBUaGUgNHg0IG1hdHJpeCB0byBjb252ZXJ0LlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXggb2YgMTgwIGRlZ3JlZXMgYXJvdW5kIHRoZSB5LWF4aXNcbiAgICAgKiB2YXIgcm90ID0gbmV3IHBjLk1hdDQoKS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBDb252ZXJ0IHRvIGEgcXVhdGVybmlvblxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tTWF0NChyb3QpO1xuICAgICAqL1xuICAgIHNldEZyb21NYXQ0KG0pIHtcbiAgICAgICAgbGV0IG0wMCwgbTAxLCBtMDIsIG0xMCwgbTExLCBtMTIsIG0yMCwgbTIxLCBtMjIsXG4gICAgICAgICAgICBzLCBycywgbHgsIGx5LCBsejtcblxuICAgICAgICBtID0gbS5kYXRhO1xuXG4gICAgICAgIC8vIENhY2hlIG1hdHJpeCB2YWx1ZXMgZm9yIHN1cGVyLXNwZWVkXG4gICAgICAgIG0wMCA9IG1bMF07XG4gICAgICAgIG0wMSA9IG1bMV07XG4gICAgICAgIG0wMiA9IG1bMl07XG4gICAgICAgIG0xMCA9IG1bNF07XG4gICAgICAgIG0xMSA9IG1bNV07XG4gICAgICAgIG0xMiA9IG1bNl07XG4gICAgICAgIG0yMCA9IG1bOF07XG4gICAgICAgIG0yMSA9IG1bOV07XG4gICAgICAgIG0yMiA9IG1bMTBdO1xuXG4gICAgICAgIC8vIFJlbW92ZSB0aGUgc2NhbGUgZnJvbSB0aGUgbWF0cml4XG4gICAgICAgIGx4ID0gbTAwICogbTAwICsgbTAxICogbTAxICsgbTAyICogbTAyO1xuICAgICAgICBpZiAobHggPT09IDApXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgbHggPSAxIC8gTWF0aC5zcXJ0KGx4KTtcbiAgICAgICAgbHkgPSBtMTAgKiBtMTAgKyBtMTEgKiBtMTEgKyBtMTIgKiBtMTI7XG4gICAgICAgIGlmIChseSA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICBseSA9IDEgLyBNYXRoLnNxcnQobHkpO1xuICAgICAgICBseiA9IG0yMCAqIG0yMCArIG0yMSAqIG0yMSArIG0yMiAqIG0yMjtcbiAgICAgICAgaWYgKGx6ID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGx6ID0gMSAvIE1hdGguc3FydChseik7XG5cbiAgICAgICAgbTAwICo9IGx4O1xuICAgICAgICBtMDEgKj0gbHg7XG4gICAgICAgIG0wMiAqPSBseDtcbiAgICAgICAgbTEwICo9IGx5O1xuICAgICAgICBtMTEgKj0gbHk7XG4gICAgICAgIG0xMiAqPSBseTtcbiAgICAgICAgbTIwICo9IGx6O1xuICAgICAgICBtMjEgKj0gbHo7XG4gICAgICAgIG0yMiAqPSBsejtcblxuICAgICAgICAvLyBodHRwOi8vd3d3LmNzLnVjci5lZHUvfnZiei9yZXNvdXJjZXMvcXVhdHV0LnBkZlxuXG4gICAgICAgIGNvbnN0IHRyID0gbTAwICsgbTExICsgbTIyO1xuICAgICAgICBpZiAodHIgPj0gMCkge1xuICAgICAgICAgICAgcyA9IE1hdGguc3FydCh0ciArIDEpO1xuICAgICAgICAgICAgdGhpcy53ID0gcyAqIDAuNTtcbiAgICAgICAgICAgIHMgPSAwLjUgLyBzO1xuICAgICAgICAgICAgdGhpcy54ID0gKG0xMiAtIG0yMSkgKiBzO1xuICAgICAgICAgICAgdGhpcy55ID0gKG0yMCAtIG0wMikgKiBzO1xuICAgICAgICAgICAgdGhpcy56ID0gKG0wMSAtIG0xMCkgKiBzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKG0wMCA+IG0xMSkge1xuICAgICAgICAgICAgICAgIGlmIChtMDAgPiBtMjIpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gWERpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICAgICAgcnMgPSAobTAwIC0gKG0xMSArIG0yMikpICsgMTtcbiAgICAgICAgICAgICAgICAgICAgcnMgPSBNYXRoLnNxcnQocnMpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMueCA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgICAgICBycyA9IDAuNSAvIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLncgPSAobTEyIC0gbTIxKSAqIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnkgPSAobTAxICsgbTEwKSAqIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnogPSAobTAyICsgbTIwKSAqIHJzO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFpEaWFnRG9tTWF0cml4XG4gICAgICAgICAgICAgICAgICAgIHJzID0gKG0yMiAtIChtMDAgKyBtMTEpKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnogPSBycyAqIDAuNTtcbiAgICAgICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53ID0gKG0wMSAtIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy54ID0gKG0yMCArIG0wMikgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy55ID0gKG0yMSArIG0xMikgKiBycztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG0xMSA+IG0yMikge1xuICAgICAgICAgICAgICAgIC8vIFlEaWFnRG9tTWF0cml4XG4gICAgICAgICAgICAgICAgcnMgPSAobTExIC0gKG0yMiArIG0wMCkpICsgMTtcbiAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnkgPSBycyAqIDAuNTtcbiAgICAgICAgICAgICAgICBycyA9IDAuNSAvIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMjAgLSBtMDIpICogcnM7XG4gICAgICAgICAgICAgICAgdGhpcy56ID0gKG0xMiArIG0yMSkgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnggPSAobTEwICsgbTAxKSAqIHJzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBaRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgIHJzID0gKG0yMiAtIChtMDAgKyBtMTEpKSArIDE7XG4gICAgICAgICAgICAgICAgcnMgPSBNYXRoLnNxcnQocnMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy56ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICB0aGlzLncgPSAobTAxIC0gbTEwKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IChtMjAgKyBtMDIpICogcnM7XG4gICAgICAgICAgICAgICAgdGhpcy55ID0gKG0yMSArIG0xMikgKiBycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBlcmZvcm1zIGEgc3BoZXJpY2FsIGludGVycG9sYXRpb24gYmV0d2VlbiB0d28gcXVhdGVybmlvbnMuIFRoZSByZXN1bHQgb2YgdGhlIGludGVycG9sYXRpb25cbiAgICAgKiBpcyB3cml0dGVuIHRvIHRoZSBxdWF0ZXJuaW9uIGNhbGxpbmcgdGhlIGZ1bmN0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtRdWF0fSBsaHMgLSBUaGUgcXVhdGVybmlvbiB0byBpbnRlcnBvbGF0ZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdG8gaW50ZXJwb2xhdGUgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFscGhhIC0gVGhlIHZhbHVlIGNvbnRyb2xsaW5nIHRoZSBpbnRlcnBvbGF0aW9uIGluIHJlbGF0aW9uIHRvIHRoZSB0d28gaW5wdXRcbiAgICAgKiBxdWF0ZXJuaW9ucy4gVGhlIHZhbHVlIGlzIGluIHRoZSByYW5nZSAwIHRvIDEsIDAgZ2VuZXJhdGluZyBxMSwgMSBnZW5lcmF0aW5nIHEyIGFuZCBhbnl0aGluZ1xuICAgICAqIGluIGJldHdlZW4gZ2VuZXJhdGluZyBhIHNwaGVyaWNhbCBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdGhlIHR3by5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcTEgPSBuZXcgcGMuUXVhdCgtMC4xMSwgLTAuMTUsIC0wLjQ2LCAwLjg3KTtcbiAgICAgKiB2YXIgcTIgPSBuZXcgcGMuUXVhdCgtMC4yMSwgLTAuMjEsIC0wLjY3LCAwLjY4KTtcbiAgICAgKlxuICAgICAqIHZhciByZXN1bHQ7XG4gICAgICogcmVzdWx0ID0gbmV3IHBjLlF1YXQoKS5zbGVycChxMSwgcTIsIDApOyAgIC8vIFJldHVybiBxMVxuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAwLjUpOyAvLyBSZXR1cm4gdGhlIG1pZHBvaW50IGludGVycG9sYW50XG4gICAgICogcmVzdWx0ID0gbmV3IHBjLlF1YXQoKS5zbGVycChxMSwgcTIsIDEpOyAgIC8vIFJldHVybiBxMlxuICAgICAqL1xuICAgIHNsZXJwKGxocywgcmhzLCBhbHBoYSkge1xuICAgICAgICAvLyBBbGdvcml0aG0gc291cmNlZCBmcm9tOlxuICAgICAgICAvLyBodHRwOi8vd3d3LmV1Y2xpZGVhbnNwYWNlLmNvbS9tYXRocy9hbGdlYnJhL3JlYWxOb3JtZWRBbGdlYnJhL3F1YXRlcm5pb25zL3NsZXJwL1xuICAgICAgICBjb25zdCBseCA9IGxocy54O1xuICAgICAgICBjb25zdCBseSA9IGxocy55O1xuICAgICAgICBjb25zdCBseiA9IGxocy56O1xuICAgICAgICBjb25zdCBsdyA9IGxocy53O1xuICAgICAgICBsZXQgcnggPSByaHMueDtcbiAgICAgICAgbGV0IHJ5ID0gcmhzLnk7XG4gICAgICAgIGxldCByeiA9IHJocy56O1xuICAgICAgICBsZXQgcncgPSByaHMudztcblxuICAgICAgICAvLyBDYWxjdWxhdGUgYW5nbGUgYmV0d2VlbiB0aGVtLlxuICAgICAgICBsZXQgY29zSGFsZlRoZXRhID0gbHcgKiBydyArIGx4ICogcnggKyBseSAqIHJ5ICsgbHogKiByejtcblxuICAgICAgICBpZiAoY29zSGFsZlRoZXRhIDwgMCkge1xuICAgICAgICAgICAgcncgPSAtcnc7XG4gICAgICAgICAgICByeCA9IC1yeDtcbiAgICAgICAgICAgIHJ5ID0gLXJ5O1xuICAgICAgICAgICAgcnogPSAtcno7XG4gICAgICAgICAgICBjb3NIYWxmVGhldGEgPSAtY29zSGFsZlRoZXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbGhzID09IHJocyBvciBsaHMgPT0gLXJocyB0aGVuIHRoZXRhID09IDAgYW5kIHdlIGNhbiByZXR1cm4gbGhzXG4gICAgICAgIGlmIChNYXRoLmFicyhjb3NIYWxmVGhldGEpID49IDEpIHtcbiAgICAgICAgICAgIHRoaXMudyA9IGx3O1xuICAgICAgICAgICAgdGhpcy54ID0gbHg7XG4gICAgICAgICAgICB0aGlzLnkgPSBseTtcbiAgICAgICAgICAgIHRoaXMueiA9IGx6O1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxjdWxhdGUgdGVtcG9yYXJ5IHZhbHVlcy5cbiAgICAgICAgY29uc3QgaGFsZlRoZXRhID0gTWF0aC5hY29zKGNvc0hhbGZUaGV0YSk7XG4gICAgICAgIGNvbnN0IHNpbkhhbGZUaGV0YSA9IE1hdGguc3FydCgxIC0gY29zSGFsZlRoZXRhICogY29zSGFsZlRoZXRhKTtcblxuICAgICAgICAvLyBJZiB0aGV0YSA9IDE4MCBkZWdyZWVzIHRoZW4gcmVzdWx0IGlzIG5vdCBmdWxseSBkZWZpbmVkXG4gICAgICAgIC8vIHdlIGNvdWxkIHJvdGF0ZSBhcm91bmQgYW55IGF4aXMgbm9ybWFsIHRvIHFhIG9yIHFiXG4gICAgICAgIGlmIChNYXRoLmFicyhzaW5IYWxmVGhldGEpIDwgMC4wMDEpIHtcbiAgICAgICAgICAgIHRoaXMudyA9IChsdyAqIDAuNSArIHJ3ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueCA9IChseCAqIDAuNSArIHJ4ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueSA9IChseSAqIDAuNSArIHJ5ICogMC41KTtcbiAgICAgICAgICAgIHRoaXMueiA9IChseiAqIDAuNSArIHJ6ICogMC41KTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmF0aW9BID0gTWF0aC5zaW4oKDEgLSBhbHBoYSkgKiBoYWxmVGhldGEpIC8gc2luSGFsZlRoZXRhO1xuICAgICAgICBjb25zdCByYXRpb0IgPSBNYXRoLnNpbihhbHBoYSAqIGhhbGZUaGV0YSkgLyBzaW5IYWxmVGhldGE7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIFF1YXRlcm5pb24uXG4gICAgICAgIHRoaXMudyA9IChsdyAqIHJhdGlvQSArIHJ3ICogcmF0aW9CKTtcbiAgICAgICAgdGhpcy54ID0gKGx4ICogcmF0aW9BICsgcnggKiByYXRpb0IpO1xuICAgICAgICB0aGlzLnkgPSAobHkgKiByYXRpb0EgKyByeSAqIHJhdGlvQik7XG4gICAgICAgIHRoaXMueiA9IChseiAqIHJhdGlvQSArIHJ6ICogcmF0aW9CKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhbnNmb3JtcyBhIDMtZGltZW5zaW9uYWwgdmVjdG9yIGJ5IHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gdmVjIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIGJlIHRyYW5zZm9ybWVkLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW3Jlc10gLSBBbiBvcHRpb25hbCAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byByZWNlaXZlIHRoZSByZXN1bHQgb2YgdGhlIHRyYW5zZm9ybWF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBUaGUgaW5wdXQgdmVjdG9yIHYgdHJhbnNmb3JtZWQgYnkgdGhlIGN1cnJlbnQgaW5zdGFuY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSAzLWRpbWVuc2lvbmFsIHZlY3RvclxuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzMoMSwgMiwgMyk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4XG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygxMCwgMjAsIDMwKTtcbiAgICAgKlxuICAgICAqIHZhciB0diA9IHEudHJhbnNmb3JtVmVjdG9yKHYpO1xuICAgICAqL1xuICAgIHRyYW5zZm9ybVZlY3Rvcih2ZWMsIHJlcyA9IG5ldyBWZWMzKCkpIHtcbiAgICAgICAgY29uc3QgeCA9IHZlYy54LCB5ID0gdmVjLnksIHogPSB2ZWMuejtcbiAgICAgICAgY29uc3QgcXggPSB0aGlzLngsIHF5ID0gdGhpcy55LCBxeiA9IHRoaXMueiwgcXcgPSB0aGlzLnc7XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIHF1YXQgKiB2ZWNcbiAgICAgICAgY29uc3QgaXggPSBxdyAqIHggKyBxeSAqIHogLSBxeiAqIHk7XG4gICAgICAgIGNvbnN0IGl5ID0gcXcgKiB5ICsgcXogKiB4IC0gcXggKiB6O1xuICAgICAgICBjb25zdCBpeiA9IHF3ICogeiArIHF4ICogeSAtIHF5ICogeDtcbiAgICAgICAgY29uc3QgaXcgPSAtcXggKiB4IC0gcXkgKiB5IC0gcXogKiB6O1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSByZXN1bHQgKiBpbnZlcnNlIHF1YXRcbiAgICAgICAgcmVzLnggPSBpeCAqIHF3ICsgaXcgKiAtcXggKyBpeSAqIC1xeiAtIGl6ICogLXF5O1xuICAgICAgICByZXMueSA9IGl5ICogcXcgKyBpdyAqIC1xeSArIGl6ICogLXF4IC0gaXggKiAtcXo7XG4gICAgICAgIHJlcy56ID0gaXogKiBxdyArIGl3ICogLXF6ICsgaXggKiAtcXkgLSBpeSAqIC1xeDtcblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIHRoZSBxdWF0ZXJuaW9uIHRvIHN0cmluZyBmb3JtLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIHF1YXRlcm5pb24gaW4gc3RyaW5nIGZvcm0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5RdWF0KDAsIDAsIDAsIDEpO1xuICAgICAqIC8vIE91dHB1dHMgWzAsIDAsIDAsIDFdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIGBbJHt0aGlzLnh9LCAke3RoaXMueX0sICR7dGhpcy56fSwgJHt0aGlzLnd9XWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCBxdWF0ZXJuaW9uIHNldCB0byBbMCwgMCwgMCwgMV0gKHRoZSBpZGVudGl0eSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgSURFTlRJVFkgPSBPYmplY3QuZnJlZXplKG5ldyBRdWF0KDAsIDAsIDAsIDEpKTtcblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgcXVhdGVybmlvbiBzZXQgdG8gWzAsIDAsIDAsIDBdLlxuICAgICAqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFpFUk8gPSBPYmplY3QuZnJlZXplKG5ldyBRdWF0KDAsIDAsIDAsIDApKTtcbn1cblxuZXhwb3J0IHsgUXVhdCB9O1xuIl0sIm5hbWVzIjpbIlF1YXQiLCJjb25zdHJ1Y3RvciIsIngiLCJ5IiwieiIsInciLCJsZW5ndGgiLCJjbG9uZSIsImNzdHIiLCJjb25qdWdhdGUiLCJjb3B5IiwicmhzIiwiZXF1YWxzIiwiZ2V0QXhpc0FuZ2xlIiwiYXhpcyIsInJhZCIsIk1hdGgiLCJhY29zIiwicyIsInNpbiIsIm1hdGgiLCJSQURfVE9fREVHIiwiZ2V0RXVsZXJBbmdsZXMiLCJldWxlcnMiLCJWZWMzIiwicXgiLCJxeSIsInF6IiwicXciLCJhMiIsImF0YW4yIiwiUEkiLCJhc2luIiwic2V0IiwibXVsU2NhbGFyIiwiaW52ZXJ0Iiwibm9ybWFsaXplIiwic3FydCIsImxlbmd0aFNxIiwibXVsIiwicTF4IiwicTF5IiwicTF6IiwicTF3IiwicTJ4IiwicTJ5IiwicTJ6IiwicTJ3IiwibXVsMiIsImxocyIsImxlbiIsInNldEZyb21BeGlzQW5nbGUiLCJhbmdsZSIsIkRFR19UT19SQUQiLCJzYSIsImNhIiwiY29zIiwic2V0RnJvbUV1bGVyQW5nbGVzIiwiZXgiLCJleSIsImV6IiwidmVjIiwiaGFsZlRvUmFkIiwic3giLCJjeCIsInN5IiwiY3kiLCJzeiIsImN6Iiwic2V0RnJvbU1hdDQiLCJtIiwibTAwIiwibTAxIiwibTAyIiwibTEwIiwibTExIiwibTEyIiwibTIwIiwibTIxIiwibTIyIiwicnMiLCJseCIsImx5IiwibHoiLCJkYXRhIiwidHIiLCJzbGVycCIsImFscGhhIiwibHciLCJyeCIsInJ5IiwicnoiLCJydyIsImNvc0hhbGZUaGV0YSIsImFicyIsImhhbGZUaGV0YSIsInNpbkhhbGZUaGV0YSIsInJhdGlvQSIsInJhdGlvQiIsInRyYW5zZm9ybVZlY3RvciIsInJlcyIsIml4IiwiaXkiLCJpeiIsIml3IiwidG9TdHJpbmciLCJJREVOVElUWSIsIk9iamVjdCIsImZyZWV6ZSIsIlpFUk8iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBUUEsTUFBTUEsSUFBTixDQUFXO0FBVVBDLEVBQUFBLFdBQVcsQ0FBQ0MsQ0FBQyxHQUFHLENBQUwsRUFBUUMsQ0FBQyxHQUFHLENBQVosRUFBZUMsQ0FBQyxHQUFHLENBQW5CLEVBQXNCQyxDQUFDLEdBQUcsQ0FBMUIsRUFBNkI7QUFDcEMsSUFBQSxJQUFJSCxDQUFDLENBQUNJ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
