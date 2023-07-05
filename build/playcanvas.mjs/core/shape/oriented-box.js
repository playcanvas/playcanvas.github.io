import '../debug.js';
import { Mat4 } from '../math/mat4.js';
import { Vec3 } from '../math/vec3.js';
import { BoundingBox } from './bounding-box.js';
import { BoundingSphere } from './bounding-sphere.js';
import { Ray } from './ray.js';

const tmpRay = new Ray();
const tmpVec3 = new Vec3();
const tmpSphere = new BoundingSphere();
const tmpMat4 = new Mat4();
class OrientedBox {
	constructor(worldTransform = new Mat4(), halfExtents = new Vec3(0.5, 0.5, 0.5)) {
		this.halfExtents = void 0;
		this._modelTransform = void 0;
		this._worldTransform = void 0;
		this._aabb = void 0;
		this.halfExtents = halfExtents;
		this._modelTransform = worldTransform.clone().invert();
		this._worldTransform = worldTransform.clone();
		this._aabb = new BoundingBox(new Vec3(), this.halfExtents);
	}
	set worldTransform(value) {
		this._worldTransform.copy(value);
		this._modelTransform.copy(value).invert();
	}
	get worldTransform() {
		return this._worldTransform;
	}
	intersectsRay(ray, point) {
		this._modelTransform.transformPoint(ray.origin, tmpRay.origin);
		this._modelTransform.transformVector(ray.direction, tmpRay.direction);
		if (point) {
			const result = this._aabb._intersectsRay(tmpRay, point);
			tmpMat4.copy(this._modelTransform).invert().transformPoint(point, point);
			return result;
		}
		return this._aabb._fastIntersectsRay(tmpRay);
	}
	containsPoint(point) {
		this._modelTransform.transformPoint(point, tmpVec3);
		return this._aabb.containsPoint(tmpVec3);
	}
	intersectsBoundingSphere(sphere) {
		this._modelTransform.transformPoint(sphere.center, tmpSphere.center);
		tmpSphere.radius = sphere.radius;
		if (this._aabb.intersectsBoundingSphere(tmpSphere)) {
			return true;
		}
		return false;
	}
}

export { OrientedBox };
