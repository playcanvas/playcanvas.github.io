/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();
class Plane {
	constructor(point, normal) {
		this.point = new Vec3();
		this.normal = Vec3.BACK.clone();
		if (point) {
			this.point.copy(point);
		}
		if (normal) {
			this.normal.copy(normal);
		}
	}
	set(point, normal) {
		this.point.copy(point);
		this.normal.copy(normal);
		return this;
	}
	intersectsLine(start, end, point) {
		const d = -this.normal.dot(this.point);
		const d0 = this.normal.dot(start) + d;
		const d1 = this.normal.dot(end) + d;
		const t = d0 / (d0 - d1);
		const intersects = t >= 0 && t <= 1;
		if (intersects && point) point.lerp(start, end, t);
		return intersects;
	}
	intersectsRay(ray, point) {
		const pointToOrigin = tmpVecA.sub2(this.point, ray.origin);
		const t = this.normal.dot(pointToOrigin) / this.normal.dot(ray.direction);
		const intersects = t >= 0;
		if (intersects && point) point.copy(ray.direction).mulScalar(t).add(ray.origin);
		return intersects;
	}
	copy(src) {
		return this.set(src.point, src.normal);
	}
	clone() {
		return new this.constructor(this.point, this.normal);
	}
}

export { Plane };
