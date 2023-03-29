/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../debug.js';
import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();
const tmpVecB = new Vec3();
const tmpVecC = new Vec3();
const tmpVecD = new Vec3();
const tmpVecE = new Vec3();

/**
 * Axis-Aligned Bounding Box.
 */
class BoundingBox {
  /**
   * Center of box.
   *
   * @type {Vec3}
   */

  /**
   * Half the distance across the box in each axis.
   *
   * @type {Vec3}
   */

  /**
   * @type {Vec3}
   * @private
   */

  /**
   * @type {Vec3}
   * @private
   */

  /**
   * Create a new BoundingBox instance. The bounding box is axis-aligned.
   *
   * @param {Vec3} [center] - Center of box. The constructor takes a reference of this parameter.
   * @param {Vec3} [halfExtents] - Half the distance across the box in each axis. The constructor
   * takes a reference of this parameter. Defaults to 0.5 on each axis.
   */
  constructor(center = new Vec3(), halfExtents = new Vec3(0.5, 0.5, 0.5)) {
    this.center = void 0;
    this.halfExtents = void 0;
    this._min = new Vec3();
    this._max = new Vec3();
    Debug.assert(!Object.isFrozen(center), 'The constructor of \'BoundingBox\' does not accept a constant (frozen) object as a \'center\' parameter');
    Debug.assert(!Object.isFrozen(halfExtents), 'The constructor of \'BoundingBox\' does not accept a constant (frozen) object as a \'halfExtents\' parameter');
    this.center = center;
    this.halfExtents = halfExtents;
  }

  /**
   * Combines two bounding boxes into one, enclosing both.
   *
   * @param {BoundingBox} other - Bounding box to add.
   */
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

  /**
   * Copies the contents of a source AABB.
   *
   * @param {BoundingBox} src - The AABB to copy from.
   */
  copy(src) {
    this.center.copy(src.center);
    this.halfExtents.copy(src.halfExtents);
  }

  /**
   * Returns a clone of the AABB.
   *
   * @returns {BoundingBox} A duplicate AABB.
   */
  clone() {
    return new BoundingBox(this.center.clone(), this.halfExtents.clone());
  }

  /**
   * Test whether two axis-aligned bounding boxes intersect.
   *
   * @param {BoundingBox} other - Bounding box to test against.
   * @returns {boolean} True if there is an intersection.
   */
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

    // Ensure that we are not dividing it by zero
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

  /**
   * Test if a ray intersects with the AABB.
   *
   * @param {import('./ray.js').Ray} ray - Ray to test against (direction must be normalized).
   * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
   * into here.
   * @returns {boolean} True if there is an intersection.
   */
  intersectsRay(ray, point) {
    if (point) {
      return this._intersectsRay(ray, point);
    }
    return this._fastIntersectsRay(ray);
  }

  /**
   * Sets the minimum and maximum corner of the AABB. Using this function is faster than
   * assigning min and max separately.
   *
   * @param {Vec3} min - The minimum corner of the AABB.
   * @param {Vec3} max - The maximum corner of the AABB.
   */
  setMinMax(min, max) {
    this.center.add2(max, min).mulScalar(0.5);
    this.halfExtents.sub2(max, min).mulScalar(0.5);
  }

  /**
   * Return the minimum corner of the AABB.
   *
   * @returns {Vec3} Minimum corner.
   */
  getMin() {
    return this._min.copy(this.center).sub(this.halfExtents);
  }

  /**
   * Return the maximum corner of the AABB.
   *
   * @returns {Vec3} Maximum corner.
   */
  getMax() {
    return this._max.copy(this.center).add(this.halfExtents);
  }

  /**
   * Test if a point is inside a AABB.
   *
   * @param {Vec3} point - Point to test.
   * @returns {boolean} True if the point is inside the AABB and false otherwise.
   */
  containsPoint(point) {
    const min = this.getMin();
    const max = this.getMax();
    if (point.x < min.x || point.x > max.x || point.y < min.y || point.y > max.y || point.z < min.z || point.z > max.z) {
      return false;
    }
    return true;
  }

  /**
   * Set an AABB to enclose the specified AABB if it were to be transformed by the specified 4x4
   * matrix.
   *
   * @param {BoundingBox} aabb - Box to transform and enclose.
   * @param {import('../math/mat4.js').Mat4} m - Transformation matrix to apply to source AABB.
   * @param {boolean} ignoreScale - If true is specified, a scale from the matrix is ignored. Defaults to false.
   */
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

    // renormalize axis if scale is to be ignored
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

  /**
   * Compute the min and max bounding values to encapsulate all specified vertices.
   *
   * @param {number[]|Float32Array} vertices - The vertices used to compute the new size for the
   * AABB.
   * @param {Vec3} min - Stored computed min value.
   * @param {Vec3} max - Stored computed max value.
   * @param {number} [numVerts] - Number of vertices to use from the beginning of vertices array.
   * All vertices are used if not specified.
   */
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

  /**
   * Compute the size of the AABB to encapsulate all specified vertices.
   *
   * @param {number[]|Float32Array} vertices - The vertices used to compute the new size for the
   * AABB.
   * @param {number} [numVerts] - Number of vertices to use from the beginning of vertices array.
   * All vertices are used if not specified.
   */
  compute(vertices, numVerts) {
    BoundingBox.computeMinMax(vertices, tmpVecA, tmpVecB, numVerts);
    this.setMinMax(tmpVecA, tmpVecB);
  }

