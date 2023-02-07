/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrPlane } from './xr-plane.js';

/**
 * Plane Detection provides the ability to detect real world surfaces based on estimations of the
 * underlying AR system.
 *
 * ```javascript
 * // start session with plane detection enabled
 * app.xr.start(camera, pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
 *     planeDetection: true
 * });
 * ```
 *
 * ```javascript
 * app.xr.planeDetection.on('add', function (plane) {
 *     // new plane been added
 * });
 * ```
 */
class XrPlaneDetection extends EventHandler {
  /**
   * @type {import('./xr-manager.js').XrManager}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {boolean}
   * @private
   */

  /**
   * @type {Map<XRPlane, XrPlane>}
   * @private
   */

  /**
   * @type {XrPlane[]|null}
   * @private
   */

  /**
   * Create a new XrPlaneDetection instance.
   *
   * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
   * @hideconstructor
   */
  constructor(manager) {
    super();
    this._manager = void 0;
    this._supported = platform.browser && !!window.XRPlane;
    this._available = false;
    this._planesIndex = new Map();
    this._planes = null;
    this._manager = manager;
    if (this._supported) {
      this._manager.on('end', this._onSessionEnd, this);
    }
  }

  /**
   * Fired when plane detection becomes available.
   *
   * @event XrPlaneDetection#available
   */

  /**
   * Fired when plane detection becomes unavailable.
   *
   * @event XrPlaneDetection#unavailable
   */

  /**
   * Fired when new {@link XrPlane} is added to the list.
   *
   * @event XrPlaneDetection#add
   * @param {XrPlane} plane - Plane that has been added.
   * @example
   * app.xr.planeDetection.on('add', function (plane) {
   *     // new plane is added
   * });
   */

  /**
   * Fired when a {@link XrPlane} is removed from the list.
   *
   * @event XrPlaneDetection#remove
   * @param {XrPlane} plane - Plane that has been removed.
   * @example
   * app.xr.planeDetection.on('remove', function (plane) {
   *     // new plane is removed
   * });
   */

  /** @private */
  _onSessionEnd() {
    if (this._planes) {
      for (let i = 0; i < this._planes.length; i++) {
        this._planes[i].destroy();
      }
    }
    this._planesIndex.clear();
    this._planes = null;
    if (this._available) {
      this._available = false;
      this.fire('unavailable');
    }
  }

  /**
   * @param {*} frame - XRFrame from requestAnimationFrame callback.
   * @ignore
   */
  update(frame) {
    let detectedPlanes;
    if (!this._available) {
      try {
        detectedPlanes = frame.detectedPlanes;
        this._planes = [];
        this._available = true;
        this.fire('available');
      } catch (ex) {
        return;
      }
    } else {
      detectedPlanes = frame.detectedPlanes;
    }

    // iterate through indexed planes
    for (const [xrPlane, plane] of this._planesIndex) {
      if (detectedPlanes.has(xrPlane)) continue;

      // if indexed plane is not listed in detectedPlanes anymore
      // then remove it
      this._planesIndex.delete(xrPlane);
      this._planes.splice(this._planes.indexOf(plane), 1);
      plane.destroy();
      this.fire('remove', plane);
    }

    // iterate through detected planes
    for (const xrPlane of detectedPlanes) {
      let plane = this._planesIndex.get(xrPlane);
      if (!plane) {
        // detected plane is not indexed
        // then create new XrPlane
        plane = new XrPlane(this, xrPlane);
        this._planesIndex.set(xrPlane, plane);
        this._planes.push(plane);
        plane.update(frame);
        this.fire('add', plane);
      } else {
        // if already indexed, just update
        plane.update(frame);
      }
    }
  }

  /**
   * True if Plane Detection is supported.
   *
   * @type {boolean}
   */
  get supported() {
    return this._supported;
  }

  /**
   * True if Plane Detection is available. This property can be set to true only during a running
   * session.
   *
   * @type {boolean}
   */
  get available() {
    return this._available;
  }

  /**
   * Array of {@link XrPlane} instances that contain individual plane information, or null if
   * plane detection is not available.
   *
   * @type {XrPlane[]|null}
   */
  get planes() {
    return this._planes;
  }
}

