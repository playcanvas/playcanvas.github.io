import '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { AnimTransition } from '../../anim/controller/anim-transition.js';
import { ANIM_LAYER_OVERWRITE } from '../../anim/controller/constants.js';

class AnimComponentLayer {
	constructor(name, controller, component, weight = 1, blendType = ANIM_LAYER_OVERWRITE, normalizedWeight = true) {
		this._name = name;
		this._controller = controller;
		this._component = component;
		this._weight = weight;
		this._blendType = blendType;
		this._normalizedWeight = normalizedWeight;
		this._mask = null;
		this._blendTime = 0;
		this._blendTimeElapsed = 0;
		this._startingWeight = 0;
		this._targetWeight = 0;
	}
	get name() {
		return this._name;
	}
	set playing(value) {
		this._controller.playing = value;
	}
	get playing() {
		return this._controller.playing;
	}
	get playable() {
		return this._controller.playable;
	}
	get activeState() {
		return this._controller.activeStateName;
	}
	get previousState() {
		return this._controller.previousStateName;
	}
	get activeStateProgress() {
		return this._controller.activeStateProgress;
	}
	get activeStateDuration() {
		return this._controller.activeStateDuration;
	}
	set activeStateCurrentTime(time) {
		const controller = this._controller;
		const layerPlaying = controller.playing;
		controller.playing = true;
		controller.activeStateCurrentTime = time;
		if (!layerPlaying) {
			controller.update(0);
		}
		controller.playing = layerPlaying;
	}
	get activeStateCurrentTime() {
		return this._controller.activeStateCurrentTime;
	}
	get transitioning() {
		return this._controller.transitioning;
	}
	get transitionProgress() {
		if (this.transitioning) {
			return this._controller.transitionProgress;
		}
		return null;
	}
	get states() {
		return this._controller.states;
	}
	set weight(value) {
		this._weight = value;
		this._component.dirtifyTargets();
	}
	get weight() {
		return this._weight;
	}
	set blendType(value) {
		if (value !== this._blendType) {
			this._blendType = value;
			if (this._controller.normalizeWeights) {
				this._component.rebind();
			}
		}
	}
	get blendType() {
		return this._blendType;
	}
	set mask(value) {
		if (this._controller.assignMask(value)) {
			this._component.rebind();
		}
		this._mask = value;
	}
	get mask() {
		return this._mask;
	}
	play(name) {
		this._controller.play(name);
	}
	pause() {
		this._controller.pause();
	}
	reset() {
		this._controller.reset();
	}
	rebind() {
		this._controller.rebind();
	}
	update(dt) {
		if (this._blendTime) {
			if (this._blendTimeElapsed < this._blendTime) {
				this.weight = math.lerp(this._startingWeight, this._targetWeight, this._blendTimeElapsed / this._blendTime);
				this._blendTimeElapsed += dt;
			} else {
				this.weight = this._targetWeight;
				this._blendTime = 0;
				this._blendTimeElapsed = 0;
				this._startingWeight = 0;
				this._targetWeight = 0;
			}
		}
		this._controller.update(dt);
	}
	blendToWeight(weight, time) {
		this._startingWeight = this.weight;
		this._targetWeight = weight;
		this._blendTime = Math.max(0, time);
		this._blendTimeElapsed = 0;
	}
	assignMask(mask) {
		if (this._controller.assignMask(mask)) {
			this._component.rebind();
		}
		this._mask = mask;
	}
	assignAnimation(nodePath, animTrack, speed, loop) {
		if (!(animTrack instanceof AnimTrack)) {
			return;
		}
		this._controller.assignAnimation(nodePath, animTrack, speed, loop);
		if (this._controller._transitions.length === 0) {
			this._controller._transitions.push(new AnimTransition({
				from: 'START',
				to: nodePath
			}));
		}
		if (this._component.activate && this._component.playable) {
			this._component.playing = true;
		}
	}
	removeNodeAnimations(nodeName) {
		if (this._controller.removeNodeAnimations(nodeName)) {
			this._component.playing = false;
		}
	}
	getAnimationAsset(stateName) {
		return this._component.animationAssets[`${this.name}:${stateName}`];
	}
	transition(to, time = 0, transitionOffset = null) {
		this._controller.updateStateFromTransition(new AnimTransition({
			from: this._controller.activeStateName,
			to,
			time,
			transitionOffset
		}));
	}
}

export { AnimComponentLayer };
