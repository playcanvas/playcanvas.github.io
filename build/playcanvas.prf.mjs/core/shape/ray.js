/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
