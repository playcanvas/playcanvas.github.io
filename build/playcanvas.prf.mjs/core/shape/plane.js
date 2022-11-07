/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();

class Plane {
  constructor(point = new Vec3(), normal = new Vec3(0, 0, 1)) {
    this.point = point;
    this.normal = normal;
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
}

export { Plane };
