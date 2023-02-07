/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../debug.js';
import { Mat4 } from '../math/mat4.js';
import { Vec3 } from '../math/vec3.js';
import { BoundingBox } from './bounding-box.js';
import { BoundingSphere } from './bounding-sphere.js';
import { Ray } from './ray.js';

const tmpRay = new Ray();
const tmpVec3 = new Vec3();
const tmpSphere = new BoundingSphere();
const tmpMat4 = new Mat4();

/**
 * Oriented Box.
 */
class OrientedBox {
  /**
   * @type {Mat4}
   * @private
   */

  /**
   * @type {Mat4}
   * @private
   */

  /**
   * @type {BoundingBox}
   * @private
   */

  /**
   * Create a new OrientedBox instance.
   *
   * @param {Mat4} [worldTransform] - Transform that has the orientation and position of the box.
   * Scale is assumed to be one.
   * @param {Vec3} [halfExtents] - Half the distance across the box in each local axis. The
   * constructor takes a reference of this parameter.
   */
  constructor(worldTransform = new Mat4(), halfExtents = new Vec3(0.5, 0.5, 0.5)) {
    this.halfExtents = void 0;
    this._modelTransform = void 0;
    this._worldTransform = void 0;
    this._aabb = void 0;
    Debug.assert(!Object.isFrozen(worldTransform), 'The constructor of \'OrientedBox\' does not accept a constant (frozen) object as a \'worldTransform\' parameter');
    Debug.assert(!Object.isFrozen(halfExtents), 'The constructor of \'OrientedBox\' does not accept a constant (frozen) object as a \'halfExtents\' parameter');
    this.halfExtents = halfExtents;
    this._modelTransform = worldTransform.clone().invert();
    this._worldTransform = worldTransform.clone();
    this._aabb = new BoundingBox(new Vec3(), this.halfExtents);
  }

  /**
   * The world transform of the OBB.
   *
   * @type {Mat4}
   */
  set worldTransform(value) {
    this._worldTransform.copy(value);
    this._modelTransform.copy(value).invert();
  }
  get worldTransform() {
    return this._worldTransform;
  }

  /**
   * Test if a ray intersects with the OBB.
   *
   * @param {Ray} ray - Ray to test against (direction must be normalized).
   * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
   * into here.
   * @returns {boolean} True if there is an intersection.
   */
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

  /**
   * Test if a point is inside a OBB.
   *
   * @param {Vec3} point - Point to test.
   * @returns {boolean} True if the point is inside the OBB and false otherwise.
   */
  containsPoint(point) {
    this._modelTransform.transformPoint(point, tmpVec3);
    return this._aabb.containsPoint(tmpVec3);
  }

