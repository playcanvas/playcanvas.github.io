/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../../core/platform.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

const tipJointIds = platform.browser && window.XRHand ? ['thumb-tip', 'index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'] : [];
const tipJointIdsIndex = {};
for (let i = 0; i < tipJointIds.length; i++) {
  tipJointIdsIndex[tipJointIds[i]] = true;
}

class XrJoint {

  constructor(index, id, hand, finger = null) {
    this._index = void 0;
    this._id = void 0;
    this._hand = void 0;
    this._finger = void 0;
    this._wrist = void 0;
    this._tip = void 0;
    this._radius = null;
    this._localTransform = new Mat4();
    this._worldTransform = new Mat4();
    this._localPosition = new Vec3();
    this._localRotation = new Quat();
    this._position = new Vec3();
    this._rotation = new Quat();
    this._dirtyLocal = true;
    this._index = index;
    this._id = id;
    this._hand = hand;
    this._finger = finger;
    this._wrist = id === 'wrist';
    this._tip = this._finger && !!tipJointIdsIndex[id];
  }

  update(pose) {
    this._dirtyLocal = true;
    this._radius = pose.radius;
    this._localPosition.copy(pose.transform.position);
    this._localRotation.copy(pose.transform.orientation);
  }

  _updateTransforms() {
    if (this._dirtyLocal) {
      this._dirtyLocal = false;
      this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
    }
    const manager = this._hand._manager;
    const parent = manager.camera.parent;
    if (parent) {
      this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
    } else {
      this._worldTransform.copy(this._localTransform);
    }
  }

  getPosition() {
    this._updateTransforms();
    this._worldTransform.getTranslation(this._position);
    return this._position;
  }

  getRotation() {
    this._updateTransforms();
    this._rotation.setFromMat4(this._worldTransform);
    return this._rotation;
  }

  get index() {
    return this._index;
  }

  get hand() {
    return this._hand;
  }

  get finger() {
    return this._finger;
  }

  get wrist() {
    return this._wrist;
  }

  get tip() {
    return this._tip;
  }

  get radius() {
    return this._radius || 0.005;
  }
}

