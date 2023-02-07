import { Vec3 } from '../math/vec3.js';

class Ray {
	constructor(origin, direction) {
		this.origin = new Vec3();
		this.direction = Vec3.FORWARD.clone();
		if (origin) {
			this.origin.copy(origin);
		}
		if (direction) {
			this.direction.copy(direction);
		}
	}
	set(origin, direction) {
		this.origin.copy(origin);
		this.direction.copy(direction);
		return this;
	}
	copy(src) {
		return this.set(src.origin, src.direction);
	}
	clone() {
		return new this.constructor(this.origin, this.direction);
	}
}

export { Ray };
