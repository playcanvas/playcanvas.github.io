/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

let ids = 0;

class XrPlane extends EventHandler {

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

  destroy() {
    this.fire('remove');
  }

  update(frame) {
    const manager = this._planeDetection._manager;
    const pose = frame.getPose(this._xrPlane.planeSpace, manager._referenceSpace);
    if (pose) {
      this._position.copy(pose.transform.position);
      this._rotation.copy(pose.transform.orientation);
    }

    if (this._lastChangedTime !== this._xrPlane.lastChangedTime) {
      this._lastChangedTime = this._xrPlane.lastChangedTime;

      this.fire('change');
    }
  }

  getPosition() {
    return this._position;
  }

  getRotation() {
    return this._rotation;
  }

  get id() {
    return this._id;
  }

  get orientation() {
    return this._orientation;
  }

  get points() {
    return this._xrPlane.polygon;
  }
}

export { XrPlane };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItcGxhbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItcGxhbmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi94ci1wbGFuZS1kZXRlY3Rpb24uanMnKS5YclBsYW5lRGV0ZWN0aW9ufSBYclBsYW5lRGV0ZWN0aW9uICovXG5cbmxldCBpZHMgPSAwO1xuXG4vKipcbiAqIERldGVjdGVkIFBsYW5lIGluc3RhbmNlIHRoYXQgcHJvdmlkZXMgcG9zaXRpb24sIHJvdGF0aW9uIGFuZCBwb2x5Z29uIHBvaW50cy4gUGxhbmUgaXMgYSBzdWJqZWN0XG4gKiB0byBjaGFuZ2UgZHVyaW5nIGl0cyBsaWZldGltZS5cbiAqL1xuY2xhc3MgWHJQbGFuZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pZDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYclBsYW5lRGV0ZWN0aW9ufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BsYW5lRGV0ZWN0aW9uO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1hSUGxhbmV9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfeHJQbGFuZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGFzdENoYW5nZWRUaW1lO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vcmllbnRhdGlvbjtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtWZWMzfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Bvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JvdGF0aW9uID0gbmV3IFF1YXQoKTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYclBsYW5lIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtYclBsYW5lRGV0ZWN0aW9ufSBwbGFuZURldGVjdGlvbiAtIFBsYW5lIGRldGVjdGlvbiBzeXN0ZW0uXG4gICAgICogQHBhcmFtIHsqfSB4clBsYW5lIC0gWFJQbGFuZSB0aGF0IGlzIGluc3RhbnRpYXRlZCBieSBXZWJYUiBzeXN0ZW0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHBsYW5lRGV0ZWN0aW9uLCB4clBsYW5lKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5faWQgPSArK2lkcztcbiAgICAgICAgdGhpcy5fcGxhbmVEZXRlY3Rpb24gPSBwbGFuZURldGVjdGlvbjtcbiAgICAgICAgdGhpcy5feHJQbGFuZSA9IHhyUGxhbmU7XG4gICAgICAgIHRoaXMuX2xhc3RDaGFuZ2VkVGltZSA9IHhyUGxhbmUubGFzdENoYW5nZWRUaW1lO1xuICAgICAgICB0aGlzLl9vcmllbnRhdGlvbiA9IHhyUGxhbmUub3JpZW50YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB7QGxpbmsgWHJQbGFuZX0gaXMgcmVtb3ZlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYclBsYW5lI3JlbW92ZVxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGxhbmUub25jZSgncmVtb3ZlJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAvLyBwbGFuZSBpcyBub3QgYXZhaWxhYmxlIGFueW1vcmVcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4ge0BsaW5rIFhyUGxhbmV9IGF0dHJpYnV0ZXMgc3VjaCBhczogb3JpZW50YXRpb24gYW5kL29yIHBvaW50cyBoYXZlIGJlZW4gY2hhbmdlZC5cbiAgICAgKiBQb3NpdGlvbiBhbmQgcm90YXRpb24gY2FuIGNoYW5nZSBhdCBhbnkgdGltZSB3aXRob3V0IHRyaWdnZXJpbmcgYSBgY2hhbmdlYCBldmVudC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYclBsYW5lI2NoYW5nZVxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGxhbmUub24oJ2NoYW5nZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgLy8gcGxhbmUgaGFzIGJlZW4gY2hhbmdlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqIEBpZ25vcmUgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgY29uc3QgbWFuYWdlciA9IHRoaXMuX3BsYW5lRGV0ZWN0aW9uLl9tYW5hZ2VyO1xuICAgICAgICBjb25zdCBwb3NlID0gZnJhbWUuZ2V0UG9zZSh0aGlzLl94clBsYW5lLnBsYW5lU3BhY2UsIG1hbmFnZXIuX3JlZmVyZW5jZVNwYWNlKTtcbiAgICAgICAgaWYgKHBvc2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uLmNvcHkocG9zZS50cmFuc2Zvcm0ucG9zaXRpb24pO1xuICAgICAgICAgICAgdGhpcy5fcm90YXRpb24uY29weShwb3NlLnRyYW5zZm9ybS5vcmllbnRhdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoYXMgbm90IGNoYW5nZWRcbiAgICAgICAgaWYgKHRoaXMuX2xhc3RDaGFuZ2VkVGltZSAhPT0gdGhpcy5feHJQbGFuZS5sYXN0Q2hhbmdlZFRpbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2xhc3RDaGFuZ2VkVGltZSA9IHRoaXMuX3hyUGxhbmUubGFzdENoYW5nZWRUaW1lO1xuXG4gICAgICAgICAgICAvLyBhdHRyaWJ1dGVzIGhhdmUgYmVlbiBjaGFuZ2VkXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2NoYW5nZScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBhIHBsYW5lLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBhIHBsYW5lLlxuICAgICAqL1xuICAgIGdldFBvc2l0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcG9zaXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiBhIHBsYW5lLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1F1YXR9IFRoZSB3b3JsZCBzcGFjZSByb3RhdGlvbiBvZiBhIHBsYW5lLlxuICAgICAqL1xuICAgIGdldFJvdGF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcm90YXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVW5pcXVlIGlkZW50aWZpZXIgb2YgYSBwbGFuZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGlkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGxhbmUncyBzcGVjaWZpYyBvcmllbnRhdGlvbiAoaG9yaXpvbnRhbCBvciB2ZXJ0aWNhbCkgb3IgbnVsbCBpZiBvcmllbnRhdGlvbiBpcyBhbnl0aGluZyBlbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIGdldCBvcmllbnRhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29yaWVudGF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIERPTVBvaW50UmVhZE9ubHkgb2JqZWN0cy4gRE9NUG9pbnRSZWFkT25seSBpcyBhbiBvYmplY3Qgd2l0aCBgeCB5IHpgIHByb3BlcnRpZXNcbiAgICAgKiB0aGF0IGRlZmluZXMgYSBsb2NhbCBwb2ludCBvZiBhIHBsYW5lJ3MgcG9seWdvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3RbXX1cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHByZXBhcmUgcmV1c2FibGUgb2JqZWN0c1xuICAgICAqIHZhciB2ZWNBID0gbmV3IHBjLlZlYzMoKTtcbiAgICAgKiB2YXIgdmVjQiA9IG5ldyBwYy5WZWMzKCk7XG4gICAgICogdmFyIGNvbG9yID0gbmV3IHBjLkNvbG9yKDEsIDEsIDEpO1xuICAgICAqXG4gICAgICogLy8gdXBkYXRlIE1hdDQgdG8gcGxhbmUgcG9zaXRpb24gYW5kIHJvdGF0aW9uXG4gICAgICogdHJhbnNmb3JtLnNldFRSUyhwbGFuZS5nZXRQb3NpdGlvbigpLCBwbGFuZS5nZXRSb3RhdGlvbigpLCBwYy5WZWMzLk9ORSk7XG4gICAgICpcbiAgICAgKiAvLyBkcmF3IGxpbmVzIGJldHdlZW4gcG9pbnRzXG4gICAgICogZm9yICh2YXIgaSA9IDA7IGkgPCBwbGFuZS5wb2ludHMubGVuZ3RoOyBpKyspIHtcbiAgICAgKiAgICAgdmVjQS5jb3B5KHBsYW5lLnBvaW50c1tpXSk7XG4gICAgICogICAgIHZlY0IuY29weShwbGFuZS5wb2ludHNbKGkgKyAxKSAlIHBsYW5lLnBvaW50cy5sZW5ndGhdKTtcbiAgICAgKlxuICAgICAqICAgICAvLyB0cmFuc2Zvcm0gZnJvbSBwbGFuZXMgbG9jYWwgdG8gd29ybGQgY29vcmRzXG4gICAgICogICAgIHRyYW5zZm9ybS50cmFuc2Zvcm1Qb2ludCh2ZWNBLCB2ZWNBKTtcbiAgICAgKiAgICAgdHJhbnNmb3JtLnRyYW5zZm9ybVBvaW50KHZlY0IsIHZlY0IpO1xuICAgICAqXG4gICAgICogICAgIC8vIHJlbmRlciBsaW5lXG4gICAgICogICAgIGFwcC5kcmF3TGluZSh2ZWNBLCB2ZWNCLCBjb2xvcik7XG4gICAgICogfVxuICAgICAqL1xuICAgIGdldCBwb2ludHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl94clBsYW5lLnBvbHlnb247XG4gICAgfVxufVxuXG5leHBvcnQgeyBYclBsYW5lIH07XG4iXSwibmFtZXMiOlsiaWRzIiwiWHJQbGFuZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwicGxhbmVEZXRlY3Rpb24iLCJ4clBsYW5lIiwiX2lkIiwiX3BsYW5lRGV0ZWN0aW9uIiwiX3hyUGxhbmUiLCJfbGFzdENoYW5nZWRUaW1lIiwiX29yaWVudGF0aW9uIiwiX3Bvc2l0aW9uIiwiVmVjMyIsIl9yb3RhdGlvbiIsIlF1YXQiLCJsYXN0Q2hhbmdlZFRpbWUiLCJvcmllbnRhdGlvbiIsImRlc3Ryb3kiLCJmaXJlIiwidXBkYXRlIiwiZnJhbWUiLCJtYW5hZ2VyIiwiX21hbmFnZXIiLCJwb3NlIiwiZ2V0UG9zZSIsInBsYW5lU3BhY2UiLCJfcmVmZXJlbmNlU3BhY2UiLCJjb3B5IiwidHJhbnNmb3JtIiwicG9zaXRpb24iLCJnZXRQb3NpdGlvbiIsImdldFJvdGF0aW9uIiwiaWQiLCJwb2ludHMiLCJwb2x5Z29uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFNQSxJQUFJQSxHQUFHLEdBQUcsQ0FBQyxDQUFBOztBQU1YLE1BQU1DLE9BQU8sU0FBU0MsWUFBWSxDQUFDOztBQWtEL0JDLEVBQUFBLFdBQVcsQ0FBQ0MsY0FBYyxFQUFFQyxPQUFPLEVBQUU7QUFDakMsSUFBQSxLQUFLLEVB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