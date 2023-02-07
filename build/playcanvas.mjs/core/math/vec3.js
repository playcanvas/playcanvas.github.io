class Vec3 {
	constructor(x = 0, y = 0, z = 0) {
		this.x = void 0;
		this.y = void 0;
		this.z = void 0;
		if (x.length === 3) {
			this.x = x[0];
			this.y = x[1];
			this.z = x[2];
		} else {
			this.x = x;
			this.y = y;
			this.z = z;
		}
	}
	add(rhs) {
		this.x += rhs.x;
		this.y += rhs.y;
		this.z += rhs.z;
		return this;
	}
	add2(lhs, rhs) {
		this.x = lhs.x + rhs.x;
		this.y = lhs.y + rhs.y;
		this.z = lhs.z + rhs.z;
		return this;
	}
	addScalar(scalar) {
		this.x += scalar;
		this.y += scalar;
		this.z += scalar;
		return this;
	}
	clone() {
		const cstr = this.constructor;
		return new cstr(this.x, this.y, this.z);
	}
	copy(rhs) {
		this.x = rhs.x;
		this.y = rhs.y;
		this.z = rhs.z;
		return this;
	}
	cross(lhs, rhs) {
		const lx = lhs.x;
		const ly = lhs.y;
		const lz = lhs.z;
		const rx = rhs.x;
		const ry = rhs.y;
		const rz = rhs.z;
		this.x = ly * rz - ry * lz;
		this.y = lz * rx - rz * lx;
		this.z = lx * ry - rx * ly;
		return this;
	}
	distance(rhs) {
		const x = this.x - rhs.x;
		const y = this.y - rhs.y;
		const z = this.z - rhs.z;
		return Math.sqrt(x * x + y * y + z * z);
	}
	div(rhs) {
		this.x /= rhs.x;
		this.y /= rhs.y;
		this.z /= rhs.z;
		return this;
	}
	div2(lhs, rhs) {
		this.x = lhs.x / rhs.x;
		this.y = lhs.y / rhs.y;
		this.z = lhs.z / rhs.z;
		return this;
	}
	divScalar(scalar) {
		this.x /= scalar;
		this.y /= scalar;
		this.z /= scalar;
		return this;
	}
	dot(rhs) {
		return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
	}
	equals(rhs) {
		return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y + this.z * this.z;
	}
	lerp(lhs, rhs, alpha) {
		this.x = lhs.x + alpha * (rhs.x - lhs.x);
		this.y = lhs.y + alpha * (rhs.y - lhs.y);
		this.z = lhs.z + alpha * (rhs.z - lhs.z);
		return this;
	}
	mul(rhs) {
		this.x *= rhs.x;
		this.y *= rhs.y;
		this.z *= rhs.z;
		return this;
	}
	mul2(lhs, rhs) {
		this.x = lhs.x * rhs.x;
		this.y = lhs.y * rhs.y;
		this.z = lhs.z * rhs.z;
		return this;
	}
	mulScalar(scalar) {
		this.x *= scalar;
		this.y *= scalar;
		this.z *= scalar;
		return this;
	}
	normalize() {
		const lengthSq = this.x * this.x + this.y * this.y + this.z * this.z;
		if (lengthSq > 0) {
			const invLength = 1 / Math.sqrt(lengthSq);
			this.x *= invLength;
			this.y *= invLength;
			this.z *= invLength;
		}
		return this;
	}
	floor() {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		this.z = Math.floor(this.z);
		return this;
	}
	ceil() {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		this.z = Math.ceil(this.z);
		return this;
	}
	round() {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		this.z = Math.round(this.z);
		return this;
	}
	min(rhs) {
		if (rhs.x < this.x) this.x = rhs.x;
		if (rhs.y < this.y) this.y = rhs.y;
		if (rhs.z < this.z) this.z = rhs.z;
		return this;
	}
	max(rhs) {
		if (rhs.x > this.x) this.x = rhs.x;
		if (rhs.y > this.y) this.y = rhs.y;
		if (rhs.z > this.z) this.z = rhs.z;
		return this;
	}
	project(rhs) {
		const a_dot_b = this.x * rhs.x + this.y * rhs.y + this.z * rhs.z;
		const b_dot_b = rhs.x * rhs.x + rhs.y * rhs.y + rhs.z * rhs.z;
		const s = a_dot_b / b_dot_b;
		this.x = rhs.x * s;
		this.y = rhs.y * s;
		this.z = rhs.z * s;
		return this;
	}
	set(x, y, z) {
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}
	sub(rhs) {
		this.x -= rhs.x;
		this.y -= rhs.y;
		this.z -= rhs.z;
		return this;
	}
	sub2(lhs, rhs) {
		this.x = lhs.x - rhs.x;
		this.y = lhs.y - rhs.y;
		this.z = lhs.z - rhs.z;
		return this;
	}
	subScalar(scalar) {
		this.x -= scalar;
		this.y -= scalar;
		this.z -= scalar;
		return this;
	}
	toString() {
		return `[${this.x}, ${this.y}, ${this.z}]`;
	}
}
Vec3.ZERO = Object.freeze(new Vec3(0, 0, 0));
Vec3.ONE = Object.freeze(new Vec3(1, 1, 1));
Vec3.UP = Object.freeze(new Vec3(0, 1, 0));
Vec3.DOWN = Object.freeze(new Vec3(0, -1, 0));
Vec3.RIGHT = Object.freeze(new Vec3(1, 0, 0));
Vec3.LEFT = Object.freeze(new Vec3(-1, 0, 0));
Vec3.FORWARD = Object.freeze(new Vec3(0, 0, -1));
Vec3.BACK = Object.freeze(new Vec3(0, 0, 1));

export { Vec3 };