  /**
   * Test if a Bounding Sphere is overlapping, enveloping, or inside this AABB.
   *
   * @param {import('./bounding-sphere.js').BoundingSphere} sphere - Bounding Sphere to test.
   * @returns {boolean} True if the Bounding Sphere is overlapping, enveloping, or inside the
   * AABB and false otherwise.
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm91bmRpbmctYm94LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vbWF0aC92ZWMzLmpzJztcblxuY29uc3QgdG1wVmVjQSA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBWZWNCID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRtcFZlY0MgPSBuZXcgVmVjMygpO1xuY29uc3QgdG1wVmVjRCA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBWZWNFID0gbmV3IFZlYzMoKTtcblxuLyoqXG4gKiBBeGlzLUFsaWduZWQgQm91bmRpbmcgQm94LlxuICovXG5jbGFzcyBCb3VuZGluZ0JveCB7XG4gICAgLyoqXG4gICAgICogQ2VudGVyIG9mIGJveC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIGNlbnRlcjtcblxuICAgIC8qKlxuICAgICAqIEhhbGYgdGhlIGRpc3RhbmNlIGFjcm9zcyB0aGUgYm94IGluIGVhY2ggYXhpcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqL1xuICAgIGhhbGZFeHRlbnRzO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWluID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21heCA9IG5ldyBWZWMzKCk7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQm91bmRpbmdCb3ggaW5zdGFuY2UuIFRoZSBib3VuZGluZyBib3ggaXMgYXhpcy1hbGlnbmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBbY2VudGVyXSAtIENlbnRlciBvZiBib3guIFRoZSBjb25zdHJ1Y3RvciB0YWtlcyBhIHJlZmVyZW5jZSBvZiB0aGlzIHBhcmFtZXRlci5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtoYWxmRXh0ZW50c10gLSBIYWxmIHRoZSBkaXN0YW5jZSBhY3Jvc3MgdGhlIGJveCBpbiBlYWNoIGF4aXMuIFRoZSBjb25zdHJ1Y3RvclxuICAgICAqIHRha2VzIGEgcmVmZXJlbmNlIG9mIHRoaXMgcGFyYW1ldGVyLiBEZWZhdWx0cyB0byAwLjUgb24gZWFjaCBheGlzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNlbnRlciA9IG5ldyBWZWMzKCksIGhhbGZFeHRlbnRzID0gbmV3IFZlYzMoMC41LCAwLjUsIDAuNSkpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCFPYmplY3QuaXNGcm96ZW4oY2VudGVyKSwgJ1RoZSBjb25zdHJ1Y3RvciBvZiBcXCdCb3VuZGluZ0JveFxcJyBkb2VzIG5vdCBhY2NlcHQgYSBjb25zdGFudCAoZnJvemVuKSBvYmplY3QgYXMgYSBcXCdjZW50ZXJcXCcgcGFyYW1ldGVyJyk7XG4gICAgICAgIERlYnVnLmFzc2VydCghT2JqZWN0LmlzRnJvemVuKGhhbGZFeHRlbnRzKSwgJ1RoZSBjb25zdHJ1Y3RvciBvZiBcXCdCb3VuZGluZ0JveFxcJyBkb2VzIG5vdCBhY2NlcHQgYSBjb25zdGFudCAoZnJvemVuKSBvYmplY3QgYXMgYSBcXCdoYWxmRXh0ZW50c1xcJyBwYXJhbWV0ZXInKTtcblxuICAgICAgICB0aGlzLmNlbnRlciA9IGNlbnRlcjtcbiAgICAgICAgdGhpcy5oYWxmRXh0ZW50cyA9IGhhbGZFeHRlbnRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbWJpbmVzIHR3byBib3VuZGluZyBib3hlcyBpbnRvIG9uZSwgZW5jbG9zaW5nIGJvdGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0JvdW5kaW5nQm94fSBvdGhlciAtIEJvdW5kaW5nIGJveCB0byBhZGQuXG4gICAgICovXG4gICAgYWRkKG90aGVyKSB7XG4gICAgICAgIGNvbnN0IHRjID0gdGhpcy5jZW50ZXI7XG4gICAgICAgIGNvbnN0IHRjeCA9IHRjLng7XG4gICAgICAgIGNvbnN0IHRjeSA9IHRjLnk7XG4gICAgICAgIGNvbnN0IHRjeiA9IHRjLno7XG4gICAgICAgIGNvbnN0IHRoID0gdGhpcy5oYWxmRXh0ZW50cztcbiAgICAgICAgY29uc3QgdGh4ID0gdGgueDtcbiAgICAgICAgY29uc3QgdGh5ID0gdGgueTtcbiAgICAgICAgY29uc3QgdGh6ID0gdGguejtcbiAgICAgICAgbGV0IHRtaW54ID0gdGN4IC0gdGh4O1xuICAgICAgICBsZXQgdG1heHggPSB0Y3ggKyB0aHg7XG4gICAgICAgIGxldCB0bWlueSA9IHRjeSAtIHRoeTtcbiAgICAgICAgbGV0IHRtYXh5ID0gdGN5ICsgdGh5O1xuICAgICAgICBsZXQgdG1pbnogPSB0Y3ogLSB0aHo7XG4gICAgICAgIGxldCB0bWF4eiA9IHRjeiArIHRoejtcblxuICAgICAgICBjb25zdCBvYyA9IG90aGVyLmNlbnRlcjtcbiAgICAgICAgY29uc3Qgb2N4ID0gb2MueDtcbiAgICAgICAgY29uc3Qgb2N5ID0gb2MueTtcbiAgICAgICAgY29uc3Qgb2N6ID0gb2MuejtcbiAgICAgICAgY29uc3Qgb2ggPSBvdGhlci5oYWxmRXh0ZW50cztcbiAgICAgICAgY29uc3Qgb2h4ID0gb2gueDtcbiAgICAgICAgY29uc3Qgb2h5ID0gb2gueTtcbiAgICAgICAgY29uc3Qgb2h6ID0gb2guejtcbiAgICAgICAgY29uc3Qgb21pbnggPSBvY3ggLSBvaHg7XG4gICAgICAgIGNvbnN0IG9tYXh4ID0gb2N4ICsgb2h4O1xuICAgICAgICBjb25zdCBvbWlueSA9IG9jeSAtIG9oeTtcbiAgICAgICAgY29uc3Qgb21heHkgPSBvY3kgKyBvaHk7XG4gICAgICAgIGNvbnN0IG9taW56ID0gb2N6IC0gb2h6O1xuICAgICAgICBjb25zdCBvbWF4eiA9IG9jeiArIG9oejtcblxuICAgICAgICBpZiAob21pbnggPCB0bWlueCkgdG1pbnggPSBvbWlueDtcbiAgICAgICAgaWYgKG9tYXh4ID4gdG1heHgpIHRtYXh4ID0gb21heHg7XG4gICAgICAgIGlmIChvbWlueSA8IHRtaW55KSB0bWlueSA9IG9taW55O1xuICAgICAgICBpZiAob21heHkgPiB0bWF4eSkgdG1heHkgPSBvbWF4eTtcbiAgICAgICAgaWYgKG9taW56IDwgdG1pbnopIHRtaW56ID0gb21pbno7XG4gICAgICAgIGlmIChvbWF4eiA+IHRtYXh6KSB0bWF4eiA9IG9tYXh6O1xuXG4gICAgICAgIHRjLnggPSAodG1pbnggKyB0bWF4eCkgKiAwLjU7XG4gICAgICAgIHRjLnkgPSAodG1pbnkgKyB0bWF4eSkgKiAwLjU7XG4gICAgICAgIHRjLnogPSAodG1pbnogKyB0bWF4eikgKiAwLjU7XG4gICAgICAgIHRoLnggPSAodG1heHggLSB0bWlueCkgKiAwLjU7XG4gICAgICAgIHRoLnkgPSAodG1heHkgLSB0bWlueSkgKiAwLjU7XG4gICAgICAgIHRoLnogPSAodG1heHogLSB0bWlueikgKiAwLjU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHRoZSBjb250ZW50cyBvZiBhIHNvdXJjZSBBQUJCLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtCb3VuZGluZ0JveH0gc3JjIC0gVGhlIEFBQkIgdG8gY29weSBmcm9tLlxuICAgICAqL1xuICAgIGNvcHkoc3JjKSB7XG4gICAgICAgIHRoaXMuY2VudGVyLmNvcHkoc3JjLmNlbnRlcik7XG4gICAgICAgIHRoaXMuaGFsZkV4dGVudHMuY29weShzcmMuaGFsZkV4dGVudHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBjbG9uZSBvZiB0aGUgQUFCQi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb3VuZGluZ0JveH0gQSBkdXBsaWNhdGUgQUFCQi5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBCb3VuZGluZ0JveCh0aGlzLmNlbnRlci5jbG9uZSgpLCB0aGlzLmhhbGZFeHRlbnRzLmNsb25lKCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3Qgd2hldGhlciB0d28gYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveGVzIGludGVyc2VjdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Qm91bmRpbmdCb3h9IG90aGVyIC0gQm91bmRpbmcgYm94IHRvIHRlc3QgYWdhaW5zdC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGVyZSBpcyBhbiBpbnRlcnNlY3Rpb24uXG4gICAgICovXG4gICAgaW50ZXJzZWN0cyhvdGhlcikge1xuICAgICAgICBjb25zdCBhTWF4ID0gdGhpcy5nZXRNYXgoKTtcbiAgICAgICAgY29uc3QgYU1pbiA9IHRoaXMuZ2V0TWluKCk7XG4gICAgICAgIGNvbnN0IGJNYXggPSBvdGhlci5nZXRNYXgoKTtcbiAgICAgICAgY29uc3QgYk1pbiA9IG90aGVyLmdldE1pbigpO1xuXG4gICAgICAgIHJldHVybiAoYU1pbi54IDw9IGJNYXgueCkgJiYgKGFNYXgueCA+PSBiTWluLngpICYmXG4gICAgICAgICAgICAgICAoYU1pbi55IDw9IGJNYXgueSkgJiYgKGFNYXgueSA+PSBiTWluLnkpICYmXG4gICAgICAgICAgICAgICAoYU1pbi56IDw9IGJNYXgueikgJiYgKGFNYXgueiA+PSBiTWluLnopO1xuICAgIH1cblxuICAgIF9pbnRlcnNlY3RzUmF5KHJheSwgcG9pbnQpIHtcbiAgICAgICAgY29uc3QgdE1pbiA9IHRtcFZlY0EuY29weSh0aGlzLmdldE1pbigpKS5zdWIocmF5Lm9yaWdpbik7XG4gICAgICAgIGNvbnN0IHRNYXggPSB0bXBWZWNCLmNvcHkodGhpcy5nZXRNYXgoKSkuc3ViKHJheS5vcmlnaW4pO1xuICAgICAgICBjb25zdCBkaXIgPSByYXkuZGlyZWN0aW9uO1xuXG4gICAgICAgIC8vIEVuc3VyZSB0aGF0IHdlIGFyZSBub3QgZGl2aWRpbmcgaXQgYnkgemVyb1xuICAgICAgICBpZiAoZGlyLnggPT09IDApIHtcbiAgICAgICAgICAgIHRNaW4ueCA9IHRNaW4ueCA8IDAgPyAtTnVtYmVyLk1BWF9WQUxVRSA6IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgICAgICB0TWF4LnggPSB0TWF4LnggPCAwID8gLU51bWJlci5NQVhfVkFMVUUgOiBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdE1pbi54IC89IGRpci54O1xuICAgICAgICAgICAgdE1heC54IC89IGRpci54O1xuICAgICAgICB9XG4gICAgICAgIGlmIChkaXIueSA9PT0gMCkge1xuICAgICAgICAgICAgdE1pbi55ID0gdE1pbi55IDwgMCA/IC1OdW1iZXIuTUFYX1ZBTFVFIDogTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgICAgIHRNYXgueSA9IHRNYXgueSA8IDAgPyAtTnVtYmVyLk1BWF9WQUxVRSA6IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0TWluLnkgLz0gZGlyLnk7XG4gICAgICAgICAgICB0TWF4LnkgLz0gZGlyLnk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRpci56ID09PSAwKSB7XG4gICAgICAgICAgICB0TWluLnogPSB0TWluLnogPCAwID8gLU51bWJlci5NQVhfVkFMVUUgOiBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICAgICAgdE1heC56ID0gdE1heC56IDwgMCA/IC1OdW1iZXIuTUFYX1ZBTFVFIDogTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRNaW4ueiAvPSBkaXIuejtcbiAgICAgICAgICAgIHRNYXgueiAvPSBkaXIuejtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlYWxNaW4gPSB0bXBWZWNDLnNldChNYXRoLm1pbih0TWluLngsIHRNYXgueCksIE1hdGgubWluKHRNaW4ueSwgdE1heC55KSwgTWF0aC5taW4odE1pbi56LCB0TWF4LnopKTtcbiAgICAgICAgY29uc3QgcmVhbE1heCA9IHRtcFZlY0Quc2V0KE1hdGgubWF4KHRNaW4ueCwgdE1heC54KSwgTWF0aC5tYXgodE1pbi55LCB0TWF4LnkpLCBNYXRoLm1heCh0TWluLnosIHRNYXgueikpO1xuXG4gICAgICAgIGNvbnN0IG1pbk1heCA9IE1hdGgubWluKE1hdGgubWluKHJlYWxNYXgueCwgcmVhbE1heC55KSwgcmVhbE1heC56KTtcbiAgICAgICAgY29uc3QgbWF4TWluID0gTWF0aC5tYXgoTWF0aC5tYXgocmVhbE1pbi54LCByZWFsTWluLnkpLCByZWFsTWluLnopO1xuXG4gICAgICAgIGNvbnN0IGludGVyc2VjdHMgPSBtaW5NYXggPj0gbWF4TWluICYmIG1heE1pbiA+PSAwO1xuXG4gICAgICAgIGlmIChpbnRlcnNlY3RzKVxuICAgICAgICAgICAgcG9pbnQuY29weShyYXkuZGlyZWN0aW9uKS5tdWxTY2FsYXIobWF4TWluKS5hZGQocmF5Lm9yaWdpbik7XG5cbiAgICAgICAgcmV0dXJuIGludGVyc2VjdHM7XG4gICAgfVxuXG4gICAgX2Zhc3RJbnRlcnNlY3RzUmF5KHJheSkge1xuICAgICAgICBjb25zdCBkaWZmID0gdG1wVmVjQTtcbiAgICAgICAgY29uc3QgY3Jvc3MgPSB0bXBWZWNCO1xuICAgICAgICBjb25zdCBwcm9kID0gdG1wVmVjQztcbiAgICAgICAgY29uc3QgYWJzRGlmZiA9IHRtcFZlY0Q7XG4gICAgICAgIGNvbnN0IGFic0RpciA9IHRtcFZlY0U7XG4gICAgICAgIGNvbnN0IHJheURpciA9IHJheS5kaXJlY3Rpb247XG5cbiAgICAgICAgZGlmZi5zdWIyKHJheS5vcmlnaW4sIHRoaXMuY2VudGVyKTtcbiAgICAgICAgYWJzRGlmZi5zZXQoTWF0aC5hYnMoZGlmZi54KSwgTWF0aC5hYnMoZGlmZi55KSwgTWF0aC5hYnMoZGlmZi56KSk7XG5cbiAgICAgICAgcHJvZC5tdWwyKGRpZmYsIHJheURpcik7XG5cbiAgICAgICAgaWYgKGFic0RpZmYueCA+IHRoaXMuaGFsZkV4dGVudHMueCAmJiBwcm9kLnggPj0gMClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBpZiAoYWJzRGlmZi55ID4gdGhpcy5oYWxmRXh0ZW50cy55ICYmIHByb2QueSA+PSAwKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGlmIChhYnNEaWZmLnogPiB0aGlzLmhhbGZFeHRlbnRzLnogJiYgcHJvZC56ID49IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgYWJzRGlyLnNldChNYXRoLmFicyhyYXlEaXIueCksIE1hdGguYWJzKHJheURpci55KSwgTWF0aC5hYnMocmF5RGlyLnopKTtcbiAgICAgICAgY3Jvc3MuY3Jvc3MocmF5RGlyLCBkaWZmKTtcbiAgICAgICAgY3Jvc3Muc2V0KE1hdGguYWJzKGNyb3NzLngpLCBNYXRoLmFicyhjcm9zcy55KSwgTWF0aC5hYnMoY3Jvc3MueikpO1xuXG4gICAgICAgIGlmIChjcm9zcy54ID4gdGhpcy5oYWxmRXh0ZW50cy55ICogYWJzRGlyLnogKyB0aGlzLmhhbGZFeHRlbnRzLnogKiBhYnNEaXIueSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBpZiAoY3Jvc3MueSA+IHRoaXMuaGFsZkV4dGVudHMueCAqIGFic0Rpci56ICsgdGhpcy5oYWxmRXh0ZW50cy56ICogYWJzRGlyLngpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgaWYgKGNyb3NzLnogPiB0aGlzLmhhbGZFeHRlbnRzLnggKiBhYnNEaXIueSArIHRoaXMuaGFsZkV4dGVudHMueSAqIGFic0Rpci54KVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgYSByYXkgaW50ZXJzZWN0cyB3aXRoIHRoZSBBQUJCLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vcmF5LmpzJykuUmF5fSByYXkgLSBSYXkgdG8gdGVzdCBhZ2FpbnN0IChkaXJlY3Rpb24gbXVzdCBiZSBub3JtYWxpemVkKS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IFtwb2ludF0gLSBJZiB0aGVyZSBpcyBhbiBpbnRlcnNlY3Rpb24sIHRoZSBpbnRlcnNlY3Rpb24gcG9pbnQgd2lsbCBiZSBjb3BpZWRcbiAgICAgKiBpbnRvIGhlcmUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlcmUgaXMgYW4gaW50ZXJzZWN0aW9uLlxuICAgICAqL1xuICAgIGludGVyc2VjdHNSYXkocmF5LCBwb2ludCkge1xuICAgICAgICBpZiAocG9pbnQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbnRlcnNlY3RzUmF5KHJheSwgcG9pbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2Zhc3RJbnRlcnNlY3RzUmF5KHJheSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbWluaW11bSBhbmQgbWF4aW11bSBjb3JuZXIgb2YgdGhlIEFBQkIuIFVzaW5nIHRoaXMgZnVuY3Rpb24gaXMgZmFzdGVyIHRoYW5cbiAgICAgKiBhc3NpZ25pbmcgbWluIGFuZCBtYXggc2VwYXJhdGVseS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gbWluIC0gVGhlIG1pbmltdW0gY29ybmVyIG9mIHRoZSBBQUJCLlxuICAgICAqIEBwYXJhbSB7VmVjM30gbWF4IC0gVGhlIG1heGltdW0gY29ybmVyIG9mIHRoZSBBQUJCLlxuICAgICAqL1xuICAgIHNldE1pbk1heChtaW4sIG1heCkge1xuICAgICAgICB0aGlzLmNlbnRlci5hZGQyKG1heCwgbWluKS5tdWxTY2FsYXIoMC41KTtcbiAgICAgICAgdGhpcy5oYWxmRXh0ZW50cy5zdWIyKG1heCwgbWluKS5tdWxTY2FsYXIoMC41KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIG1pbmltdW0gY29ybmVyIG9mIHRoZSBBQUJCLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IE1pbmltdW0gY29ybmVyLlxuICAgICAqL1xuICAgIGdldE1pbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pbi5jb3B5KHRoaXMuY2VudGVyKS5zdWIodGhpcy5oYWxmRXh0ZW50cyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSBtYXhpbXVtIGNvcm5lciBvZiB0aGUgQUFCQi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtWZWMzfSBNYXhpbXVtIGNvcm5lci5cbiAgICAgKi9cbiAgICBnZXRNYXgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXguY29weSh0aGlzLmNlbnRlcikuYWRkKHRoaXMuaGFsZkV4dGVudHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgYSBwb2ludCBpcyBpbnNpZGUgYSBBQUJCLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBwb2ludCAtIFBvaW50IHRvIHRlc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHBvaW50IGlzIGluc2lkZSB0aGUgQUFCQiBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGNvbnRhaW5zUG9pbnQocG9pbnQpIHtcbiAgICAgICAgY29uc3QgbWluID0gdGhpcy5nZXRNaW4oKTtcbiAgICAgICAgY29uc3QgbWF4ID0gdGhpcy5nZXRNYXgoKTtcblxuICAgICAgICBpZiAocG9pbnQueCA8IG1pbi54IHx8IHBvaW50LnggPiBtYXgueCB8fFxuICAgICAgICAgICAgcG9pbnQueSA8IG1pbi55IHx8IHBvaW50LnkgPiBtYXgueSB8fFxuICAgICAgICAgICAgcG9pbnQueiA8IG1pbi56IHx8IHBvaW50LnogPiBtYXgueikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IGFuIEFBQkIgdG8gZW5jbG9zZSB0aGUgc3BlY2lmaWVkIEFBQkIgaWYgaXQgd2VyZSB0byBiZSB0cmFuc2Zvcm1lZCBieSB0aGUgc3BlY2lmaWVkIDR4NFxuICAgICAqIG1hdHJpeC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Qm91bmRpbmdCb3h9IGFhYmIgLSBCb3ggdG8gdHJhbnNmb3JtIGFuZCBlbmNsb3NlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9tYXRoL21hdDQuanMnKS5NYXQ0fSBtIC0gVHJhbnNmb3JtYXRpb24gbWF0cml4IHRvIGFwcGx5IHRvIHNvdXJjZSBBQUJCLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaWdub3JlU2NhbGUgLSBJZiB0cnVlIGlzIHNwZWNpZmllZCwgYSBzY2FsZSBmcm9tIHRoZSBtYXRyaXggaXMgaWdub3JlZC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICovXG4gICAgc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihhYWJiLCBtLCBpZ25vcmVTY2FsZSA9IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IGFjID0gYWFiYi5jZW50ZXI7XG4gICAgICAgIGNvbnN0IGFyID0gYWFiYi5oYWxmRXh0ZW50cztcblxuICAgICAgICBjb25zdCBkID0gbS5kYXRhO1xuICAgICAgICBsZXQgbXgwID0gZFswXTtcbiAgICAgICAgbGV0IG14MSA9IGRbNF07XG4gICAgICAgIGxldCBteDIgPSBkWzhdO1xuICAgICAgICBsZXQgbXkwID0gZFsxXTtcbiAgICAgICAgbGV0IG15MSA9IGRbNV07XG4gICAgICAgIGxldCBteTIgPSBkWzldO1xuICAgICAgICBsZXQgbXowID0gZFsyXTtcbiAgICAgICAgbGV0IG16MSA9IGRbNl07XG4gICAgICAgIGxldCBtejIgPSBkWzEwXTtcblxuICAgICAgICAvLyByZW5vcm1hbGl6ZSBheGlzIGlmIHNjYWxlIGlzIHRvIGJlIGlnbm9yZWRcbiAgICAgICAgaWYgKGlnbm9yZVNjYWxlKSB7XG4gICAgICAgICAgICBsZXQgbGVuZ3RoU3EgPSBteDAgKiBteDAgKyBteDEgKiBteDEgKyBteDIgKiBteDI7XG4gICAgICAgICAgICBpZiAobGVuZ3RoU3EgPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW52TGVuZ3RoID0gMSAvIE1hdGguc3FydChsZW5ndGhTcSk7XG4gICAgICAgICAgICAgICAgbXgwICo9IGludkxlbmd0aDtcbiAgICAgICAgICAgICAgICBteDEgKj0gaW52TGVuZ3RoO1xuICAgICAgICAgICAgICAgIG14MiAqPSBpbnZMZW5ndGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxlbmd0aFNxID0gbXkwICogbXkwICsgbXkxICogbXkxICsgbXkyICogbXkyO1xuICAgICAgICAgICAgaWYgKGxlbmd0aFNxID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGludkxlbmd0aCA9IDEgLyBNYXRoLnNxcnQobGVuZ3RoU3EpO1xuICAgICAgICAgICAgICAgIG15MCAqPSBpbnZMZW5ndGg7XG4gICAgICAgICAgICAgICAgbXkxICo9IGludkxlbmd0aDtcbiAgICAgICAgICAgICAgICBteTIgKj0gaW52TGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZW5ndGhTcSA9IG16MCAqIG16MCArIG16MSAqIG16MSArIG16MiAqIG16MjtcbiAgICAgICAgICAgIGlmIChsZW5ndGhTcSA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnZMZW5ndGggPSAxIC8gTWF0aC5zcXJ0KGxlbmd0aFNxKTtcbiAgICAgICAgICAgICAgICBtejAgKj0gaW52TGVuZ3RoO1xuICAgICAgICAgICAgICAgIG16MSAqPSBpbnZMZW5ndGg7XG4gICAgICAgICAgICAgICAgbXoyICo9IGludkxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2VudGVyLnNldChcbiAgICAgICAgICAgIGRbMTJdICsgbXgwICogYWMueCArIG14MSAqIGFjLnkgKyBteDIgKiBhYy56LFxuICAgICAgICAgICAgZFsxM10gKyBteTAgKiBhYy54ICsgbXkxICogYWMueSArIG15MiAqIGFjLnosXG4gICAgICAgICAgICBkWzE0XSArIG16MCAqIGFjLnggKyBtejEgKiBhYy55ICsgbXoyICogYWMuelxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuaGFsZkV4dGVudHMuc2V0KFxuICAgICAgICAgICAgTWF0aC5hYnMobXgwKSAqIGFyLnggKyBNYXRoLmFicyhteDEpICogYXIueSArIE1hdGguYWJzKG14MikgKiBhci56LFxuICAgICAgICAgICAgTWF0aC5hYnMobXkwKSAqIGFyLnggKyBNYXRoLmFicyhteTEpICogYXIueSArIE1hdGguYWJzKG15MikgKiBhci56LFxuICAgICAgICAgICAgTWF0aC5hYnMobXowKSAqIGFyLnggKyBNYXRoLmFicyhtejEpICogYXIueSArIE1hdGguYWJzKG16MikgKiBhci56XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcHV0ZSB0aGUgbWluIGFuZCBtYXggYm91bmRpbmcgdmFsdWVzIHRvIGVuY2Fwc3VsYXRlIGFsbCBzcGVjaWZpZWQgdmVydGljZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfEZsb2F0MzJBcnJheX0gdmVydGljZXMgLSBUaGUgdmVydGljZXMgdXNlZCB0byBjb21wdXRlIHRoZSBuZXcgc2l6ZSBmb3IgdGhlXG4gICAgICogQUFCQi5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG1pbiAtIFN0b3JlZCBjb21wdXRlZCBtaW4gdmFsdWUuXG4gICAgICogQHBhcmFtIHtWZWMzfSBtYXggLSBTdG9yZWQgY29tcHV0ZWQgbWF4IHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtVmVydHNdIC0gTnVtYmVyIG9mIHZlcnRpY2VzIHRvIHVzZSBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdmVydGljZXMgYXJyYXkuXG4gICAgICogQWxsIHZlcnRpY2VzIGFyZSB1c2VkIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICovXG4gICAgc3RhdGljIGNvbXB1dGVNaW5NYXgodmVydGljZXMsIG1pbiwgbWF4LCBudW1WZXJ0cyA9IHZlcnRpY2VzLmxlbmd0aCAvIDMpIHtcbiAgICAgICAgaWYgKG51bVZlcnRzID4gMCkge1xuICAgICAgICAgICAgbGV0IG1pbnggPSB2ZXJ0aWNlc1swXTtcbiAgICAgICAgICAgIGxldCBtaW55ID0gdmVydGljZXNbMV07XG4gICAgICAgICAgICBsZXQgbWlueiA9IHZlcnRpY2VzWzJdO1xuICAgICAgICAgICAgbGV0IG1heHggPSBtaW54O1xuICAgICAgICAgICAgbGV0IG1heHkgPSBtaW55O1xuICAgICAgICAgICAgbGV0IG1heHogPSBtaW56O1xuICAgICAgICAgICAgY29uc3QgbiA9IG51bVZlcnRzICogMztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAzOyBpIDwgbjsgaSArPSAzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeCA9IHZlcnRpY2VzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IHkgPSB2ZXJ0aWNlc1tpICsgMV07XG4gICAgICAgICAgICAgICAgY29uc3QgeiA9IHZlcnRpY2VzW2kgKyAyXTtcbiAgICAgICAgICAgICAgICBpZiAoeCA8IG1pbngpIG1pbnggPSB4O1xuICAgICAgICAgICAgICAgIGlmICh5IDwgbWlueSkgbWlueSA9IHk7XG4gICAgICAgICAgICAgICAgaWYgKHogPCBtaW56KSBtaW56ID0gejtcbiAgICAgICAgICAgICAgICBpZiAoeCA+IG1heHgpIG1heHggPSB4O1xuICAgICAgICAgICAgICAgIGlmICh5ID4gbWF4eSkgbWF4eSA9IHk7XG4gICAgICAgICAgICAgICAgaWYgKHogPiBtYXh6KSBtYXh6ID0gejtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1pbi5zZXQobWlueCwgbWlueSwgbWlueik7XG4gICAgICAgICAgICBtYXguc2V0KG1heHgsIG1heHksIG1heHopO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcHV0ZSB0aGUgc2l6ZSBvZiB0aGUgQUFCQiB0byBlbmNhcHN1bGF0ZSBhbGwgc3BlY2lmaWVkIHZlcnRpY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXXxGbG9hdDMyQXJyYXl9IHZlcnRpY2VzIC0gVGhlIHZlcnRpY2VzIHVzZWQgdG8gY29tcHV0ZSB0aGUgbmV3IHNpemUgZm9yIHRoZVxuICAgICAqIEFBQkIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1WZXJ0c10gLSBOdW1iZXIgb2YgdmVydGljZXMgdG8gdXNlIGZyb20gdGhlIGJlZ2lubmluZyBvZiB2ZXJ0aWNlcyBhcnJheS5cbiAgICAgKiBBbGwgdmVydGljZXMgYXJlIHVzZWQgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKi9cbiAgICBjb21wdXRlKHZlcnRpY2VzLCBudW1WZXJ0cykge1xuICAgICAgICBCb3VuZGluZ0JveC5jb21wdXRlTWluTWF4KHZlcnRpY2VzLCB0bXBWZWNBLCB0bXBWZWNCLCBudW1WZXJ0cyk7XG4gICAgICAgIHRoaXMuc2V0TWluTWF4KHRtcFZlY0EsIHRtcFZlY0IpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgYSBCb3VuZGluZyBTcGhlcmUgaXMgb3ZlcmxhcHBpbmcsIGVudmVsb3BpbmcsIG9yIGluc2lkZSB0aGlzIEFBQkIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ib3VuZGluZy1zcGhlcmUuanMnKS5Cb3VuZGluZ1NwaGVyZX0gc3BoZXJlIC0gQm91bmRpbmcgU3BoZXJlIHRvIHRlc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIEJvdW5kaW5nIFNwaGVyZSBpcyBvdmVybGFwcGluZywgZW52ZWxvcGluZywgb3IgaW5zaWRlIHRoZVxuICAgICAqIEFBQkIgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpbnRlcnNlY3RzQm91bmRpbmdTcGhlcmUoc3BoZXJlKSB7XG4gICAgICAgIGNvbnN0IHNxID0gdGhpcy5fZGlzdGFuY2VUb0JvdW5kaW5nU3BoZXJlU3Eoc3BoZXJlKTtcbiAgICAgICAgaWYgKHNxIDw9IHNwaGVyZS5yYWRpdXMgKiBzcGhlcmUucmFkaXVzKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfZGlzdGFuY2VUb0JvdW5kaW5nU3BoZXJlU3Eoc3BoZXJlKSB7XG4gICAgICAgIGNvbnN0IGJveE1pbiA9IHRoaXMuZ2V0TWluKCk7XG4gICAgICAgIGNvbnN0IGJveE1heCA9IHRoaXMuZ2V0TWF4KCk7XG5cbiAgICAgICAgbGV0IHNxID0gMDtcbiAgICAgICAgY29uc3QgYXhpcyA9IFsneCcsICd5JywgJ3onXTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDM7ICsraSkge1xuICAgICAgICAgICAgbGV0IG91dCA9IDA7XG4gICAgICAgICAgICBjb25zdCBwbiA9IHNwaGVyZS5jZW50ZXJbYXhpc1tpXV07XG4gICAgICAgICAgICBjb25zdCBiTWluID0gYm94TWluW2F4aXNbaV1dO1xuICAgICAgICAgICAgY29uc3QgYk1heCA9IGJveE1heFtheGlzW2ldXTtcbiAgICAgICAgICAgIGxldCB2YWwgPSAwO1xuXG4gICAgICAgICAgICBpZiAocG4gPCBiTWluKSB7XG4gICAgICAgICAgICAgICAgdmFsID0gKGJNaW4gLSBwbik7XG4gICAgICAgICAgICAgICAgb3V0ICs9IHZhbCAqIHZhbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBuID4gYk1heCkge1xuICAgICAgICAgICAgICAgIHZhbCA9IChwbiAtIGJNYXgpO1xuICAgICAgICAgICAgICAgIG91dCArPSB2YWwgKiB2YWw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNxICs9IG91dDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzcTtcbiAgICB9XG5cbiAgICBfZXhwYW5kKGV4cGFuZE1pbiwgZXhwYW5kTWF4KSB7XG4gICAgICAgIHRtcFZlY0EuYWRkMih0aGlzLmdldE1pbigpLCBleHBhbmRNaW4pO1xuICAgICAgICB0bXBWZWNCLmFkZDIodGhpcy5nZXRNYXgoKSwgZXhwYW5kTWF4KTtcbiAgICAgICAgdGhpcy5zZXRNaW5NYXgodG1wVmVjQSwgdG1wVmVjQik7XG4gICAgfVxufVxuXG5leHBvcnQgeyBCb3VuZGluZ0JveCB9O1xuIl0sIm5hbWVzIjpbInRtcFZlY0EiLCJWZWMzIiwidG1wVmVjQiIsInRtcFZlY0MiLCJ0bXBWZWNEIiwidG1wVmVjRSIsIkJvdW5kaW5nQm94IiwiY29uc3RydWN0b3IiLCJjZW50ZXIiLCJoYWxmRXh0ZW50cyIsIl9taW4iLCJfbWF4IiwiRGVidWciLCJhc3NlcnQiLCJPYmplY3QiLCJpc0Zyb3plbiIsImFkZCIsIm90aGVyIiwidGMiLCJ0Y3giLCJ4IiwidGN5IiwieSIsInRjeiIsInoiLCJ0aCIsInRoeCIsInRoeSIsInRoeiIsInRtaW54IiwidG1heHgiLCJ0bWlueSIsInRtYXh5IiwidG1pbnoiLCJ0bWF4eiIsIm9jIiwib2N4Iiwib2N5Iiwib2N6Iiwib2giLCJvaHgiLCJvaHkiLCJvaHoiLCJvbWlueCIsIm9tYXh4Iiwib21pbnkiLCJvbWF4eSIsIm9taW56Iiwib21heHoiLCJjb3B5Iiwic3JjIiwiY2xvbmUiLCJpbnRlcnNlY3RzIiwiYU1heCIsImdldE1heCIsImFNaW4iLCJnZXRNaW4iLCJiTWF4IiwiYk1pbiIsIl9pbnRlcnNlY3RzUmF5IiwicmF5IiwicG9pbnQiLCJ0TWluIiwic3ViIiwib3JpZ2luIiwidE1heCIsImRpciIsImRpcmVjdGlvbiIsIk51bWJlciIsIk1BWF9WQUxVRSIsInJlYWxNaW4iLCJzZXQiLCJNYXRoIiwibWluIiwicmVhbE1heCIsIm1heCIsIm1pbk1heCIsIm1heE1pbiIsIm11bFNjYWxhciIsIl9mYXN0SW50ZXJzZWN0c1JheSIsImRpZmYiLCJjcm9zcyIsInByb2QiLCJhYnNEaWZmIiwiYWJzRGlyIiwicmF5RGlyIiwic3ViMiIsImFicyIsIm11bDIiLCJpbnRlcnNlY3RzUmF5Iiwic2V0TWluTWF4IiwiYWRkMiIsImNvbnRhaW5zUG9pbnQiLCJzZXRGcm9tVHJhbnNmb3JtZWRBYWJiIiwiYWFiYiIsIm0iLCJpZ25vcmVTY2FsZSIsImFjIiwiYXIiLCJkIiwiZGF0YSIsIm14MCIsIm14MSIsIm14MiIsIm15MCIsIm15MSIsIm15MiIsIm16MCIsIm16MSIsIm16MiIsImxlbmd0aFNxIiwiaW52TGVuZ3RoIiwic3FydCIsImNvbXB1dGVNaW5NYXgiLCJ2ZXJ0aWNlcyIsIm51bVZlcnRzIiwibGVuZ3RoIiwibWlueCIsIm1pbnkiLCJtaW56IiwibWF4eCIsIm1heHkiLCJtYXh6IiwibiIsImkiLCJjb21wdXRlIiwiaW50ZXJzZWN0c0JvdW5kaW5nU3BoZXJlIiwic3BoZXJlIiwic3EiLCJfZGlzdGFuY2VUb0JvdW5kaW5nU3BoZXJlU3EiLCJyYWRpdXMiLCJib3hNaW4iLCJib3hNYXgiLCJheGlzIiwib3V0IiwicG4iLCJ2YWwiLCJfZXhwYW5kIiwiZXhwYW5kTWluIiwiZXhwYW5kTWF4Il0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUdBLE1BQU1BLE9BQU8sR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUMxQixNQUFNQyxPQUFPLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDMUIsTUFBTUUsT0FBTyxHQUFHLElBQUlGLElBQUksRUFBRSxDQUFBO0FBQzFCLE1BQU1HLE9BQU8sR0FBRyxJQUFJSCxJQUFJLEVBQUUsQ0FBQTtBQUMxQixNQUFNSSxPQUFPLEdBQUcsSUFBSUosSUFBSSxFQUFFLENBQUE7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBLE1BQU1LLFdBQVcsQ0FBQztBQUNkO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNB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LE1BQU1JLEtBQUssR0FBR1IsR0FBRyxHQUFHSSxHQUFHLENBQUE7QUFDdkIsSUFBQSxNQUFNSyxLQUFLLEdBQUdSLEdBQUcsR0FBR0ksR0FBRyxDQUFBO0FBQ3ZCLElBQUEsTUFBTUssS0FBSyxHQUFHVCxHQUFHLEdBQUdJLEdBQUcsQ0FBQTtBQUN2QixJQUFBLE1BQU1NLEtBQUssR0FBR1QsR0FBRyxHQUFHSSxHQUFHLENBQUE7QUFDdkIsSUFBQSxNQUFNTSxLQUFLLEdBQUdWLEdBQUcsR0FBR0ksR0FBRyxDQUFBO0FBRXZCLElBQUEsSUFBSUMsS0FBSyxHQUFHZCxLQUFLLEVBQUVBLEtBQUssR0FBR2MsS0FBSyxDQUFBO0FBQ2hDLElBQUEsSUFBSUMsS0FBSyxHQUFHZCxLQUFLLEVBQUVBLEtBQUssR0FBR2MsS0FBSyxDQUFBO0FBQ2hDLElBQUEsSUFBSUMsS0FBSyxHQUFHZCxLQUFLLEVBQUVBLEtBQUssR0FBR2MsS0FBSyxDQUFBO0FBQ2hDLElBQUEsSUFBSUMsS0FBSyxHQUFHZCxLQUFLLEVBQUVBLEtBQUssR0FBR2MsS0FBSyxDQUFBO0FBQ2hDLElBQUEsSUFBSUMsS0FBSyxHQUFHZCxLQUFLLEVBQUVBLEtBQUssR0FBR2MsS0FBSyxDQUFBO0FBQ2hDLElBQUEsSUFBSUMsS0FBSyxHQUFHZCxLQUFLLEVBQUVBLEtBQUssR0FBR2MsS0FBSyxDQUFBO0lBRWhDOUIsRUFBRSxDQUFDRSxDQUFDLEdBQUcsQ0FBQ1MsS0FBSyxHQUFHQyxLQUFLLElBQUksR0FBRyxDQUFBO0lBQzVCWixFQUFFLENBQUNJLENBQUMsR0FBRyxDQUFDUyxLQUFLLEdBQUdDLEtBQUssSUFBSSxHQUFHLENBQUE7SUFDNUJkLEVBQUUsQ0FBQ00sQ0FBQyxHQUFHLENBQUNTLEtBQUssR0FBR0MsS0FBSyxJQUFJLEdBQUcsQ0FBQTtJQUM1QlQsRUFBRSxDQUFDTCxDQUFDLEdBQUcsQ0FBQ1UsS0FBSyxHQUFHRCxLQUFLLElBQUksR0FBRyxDQUFBO0lBQzVCSixFQUFFLENBQUNILENBQUMsR0FBRyxDQUFDVSxLQUFLLEdBQUdE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
