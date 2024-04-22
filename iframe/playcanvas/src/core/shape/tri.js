import { Vec3 } from '../math/vec3.js';

const e1 = new Vec3();
const e2 = new Vec3();
const h = new Vec3();
const s = new Vec3();
const q = new Vec3();
const EPSILON = 1e-6;
class Tri {
  constructor(v0 = Vec3.ZERO, v1 = Vec3.ZERO, v2 = Vec3.ZERO) {
    this.v0 = new Vec3();
    this.v1 = new Vec3();
    this.v2 = new Vec3();
    this.set(v0, v1, v2);
  }
  set(v0, v1, v2) {
    this.v0.copy(v0);
    this.v1.copy(v1);
    this.v2.copy(v2);
    return this;
  }
  intersectsRay(ray, point) {
    e1.sub2(this.v1, this.v0);
    e2.sub2(this.v2, this.v0);
    h.cross(ray.direction, e2);
    const a = e1.dot(h);
    if (a > -EPSILON && a < EPSILON) {
      return false;
    }
    const f = 1 / a;
    s.sub2(ray.origin, this.v0);
    const u = f * s.dot(h);
    if (u < 0 || u > 1) {
      return false;
    }
    q.cross(s, e1);
    const v = f * ray.direction.dot(q);
    if (v < 0 || u + v > 1) {
      return false;
    }
    const t = f * e2.dot(q);
    if (t > EPSILON) {
      if (point instanceof Vec3) {
        point.copy(ray.direction).mulScalar(t).add(ray.origin);
      }
      return true;
    }
    return false;
  }
  toString() {
    return '[' + this.v0.toString() + ', ' + this.v1.toString() + ', ' + this.v2.toString() + ']';
  }
}

export { Tri };
