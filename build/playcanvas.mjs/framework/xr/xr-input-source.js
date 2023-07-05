import { EventHandler } from '../../core/event-handler.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Ray } from '../../core/shape/ray.js';
import { XrHand } from './xr-hand.js';

const quat = new Quat();
let ids = 0;
class XrInputSource extends EventHandler {
	constructor(manager, xrInputSource) {
		super();
		this._id = void 0;
		this._manager = void 0;
		this._xrInputSource = void 0;
		this._ray = new Ray();
		this._rayLocal = new Ray();
		this._grip = false;
		this._hand = null;
		this._localTransform = null;
		this._worldTransform = null;
		this._position = new Vec3();
		this._rotation = new Quat();
		this._localPosition = null;
		this._localRotation = null;
		this._dirtyLocal = true;
		this._dirtyRay = false;
		this._selecting = false;
		this._squeezing = false;
		this._elementInput = true;
		this._elementEntity = null;
		this._hitTestSources = [];
		this._id = ++ids;
		this._manager = manager;
		this._xrInputSource = xrInputSource;
		if (xrInputSource.hand) this._hand = new XrHand(this);
	}
	get id() {
		return this._id;
	}
	get inputSource() {
		return this._xrInputSource;
	}
	get targetRayMode() {
		return this._xrInputSource.targetRayMode;
	}
	get handedness() {
		return this._xrInputSource.handedness;
	}
	get profiles() {
		return this._xrInputSource.profiles;
	}
	get grip() {
		return this._grip;
	}
	get hand() {
		return this._hand;
	}
	get gamepad() {
		return this._xrInputSource.gamepad || null;
	}
	get selecting() {
		return this._selecting;
	}
	get squeezing() {
		return this._squeezing;
	}
	set elementInput(value) {
		if (this._elementInput === value) return;
		this._elementInput = value;
		if (!this._elementInput) this._elementEntity = null;
	}
	get elementInput() {
		return this._elementInput;
	}
	get elementEntity() {
		return this._elementEntity;
	}
	get hitTestSources() {
		return this._hitTestSources;
	}
	update(frame) {
		if (this._hand) {
			this._hand.update(frame);
		} else {
			if (this._xrInputSource.gripSpace) {
				const gripPose = frame.getPose(this._xrInputSource.gripSpace, this._manager._referenceSpace);
				if (gripPose) {
					if (!this._grip) {
						this._grip = true;
						this._localTransform = new Mat4();
						this._worldTransform = new Mat4();
						this._localPosition = new Vec3();
						this._localRotation = new Quat();
					}
					this._dirtyLocal = true;
					this._localPosition.copy(gripPose.transform.position);
					this._localRotation.copy(gripPose.transform.orientation);
				}
			}
			const targetRayPose = frame.getPose(this._xrInputSource.targetRaySpace, this._manager._referenceSpace);
			if (targetRayPose) {
				this._dirtyRay = true;
				this._rayLocal.origin.copy(targetRayPose.transform.position);
				this._rayLocal.direction.set(0, 0, -1);
				quat.copy(targetRayPose.transform.orientation);
				quat.transformVector(this._rayLocal.direction, this._rayLocal.direction);
			}
		}
	}
	_updateTransforms() {
		if (this._dirtyLocal) {
			this._dirtyLocal = false;
			this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
		}
		const parent = this._manager.camera.parent;
		if (parent) {
			this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
		} else {
			this._worldTransform.copy(this._localTransform);
		}
	}
	_updateRayTransforms() {
		const dirty = this._dirtyRay;
		this._dirtyRay = false;
		const parent = this._manager.camera.parent;
		if (parent) {
			const parentTransform = this._manager.camera.parent.getWorldTransform();
			parentTransform.getTranslation(this._position);
			this._rotation.setFromMat4(parentTransform);
			this._rotation.transformVector(this._rayLocal.origin, this._ray.origin);
			this._ray.origin.add(this._position);
			this._rotation.transformVector(this._rayLocal.direction, this._ray.direction);
		} else if (dirty) {
			this._ray.origin.copy(this._rayLocal.origin);
			this._ray.direction.copy(this._rayLocal.direction);
		}
	}
	getPosition() {
		if (!this._position) return null;
		this._updateTransforms();
		this._worldTransform.getTranslation(this._position);
		return this._position;
	}
	getLocalPosition() {
		return this._localPosition;
	}
	getRotation() {
		if (!this._rotation) return null;
		this._updateTransforms();
		this._rotation.setFromMat4(this._worldTransform);
		return this._rotation;
	}
	getLocalRotation() {
		return this._localRotation;
	}
	getOrigin() {
		this._updateRayTransforms();
		return this._ray.origin;
	}
	getDirection() {
		this._updateRayTransforms();
		return this._ray.direction;
	}
	hitTestStart(options = {}) {
		options.profile = this._xrInputSource.profiles[0];
		const callback = options.callback;
		options.callback = (err, hitTestSource) => {
			if (hitTestSource) this.onHitTestSourceAdd(hitTestSource);
			if (callback) callback(err, hitTestSource);
		};
		this._manager.hitTest.start(options);
	}
	onHitTestSourceAdd(hitTestSource) {
		this._hitTestSources.push(hitTestSource);
		this.fire('hittest:add', hitTestSource);
		hitTestSource.on('result', function (position, rotation, inputSource) {
			if (inputSource !== this) return;
			this.fire('hittest:result', hitTestSource, position, rotation);
		}, this);
		hitTestSource.once('remove', function () {
			this.onHitTestSourceRemove(hitTestSource);
			this.fire('hittest:remove', hitTestSource);
		}, this);
	}
	onHitTestSourceRemove(hitTestSource) {
		const ind = this._hitTestSources.indexOf(hitTestSource);
		if (ind !== -1) this._hitTestSources.splice(ind, 1);
	}
}

export { XrInputSource };
