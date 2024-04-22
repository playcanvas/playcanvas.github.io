import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { XrAnchor } from './xr-anchor.js';

class XrAnchors extends EventHandler {
  constructor(manager) {
    var _window;
    super();
    this.manager = void 0;
    this._supported = platform.browser && !!window.XRAnchor;
    this._available = false;
    this._checkingAvailability = false;
    this._persistence = platform.browser && !!((_window = window) != null && (_window = _window.XRSession) != null && _window.prototype.restorePersistentAnchor);
    this._creationQueue = [];
    this._index = new Map();
    this._indexByUuid = new Map();
    this._list = [];
    this._callbacksAnchors = new Map();
    this.manager = manager;
    if (this._supported) {
      this.manager.on('start', this._onSessionStart, this);
      this.manager.on('end', this._onSessionEnd, this);
    }
  }
  _onSessionStart() {
    const available = this.manager.session.enabledFeatures.indexOf('anchors') !== -1;
    if (!available) return;
    this._available = available;
    this.fire('available');
  }
  _onSessionEnd() {
    if (!this._available) return;
    this._available = false;
    for (let _i = 0; _i < this._creationQueue.length; _i++) {
      if (!this._creationQueue[_i].callback) continue;
      this._creationQueue[_i].callback(new Error('session ended'), null);
    }
    this._creationQueue.length = 0;
    this._index.clear();
    this._indexByUuid.clear();
    let i = this._list.length;
    while (i--) {
      this._list[i].destroy();
    }
    this._list.length = 0;
    this.fire('unavailable');
  }
  _createAnchor(xrAnchor, uuid = null) {
    const anchor = new XrAnchor(this, xrAnchor, uuid);
    this._index.set(xrAnchor, anchor);
    if (uuid) this._indexByUuid.set(uuid, anchor);
    this._list.push(anchor);
    anchor.once('destroy', this._onAnchorDestroy, this);
    return anchor;
  }
  _onAnchorDestroy(xrAnchor, anchor) {
    this._index.delete(xrAnchor);
    if (anchor.uuid) this._indexByUuid.delete(anchor.uuid);
    const ind = this._list.indexOf(anchor);
    if (ind !== -1) this._list.splice(ind, 1);
    this.fire('destroy', anchor);
  }
  create(position, rotation, callback) {
    if (!this._available) {
      callback == null || callback(new Error('Anchors API is not available'), null);
      return;
    }
    if (window.XRHitTestResult && position instanceof XRHitTestResult) {
      const hitResult = position;
      callback = rotation;
      if (!this._supported) {
        callback == null || callback(new Error('Anchors API is not supported'), null);
        return;
      }
      if (!hitResult.createAnchor) {
        callback == null || callback(new Error('Creating Anchor from Hit Test is not supported'), null);
        return;
      }
      hitResult.createAnchor().then(xrAnchor => {
        const anchor = this._createAnchor(xrAnchor);
        callback == null || callback(null, anchor);
        this.fire('add', anchor);
      }).catch(ex => {
        callback == null || callback(ex, null);
        this.fire('error', ex);
      });
    } else {
      this._creationQueue.push({
        transform: new XRRigidTransform(position, rotation),
        callback: callback
      });
    }
  }
  restore(uuid, callback) {
    if (!this._available) {
      callback == null || callback(new Error('Anchors API is not available'), null);
      return;
    }
    if (!this._persistence) {
      callback == null || callback(new Error('Anchor Persistence is not supported'), null);
      return;
    }
    if (!this.manager.active) {
      callback == null || callback(new Error('WebXR session is not active'), null);
      return;
    }
    this.manager.session.restorePersistentAnchor(uuid).then(xrAnchor => {
      const anchor = this._createAnchor(xrAnchor, uuid);
      callback == null || callback(null, anchor);
      this.fire('add', anchor);
    }).catch(ex => {
      callback == null || callback(ex, null);
      this.fire('error', ex);
    });
  }
  forget(uuid, callback) {
    if (!this._available) {
      callback == null || callback(new Error('Anchors API is not available'));
      return;
    }
    if (!this._persistence) {
      callback == null || callback(new Error('Anchor Persistence is not supported'));
      return;
    }
    if (!this.manager.active) {
      callback == null || callback(new Error('WebXR session is not active'));
      return;
    }
    this.manager.session.deletePersistentAnchor(uuid).then(() => {
      callback == null || callback(null);
    }).catch(ex => {
      callback == null || callback(ex);
      this.fire('error', ex);
    });
  }
  update(frame) {
    if (!this._available) {
      if (!this.manager.session.enabledFeatures && !this._checkingAvailability) {
        this._checkingAvailability = true;
        frame.createAnchor(new XRRigidTransform(), this.manager._referenceSpace).then(xrAnchor => {
          xrAnchor.delete();
          if (this.manager.active) {
            this._available = true;
            this.fire('available');
          }
        }).catch(() => {});
      }
      return;
    }
    if (this._creationQueue.length) {
      for (let i = 0; i < this._creationQueue.length; i++) {
        const request = this._creationQueue[i];
        frame.createAnchor(request.transform, this.manager._referenceSpace).then(xrAnchor => {
          if (request.callback) this._callbacksAnchors.set(xrAnchor, request.callback);
        }).catch(ex => {
          if (request.callback) request.callback(ex, null);
          this.fire('error', ex);
        });
      }
      this._creationQueue.length = 0;
    }
    for (const [xrAnchor, anchor] of this._index) {
      if (frame.trackedAnchors.has(xrAnchor)) continue;
      this._index.delete(xrAnchor);
      anchor.destroy();
    }
    for (let i = 0; i < this._list.length; i++) {
      this._list[i].update(frame);
    }
    for (const xrAnchor of frame.trackedAnchors) {
      if (this._index.has(xrAnchor)) continue;
      try {
        const tmp = xrAnchor.anchorSpace;
      } catch (ex) {
        continue;
      }
      const anchor = this._createAnchor(xrAnchor);
      anchor.update(frame);
      const callback = this._callbacksAnchors.get(xrAnchor);
      if (callback) {
        this._callbacksAnchors.delete(xrAnchor);
        callback(null, anchor);
      }
      this.fire('add', anchor);
    }
  }
  get supported() {
    return this._supported;
  }
  get available() {
    return this._available;
  }
  get persistence() {
    return this._persistence;
  }
  get uuids() {
    if (!this._available) return null;
    if (!this._persistence) return null;
    if (!this.manager.active) return null;
    return this.manager.session.persistentAnchors;
  }
  get list() {
    return this._list;
  }
}
XrAnchors.EVENT_AVAILABLE = 'available';
XrAnchors.EVENT_UNAVAILABLE = 'unavailable';
XrAnchors.EVENT_ERROR = 'error';
XrAnchors.EVENT_ADD = 'add';
XrAnchors.EVENT_DESTROY = 'destroy';

export { XrAnchors };
