import '../debug.js';
import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();
const tmpVecB = new Vec3();
class BoundingSphere {
	constructor(center = new Vec3(), radius = 0.5) {
		this.center = void 0;
		this.radius = void 0;
		this.center = center;
		this.radius = radius;
	}
	containsPoint(point) {
		const lenSq = tmpVecA.sub2(point, this.center).lengthSq();
		const r = this.radius;
		return lenSq < r * r;
	}
	intersectsRay(ray, point) {
		const m = tmpVecA.copy(ray.origin).sub(this.center);
		const b = m.dot(tmpVecB.copy(ray.direction).normalize());
		const c = m.dot(m) - this.radius * this.radius;
		if (c > 0 && b > 0) return false;
		const discr = b * b - c;
		if (discr < 0) return false;
		const t = Math.abs(-b - Math.sqrt(discr));
		if (point) point.copy(ray.direction).mulScalar(t).add(ray.origin);
		return true;
	}
	intersectsBoundingSphere(sphere) {
		tmpVecA.sub2(sphere.center, this.center);
		const totalRadius = sphere.radius + this.radius;
		if (tmpVecA.lengthSq() <= totalRadius * totalRadius) {
			return true;
		}
		return false;
	}
}

export { BoundingSphere };
