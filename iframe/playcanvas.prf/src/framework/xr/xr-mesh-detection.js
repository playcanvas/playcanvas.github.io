import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrMesh } from './xr-mesh.js';

class XrMeshDetection extends EventHandler {
  constructor(manager) {
    super();
    this._manager = void 0;
    this._supported = platform.browser && !!window.XRMesh;
    this._available = false;
    this._index = new Map();
    this._list = [];
    this._manager = manager;
    if (this._supported) {
      this._manager.on('start', this._onSessionStart, this);
      this._manager.on('end', this._onSessionEnd, this);
    }
  }
  update(frame) {
    if (!this._available) {
      if (!this._manager.session.enabledFeatures && frame.detectedMeshes.size) {
        this._available = true;
        this.fire('available');
      } else {
        return;
      }
    }
    for (const xrMesh of frame.detectedMeshes) {
      let mesh = this._index.get(xrMesh);
      if (!mesh) {
        mesh = new XrMesh(this, xrMesh);
        this._index.set(xrMesh, mesh);
        this._list.push(mesh);
        mesh.update(frame);
        this.fire('add', mesh);
      } else {
        mesh.update(frame);
      }
    }
    for (const mesh of this._index.values()) {
      if (frame.detectedMeshes.has(mesh.xrMesh)) continue;
      this._removeMesh(mesh);
    }
  }
  _removeMesh(mesh) {
    this._index.delete(mesh.xrMesh);
    this._list.splice(this._list.indexOf(mesh), 1);
    mesh.destroy();
    this.fire('remove', mesh);
  }
  _onSessionStart() {
    if (this._manager.session.enabledFeatures) {
      const available = this._manager.session.enabledFeatures.indexOf('mesh-detection') !== -1;
      if (!available) return;
      this._available = available;
      this.fire('available');
    }
  }
  _onSessionEnd() {
    if (!this._available) return;
    this._available = false;
    for (const mesh of this._index.values()) this._removeMesh(mesh);
    this.fire('unavailable');
  }
  get supported() {
    return this._supported;
  }
  get available() {
    return this._available;
  }
  get meshes() {
    return this._list;
  }
}
XrMeshDetection.EVENT_AVAILABLE = 'available';
XrMeshDetection.EVENT_UNAVAILABLE = 'unavailable';
XrMeshDetection.EVENT_ADD = 'add';
XrMeshDetection.EVENT_REMOVE = 'remove';

export { XrMeshDetection };
