import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

class XrMesh extends EventHandler {
  constructor(meshDetection, xrMesh) {
    super();
    this._meshDetection = void 0;
    this._xrMesh = void 0;
    this._lastChanged = 0;
    this._position = new Vec3();
    this._rotation = new Quat();
    this._meshDetection = meshDetection;
    this._xrMesh = xrMesh;
    this._lastChanged = this._xrMesh.lastChangedTime;
  }
  get xrMesh() {
    return this._xrMesh;
  }
  get label() {
    return this._xrMesh.semanticLabel || '';
  }
  get vertices() {
    return this._xrMesh.vertices;
  }
  get indices() {
    return this._xrMesh.indices;
  }
  destroy() {
    if (!this._xrMesh) return;
    this._xrMesh = null;
    this.fire('remove');
  }
  update(frame) {
    const manager = this._meshDetection._manager;
    const pose = frame.getPose(this._xrMesh.meshSpace, manager._referenceSpace);
    if (pose) {
      this._position.copy(pose.transform.position);
      this._rotation.copy(pose.transform.orientation);
    }
    if (this._lastChanged !== this._xrMesh.lastChangedTime) {
      this._lastChanged = this._xrMesh.lastChangedTime;
      this.fire('change');
    }
  }
  getPosition() {
    return this._position;
  }
  getRotation() {
    return this._rotation;
  }
}
XrMesh.EVENT_REMOVE = 'remove';
XrMesh.EVENT_CHANGE = 'change';

export { XrMesh };