  /**
   * Test if a Bounding Sphere is overlapping, enveloping, or inside this OBB.
   *
   * @param {BoundingSphere} sphere - Bounding Sphere to test.
   * @returns {boolean} True if the Bounding Sphere is overlapping, enveloping or inside this OBB
   * and false otherwise.
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3JpZW50ZWQtYm94LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvY29yZS9zaGFwZS9vcmllbnRlZC1ib3guanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4vYm91bmRpbmctYm94LmpzJztcbmltcG9ydCB7IEJvdW5kaW5nU3BoZXJlIH0gZnJvbSAnLi9ib3VuZGluZy1zcGhlcmUuanMnO1xuaW1wb3J0IHsgUmF5IH0gZnJvbSAnLi9yYXkuanMnO1xuXG5jb25zdCB0bXBSYXkgPSBuZXcgUmF5KCk7XG5jb25zdCB0bXBWZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgdG1wTWF0NCA9IG5ldyBNYXQ0KCk7XG5cbi8qKlxuICogT3JpZW50ZWQgQm94LlxuICovXG5jbGFzcyBPcmllbnRlZEJveCB7XG4gICAgaGFsZkV4dGVudHM7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tb2RlbFRyYW5zZm9ybTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXQ0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3dvcmxkVHJhbnNmb3JtO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FhYmI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgT3JpZW50ZWRCb3ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IFt3b3JsZFRyYW5zZm9ybV0gLSBUcmFuc2Zvcm0gdGhhdCBoYXMgdGhlIG9yaWVudGF0aW9uIGFuZCBwb3NpdGlvbiBvZiB0aGUgYm94LlxuICAgICAqIFNjYWxlIGlzIGFzc3VtZWQgdG8gYmUgb25lLlxuICAgICAqIEBwYXJhbSB7VmVjM30gW2hhbGZFeHRlbnRzXSAtIEhhbGYgdGhlIGRpc3RhbmNlIGFjcm9zcyB0aGUgYm94IGluIGVhY2ggbG9jYWwgYXhpcy4gVGhlXG4gICAgICogY29uc3RydWN0b3IgdGFrZXMgYSByZWZlcmVuY2Ugb2YgdGhpcyBwYXJhbWV0ZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Iod29ybGRUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpLCBoYWxmRXh0ZW50cyA9IG5ldyBWZWMzKDAuNSwgMC41LCAwLjUpKSB7XG4gICAgICAgIERlYnVnLmFzc2VydCghT2JqZWN0LmlzRnJvemVuKHdvcmxkVHJhbnNmb3JtKSwgJ1RoZSBjb25zdHJ1Y3RvciBvZiBcXCdPcmllbnRlZEJveFxcJyBkb2VzIG5vdCBhY2NlcHQgYSBjb25zdGFudCAoZnJvemVuKSBvYmplY3QgYXMgYSBcXCd3b3JsZFRyYW5zZm9ybVxcJyBwYXJhbWV0ZXInKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KCFPYmplY3QuaXNGcm96ZW4oaGFsZkV4dGVudHMpLCAnVGhlIGNvbnN0cnVjdG9yIG9mIFxcJ09yaWVudGVkQm94XFwnIGRvZXMgbm90IGFjY2VwdCBhIGNvbnN0YW50IChmcm96ZW4pIG9iamVjdCBhcyBhIFxcJ2hhbGZFeHRlbnRzXFwnIHBhcmFtZXRlcicpO1xuXG4gICAgICAgIHRoaXMuaGFsZkV4dGVudHMgPSBoYWxmRXh0ZW50cztcblxuICAgICAgICB0aGlzLl9tb2RlbFRyYW5zZm9ybSA9IHdvcmxkVHJhbnNmb3JtLmNsb25lKCkuaW52ZXJ0KCk7XG4gICAgICAgIHRoaXMuX3dvcmxkVHJhbnNmb3JtID0gd29ybGRUcmFuc2Zvcm0uY2xvbmUoKTtcbiAgICAgICAgdGhpcy5fYWFiYiA9IG5ldyBCb3VuZGluZ0JveChuZXcgVmVjMygpLCB0aGlzLmhhbGZFeHRlbnRzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd29ybGQgdHJhbnNmb3JtIG9mIHRoZSBPQkIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKi9cbiAgICBzZXQgd29ybGRUcmFuc2Zvcm0odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fd29ybGRUcmFuc2Zvcm0uY29weSh2YWx1ZSk7XG4gICAgICAgIHRoaXMuX21vZGVsVHJhbnNmb3JtLmNvcHkodmFsdWUpLmludmVydCgpO1xuICAgIH1cblxuICAgIGdldCB3b3JsZFRyYW5zZm9ybSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dvcmxkVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgYSByYXkgaW50ZXJzZWN0cyB3aXRoIHRoZSBPQkIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JheX0gcmF5IC0gUmF5IHRvIHRlc3QgYWdhaW5zdCAoZGlyZWN0aW9uIG11c3QgYmUgbm9ybWFsaXplZCkuXG4gICAgICogQHBhcmFtIHtWZWMzfSBbcG9pbnRdIC0gSWYgdGhlcmUgaXMgYW4gaW50ZXJzZWN0aW9uLCB0aGUgaW50ZXJzZWN0aW9uIHBvaW50IHdpbGwgYmUgY29waWVkXG4gICAgICogaW50byBoZXJlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZXJlIGlzIGFuIGludGVyc2VjdGlvbi5cbiAgICAgKi9cbiAgICBpbnRlcnNlY3RzUmF5KHJheSwgcG9pbnQpIHtcbiAgICAgICAgdGhpcy5fbW9kZWxUcmFuc2Zvcm0udHJhbnNmb3JtUG9pbnQocmF5Lm9yaWdpbiwgdG1wUmF5Lm9yaWdpbik7XG4gICAgICAgIHRoaXMuX21vZGVsVHJhbnNmb3JtLnRyYW5zZm9ybVZlY3RvcihyYXkuZGlyZWN0aW9uLCB0bXBSYXkuZGlyZWN0aW9uKTtcblxuICAgICAgICBpZiAocG9pbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2FhYmIuX2ludGVyc2VjdHNSYXkodG1wUmF5LCBwb2ludCk7XG4gICAgICAgICAgICB0bXBNYXQ0LmNvcHkodGhpcy5fbW9kZWxUcmFuc2Zvcm0pLmludmVydCgpLnRyYW5zZm9ybVBvaW50KHBvaW50LCBwb2ludCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmIuX2Zhc3RJbnRlcnNlY3RzUmF5KHRtcFJheSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGVzdCBpZiBhIHBvaW50IGlzIGluc2lkZSBhIE9CQi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9pbnQgLSBQb2ludCB0byB0ZXN0LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBwb2ludCBpcyBpbnNpZGUgdGhlIE9CQiBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGNvbnRhaW5zUG9pbnQocG9pbnQpIHtcbiAgICAgICAgdGhpcy5fbW9kZWxUcmFuc2Zvcm0udHJhbnNmb3JtUG9pbnQocG9pbnQsIHRtcFZlYzMpO1xuICAgICAgICByZXR1cm4gdGhpcy5fYWFiYi5jb250YWluc1BvaW50KHRtcFZlYzMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgYSBCb3VuZGluZyBTcGhlcmUgaXMgb3ZlcmxhcHBpbmcsIGVudmVsb3BpbmcsIG9yIGluc2lkZSB0aGlzIE9CQi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Qm91bmRpbmdTcGhlcmV9IHNwaGVyZSAtIEJvdW5kaW5nIFNwaGVyZSB0byB0ZXN0LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBCb3VuZGluZyBTcGhlcmUgaXMgb3ZlcmxhcHBpbmcsIGVudmVsb3Bpbmcgb3IgaW5zaWRlIHRoaXMgT0JCXG4gICAgICogYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpbnRlcnNlY3RzQm91bmRpbmdTcGhlcmUoc3BoZXJlKSB7XG4gICAgICAgIHRoaXMuX21vZGVsVHJhbnNmb3JtLnRyYW5zZm9ybVBvaW50KHNwaGVyZS5jZW50ZXIsIHRtcFNwaGVyZS5jZW50ZXIpO1xuICAgICAgICB0bXBTcGhlcmUucmFkaXVzID0gc3BoZXJlLnJhZGl1cztcblxuICAgICAgICBpZiAodGhpcy5fYWFiYi5pbnRlcnNlY3RzQm91bmRpbmdTcGhlcmUodG1wU3BoZXJlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG5leHBvcnQgeyBPcmllbnRlZEJveCB9O1xuIl0sIm5hbWVzIjpbInRtcFJheSIsIlJheSIsInRtcFZlYzMiLCJWZWMzIiwidG1wU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJ0bXBNYXQ0IiwiTWF0NCIsIk9yaWVudGVkQm94IiwiY29uc3RydWN0b3IiLCJ3b3JsZFRyYW5zZm9ybSIsImhhbGZFeHRlbnRzIiwiX21vZGVsVHJhbnNmb3JtIiwiX3dvcmxkVHJhbnNmb3JtIiwiX2FhYmIiLCJEZWJ1ZyIsImFzc2VydCIsIk9iamVjdCIsImlzRnJvemVuIiwiY2xvbmUiLCJpbnZlcnQiLCJCb3VuZGluZ0JveCIsInZhbHVlIiwiY29weSIsImludGVyc2VjdHNSYXkiLCJyYXkiLCJwb2ludCIsInRyYW5zZm9ybVBvaW50Iiwib3JpZ2luIiwidHJhbnNmb3JtVmVjdG9yIiwiZGlyZWN0aW9uIiwicmVzdWx0IiwiX2ludGVyc2VjdHNSYXkiLCJfZmFzdEludGVyc2VjdHNSYXkiLCJjb250YWluc1BvaW50IiwiaW50ZXJzZWN0c0JvdW5kaW5nU3BoZXJlIiwic3BoZXJlIiwiY2VudGVyIiwicmFkaXVzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFRQSxNQUFNQSxNQUFNLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7QUFDeEIsTUFBTUMsT0FBTyxHQUFHLElBQUlDLElB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
