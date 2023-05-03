class Vec2 {
	constructor(x = 0, y = 0) {
		this.x = void 0;
		this.y = void 0;
		if (x.length === 2) {
			this.x = x[0];
			this.y = x[1];
		} else {
			this.x = x;
			this.y = y;
		}
	}
	add(rhs) {
		this.x += rhs.x;
		this.y += rhs.y;
		return this;
	}
	add2(lhs, rhs) {
		this.x = lhs.x + rhs.x;
		this.y = lhs.y + rhs.y;
		return this;
	}
	addScalar(scalar) {
		this.x += scalar;
		this.y += scalar;
		return this;
	}
	clone() {
		const cstr = this.constructor;
		return new cstr(this.x, this.y);
	}
	copy(rhs) {
		this.x = rhs.x;
		this.y = rhs.y;
		return this;
	}
	cross(rhs) {
		return this.x * rhs.y - this.y * rhs.x;
	}
	distance(rhs) {
		const x = this.x - rhs.x;
		const y = this.y - rhs.y;
		return Math.sqrt(x * x + y * y);
	}
	div(rhs) {
		this.x /= rhs.x;
		this.y /= rhs.y;
		return this;
	}
	div2(lhs, rhs) {
		this.x = lhs.x / rhs.x;
		this.y = lhs.y / rhs.y;
		return this;
	}
	divScalar(scalar) {
		this.x /= scalar;
		this.y /= scalar;
		return this;
	}
	dot(rhs) {
		return this.x * rhs.x + this.y * rhs.y;
	}
	equals(rhs) {
		return this.x === rhs.x && this.y === rhs.y;
	}
	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}
	lengthSq() {
		return this.x * this.x + this.y * this.y;
	}
	lerp(lhs, rhs, alpha) {
		this.x = lhs.x + alpha * (rhs.x - lhs.x);
		this.y = lhs.y + alpha * (rhs.y - lhs.y);
		return this;
	}
	mul(rhs) {
		this.x *= rhs.x;
		this.y *= rhs.y;
		return this;
	}
	mul2(lhs, rhs) {
		this.x = lhs.x * rhs.x;
		this.y = lhs.y * rhs.y;
		return this;
	}
	mulScalar(scalar) {
		this.x *= scalar;
		this.y *= scalar;
		return this;
	}
	normalize() {
		const lengthSq = this.x * this.x + this.y * this.y;
		if (lengthSq > 0) {
			const invLength = 1 / Math.sqrt(lengthSq);
			this.x *= invLength;
			this.y *= invLength;
		}
		return this;
	}
	floor() {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	}
	ceil() {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	}
	round() {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	}
	min(rhs) {
		if (rhs.x < this.x) this.x = rhs.x;
		if (rhs.y < this.y) this.y = rhs.y;
		return this;
	}
	max(rhs) {
		if (rhs.x > this.x) this.x = rhs.x;
		if (rhs.y > this.y) this.y = rhs.y;
		return this;
	}
	set(x, y) {
		this.x = x;
		this.y = y;
		return this;
	}
	sub(rhs) {
		this.x -= rhs.x;
		this.y -= rhs.y;
		return this;
	}
	sub2(lhs, rhs) {
		this.x = lhs.x - rhs.x;
		this.y = lhs.y - rhs.y;
		return this;
	}
	subScalar(scalar) {
		this.x -= scalar;
		this.y -= scalar;
		return this;
	}
	toString() {
		return `[${this.x}, ${this.y}]`;
	}
	static angleRad(lhs, rhs) {
		return Math.atan2(lhs.x * rhs.y - lhs.y * rhs.x, lhs.x * rhs.x + lhs.y * rhs.y);
	}
}
Vec2.ZERO = Object.freeze(new Vec2(0, 0));
Vec2.ONE = Object.freeze(new Vec2(1, 1));
Vec2.UP = Object.freeze(new Vec2(0, 1));
Vec2.DOWN = Object.freeze(new Vec2(0, -1));
Vec2.RIGHT = Object.freeze(new Vec2(1, 0));
Vec2.LEFT = Object.freeze(new Vec2(-1, 0));

export { Vec2 };
