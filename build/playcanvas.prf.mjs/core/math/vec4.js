class Vec4 {
	constructor(x = 0, y = 0, z = 0, w = 0) {
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
	add(rhs) {
		this.x += rhs.x;
		this.y += rhs.y;
		this.z += rhs.z;
		this.w += rhs.w;
		return this;
	}
	add2(lhs, rhs) {
		this.x = lhs.x + rhs.x;
		this.y = lhs.y + rhs.y;
		this.z = lhs.z + rhs.z;
		this.w = lhs.w + rhs.w;
		return this;
	}
	addScalar(scalar) {
		this.x += scalar;
		this.y += scalar;
		this.z += scalar;
		this.w += scalar;
		return this;
	}
	clone() {
		const cstr = this.constructor;
		return new cstr(this.x, this.y, this.z, this.w);
	}
	copy(rhs) {
		this.x = rhs.x;
		this.y = rhs.y;
		this.z = rhs.z;
		this.w = rhs.w;
		return this;
	}
	div(rhs) {
		this.x /= rhs.x;
		this.y /= rhs.y;
		this.z /= rhs.z;
		this.w /= rhs.w;
		return this;
	}
	div2(lhs, rhs) {
		this.x = lhs.x / rhs.x;
		this.y = lhs.y / rhs.y;
		this.z = lhs.z / rhs.z;
		this.w = lhs.w / rhs.w;
		return this;
	}
	divScalar(scalar) {
		this.x /= scalar;
		this.y /= scalar;
		this.z /= scalar;
		this.w /= scalar;
		return this;
	}
	dot(rhs) {
		return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z + this.w * rhs.w;
	}
	equals(rhs) {
		return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
	}
	lerp(lhs, rhs, alpha) {
		this.x = lhs.x + alpha * (rhs.x - lhs.x);
		this.y = lhs.y + alpha * (rhs.y - lhs.y);
		this.z = lhs.z + alpha * (rhs.z - lhs.z);
		this.w = lhs.w + alpha * (rhs.w - lhs.w);
		return this;
	}
	mul(rhs) {
		this.x *= rhs.x;
		this.y *= rhs.y;
		this.z *= rhs.z;
		this.w *= rhs.w;
		return this;
	}
	mul2(lhs, rhs) {
		this.x = lhs.x * rhs.x;
		this.y = lhs.y * rhs.y;
		this.z = lhs.z * rhs.z;
		this.w = lhs.w * rhs.w;
		return this;
	}
	mulScalar(scalar) {
		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;
		this.w *= scalar;
		return this;
	}
	normalize() {
		const lengthSq = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
		if (lengthSq > 0) {
			const invLength = 1 / Math.sqrt(lengthSq);
			this.x *= invLength;
			this.y *= invLength;
			this.z *= invLength;
			this.w *= invLength;
		}
		return this;
	}
	floor() {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		this.z = Math.floor(this.z);
		this.w = Math.floor(this.w);
		return this;
	}
	ceil() {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		this.z = Math.ceil(this.z);
		this.w = Math.ceil(this.w);
		return this;
	}
	round() {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		this.z = Math.round(this.z);
		this.w = Math.round(this.w);
		return this;
	}
	min(rhs) {
		if (rhs.x < this.x) this.x = rhs.x;
		if (rhs.y < this.y) this.y = rhs.y;
		if (rhs.z < this.z) this.z = rhs.z;
		if (rhs.w < this.w) this.w = rhs.w;
		return this;
	}
	max(rhs) {
		if (rhs.x > this.x) this.x = rhs.x;
		if (rhs.y > this.y) this.y = rhs.y;
		if (rhs.z > this.z) this.z = rhs.z;
		if (rhs.w > this.w) this.w = rhs.w;
		return this;
	}
	set(x, y, z, w) {
		this.x = x;
		this.y = y;
		this.z = z;
		this.w = w;
		return this;
	}
	sub(rhs) {
		this.x -= rhs.x;
		this.y -= rhs.y;
		this.z -= rhs.z;
		this.w -= rhs.w;
		return this;
	}
	sub2(lhs, rhs) {
		this.x = lhs.x - rhs.x;
		this.y = lhs.y - rhs.y;
		this.z = lhs.z - rhs.z;
		this.w = lhs.w - rhs.w;
		return this;
	}
	subScalar(scalar) {
		this.x -= scalar;
		this.y -= scalar;
		this.z -= scalar;
		this.w -= scalar;
		return this;
	}
	toString() {
		return `[${this.x}, ${this.y}, ${this.z}, ${this.w}]`;
	}
}
Vec4.ZERO = Object.freeze(new Vec4(0, 0, 0, 0));
Vec4.ONE = Object.freeze(new Vec4(1, 1, 1, 1));

export { Vec4 };
