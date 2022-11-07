/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../../core/debug.js';
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
      return time / activeClip.track.duration;
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
      Debug.error('Attempting to unassign animation tracks from a state that does not exist.');
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
    this._timeInState += dt;

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
    this._animEvaluator.update(dt);
  }
  findParameter(name) {
    return this._parameters[name];
  }
}

export { AnimController };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1jb250cm9sbGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2FuaW0vY29udHJvbGxlci9hbmltLWNvbnRyb2xsZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHNvcnRQcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvc29ydC5qcyc7XG5pbXBvcnQgeyBBbmltQ2xpcCB9IGZyb20gJy4uL2V2YWx1YXRvci9hbmltLWNsaXAuanMnO1xuaW1wb3J0IHsgQW5pbVN0YXRlIH0gZnJvbSAnLi9hbmltLXN0YXRlLmpzJztcbmltcG9ydCB7IEFuaW1Ob2RlIH0gZnJvbSAnLi9hbmltLW5vZGUuanMnO1xuaW1wb3J0IHsgQW5pbVRyYW5zaXRpb24gfSBmcm9tICcuL2FuaW0tdHJhbnNpdGlvbi5qcyc7XG5pbXBvcnQge1xuICAgIEFOSU1fR1JFQVRFUl9USEFOLCBBTklNX0xFU1NfVEhBTiwgQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE8sIEFOSU1fTEVTU19USEFOX0VRVUFMX1RPLCBBTklNX0VRVUFMX1RPLCBBTklNX05PVF9FUVVBTF9UTyxcbiAgICBBTklNX0lOVEVSUlVQVElPTl9OT05FLCBBTklNX0lOVEVSUlVQVElPTl9QUkVWLCBBTklNX0lOVEVSUlVQVElPTl9ORVhULCBBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQsIEFOSU1fSU5URVJSVVBUSU9OX05FWFRfUFJFVixcbiAgICBBTklNX1BBUkFNRVRFUl9UUklHR0VSLFxuICAgIEFOSU1fU1RBVEVfU1RBUlQsIEFOSU1fU1RBVEVfRU5ELCBBTklNX1NUQVRFX0FOWSwgQU5JTV9DT05UUk9MX1NUQVRFU1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnKS5FdmVudEhhbmRsZXJ9IEV2ZW50SGFuZGxlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2V2YWx1YXRvci9hbmltLWV2YWx1YXRvci5qcycpLkFuaW1FdmFsdWF0b3J9IEFuaW1FdmFsdWF0b3IgKi9cblxuLyoqXG4gKiBUaGUgQW5pbUNvbnRyb2xsZXIgbWFuYWdlcyB0aGUgYW5pbWF0aW9ucyBmb3IgaXRzIGVudGl0eSwgYmFzZWQgb24gdGhlIHByb3ZpZGVkIHN0YXRlIGdyYXBoIGFuZFxuICogcGFyYW1ldGVycy4gSXRzIHVwZGF0ZSBtZXRob2QgZGV0ZXJtaW5lcyB3aGljaCBzdGF0ZSB0aGUgY29udHJvbGxlciBzaG91bGQgYmUgaW4gYmFzZWQgb24gdGhlXG4gKiBjdXJyZW50IHRpbWUsIHBhcmFtZXRlcnMgYW5kIGF2YWlsYWJsZSBzdGF0ZXMgLyB0cmFuc2l0aW9ucy4gSXQgYWxzbyBlbnN1cmVzIHRoZSBBbmltRXZhbHVhdG9yXG4gKiBpcyBzdXBwbGllZCB3aXRoIHRoZSBjb3JyZWN0IGFuaW1hdGlvbnMsIGJhc2VkIG9uIHRoZSBjdXJyZW50bHkgYWN0aXZlIHN0YXRlLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQW5pbUNvbnRyb2xsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltQ29udHJvbGxlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QW5pbUV2YWx1YXRvcn0gYW5pbUV2YWx1YXRvciAtIFRoZSBhbmltYXRpb24gZXZhbHVhdG9yIHVzZWQgdG8gYmxlbmQgYWxsIGN1cnJlbnRcbiAgICAgKiBwbGF5aW5nIGFuaW1hdGlvbiBrZXlmcmFtZXMgYW5kIHVwZGF0ZSB0aGUgZW50aXRpZXMgcHJvcGVydGllcyBiYXNlZCBvbiB0aGUgY3VycmVudFxuICAgICAqIGFuaW1hdGlvbiB2YWx1ZXMuXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gc3RhdGVzIC0gVGhlIGxpc3Qgb2Ygc3RhdGVzIHVzZWQgdG8gZm9ybSB0aGUgY29udHJvbGxlciBzdGF0ZSBncmFwaC5cbiAgICAgKiBAcGFyYW0ge29iamVjdFtdfSB0cmFuc2l0aW9ucyAtIFRoZSBsaXN0IG9mIHRyYW5zaXRpb25zIHVzZWQgdG8gZm9ybSB0aGUgY29udHJvbGxlciBzdGF0ZVxuICAgICAqIGdyYXBoLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0W119IHBhcmFtZXRlcnMgLSBUaGUgYW5pbSBjb21wb25lbnRzIHBhcmFtZXRlcnMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBhY3RpdmF0ZSAtIERldGVybWluZXMgd2hldGhlciB0aGUgYW5pbSBjb250cm9sbGVyIHNob3VsZCBhdXRvbWF0aWNhbGx5IHBsYXlcbiAgICAgKiBvbmNlIGFsbCB7QGxpbmsgQW5pbU5vZGVzfSBhcmUgYXNzaWduZWQgYW5pbWF0aW9ucy5cbiAgICAgKiBAcGFyYW0ge0V2ZW50SGFuZGxlcn0gZXZlbnRIYW5kbGVyIC0gVGhlIGV2ZW50IGhhbmRsZXIgd2hpY2ggc2hvdWxkIGJlIG5vdGlmaWVkIHdpdGggYW5pbVxuICAgICAqIGV2ZW50cy5cbiAgICAgKiBAcGFyYW0ge1NldH0gY29uc3VtZWRUcmlnZ2VycyAtIFVzZWQgdG8gc2V0IHRyaWdnZXJzIGJhY2sgdG8gdGhlaXIgZGVmYXVsdCBzdGF0ZSBhZnRlciB0aGV5XG4gICAgICogaGF2ZSBiZWVuIGNvbnN1bWVkIGJ5IGEgdHJhbnNpdGlvbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhbmltRXZhbHVhdG9yLCBzdGF0ZXMsIHRyYW5zaXRpb25zLCBwYXJhbWV0ZXJzLCBhY3RpdmF0ZSwgZXZlbnRIYW5kbGVyLCBjb25zdW1lZFRyaWdnZXJzKSB7XG4gICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IgPSBhbmltRXZhbHVhdG9yO1xuICAgICAgICB0aGlzLl9zdGF0ZXMgPSB7fTtcbiAgICAgICAgdGhpcy5fc3RhdGVOYW1lcyA9IFtdO1xuICAgICAgICB0aGlzLl9ldmVudEhhbmRsZXIgPSBldmVudEhhbmRsZXI7XG4gICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMgPSBjb25zdW1lZFRyaWdnZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVzW3N0YXRlc1tpXS5uYW1lXSA9IG5ldyBBbmltU3RhdGUoXG4gICAgICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICAgICBzdGF0ZXNbaV0ubmFtZSxcbiAgICAgICAgICAgICAgICBzdGF0ZXNbaV0uc3BlZWQsXG4gICAgICAgICAgICAgICAgc3RhdGVzW2ldLmxvb3AsXG4gICAgICAgICAgICAgICAgc3RhdGVzW2ldLmJsZW5kVHJlZVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlTmFtZXMucHVzaChzdGF0ZXNbaV0ubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5tYXAoKHRyYW5zaXRpb24pID0+IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgQW5pbVRyYW5zaXRpb24oe1xuICAgICAgICAgICAgICAgIC4uLnRyYW5zaXRpb25cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlQ2FjaGUgPSB7fTtcbiAgICAgICAgdGhpcy5fZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlc0NhY2hlID0ge307XG4gICAgICAgIHRoaXMuX3BhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzO1xuICAgICAgICB0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSA9IEFOSU1fU1RBVEVfU1RBUlQ7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYWN0aXZhdGUgPSBhY3RpdmF0ZTtcblxuICAgICAgICB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgPSAxLjA7XG4gICAgICAgIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgPSAxLjA7XG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90cmFuc2l0aW9uSW50ZXJydXB0aW9uU291cmNlID0gQU5JTV9JTlRFUlJVUFRJT05fTk9ORTtcbiAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzID0gW107XG5cbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGUgPSAwO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSA9IDA7XG4gICAgfVxuXG4gICAgZ2V0IGFuaW1FdmFsdWF0b3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmltRXZhbHVhdG9yO1xuICAgIH1cblxuICAgIHNldCBhY3RpdmVTdGF0ZShzdGF0ZU5hbWUpIHtcbiAgICAgICAgdGhpcy5fYWN0aXZlU3RhdGVOYW1lID0gc3RhdGVOYW1lO1xuICAgIH1cblxuICAgIGdldCBhY3RpdmVTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbmRTdGF0ZSh0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpO1xuICAgIH1cblxuICAgIGdldCBhY3RpdmVTdGF0ZU5hbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVTdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlQW5pbWF0aW9ucygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWN0aXZlU3RhdGUuYW5pbWF0aW9ucztcbiAgICB9XG5cbiAgICBzZXQgcHJldmlvdXNTdGF0ZShzdGF0ZU5hbWUpIHtcbiAgICAgICAgdGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUgPSBzdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IHByZXZpb3VzU3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9maW5kU3RhdGUodGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUpO1xuICAgIH1cblxuICAgIGdldCBwcmV2aW91c1N0YXRlTmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lO1xuICAgIH1cblxuICAgIGdldCBwbGF5YWJsZSgpIHtcbiAgICAgICAgbGV0IHBsYXlhYmxlID0gdHJ1ZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9zdGF0ZU5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX3N0YXRlc1t0aGlzLl9zdGF0ZU5hbWVzW2ldXS5wbGF5YWJsZSkge1xuICAgICAgICAgICAgICAgIHBsYXlhYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBsYXlhYmxlO1xuICAgIH1cblxuICAgIHNldCBwbGF5aW5nKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgcGxheWluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BsYXlpbmc7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlUHJvZ3Jlc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRBY3RpdmVTdGF0ZVByb2dyZXNzRm9yVGltZSh0aGlzLl90aW1lSW5TdGF0ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlRHVyYXRpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZVN0YXRlTmFtZSA9PT0gQU5JTV9TVEFURV9TVEFSVCB8fCB0aGlzLmFjdGl2ZVN0YXRlTmFtZSA9PT0gQU5JTV9TVEFURV9FTkQpXG4gICAgICAgICAgICByZXR1cm4gMC4wO1xuXG4gICAgICAgIGxldCBtYXhEdXJhdGlvbiA9IDAuMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFjdGl2ZVN0YXRlQW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYWN0aXZlQ2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAodGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnNbaV0ubmFtZSk7XG4gICAgICAgICAgICBpZiAoYWN0aXZlQ2xpcCkge1xuICAgICAgICAgICAgICAgIG1heER1cmF0aW9uID0gTWF0aC5tYXgobWF4RHVyYXRpb24sIGFjdGl2ZUNsaXAudHJhY2suZHVyYXRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXhEdXJhdGlvbjtcbiAgICB9XG5cbiAgICBzZXQgYWN0aXZlU3RhdGVDdXJyZW50VGltZSh0aW1lKSB7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gdGltZTtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGUgPSB0aW1lO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjbGlwID0gdGhpcy5hbmltRXZhbHVhdG9yLmZpbmRDbGlwKHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zW2ldLm5hbWUpO1xuICAgICAgICAgICAgaWYgKGNsaXApIHtcbiAgICAgICAgICAgICAgICBjbGlwLnRpbWUgPSB0aW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlQ3VycmVudFRpbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90aW1lSW5TdGF0ZTtcbiAgICB9XG5cbiAgICBnZXQgdHJhbnNpdGlvbmluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lzVHJhbnNpdGlvbmluZztcbiAgICB9XG5cbiAgICBnZXQgdHJhbnNpdGlvblByb2dyZXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VyclRyYW5zaXRpb25UaW1lIC8gdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZTtcbiAgICB9XG5cbiAgICBnZXQgc3RhdGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGVOYW1lcztcbiAgICB9XG5cbiAgICBhc3NpZ25NYXNrKG1hc2spIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1FdmFsdWF0b3IuYXNzaWduTWFzayhtYXNrKTtcbiAgICB9XG5cbiAgICBfZmluZFN0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGVzW3N0YXRlTmFtZV07XG4gICAgfVxuXG4gICAgX2dldEFjdGl2ZVN0YXRlUHJvZ3Jlc3NGb3JUaW1lKHRpbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX1NUQVJUIHx8IHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX0VORCB8fCB0aGlzLmFjdGl2ZVN0YXRlTmFtZSA9PT0gQU5JTV9TVEFURV9BTlkpXG4gICAgICAgICAgICByZXR1cm4gMS4wO1xuXG4gICAgICAgIGNvbnN0IGFjdGl2ZUNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zWzBdLm5hbWUpO1xuICAgICAgICBpZiAoYWN0aXZlQ2xpcCkge1xuICAgICAgICAgICAgcmV0dXJuIHRpbWUgLyBhY3RpdmVDbGlwLnRyYWNrLmR1cmF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGFsbCB0aGUgdHJhbnNpdGlvbnMgdGhhdCBoYXZlIHRoZSBnaXZlbiBzdGF0ZU5hbWUgYXMgdGhlaXIgc291cmNlIHN0YXRlXG4gICAgX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShzdGF0ZU5hbWUpIHtcbiAgICAgICAgbGV0IHRyYW5zaXRpb25zID0gdGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlQ2FjaGVbc3RhdGVOYW1lXTtcbiAgICAgICAgaWYgKCF0cmFuc2l0aW9ucykge1xuICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0aGlzLl90cmFuc2l0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKHRyYW5zaXRpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJhbnNpdGlvbi5mcm9tID09PSBzdGF0ZU5hbWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gc29ydCB0cmFuc2l0aW9ucyBpbiBwcmlvcml0eSBvcmRlclxuICAgICAgICAgICAgc29ydFByaW9yaXR5KHRyYW5zaXRpb25zKTtcblxuICAgICAgICAgICAgdGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlQ2FjaGVbc3RhdGVOYW1lXSA9IHRyYW5zaXRpb25zO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cmFuc2l0aW9ucztcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYWxsIHRoZSB0cmFuc2l0aW9ucyB0aGF0IGNvbnRhaW4gdGhlIGdpdmVuIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gc3RhdGVzXG4gICAgX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXMoc291cmNlU3RhdGVOYW1lLCBkZXN0aW5hdGlvblN0YXRlTmFtZSkge1xuICAgICAgICBsZXQgdHJhbnNpdGlvbnMgPSB0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGVbc291cmNlU3RhdGVOYW1lICsgJy0+JyArIGRlc3RpbmF0aW9uU3RhdGVOYW1lXTtcbiAgICAgICAgaWYgKCF0cmFuc2l0aW9ucykge1xuICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0aGlzLl90cmFuc2l0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKHRyYW5zaXRpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJhbnNpdGlvbi5mcm9tID09PSBzb3VyY2VTdGF0ZU5hbWUgJiYgdHJhbnNpdGlvbi50byA9PT0gZGVzdGluYXRpb25TdGF0ZU5hbWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gc29ydCB0cmFuc2l0aW9ucyBpbiBwcmlvcml0eSBvcmRlclxuICAgICAgICAgICAgc29ydFByaW9yaXR5KHRyYW5zaXRpb25zKTtcblxuICAgICAgICAgICAgdGhpcy5fZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlc0NhY2hlW3NvdXJjZVN0YXRlTmFtZSArICctPicgKyBkZXN0aW5hdGlvblN0YXRlTmFtZV0gPSB0cmFuc2l0aW9ucztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJhbnNpdGlvbnM7XG4gICAgfVxuXG4gICAgX3RyYW5zaXRpb25IYXNDb25kaXRpb25zTWV0KHRyYW5zaXRpb24pIHtcbiAgICAgICAgY29uc3QgY29uZGl0aW9ucyA9IHRyYW5zaXRpb24uY29uZGl0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb25kaXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb25kaXRpb24gPSBjb25kaXRpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gdGhpcy5maW5kUGFyYW1ldGVyKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIHN3aXRjaCAoY29uZGl0aW9uLnByZWRpY2F0ZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9HUkVBVEVSX1RIQU46XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA+IGNvbmRpdGlvbi52YWx1ZSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBBTklNX0xFU1NfVEhBTjpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlIDwgY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEFOSU1fR1JFQVRFUl9USEFOX0VRVUFMX1RPOlxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwYXJhbWV0ZXIudmFsdWUgPj0gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEFOSU1fTEVTU19USEFOX0VRVUFMX1RPOlxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwYXJhbWV0ZXIudmFsdWUgPD0gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEFOSU1fRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA9PT0gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEFOSU1fTk9UX0VRVUFMX1RPOlxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwYXJhbWV0ZXIudmFsdWUgIT09IGNvbmRpdGlvbi52YWx1ZSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgX2ZpbmRUcmFuc2l0aW9uKGZyb20sIHRvKSB7XG4gICAgICAgIGxldCB0cmFuc2l0aW9ucyA9IFtdO1xuXG4gICAgICAgIC8vIElmIGZyb20gYW5kIHRvIGFyZSBzdXBwbGllZCwgZmluZCB0cmFuc2l0aW9ucyB0aGF0IGluY2x1ZGUgdGhlIHJlcXVpcmVkIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gc3RhdGVzXG4gICAgICAgIGlmIChmcm9tICYmIHRvKSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzKGZyb20sIHRvKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJZiBubyB0cmFuc2l0aW9uIGlzIGFjdGl2ZSwgbG9vayBmb3IgdHJhbnNpdGlvbnMgZnJvbSB0aGUgYWN0aXZlICYgYW55IHN0YXRlcy5cbiAgICAgICAgICAgIGlmICghdGhpcy5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX0FOWSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBPdGhlcndpc2UgbG9vayBmb3IgdHJhbnNpdGlvbnMgZnJvbSB0aGUgcHJldmlvdXMgYW5kIGFjdGl2ZSBzdGF0ZXMgYmFzZWQgb24gdGhlIGN1cnJlbnQgaW50ZXJydXB0aW9uIHNvdXJjZS5cbiAgICAgICAgICAgICAgICAvLyBBY2NlcHQgdHJhbnNpdGlvbnMgZnJvbSB0aGUgYW55IHN0YXRlIHVubGVzcyB0aGUgaW50ZXJydXB0aW9uIHNvdXJjZSBpcyBzZXQgdG8gbm9uZVxuICAgICAgICAgICAgICAgIHN3aXRjaCAodGhpcy5fdHJhbnNpdGlvbkludGVycnVwdGlvblNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEFOSU1fSU5URVJSVVBUSU9OX1BSRVY6XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX0FOWSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fTkVYVDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX0FOWSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fUFJFVl9ORVhUOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fYWN0aXZlU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUoQU5JTV9TVEFURV9BTlkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEFOSU1fSU5URVJSVVBUSU9OX05FWFRfUFJFVjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9OT05FOlxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZpbHRlciBvdXQgdHJhbnNpdGlvbnMgdGhhdCBkb24ndCBoYXZlIHRoZWlyIGNvbmRpdGlvbnMgbWV0XG4gICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuZmlsdGVyKCh0cmFuc2l0aW9uKSA9PiB7XG4gICAgICAgICAgICAvLyBpZiB0aGUgdHJhbnNpdGlvbiBpcyBtb3ZpbmcgdG8gdGhlIGFscmVhZHkgYWN0aXZlIHN0YXRlLCBpZ25vcmUgaXRcbiAgICAgICAgICAgIGlmICh0cmFuc2l0aW9uLnRvID09PSB0aGlzLmFjdGl2ZVN0YXRlTmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHdoZW4gYW4gZXhpdCB0aW1lIGlzIHByZXNlbnQsIHdlIHNob3VsZCBvbmx5IGV4aXQgaWYgaXQgZmFsbHMgd2l0aGluIHRoZSBjdXJyZW50IGZyYW1lIGRlbHRhIHRpbWVcbiAgICAgICAgICAgIGlmICh0cmFuc2l0aW9uLmhhc0V4aXRUaW1lKSB7XG4gICAgICAgICAgICAgICAgbGV0IHByb2dyZXNzQmVmb3JlID0gdGhpcy5fZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUodGhpcy5fdGltZUluU3RhdGVCZWZvcmUpO1xuICAgICAgICAgICAgICAgIGxldCBwcm9ncmVzcyA9IHRoaXMuX2dldEFjdGl2ZVN0YXRlUHJvZ3Jlc3NGb3JUaW1lKHRoaXMuX3RpbWVJblN0YXRlKTtcbiAgICAgICAgICAgICAgICAvLyB3aGVuIHRoZSBleGl0IHRpbWUgaXMgc21hbGxlciB0aGFuIDEgYW5kIHRoZSBzdGF0ZSBpcyBsb29waW5nLCB3ZSBzaG91bGQgY2hlY2sgZm9yIGFuIGV4aXQgZWFjaCBsb29wXG4gICAgICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24uZXhpdFRpbWUgPCAxLjAgJiYgdGhpcy5hY3RpdmVTdGF0ZS5sb29wKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzQmVmb3JlIC09IE1hdGguZmxvb3IocHJvZ3Jlc3NCZWZvcmUpO1xuICAgICAgICAgICAgICAgICAgICBwcm9ncmVzcyAtPSBNYXRoLmZsb29yKHByb2dyZXNzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gcmV0dXJuIGZhbHNlIGlmIGV4aXQgdGltZSBpc24ndCB3aXRoaW4gdGhlIGZyYW1lcyBkZWx0YSB0aW1lXG4gICAgICAgICAgICAgICAgaWYgKCEodHJhbnNpdGlvbi5leGl0VGltZSA+IHByb2dyZXNzQmVmb3JlICYmIHRyYW5zaXRpb24uZXhpdFRpbWUgPD0gcHJvZ3Jlc3MpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGlmIHRoZSBleGl0VGltZSBjb25kaXRpb24gaGFzIGJlZW4gbWV0IG9yIGlzIG5vdCBwcmVzZW50LCBjaGVjayBjb25kaXRpb24gcGFyYW1ldGVyc1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3RyYW5zaXRpb25IYXNDb25kaXRpb25zTWV0KHRyYW5zaXRpb24pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIGhpZ2hlc3QgcHJpb3JpdHkgdHJhbnNpdGlvbiB0byB1c2VcbiAgICAgICAgaWYgKHRyYW5zaXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zaXRpb24gPSB0cmFuc2l0aW9uc1swXTtcbiAgICAgICAgICAgIGlmICh0cmFuc2l0aW9uLnRvID09PSBBTklNX1NUQVRFX0VORCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0VHJhbnNpdGlvbiA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX1NUQVJUKVswXTtcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9uLnRvID0gc3RhcnRUcmFuc2l0aW9uLnRvO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRyYW5zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdXBkYXRlU3RhdGVGcm9tVHJhbnNpdGlvbih0cmFuc2l0aW9uKSB7XG4gICAgICAgIGxldCBzdGF0ZTtcbiAgICAgICAgbGV0IGFuaW1hdGlvbjtcbiAgICAgICAgbGV0IGNsaXA7XG4gICAgICAgIC8vIElmIHRyYW5zaXRpb24uZnJvbSBpcyBzZXQsIHRyYW5zaXRpb24gZnJvbSB0aGUgYWN0aXZlIHN0YXRlIGlycmVnYXJkbGVzcyBvZiB0aGUgdHJhbnNpdGlvbi5mcm9tIHZhbHVlICh0aGlzIGNvdWxkIGJlIHRoZSBwcmV2aW91cywgYWN0aXZlIG9yIEFOWSBzdGF0ZXMpLlxuICAgICAgICAvLyBPdGhlcndpc2UgdGhlIHByZXZpb3VzU3RhdGUgaXMgY2xlYXJlZC5cbiAgICAgICAgdGhpcy5wcmV2aW91c1N0YXRlID0gdHJhbnNpdGlvbi5mcm9tID8gdGhpcy5hY3RpdmVTdGF0ZU5hbWUgOiBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZVN0YXRlID0gdHJhbnNpdGlvbi50bztcblxuICAgICAgICAvLyB0dXJuIG9mZiBhbnkgdHJpZ2dlcnMgd2hpY2ggd2VyZSByZXF1aXJlZCB0byBhY3RpdmF0ZSB0aGlzIHRyYW5zaXRpb25cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmFuc2l0aW9uLmNvbmRpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IHRyYW5zaXRpb24uY29uZGl0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtZXRlciA9IHRoaXMuZmluZFBhcmFtZXRlcihjb25kaXRpb24ucGFyYW1ldGVyTmFtZSk7XG4gICAgICAgICAgICBpZiAocGFyYW1ldGVyLnR5cGUgPT09IEFOSU1fUEFSQU1FVEVSX1RSSUdHRVIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25zdW1lZFRyaWdnZXJzLmFkZChjb25kaXRpb24ucGFyYW1ldGVyTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5wcmV2aW91c1N0YXRlKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcyA9IFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZWNvcmQgdGhlIHRyYW5zaXRpb24gc291cmNlIHN0YXRlIGluIHRoZSBwcmV2aW91cyBzdGF0ZXMgYXJyYXlcbiAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSxcbiAgICAgICAgICAgICAgICB3ZWlnaHQ6IDFcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIG5ldyB0cmFuc2l0aW9uIHdhcyBhY3RpdmF0ZWQgZHVyaW5nIGFub3RoZXIgdHJhbnNpdGlvbiwgdXBkYXRlIHRoZSBwcmV2aW91cyB0cmFuc2l0aW9uIHN0YXRlIHdlaWdodHMgYmFzZWRcbiAgICAgICAgICAgIC8vIG9uIHRoZSBwcm9ncmVzcyB0aHJvdWdoIHRoZSBwcmV2aW91cyB0cmFuc2l0aW9uLlxuICAgICAgICAgICAgY29uc3QgaW50ZXJwb2xhdGVkVGltZSA9IE1hdGgubWluKHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgIT09IDAgPyB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgLyB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lIDogMSwgMS4wKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgLy8gaW50ZXJwb2xhdGUgdGhlIHdlaWdodHMgb2YgdGhlIG1vc3QgcmVjZW50IHByZXZpb3VzIHN0YXRlIGFuZCBhbGwgb3RoZXIgcHJldmlvdXMgc3RhdGVzIGJhc2VkIG9uIHRoZSBwcm9ncmVzcyB0aHJvdWdoIHRoZSBwcmV2aW91cyB0cmFuc2l0aW9uXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCA9IDEuMDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGkgIT09IHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS53ZWlnaHQgKj0gKDEuMCAtIGludGVycG9sYXRlZFRpbWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS53ZWlnaHQgPSBpbnRlcnBvbGF0ZWRUaW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMuX2ZpbmRTdGF0ZSh0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ubmFtZSk7XG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIHRoZSBhbmltYXRpb25zIG9mIHByZXZpb3VzIHN0YXRlcywgc2V0IHRoZWlyIG5hbWUgdG8gaW5jbHVkZSB0aGVpciBwb3NpdGlvbiBpbiB0aGUgcHJldmlvdXMgc3RhdGUgYXJyYXlcbiAgICAgICAgICAgICAgICAvLyB0byB1bmlxdWVseSBpZGVudGlmeSBhbmltYXRpb25zIGZyb20gdGhlIHNhbWUgc3RhdGUgdGhhdCB3ZXJlIGFkZGVkIGR1cmluZyBkaWZmZXJlbnQgdHJhbnNpdGlvbnNcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uID0gc3RhdGUuYW5pbWF0aW9uc1tqXTtcbiAgICAgICAgICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUgKyAnLnByZXZpb3VzLicgKyBpKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjbGlwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlwLm5hbWUgPSBhbmltYXRpb24ubmFtZSArICcucHJldmlvdXMuJyArIGk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gLy8gcGF1c2UgcHJldmlvdXMgYW5pbWF0aW9uIGNsaXBzIHRvIHJlZHVjZSB0aGVpciBpbXBhY3Qgb24gcGVyZm9ybWFuY2VcbiAgICAgICAgICAgICAgICAgICAgaWYgKGkgIT09IHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlwLnBhdXNlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lID0gdHJhbnNpdGlvbi50aW1lO1xuICAgICAgICB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgPSAwO1xuICAgICAgICB0aGlzLl90cmFuc2l0aW9uSW50ZXJydXB0aW9uU291cmNlID0gdHJhbnNpdGlvbi5pbnRlcnJ1cHRpb25Tb3VyY2U7XG5cblxuICAgICAgICBjb25zdCBhY3RpdmVTdGF0ZSA9IHRoaXMuYWN0aXZlU3RhdGU7XG4gICAgICAgIGNvbnN0IGhhc1RyYW5zaXRpb25PZmZzZXQgPSB0cmFuc2l0aW9uLnRyYW5zaXRpb25PZmZzZXQgJiYgdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0ID4gMC4wICYmIHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldCA8IDEuMDtcblxuICAgICAgICAvLyBzZXQgdGhlIHRpbWUgaW4gdGhlIG5ldyBzdGF0ZSB0byAwIG9yIHRvIGEgdmFsdWUgYmFzZWQgb24gdHJhbnNpdGlvbk9mZnNldCBpZiBvbmUgd2FzIGdpdmVuXG4gICAgICAgIGxldCB0aW1lSW5TdGF0ZSA9IDA7XG4gICAgICAgIGxldCB0aW1lSW5TdGF0ZUJlZm9yZSA9IDA7XG4gICAgICAgIGlmIChoYXNUcmFuc2l0aW9uT2Zmc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBvZmZzZXRUaW1lID0gYWN0aXZlU3RhdGUudGltZWxpbmVEdXJhdGlvbiAqIHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldDtcbiAgICAgICAgICAgIHRpbWVJblN0YXRlID0gb2Zmc2V0VGltZTtcbiAgICAgICAgICAgIHRpbWVJblN0YXRlQmVmb3JlID0gb2Zmc2V0VGltZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSA9IHRpbWVJblN0YXRlO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSA9IHRpbWVJblN0YXRlQmVmb3JlO1xuXG4gICAgICAgIC8vIEFkZCBjbGlwcyB0byB0aGUgZXZhbHVhdG9yIGZvciBlYWNoIGFuaW1hdGlvbiBpbiB0aGUgbmV3IHN0YXRlLlxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFjdGl2ZVN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFjdGl2ZVN0YXRlLmFuaW1hdGlvbnNbaV0ubmFtZSk7XG4gICAgICAgICAgICBpZiAoIWNsaXApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzcGVlZCA9IE51bWJlci5pc0Zpbml0ZShhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLnNwZWVkKSA/IGFjdGl2ZVN0YXRlLmFuaW1hdGlvbnNbaV0uc3BlZWQgOiBhY3RpdmVTdGF0ZS5zcGVlZDtcbiAgICAgICAgICAgICAgICBjbGlwID0gbmV3IEFuaW1DbGlwKGFjdGl2ZVN0YXRlLmFuaW1hdGlvbnNbaV0uYW5pbVRyYWNrLCB0aGlzLl90aW1lSW5TdGF0ZSwgc3BlZWQsIHRydWUsIGFjdGl2ZVN0YXRlLmxvb3AsIHRoaXMuX2V2ZW50SGFuZGxlcik7XG4gICAgICAgICAgICAgICAgY2xpcC5uYW1lID0gYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5uYW1lO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IuYWRkQ2xpcChjbGlwKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2xpcC5yZXNldCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24udGltZSA+IDApIHtcbiAgICAgICAgICAgICAgICBjbGlwLmJsZW5kV2VpZ2h0ID0gMC4wO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjbGlwLmJsZW5kV2VpZ2h0ID0gYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5ub3JtYWxpemVkV2VpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2xpcC5wbGF5KCk7XG4gICAgICAgICAgICBpZiAoaGFzVHJhbnNpdGlvbk9mZnNldCkge1xuICAgICAgICAgICAgICAgIGNsaXAudGltZSA9IGFjdGl2ZVN0YXRlLnRpbWVsaW5lRHVyYXRpb24gKiB0cmFuc2l0aW9uLnRyYW5zaXRpb25PZmZzZXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0VGltZSA9IGFjdGl2ZVN0YXRlLnNwZWVkID49IDAgPyAwIDogdGhpcy5hY3RpdmVTdGF0ZUR1cmF0aW9uO1xuICAgICAgICAgICAgICAgIGNsaXAudGltZSA9IHN0YXJ0VGltZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF90cmFuc2l0aW9uVG9TdGF0ZShuZXdTdGF0ZU5hbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9maW5kU3RhdGUobmV3U3RhdGVOYW1lKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbW92ZSB0byB0aGUgZ2l2ZW4gc3RhdGUsIGlmIGEgdHJhbnNpdGlvbiBpcyBwcmVzZW50IGluIHRoZSBzdGF0ZSBncmFwaCB1c2UgaXQuIE90aGVyd2lzZSBtb3ZlIGluc3RhbnRseSB0byBpdC5cbiAgICAgICAgbGV0IHRyYW5zaXRpb24gPSB0aGlzLl9maW5kVHJhbnNpdGlvbih0aGlzLl9hY3RpdmVTdGF0ZU5hbWUsIG5ld1N0YXRlTmFtZSk7XG4gICAgICAgIGlmICghdHJhbnNpdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci5yZW1vdmVDbGlwcygpO1xuICAgICAgICAgICAgdHJhbnNpdGlvbiA9IG5ldyBBbmltVHJhbnNpdGlvbih7IGZyb206IG51bGwsIHRvOiBuZXdTdGF0ZU5hbWUgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51cGRhdGVTdGF0ZUZyb21UcmFuc2l0aW9uKHRyYW5zaXRpb24pO1xuICAgIH1cblxuICAgIGFzc2lnbkFuaW1hdGlvbihwYXRoU3RyaW5nLCBhbmltVHJhY2ssIHNwZWVkLCBsb29wKSB7XG4gICAgICAgIGNvbnN0IHBhdGggPSBwYXRoU3RyaW5nLnNwbGl0KCcuJyk7XG4gICAgICAgIGxldCBzdGF0ZSA9IHRoaXMuX2ZpbmRTdGF0ZShwYXRoWzBdKTtcbiAgICAgICAgaWYgKCFzdGF0ZSkge1xuICAgICAgICAgICAgc3RhdGUgPSBuZXcgQW5pbVN0YXRlKHRoaXMsIHBhdGhbMF0sIDEuMCk7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZXNbcGF0aFswXV0gPSBzdGF0ZTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlTmFtZXMucHVzaChwYXRoWzBdKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5hZGRBbmltYXRpb24ocGF0aCwgYW5pbVRyYWNrKTtcbiAgICAgICAgaWYgKHNwZWVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHN0YXRlLnNwZWVkID0gc3BlZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxvb3AgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3RhdGUubG9vcCA9IGxvb3A7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuX3BsYXlpbmcgJiYgdGhpcy5fYWN0aXZhdGUgJiYgdGhpcy5wbGF5YWJsZSkge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVOb2RlQW5pbWF0aW9ucyhub2RlTmFtZSkge1xuICAgICAgICBpZiAoQU5JTV9DT05UUk9MX1NUQVRFUy5pbmRleE9mKG5vZGVOYW1lKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzdGF0ZSA9IHRoaXMuX2ZpbmRTdGF0ZShub2RlTmFtZSk7XG4gICAgICAgIGlmICghc3RhdGUpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdBdHRlbXB0aW5nIHRvIHVuYXNzaWduIGFuaW1hdGlvbiB0cmFja3MgZnJvbSBhIHN0YXRlIHRoYXQgZG9lcyBub3QgZXhpc3QuJyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZS5hbmltYXRpb25zID0gW107XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHBsYXkoc3RhdGVOYW1lKSB7XG4gICAgICAgIGlmIChzdGF0ZU5hbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25Ub1N0YXRlKHN0YXRlTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcGxheWluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICByZXNldCgpIHtcbiAgICAgICAgdGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUgPSBudWxsO1xuICAgICAgICB0aGlzLl9hY3RpdmVTdGF0ZU5hbWUgPSBBTklNX1NUQVRFX1NUQVJUO1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlID0gMDtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGVCZWZvcmUgPSAwO1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXBzKCk7XG4gICAgfVxuXG4gICAgcmViaW5kKCkge1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlYmluZCgpO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBpZiAoIXRoaXMuX3BsYXlpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc3RhdGU7XG4gICAgICAgIGxldCBhbmltYXRpb247XG4gICAgICAgIGxldCBjbGlwO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSA9IHRoaXMuX3RpbWVJblN0YXRlO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSArPSBkdDtcblxuICAgICAgICAvLyB0cmFuc2l0aW9uIGJldHdlZW4gc3RhdGVzIGlmIGEgdHJhbnNpdGlvbiBpcyBhdmFpbGFibGUgZnJvbSB0aGUgYWN0aXZlIHN0YXRlXG4gICAgICAgIGNvbnN0IHRyYW5zaXRpb24gPSB0aGlzLl9maW5kVHJhbnNpdGlvbih0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpO1xuICAgICAgICBpZiAodHJhbnNpdGlvbilcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdGVGcm9tVHJhbnNpdGlvbih0cmFuc2l0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgKz0gZHQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fY3VyclRyYW5zaXRpb25UaW1lIDw9IHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnRlcnBvbGF0ZWRUaW1lID0gdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSAhPT0gMCA/IHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSAvIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgOiAxO1xuICAgICAgICAgICAgICAgIC8vIHdoaWxlIHRyYW5zaXRpb25pbmcsIHNldCBhbGwgcHJldmlvdXMgc3RhdGUgYW5pbWF0aW9ucyB0byBiZSB3ZWlnaHRlZCBieSAoMS4wIC0gaW50ZXJwb2xhdGlvblRpbWUpLlxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVXZWlnaHQgPSB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ud2VpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuaW1hdGlvbiA9IHN0YXRlLmFuaW1hdGlvbnNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSArICcucHJldmlvdXMuJyArIGkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlwLmJsZW5kV2VpZ2h0ID0gKDEuMCAtIGludGVycG9sYXRlZFRpbWUpICogYW5pbWF0aW9uLm5vcm1hbGl6ZWRXZWlnaHQgKiBzdGF0ZVdlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyB3aGlsZSB0cmFuc2l0aW9uaW5nLCBzZXQgYWN0aXZlIHN0YXRlIGFuaW1hdGlvbnMgdG8gYmUgd2VpZ2h0ZWQgYnkgKGludGVycG9sYXRpb25UaW1lKS5cbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMuYWN0aXZlU3RhdGU7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0ZS5hbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGFuaW1hdGlvbiA9IHN0YXRlLmFuaW1hdGlvbnNbaV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUpLmJsZW5kV2VpZ2h0ID0gaW50ZXJwb2xhdGVkVGltZSAqIGFuaW1hdGlvbi5ub3JtYWxpemVkV2VpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgLy8gd2hlbiBhIHRyYW5zaXRpb24gZW5kcywgcmVtb3ZlIGFsbCBwcmV2aW91cyBzdGF0ZSBjbGlwcyBmcm9tIHRoZSBldmFsdWF0b3JcbiAgICAgICAgICAgICAgICBjb25zdCBhY3RpdmVDbGlwcyA9IHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBjb25zdCB0b3RhbENsaXBzID0gdGhpcy5fYW5pbUV2YWx1YXRvci5jbGlwcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b3RhbENsaXBzIC0gYWN0aXZlQ2xpcHM7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXAoMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcyA9IFtdO1xuICAgICAgICAgICAgICAgIC8vIHdoZW4gYSB0cmFuc2l0aW9uIGVuZHMsIHNldCB0aGUgYWN0aXZlIHN0YXRlIGNsaXAgd2VpZ2h0cyBzbyB0aGV5IHN1bSB0byAxXG4gICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLmFjdGl2ZVN0YXRlO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2ldO1xuICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjbGlwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlwLmJsZW5kV2VpZ2h0ID0gYW5pbWF0aW9uLm5vcm1hbGl6ZWRXZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5hY3RpdmVTdGF0ZS5fYmxlbmRUcmVlLmNvbnN0cnVjdG9yICE9PSBBbmltTm9kZSkge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uID0gc3RhdGUuYW5pbWF0aW9uc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2xpcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xpcC5ibGVuZFdlaWdodCA9IGFuaW1hdGlvbi5ub3JtYWxpemVkV2VpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFuaW1hdGlvbi5wYXJlbnQuc3luY0FuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlwLnNwZWVkID0gYW5pbWF0aW9uLnNwZWVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IudXBkYXRlKGR0KTtcbiAgICB9XG5cbiAgICBmaW5kUGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcmFtZXRlcnNbbmFtZV07XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltQ29udHJvbGxlciB9O1xuIl0sIm5hbWVzIjpbIkFuaW1Db250cm9sbGVyIiwiY29uc3RydWN0b3IiLCJhbmltRXZhbHVhdG9yIiwic3RhdGVzIiwidHJhbnNpdGlvbnMiLCJwYXJhbWV0ZXJzIiwiYWN0aXZhdGUiLCJldmVudEhhbmRsZXIiLCJjb25zdW1lZFRyaWdnZXJzIiwiX2FuaW1FdmFsdWF0b3IiLCJfc3RhdGVzIiwiX3N0YXRlTmFtZXMiLCJfZXZlbnRIYW5kbGVyIiwiX2NvbnN1bWVkVHJpZ2dlcnMiLCJpIiwibGVuZ3RoIiwibmFtZSIsIkFuaW1TdGF0ZSIsInNwZWVkIiwibG9vcCIsImJsZW5kVHJlZSIsInB1c2giLCJfdHJhbnNpdGlvbnMiLCJtYXAiLCJ0cmFuc2l0aW9uIiwiQW5pbVRyYW5zaXRpb24iLCJfZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlQ2FjaGUiLCJfZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlc0NhY2hlIiwiX3BhcmFtZXRlcnMiLCJfcHJldmlvdXNTdGF0ZU5hbWUiLCJfYWN0aXZlU3RhdGVOYW1lIiwiQU5JTV9TVEFURV9TVEFSVCIsIl9wbGF5aW5nIiwiX2FjdGl2YXRlIiwiX2N1cnJUcmFuc2l0aW9uVGltZSIsIl90b3RhbFRyYW5zaXRpb25UaW1lIiwiX2lzVHJhbnNpdGlvbmluZyIsIl90cmFuc2l0aW9uSW50ZXJydXB0aW9uU291cmNlIiwiQU5JTV9JTlRFUlJVUFRJT05fTk9ORSIsIl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMiLCJfdGltZUluU3RhdGUiLCJfdGltZUluU3RhdGVCZWZvcmUiLCJhY3RpdmVTdGF0ZSIsInN0YXRlTmFtZSIsIl9maW5kU3RhdGUiLCJhY3RpdmVTdGF0ZU5hbWUiLCJhY3RpdmVTdGF0ZUFuaW1hdGlvbnMiLCJhbmltYXRpb25zIiwicHJldmlvdXNTdGF0ZSIsInByZXZpb3VzU3RhdGVOYW1lIiwicGxheWFibGUiLCJwbGF5aW5nIiwidmFsdWUiLCJhY3RpdmVTdGF0ZVByb2dyZXNzIiwiX2dldEFjdGl2ZVN0YXRlUHJvZ3Jlc3NGb3JUaW1lIiwiYWN0aXZlU3RhdGVEdXJhdGlvbiIsIkFOSU1fU1RBVEVfRU5EIiwibWF4RHVyYXRpb24iLCJhY3RpdmVDbGlwIiwiZmluZENsaXAiLCJNYXRoIiwibWF4IiwidHJhY2siLCJkdXJhdGlvbiIsImFjdGl2ZVN0YXRlQ3VycmVudFRpbWUiLCJ0aW1lIiwiY2xpcCIsInRyYW5zaXRpb25pbmciLCJ0cmFuc2l0aW9uUHJvZ3Jlc3MiLCJhc3NpZ25NYXNrIiwibWFzayIsIkFOSU1fU1RBVEVfQU5ZIiwiX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSIsImZpbHRlciIsImZyb20iLCJzb3J0UHJpb3JpdHkiLCJfZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlcyIsInNvdXJjZVN0YXRlTmFtZSIsImRlc3RpbmF0aW9uU3RhdGVOYW1lIiwidG8iLCJfdHJhbnNpdGlvbkhhc0NvbmRpdGlvbnNNZXQiLCJjb25kaXRpb25zIiwiY29uZGl0aW9uIiwicGFyYW1ldGVyIiwiZmluZFBhcmFtZXRlciIsInBhcmFtZXRlck5hbWUiLCJwcmVkaWNhdGUiLCJBTklNX0dSRUFURVJfVEhBTiIsIkFOSU1fTEVTU19USEFOIiwiQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE8iLCJBTklNX0xFU1NfVEhBTl9FUVVBTF9UTyIsIkFOSU1fRVFVQUxfVE8iLCJBTklNX05PVF9FUVVBTF9UTyIsIl9maW5kVHJhbnNpdGlvbiIsImNvbmNhdCIsIkFOSU1fSU5URVJSVVBUSU9OX1BSRVYiLCJBTklNX0lOVEVSUlVQVElPTl9ORVhUIiwiQU5JTV9JTlRFUlJVUFRJT05fUFJFVl9ORVhUIiwiQU5JTV9JTlRFUlJVUFRJT05fTkVYVF9QUkVWIiwiaGFzRXhpdFRpbWUiLCJwcm9ncmVzc0JlZm9yZSIsInByb2dyZXNzIiwiZXhpdFRpbWUiLCJmbG9vciIsInN0YXJ0VHJhbnNpdGlvbiIsInVwZGF0ZVN0YXRlRnJvbVRyYW5zaXRpb24iLCJzdGF0ZSIsImFuaW1hdGlvbiIsInR5cGUiLCJBTklNX1BBUkFNRVRFUl9UUklHR0VSIiwiYWRkIiwid2VpZ2h0IiwiaW50ZXJwb2xhdGVkVGltZSIsIm1pbiIsImoiLCJwYXVzZSIsImludGVycnVwdGlvblNvdXJjZSIsImhhc1RyYW5zaXRpb25PZmZzZXQiLCJ0cmFuc2l0aW9uT2Zmc2V0IiwidGltZUluU3RhdGUiLCJ0aW1lSW5TdGF0ZUJlZm9yZSIsIm9mZnNldFRpbWUiLCJ0aW1lbGluZUR1cmF0aW9uIiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJBbmltQ2xpcCIsImFuaW1UcmFjayIsImFkZENsaXAiLCJyZXNldCIsImJsZW5kV2VpZ2h0Iiwibm9ybWFsaXplZFdlaWdodCIsInBsYXkiLCJzdGFydFRpbWUiLCJfdHJhbnNpdGlvblRvU3RhdGUiLCJuZXdTdGF0ZU5hbWUiLCJyZW1vdmVDbGlwcyIsImFzc2lnbkFuaW1hdGlvbiIsInBhdGhTdHJpbmciLCJwYXRoIiwic3BsaXQiLCJhZGRBbmltYXRpb24iLCJ1bmRlZmluZWQiLCJyZW1vdmVOb2RlQW5pbWF0aW9ucyIsIm5vZGVOYW1lIiwiQU5JTV9DT05UUk9MX1NUQVRFUyIsImluZGV4T2YiLCJEZWJ1ZyIsImVycm9yIiwicmViaW5kIiwidXBkYXRlIiwiZHQiLCJzdGF0ZVdlaWdodCIsImFjdGl2ZUNsaXBzIiwidG90YWxDbGlwcyIsImNsaXBzIiwicmVtb3ZlQ2xpcCIsIl9ibGVuZFRy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