export { XrJoint };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItam9pbnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItam9pbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4veHItZmluZ2VyLmpzJykuWHJGaW5nZXJ9IFhyRmluZ2VyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi94ci1oYW5kLmpzJykuWHJIYW5kfSBYckhhbmQgKi9cblxuY29uc3QgdGlwSm9pbnRJZHMgPSBwbGF0Zm9ybS5icm93c2VyICYmIHdpbmRvdy5YUkhhbmQgPyBbXG4gICAgJ3RodW1iLXRpcCcsXG4gICAgJ2luZGV4LWZpbmdlci10aXAnLFxuICAgICdtaWRkbGUtZmluZ2VyLXRpcCcsXG4gICAgJ3JpbmctZmluZ2VyLXRpcCcsXG4gICAgJ3Bpbmt5LWZpbmdlci10aXAnXG5dIDogW107XG5cbmNvbnN0IHRpcEpvaW50SWRzSW5kZXggPSB7fTtcblxuZm9yIChsZXQgaSA9IDA7IGkgPCB0aXBKb2ludElkcy5sZW5ndGg7IGkrKykge1xuICAgIHRpcEpvaW50SWRzSW5kZXhbdGlwSm9pbnRJZHNbaV1dID0gdHJ1ZTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSBqb2ludCBvZiBhIGZpbmdlci5cbiAqL1xuY2xhc3MgWHJKb2ludCB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbmRleDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaWQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WHJIYW5kfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhbmQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WHJGaW5nZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZmluZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfd3Jpc3Q7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90aXA7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JhZGl1cyA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0NH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF93b3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VmVjM31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2NhbFBvc2l0aW9uID0gbmV3IFZlYzMoKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvY2FsUm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcm90YXRpb24gPSBuZXcgUXVhdCgpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGlydHlMb2NhbCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gWHJKb2ludCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluZGV4IG9mIGEgam9pbnQgd2l0aGluIGEgZmluZ2VyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpZCAtIElkIG9mIGEgam9pbnQgYmFzZWQgb24gV2ViWFIgSGFuZCBJbnB1dCBTcGVjcy5cbiAgICAgKiBAcGFyYW0ge1hySGFuZH0gaGFuZCAtIEhhbmQgdGhhdCBqb2ludCByZWxhdGVzIHRvLlxuICAgICAqIEBwYXJhbSB7WHJGaW5nZXJ9IFtmaW5nZXJdIC0gRmluZ2VyIHRoYXQgam9pbnQgaXMgcmVsYXRlZCB0bywgY2FuIGJlIG51bGwgaW4gY2FzZSBvZiB3cmlzdC5cbiAgICAgKiBqb2ludC5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoaW5kZXgsIGlkLCBoYW5kLCBmaW5nZXIgPSBudWxsKSB7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMuX2lkID0gaWQ7XG4gICAgICAgIHRoaXMuX2hhbmQgPSBoYW5kO1xuICAgICAgICB0aGlzLl9maW5nZXIgPSBmaW5nZXI7XG4gICAgICAgIHRoaXMuX3dyaXN0ID0gaWQgPT09ICd3cmlzdCc7XG4gICAgICAgIHRoaXMuX3RpcCA9IHRoaXMuX2ZpbmdlciAmJiAhIXRpcEpvaW50SWRzSW5kZXhbaWRdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gcG9zZSAtIFhSSm9pbnRQb3NlIG9mIHRoaXMgam9pbnQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShwb3NlKSB7XG4gICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSB0cnVlO1xuICAgICAgICB0aGlzLl9yYWRpdXMgPSBwb3NlLnJhZGl1cztcbiAgICAgICAgdGhpcy5fbG9jYWxQb3NpdGlvbi5jb3B5KHBvc2UudHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5fbG9jYWxSb3RhdGlvbi5jb3B5KHBvc2UudHJhbnNmb3JtLm9yaWVudGF0aW9uKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdXBkYXRlVHJhbnNmb3JtcygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2xvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLl9sb2NhbFBvc2l0aW9uLCB0aGlzLl9sb2NhbFJvdGF0aW9uLCBWZWMzLk9ORSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYW5hZ2VyID0gdGhpcy5faGFuZC5fbWFuYWdlcjtcbiAgICAgICAgY29uc3QgcGFyZW50ID0gbWFuYWdlci5jYW1lcmEucGFyZW50O1xuXG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3dvcmxkVHJhbnNmb3JtLm11bDIocGFyZW50LmdldFdvcmxkVHJhbnNmb3JtKCksIHRoaXMuX2xvY2FsVHJhbnNmb3JtKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3dvcmxkVHJhbnNmb3JtLmNvcHkodGhpcy5fbG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBhIGpvaW50LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1ZlYzN9IFRoZSB3b3JsZCBzcGFjZSBwb3NpdGlvbiBvZiBhIGpvaW50LlxuICAgICAqL1xuICAgIGdldFBvc2l0aW9uKCkge1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm1zKCk7XG4gICAgICAgIHRoaXMuX3dvcmxkVHJhbnNmb3JtLmdldFRyYW5zbGF0aW9uKHRoaXMuX3Bvc2l0aW9uKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc2l0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgYSBqb2ludC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtRdWF0fSBUaGUgd29ybGQgc3BhY2Ugcm90YXRpb24gb2YgYSBqb2ludC5cbiAgICAgKi9cbiAgICBnZXRSb3RhdGlvbigpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtcygpO1xuICAgICAgICB0aGlzLl9yb3RhdGlvbi5zZXRGcm9tTWF0NCh0aGlzLl93b3JsZFRyYW5zZm9ybSk7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbmRleCBvZiBhIGpvaW50IHdpdGhpbiBhIGZpbmdlciwgc3RhcnRpbmcgZnJvbSAwIChyb290IG9mIGEgZmluZ2VyKSBhbGwgdGhlIHdheSB0byB0aXAgb2ZcbiAgICAgKiB0aGUgZmluZ2VyLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaW5kZXgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbmRleDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kIHRoYXQgam9pbnQgcmVsYXRlcyB0by5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhhbmR9XG4gICAgICovXG4gICAgZ2V0IGhhbmQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oYW5kO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmdlciB0aGF0IGpvaW50IHJlbGF0ZXMgdG8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7WHJGaW5nZXJ8bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgZmluZ2VyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmluZ2VyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgam9pbnQgaXMgYSB3cmlzdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB3cmlzdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dyaXN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgam9pbnQgaXMgYSB0aXAgb2YgYSBmaW5nZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgdGlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByYWRpdXMgb2YgYSBqb2ludCwgd2hpY2ggaXMgYSBkaXN0YW5jZSBmcm9tIGpvaW50IHRvIHRoZSBlZGdlIG9mIGEgc2tpbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHJhZGl1cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JhZGl1cyB8fCAwLjAwNTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhySm9pbnQgfTtcbiJdLCJuYW1lcyI6WyJ0aXBKb2ludElkcyIsInBsYXRmb3JtIiwiYnJvd3NlciIsIndpbmRvdyIsIlhSSGFuZCIsInRpcEpvaW50SWRzSW5kZXgiLCJpIiwibGVuZ3RoIiwiWHJKb2ludCIsImNvbnN0cnVjdG9yIiwiaW5kZXgiLCJpZCIsImhhbmQiLCJmaW5nZXIiLCJfaW5kZXgiLCJfaWQiLCJfaGFuZCIsIl9maW5nZXIiLCJfd3Jpc3QiLCJfdGlwIiwiX3JhZGl1cyIsIl9sb2NhbFRyYW5zZm9ybSIsIk1hdDQiLCJfd29ybGRUcmFuc2Zvcm0iLCJfbG9jYWxQb3NpdGlvbiIsIlZlYzMiLCJfbG9jYWxSb3RhdGlvbiIsIlF1YXQiLCJfcG9zaXRpb24iLCJfcm90YXRpb24iLCJfZGlydHlMb2NhbCIsInVwZGF0ZSIsInBvc2UiLCJyYWRpdXMiLCJjb3B5IiwidHJhbnNmb3JtIiwicG9zaXRpb24iLCJvcmllbnRhdGlvbiIsIl91cGRhdGVUcmFuc2Zvcm1zIiwic2V0VFJTIiwiT05FIiwibWFuYWdlciIsIl9tYW5hZ2VyIiwicGFyZW50IiwiY2FtZXJhIiwibXVsMiIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0UG9zaXRpb24iLCJnZXRUcmFuc2xhdGlvbiIsImdldFJvdGF0aW9uIiwic2V0RnJvbU1hdDQiLCJ3cmlzdCIsInRpcCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQVFBLE1BQU1BLFdBQVcsR0FBR0MsUUFBUSxDQUFDQyxPQUFPLElBQUlDLE1BQU0sQ0FBQ0MsTUFBTSxHQUFHLENBQ3BELFdBQVcsRUFDWCxrQkFBa0IsRUFDbEIsbUJBQW1CLEVBQ25CLGlCQUFpQixFQUNqQixrQkFBa0IsQ0FDckIsR0FBRyxFQUFFLENBQUE7QUFFTixNQUFNQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUE7QUFFM0IsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdOLFdBQVcsQ0FBQ08sTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUN6Q0QsRUFBQUEsZ0JBQWdCLENBQUNMLFdBQVcsQ0FBQ00sQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUE7QUFDM0MsQ0FBQTs7QUFLQSxNQUFNRSxPQUFPLENBQUM7O0VBK0ZWQyxXQUFXLENBQUNDLEtBQUssRUFBRUMsRUFBRSxFQUFFQyxJQUFJLEVBQUVDLE1BQU0sR0FBRyxJQUFJLEVBQUU7QUFBQSxJQUFBLElBQUEsQ0ExRjVDQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FNTkMsR0FBRyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBTUhDLEtBQUssR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxD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