export { XrPlaneDetection };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItcGxhbmUtZGV0ZWN0aW9uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3hyL3hyLXBsYW5lLWRldGVjdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFhyUGxhbmUgfSBmcm9tICcuL3hyLXBsYW5lLmpzJztcblxuLyoqXG4gKiBQbGFuZSBEZXRlY3Rpb24gcHJvdmlkZXMgdGhlIGFiaWxpdHkgdG8gZGV0ZWN0IHJlYWwgd29ybGQgc3VyZmFjZXMgYmFzZWQgb24gZXN0aW1hdGlvbnMgb2YgdGhlXG4gKiB1bmRlcmx5aW5nIEFSIHN5c3RlbS5cbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBzdGFydCBzZXNzaW9uIHdpdGggcGxhbmUgZGV0ZWN0aW9uIGVuYWJsZWRcbiAqIGFwcC54ci5zdGFydChjYW1lcmEsIHBjLlhSVFlQRV9WUiwgcGMuWFJTUEFDRV9MT0NBTEZMT09SLCB7XG4gKiAgICAgcGxhbmVEZXRlY3Rpb246IHRydWVcbiAqIH0pO1xuICogYGBgXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogYXBwLnhyLnBsYW5lRGV0ZWN0aW9uLm9uKCdhZGQnLCBmdW5jdGlvbiAocGxhbmUpIHtcbiAqICAgICAvLyBuZXcgcGxhbmUgYmVlbiBhZGRlZFxuICogfSk7XG4gKiBgYGBcbiAqL1xuY2xhc3MgWHJQbGFuZURldGVjdGlvbiBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hbmFnZXI7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zdXBwb3J0ZWQgPSBwbGF0Zm9ybS5icm93c2VyICYmICEhd2luZG93LlhSUGxhbmU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hdmFpbGFibGUgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNYXA8WFJQbGFuZSwgWHJQbGFuZT59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGxhbmVzSW5kZXggPSBuZXcgTWFwKCk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WHJQbGFuZVtdfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGxhbmVzID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBYclBsYW5lRGV0ZWN0aW9uIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gbWFuYWdlciAtIFdlYlhSIE1hbmFnZXIuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcblxuICAgICAgICBpZiAodGhpcy5fc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdlbmQnLCB0aGlzLl9vblNlc3Npb25FbmQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBwbGFuZSBkZXRlY3Rpb24gYmVjb21lcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJQbGFuZURldGVjdGlvbiNhdmFpbGFibGVcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gcGxhbmUgZGV0ZWN0aW9uIGJlY29tZXMgdW5hdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJQbGFuZURldGVjdGlvbiN1bmF2YWlsYWJsZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBuZXcge0BsaW5rIFhyUGxhbmV9IGlzIGFkZGVkIHRvIHRoZSBsaXN0LlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyUGxhbmVEZXRlY3Rpb24jYWRkXG4gICAgICogQHBhcmFtIHtYclBsYW5lfSBwbGFuZSAtIFBsYW5lIHRoYXQgaGFzIGJlZW4gYWRkZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIucGxhbmVEZXRlY3Rpb24ub24oJ2FkZCcsIGZ1bmN0aW9uIChwbGFuZSkge1xuICAgICAqICAgICAvLyBuZXcgcGxhbmUgaXMgYWRkZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSB7QGxpbmsgWHJQbGFuZX0gaXMgcmVtb3ZlZCBmcm9tIHRoZSBsaXN0LlxuICAgICAqXG4gICAgICogQGV2ZW50IFhyUGxhbmVEZXRlY3Rpb24jcmVtb3ZlXG4gICAgICogQHBhcmFtIHtYclBsYW5lfSBwbGFuZSAtIFBsYW5lIHRoYXQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC54ci5wbGFuZURldGVjdGlvbi5vbigncmVtb3ZlJywgZnVuY3Rpb24gKHBsYW5lKSB7XG4gICAgICogICAgIC8vIG5ldyBwbGFuZSBpcyByZW1vdmVkXG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TZXNzaW9uRW5kKCkge1xuICAgICAgICBpZiAodGhpcy5fcGxhbmVzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3BsYW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BsYW5lc1tpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wbGFuZXNJbmRleC5jbGVhcigpO1xuICAgICAgICB0aGlzLl9wbGFuZXMgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2F2YWlsYWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCd1bmF2YWlsYWJsZScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHsqfSBmcmFtZSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZShmcmFtZSkge1xuICAgICAgICBsZXQgZGV0ZWN0ZWRQbGFuZXM7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9hdmFpbGFibGUpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZGV0ZWN0ZWRQbGFuZXMgPSBmcmFtZS5kZXRlY3RlZFBsYW5lcztcbiAgICAgICAgICAgICAgICB0aGlzLl9wbGFuZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdmFpbGFibGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnYXZhaWxhYmxlJyk7XG4gICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRldGVjdGVkUGxhbmVzID0gZnJhbWUuZGV0ZWN0ZWRQbGFuZXM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpdGVyYXRlIHRocm91Z2ggaW5kZXhlZCBwbGFuZXNcbiAgICAgICAgZm9yIChjb25zdCBbeHJQbGFuZSwgcGxhbmVdIG9mIHRoaXMuX3BsYW5lc0luZGV4KSB7XG4gICAgICAgICAgICBpZiAoZGV0ZWN0ZWRQbGFuZXMuaGFzKHhyUGxhbmUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAvLyBpZiBpbmRleGVkIHBsYW5lIGlzIG5vdCBsaXN0ZWQgaW4gZGV0ZWN0ZWRQbGFuZXMgYW55bW9yZVxuICAgICAgICAgICAgLy8gdGhlbiByZW1vdmUgaXRcbiAgICAgICAgICAgIHRoaXMuX3BsYW5lc0luZGV4LmRlbGV0ZSh4clBsYW5lKTtcbiAgICAgICAgICAgIHRoaXMuX3BsYW5lcy5zcGxpY2UodGhpcy5fcGxhbmVzLmluZGV4T2YocGxhbmUpLCAxKTtcbiAgICAgICAgICAgIHBsYW5lLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJywgcGxhbmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaXRlcmF0ZSB0aHJvdWdoIGRldGVjdGVkIHBsYW5lc1xuICAgICAgICBmb3IgKGNvbnN0IHhyUGxhbmUgb2YgZGV0ZWN0ZWRQbGFuZXMpIHtcbiAgICAgICAgICAgIGxldCBwbGFuZSA9IHRoaXMuX3BsYW5lc0luZGV4LmdldCh4clBsYW5lKTtcblxuICAgICAgICAgICAgaWYgKCFwbGFuZSkge1xuICAgICAgICAgICAgICAgIC8vIGRldGVjdGVkIHBsYW5lIGlzIG5vdCBpbmRleGVkXG4gICAgICAgICAgICAgICAgLy8gdGhlbiBjcmVhdGUgbmV3IFhyUGxhbmVcbiAgICAgICAgICAgICAgICBwbGFuZSA9IG5ldyBYclBsYW5lKHRoaXMsIHhyUGxhbmUpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3BsYW5lc0luZGV4LnNldCh4clBsYW5lLCBwbGFuZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGxhbmVzLnB1c2gocGxhbmUpO1xuICAgICAgICAgICAgICAgIHBsYW5lLnVwZGF0ZShmcmFtZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBwbGFuZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGlmIGFscmVhZHkgaW5kZXhlZCwganVzdCB1cGRhdGVcbiAgICAgICAgICAgICAgICBwbGFuZS51cGRhdGUoZnJhbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiBQbGFuZSBEZXRlY3Rpb24gaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIFBsYW5lIERldGVjdGlvbiBpcyBhdmFpbGFibGUuIFRoaXMgcHJvcGVydHkgY2FuIGJlIHNldCB0byB0cnVlIG9ubHkgZHVyaW5nIGEgcnVubmluZ1xuICAgICAqIHNlc3Npb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgYXZhaWxhYmxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXZhaWxhYmxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIHtAbGluayBYclBsYW5lfSBpbnN0YW5jZXMgdGhhdCBjb250YWluIGluZGl2aWR1YWwgcGxhbmUgaW5mb3JtYXRpb24sIG9yIG51bGwgaWZcbiAgICAgKiBwbGFuZSBkZXRlY3Rpb24gaXMgbm90IGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYclBsYW5lW118bnVsbH1cbiAgICAgKi9cbiAgICBnZXQgcGxhbmVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGxhbmVzO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgWHJQbGFuZURldGVjdGlvbiB9O1xuIl0sIm5hbWVzIjpbIlhyUGxhbmVEZXRlY3Rpb24iLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIm1hbmFnZXIiLCJfbWFuYWdlciIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJ3aW5kb3ciLCJYUlBsYW5lIiwiX2F2YWlsYWJsZSIsIl9wbGFuZXNJbmRleCIsIk1hcCIsIl9wbGFuZXMiLCJvbiIsIl9vblNlc3Npb25FbmQiLCJpIiwibGVuZ3RoIiwiZGVzdHJveSIsImNsZWFyIiwiZmlyZSIsInVwZGF0ZSIsImZyYW1lIiwiZGV0ZWN0ZWRQbGFuZXMiLCJleCIsInhyUGxhbmUiLCJwbGFuZSIsImhhcyIsImRlbGV0ZSIsInNwbGljZSIsImluZGV4T2YiLCJnZXQiLCJYclBsYW5lIiwic2V0IiwicHVzaCIsInN1cHBvcnRlZCIsImF2YWlsYWJsZSIsInBsYW5lcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGdCQUFnQixTQUFTQyxZQUFZLENBQUM7QUFDeEM7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVcsQ0FBQ0MsT0FBTyxFQUFFO0FBQ2pCLElBQUEsS0FBSyxFQUFFLENBQUE7QUFBQyxJQUFBLElBQUEsQ0FqQ1pDLFFBQVEsR0FBQSxLQUFBLENBQUEsQ0FBQTtJQUFBLElBTVJDLENBQUFBLFVBQVUsR0FBR0MsUUFBUSxDQUFDQyxPQUFPLElBQUksQ0FBQyxDQUFDQyxNQUFNLENBQUNDLE9BQU8sQ0FBQTtJQUFBLElBTWpEQyxDQUFBQSxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBQUEsSUFBQSxJQUFBLENBTWxCQyxZQUFZLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7SUFBQSxJQU14QkMsQ0FBQUEsT0FBTyxHQUFHLElBQUksQ0FBQTtJQVdWLElBQUksQ0FBQ1QsUUFBUSxHQUFHRCxPQUFPLENBQUE7SUFF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
