import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

const poolVec3 = [];
const poolQuat = [];
class XrHitTestSource extends EventHandler {
  constructor(manager, xrHitTestSource, transient, inputSource = null) {
    super();
    this.manager = void 0;
    this._xrHitTestSource = void 0;
    this._transient = void 0;
    this._inputSource = void 0;
    this.manager = manager;
    this._xrHitTestSource = xrHitTestSource;
    this._transient = transient;
    this._inputSource = inputSource;
  }
  remove() {
    if (!this._xrHitTestSource) return;
    const sources = this.manager.hitTest.sources;
    const ind = sources.indexOf(this);
    if (ind !== -1) sources.splice(ind, 1);
    this.onStop();
  }
  onStop() {
    this._xrHitTestSource.cancel();
    this._xrHitTestSource = null;
    this.fire('remove');
    this.manager.hitTest.fire('remove', this);
  }
  update(frame) {
    if (this._transient) {
      const transientResults = frame.getHitTestResultsForTransientInput(this._xrHitTestSource);
      for (let i = 0; i < transientResults.length; i++) {
        const transientResult = transientResults[i];
        if (!transientResult.results.length) continue;
        let inputSource;
        if (transientResult.inputSource) inputSource = this.manager.input._getByInputSource(transientResult.inputSource);
        this.updateHitResults(transientResult.results, inputSource);
      }
    } else {
      const results = frame.getHitTestResults(this._xrHitTestSource);
      if (!results.length) return;
      this.updateHitResults(results);
    }
  }
  updateHitResults(results, inputSource) {
    var _poolVec3$pop, _poolVec3$pop2, _poolQuat$pop;
    if (this._inputSource && this._inputSource !== inputSource) return;
    const origin = (_poolVec3$pop = poolVec3.pop()) != null ? _poolVec3$pop : new Vec3();
    if (inputSource) {
      origin.copy(inputSource.getOrigin());
    } else {
      origin.copy(this.manager.camera.getPosition());
    }
    let candidateDistance = Infinity;
    let candidateHitTestResult = null;
    const position = (_poolVec3$pop2 = poolVec3.pop()) != null ? _poolVec3$pop2 : new Vec3();
    const rotation = (_poolQuat$pop = poolQuat.pop()) != null ? _poolQuat$pop : new Quat();
    for (let i = 0; i < results.length; i++) {
      const pose = results[i].getPose(this.manager._referenceSpace);
      const distance = origin.distance(pose.transform.position);
      if (distance >= candidateDistance) continue;
      candidateDistance = distance;
      candidateHitTestResult = results[i];
      position.copy(pose.transform.position);
      rotation.copy(pose.transform.orientation);
    }
    this.fire('result', position, rotation, inputSource || this._inputSource, candidateHitTestResult);
    this.manager.hitTest.fire('result', this, position, rotation, inputSource || this._inputSource, candidateHitTestResult);
    poolVec3.push(origin);
    poolVec3.push(position);
    poolQuat.push(rotation);
  }
}
XrHitTestSource.EVENT_REMOVE = 'remove';
XrHitTestSource.EVENT_RESULT = 'result';

export { XrHitTestSource };
