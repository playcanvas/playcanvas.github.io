/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVhdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9xdWF0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4vdmVjMy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL21hdDQuanMnKS5NYXQ0fSBNYXQ0ICovXG5cbi8qKlxuICogQSBxdWF0ZXJuaW9uLlxuICovXG5jbGFzcyBRdWF0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUXVhdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bWJlcltdfSBbeF0gLSBUaGUgcXVhdGVybmlvbidzIHggY29tcG9uZW50LiBEZWZhdWx0cyB0byAwLiBJZiB4IGlzIGFuIGFycmF5XG4gICAgICogb2YgbGVuZ3RoIDQsIHRoZSBhcnJheSB3aWxsIGJlIHVzZWQgdG8gcG9wdWxhdGUgYWxsIGNvbXBvbmVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt5XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeSBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt6XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgeiBjb21wb25lbnQuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3XSAtIFRoZSBxdWF0ZXJuaW9uJ3MgdyBjb21wb25lbnQuIERlZmF1bHRzIHRvIDEuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoeCA9IDAsIHkgPSAwLCB6ID0gMCwgdyA9IDEpIHtcbiAgICAgICAgaWYgKHgubGVuZ3RoID09PSA0KSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSB4IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLnggPSB4WzBdO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgeSBjb21wb25lbnQgb2YgdGhlIHF1YXRlcm5pb24uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy55ID0geFsxXTtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIHogY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMueiA9IHhbMl07XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSB3IGNvbXBvbmVudCBvZiB0aGUgcXVhdGVybmlvbi5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLncgPSB4WzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgICAgICB0aGlzLnogPSB6O1xuICAgICAgICAgICAgdGhpcy53ID0gdztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYW4gaWRlbnRpY2FsIGNvcHkgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IEEgcXVhdGVybmlvbiBjb250YWluaW5nIHRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KC0wLjExLCAtMC4xNSwgLTAuNDYsIDAuODcpO1xuICAgICAqIHZhciBxY2xvbmUgPSBxLmNsb25lKCk7XG4gICAgICpcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcgaXM6IFwiICsgcS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgLyoqIEB0eXBlIHt0aGlzfSAqL1xuICAgICAgICBjb25zdCBjc3RyID0gdGhpcy5jb25zdHJ1Y3RvcjtcbiAgICAgICAgcmV0dXJuIG5ldyBjc3RyKHRoaXMueCwgdGhpcy55LCB0aGlzLnosIHRoaXMudyk7XG4gICAgfVxuXG4gICAgY29uanVnYXRlKCkge1xuICAgICAgICB0aGlzLnggKj0gLTE7XG4gICAgICAgIHRoaXMueSAqPSAtMTtcbiAgICAgICAgdGhpcy56ICo9IC0xO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2UgcXVhdGVybmlvbiB0byBhIGRlc3RpbmF0aW9uIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvcGllZC5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgc3JjID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiB2YXIgZHN0ID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBkc3QuY29weShzcmMsIHNyYyk7XG4gICAgICogY29uc29sZS5sb2coXCJUaGUgdHdvIHF1YXRlcm5pb25zIGFyZSBcIiArIChzcmMuZXF1YWxzKGRzdCkgPyBcImVxdWFsXCIgOiBcImRpZmZlcmVudFwiKSk7XG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy54ID0gcmhzLng7XG4gICAgICAgIHRoaXMueSA9IHJocy55O1xuICAgICAgICB0aGlzLnogPSByaHMuejtcbiAgICAgICAgdGhpcy53ID0gcmhzLnc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIHR3byBxdWF0ZXJuaW9ucyBhcmUgZXF1YWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGJlIGNvbXBhcmVkIGFnYWluc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHF1YXRlcm5pb25zIGFyZSBlcXVhbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSB0d28gcXVhdGVybmlvbnMgYXJlIFwiICsgKGEuZXF1YWxzKGIpID8gXCJlcXVhbFwiIDogXCJkaWZmZXJlbnRcIikpO1xuICAgICAqL1xuICAgIGVxdWFscyhyaHMpIHtcbiAgICAgICAgcmV0dXJuICgodGhpcy54ID09PSByaHMueCkgJiYgKHRoaXMueSA9PT0gcmhzLnkpICYmICh0aGlzLnogPT09IHJocy56KSAmJiAodGhpcy53ID09PSByaHMudykpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHJvdGF0aW9uIGF4aXMgYW5kIGFuZ2xlIGZvciBhIGdpdmVuIHF1YXRlcm5pb24uIElmIGEgcXVhdGVybmlvbiBpcyBjcmVhdGVkIHdpdGhcbiAgICAgKiBgc2V0RnJvbUF4aXNBbmdsZWAsIHRoaXMgbWV0aG9kIHdpbGwgcmV0dXJuIHRoZSBzYW1lIHZhbHVlcyBhcyBwcm92aWRlZCBpbiB0aGUgb3JpZ2luYWxcbiAgICAgKiBwYXJhbWV0ZXIgbGlzdCBPUiBmdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB2YWx1ZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGF4aXMgLSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gcmVjZWl2ZSB0aGUgYXhpcyBvZiByb3RhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBbmdsZSwgaW4gZGVncmVlcywgb2YgdGhlIHJvdGF0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgpO1xuICAgICAqIHEuc2V0RnJvbUF4aXNBbmdsZShuZXcgcGMuVmVjMygwLCAxLCAwKSwgOTApO1xuICAgICAqIHZhciB2ID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiB2YXIgYW5nbGUgPSBxLmdldEF4aXNBbmdsZSh2KTtcbiAgICAgKiAvLyBPdXRwdXRzIDkwXG4gICAgICogY29uc29sZS5sb2coYW5nbGUpO1xuICAgICAqIC8vIE91dHB1dHMgWzAsIDEsIDBdXG4gICAgICogY29uc29sZS5sb2codi50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBnZXRBeGlzQW5nbGUoYXhpcykge1xuICAgICAgICBsZXQgcmFkID0gTWF0aC5hY29zKHRoaXMudykgKiAyO1xuICAgICAgICBjb25zdCBzID0gTWF0aC5zaW4ocmFkIC8gMik7XG4gICAgICAgIGlmIChzICE9PSAwKSB7XG4gICAgICAgICAgICBheGlzLnggPSB0aGlzLnggLyBzO1xuICAgICAgICAgICAgYXhpcy55ID0gdGhpcy55IC8gcztcbiAgICAgICAgICAgIGF4aXMueiA9IHRoaXMueiAvIHM7XG4gICAgICAgICAgICBpZiAoYXhpcy54IDwgMCB8fCBheGlzLnkgPCAwIHx8IGF4aXMueiA8IDApIHtcbiAgICAgICAgICAgICAgICAvLyBGbGlwIHRoZSBzaWduXG4gICAgICAgICAgICAgICAgYXhpcy54ICo9IC0xO1xuICAgICAgICAgICAgICAgIGF4aXMueSAqPSAtMTtcbiAgICAgICAgICAgICAgICBheGlzLnogKj0gLTE7XG4gICAgICAgICAgICAgICAgcmFkICo9IC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSWYgcyBpcyB6ZXJvLCByZXR1cm4gYW55IGF4aXMgKG5vIHJvdGF0aW9uIC0gYXhpcyBkb2VzIG5vdCBtYXR0ZXIpXG4gICAgICAgICAgICBheGlzLnggPSAxO1xuICAgICAgICAgICAgYXhpcy55ID0gMDtcbiAgICAgICAgICAgIGF4aXMueiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJhZCAqIG1hdGguUkFEX1RPX0RFRztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyB0aGUgc3VwcGxpZWQgcXVhdGVybmlvbiB0byBFdWxlciBhbmdsZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtldWxlcnNdIC0gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIEV1bGVyIGFuZ2xlcy5cbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIDMtZGltZW5zaW9uYWwgdmVjdG9yIGhvbGRpbmcgdGhlIEV1bGVyIGFuZ2xlcyB0aGF0XG4gICAgICogY29ycmVzcG9uZCB0byB0aGUgc3VwcGxpZWQgcXVhdGVybmlvbi5cbiAgICAgKi9cbiAgICBnZXRFdWxlckFuZ2xlcyhldWxlcnMgPSBuZXcgVmVjMygpKSB7XG4gICAgICAgIGxldCB4LCB5LCB6O1xuXG4gICAgICAgIGNvbnN0IHF4ID0gdGhpcy54O1xuICAgICAgICBjb25zdCBxeSA9IHRoaXMueTtcbiAgICAgICAgY29uc3QgcXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHF3ID0gdGhpcy53O1xuXG4gICAgICAgIGNvbnN0IGEyID0gMiAqIChxdyAqIHF5IC0gcXggKiBxeik7XG5cbiAgICAgICAgaWYgKGEyIDw9IC0wLjk5OTk5KSB7XG4gICAgICAgICAgICB4ID0gMiAqIE1hdGguYXRhbjIocXgsIHF3KTtcbiAgICAgICAgICAgIHkgPSAtTWF0aC5QSSAvIDI7XG4gICAgICAgICAgICB6ID0gMDtcbiAgICAgICAgfSBlbHNlIGlmIChhMiA+PSAwLjk5OTk5KSB7XG4gICAgICAgICAgICB4ID0gMiAqIE1hdGguYXRhbjIocXgsIHF3KTtcbiAgICAgICAgICAgIHkgPSBNYXRoLlBJIC8gMjtcbiAgICAgICAgICAgIHogPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IE1hdGguYXRhbjIoMiAqIChxdyAqIHF4ICsgcXkgKiBxeiksIDEgLSAyICogKHF4ICogcXggKyBxeSAqIHF5KSk7XG4gICAgICAgICAgICB5ID0gTWF0aC5hc2luKGEyKTtcbiAgICAgICAgICAgIHogPSBNYXRoLmF0YW4yKDIgKiAocXcgKiBxeiArIHF4ICogcXkpLCAxIC0gMiAqIChxeSAqIHF5ICsgcXogKiBxeikpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV1bGVycy5zZXQoeCwgeSwgeikubXVsU2NhbGFyKG1hdGguUkFEX1RPX0RFRyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIHRoZSBpbnZlcnNlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gcm90YXRlZCAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciByb3QgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21FdWxlckFuZ2xlcygwLCAxODAsIDApO1xuICAgICAqXG4gICAgICogLy8gSW52ZXJ0IGluIHBsYWNlXG4gICAgICogcm90LmludmVydCgpO1xuICAgICAqL1xuICAgIGludmVydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uanVnYXRlKCkubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBtYWduaXR1ZGUgb2YgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgwLCAwLCAwLCA1KTtcbiAgICAgKiB2YXIgbGVuID0gcS5sZW5ndGgoKTtcbiAgICAgKiAvLyBPdXRwdXRzIDVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggb2YgdGhlIHF1YXRlcm5pb24gaXM6IFwiICsgbGVuKTtcbiAgICAgKi9cbiAgICBsZW5ndGgoKSB7XG4gICAgICAgIHJldHVybiBNYXRoLnNxcnQodGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55ICsgdGhpcy56ICogdGhpcy56ICsgdGhpcy53ICogdGhpcy53KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBtYWduaXR1ZGUgc3F1YXJlZCBvZiB0aGUgc3BlY2lmaWVkIHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbWFnbml0dWRlIG9mIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoMywgNCwgMCk7XG4gICAgICogdmFyIGxlblNxID0gcS5sZW5ndGhTcSgpO1xuICAgICAqIC8vIE91dHB1dHMgMjVcbiAgICAgKiBjb25zb2xlLmxvZyhcIlRoZSBsZW5ndGggc3F1YXJlZCBvZiB0aGUgcXVhdGVybmlvbiBpczogXCIgKyBsZW5TcSk7XG4gICAgICovXG4gICAgbGVuZ3RoU3EoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnggKiB0aGlzLnggKyB0aGlzLnkgKiB0aGlzLnkgKyB0aGlzLnogKiB0aGlzLnogKyB0aGlzLncgKiB0aGlzLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIHNlY29uZCBtdWx0aXBsaWNhbmQgb2YgdGhlIG9wZXJhdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDMwLCAwKTtcbiAgICAgKiB2YXIgYiA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDAsIDYwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIGEgYmVjb21lcyBhIDkwIGRlZ3JlZSByb3RhdGlvbiBhcm91bmQgdGhlIFkgYXhpc1xuICAgICAqIC8vIEluIG90aGVyIHdvcmRzLCBhID0gYSAqIGJcbiAgICAgKiBhLm11bChiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgYS50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwocmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IHRoaXMueDtcbiAgICAgICAgY29uc3QgcTF5ID0gdGhpcy55O1xuICAgICAgICBjb25zdCBxMXogPSB0aGlzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IHRoaXMudztcblxuICAgICAgICBjb25zdCBxMnggPSByaHMueDtcbiAgICAgICAgY29uc3QgcTJ5ID0gcmhzLnk7XG4gICAgICAgIGNvbnN0IHEyeiA9IHJocy56O1xuICAgICAgICBjb25zdCBxMncgPSByaHMudztcblxuICAgICAgICB0aGlzLnggPSBxMXcgKiBxMnggKyBxMXggKiBxMncgKyBxMXkgKiBxMnogLSBxMXogKiBxMnk7XG4gICAgICAgIHRoaXMueSA9IHExdyAqIHEyeSArIHExeSAqIHEydyArIHExeiAqIHEyeCAtIHExeCAqIHEyejtcbiAgICAgICAgdGhpcy56ID0gcTF3ICogcTJ6ICsgcTF6ICogcTJ3ICsgcTF4ICogcTJ5IC0gcTF5ICogcTJ4O1xuICAgICAgICB0aGlzLncgPSBxMXcgKiBxMncgLSBxMXggKiBxMnggLSBxMXkgKiBxMnkgLSBxMXogKiBxMno7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcmVzdWx0IG9mIG11bHRpcGx5aW5nIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbnMgdG9nZXRoZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IGxocyAtIFRoZSBxdWF0ZXJuaW9uIHVzZWQgYXMgdGhlIGZpcnN0IG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7UXVhdH0gcmhzIC0gVGhlIHF1YXRlcm5pb24gdXNlZCBhcyB0aGUgc2Vjb25kIG11bHRpcGxpY2FuZCBvZiB0aGUgb3BlcmF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgMzAsIDApO1xuICAgICAqIHZhciBiID0gbmV3IHBjLlF1YXQoKS5zZXRGcm9tRXVsZXJBbmdsZXMoMCwgNjAsIDApO1xuICAgICAqIHZhciByID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKlxuICAgICAqIC8vIHIgaXMgc2V0IHRvIGEgOTAgZGVncmVlIHJvdGF0aW9uIGFyb3VuZCB0aGUgWSBheGlzXG4gICAgICogLy8gSW4gb3RoZXIgd29yZHMsIHIgPSBhICogYlxuICAgICAqIHIubXVsMihhLCBiKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgbXVsdGlwbGljYXRpb24gaXM6IFwiICsgci50b1N0cmluZygpKTtcbiAgICAgKi9cbiAgICBtdWwyKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IHExeCA9IGxocy54O1xuICAgICAgICBjb25zdCBxMXkgPSBsaHMueTtcbiAgICAgICAgY29uc3QgcTF6ID0gbGhzLno7XG4gICAgICAgIGNvbnN0IHExdyA9IGxocy53O1xuXG4gICAgICAgIGNvbnN0IHEyeCA9IHJocy54O1xuICAgICAgICBjb25zdCBxMnkgPSByaHMueTtcbiAgICAgICAgY29uc3QgcTJ6ID0gcmhzLno7XG4gICAgICAgIGNvbnN0IHEydyA9IHJocy53O1xuXG4gICAgICAgIHRoaXMueCA9IHExdyAqIHEyeCArIHExeCAqIHEydyArIHExeSAqIHEyeiAtIHExeiAqIHEyeTtcbiAgICAgICAgdGhpcy55ID0gcTF3ICogcTJ5ICsgcTF5ICogcTJ3ICsgcTF6ICogcTJ4IC0gcTF4ICogcTJ6O1xuICAgICAgICB0aGlzLnogPSBxMXcgKiBxMnogKyBxMXogKiBxMncgKyBxMXggKiBxMnkgLSBxMXkgKiBxMng7XG4gICAgICAgIHRoaXMudyA9IHExdyAqIHEydyAtIHExeCAqIHEyeCAtIHExeSAqIHEyeSAtIHExeiAqIHEyejtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiBjb252ZXJ0ZWQgaW4gcGxhY2UgdG8gYSB1bml0IHF1YXRlcm5pb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHJlc3VsdCBvZiB0aGUgbm9ybWFsaXphdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ID0gbmV3IHBjLlF1YXQoMCwgMCwgMCwgNSk7XG4gICAgICpcbiAgICAgKiB2Lm5vcm1hbGl6ZSgpO1xuICAgICAqXG4gICAgICogLy8gT3V0cHV0cyAwLCAwLCAwLCAxXG4gICAgICogY29uc29sZS5sb2coXCJUaGUgcmVzdWx0IG9mIHRoZSB2ZWN0b3Igbm9ybWFsaXphdGlvbiBpczogXCIgKyB2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIG5vcm1hbGl6ZSgpIHtcbiAgICAgICAgbGV0IGxlbiA9IHRoaXMubGVuZ3RoKCk7XG4gICAgICAgIGlmIChsZW4gPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMueCA9IHRoaXMueSA9IHRoaXMueiA9IDA7XG4gICAgICAgICAgICB0aGlzLncgPSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGVuID0gMSAvIGxlbjtcbiAgICAgICAgICAgIHRoaXMueCAqPSBsZW47XG4gICAgICAgICAgICB0aGlzLnkgKj0gbGVuO1xuICAgICAgICAgICAgdGhpcy56ICo9IGxlbjtcbiAgICAgICAgICAgIHRoaXMudyAqPSBsZW47XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgcXVhdGVybmlvbiB0byB0aGUgc3VwcGxpZWQgbnVtZXJpY2FsIHZhbHVlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6IC0gVGhlIHogY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHcgY29tcG9uZW50IG9mIHRoZSBxdWF0ZXJuaW9uLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldCgxLCAwLCAwLCAwKTtcbiAgICAgKlxuICAgICAqIC8vIE91dHB1dHMgMSwgMCwgMCwgMFxuICAgICAqIGNvbnNvbGUubG9nKFwiVGhlIHJlc3VsdCBvZiB0aGUgdmVjdG9yIHNldCBpczogXCIgKyBxLnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHNldCh4LCB5LCB6LCB3KSB7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIHRoaXMueiA9IHo7XG4gICAgICAgIHRoaXMudyA9IHc7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBhbiBhbmd1bGFyIHJvdGF0aW9uIGFyb3VuZCBhbiBheGlzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBheGlzIC0gV29ybGQgc3BhY2UgYXhpcyBhcm91bmQgd2hpY2ggdG8gcm90YXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbmdsZSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgdGhlIGdpdmVuIGF4aXMgaW4gZGVncmVlcy5cbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogcS5zZXRGcm9tQXhpc0FuZ2xlKHBjLlZlYzMuVVAsIDkwKTtcbiAgICAgKi9cbiAgICBzZXRGcm9tQXhpc0FuZ2xlKGF4aXMsIGFuZ2xlKSB7XG4gICAgICAgIGFuZ2xlICo9IDAuNSAqIG1hdGguREVHX1RPX1JBRDtcblxuICAgICAgICBjb25zdCBzYSA9IE1hdGguc2luKGFuZ2xlKTtcbiAgICAgICAgY29uc3QgY2EgPSBNYXRoLmNvcyhhbmdsZSk7XG5cbiAgICAgICAgdGhpcy54ID0gc2EgKiBheGlzLng7XG4gICAgICAgIHRoaXMueSA9IHNhICogYXhpcy55O1xuICAgICAgICB0aGlzLnogPSBzYSAqIGF4aXMuejtcbiAgICAgICAgdGhpcy53ID0gY2E7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHF1YXRlcm5pb24gZnJvbSBFdWxlciBhbmdsZXMgc3BlY2lmaWVkIGluIFhZWiBvcmRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfFZlYzN9IGV4IC0gQW5nbGUgdG8gcm90YXRlIGFyb3VuZCBYIGF4aXMgaW4gZGVncmVlcy4gSWYgZXggaXMgYSBWZWMzLCB0aGVcbiAgICAgKiB0aHJlZSBhbmdsZXMgd2lsbCBiZSByZWFkIGZyb20gaXQgaW5zdGVhZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2V5XSAtIEFuZ2xlIHRvIHJvdGF0ZSBhcm91bmQgWSBheGlzIGluIGRlZ3JlZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtlel0gLSBBbmdsZSB0byByb3RhdGUgYXJvdW5kIFogYXhpcyBpbiBkZWdyZWVzLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIHF1YXRlcm5pb24gZnJvbSAzIGV1bGVyIGFuZ2xlc1xuICAgICAqIHZhciBxID0gbmV3IHBjLlF1YXQoKTtcbiAgICAgKiBxLnNldEZyb21FdWxlckFuZ2xlcyg0NSwgOTAsIDE4MCk7XG4gICAgICpcbiAgICAgKiAvLyBDcmVhdGUgdGhlIHNhbWUgcXVhdGVybmlvbiBmcm9tIGEgdmVjdG9yIGNvbnRhaW5pbmcgdGhlIHNhbWUgMyBldWxlciBhbmdsZXNcbiAgICAgKiB2YXIgdiA9IG5ldyBwYy5WZWMzKDQ1LCA5MCwgMTgwKTtcbiAgICAgKiB2YXIgciA9IG5ldyBwYy5RdWF0KCk7XG4gICAgICogci5zZXRGcm9tRXVsZXJBbmdsZXModik7XG4gICAgICovXG4gICAgc2V0RnJvbUV1bGVyQW5nbGVzKGV4LCBleSwgZXopIHtcbiAgICAgICAgaWYgKGV4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgY29uc3QgdmVjID0gZXg7XG4gICAgICAgICAgICBleCA9IHZlYy54O1xuICAgICAgICAgICAgZXkgPSB2ZWMueTtcbiAgICAgICAgICAgIGV6ID0gdmVjLno7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYWxmVG9SYWQgPSAwLjUgKiBtYXRoLkRFR19UT19SQUQ7XG4gICAgICAgIGV4ICo9IGhhbGZUb1JhZDtcbiAgICAgICAgZXkgKj0gaGFsZlRvUmFkO1xuICAgICAgICBleiAqPSBoYWxmVG9SYWQ7XG5cbiAgICAgICAgY29uc3Qgc3ggPSBNYXRoLnNpbihleCk7XG4gICAgICAgIGNvbnN0IGN4ID0gTWF0aC5jb3MoZXgpO1xuICAgICAgICBjb25zdCBzeSA9IE1hdGguc2luKGV5KTtcbiAgICAgICAgY29uc3QgY3kgPSBNYXRoLmNvcyhleSk7XG4gICAgICAgIGNvbnN0IHN6ID0gTWF0aC5zaW4oZXopO1xuICAgICAgICBjb25zdCBjeiA9IE1hdGguY29zKGV6KTtcblxuICAgICAgICB0aGlzLnggPSBzeCAqIGN5ICogY3ogLSBjeCAqIHN5ICogc3o7XG4gICAgICAgIHRoaXMueSA9IGN4ICogc3kgKiBjeiArIHN4ICogY3kgKiBzejtcbiAgICAgICAgdGhpcy56ID0gY3ggKiBjeSAqIHN6IC0gc3ggKiBzeSAqIGN6O1xuICAgICAgICB0aGlzLncgPSBjeCAqIGN5ICogY3ogKyBzeCAqIHN5ICogc3o7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHNwZWNpZmllZCA0eDQgbWF0cml4IHRvIGEgcXVhdGVybmlvbi4gTm90ZSB0aGF0IHNpbmNlIGEgcXVhdGVybmlvbiBpcyBwdXJlbHkgYVxuICAgICAqIHJlcHJlc2VudGF0aW9uIGZvciBvcmllbnRhdGlvbiwgb25seSB0aGUgdHJhbnNsYXRpb25hbCBwYXJ0IG9mIHRoZSBtYXRyaXggaXMgbG9zdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbSAtIFRoZSA0eDQgbWF0cml4IHRvIGNvbnZlcnQuXG4gICAgICogQHJldHVybnMge1F1YXR9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgNHg0IHJvdGF0aW9uIG1hdHJpeCBvZiAxODAgZGVncmVlcyBhcm91bmQgdGhlIHktYXhpc1xuICAgICAqIHZhciByb3QgPSBuZXcgcGMuTWF0NCgpLnNldEZyb21BeGlzQW5nbGUocGMuVmVjMy5VUCwgMTgwKTtcbiAgICAgKlxuICAgICAqIC8vIENvbnZlcnQgdG8gYSBxdWF0ZXJuaW9uXG4gICAgICogdmFyIHEgPSBuZXcgcGMuUXVhdCgpLnNldEZyb21NYXQ0KHJvdCk7XG4gICAgICovXG4gICAgc2V0RnJvbU1hdDQobSkge1xuICAgICAgICBsZXQgbTAwLCBtMDEsIG0wMiwgbTEwLCBtMTEsIG0xMiwgbTIwLCBtMjEsIG0yMixcbiAgICAgICAgICAgIHMsIHJzLCBseCwgbHksIGx6O1xuXG4gICAgICAgIG0gPSBtLmRhdGE7XG5cbiAgICAgICAgLy8gQ2FjaGUgbWF0cml4IHZhbHVlcyBmb3Igc3VwZXItc3BlZWRcbiAgICAgICAgbTAwID0gbVswXTtcbiAgICAgICAgbTAxID0gbVsxXTtcbiAgICAgICAgbTAyID0gbVsyXTtcbiAgICAgICAgbTEwID0gbVs0XTtcbiAgICAgICAgbTExID0gbVs1XTtcbiAgICAgICAgbTEyID0gbVs2XTtcbiAgICAgICAgbTIwID0gbVs4XTtcbiAgICAgICAgbTIxID0gbVs5XTtcbiAgICAgICAgbTIyID0gbVsxMF07XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBzY2FsZSBmcm9tIHRoZSBtYXRyaXhcbiAgICAgICAgbHggPSBtMDAgKiBtMDAgKyBtMDEgKiBtMDEgKyBtMDIgKiBtMDI7XG4gICAgICAgIGlmIChseCA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICBseCA9IDEgLyBNYXRoLnNxcnQobHgpO1xuICAgICAgICBseSA9IG0xMCAqIG0xMCArIG0xMSAqIG0xMSArIG0xMiAqIG0xMjtcbiAgICAgICAgaWYgKGx5ID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGx5ID0gMSAvIE1hdGguc3FydChseSk7XG4gICAgICAgIGx6ID0gbTIwICogbTIwICsgbTIxICogbTIxICsgbTIyICogbTIyO1xuICAgICAgICBpZiAobHogPT09IDApXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgbHogPSAxIC8gTWF0aC5zcXJ0KGx6KTtcblxuICAgICAgICBtMDAgKj0gbHg7XG4gICAgICAgIG0wMSAqPSBseDtcbiAgICAgICAgbTAyICo9IGx4O1xuICAgICAgICBtMTAgKj0gbHk7XG4gICAgICAgIG0xMSAqPSBseTtcbiAgICAgICAgbTEyICo9IGx5O1xuICAgICAgICBtMjAgKj0gbHo7XG4gICAgICAgIG0yMSAqPSBsejtcbiAgICAgICAgbTIyICo9IGx6O1xuXG4gICAgICAgIC8vIGh0dHA6Ly93d3cuY3MudWNyLmVkdS9+dmJ6L3Jlc291cmNlcy9xdWF0dXQucGRmXG5cbiAgICAgICAgY29uc3QgdHIgPSBtMDAgKyBtMTEgKyBtMjI7XG4gICAgICAgIGlmICh0ciA+PSAwKSB7XG4gICAgICAgICAgICBzID0gTWF0aC5zcXJ0KHRyICsgMSk7XG4gICAgICAgICAgICB0aGlzLncgPSBzICogMC41O1xuICAgICAgICAgICAgcyA9IDAuNSAvIHM7XG4gICAgICAgICAgICB0aGlzLnggPSAobTEyIC0gbTIxKSAqIHM7XG4gICAgICAgICAgICB0aGlzLnkgPSAobTIwIC0gbTAyKSAqIHM7XG4gICAgICAgICAgICB0aGlzLnogPSAobTAxIC0gbTEwKSAqIHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAobTAwID4gbTExKSB7XG4gICAgICAgICAgICAgICAgaWYgKG0wMCA+IG0yMikge1xuICAgICAgICAgICAgICAgICAgICAvLyBYRGlhZ0RvbU1hdHJpeFxuICAgICAgICAgICAgICAgICAgICBycyA9IChtMDAgLSAobTExICsgbTIyKSkgKyAxO1xuICAgICAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy54ID0gcnMgKiAwLjU7XG4gICAgICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMTIgLSBtMjEpICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueSA9IChtMDEgKyBtMTApICogcnM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMueiA9IChtMDIgKyBtMjApICogcnM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gWkRpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICAgICAgcnMgPSAobTIyIC0gKG0wMCArIG0xMSkpICsgMTtcbiAgICAgICAgICAgICAgICAgICAgcnMgPSBNYXRoLnNxcnQocnMpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMueiA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgICAgICBycyA9IDAuNSAvIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLncgPSAobTAxIC0gbTEwKSAqIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnggPSAobTIwICsgbTAyKSAqIHJzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnkgPSAobTIxICsgbTEyKSAqIHJzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAobTExID4gbTIyKSB7XG4gICAgICAgICAgICAgICAgLy8gWURpYWdEb21NYXRyaXhcbiAgICAgICAgICAgICAgICBycyA9IChtMTEgLSAobTIyICsgbTAwKSkgKyAxO1xuICAgICAgICAgICAgICAgIHJzID0gTWF0aC5zcXJ0KHJzKTtcblxuICAgICAgICAgICAgICAgIHRoaXMueSA9IHJzICogMC41O1xuICAgICAgICAgICAgICAgIHJzID0gMC41IC8gcnM7XG4gICAgICAgICAgICAgICAgdGhpcy53ID0gKG0yMCAtIG0wMikgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnogPSAobTEyICsgbTIxKSAqIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IChtMTAgKyBtMDEpICogcnM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFpEaWFnRG9tTWF0cml4XG4gICAgICAgICAgICAgICAgcnMgPSAobTIyIC0gKG0wMCArIG0xMSkpICsgMTtcbiAgICAgICAgICAgICAgICBycyA9IE1hdGguc3FydChycyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnogPSBycyAqIDAuNTtcbiAgICAgICAgICAgICAgICBycyA9IDAuNSAvIHJzO1xuICAgICAgICAgICAgICAgIHRoaXMudyA9IChtMDEgLSBtMTApICogcnM7XG4gICAgICAgICAgICAgICAgdGhpcy54ID0gKG0yMCArIG0wMikgKiBycztcbiAgICAgICAgICAgICAgICB0aGlzLnkgPSAobTIxICsgbTEyKSAqIHJzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGVyZm9ybXMgYSBzcGhlcmljYWwgaW50ZXJwb2xhdGlvbiBiZXR3ZWVuIHR3byBxdWF0ZXJuaW9ucy4gVGhlIHJlc3VsdCBvZiB0aGUgaW50ZXJwb2xhdGlvblxuICAgICAqIGlzIHdyaXR0ZW4gdG8gdGhlIHF1YXRlcm5pb24gY2FsbGluZyB0aGUgZnVuY3Rpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1F1YXR9IGxocyAtIFRoZSBxdWF0ZXJuaW9uIHRvIGludGVycG9sYXRlIGZyb20uXG4gICAgICogQHBhcmFtIHtRdWF0fSByaHMgLSBUaGUgcXVhdGVybmlvbiB0byBpbnRlcnBvbGF0ZSB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYWxwaGEgLSBUaGUgdmFsdWUgY29udHJvbGxpbmcgdGhlIGludGVycG9sYXRpb24gaW4gcmVsYXRpb24gdG8gdGhlIHR3byBpbnB1dFxuICAgICAqIHF1YXRlcm5pb25zLiBUaGUgdmFsdWUgaXMgaW4gdGhlIHJhbmdlIDAgdG8gMSwgMCBnZW5lcmF0aW5nIHExLCAxIGdlbmVyYXRpbmcgcTIgYW5kIGFueXRoaW5nXG4gICAgICogaW4gYmV0d2VlbiBnZW5lcmF0aW5nIGEgc3BoZXJpY2FsIGludGVycG9sYXRpb24gYmV0d2VlbiB0aGUgdHdvLlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBxMSA9IG5ldyBwYy5RdWF0KC0wLjExLCAtMC4xNSwgLTAuNDYsIDAuODcpO1xuICAgICAqIHZhciBxMiA9IG5ldyBwYy5RdWF0KC0wLjIxLCAtMC4yMSwgLTAuNjcsIDAuNjgpO1xuICAgICAqXG4gICAgICogdmFyIHJlc3VsdDtcbiAgICAgKiByZXN1bHQgPSBuZXcgcGMuUXVhdCgpLnNsZXJwKHExLCBxMiwgMCk7ICAgLy8gUmV0dXJuIHExXG4gICAgICogcmVzdWx0ID0gbmV3IHBjLlF1YXQoKS5zbGVycChxMSwgcTIsIDAuNSk7IC8vIFJldHVybiB0aGUgbWlkcG9pbnQgaW50ZXJwb2xhbnRcbiAgICAgKiByZXN1bHQgPSBuZXcgcGMuUXVhdCgpLnNsZXJwKHExLCBxMiwgMSk7ICAgLy8gUmV0dXJuIHEyXG4gICAgICovXG4gICAgc2xlcnAobGhzLCByaHMsIGFscGhhKSB7XG4gICAgICAgIC8vIEFsZ29yaXRobSBzb3VyY2VkIGZyb206XG4gICAgICAgIC8vIGh0dHA6Ly93d3cuZXVjbGlkZWFuc3BhY2UuY29tL21hdGhzL2FsZ2VicmEvcmVhbE5vcm1lZEFsZ2VicmEvcXVhdGVybmlvbnMvc2xlcnAvXG4gICAgICAgIGNvbnN0IGx4ID0gbGhzLng7XG4gICAgICAgIGNvbnN0IGx5ID0gbGhzLnk7XG4gICAgICAgIGNvbnN0IGx6ID0gbGhzLno7XG4gICAgICAgIGNvbnN0IGx3ID0gbGhzLnc7XG4gICAgICAgIGxldCByeCA9IHJocy54O1xuICAgICAgICBsZXQgcnkgPSByaHMueTtcbiAgICAgICAgbGV0IHJ6ID0gcmhzLno7XG4gICAgICAgIGxldCBydyA9IHJocy53O1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhbmdsZSBiZXR3ZWVuIHRoZW0uXG4gICAgICAgIGxldCBjb3NIYWxmVGhldGEgPSBsdyAqIHJ3ICsgbHggKiByeCArIGx5ICogcnkgKyBseiAqIHJ6O1xuXG4gICAgICAgIGlmIChjb3NIYWxmVGhldGEgPCAwKSB7XG4gICAgICAgICAgICBydyA9IC1ydztcbiAgICAgICAgICAgIHJ4ID0gLXJ4O1xuICAgICAgICAgICAgcnkgPSAtcnk7XG4gICAgICAgICAgICByeiA9IC1yejtcbiAgICAgICAgICAgIGNvc0hhbGZUaGV0YSA9IC1jb3NIYWxmVGhldGE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBsaHMgPT0gcmhzIG9yIGxocyA9PSAtcmhzIHRoZW4gdGhldGEgPT0gMCBhbmQgd2UgY2FuIHJldHVybiBsaHNcbiAgICAgICAgaWYgKE1hdGguYWJzKGNvc0hhbGZUaGV0YSkgPj0gMSkge1xuICAgICAgICAgICAgdGhpcy53ID0gbHc7XG4gICAgICAgICAgICB0aGlzLnggPSBseDtcbiAgICAgICAgICAgIHRoaXMueSA9IGx5O1xuICAgICAgICAgICAgdGhpcy56ID0gbHo7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGN1bGF0ZSB0ZW1wb3JhcnkgdmFsdWVzLlxuICAgICAgICBjb25zdCBoYWxmVGhldGEgPSBNYXRoLmFjb3MoY29zSGFsZlRoZXRhKTtcbiAgICAgICAgY29uc3Qgc2luSGFsZlRoZXRhID0gTWF0aC5zcXJ0KDEgLSBjb3NIYWxmVGhldGEgKiBjb3NIYWxmVGhldGEpO1xuXG4gICAgICAgIC8vIElmIHRoZXRhID0gMTgwIGRlZ3JlZXMgdGhlbiByZXN1bHQgaXMgbm90IGZ1bGx5IGRlZmluZWRcbiAgICAgICAgLy8gd2UgY291bGQgcm90YXRlIGFyb3VuZCBhbnkgYXhpcyBub3JtYWwgdG8gcWEgb3IgcWJcbiAgICAgICAgaWYgKE1hdGguYWJzKHNpbkhhbGZUaGV0YSkgPCAwLjAwMSkge1xuICAgICAgICAgICAgdGhpcy53ID0gKGx3ICogMC41ICsgcncgKiAwLjUpO1xuICAgICAgICAgICAgdGhpcy54ID0gKGx4ICogMC41ICsgcnggKiAwLjUpO1xuICAgICAgICAgICAgdGhpcy55ID0gKGx5ICogMC41ICsgcnkgKiAwLjUpO1xuICAgICAgICAgICAgdGhpcy56ID0gKGx6ICogMC41ICsgcnogKiAwLjUpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByYXRpb0EgPSBNYXRoLnNpbigoMSAtIGFscGhhKSAqIGhhbGZUaGV0YSkgLyBzaW5IYWxmVGhldGE7XG4gICAgICAgIGNvbnN0IHJhdGlvQiA9IE1hdGguc2luKGFscGhhICogaGFsZlRoZXRhKSAvIHNpbkhhbGZUaGV0YTtcblxuICAgICAgICAvLyBDYWxjdWxhdGUgUXVhdGVybmlvbi5cbiAgICAgICAgdGhpcy53ID0gKGx3ICogcmF0aW9BICsgcncgKiByYXRpb0IpO1xuICAgICAgICB0aGlzLnggPSAobHggKiByYXRpb0EgKyByeCAqIHJhdGlvQik7XG4gICAgICAgIHRoaXMueSA9IChseSAqIHJhdGlvQSArIHJ5ICogcmF0aW9CKTtcbiAgICAgICAgdGhpcy56ID0gKGx6ICogcmF0aW9BICsgcnogKiByYXRpb0IpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2Zvcm1zIGEgMy1kaW1lbnNpb25hbCB2ZWN0b3IgYnkgdGhlIHNwZWNpZmllZCBxdWF0ZXJuaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSB2ZWMgLSBUaGUgMy1kaW1lbnNpb25hbCB2ZWN0b3IgdG8gYmUgdHJhbnNmb3JtZWQuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcmVzXSAtIEFuIG9wdGlvbmFsIDMtZGltZW5zaW9uYWwgdmVjdG9yIHRvIHJlY2VpdmUgdGhlIHJlc3VsdCBvZiB0aGUgdHJhbnNmb3JtYXRpb24uXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSBpbnB1dCB2ZWN0b3IgdiB0cmFuc2Zvcm1lZCBieSB0aGUgY3VycmVudCBpbnN0YW5jZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDMtZGltZW5zaW9uYWwgdmVjdG9yXG4gICAgICogdmFyIHYgPSBuZXcgcGMuVmVjMygxLCAyLCAzKTtcbiAgICAgKlxuICAgICAqIC8vIENyZWF0ZSBhIDR4NCByb3RhdGlvbiBtYXRyaXhcbiAgICAgKiB2YXIgcSA9IG5ldyBwYy5RdWF0KCkuc2V0RnJvbUV1bGVyQW5nbGVzKDEwLCAyMCwgMzApO1xuICAgICAqXG4gICAgICogdmFyIHR2ID0gcS50cmFuc2Zvcm1WZWN0b3Iodik7XG4gICAgICovXG4gICAgdHJhbnNmb3JtVmVjdG9yKHZlYywgcmVzID0gbmV3IFZlYzMoKSkge1xuICAgICAgICBjb25zdCB4ID0gdmVjLngsIHkgPSB2ZWMueSwgeiA9IHZlYy56O1xuICAgICAgICBjb25zdCBxeCA9IHRoaXMueCwgcXkgPSB0aGlzLnksIHF6ID0gdGhpcy56LCBxdyA9IHRoaXMudztcblxuICAgICAgICAvLyBjYWxjdWxhdGUgcXVhdCAqIHZlY1xuICAgICAgICBjb25zdCBpeCA9IHF3ICogeCArIHF5ICogeiAtIHF6ICogeTtcbiAgICAgICAgY29uc3QgaXkgPSBxdyAqIHkgKyBxeiAqIHggLSBxeCAqIHo7XG4gICAgICAgIGNvbnN0IGl6ID0gcXcgKiB6ICsgcXggKiB5IC0gcXkgKiB4O1xuICAgICAgICBjb25zdCBpdyA9IC1xeCAqIHggLSBxeSAqIHkgLSBxeiAqIHo7XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIHJlc3VsdCAqIGludmVyc2UgcXVhdFxuICAgICAgICByZXMueCA9IGl4ICogcXcgKyBpdyAqIC1xeCArIGl5ICogLXF6IC0gaXogKiAtcXk7XG4gICAgICAgIHJlcy55ID0gaXkgKiBxdyArIGl3ICogLXF5ICsgaXogKiAtcXggLSBpeCAqIC1xejtcbiAgICAgICAgcmVzLnogPSBpeiAqIHF3ICsgaXcgKiAtcXogKyBpeCAqIC1xeSAtIGl5ICogLXF4O1xuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgdGhlIHF1YXRlcm5pb24gdG8gc3RyaW5nIGZvcm0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgcXVhdGVybmlvbiBpbiBzdHJpbmcgZm9ybS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciB2ID0gbmV3IHBjLlF1YXQoMCwgMCwgMCwgMSk7XG4gICAgICogLy8gT3V0cHV0cyBbMCwgMCwgMCwgMV1cbiAgICAgKiBjb25zb2xlLmxvZyh2LnRvU3RyaW5nKCkpO1xuICAgICAqL1xuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gYFske3RoaXMueH0sICR7dGhpcy55fSwgJHt0aGlzLnp9LCAke3RoaXMud31dYDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGNvbnN0YW50IHF1YXRlcm5pb24gc2V0IHRvIFswLCAwLCAwLCAxXSAodGhlIGlkZW50aXR5KS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBJREVOVElUWSA9IE9iamVjdC5mcmVlemUobmV3IFF1YXQoMCwgMCwgMCwgMSkpO1xuXG4gICAgLyoqXG4gICAgICogQSBjb25zdGFudCBxdWF0ZXJuaW9uIHNldCB0byBbMCwgMCwgMCwgMF0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7UXVhdH1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgWkVSTyA9IE9iamVjdC5mcmVlemUobmV3IFF1YXQoMCwgMCwgMCwgMCkpO1xufVxuXG5leHBvcnQgeyBRdWF0IH07XG4iXSwibmFtZXMiOlsiUXVhdCIsImNvbnN0cnVjdG9yIiwieCIsInkiLCJ6IiwidyIsImxlbmd0aCIsImNsb25lIiwiY3N0ciIsImNvbmp1Z2F0ZSIsImNvcHkiLCJyaHMiLCJlcXVhbHMiLCJnZXRBeGlzQW5nbGUiLCJheGlzIiwicmFkIiwiTWF0aCIsImFjb3MiLCJzIiwic2luIiwibWF0aCIsIlJBRF9UT19ERUciLCJnZXRFdWxlckFuZ2xlcyIsImV1bGVycyIsIlZlYzMiLCJxeCIsInF5IiwicXoiLCJxdyIsImEyIiwiYXRhbjIiLCJQSSIsImFzaW4iLCJzZXQiLCJtdWxTY2FsYXIiLCJpbnZlcnQiLCJub3JtYWxpemUiLCJzcXJ0IiwibGVuZ3RoU3EiLCJtdWwiLCJxMXgiLCJxMXkiLCJxMXoiLCJxMXciLCJxMngiLCJxMnkiLCJxMnoiLCJxMnciLCJtdWwyIiwibGhzIiwibGVuIiwic2V0RnJvbUF4aXNBbmdsZSIsImFuZ2xlIiwiREVHX1RPX1JBRCIsInNhIiwiY2EiLCJjb3MiLCJzZXRGcm9tRXVsZXJBbmdsZXMiLCJleCIsImV5IiwiZXoiLCJ2ZWMiLCJoYWxmVG9SYWQiLCJzeCIsImN4Iiwic3kiLCJjeSIsInN6IiwiY3oiLCJzZXRGcm9tTWF0NCIsIm0iLCJtMDAiLCJtMDEiLCJtMDIiLCJtMTAiLCJtMTEiLCJtMTIiLCJtMjAiLCJtMjEiLCJtMjIiLCJycyIsImx4IiwibHkiLCJseiIsImRhdGEiLCJ0ciIsInNsZXJwIiwiYWxwaGEiLCJsdyIsInJ4IiwicnkiLCJyeiIsInJ3IiwiY29zSGFsZlRoZXRhIiwiYWJzIiwiaGFsZlRoZXRhIiwic2luSGFsZlRoZXRhIiwicmF0aW9BIiwicmF0aW9CIiwidHJhbnNmb3JtVmVjdG9yIiwicmVzIiwiaXgiLCJpeSIsIml6IiwiaXciLCJ0b1N0cmluZyIsIklERU5USVRZIiwiT2JqZWN0IiwiZnJlZXplIiwiWkVSTyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFRQSxNQUFNQSxJQUFJLENBQUM7QUFVUEMsRUFBQUEsV0FBVyxDQUFDQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ3BDLElBQUEsSUFBSUgsQ0FBQyxD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
