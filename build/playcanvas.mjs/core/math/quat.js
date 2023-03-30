import { math } from './math.js';
import { Vec3 } from './vec3.js';

class Quat {
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
	equalsApprox(rhs, epsilon = 1e-6) {
		return Math.abs(this.x - rhs.x) < epsilon && Math.abs(this.y - rhs.y) < epsilon && Math.abs(this.z - rhs.z) < epsilon && Math.abs(this.w - rhs.w) < epsilon;
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
	setFromDirections(from, to) {
		const dotProduct = 1 + from.dot(to);
		if (dotProduct < Number.EPSILON) {
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
			this.x = from.y * to.z - from.z * to.y;
			this.y = from.z * to.x - from.x * to.z;
			this.z = from.x * to.y - from.y * to.x;
			this.w = dotProduct;
		}
		return this.normalize();
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
