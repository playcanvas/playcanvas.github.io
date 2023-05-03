import { platform } from '../../core/platform.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

const tipJointIds = platform.browser && window.XRHand ? ['thumb-tip', 'index-finger-tip', 'middle-finger-tip', 'ring-finger-tip', 'pinky-finger-tip'] : [];
const tipJointIdsIndex = {};
for (let i = 0; i < tipJointIds.length; i++) {
	tipJointIdsIndex[tipJointIds[i]] = true;
}
class XrJoint {
	constructor(index, id, hand, finger = null) {
		this._index = void 0;
		this._id = void 0;
		this._hand = void 0;
		this._finger = void 0;
		this._wrist = void 0;
		this._tip = void 0;
		this._radius = null;
		this._localTransform = new Mat4();
		this._worldTransform = new Mat4();
		this._localPosition = new Vec3();
		this._localRotation = new Quat();
		this._position = new Vec3();
		this._rotation = new Quat();
		this._dirtyLocal = true;
		this._index = index;
		this._id = id;
		this._hand = hand;
		this._finger = finger;
		this._wrist = id === 'wrist';
		this._tip = this._finger && !!tipJointIdsIndex[id];
	}
	update(pose) {
		this._dirtyLocal = true;
		this._radius = pose.radius;
		this._localPosition.copy(pose.transform.position);
		this._localRotation.copy(pose.transform.orientation);
	}
	_updateTransforms() {
		if (this._dirtyLocal) {
			this._dirtyLocal = false;
			this._localTransform.setTRS(this._localPosition, this._localRotation, Vec3.ONE);
		}
		const manager = this._hand._manager;
		const parent = manager.camera.parent;
		if (parent) {
			this._worldTransform.mul2(parent.getWorldTransform(), this._localTransform);
		} else {
			this._worldTransform.copy(this._localTransform);
		}
	}
	getPosition() {
		this._updateTransforms();
		this._worldTransform.getTranslation(this._position);
		return this._position;
	}
	getRotation() {
		this._updateTransforms();
		this._rotation.setFromMat4(this._worldTransform);
		return this._rotation;
	}
	get index() {
		return this._index;
	}
	get hand() {
		return this._hand;
	}
	get finger() {
		return this._finger;
	}
	get wrist() {
		return this._wrist;
	}
	get tip() {
		return this._tip;
	}
	get radius() {
		return this._radius || 0.005;
	}
}

export { XrJoint };
