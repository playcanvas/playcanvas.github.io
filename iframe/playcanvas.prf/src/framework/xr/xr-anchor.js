import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

class XrAnchor extends EventHandler {
  constructor(anchors, xrAnchor, uuid = null) {
    super();
    this._position = new Vec3();
    this._rotation = new Quat();
    this._uuid = null;
    this._uuidRequests = null;
    this._anchors = anchors;
    this._xrAnchor = xrAnchor;
    this._uuid = uuid;
  }
  destroy() {
    if (!this._xrAnchor) return;
    const xrAnchor = this._xrAnchor;
    this._xrAnchor.delete();
    this._xrAnchor = null;
    this.fire('destroy', xrAnchor, this);
  }
  update(frame) {
    if (!this._xrAnchor) return;
    const pose = frame.getPose(this._xrAnchor.anchorSpace, this._anchors.manager._referenceSpace);
    if (pose) {
      if (this._position.equals(pose.transform.position) && this._rotation.equals(pose.transform.orientation)) return;
      this._position.copy(pose.transform.position);
      this._rotation.copy(pose.transform.orientation);
      this.fire('change');
    }
  }
  getPosition() {
    return this._position;
  }
  getRotation() {
    return this._rotation;
  }
  persist(callback) {
    if (!this._anchors.persistence) {
      callback == null || callback(new Error('Persistent Anchors are not supported'), null);
      return;
    }
    if (this._uuid) {
      callback == null || callback(null, this._uuid);
      return;
    }
    if (this._uuidRequests) {
      if (callback) this._uuidRequests.push(callback);
      return;
    }
    this._uuidRequests = [];
    this._xrAnchor.requestPersistentHandle().then(uuid => {
      this._uuid = uuid;
      this._anchors._indexByUuid.set(this._uuid, this);
      callback == null || callback(null, uuid);
      for (let i = 0; i < this._uuidRequests.length; i++) {
        this._uuidRequests[i](null, uuid);
      }
      this._uuidRequests = null;
      this.fire('persist', uuid);
    }).catch(ex => {
      callback == null || callback(ex, null);
      for (let i = 0; i < this._uuidRequests.length; i++) {
        this._uuidRequests[i](ex);
      }
      this._uuidRequests = null;
    });
  }
  forget(callback) {
    if (!this._uuid) {
      callback == null || callback(new Error('Anchor is not persistent'));
      return;
    }
    this._anchors.forget(this._uuid, ex => {
      this._uuid = null;
      callback == null || callback(ex);
      this.fire('forget');
    });
  }
  get uuid() {
    return this._uuid;
  }
  get persistent() {
    return !!this._uuid;
  }
}
XrAnchor.EVENT_DESTROY = 'destroy';
XrAnchor.EVENT_CHANGE = 'change';
XrAnchor.EVENT_PERSIST = 'persist';
XrAnchor.EVENT_FORGET = 'forget';

export { XrAnchor };
