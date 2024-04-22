import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrPlane } from './xr-plane.js';

class XrPlaneDetection extends EventHandler {
  constructor(manager) {
    super();
    this._manager = void 0;
    this._supported = platform.browser && !!window.XRPlane;
    this._available = false;
    this._planesIndex = new Map();
    this._planes = [];
    this._manager = manager;
    if (this._supported) {
      this._manager.on('start', this._onSessionStart, this);
      this._manager.on('end', this._onSessionEnd, this);
    }
  }
  _onSessionStart() {
    if (this._manager.session.enabledFeatures) {
      const available = this._manager.session.enabledFeatures.indexOf('plane-detection') !== -1;
      if (available) {
        this._available = true;
        this.fire('available');
      }
    }
  }
  _onSessionEnd() {
    for (let i = 0; i < this._planes.length; i++) {
      this._planes[i].destroy();
      this.fire('remove', this._planes[i]);
    }
    this._planesIndex.clear();
    this._planes.length = 0;
    if (this._available) {
      this._available = false;
      this.fire('unavailable');
    }
  }
  update(frame) {
    if (!this._available) {
      if (!this._manager.session.enabledFeatures && frame.detectedPlanes.size) {
        this._available = true;
        this.fire('available');
      } else {
        return;
      }
    }
    const detectedPlanes = frame.detectedPlanes;
    for (const [xrPlane, plane] of this._planesIndex) {
      if (detectedPlanes.has(xrPlane)) continue;
      this._planesIndex.delete(xrPlane);
      this._planes.splice(this._planes.indexOf(plane), 1);
      plane.destroy();
      this.fire('remove', plane);
    }
    for (const xrPlane of detectedPlanes) {
      let plane = this._planesIndex.get(xrPlane);
      if (!plane) {
        plane = new XrPlane(this, xrPlane);
        this._planesIndex.set(xrPlane, plane);
        this._planes.push(plane);
        plane.update(frame);
        this.fire('add', plane);
      } else {
        plane.update(frame);
      }
    }
  }
  get supported() {
    return this._supported;
  }
  get available() {
    return this._available;
  }
  get planes() {
    return this._planes;
  }
}
XrPlaneDetection.EVENT_AVAILABLE = 'available';
XrPlaneDetection.EVENT_UNAVAILABLE = 'unavailable';
XrPlaneDetection.EVENT_ADD = 'add';
XrPlaneDetection.EVENT_REMOVE = 'remove';

export { XrPlaneDetection };
