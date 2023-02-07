import { Vec3 } from './vec3.js';

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
	transpose() {
		const m = this.data;
		let tmp;
		tmp = m[1];
		m[1] = m[3];
		m[3] = tmp;
		tmp = m[2];
		m[2] = m[6];
		m[6] = tmp;
		tmp = m[5];
		m[5] = m[7];
		m[7] = tmp;
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
Mat3.IDENTITY = Object.freeze(new Mat3());
Mat3.ZERO = Object.freeze(new Mat3().set([0, 0, 0, 0, 0, 0, 0, 0, 0]));

export { Mat3 };
