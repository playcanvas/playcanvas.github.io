/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVhdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9xdWF0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4vdmVjMy5qcyc7XG5cbi8qKlxuICogQSBxdWF0ZXJuaW9uLlxuICovXG5jbGFzcyBRdWF0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUXVhdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bWJlcltdfSBbeF0gLSBUaGUgcXVhdGVybmlvbidzIHggY29tcG9uZW50LiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5XG4gICAgICogb2YgbGVuZ3RoIDQsIHRoZSBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeSBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeiBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgdyBjb21wb25lbnQuIERlZmF1bHRzIHRvIDEuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoeCA9IDAsIHkgPSAwLCB6ID0gMCwgdyA9IDEpIHtcbiAgICAgICAgaWYgKHgubGVuZ3RoID09PSA0KSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSB4IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLnggPSB4WzBdO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgeSBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy55ID0geFsxXTtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHogY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMueiA9IHhbMl07XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSB3IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLncgPSB4WzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICAgICAgdGhpcy53ID0gdztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gaWRlbnRpY2FsIGNvcHkgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgcXVhdGVybmlvbiBjb250YWluaW5nIHRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KC0wLjExLCAtMC4xNSwgLTAuNDYsIDAuODcpO1xuICAgICAqIHZhciBxY2xvbmUgPSBxLmNsb25lKCk7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcgaXM6IFwiICsgcS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55LCB0aGlzLnosIHRoaXMudyk7XG4gICAgfVxuXG4gICAgY29uanVnYXRlKCkge1xuICAgICAgICB0aGlzLnggKj0gLTE7XG4gICAgICAgIHRoaXMueSAqPSAtMTtcbiAgICAgICAgdGhpcy56ICo9IC0xO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2UgcXVhdGVybmlvbiB0byBhIGRlc3RpbmF0aW9uIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgc3JjID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiB2YXIgZHN0ID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBkc3QuY29weShzcmMsIHNyYyk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHF1YXRlcm5pb25zIGFyZSBcIiArIChzcmMuZXF1YWxzKGRzdCkgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IHJocy55O1xuICAgICAgICB0aGlzLnogPSByaHMuejtcbiAgICAgICAgdGhpcy53ID0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHR3byBxdWF0ZXJuaW9ucyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvbXBhcmVkIGFnYWluc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHF1YXRlcm5pb25zIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gcXVhdGVybmlvbnMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgcmV0dXJuICgodGhpcy54ID09PSByaHMueCkgJiYgKHRoaXMueSA9PT0gcmhzLnkpICYmICh0aGlzLnogPT09IHJocy56KSAmJiAodGhpcy53ID09PSByaHMudykpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHJvdGF0aW9uIGF4aXMgYW5kIGFuZ2xlIGZvciBhIGdpdmVuIHF1YXRlcm5pb24uIElmIGEgcXVhdGVybmlvbiBpcyBjcmVhdGVkIHdpdGhcbiAgICAgKiBgc2V0RnJvbUF4aXNBbmdsZWAsIHRoaXMgbWV0aG9kIHdpbGwgcmV0dXJuIHRoZSBzYW1lIHZhbHVlcyBhcyBwcm92aWRlZCBpbiB0aGUgb3JpZ2luYWxcbiAgICAgKiBwYXJhbWV0ZXIgbGlzdCBPUiBmdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGF4aXMgLSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgYXhpcyBvZiByb3RhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBbmdsZSwgaW4gZGVncmVlcywgb2YgdGhlIHJvdGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHEuc2V0RnJvbUF4aXNBbmdsZShuZXcgcGMuVmVjMygwLCAxLCAwKSwgOTApO1xuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiB2YXIgYW5nbGUgPSBxLmdldEF4aXNBbmdsZSh2KTtcbiAgICAgKiAvLyBPdXRwdXRzIDkwXG4gICAgICogY29uc29sZS5sb2coYW5nbGUpO1xuICAgICAqIC8vIE91dHB1dHMgWzAsIDEsIDBdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBnZXRBeGlzQW5nbGUoYXhpcykge1xuICAgICAgICBsZXQgcmFkID0gTWF0aC5hY29zKHRoaXMudykgKiAyO1xuICAgICAgICBjb25zdCBzID0gTWF0aC5zaW4ocmFkIC8gMik7XG4gICAgICAgIGlmIChzICE9PSAwKSB7XG4gICAgICAgICAgICBheGlzLnggPSB0aGlzLnggLyBzO1xuICAgICAgICAgICAgYXhpcy55ID0gdGhpcy55IC8gcztcbiAgICAgICAgICAgIGF4aXMueiA9IHRoaXMueiAvIHM7XG4gICAgICAgICAgICBpZiAoYXhpcy54IDwgMCB8fCBheGlzLnkgPCAwIHx8IGF4aXMueiA8IDApIHtcbiAgICAgICAgICAgICAgICAvLyBGbGlwIHRoZSBzaWduXG4gICAgICAgICAgICAgICAgYXhpcy54ICo9IC0xO1xuICAgICAgICAgICAgICAgIGF4aXMueSAqPSAtMTtcbiAgICAgICAgICAgICAgICBheGlzLnogKj0gLTE7XG4gICAgICAgICAgICAgICAgcmFkICo9IC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSWYgcyBpcyB6ZXJvLCByZXR1cm4gYW55IGF4aXMgKG5vIHJvdGF0aW9uIC0gYXhpcyBkb2VzIG5vdCBtYXR0ZXIpXG4gICAgICAgICAgICBheGlzLnggPSAxO1xuICAgICAgICAgICAgYXhpcy55ID0gMDtcbiAgICAgICAgICAgIGF4aXMueiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJhZCAqIG1hdGguUkFEX1RPX0RFRztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgc3VwcGxpZWQgcXVhdGVybmlvbiB0byBFdWxlciBhbmdsZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtldWxlcnNdIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIEV1bGVyIGFuZ2xlcy5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgdGhlIEV1bGVyIGFuZ2xlcyB0aGF0XG4gICAgICogY29ycmVzcG9uZCB0byB0aGUgc3VwcGxpZWQgcXVhdGVybmlvbi5cbiAgICAgKi9cbiAgICBnZXRFdWxlckFuZ2xlcyhldWxlcnMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGxldCB4LCB5LCB6O1xuXG4gICAgICAgIGNvbnN0IHF4ID0gdGhpcy54O1xuICAgICAgICBjb25zdCBxeSA9IHRoaXMueTtcbiAgICAgICAgY29uc3QgcXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHF3ID0gdGhpcy53O1xuXG4gICAgICAgIGNvbnN0IGEyID0gMiAqIChxdyAqIHF5IC0gcXggKiBxeik7XG5cbiAgICAgICAgaWYgKGEyIDw9IC0wLjk5OTk5KSB7XG4gICAgICAgICAgICB4ID0gMiAqIE1hdGguYXRhbjIocXgsIHF3KTtcbiAgICAgICAgICAgIHkgPSAtTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgfSBlbHNlIGlmIChhMiA+PSAwLjk5OTk5KSB7XG4gICAgICAgICAgICB4ID0gMiAqIE1hdGguYXRhbjIocXgsIHF3KTtcbiAgICAgICAgICAgIHkgPSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgIHogPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IE1hdGguYXRhbjIoMiAqIChxdyAqIHF4ICsgcXkgKiBxeiksIDEgLSAyICogKHF4ICogcXggKyBxeSAqIHF5KSk7XG4gICAgICAgICAgICB5ID0gTWF0aC5hc2luKGEyKTtcbiAgICAgICAgICAgIHogPSBNYXRoLmF0YW4yKDIgKiAocXcgKiBxeiArIHF4ICogcXkpLCAxIC0gMiAqIChxeSAqIHF5ICsgcXogKiBxeikpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV1bGVycy5zZXQoeCwgeSwgeikubXVsU2NhbGFyKG1hdGguUkFEX1RPX0RFRyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIHRoZSBpbnZlcnNlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gcm90YXRlZCAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciByb3QgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAxODAsIDApO1xuICAgICAqXG4gICAgICogLy8gSW52ZXJ0IGluIHBsYWNlXG4gICAgICogcm90LmludmVydCgpO1xuICAgICAqL1xuICAgIGludmVydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uanVnYXRlKCkubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgwLCAwLCAwLCA1KTtcbiAgICAgKiB2YXIgbGVuID0gcS5sZW5ndGgoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggb2YgdGhlIHF1YXRlcm5pb24gaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgc3F1YXJlZCBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoMywgNCwgMCk7XG4gICAgICogdmFyIGxlblNxID0gcS5sZW5ndGhTcSgpO1xuICAgICAqIC8vIE91dHB1dHMgMjVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggc3F1YXJlZCBvZiB0aGUgcXVhdGVybmlvbiBpczogXCIgKyBsZW5TcSk7XG4gICAgICovXG4gICAgbGVuZ3RoU3EoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkgKyB0aGlzLnogKiB0aGlzLnogKyB0aGlzLncgKiB0aGlzLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDMwLCAwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIGEgYmVjb21lcyBhIDkwIGRlZ3JlZSByb3RhdGlvbiBhcm91bmQgdGhlIFkgYXhpc1xuICAgICAqIC8vIEluIG90aGVyIHdvcmRzLCBhID0gYSAqIGJcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IHRoaXMueDtcbiAgICAgICAgY29uc3QgcTF5ID0gdGhpcy55O1xuICAgICAgICBjb25zdCBxMXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IHRoaXMudztcblxuICAgICAgICBjb25zdCBxMnggPSByaHMueDtcbiAgICAgICAgY29uc3QgcTJ5ID0gcmhzLnk7XG4gICAgICAgIGNvbnN0IHEyeiA9IHJocy56O1xuICAgICAgICBjb25zdCBxMncgPSByaHMudztcblxuICAgICAgICB0aGlzLnggPSBxMXcgKiBxMnggKyBxMXggKiBxMncgKyBxMXkgKiBxMnogLSBxMXogKiBxMnk7XG4gICAgICAgIHRoaXMueSA9IHExdyAqIHEyeSArIHExeSAqIHEydyArIHExeiAqIHEyeCAtIHExeCAqIHEyejtcbiAgICAgICAgdGhpcy56ID0gcTF3ICogcTJ6ICsgcTF6ICogcTJ3ICsgcTF4ICogcTJ5IC0gcTF5ICogcTJ4O1xuICAgICAgICB0aGlzLncgPSBxMXcgKiBxMncgLSBxMXggKiBxMnggLSBxMXkgKiBxMnkgLSBxMXogKiBxMno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IGxocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgMzAsIDApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgNjAsIDApO1xuICAgICAqIHZhciByID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKlxuICAgICAqIC8vIHIgaXMgc2V0IHRvIGEgOTAgZGVncmVlIHJvdGF0aW9uIGFyb3VuZCB0aGUgWSBheGlzXG4gICAgICogLy8gSW4gb3RoZXIgd29yZHMsIHIgPSBhICogYlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IGxocy54O1xuICAgICAgICBjb25zdCBxMXkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgcTF6ID0gbGhzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IGxocy53O1xuXG4gICAgICAgIGNvbnN0IHEyeCA9IHJocy54O1xuICAgICAgICBjb25zdCBxMnkgPSByaHMueTtcbiAgICAgICAgY29uc3QgcTJ6ID0gcmhzLno7XG4gICAgICAgIGNvbnN0IHEydyA9IHJocy53O1xuXG4gICAgICAgIHRoaXMueCA9IHExdyAqIHEyeCArIHExeCAqIHEydyArIHExeSAqIHEyeiAtIHExeiAqIHEyeTtcbiAgICAgICAgdGhpcy55ID0gcTF3ICogcTJ5ICsgcTF5ICogcTJ3ICsgcTF6ICogcTJ4IC0gcTF4ICogcTJ6O1xuICAgICAgICB0aGlzLnogPSBxMXcgKiBxMnogKyBxMXogKiBxMncgKyBxMXggKiBxMnkgLSBxMXkgKiBxMng7XG4gICAgICAgIHRoaXMudyA9IHExdyAqIHEydyAtIHExeCAqIHEyeCAtIHExeSAqIHEyeSAtIHExeiAqIHEyejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiBjb252ZXJ0ZWQgaW4gcGxhY2UgdG8gYSB1bml0IHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHJlc3VsdCBvZiB0aGUgbm9ybWFsaXphdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ID0gbmV3IHBjLlF1YXQoMCwgMCwgMCwgNSk7XG4gICAgICpcbiAgICAgKiB2Lm5vcm1hbGl6ZSgpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyAwLCAwLCAwLCAxXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSB2ZWN0b3Igbm9ybWFsaXphdGlvbiBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG5vcm1hbGl6ZSgpIHtcbiAgICAgICAgbGV0IGxlbiA9IHRoaXMubGVuZ3RoKCk7XG4gICAgICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHRoaXMueSA9IHRoaXMueiA9IDA7XG4gICAgICAgICAgICB0aGlzLncgPSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGVuID0gMSAvIGxlbjtcbiAgICAgICAgICAgIHRoaXMueCAqPSBsZW47XG4gICAgICAgICAgICB0aGlzLnkgKj0gbGVuO1xuICAgICAgICAgICAgdGhpcy56ICo9IGxlbjtcbiAgICAgICAgICAgIHRoaXMudyAqPSBsZW47XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiB0byB0aGUgc3VwcGxpZWQgbnVtZXJpY2FsIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIHogY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHcgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldCgxLCAwLCAwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyBxLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5LCB6LCB3KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgIHRoaXMudyA9IHc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBhbiBhbmd1bGFyIHJvdGF0aW9uIGFyb3VuZCBhbiBheGlzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gV29ybGQgc3BhY2UgYXhpcyBhcm91bmQgd2hpY2ggdG8gcm90YXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbmdsZSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgdGhlIGdpdmVuIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDkwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tQXhpc0FuZ2xlKGF4aXMsIGFuZ2xlKSB7XG4gICAgICAgIGFuZ2xlICo9IDAuNSAqIG1hdGguREVHX1RPX1JBRDtcblxuICAgICAgICBjb25zdCBzYSA9IE1hdGguc2luKGFuZ2xlKTtcbiAgICAgICAgY29uc3QgY2EgPSBNYXRoLmNvcyhhbmdsZSk7XG5cbiAgICAgICAgdGhpcy54ID0gc2EgKiBheGlzLng7XG4gICAgICAgIHRoaXMueSA9IHNhICogYXhpcy55O1xuICAgICAgICB0aGlzLnogPSBzYSAqIGF4aXMuejtcbiAgICAgICAgdGhpcy53ID0gY2E7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBFdWxlciBhbmdsZXMgc3BlY2lmaWVkIGluIFhZWiBvcmRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfFZlYzN9IGV4IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBYIGF4aXMgaW4gZGVncmVlcy4gSWYgZXggaXMgYSBWZWMzLCB0aGVcbiAgICAgKiB0aHJlZSBhbmdsZXMgd2lsbCBiZSByZWFkIGZyb20gaXQgaW5zdGVhZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2V5XSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWSBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtlel0gLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFogYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gZnJvbSAzIGV1bGVyIGFuZ2xlc1xuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldEZyb21FdWxlckFuZ2xlcyg0NSwgOTAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgdGhlIHNhbWUgcXVhdGVybmlvbiBmcm9tIGEgdmVjdG9yIGNvbnRhaW5pbmcgdGhlIHNhbWUgMyBldWxlciBhbmdsZXNcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMzKDQ1LCA5MCwgMTgwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogci5zZXRGcm9tRXVsZXJBbmdsZXModik7XG4gICAgICovXG4gICAgc2V0RnJvbUV1bGVyQW5nbGVzKGV4LCBleSwgZXopIHtcbiAgICAgICAgaWYgKGV4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgY29uc3QgdmVjID0gZXg7XG4gICAgICAgICAgICBleCA9IHZlYy54O1xuICAgICAgICAgICAgZXkgPSB2ZWMueTtcbiAgICAgICAgICAgIGV6ID0gdmVjLno7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYWxmVG9SYWQgPSAwLjUgKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGV4ICo9IGhhbGZUb1JhZDtcbiAgICAgICAgZXkgKj0gaGFsZlRvUmFkO1xuICAgICAgICBleiAqPSBoYWxmVG9SYWQ7XG5cbiAgICAgICAgY29uc3Qgc3ggPSBNYXRoLnNpbihleCk7XG4gICAgICAgIGNvbnN0IGN4ID0gTWF0aC5jb3MoZXgpO1xuICAgICAgICBjb25zdCBzeSA9IE1hdGguc2luKGV5KTtcbiAgICAgICAgY29uc3QgY3kgPSBNYXRoLmNvcyhleSk7XG4gICAgICAgIGNvbnN0IHN6ID0gTWF0aC5zaW4oZXopO1xuICAgICAgICBjb25zdCBjeiA9IE1hdGguY29zKGV6KTtcblxuICAgICAgICB0aGlzLnggPSBzeCAqIGN5ICogY3ogLSBjeCAqIHN5ICogc3o7XG4gICAgICAgIHRoaXMueSA9IGN4ICogc3kgKiBjeiArIHN4ICogY3kgKiBzejtcbiAgICAgICAgdGhpcy56ID0gY3ggKiBjeSAqIHN6IC0gc3ggKiBzeSAqIGN6O1xuICAgICAgICB0aGlzLncgPSBjeCAqIGN5ICogY3ogKyBzeCAqIHN5ICogc3o7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4IHRvIGEgcXVhdGVybmlvbi4gTm90ZSB0aGF0IHNpbmNlIGEgcXVhdGVybmlvbiBpcyBwdXJlbHkgYVxuICAgICAqIHJlcHJlc2VudGF0aW9uIGZvciBvcmllbnRhdGlvbiwgb25seSB0aGUgdHJhbnNsYXRpb25hbCBwYXJ0IG9mIHRoZSBtYXRyaXggaXMgbG9zdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21hdDQuanMnKS5NYXQ0fSBtIC0gVGhlIDR4NCBtYXRyaXggdG8gY29udmVydC5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA0eDQgcm90YXRpb24gbWF0cml4IG9mIDE4MCBkZWdyZWVzIGFyb3VuZCB0aGUgeS1heGlzXG4gICAgICogdmFyIHJvdCA9IG5ldyBwYy5NYXQ0KCkuc2V0RnJvbUF4aXNBbmdsZShwYy5WZWMzLlVQLCAxODApO1xuICAgICAqXG4gICAgICogLy8gQ29udmVydCB0byBhIHF1YXRlcm5pb25cbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbU1hdDQocm90KTtcbiAgICAgKi9cbiAgICBzZXRGcm9tTWF0NChtKSB7XG4gICAgICAgIGxldCBtMDAsIG0wMSwgbTAyLCBtMTAsIG0xMSwgbTEyLCBtMjAsIG0yMSwgbTIyLFxuICAgICAgICAgICAgcywgcnMsIGx4LCBseSwgbHo7XG5cbiAgICAgICAgbSA9IG0uZGF0YTtcblxuICAgICAgICAvLyBDYWNoZSBtYXRyaXggdmFsdWVzIGZvciBzdXBlci1zcGVlZFxuICAgICAgICBtMDAgPSBtWzBdO1xuICAgICAgICBtMDEgPSBtWzFdO1xuICAgICAgICBtMDIgPSBtWzJdO1xuICAgICAgICBtMTAgPSBtWzRdO1xuICAgICAgICBtMTEgPSBtWzVdO1xuICAgICAgICBtMTIgPSBtWzZdO1xuICAgICAgICBtMjAgPSBtWzhdO1xuICAgICAgICBtMjEgPSBtWzldO1xuICAgICAgICBtMjIgPSBtWzEwXTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIHNjYWxlIGZyb20gdGhlIG1hdHJpeFxuICAgICAgICBseCA9IG0wMCAqIG0wMCArIG0wMSAqIG0wMSArIG0wMiAqIG0wMjtcbiAgICAgICAgaWYgKGx4ID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGx4ID0gMSAvIE1hdGguc3FydChseCk7XG4gICAgICAgIGx5ID0gbTEwICogbTEwICsgbTExICogbTExICsgbTEyICogbTEyO1xuICAgICAgICBpZiAobHkgPT09IDApXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgbHkgPSAxIC8gTWF0aC5zcXJ0KGx5KTtcbiAgICAgICAgbHogPSBtMjAgKiBtMjAgKyBtMjEgKiBtMjEgKyBtMjIgKiBtMjI7XG4gICAgICAgIGlmIChseiA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICBseiA9IDEgLyBNYXRoLnNxcnQobHopO1xuXG4gICAgICAgIG0wMCAqPSBseDtcbiAgICAgICAgbTAxICo9IGx4O1xuICAgICAgICBtMDIgKj0gbHg7XG4gICAgICAgIG0xMCAqPSBseTtcbiAgICAgICAgbTExICo9IGx5O1xuICAgICAgICBtMTIgKj0gbHk7XG4gICAgICAgIG0yMCAqPSBsejtcbiAgICAgICAgbTIxICo9IGx6O1xuICAgICAgICBtMjIgKj0gbHo7XG5cbiAgICAgICAgLy8gaHR0cDovL3d3dy5jcy51Y3IuZWR1L352YnovcmVzb3VyY2VzL3F1YXR1dC5wZGZcblxuICAgICAgICBjb25zdCB0ciA9IG0wMCArIG0xMSArIG0yMjtcbiAgICAgICAgaWYgKHRyID49IDApIHtcbiAgICAgICAgICAgIHMgPSBNYXRoLnNxcnQodHIgKyAxKTtcbiAgICAgICAgICAgIHRoaXMudyA9IHMgKiAwLjU7XG4gICAgICAgICAgICBzID0gMC41IC8gcztcbiAgICAgICAgICAgIHRoaXMueCA9IChtMTIgLSBtMjEpICogcztcbiAgICAgICAgICAgIHRoaXMueSA9IChtMjAgLSBtMDIpICogcztcbiAgICAgICAgICAgIHRoaXMueiA9IChtMDEgLSBtMTApICogcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtMDAgPiBtMTEpIHtcbiAgICAgICAgICAgICAgICBpZiAobTAwID4gbTIyKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFhEaWFnRG9tTWF0cml4XG4gICAgICAgICAgICAgICAgICAgIHJzID0gKG0wMCAtIChtMTEgKyBtMjIpKSArIDE7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLnggPSBycyAqIDAuNTtcbiAgICAgICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53ID0gKG0xMiAtIG0yMSkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy55ID0gKG0wMSArIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICAgICAgdGhpcy56ID0gKG0wMiArIG0yMCkgKiBycztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBaRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgICAgICBycyA9IChtMjIgLSAobTAwICsgbTExKSkgKyAxO1xuICAgICAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy56ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMDEgLSBtMTApICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueCA9IChtMjAgKyBtMDIpICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMjEgKyBtMTIpICogcnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChtMTEgPiBtMjIpIHtcbiAgICAgICAgICAgICAgICAvLyBZRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgIHJzID0gKG0xMSAtIChtMjIgKyBtMDApKSArIDE7XG4gICAgICAgICAgICAgICAgcnMgPSBNYXRoLnNxcnQocnMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy55ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgcnMgPSAwLjUgLyBycztcbiAgICAgICAgICAgICAgICB0aGlzLncgPSAobTIwIC0gbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueiA9IChtMTIgKyBtMjEpICogcnM7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gKG0xMCArIG0wMSkgKiBycztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gWkRpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICBycyA9IChtMjIgLSAobTAwICsgbTExKSkgKyAxO1xuICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMueiA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gKG0wMSAtIG0xMCkgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnggPSAobTIwICsgbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMjEgKyBtMTIpICogcnM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQZXJmb3JtcyBhIHNwaGVyaWNhbCBpbnRlcnBvbGF0aW9uIGJldHdlZW4gdHdvIHF1YXRlcm5pb25zLiBUaGUgcmVzdWx0IG9mIHRoZSBpbnRlcnBvbGF0aW9uXG4gICAgICogaXMgd3JpdHRlbiB0byB0aGUgcXVhdGVybmlvbiBjYWxsaW5nIHRoZSBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UXVhdH0gbGhzIC0gVGhlIHF1YXRlcm5pb24gdG8gaW50ZXJwb2xhdGUgZnJvbS5cbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGludGVycG9sYXRlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbHBoYSAtIFRoZSB2YWx1ZSBjb250cm9sbGluZyB0aGUgaW50ZXJwb2xhdGlvbiBpbiByZWxhdGlvbiB0byB0aGUgdHdvIGlucHV0XG4gICAgICogcXVhdGVybmlvbnMuIFRoZSB2YWx1ZSBpcyBpbiB0aGUgcmFuZ2UgMCB0byAxLCAwIGdlbmVyYXRpbmcgcTEsIDEgZ2VuZXJhdGluZyBxMiBhbmQgYW55dGhpbmdcbiAgICAgKiBpbiBiZXR3ZWVuIGdlbmVyYXRpbmcgYSBzcGhlcmljYWwgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHRoZSB0d28uXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHExID0gbmV3IHBjLlF1YXQoLTAuMTEsIC0wLjE1LCAtMC40NiwgMC44Nyk7XG4gICAgICogdmFyIHEyID0gbmV3IHBjLlF1YXQoLTAuMjEsIC0wLjIxLCAtMC42NywgMC42OCk7XG4gICAgICpcbiAgICAgKiB2YXIgcmVzdWx0O1xuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAwKTsgICAvLyBSZXR1cm4gcTFcbiAgICAgKiByZXN1bHQgPSBuZXcgcGMuUXVhdCgpLnNsZXJwKHExLCBxMiwgMC41KTsgLy8gUmV0dXJuIHRoZSBtaWRwb2ludCBpbnRlcnBvbGFudFxuICAgICAqIHJlc3VsdCA9IG5ldyBwYy5RdWF0KCkuc2xlcnAocTEsIHEyLCAxKTsgICAvLyBSZXR1cm4gcTJcbiAgICAgKi9cbiAgICBzbGVycChsaHMsIHJocywgYWxwaGEpIHtcbiAgICAgICAgLy8gQWxnb3JpdGhtIHNvdXJjZWQgZnJvbTpcbiAgICAgICAgLy8gaHR0cDovL3d3dy5ldWNsaWRlYW5zcGFjZS5jb20vbWF0aHMvYWxnZWJyYS9yZWFsTm9ybWVkQWxnZWJyYS9xdWF0ZXJuaW9ucy9zbGVycC9cbiAgICAgICAgY29uc3QgbHggPSBsaHMueDtcbiAgICAgICAgY29uc3QgbHkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgbHogPSBsaHMuejtcbiAgICAgICAgY29uc3QgbHcgPSBsaHMudztcbiAgICAgICAgbGV0IHJ4ID0gcmhzLng7XG4gICAgICAgIGxldCByeSA9IHJocy55O1xuICAgICAgICBsZXQgcnogPSByaHMuejtcbiAgICAgICAgbGV0IHJ3ID0gcmhzLnc7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGFuZ2xlIGJldHdlZW4gdGhlbS5cbiAgICAgICAgbGV0IGNvc0hhbGZUaGV0YSA9IGx3ICogcncgKyBseCAqIHJ4ICsgbHkgKiByeSArIGx6ICogcno7XG5cbiAgICAgICAgaWYgKGNvc0hhbGZUaGV0YSA8IDApIHtcbiAgICAgICAgICAgIHJ3ID0gLXJ3O1xuICAgICAgICAgICAgcnggPSAtcng7XG4gICAgICAgICAgICByeSA9IC1yeTtcbiAgICAgICAgICAgIHJ6ID0gLXJ6O1xuICAgICAgICAgICAgY29zSGFsZlRoZXRhID0gLWNvc0hhbGZUaGV0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGxocyA9PSByaHMgb3IgbGhzID09IC1yaHMgdGhlbiB0aGV0YSA9PSAwIGFuZCB3ZSBjYW4gcmV0dXJuIGxoc1xuICAgICAgICBpZiAoTWF0aC5hYnMoY29zSGFsZlRoZXRhKSA+PSAxKSB7XG4gICAgICAgICAgICB0aGlzLncgPSBsdztcbiAgICAgICAgICAgIHRoaXMueCA9IGx4O1xuICAgICAgICAgICAgdGhpcy55ID0gbHk7XG4gICAgICAgICAgICB0aGlzLnogPSBsejtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIHRlbXBvcmFyeSB2YWx1ZXMuXG4gICAgICAgIGNvbnN0IGhhbGZUaGV0YSA9IE1hdGguYWNvcyhjb3NIYWxmVGhldGEpO1xuICAgICAgICBjb25zdCBzaW5IYWxmVGhldGEgPSBNYXRoLnNxcnQoMSAtIGNvc0hhbGZUaGV0YSAqIGNvc0hhbGZUaGV0YSk7XG5cbiAgICAgICAgLy8gSWYgdGhldGEgPSAxODAgZGVncmVlcyB0aGVuIHJlc3VsdCBpcyBub3QgZnVsbHkgZGVmaW5lZFxuICAgICAgICAvLyB3ZSBjb3VsZCByb3RhdGUgYXJvdW5kIGFueSBheGlzIG5vcm1hbCB0byBxYSBvciBxYlxuICAgICAgICBpZiAoTWF0aC5hYnMoc2luSGFsZlRoZXRhKSA8IDAuMDAxKSB7XG4gICAgICAgICAgICB0aGlzLncgPSAobHcgKiAwLjUgKyBydyAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnggPSAobHggKiAwLjUgKyByeCAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnkgPSAobHkgKiAwLjUgKyByeSAqIDAuNSk7XG4gICAgICAgICAgICB0aGlzLnogPSAobHogKiAwLjUgKyByeiAqIDAuNSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJhdGlvQSA9IE1hdGguc2luKCgxIC0gYWxwaGEpICogaGFsZlRoZXRhKSAvIHNpbkhhbGZUaGV0YTtcbiAgICAgICAgY29uc3QgcmF0aW9CID0gTWF0aC5zaW4oYWxwaGEgKiBoYWxmVGhldGEpIC8gc2luSGFsZlRoZXRhO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBRdWF0ZXJuaW9uLlxuICAgICAgICB0aGlzLncgPSAobHcgKiByYXRpb0EgKyBydyAqIHJhdGlvQik7XG4gICAgICAgIHRoaXMueCA9IChseCAqIHJhdGlvQSArIHJ4ICogcmF0aW9CKTtcbiAgICAgICAgdGhpcy55ID0gKGx5ICogcmF0aW9BICsgcnkgKiByYXRpb0IpO1xuICAgICAgICB0aGlzLnogPSAobHogKiByYXRpb0EgKyByeiAqIHJhdGlvQik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zZm9ybXMgYSAzLWRpbWVuc2lvbmFsIHZlY3RvciBieSB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHZlYyAtIFRoZSAzLWRpbWVuc2lvbmFsIHZlY3RvciB0byBiZSB0cmFuc2Zvcm1lZC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtyZXNdIC0gQW4gb3B0aW9uYWwgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgcmVzdWx0IG9mIHRoZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIGlucHV0IHZlY3RvciB2IHRyYW5zZm9ybWVkIGJ5IHRoZSBjdXJyZW50IGluc3RhbmNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3JcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMzKDEsIDIsIDMpO1xuICAgICAqXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeFxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMTAsIDIwLCAzMCk7XG4gICAgICpcbiAgICAgKiB2YXIgdHYgPSBxLnRyYW5zZm9ybVZlY3Rvcih2KTtcbiAgICAgKi9cbiAgICB0cmFuc2Zvcm1WZWN0b3IodmVjLCByZXMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGNvbnN0IHggPSB2ZWMueCwgeSA9IHZlYy55LCB6ID0gdmVjLno7XG4gICAgICAgIGNvbnN0IHF4ID0gdGhpcy54LCBxeSA9IHRoaXMueSwgcXogPSB0aGlzLnosIHF3ID0gdGhpcy53O1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBxdWF0ICogdmVjXG4gICAgICAgIGNvbnN0IGl4ID0gcXcgKiB4ICsgcXkgKiB6IC0gcXogKiB5O1xuICAgICAgICBjb25zdCBpeSA9IHF3ICogeSArIHF6ICogeCAtIHF4ICogejtcbiAgICAgICAgY29uc3QgaXogPSBxdyAqIHogKyBxeCAqIHkgLSBxeSAqIHg7XG4gICAgICAgIGNvbnN0IGl3ID0gLXF4ICogeCAtIHF5ICogeSAtIHF6ICogejtcblxuICAgICAgICAvLyBjYWxjdWxhdGUgcmVzdWx0ICogaW52ZXJzZSBxdWF0XG4gICAgICAgIHJlcy54ID0gaXggKiBxdyArIGl3ICogLXF4ICsgaXkgKiAtcXogLSBpeiAqIC1xeTtcbiAgICAgICAgcmVzLnkgPSBpeSAqIHF3ICsgaXcgKiAtcXkgKyBpeiAqIC1xeCAtIGl4ICogLXF6O1xuICAgICAgICByZXMueiA9IGl6ICogcXcgKyBpdyAqIC1xeiArIGl4ICogLXF5IC0gaXkgKiAtcXg7XG5cbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgcXVhdGVybmlvbiB0byBzdHJpbmcgZm9ybS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBxdWF0ZXJuaW9uIGluIHN0cmluZyBmb3JtLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHYgPSBuZXcgcGMuUXVhdCgwLCAwLCAwLCAxKTtcbiAgICAgKiAvLyBPdXRwdXRzIFswLCAwLCAwLCAxXVxuICAgICAqIGNvbnNvbGUubG9nKHYudG9TdHJpbmcoKSk7XG4gICAgICovXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiBgWyR7dGhpcy54fSwgJHt0aGlzLnl9LCAke3RoaXMuen0sICR7dGhpcy53fV1gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgY29uc3RhbnQgcXVhdGVybmlvbiBzZXQgdG8gWzAsIDAsIDAsIDFdICh0aGUgaWRlbnRpdHkpLlxuICAgICAqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIElERU5USVRZID0gT2JqZWN0LmZyZWV6ZShuZXcgUXVhdCgwLCAwLCAwLCAxKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHF1YXRlcm5pb24gc2V0IHRvIFswLCAwLCAwLCAwXS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBaRVJPID0gT2JqZWN0LmZyZWV6ZShuZXcgUXVhdCgwLCAwLCAwLCAwKSk7XG59XG5cbmV4cG9ydCB7IFF1YXQgfTtcbiJdLCJuYW1lcyI6WyJRdWF0IiwiY29uc3RydWN0b3IiLCJ4IiwieSIsInoiLCJ3IiwibGVuZ3RoIiwiY2xvbmUiLCJjc3RyIiwiY29uanVnYXRlIiwiY29weSIsInJocyIsImVxdWFscyIsImdldEF4aXNBbmdsZSIsImF4aXMiLCJyYWQiLCJNYXRoIiwiYWNvcyIsInMiLCJzaW4iLCJtYXRoIiwiUkFEX1RPX0RFRyIsImdldEV1bGVyQW5nbGVzIiwiZXVsZXJzIiwiVmVjMyIsInF4IiwicXkiLCJxeiIsInF3IiwiYTIiLCJhdGFuMiIsIlBJIiwiYXNpbiIsInNldCIsIm11bFNjYWxhciIsImludmVydCIsIm5vcm1hbGl6ZSIsInNxcnQiLCJsZW5ndGhTcSIsIm11bCIsInExeCIsInExeSIsInExeiIsInExdyIsInEyeCIsInEyeSIsInEyeiIsInEydyIsIm11bDIiLCJsaHMiLCJsZW4iLCJzZXRGcm9tQXhpc0FuZ2xlIiwiYW5nbGUiLCJERUdfVE9fUkFEIiwic2EiLCJjYSIsImNvcyIsInNldEZyb21FdWxlckFuZ2xlcyIsImV4IiwiZXkiLCJleiIsInZlYyIsImhhbGZUb1JhZCIsInN4IiwiY3giLCJzeSIsImN5Iiwic3oiLCJjeiIsInNldEZyb21NYXQ0IiwibSIsIm0wMCIsIm0wMSIsIm0wMiIsIm0xMCIsIm0xMSIsIm0xMiIsIm0yMCIsIm0yMSIsIm0yMiIsInJzIiwibHgiLCJseSIsImx6IiwiZGF0YSIsInRyIiwic2xlcnAiLCJhbHBoYSIsImx3IiwicngiLCJyeSIsInJ6IiwicnciLCJjb3NIYWxmVGhldGEiLCJhYnMiLCJoYWxmVGhldGEiLCJzaW5IYWxmVGhldGEiLCJyYXRpb0EiLCJyYXRpb0IiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJyZXMiLCJpeCIsIml5IiwiaXoiLCJpdyIsInRvU3RyaW5nIiwiSURFTlRJVFkiLCJPYmplY3QiLCJmcmVlemUiLCJaRVJPIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQU1BLE1BQU1BLElBQUksQ0FBQztBQVVQQyxFQUFBQSxXQUFXLENBQUNDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUVDLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDcEMsSUFBQSxJQUFJSCxDQUFDLENBQUNJLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFNaEIs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
