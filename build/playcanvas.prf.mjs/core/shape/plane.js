import { Vec3 } from '../math/vec3.js';

class Plane {
	constructor(normal = Vec3.UP, distance = 0) {
		this.normal = new Vec3();
		this.distance = void 0;
		this.normal.copy(normal);
		this.distance = distance;
	}
	setFromPointNormal(point, normal) {
		this.normal.copy(normal);
		this.distance = -this.normal.dot(point);
		return this;
	}
	intersectsLine(start, end, point) {
		const d = this.distance;
		const d0 = this.normal.dot(start) + d;
		const d1 = this.normal.dot(end) + d;
		const t = d0 / (d0 - d1);
		const intersects = t >= 0 && t <= 1;
		if (intersects && point) point.lerp(start, end, t);
		return intersects;
	}
	intersectsRay(ray, point) {
		const denominator = this.normal.dot(ray.direction);
		if (denominator === 0) return false;
		const t = -(this.normal.dot(ray.origin) + this.distance) / denominator;
		if (t >= 0 && point) {
			point.copy(ray.direction).mulScalar(t).add(ray.origin);
		}
		return t >= 0;
	}
	copy(src) {
		this.normal.copy(src.normal);
		this.distance = src.distance;
		return this;
	}
	clone() {
		const cstr = this.constructor;
		return new cstr().copy(this);
	}
}

export { Plane };
