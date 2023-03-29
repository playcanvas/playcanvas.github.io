/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

let ids = 0;

/**
 * Detected Plane instance that provides position, rotation and polygon points. Plane is a subject
 * to change during its lifetime.
 */
class XrPlane extends EventHandler {
  /**
   * @type {number}
   * @private
   */

  /**
   * @type {import('./xr-plane-detection.js').XrPlaneDetection}
   * @private
   */

  /**
   * @type {XRPlane}
   * @private
   */

  /**
   * @type {number}
   * @private
   */

  /**
   * @type {string}
   * @private
   */

  /**
   * @type {Vec3}
   * @private
   */

  /**
   * @type {Quat}
   * @private
   */

  /**
   * Create a new XrPlane instance.
   *
   * @param {import('./xr-plane-detection.js').XrPlaneDetection} planeDetection - Plane detection
   * system.
   * @param {*} xrPlane - XRPlane that is instantiated by WebXR system.
   * @hideconstructor
   */
  constructor(planeDetection, xrPlane) {
    super();
    this._id = void 0;
    this._planeDetection = void 0;
    this._xrPlane = void 0;
    this._lastChangedTime = void 0;
    this._orientation = void 0;
    this._position = new Vec3();
    this._rotation = new Quat();
    this._id = ++ids;
    this._planeDetection = planeDetection;
    this._xrPlane = xrPlane;
    this._lastChangedTime = xrPlane.lastChangedTime;
    this._orientation = xrPlane.orientation;
  }

  /**
   * Fired when {@link XrPlane} is removed.
   *
   * @event XrPlane#remove
   * @example
   * plane.once('remove', function () {
   *     // plane is not available anymore
   * });
   */

  /**
   * Fired when {@link XrPlane} attributes such as: orientation and/or points have been changed.
   * Position and rotation can change at any time without triggering a `change` event.
   *
   * @event XrPlane#change
   * @example
   * plane.on('change', function () {
   *     // plane has been changed
   * });
   */

  /** @ignore */
  destroy() {
    this.fire('remove');
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    const manager = this._planeDetection._manager;
    const pose = frame.getPose(this._xrPlane.planeSpace, manager._referenceSpace);
    if (pose) {
      this._position.copy(pose.transform.position);
      this._rotation.copy(pose.transform.orientation);
    }

    // has not changed
    if (this._lastChangedTime !== this._xrPlane.lastChangedTime) {
      this._lastChangedTime = this._xrPlane.lastChangedTime;

      // attributes have been changed
      this.fire('change');
    }
  }

  /**
   * Get the world space position of a plane.
   *
   * @returns {Vec3} The world space position of a plane.
   */
  getPosition() {
    return this._position;
  }

  /**
   * Get the world space rotation of a plane.
   *
   * @returns {Quat} The world space rotation of a plane.
   */
  getRotation() {
    return this._rotation;
  }

  /**
   * Unique identifier of a plane.
   *
   * @type {number}
   */
  get id() {
    return this._id;
  }

  /**
   * Plane's specific orientation (horizontal or vertical) or null if orientation is anything else.
   *
   * @type {string|null}
   */
  get orientation() {
    return this._orientation;
  }

  /**
   * Array of DOMPointReadOnly objects. DOMPointReadOnly is an object with `x y z` properties
   * that defines a local point of a plane's polygon.
   *
   * @type {object[]}
   * @example
   * // prepare reusable objects
   * var vecA = new pc.Vec3();
   * var vecB = new pc.Vec3();
   * var color = new pc.Color(1, 1, 1);
   *
   * // update Mat4 to plane position and rotation
   * transform.setTRS(plane.getPosition(), plane.getRotation(), pc.Vec3.ONE);
   *
   * // draw lines between points
   * for (var i = 0; i < plane.points.length; i++) {
   *     vecA.copy(plane.points[i]);
   *     vecB.copy(plane.points[(i + 1) % plane.points.length]);
   *
   *     // transform from planes local to world coords
   *     transform.transformPoint(vecA, vecA);
   *     transform.transformPoint(vecB, vecB);
   *
   *     // render line
   *     app.drawLine(vecA, vecB, color);
   * }
   */
  get points() {
    return this._xrPlane.polygon;
  }
}

