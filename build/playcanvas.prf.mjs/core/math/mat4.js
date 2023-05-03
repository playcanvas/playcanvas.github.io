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
		this.data = new Float32Array(16);
		this.data[0] = this.data[5] = this.data[10] = this.data[15] = 1;
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
	get scaleSign() {
		this.getX(x);
		this.getY(y);
		this.getZ(z);
		x.cross(x, y);
		return x.dot(z) < 0 ? -1 : 1;
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
