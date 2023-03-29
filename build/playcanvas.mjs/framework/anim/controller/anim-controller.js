import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import '../../../core/tracing.js';
import { sortPriority } from '../../../core/sort.js';
import { AnimClip } from '../evaluator/anim-clip.js';
import { AnimState } from './anim-state.js';
import { AnimNode } from './anim-node.js';
import { AnimTransition } from './anim-transition.js';
import { ANIM_STATE_START, ANIM_INTERRUPTION_NONE, ANIM_STATE_END, ANIM_STATE_ANY, ANIM_NOT_EQUAL_TO, ANIM_EQUAL_TO, ANIM_LESS_THAN_EQUAL_TO, ANIM_GREATER_THAN_EQUAL_TO, ANIM_LESS_THAN, ANIM_GREATER_THAN, ANIM_INTERRUPTION_NEXT_PREV, ANIM_INTERRUPTION_PREV_NEXT, ANIM_INTERRUPTION_NEXT, ANIM_INTERRUPTION_PREV, ANIM_PARAMETER_TRIGGER, ANIM_CONTROL_STATES } from './constants.js';

class AnimController {
	constructor(animEvaluator, states, transitions, parameters, activate, eventHandler, consumedTriggers) {
		this._animEvaluator = animEvaluator;
		this._states = {};
		this._stateNames = [];
		this._eventHandler = eventHandler;
		this._consumedTriggers = consumedTriggers;
		for (let i = 0; i < states.length; i++) {
			this._states[states[i].name] = new AnimState(this, states[i].name, states[i].speed, states[i].loop, states[i].blendTree);
			this._stateNames.push(states[i].name);
		}
		this._transitions = transitions.map(transition => {
			return new AnimTransition(_extends({}, transition));
		});
		this._findTransitionsFromStateCache = {};
		this._findTransitionsBetweenStatesCache = {};
		this._parameters = parameters;
		this._previousStateName = null;
		this._activeStateName = ANIM_STATE_START;
		this._playing = false;
		this._activate = activate;
		this._currTransitionTime = 1.0;
		this._totalTransitionTime = 1.0;
		this._isTransitioning = false;
		this._transitionInterruptionSource = ANIM_INTERRUPTION_NONE;
		this._transitionPreviousStates = [];
		this._timeInState = 0;
		this._timeInStateBefore = 0;
	}
	get animEvaluator() {
		return this._animEvaluator;
	}
	set activeState(stateName) {
		this._activeStateName = stateName;
	}
	get activeState() {
		return this._findState(this._activeStateName);
	}
	get activeStateName() {
		return this._activeStateName;
	}
	get activeStateAnimations() {
		return this.activeState.animations;
	}
	set previousState(stateName) {
		this._previousStateName = stateName;
	}
	get previousState() {
		return this._findState(this._previousStateName);
	}
	get previousStateName() {
		return this._previousStateName;
	}
	get playable() {
		let playable = true;
		for (let i = 0; i < this._stateNames.length; i++) {
			if (!this._states[this._stateNames[i]].playable) {
				playable = false;
			}
		}
		return playable;
	}
	set playing(value) {
		this._playing = value;
	}
	get playing() {
		return this._playing;
	}
	get activeStateProgress() {
		return this._getActiveStateProgressForTime(this._timeInState);
	}
	get activeStateDuration() {
		if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END) return 0.0;
		let maxDuration = 0.0;
		for (let i = 0; i < this.activeStateAnimations.length; i++) {
			const activeClip = this._animEvaluator.findClip(this.activeStateAnimations[i].name);
			if (activeClip) {
				maxDuration = Math.max(maxDuration, activeClip.track.duration);
			}
		}
		return maxDuration;
	}
	set activeStateCurrentTime(time) {
		this._timeInStateBefore = time;
		this._timeInState = time;
		for (let i = 0; i < this.activeStateAnimations.length; i++) {
			const clip = this.animEvaluator.findClip(this.activeStateAnimations[i].name);
			if (clip) {
				clip.time = time;
			}
		}
	}
	get activeStateCurrentTime() {
		return this._timeInState;
	}
	get transitioning() {
		return this._isTransitioning;
	}
	get transitionProgress() {
		return this._currTransitionTime / this._totalTransitionTime;
	}
	get states() {
		return this._stateNames;
	}
	assignMask(mask) {
		return this._animEvaluator.assignMask(mask);
	}
	_findState(stateName) {
		return this._states[stateName];
	}
	_getActiveStateProgressForTime(time) {
		if (this.activeStateName === ANIM_STATE_START || this.activeStateName === ANIM_STATE_END || this.activeStateName === ANIM_STATE_ANY) return 1.0;
		const activeClip = this._animEvaluator.findClip(this.activeStateAnimations[0].name);
		if (activeClip) {
			return activeClip.progressForTime(time);
		}
		return null;
	}
	_findTransitionsFromState(stateName) {
		let transitions = this._findTransitionsFromStateCache[stateName];
		if (!transitions) {
			transitions = this._transitions.filter(function (transition) {
				return transition.from === stateName;
			});
			sortPriority(transitions);
			this._findTransitionsFromStateCache[stateName] = transitions;
		}
		return transitions;
	}
	_findTransitionsBetweenStates(sourceStateName, destinationStateName) {
		let transitions = this._findTransitionsBetweenStatesCache[sourceStateName + '->' + destinationStateName];
		if (!transitions) {
			transitions = this._transitions.filter(function (transition) {
				return transition.from === sourceStateName && transition.to === destinationStateName;
			});
			sortPriority(transitions);
			this._findTransitionsBetweenStatesCache[sourceStateName + '->' + destinationStateName] = transitions;
		}
		return transitions;
	}
	_transitionHasConditionsMet(transition) {
		const conditions = transition.conditions;
		for (let i = 0; i < conditions.length; i++) {
			const condition = conditions[i];
			const parameter = this.findParameter(condition.parameterName);
			switch (condition.predicate) {
				case ANIM_GREATER_THAN:
					if (!(parameter.value > condition.value)) return false;
					break;
				case ANIM_LESS_THAN:
					if (!(parameter.value < condition.value)) return false;
					break;
				case ANIM_GREATER_THAN_EQUAL_TO:
					if (!(parameter.value >= condition.value)) return false;
					break;
				case ANIM_LESS_THAN_EQUAL_TO:
					if (!(parameter.value <= condition.value)) return false;
					break;
				case ANIM_EQUAL_TO:
					if (!(parameter.value === condition.value)) return false;
					break;
				case ANIM_NOT_EQUAL_TO:
					if (!(parameter.value !== condition.value)) return false;
					break;
			}
		}
		return true;
	}
	_findTransition(from, to) {
		let transitions = [];
		if (from && to) {
			transitions = transitions.concat(this._findTransitionsBetweenStates(from, to));
		} else {
			if (!this._isTransitioning) {
				transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
				transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
			} else {
				switch (this._transitionInterruptionSource) {
					case ANIM_INTERRUPTION_PREV:
						transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
						transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
						break;
					case ANIM_INTERRUPTION_NEXT:
						transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
						transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
						break;
					case ANIM_INTERRUPTION_PREV_NEXT:
						transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
						transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
						transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
						break;
					case ANIM_INTERRUPTION_NEXT_PREV:
						transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
						transitions = transitions.concat(this._findTransitionsFromState(this._previousStateName));
						transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
						break;
				}
			}
		}
		transitions = transitions.filter(transition => {
			if (transition.to === this.activeStateName) {
				return false;
			}
			if (transition.hasExitTime) {
				let progressBefore = this._getActiveStateProgressForTime(this._timeInStateBefore);
				let progress = this._getActiveStateProgressForTime(this._timeInState);
				if (transition.exitTime < 1.0 && this.activeState.loop) {
					progressBefore -= Math.floor(progressBefore);
					progress -= Math.floor(progress);
				}
				if (!(transition.exitTime > progressBefore && transition.exitTime <= progress)) {
					return null;
				}
			}
			return this._transitionHasConditionsMet(transition);
		});
		if (transitions.length > 0) {
			const transition = transitions[0];
			if (transition.to === ANIM_STATE_END) {
				const startTransition = this._findTransitionsFromState(ANIM_STATE_START)[0];
				transition.to = startTransition.to;
			}
			return transition;
		}
		return null;
	}
	updateStateFromTransition(transition) {
		let state;
		let animation;
		let clip;
		this.previousState = transition.from ? this.activeStateName : null;
		this.activeState = transition.to;
		for (let i = 0; i < transition.conditions.length; i++) {
			const condition = transition.conditions[i];
			const parameter = this.findParameter(condition.parameterName);
			if (parameter.type === ANIM_PARAMETER_TRIGGER) {
				this._consumedTriggers.add(condition.parameterName);
			}
		}
		if (this.previousState) {
			if (!this._isTransitioning) {
				this._transitionPreviousStates = [];
			}
			this._transitionPreviousStates.push({
				name: this._previousStateName,
				weight: 1
			});
			const interpolatedTime = Math.min(this._totalTransitionTime !== 0 ? this._currTransitionTime / this._totalTransitionTime : 1, 1.0);
			for (let i = 0; i < this._transitionPreviousStates.length; i++) {
				if (!this._isTransitioning) {
					this._transitionPreviousStates[i].weight = 1.0;
				} else if (i !== this._transitionPreviousStates.length - 1) {
					this._transitionPreviousStates[i].weight *= 1.0 - interpolatedTime;
				} else {
					this._transitionPreviousStates[i].weight = interpolatedTime;
				}
				state = this._findState(this._transitionPreviousStates[i].name);
				for (let j = 0; j < state.animations.length; j++) {
					animation = state.animations[j];
					clip = this._animEvaluator.findClip(animation.name + '.previous.' + i);
					if (!clip) {
						clip = this._animEvaluator.findClip(animation.name);
						clip.name = animation.name + '.previous.' + i;
					}
					if (i !== this._transitionPreviousStates.length - 1) {
						clip.pause();
					}
				}
			}
		}
		this._isTransitioning = true;
		this._totalTransitionTime = transition.time;
		this._currTransitionTime = 0;
		this._transitionInterruptionSource = transition.interruptionSource;
		const activeState = this.activeState;
		const hasTransitionOffset = transition.transitionOffset && transition.transitionOffset > 0.0 && transition.transitionOffset < 1.0;
		let timeInState = 0;
		let timeInStateBefore = 0;
		if (hasTransitionOffset) {
			const offsetTime = activeState.timelineDuration * transition.transitionOffset;
			timeInState = offsetTime;
			timeInStateBefore = offsetTime;
		}
		this._timeInState = timeInState;
		this._timeInStateBefore = timeInStateBefore;
		for (let i = 0; i < activeState.animations.length; i++) {
			clip = this._animEvaluator.findClip(activeState.animations[i].name);
			if (!clip) {
				const speed = Number.isFinite(activeState.animations[i].speed) ? activeState.animations[i].speed : activeState.speed;
				clip = new AnimClip(activeState.animations[i].animTrack, this._timeInState, speed, true, activeState.loop, this._eventHandler);
				clip.name = activeState.animations[i].name;
				this._animEvaluator.addClip(clip);
			} else {
				clip.reset();
			}
			if (transition.time > 0) {
				clip.blendWeight = 0.0;
			} else {
				clip.blendWeight = activeState.animations[i].normalizedWeight;
			}
			clip.play();
			if (hasTransitionOffset) {
				clip.time = activeState.timelineDuration * transition.transitionOffset;
			} else {
				const startTime = activeState.speed >= 0 ? 0 : this.activeStateDuration;
				clip.time = startTime;
			}
		}
	}
	_transitionToState(newStateName) {
		if (!this._findState(newStateName)) {
			return;
		}
		let transition = this._findTransition(this._activeStateName, newStateName);
		if (!transition) {
			this._animEvaluator.removeClips();
			transition = new AnimTransition({
				from: null,
				to: newStateName
			});
		}
		this.updateStateFromTransition(transition);
	}
	assignAnimation(pathString, animTrack, speed, loop) {
		const path = pathString.split('.');
		let state = this._findState(path[0]);
		if (!state) {
			state = new AnimState(this, path[0], 1.0);
			this._states[path[0]] = state;
			this._stateNames.push(path[0]);
		}
		state.addAnimation(path, animTrack);
		this._animEvaluator.updateClipTrack(state.name, animTrack);
		if (speed !== undefined) {
			state.speed = speed;
		}
		if (loop !== undefined) {
			state.loop = loop;
		}
		if (!this._playing && this._activate && this.playable) {
			this.play();
		}
	}
	removeNodeAnimations(nodeName) {
		if (ANIM_CONTROL_STATES.indexOf(nodeName) !== -1) {
			return false;
		}
		const state = this._findState(nodeName);
		if (!state) {
			return false;
		}
		state.animations = [];
		return true;
	}
	play(stateName) {
		if (stateName) {
			this._transitionToState(stateName);
		}
		this._playing = true;
	}
	pause() {
		this._playing = false;
	}
	reset() {
		this._previousStateName = null;
		this._activeStateName = ANIM_STATE_START;
		this._playing = false;
		this._currTransitionTime = 1.0;
		this._totalTransitionTime = 1.0;
		this._isTransitioning = false;
		this._timeInState = 0;
		this._timeInStateBefore = 0;
		this._animEvaluator.removeClips();
	}
	rebind() {
		this._animEvaluator.rebind();
	}
	update(dt) {
		if (!this._playing) {
			return;
		}
		let state;
		let animation;
		let clip;
		this._timeInStateBefore = this._timeInState;
		this._timeInState += dt * this.activeState.speed;
		const transition = this._findTransition(this._activeStateName);
		if (transition) this.updateStateFromTransition(transition);
		if (this._isTransitioning) {
			this._currTransitionTime += dt;
			if (this._currTransitionTime <= this._totalTransitionTime) {
				const interpolatedTime = this._totalTransitionTime !== 0 ? this._currTransitionTime / this._totalTransitionTime : 1;
				for (let i = 0; i < this._transitionPreviousStates.length; i++) {
					state = this._findState(this._transitionPreviousStates[i].name);
					const stateWeight = this._transitionPreviousStates[i].weight;
					for (let j = 0; j < state.animations.length; j++) {
						animation = state.animations[j];
						clip = this._animEvaluator.findClip(animation.name + '.previous.' + i);
						if (clip) {
							clip.blendWeight = (1.0 - interpolatedTime) * animation.normalizedWeight * stateWeight;
						}
					}
				}
				state = this.activeState;
				for (let i = 0; i < state.animations.length; i++) {
					animation = state.animations[i];
					this._animEvaluator.findClip(animation.name).blendWeight = interpolatedTime * animation.normalizedWeight;
				}
			} else {
				this._isTransitioning = false;
				const activeClips = this.activeStateAnimations.length;
				const totalClips = this._animEvaluator.clips.length;
				for (let i = 0; i < totalClips - activeClips; i++) {
					this._animEvaluator.removeClip(0);
				}
				this._transitionPreviousStates = [];
				state = this.activeState;
				for (let i = 0; i < state.animations.length; i++) {
					animation = state.animations[i];
					clip = this._animEvaluator.findClip(animation.name);
					if (clip) {
						clip.blendWeight = animation.normalizedWeight;
					}
				}
			}
		} else {
			if (this.activeState._blendTree.constructor !== AnimNode) {
				state = this.activeState;
				for (let i = 0; i < state.animations.length; i++) {
					animation = state.animations[i];
					clip = this._animEvaluator.findClip(animation.name);
					if (clip) {
						clip.blendWeight = animation.normalizedWeight;
						if (animation.parent.syncAnimations) {
							clip.speed = animation.speed;
						}
					}
				}
			}
		}
		this._animEvaluator.update(dt, this.activeState.hasAnimations);
	}
	findParameter(name) {
		return this._parameters[name];
	}
}

export { AnimController };
