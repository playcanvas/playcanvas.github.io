import { EventHandler } from '../../core/event-handler.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

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
