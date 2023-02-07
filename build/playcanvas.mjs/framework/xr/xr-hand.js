import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Vec3 } from '../../core/math/vec3.js';
import { XRHAND_LEFT } from './constants.js';
import { XrFinger } from './xr-finger.js';
import { XrJoint } from './xr-joint.js';

let fingerJointIds = [];
const vecA = new Vec3();
const vecB = new Vec3();
const vecC = new Vec3();
if (platform.browser && window.XRHand) {
	fingerJointIds = [['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'], ['index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip'], ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip'], ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip'], ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip']];
}
class XrHand extends EventHandler {
	constructor(inputSource) {
		super();
		this._manager = void 0;
		this._inputSource = void 0;
		this._tracking = false;
		this._fingers = [];
		this._joints = [];
		this._jointsById = {};
		this._tips = [];
		this._wrist = null;
		const xrHand = inputSource._xrInputSource.hand;
		this._manager = inputSource._manager;
		this._inputSource = inputSource;
		if (xrHand.get('wrist')) {
			const joint = new XrJoint(0, 'wrist', this, null);
			this._wrist = joint;
			this._joints.push(joint);
			this._jointsById.wrist = joint;
		}
		for (let f = 0; f < fingerJointIds.length; f++) {
			const finger = new XrFinger(f, this);
			for (let j = 0; j < fingerJointIds[f].length; j++) {
				const jointId = fingerJointIds[f][j];
				if (!xrHand.get(jointId)) continue;
				const joint = new XrJoint(j, jointId, this, finger);
				this._joints.push(joint);
				this._jointsById[jointId] = joint;
				if (joint.tip) {
					this._tips.push(joint);
					finger._tip = joint;
				}
				finger._joints.push(joint);
			}
		}
	}
	update(frame) {
		const xrInputSource = this._inputSource._xrInputSource;
		for (let j = 0; j < this._joints.length; j++) {
			const joint = this._joints[j];
			const jointSpace = xrInputSource.hand.get(joint._id);
			if (jointSpace) {
				let pose;
				if (frame.session.visibilityState !== 'hidden') pose = frame.getJointPose(jointSpace, this._manager._referenceSpace);
				if (pose) {
					joint.update(pose);
					if (joint.wrist && !this._tracking) {
						this._tracking = true;
						this.fire('tracking');
					}
				} else if (joint.wrist) {
					if (this._tracking) {
						this._tracking = false;
						this.fire('trackinglost');
					}
					break;
				}
			}
		}
		const j1 = this._jointsById['thumb-metacarpal'];
		const j4 = this._jointsById['thumb-tip'];
		const j6 = this._jointsById['index-finger-phalanx-proximal'];
		const j9 = this._jointsById['index-finger-tip'];
		const j16 = this._jointsById['ring-finger-phalanx-proximal'];
		const j21 = this._jointsById['pinky-finger-phalanx-proximal'];
		if (j1 && j4 && j6 && j9 && j16 && j21) {
			this._inputSource._dirtyRay = true;
			this._inputSource._rayLocal.origin.lerp(j4._localPosition, j9._localPosition, 0.5);
			let jointL = j1;
			let jointR = j21;
			if (this._inputSource.handedness === XRHAND_LEFT) {
				const t = jointL;
				jointL = jointR;
				jointR = t;
			}
			vecA.sub2(jointL._localPosition, this._wrist._localPosition);
			vecB.sub2(jointR._localPosition, this._wrist._localPosition);
			vecC.cross(vecA, vecB).normalize();
			vecA.lerp(j6._localPosition, j16._localPosition, 0.5);
			vecA.sub(this._wrist._localPosition).normalize();
			this._inputSource._rayLocal.direction.lerp(vecC, vecA, 0.5).normalize();
		}
		const squeezing = this._fingerIsClosed(1) && this._fingerIsClosed(2) && this._fingerIsClosed(3) && this._fingerIsClosed(4);
		if (squeezing) {
			if (!this._inputSource._squeezing) {
				this._inputSource._squeezing = true;
				this._inputSource.fire('squeezestart');
				this._manager.input.fire('squeezestart', this._inputSource);
			}
		} else {
			if (this._inputSource._squeezing) {
				this._inputSource._squeezing = false;
				this._inputSource.fire('squeeze');
				this._manager.input.fire('squeeze', this._inputSource);
				this._inputSource.fire('squeezeend');
				this._manager.input.fire('squeezeend', this._inputSource);
			}
		}
	}
	_fingerIsClosed(index) {
		const finger = this._fingers[index];
		vecA.sub2(finger.joints[0]._localPosition, finger.joints[1]._localPosition).normalize();
		vecB.sub2(finger.joints[2]._localPosition, finger.joints[3]._localPosition).normalize();
		return vecA.dot(vecB) < -0.8;
	}
	getJointById(id) {
		return this._jointsById[id] || null;
	}
	get fingers() {
		return this._fingers;
	}
	get joints() {
		return this._joints;
	}
	get tips() {
		return this._tips;
	}
	get wrist() {
		return this._wrist;
	}
	get tracking() {
		return this._tracking;
	}
}

export { XrHand };
