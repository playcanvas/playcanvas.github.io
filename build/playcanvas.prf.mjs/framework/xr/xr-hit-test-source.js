import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

const poolVec3 = [];
const poolQuat = [];
class XrHitTestSource extends EventHandler {
	constructor(manager, xrHitTestSource, transient) {
		super();
		this.manager = void 0;
		this._xrHitTestSource = void 0;
		this._transient = void 0;
		this.manager = manager;
		this._xrHitTestSource = xrHitTestSource;
		this._transient = transient;
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
				let inputSource;
				if (transientResult.inputSource) inputSource = this.manager.input._getByInputSource(transientResult.inputSource);
				this.updateHitResults(transientResult.results, inputSource);
			}
		} else {
			this.updateHitResults(frame.getHitTestResults(this._xrHitTestSource));
		}
	}
	updateHitResults(results, inputSource) {
		for (let i = 0; i < results.length; i++) {
			const pose = results[i].getPose(this.manager._referenceSpace);
			let position = poolVec3.pop();
			if (!position) position = new Vec3();
			position.copy(pose.transform.position);
			let rotation = poolQuat.pop();
			if (!rotation) rotation = new Quat();
			rotation.copy(pose.transform.orientation);
			this.fire('result', position, rotation, inputSource);
			this.manager.hitTest.fire('result', this, position, rotation, inputSource);
			poolVec3.push(position);
			poolQuat.push(rotation);
		}
	}
}

export { XrHitTestSource };