export { XrPlane };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItcGxhbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItcGxhbmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5sZXQgaWRzID0gMDtcblxuLyoqXG4gKiBEZXRlY3RlZCBQbGFuZSBpbnN0YW5jZSB0aGF0IHByb3ZpZGVzIHBvc2l0aW9uLCByb3RhdGlvbiBhbmQgcG9seWdvbiBwb2ludHMuIFBsYW5lIGlzIGEgc3ViamVjdFxuICogdG8gY2hhbmdlIGR1cmluZyBpdHMgbGlmZXRpbWUuXG4gKi9cbmNsYXNzIFhyUGxhbmUgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaWQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyLXBsYW5lLWRldGVjdGlvbi5qcycpLlhyUGxhbmVEZXRlY3Rpb259XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGxhbmVEZXRlY3Rpb247XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WFJQbGFuZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF94clBsYW5lO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sYXN0Q2hhbmdlZFRpbWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29yaWVudGF0aW9uO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhyUGxhbmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi94ci1wbGFuZS1kZXRlY3Rpb24uanMnKS5YclBsYW5lRGV0ZWN0aW9ufSBwbGFuZURldGVjdGlvbiAtIFBsYW5lIGRldGVjdGlvblxuICAgICAqIHN5c3RlbS5cbiAgICAgKiBAcGFyYW0geyp9IHhyUGxhbmUgLSBYUlBsYW5lIHRoYXQgaXMgaW5zdGFudGlhdGVkIGJ5IFdlYlhSIHN5c3RlbS5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IocGxhbmVEZXRlY3Rpb24sIHhyUGxhbmUpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9pZCA9ICsraWRzO1xuICAgICAgICB0aGlzLl9wbGFuZURldGVjdGlvbiA9IHBsYW5lRGV0ZWN0aW9uO1xuICAgICAgICB0aGlzLl94clBsYW5lID0geHJQbGFuZTtcbiAgICAgICAgdGhpcy5fbGFzdENoYW5nZWRUaW1lID0geHJQbGFuZS5sYXN0Q2hhbmdlZFRpbWU7XG4gICAgICAgIHRoaXMuX29yaWVudGF0aW9uID0geHJQbGFuZS5vcmllbnRhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHtAbGluayBYclBsYW5lfSBpcyByZW1vdmVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyUGxhbmUjcmVtb3ZlXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwbGFuZS5vbmNlKCdyZW1vdmUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIC8vIHBsYW5lIGlzIG5vdCBhdmFpbGFibGUgYW55bW9yZVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB7QGxpbmsgWHJQbGFuZX0gYXR0cmlidXRlcyBzdWNoIGFzOiBvcmllbnRhdGlvbiBhbmQvb3IgcG9pbnRzIGhhdmUgYmVlbiBjaGFuZ2VkLlxuICAgICAqIFBvc2l0aW9uIGFuZCByb3RhdGlvbiBjYW4gY2hhbmdlIGF0IGFueSB0aW1lIHdpdGhvdXQgdHJpZ2dlcmluZyBhIGBjaGFuZ2VgIGV2ZW50LlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyUGxhbmUjY2hhbmdlXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwbGFuZS5vbignY2hhbmdlJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBwbGFuZSBoYXMgYmVlbiBjaGFuZ2VkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKiogQGlnbm9yZSAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBjb25zdCBtYW5hZ2VyID0gdGhpcy5fcGxhbmVEZXRlY3Rpb24uX21hbmFnZXI7XG4gICAgICAgIGNvbnN0IHBvc2UgPSBmcmFtZS5nZXRQb3NlKHRoaXMuX3hyUGxhbmUucGxhbmVTcGFjZSwgbWFuYWdlci5fcmVmZXJlbmNlU3BhY2UpO1xuICAgICAgICBpZiAocG9zZSkge1xuICAgICAgICAgICAgdGhpcy5fcG9zaXRpb24uY29weShwb3NlLnRyYW5zZm9ybS5wb3NpdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9yb3RhdGlvbi5jb3B5KHBvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhhcyBub3QgY2hhbmdlZFxuICAgICAgICBpZiAodGhpcy5fbGFzdENoYW5nZWRUaW1lICE9PSB0aGlzLl94clBsYW5lLmxhc3RDaGFuZ2VkVGltZSkge1xuICAgICAgICAgICAgdGhpcy5fbGFzdENoYW5nZWRUaW1lID0gdGhpcy5feHJQbGFuZS5sYXN0Q2hhbmdlZFRpbWU7XG5cbiAgICAgICAgICAgIC8vIGF0dHJpYnV0ZXMgaGF2ZSBiZWVuIGNoYW5nZWRcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnY2hhbmdlJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIGEgcGxhbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7VmVjM30gVGhlIHdvcmxkIHNwYWNlIHBvc2l0aW9uIG9mIGEgcGxhbmUuXG4gICAgICovXG4gICAgZ2V0UG9zaXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIGEgcGxhbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7UXVhdH0gVGhlIHdvcmxkIHNwYWNlIHJvdGF0aW9uIG9mIGEgcGxhbmUuXG4gICAgICovXG4gICAgZ2V0Um90YXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmlxdWUgaWRlbnRpZmllciBvZiBhIHBsYW5lLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQbGFuZSdzIHNwZWNpZmljIG9yaWVudGF0aW9uIChob3Jpem9udGFsIG9yIHZlcnRpY2FsKSBvciBudWxsIGlmIG9yaWVudGF0aW9uIGlzIGFueXRoaW5nIGVsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICovXG4gICAgZ2V0IG9yaWVudGF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3JpZW50YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXJyYXkgb2YgRE9NUG9pbnRSZWFkT25seSBvYmplY3RzLiBET01Qb2ludFJlYWRPbmx5IGlzIGFuIG9iamVjdCB3aXRoIGB4IHkgemAgcHJvcGVydGllc1xuICAgICAqIHRoYXQgZGVmaW5lcyBhIGxvY2FsIHBvaW50IG9mIGEgcGxhbmUncyBwb2x5Z29uLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdFtdfVxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gcHJlcGFyZSByZXVzYWJsZSBvYmplY3RzXG4gICAgICogdmFyIHZlY0EgPSBuZXcgcGMuVmVjMygpO1xuICAgICAqIHZhciB2ZWNCID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiB2YXIgY29sb3IgPSBuZXcgcGMuQ29sb3IoMSwgMSwgMSk7XG4gICAgICpcbiAgICAgKiAvLyB1cGRhdGUgTWF0NCB0byBwbGFuZSBwb3NpdGlvbiBhbmQgcm90YXRpb25cbiAgICAgKiB0cmFuc2Zvcm0uc2V0VFJTKHBsYW5lLmdldFBvc2l0aW9uKCksIHBsYW5lLmdldFJvdGF0aW9uKCksIHBjLlZlYzMuT05FKTtcbiAgICAgKlxuICAgICAqIC8vIGRyYXcgbGluZXMgYmV0d2VlbiBwb2ludHNcbiAgICAgKiBmb3IgKHZhciBpID0gMDsgaSA8IHBsYW5lLnBvaW50cy5sZW5ndGg7IGkrKykge1xuICAgICAqICAgICB2ZWNBLmNvcHkocGxhbmUucG9pbnRzW2ldKTtcbiAgICAgKiAgICAgdmVjQi5jb3B5KHBsYW5lLnBvaW50c1soaSArIDEpICUgcGxhbmUucG9pbnRzLmxlbmd0aF0pO1xuICAgICAqXG4gICAgICogICAgIC8vIHRyYW5zZm9ybSBmcm9tIHBsYW5lcyBsb2NhbCB0byB3b3JsZCBjb29yZHNcbiAgICAgKiAgICAgdHJhbnNmb3JtLnRyYW5zZm9ybVBvaW50KHZlY0EsIHZlY0EpO1xuICAgICAqICAgICB0cmFuc2Zvcm0udHJhbnNmb3JtUG9pbnQodmVjQiwgdmVjQik7XG4gICAgICpcbiAgICAgKiAgICAgLy8gcmVuZGVyIGxpbmVcbiAgICAgKiAgICAgYXBwLmRyYXdMaW5lKHZlY0EsIHZlY0IsIGNvbG9yKTtcbiAgICAgKiB9XG4gICAgICovXG4gICAgZ2V0IHBvaW50cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3hyUGxhbmUucG9seWdvbjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhyUGxhbmUgfTtcbiJdLCJuYW1lcyI6WyJpZHMiLCJYclBsYW5lIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJwbGFuZURldGVjdGlvbiIsInhyUGxhbmUiLCJfaWQiLCJfcGxhbmVEZXRlY3Rpb24iLCJfeHJQbGFuZSIsIl9sYXN0Q2hhbmdlZFRpbWUiLCJfb3JpZW50YXRpb24iLCJfcG9zaXRpb24iLCJWZWMzIiwiX3JvdGF0aW9uIiwiUXVhdCIsImxhc3RDaGFuZ2VkVGltZSIsIm9yaWVudGF0aW9uIiwiZGVzdHJveSIsImZpcmUiLCJ1cGRhdGUiLCJmcmFtZSIsIm1hbmFnZXIiLCJfbWFuYWdlciIsInBvc2UiLCJnZXRQb3NlIiwicGxhbmVTcGFjZSIsIl9yZWZlcmVuY2VTcGFjZSIsImNvcHkiLCJ0cmFuc2Zvcm0iLCJwb3NpdGlvbiIsImdldFBvc2l0aW9uIiwiZ2V0Um90YXRpb24iLCJpZCIsInBvaW50cyIsInBvbHlnb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUlBLElBQUlBLEdBQUcsR0FBRyxDQUFDLENBQUE7O0FBRVg7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxPQUFPLFNBQVNDLFlBQVksQ0FBQztBQUMvQjtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7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
