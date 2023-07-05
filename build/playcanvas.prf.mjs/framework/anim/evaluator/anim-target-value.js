import { Quat } from '../../../core/math/quat.js';
import { ANIM_LAYER_OVERWRITE, ANIM_LAYER_ADDITIVE } from '../controller/constants.js';
import { AnimBlend } from './anim-blend.js';
import { math } from '../../../core/math/math.js';

class AnimTargetValue {
	constructor(component, type) {
		this._component = component;
		this.mask = new Int8Array(component.layers.length);
		this.weights = new Float32Array(component.layers.length);
		this.totalWeight = 0;
		this.counter = 0;
		this.layerCounter = 0;
		this.valueType = type;
		this.dirty = true;
		this.value = type === AnimTargetValue.TYPE_QUAT ? [0, 0, 0, 1] : [0, 0, 0];
		this.baseValue = null;
		this.setter = null;
	}
	get _normalizeWeights() {
		return this._component.normalizeWeights;
	}
	getWeight(index) {
		if (this.dirty) this.updateWeights();
		if (this._normalizeWeights && this.totalWeight === 0 || !this.mask[index]) {
			return 0;
		} else if (this._normalizeWeights) {
			return this.weights[index] / this.totalWeight;
		}
		return math.clamp(this.weights[index], 0, 1);
	}
	_layerBlendType(index) {
		return this._component.layers[index].blendType;
	}
	setMask(index, value) {
		this.mask[index] = value;
		if (this._normalizeWeights) {
			if (this._component.layers[index].blendType === ANIM_LAYER_OVERWRITE) {
				this.mask = this.mask.fill(0, 0, index);
			}
			this.dirty = true;
		}
	}
	updateWeights() {
		this.totalWeight = 0;
		for (let i = 0; i < this.weights.length; i++) {
			this.weights[i] = this._component.layers[i].weight;
			this.totalWeight += this.mask[i] * this.weights[i];
		}
		this.dirty = false;
	}
	updateValue(index, value) {
		if (this.counter === 0) {
			AnimBlend.set(this.value, AnimTargetValue.IDENTITY_QUAT_ARR, this.valueType);
			if (!this._normalizeWeights) {
				AnimBlend.blend(this.value, this.baseValue, 1, this.valueType);
			}
		}
		if (!this.mask[index] || this.getWeight(index) === 0) return;
		if (this._layerBlendType(index) === ANIM_LAYER_ADDITIVE && !this._normalizeWeights) {
			if (this.valueType === AnimTargetValue.TYPE_QUAT) {
				const v = AnimTargetValue.q1.set(this.value[0], this.value[1], this.value[2], this.value[3]);
				const aV1 = AnimTargetValue.q2.set(this.baseValue[0], this.baseValue[1], this.baseValue[2], this.baseValue[3]);
				const aV2 = AnimTargetValue.q3.set(value[0], value[1], value[2], value[3]);
				const aV = aV1.invert().mul(aV2);
				aV.slerp(Quat.IDENTITY, aV, this.getWeight(index));
				v.mul(aV);
				AnimTargetValue.quatArr[0] = v.x;
				AnimTargetValue.quatArr[1] = v.y;
				AnimTargetValue.quatArr[2] = v.z;
				AnimTargetValue.quatArr[3] = v.w;
				AnimBlend.set(this.value, AnimTargetValue.quatArr, this.valueType);
			} else {
				AnimTargetValue.vecArr[0] = value[0] - this.baseValue[0];
				AnimTargetValue.vecArr[1] = value[1] - this.baseValue[1];
				AnimTargetValue.vecArr[2] = value[2] - this.baseValue[2];
				AnimBlend.blend(this.value, AnimTargetValue.vecArr, this.getWeight(index), this.valueType, true);
			}
		} else {
			AnimBlend.blend(this.value, value, this.getWeight(index), this.valueType);
		}
		if (this.setter) this.setter(this.value);
	}
	unbind() {
		if (this.setter) {
			this.setter(this.baseValue);
		}
	}
}
AnimTargetValue.TYPE_QUAT = 'quaternion';
AnimTargetValue.TYPE_VEC3 = 'vector3';
AnimTargetValue.q1 = new Quat();
AnimTargetValue.q2 = new Quat();
AnimTargetValue.q3 = new Quat();
AnimTargetValue.quatArr = [0, 0, 0, 1];
AnimTargetValue.vecArr = [0, 0, 0];
AnimTargetValue.IDENTITY_QUAT_ARR = [0, 0, 0, 1];

export { AnimTargetValue };
