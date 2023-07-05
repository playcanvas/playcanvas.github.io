import '../debug.js';
import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();
const tmpVecB = new Vec3();
const tmpVecC = new Vec3();
const tmpVecD = new Vec3();
const tmpVecE = new Vec3();
class BoundingBox {
	constructor(center = new Vec3(), halfExtents = new Vec3(0.5, 0.5, 0.5)) {
		this.center = void 0;
		this.halfExtents = void 0;
		this._min = new Vec3();
		this._max = new Vec3();
		this.center = center;
		this.halfExtents = halfExtents;
	}
	add(other) {
		const tc = this.center;
		const tcx = tc.x;
		const tcy = tc.y;
		const tcz = tc.z;
		const th = this.halfExtents;
		const thx = th.x;
		const thy = th.y;
		const thz = th.z;
		let tminx = tcx - thx;
		let tmaxx = tcx + thx;
		let tminy = tcy - thy;
		let tmaxy = tcy + thy;
		let tminz = tcz - thz;
		let tmaxz = tcz + thz;
		const oc = other.center;
		const ocx = oc.x;
		const ocy = oc.y;
		const ocz = oc.z;
		const oh = other.halfExtents;
		const ohx = oh.x;
		const ohy = oh.y;
		const ohz = oh.z;
		const ominx = ocx - ohx;
		const omaxx = ocx + ohx;
		const ominy = ocy - ohy;
		const omaxy = ocy + ohy;
		const ominz = ocz - ohz;
		const omaxz = ocz + ohz;
		if (ominx < tminx) tminx = ominx;
		if (omaxx > tmaxx) tmaxx = omaxx;
		if (ominy < tminy) tminy = ominy;
		if (omaxy > tmaxy) tmaxy = omaxy;
		if (ominz < tminz) tminz = ominz;
		if (omaxz > tmaxz) tmaxz = omaxz;
		tc.x = (tminx + tmaxx) * 0.5;
		tc.y = (tminy + tmaxy) * 0.5;
		tc.z = (tminz + tmaxz) * 0.5;
		th.x = (tmaxx - tminx) * 0.5;
		th.y = (tmaxy - tminy) * 0.5;
		th.z = (tmaxz - tminz) * 0.5;
	}
	copy(src) {
		this.center.copy(src.center);
		this.halfExtents.copy(src.halfExtents);
	}
	clone() {
		return new BoundingBox(this.center.clone(), this.halfExtents.clone());
	}
	intersects(other) {
		const aMax = this.getMax();
		const aMin = this.getMin();
		const bMax = other.getMax();
		const bMin = other.getMin();
		return aMin.x <= bMax.x && aMax.x >= bMin.x && aMin.y <= bMax.y && aMax.y >= bMin.y && aMin.z <= bMax.z && aMax.z >= bMin.z;
	}
	_intersectsRay(ray, point) {
		const tMin = tmpVecA.copy(this.getMin()).sub(ray.origin);
		const tMax = tmpVecB.copy(this.getMax()).sub(ray.origin);
		const dir = ray.direction;
		if (dir.x === 0) {
			tMin.x = tMin.x < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
			tMax.x = tMax.x < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
		} else {
			tMin.x /= dir.x;
			tMax.x /= dir.x;
		}
		if (dir.y === 0) {
			tMin.y = tMin.y < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
			tMax.y = tMax.y < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
		} else {
			tMin.y /= dir.y;
			tMax.y /= dir.y;
		}
		if (dir.z === 0) {
			tMin.z = tMin.z < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
			tMax.z = tMax.z < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
		} else {
			tMin.z /= dir.z;
			tMax.z /= dir.z;
		}
		const realMin = tmpVecC.set(Math.min(tMin.x, tMax.x), Math.min(tMin.y, tMax.y), Math.min(tMin.z, tMax.z));
		const realMax = tmpVecD.set(Math.max(tMin.x, tMax.x), Math.max(tMin.y, tMax.y), Math.max(tMin.z, tMax.z));
		const minMax = Math.min(Math.min(realMax.x, realMax.y), realMax.z);
		const maxMin = Math.max(Math.max(realMin.x, realMin.y), realMin.z);
		const intersects = minMax >= maxMin && maxMin >= 0;
		if (intersects) point.copy(ray.direction).mulScalar(maxMin).add(ray.origin);
		return intersects;
	}
	_fastIntersectsRay(ray) {
		const diff = tmpVecA;
		const cross = tmpVecB;
		const prod = tmpVecC;
		const absDiff = tmpVecD;
		const absDir = tmpVecE;
		const rayDir = ray.direction;
		diff.sub2(ray.origin, this.center);
		absDiff.set(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));
		prod.mul2(diff, rayDir);
		if (absDiff.x > this.halfExtents.x && prod.x >= 0) return false;
		if (absDiff.y > this.halfExtents.y && prod.y >= 0) return false;
		if (absDiff.z > this.halfExtents.z && prod.z >= 0) return false;
		absDir.set(Math.abs(rayDir.x), Math.abs(rayDir.y), Math.abs(rayDir.z));
		cross.cross(rayDir, diff);
		cross.set(Math.abs(cross.x), Math.abs(cross.y), Math.abs(cross.z));
		if (cross.x > this.halfExtents.y * absDir.z + this.halfExtents.z * absDir.y) return false;
		if (cross.y > this.halfExtents.x * absDir.z + this.halfExtents.z * absDir.x) return false;
		if (cross.z > this.halfExtents.x * absDir.y + this.halfExtents.y * absDir.x) return false;
		return true;
	}
	intersectsRay(ray, point) {
		if (point) {
			return this._intersectsRay(ray, point);
		}
		return this._fastIntersectsRay(ray);
	}
	setMinMax(min, max) {
		this.center.add2(max, min).mulScalar(0.5);
		this.halfExtents.sub2(max, min).mulScalar(0.5);
	}
	getMin() {
		return this._min.copy(this.center).sub(this.halfExtents);
	}
	getMax() {
		return this._max.copy(this.center).add(this.halfExtents);
	}
	containsPoint(point) {
		const min = this.getMin();
		const max = this.getMax();
		if (point.x < min.x || point.x > max.x || point.y < min.y || point.y > max.y || point.z < min.z || point.z > max.z) {
			return false;
		}
		return true;
	}
	setFromTransformedAabb(aabb, m, ignoreScale = false) {
		const ac = aabb.center;
		const ar = aabb.halfExtents;
		const d = m.data;
		let mx0 = d[0];
		let mx1 = d[4];
		let mx2 = d[8];
		let my0 = d[1];
		let my1 = d[5];
		let my2 = d[9];
		let mz0 = d[2];
		let mz1 = d[6];
		let mz2 = d[10];
		if (ignoreScale) {
			let lengthSq = mx0 * mx0 + mx1 * mx1 + mx2 * mx2;
			if (lengthSq > 0) {
				const invLength = 1 / Math.sqrt(lengthSq);
				mx0 *= invLength;
				mx1 *= invLength;
				mx2 *= invLength;
			}
			lengthSq = my0 * my0 + my1 * my1 + my2 * my2;
			if (lengthSq > 0) {
				const invLength = 1 / Math.sqrt(lengthSq);
				my0 *= invLength;
				my1 *= invLength;
				my2 *= invLength;
			}
			lengthSq = mz0 * mz0 + mz1 * mz1 + mz2 * mz2;
			if (lengthSq > 0) {
				const invLength = 1 / Math.sqrt(lengthSq);
				mz0 *= invLength;
				mz1 *= invLength;
				mz2 *= invLength;
			}
		}
		this.center.set(d[12] + mx0 * ac.x + mx1 * ac.y + mx2 * ac.z, d[13] + my0 * ac.x + my1 * ac.y + my2 * ac.z, d[14] + mz0 * ac.x + mz1 * ac.y + mz2 * ac.z);
		this.halfExtents.set(Math.abs(mx0) * ar.x + Math.abs(mx1) * ar.y + Math.abs(mx2) * ar.z, Math.abs(my0) * ar.x + Math.abs(my1) * ar.y + Math.abs(my2) * ar.z, Math.abs(mz0) * ar.x + Math.abs(mz1) * ar.y + Math.abs(mz2) * ar.z);
	}
	static computeMinMax(vertices, min, max, numVerts = vertices.length / 3) {
		if (numVerts > 0) {
			let minx = vertices[0];
			let miny = vertices[1];
			let minz = vertices[2];
			let maxx = minx;
			let maxy = miny;
			let maxz = minz;
			const n = numVerts * 3;
			for (let i = 3; i < n; i += 3) {
				const x = vertices[i];
				const y = vertices[i + 1];
				const z = vertices[i + 2];
				if (x < minx) minx = x;
				if (y < miny) miny = y;
				if (z < minz) minz = z;
				if (x > maxx) maxx = x;
				if (y > maxy) maxy = y;
				if (z > maxz) maxz = z;
			}
			min.set(minx, miny, minz);
			max.set(maxx, maxy, maxz);
		}
	}
	compute(vertices, numVerts) {
		BoundingBox.computeMinMax(vertices, tmpVecA, tmpVecB, numVerts);
		this.setMinMax(tmpVecA, tmpVecB);
	}
	intersectsBoundingSphere(sphere) {
		const sq = this._distanceToBoundingSphereSq(sphere);
		if (sq <= sphere.radius * sphere.radius) {
			return true;
		}
		return false;
	}
	_distanceToBoundingSphereSq(sphere) {
		const boxMin = this.getMin();
		const boxMax = this.getMax();
		let sq = 0;
		const axis = ['x', 'y', 'z'];
		for (let i = 0; i < 3; ++i) {
			let out = 0;
			const pn = sphere.center[axis[i]];
			const bMin = boxMin[axis[i]];
			const bMax = boxMax[axis[i]];
			let val = 0;
			if (pn < bMin) {
				val = bMin - pn;
				out += val * val;
			}
			if (pn > bMax) {
				val = pn - bMax;
				out += val * val;
			}
			sq += out;
		}
		return sq;
	}
	_expand(expandMin, expandMax) {
		tmpVecA.add2(this.getMin(), expandMin);
		tmpVecB.add2(this.getMax(), expandMax);
		this.setMinMax(tmpVecA, tmpVecB);
	}
}

export { BoundingBox };
