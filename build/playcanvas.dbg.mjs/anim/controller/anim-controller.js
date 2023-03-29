/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { extends as _extends } from '../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../core/debug.js';
import { sortPriority } from '../../core/sort.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1jb250cm9sbGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYW5pbS9jb250cm9sbGVyL2FuaW0tY29udHJvbGxlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgc29ydFByaW9yaXR5IH0gZnJvbSAnLi4vLi4vY29yZS9zb3J0LmpzJztcbmltcG9ydCB7IEFuaW1DbGlwIH0gZnJvbSAnLi4vZXZhbHVhdG9yL2FuaW0tY2xpcC5qcyc7XG5pbXBvcnQgeyBBbmltU3RhdGUgfSBmcm9tICcuL2FuaW0tc3RhdGUuanMnO1xuaW1wb3J0IHsgQW5pbU5vZGUgfSBmcm9tICcuL2FuaW0tbm9kZS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhbnNpdGlvbiB9IGZyb20gJy4vYW5pbS10cmFuc2l0aW9uLmpzJztcbmltcG9ydCB7XG4gICAgQU5JTV9HUkVBVEVSX1RIQU4sIEFOSU1fTEVTU19USEFOLCBBTklNX0dSRUFURVJfVEhBTl9FUVVBTF9UTywgQU5JTV9MRVNTX1RIQU5fRVFVQUxfVE8sIEFOSU1fRVFVQUxfVE8sIEFOSU1fTk9UX0VRVUFMX1RPLFxuICAgIEFOSU1fSU5URVJSVVBUSU9OX05PTkUsIEFOSU1fSU5URVJSVVBUSU9OX1BSRVYsIEFOSU1fSU5URVJSVVBUSU9OX05FWFQsIEFOSU1fSU5URVJSVVBUSU9OX1BSRVZfTkVYVCwgQU5JTV9JTlRFUlJVUFRJT05fTkVYVF9QUkVWLFxuICAgIEFOSU1fUEFSQU1FVEVSX1RSSUdHRVIsXG4gICAgQU5JTV9TVEFURV9TVEFSVCwgQU5JTV9TVEFURV9FTkQsIEFOSU1fU1RBVEVfQU5ZLCBBTklNX0NPTlRST0xfU1RBVEVTXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcycpLkV2ZW50SGFuZGxlcn0gRXZlbnRIYW5kbGVyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZXZhbHVhdG9yL2FuaW0tZXZhbHVhdG9yLmpzJykuQW5pbUV2YWx1YXRvcn0gQW5pbUV2YWx1YXRvciAqL1xuXG4vKipcbiAqIFRoZSBBbmltQ29udHJvbGxlciBtYW5hZ2VzIHRoZSBhbmltYXRpb25zIGZvciBpdHMgZW50aXR5LCBiYXNlZCBvbiB0aGUgcHJvdmlkZWQgc3RhdGUgZ3JhcGggYW5kXG4gKiBwYXJhbWV0ZXJzLiBJdHMgdXBkYXRlIG1ldGhvZCBkZXRlcm1pbmVzIHdoaWNoIHN0YXRlIHRoZSBjb250cm9sbGVyIHNob3VsZCBiZSBpbiBiYXNlZCBvbiB0aGVcbiAqIGN1cnJlbnQgdGltZSwgcGFyYW1ldGVycyBhbmQgYXZhaWxhYmxlIHN0YXRlcyAvIHRyYW5zaXRpb25zLiBJdCBhbHNvIGVuc3VyZXMgdGhlIEFuaW1FdmFsdWF0b3JcbiAqIGlzIHN1cHBsaWVkIHdpdGggdGhlIGNvcnJlY3QgYW5pbWF0aW9ucywgYmFzZWQgb24gdGhlIGN1cnJlbnRseSBhY3RpdmUgc3RhdGUuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBBbmltQ29udHJvbGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEFuaW1Db250cm9sbGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBbmltRXZhbHVhdG9yfSBhbmltRXZhbHVhdG9yIC0gVGhlIGFuaW1hdGlvbiBldmFsdWF0b3IgdXNlZCB0byBibGVuZCBhbGwgY3VycmVudFxuICAgICAqIHBsYXlpbmcgYW5pbWF0aW9uIGtleWZyYW1lcyBhbmQgdXBkYXRlIHRoZSBlbnRpdGllcyBwcm9wZXJ0aWVzIGJhc2VkIG9uIHRoZSBjdXJyZW50XG4gICAgICogYW5pbWF0aW9uIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0ge29iamVjdFtdfSBzdGF0ZXMgLSBUaGUgbGlzdCBvZiBzdGF0ZXMgdXNlZCB0byBmb3JtIHRoZSBjb250cm9sbGVyIHN0YXRlIGdyYXBoLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0W119IHRyYW5zaXRpb25zIC0gVGhlIGxpc3Qgb2YgdHJhbnNpdGlvbnMgdXNlZCB0byBmb3JtIHRoZSBjb250cm9sbGVyIHN0YXRlXG4gICAgICogZ3JhcGguXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gcGFyYW1ldGVycyAtIFRoZSBhbmltIGNvbXBvbmVudHMgcGFyYW1ldGVycy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGFjdGl2YXRlIC0gRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBhbmltIGNvbnRyb2xsZXIgc2hvdWxkIGF1dG9tYXRpY2FsbHkgcGxheVxuICAgICAqIG9uY2UgYWxsIHtAbGluayBBbmltTm9kZXN9IGFyZSBhc3NpZ25lZCBhbmltYXRpb25zLlxuICAgICAqIEBwYXJhbSB7RXZlbnRIYW5kbGVyfSBldmVudEhhbmRsZXIgLSBUaGUgZXZlbnQgaGFuZGxlciB3aGljaCBzaG91bGQgYmUgbm90aWZpZWQgd2l0aCBhbmltXG4gICAgICogZXZlbnRzLlxuICAgICAqIEBwYXJhbSB7U2V0fSBjb25zdW1lZFRyaWdnZXJzIC0gVXNlZCB0byBzZXQgdHJpZ2dlcnMgYmFjayB0byB0aGVpciBkZWZhdWx0IHN0YXRlIGFmdGVyIHRoZXlcbiAgICAgKiBoYXZlIGJlZW4gY29uc3VtZWQgYnkgYSB0cmFuc2l0aW9uLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFuaW1FdmFsdWF0b3IsIHN0YXRlcywgdHJhbnNpdGlvbnMsIHBhcmFtZXRlcnMsIGFjdGl2YXRlLCBldmVudEhhbmRsZXIsIGNvbnN1bWVkVHJpZ2dlcnMpIHtcbiAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvciA9IGFuaW1FdmFsdWF0b3I7XG4gICAgICAgIHRoaXMuX3N0YXRlcyA9IHt9O1xuICAgICAgICB0aGlzLl9zdGF0ZU5hbWVzID0gW107XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlciA9IGV2ZW50SGFuZGxlcjtcbiAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2VycyA9IGNvbnN1bWVkVHJpZ2dlcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZXNbc3RhdGVzW2ldLm5hbWVdID0gbmV3IEFuaW1TdGF0ZShcbiAgICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAgIHN0YXRlc1tpXS5uYW1lLFxuICAgICAgICAgICAgICAgIHN0YXRlc1tpXS5zcGVlZCxcbiAgICAgICAgICAgICAgICBzdGF0ZXNbaV0ubG9vcCxcbiAgICAgICAgICAgICAgICBzdGF0ZXNbaV0uYmxlbmRUcmVlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVOYW1lcy5wdXNoKHN0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl90cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLm1hcCgodHJhbnNpdGlvbikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBbmltVHJhbnNpdGlvbih7XG4gICAgICAgICAgICAgICAgLi4udHJhbnNpdGlvblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZSA9IHt9O1xuICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGUgPSB7fTtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHBhcmFtZXRlcnM7XG4gICAgICAgIHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYWN0aXZlU3RhdGVOYW1lID0gQU5JTV9TVEFURV9TVEFSVDtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hY3RpdmF0ZSA9IGFjdGl2YXRlO1xuXG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UgPSBBTklNX0lOVEVSUlVQVElPTl9OT05FO1xuICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMgPSBbXTtcblxuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSA9IDA7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gMDtcbiAgICB9XG5cbiAgICBnZXQgYW5pbUV2YWx1YXRvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1FdmFsdWF0b3I7XG4gICAgfVxuXG4gICAgc2V0IGFjdGl2ZVN0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICB0aGlzLl9hY3RpdmVTdGF0ZU5hbWUgPSBzdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmluZFN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlTmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVN0YXRlTmFtZTtcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVBbmltYXRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hY3RpdmVTdGF0ZS5hbmltYXRpb25zO1xuICAgIH1cblxuICAgIHNldCBwcmV2aW91c1N0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICB0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSA9IHN0YXRlTmFtZTtcbiAgICB9XG5cbiAgICBnZXQgcHJldmlvdXNTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbmRTdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0IHByZXZpb3VzU3RhdGVOYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJldmlvdXNTdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IHBsYXlhYmxlKCkge1xuICAgICAgICBsZXQgcGxheWFibGUgPSB0cnVlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3N0YXRlTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc3RhdGVzW3RoaXMuX3N0YXRlTmFtZXNbaV1dLnBsYXlhYmxlKSB7XG4gICAgICAgICAgICAgICAgcGxheWFibGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGxheWFibGU7XG4gICAgfVxuXG4gICAgc2V0IHBsYXlpbmcodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBwbGF5aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGxheWluZztcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVQcm9ncmVzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEFjdGl2ZVN0YXRlUHJvZ3Jlc3NGb3JUaW1lKHRoaXMuX3RpbWVJblN0YXRlKTtcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVEdXJhdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX1NUQVJUIHx8IHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX0VORClcbiAgICAgICAgICAgIHJldHVybiAwLjA7XG5cbiAgICAgICAgbGV0IG1heER1cmF0aW9uID0gMC4wO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBhY3RpdmVDbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcCh0aGlzLmFjdGl2ZVN0YXRlQW5pbWF0aW9uc1tpXS5uYW1lKTtcbiAgICAgICAgICAgIGlmIChhY3RpdmVDbGlwKSB7XG4gICAgICAgICAgICAgICAgbWF4RHVyYXRpb24gPSBNYXRoLm1heChtYXhEdXJhdGlvbiwgYWN0aXZlQ2xpcC50cmFjay5kdXJhdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1heER1cmF0aW9uO1xuICAgIH1cblxuICAgIHNldCBhY3RpdmVTdGF0ZUN1cnJlbnRUaW1lKHRpbWUpIHtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGVCZWZvcmUgPSB0aW1lO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSA9IHRpbWU7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNsaXAgPSB0aGlzLmFuaW1FdmFsdWF0b3IuZmluZENsaXAodGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnNbaV0ubmFtZSk7XG4gICAgICAgICAgICBpZiAoY2xpcCkge1xuICAgICAgICAgICAgICAgIGNsaXAudGltZSA9IHRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVDdXJyZW50VGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbWVJblN0YXRlO1xuICAgIH1cblxuICAgIGdldCB0cmFuc2l0aW9uaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNUcmFuc2l0aW9uaW5nO1xuICAgIH1cblxuICAgIGdldCB0cmFuc2l0aW9uUHJvZ3Jlc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgLyB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lO1xuICAgIH1cblxuICAgIGdldCBzdGF0ZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZU5hbWVzO1xuICAgIH1cblxuICAgIGFzc2lnbk1hc2sobWFzaykge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pbUV2YWx1YXRvci5hc3NpZ25NYXNrKG1hc2spO1xuICAgIH1cblxuICAgIF9maW5kU3RhdGUoc3RhdGVOYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZXNbc3RhdGVOYW1lXTtcbiAgICB9XG5cbiAgICBfZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUodGltZSkge1xuICAgICAgICBpZiAodGhpcy5hY3RpdmVTdGF0ZU5hbWUgPT09IEFOSU1fU1RBVEVfU1RBUlQgfHwgdGhpcy5hY3RpdmVTdGF0ZU5hbWUgPT09IEFOSU1fU1RBVEVfRU5EIHx8IHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX0FOWSlcbiAgICAgICAgICAgIHJldHVybiAxLjA7XG5cbiAgICAgICAgY29uc3QgYWN0aXZlQ2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAodGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnNbMF0ubmFtZSk7XG4gICAgICAgIGlmIChhY3RpdmVDbGlwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGltZSAvIGFjdGl2ZUNsaXAudHJhY2suZHVyYXRpb247XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYWxsIHRoZSB0cmFuc2l0aW9ucyB0aGF0IGhhdmUgdGhlIGdpdmVuIHN0YXRlTmFtZSBhcyB0aGVpciBzb3VyY2Ugc3RhdGVcbiAgICBfZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICBsZXQgdHJhbnNpdGlvbnMgPSB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZVtzdGF0ZU5hbWVdO1xuICAgICAgICBpZiAoIXRyYW5zaXRpb25zKSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRoaXMuX3RyYW5zaXRpb25zLmZpbHRlcihmdW5jdGlvbiAodHJhbnNpdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cmFuc2l0aW9uLmZyb20gPT09IHN0YXRlTmFtZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBzb3J0IHRyYW5zaXRpb25zIGluIHByaW9yaXR5IG9yZGVyXG4gICAgICAgICAgICBzb3J0UHJpb3JpdHkodHJhbnNpdGlvbnMpO1xuXG4gICAgICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZVtzdGF0ZU5hbWVdID0gdHJhbnNpdGlvbnM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRyYW5zaXRpb25zO1xuICAgIH1cblxuICAgIC8vIHJldHVybiBhbGwgdGhlIHRyYW5zaXRpb25zIHRoYXQgY29udGFpbiB0aGUgZ2l2ZW4gc291cmNlIGFuZCBkZXN0aW5hdGlvbiBzdGF0ZXNcbiAgICBfZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlcyhzb3VyY2VTdGF0ZU5hbWUsIGRlc3RpbmF0aW9uU3RhdGVOYW1lKSB7XG4gICAgICAgIGxldCB0cmFuc2l0aW9ucyA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXNDYWNoZVtzb3VyY2VTdGF0ZU5hbWUgKyAnLT4nICsgZGVzdGluYXRpb25TdGF0ZU5hbWVdO1xuICAgICAgICBpZiAoIXRyYW5zaXRpb25zKSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRoaXMuX3RyYW5zaXRpb25zLmZpbHRlcihmdW5jdGlvbiAodHJhbnNpdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cmFuc2l0aW9uLmZyb20gPT09IHNvdXJjZVN0YXRlTmFtZSAmJiB0cmFuc2l0aW9uLnRvID09PSBkZXN0aW5hdGlvblN0YXRlTmFtZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBzb3J0IHRyYW5zaXRpb25zIGluIHByaW9yaXR5IG9yZGVyXG4gICAgICAgICAgICBzb3J0UHJpb3JpdHkodHJhbnNpdGlvbnMpO1xuXG4gICAgICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGVbc291cmNlU3RhdGVOYW1lICsgJy0+JyArIGRlc3RpbmF0aW9uU3RhdGVOYW1lXSA9IHRyYW5zaXRpb25zO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cmFuc2l0aW9ucztcbiAgICB9XG5cbiAgICBfdHJhbnNpdGlvbkhhc0NvbmRpdGlvbnNNZXQodHJhbnNpdGlvbikge1xuICAgICAgICBjb25zdCBjb25kaXRpb25zID0gdHJhbnNpdGlvbi5jb25kaXRpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbmRpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IGNvbmRpdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXIgPSB0aGlzLmZpbmRQYXJhbWV0ZXIoY29uZGl0aW9uLnBhcmFtZXRlck5hbWUpO1xuICAgICAgICAgICAgc3dpdGNoIChjb25kaXRpb24ucHJlZGljYXRlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBBTklNX0dSRUFURVJfVEhBTjpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlID4gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEFOSU1fTEVTU19USEFOOlxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwYXJhbWV0ZXIudmFsdWUgPCBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA+PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9MRVNTX1RIQU5fRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA8PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9FUVVBTF9UTzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlID09PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9OT1RfRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSAhPT0gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBfZmluZFRyYW5zaXRpb24oZnJvbSwgdG8pIHtcbiAgICAgICAgbGV0IHRyYW5zaXRpb25zID0gW107XG5cbiAgICAgICAgLy8gSWYgZnJvbSBhbmQgdG8gYXJlIHN1cHBsaWVkLCBmaW5kIHRyYW5zaXRpb25zIHRoYXQgaW5jbHVkZSB0aGUgcmVxdWlyZWQgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBzdGF0ZXNcbiAgICAgICAgaWYgKGZyb20gJiYgdG8pIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXMoZnJvbSwgdG8pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIElmIG5vIHRyYW5zaXRpb24gaXMgYWN0aXZlLCBsb29rIGZvciB0cmFuc2l0aW9ucyBmcm9tIHRoZSBhY3RpdmUgJiBhbnkgc3RhdGVzLlxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fYWN0aXZlU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSBsb29rIGZvciB0cmFuc2l0aW9ucyBmcm9tIHRoZSBwcmV2aW91cyBhbmQgYWN0aXZlIHN0YXRlcyBiYXNlZCBvbiB0aGUgY3VycmVudCBpbnRlcnJ1cHRpb24gc291cmNlLlxuICAgICAgICAgICAgICAgIC8vIEFjY2VwdCB0cmFuc2l0aW9ucyBmcm9tIHRoZSBhbnkgc3RhdGUgdW5sZXNzIHRoZSBpbnRlcnJ1cHRpb24gc291cmNlIGlzIHNldCB0byBub25lXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLl90cmFuc2l0aW9uSW50ZXJydXB0aW9uU291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fUFJFVjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9ORVhUOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQ6XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX0FOWSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fTkVYVF9QUkVWOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUoQU5JTV9TVEFURV9BTlkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEFOSU1fSU5URVJSVVBUSU9OX05PTkU6XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmlsdGVyIG91dCB0cmFuc2l0aW9ucyB0aGF0IGRvbid0IGhhdmUgdGhlaXIgY29uZGl0aW9ucyBtZXRcbiAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5maWx0ZXIoKHRyYW5zaXRpb24pID0+IHtcbiAgICAgICAgICAgIC8vIGlmIHRoZSB0cmFuc2l0aW9uIGlzIG1vdmluZyB0byB0aGUgYWxyZWFkeSBhY3RpdmUgc3RhdGUsIGlnbm9yZSBpdFxuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24udG8gPT09IHRoaXMuYWN0aXZlU3RhdGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gd2hlbiBhbiBleGl0IHRpbWUgaXMgcHJlc2VudCwgd2Ugc2hvdWxkIG9ubHkgZXhpdCBpZiBpdCBmYWxscyB3aXRoaW4gdGhlIGN1cnJlbnQgZnJhbWUgZGVsdGEgdGltZVxuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24uaGFzRXhpdFRpbWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgcHJvZ3Jlc3NCZWZvcmUgPSB0aGlzLl9nZXRBY3RpdmVTdGF0ZVByb2dyZXNzRm9yVGltZSh0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSk7XG4gICAgICAgICAgICAgICAgbGV0IHByb2dyZXNzID0gdGhpcy5fZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUodGhpcy5fdGltZUluU3RhdGUpO1xuICAgICAgICAgICAgICAgIC8vIHdoZW4gdGhlIGV4aXQgdGltZSBpcyBzbWFsbGVyIHRoYW4gMSBhbmQgdGhlIHN0YXRlIGlzIGxvb3BpbmcsIHdlIHNob3VsZCBjaGVjayBmb3IgYW4gZXhpdCBlYWNoIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodHJhbnNpdGlvbi5leGl0VGltZSA8IDEuMCAmJiB0aGlzLmFjdGl2ZVN0YXRlLmxvb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NCZWZvcmUgLT0gTWF0aC5mbG9vcihwcm9ncmVzc0JlZm9yZSk7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzIC09IE1hdGguZmxvb3IocHJvZ3Jlc3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gZmFsc2UgaWYgZXhpdCB0aW1lIGlzbid0IHdpdGhpbiB0aGUgZnJhbWVzIGRlbHRhIHRpbWVcbiAgICAgICAgICAgICAgICBpZiAoISh0cmFuc2l0aW9uLmV4aXRUaW1lID4gcHJvZ3Jlc3NCZWZvcmUgJiYgdHJhbnNpdGlvbi5leGl0VGltZSA8PSBwcm9ncmVzcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaWYgdGhlIGV4aXRUaW1lIGNvbmRpdGlvbiBoYXMgYmVlbiBtZXQgb3IgaXMgbm90IHByZXNlbnQsIGNoZWNrIGNvbmRpdGlvbiBwYXJhbWV0ZXJzXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdHJhbnNpdGlvbkhhc0NvbmRpdGlvbnNNZXQodHJhbnNpdGlvbik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGUgaGlnaGVzdCBwcmlvcml0eSB0cmFuc2l0aW9uIHRvIHVzZVxuICAgICAgICBpZiAodHJhbnNpdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgdHJhbnNpdGlvbiA9IHRyYW5zaXRpb25zWzBdO1xuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24udG8gPT09IEFOSU1fU1RBVEVfRU5EKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRUcmFuc2l0aW9uID0gdGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfU1RBUlQpWzBdO1xuICAgICAgICAgICAgICAgIHRyYW5zaXRpb24udG8gPSBzdGFydFRyYW5zaXRpb24udG87XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJhbnNpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB1cGRhdGVTdGF0ZUZyb21UcmFuc2l0aW9uKHRyYW5zaXRpb24pIHtcbiAgICAgICAgbGV0IHN0YXRlO1xuICAgICAgICBsZXQgYW5pbWF0aW9uO1xuICAgICAgICBsZXQgY2xpcDtcbiAgICAgICAgLy8gSWYgdHJhbnNpdGlvbi5mcm9tIGlzIHNldCwgdHJhbnNpdGlvbiBmcm9tIHRoZSBhY3RpdmUgc3RhdGUgaXJyZWdhcmRsZXNzIG9mIHRoZSB0cmFuc2l0aW9uLmZyb20gdmFsdWUgKHRoaXMgY291bGQgYmUgdGhlIHByZXZpb3VzLCBhY3RpdmUgb3IgQU5ZIHN0YXRlcykuXG4gICAgICAgIC8vIE90aGVyd2lzZSB0aGUgcHJldmlvdXNTdGF0ZSBpcyBjbGVhcmVkLlxuICAgICAgICB0aGlzLnByZXZpb3VzU3RhdGUgPSB0cmFuc2l0aW9uLmZyb20gPyB0aGlzLmFjdGl2ZVN0YXRlTmFtZSA6IG51bGw7XG4gICAgICAgIHRoaXMuYWN0aXZlU3RhdGUgPSB0cmFuc2l0aW9uLnRvO1xuXG4gICAgICAgIC8vIHR1cm4gb2ZmIGFueSB0cmlnZ2VycyB3aGljaCB3ZXJlIHJlcXVpcmVkIHRvIGFjdGl2YXRlIHRoaXMgdHJhbnNpdGlvblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyYW5zaXRpb24uY29uZGl0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29uZGl0aW9uID0gdHJhbnNpdGlvbi5jb25kaXRpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gdGhpcy5maW5kUGFyYW1ldGVyKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXIudHlwZSA9PT0gQU5JTV9QQVJBTUVURVJfVFJJR0dFUikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMuYWRkKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnByZXZpb3VzU3RhdGUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzID0gW107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlY29yZCB0aGUgdHJhbnNpdGlvbiBzb3VyY2Ugc3RhdGUgaW4gdGhlIHByZXZpb3VzIHN0YXRlcyBhcnJheVxuICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lLFxuICAgICAgICAgICAgICAgIHdlaWdodDogMVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgbmV3IHRyYW5zaXRpb24gd2FzIGFjdGl2YXRlZCBkdXJpbmcgYW5vdGhlciB0cmFuc2l0aW9uLCB1cGRhdGUgdGhlIHByZXZpb3VzIHRyYW5zaXRpb24gc3RhdGUgd2VpZ2h0cyBiYXNlZFxuICAgICAgICAgICAgLy8gb24gdGhlIHByb2dyZXNzIHRocm91Z2ggdGhlIHByZXZpb3VzIHRyYW5zaXRpb24uXG4gICAgICAgICAgICBjb25zdCBpbnRlcnBvbGF0ZWRUaW1lID0gTWF0aC5taW4odGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSAhPT0gMCA/IHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSAvIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgOiAxLCAxLjApO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBpbnRlcnBvbGF0ZSB0aGUgd2VpZ2h0cyBvZiB0aGUgbW9zdCByZWNlbnQgcHJldmlvdXMgc3RhdGUgYW5kIGFsbCBvdGhlciBwcmV2aW91cyBzdGF0ZXMgYmFzZWQgb24gdGhlIHByb2dyZXNzIHRocm91Z2ggdGhlIHByZXZpb3VzIHRyYW5zaXRpb25cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ud2VpZ2h0ID0gMS4wO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaSAhPT0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCAqPSAoMS4wIC0gaW50ZXJwb2xhdGVkVGltZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCA9IGludGVycG9sYXRlZFRpbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgdGhlIGFuaW1hdGlvbnMgb2YgcHJldmlvdXMgc3RhdGVzLCBzZXQgdGhlaXIgbmFtZSB0byBpbmNsdWRlIHRoZWlyIHBvc2l0aW9uIGluIHRoZSBwcmV2aW91cyBzdGF0ZSBhcnJheVxuICAgICAgICAgICAgICAgIC8vIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IGFuaW1hdGlvbnMgZnJvbSB0aGUgc2FtZSBzdGF0ZSB0aGF0IHdlcmUgYWRkZWQgZHVyaW5nIGRpZmZlcmVudCB0cmFuc2l0aW9uc1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2pdO1xuICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSArICcucHJldmlvdXMuJyArIGkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAubmFtZSA9IGFuaW1hdGlvbi5uYW1lICsgJy5wcmV2aW91cy4nICsgaTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyAvLyBwYXVzZSBwcmV2aW91cyBhbmltYXRpb24gY2xpcHMgdG8gcmVkdWNlIHRoZWlyIGltcGFjdCBvbiBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgICAgICAgICBpZiAoaSAhPT0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAucGF1c2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgPSB0cmFuc2l0aW9uLnRpbWU7XG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UgPSB0cmFuc2l0aW9uLmludGVycnVwdGlvblNvdXJjZTtcblxuXG4gICAgICAgIGNvbnN0IGFjdGl2ZVN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgY29uc3QgaGFzVHJhbnNpdGlvbk9mZnNldCA9IHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldCAmJiB0cmFuc2l0aW9uLnRyYW5zaXRpb25PZmZzZXQgPiAwLjAgJiYgdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0IDwgMS4wO1xuXG4gICAgICAgIC8vIHNldCB0aGUgdGltZSBpbiB0aGUgbmV3IHN0YXRlIHRvIDAgb3IgdG8gYSB2YWx1ZSBiYXNlZCBvbiB0cmFuc2l0aW9uT2Zmc2V0IGlmIG9uZSB3YXMgZ2l2ZW5cbiAgICAgICAgbGV0IHRpbWVJblN0YXRlID0gMDtcbiAgICAgICAgbGV0IHRpbWVJblN0YXRlQmVmb3JlID0gMDtcbiAgICAgICAgaWYgKGhhc1RyYW5zaXRpb25PZmZzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9mZnNldFRpbWUgPSBhY3RpdmVTdGF0ZS50aW1lbGluZUR1cmF0aW9uICogdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0O1xuICAgICAgICAgICAgdGltZUluU3RhdGUgPSBvZmZzZXRUaW1lO1xuICAgICAgICAgICAgdGltZUluU3RhdGVCZWZvcmUgPSBvZmZzZXRUaW1lO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlID0gdGltZUluU3RhdGU7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gdGltZUluU3RhdGVCZWZvcmU7XG5cbiAgICAgICAgLy8gQWRkIGNsaXBzIHRvIHRoZSBldmFsdWF0b3IgZm9yIGVhY2ggYW5pbWF0aW9uIGluIHRoZSBuZXcgc3RhdGUuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWN0aXZlU3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5uYW1lKTtcbiAgICAgICAgICAgIGlmICghY2xpcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwZWVkID0gTnVtYmVyLmlzRmluaXRlKGFjdGl2ZVN0YXRlLmFuaW1hdGlvbnNbaV0uc3BlZWQpID8gYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5zcGVlZCA6IGFjdGl2ZVN0YXRlLnNwZWVkO1xuICAgICAgICAgICAgICAgIGNsaXAgPSBuZXcgQW5pbUNsaXAoYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5hbmltVHJhY2ssIHRoaXMuX3RpbWVJblN0YXRlLCBzcGVlZCwgdHJ1ZSwgYWN0aXZlU3RhdGUubG9vcCwgdGhpcy5fZXZlbnRIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICBjbGlwLm5hbWUgPSBhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLm5hbWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci5hZGRDbGlwKGNsaXApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjbGlwLnJlc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHJhbnNpdGlvbi50aW1lID4gMCkge1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSAwLjA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSBhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLm5vcm1hbGl6ZWRXZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbGlwLnBsYXkoKTtcbiAgICAgICAgICAgIGlmIChoYXNUcmFuc2l0aW9uT2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgY2xpcC50aW1lID0gYWN0aXZlU3RhdGUudGltZWxpbmVEdXJhdGlvbiAqIHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gYWN0aXZlU3RhdGUuc3BlZWQgPj0gMCA/IDAgOiB0aGlzLmFjdGl2ZVN0YXRlRHVyYXRpb247XG4gICAgICAgICAgICAgICAgY2xpcC50aW1lID0gc3RhcnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3RyYW5zaXRpb25Ub1N0YXRlKG5ld1N0YXRlTmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX2ZpbmRTdGF0ZShuZXdTdGF0ZU5hbWUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb3ZlIHRvIHRoZSBnaXZlbiBzdGF0ZSwgaWYgYSB0cmFuc2l0aW9uIGlzIHByZXNlbnQgaW4gdGhlIHN0YXRlIGdyYXBoIHVzZSBpdC4gT3RoZXJ3aXNlIG1vdmUgaW5zdGFudGx5IHRvIGl0LlxuICAgICAgICBsZXQgdHJhbnNpdGlvbiA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSwgbmV3U3RhdGVOYW1lKTtcbiAgICAgICAgaWYgKCF0cmFuc2l0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXBzKCk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uID0gbmV3IEFuaW1UcmFuc2l0aW9uKHsgZnJvbTogbnVsbCwgdG86IG5ld1N0YXRlTmFtZSB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlRnJvbVRyYW5zaXRpb24odHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgYXNzaWduQW5pbWF0aW9uKHBhdGhTdHJpbmcsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IHBhdGhTdHJpbmcuc3BsaXQoJy4nKTtcbiAgICAgICAgbGV0IHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHBhdGhbMF0pO1xuICAgICAgICBpZiAoIXN0YXRlKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IG5ldyBBbmltU3RhdGUodGhpcywgcGF0aFswXSwgMS4wKTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlc1twYXRoWzBdXSA9IHN0YXRlO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVOYW1lcy5wdXNoKHBhdGhbMF0pO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmFkZEFuaW1hdGlvbihwYXRoLCBhbmltVHJhY2spO1xuICAgICAgICBpZiAoc3BlZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3RhdGUuc3BlZWQgPSBzcGVlZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobG9vcCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdGF0ZS5sb29wID0gbG9vcDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fcGxheWluZyAmJiB0aGlzLl9hY3RpdmF0ZSAmJiB0aGlzLnBsYXlhYmxlKSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZU5vZGVBbmltYXRpb25zKG5vZGVOYW1lKSB7XG4gICAgICAgIGlmIChBTklNX0NPTlRST0xfU1RBVEVTLmluZGV4T2Yobm9kZU5hbWUpICE9PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKG5vZGVOYW1lKTtcbiAgICAgICAgaWYgKCFzdGF0ZSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0F0dGVtcHRpbmcgdG8gdW5hc3NpZ24gYW5pbWF0aW9uIHRyYWNrcyBmcm9tIGEgc3RhdGUgdGhhdCBkb2VzIG5vdCBleGlzdC4nKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRlLmFuaW1hdGlvbnMgPSBbXTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcGxheShzdGF0ZU5hbWUpIHtcbiAgICAgICAgaWYgKHN0YXRlTmFtZSkge1xuICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblRvU3RhdGUoc3RhdGVOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9wbGF5aW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlc2V0KCkge1xuICAgICAgICB0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSA9IEFOSU1fU1RBVEVfU1RBUlQ7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fY3VyclRyYW5zaXRpb25UaW1lID0gMS4wO1xuICAgICAgICB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lID0gMS4wO1xuICAgICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGUgPSAwO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSA9IDA7XG4gICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IucmVtb3ZlQ2xpcHMoKTtcbiAgICB9XG5cbiAgICByZWJpbmQoKSB7XG4gICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IucmViaW5kKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0KSB7XG4gICAgICAgIGlmICghdGhpcy5fcGxheWluZykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzdGF0ZTtcbiAgICAgICAgbGV0IGFuaW1hdGlvbjtcbiAgICAgICAgbGV0IGNsaXA7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gdGhpcy5fdGltZUluU3RhdGU7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlICs9IGR0O1xuXG4gICAgICAgIC8vIHRyYW5zaXRpb24gYmV0d2VlbiBzdGF0ZXMgaWYgYSB0cmFuc2l0aW9uIGlzIGF2YWlsYWJsZSBmcm9tIHRoZSBhY3RpdmUgc3RhdGVcbiAgICAgICAgY29uc3QgdHJhbnNpdGlvbiA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSk7XG4gICAgICAgIGlmICh0cmFuc2l0aW9uKVxuICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0ZUZyb21UcmFuc2l0aW9uKHRyYW5zaXRpb24pO1xuXG4gICAgICAgIGlmICh0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSArPSBkdDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgPD0gdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGludGVycG9sYXRlZFRpbWUgPSB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lICE9PSAwID8gdGhpcy5fY3VyclRyYW5zaXRpb25UaW1lIC8gdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSA6IDE7XG4gICAgICAgICAgICAgICAgLy8gd2hpbGUgdHJhbnNpdGlvbmluZywgc2V0IGFsbCBwcmV2aW91cyBzdGF0ZSBhbmltYXRpb25zIHRvIGJlIHdlaWdodGVkIGJ5ICgxLjAgLSBpbnRlcnBvbGF0aW9uVGltZSkuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLl9maW5kU3RhdGUodGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0ZVdlaWdodCA9IHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS53ZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uID0gc3RhdGUuYW5pbWF0aW9uc1tqXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lICsgJy5wcmV2aW91cy4nICsgaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2xpcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSAoMS4wIC0gaW50ZXJwb2xhdGVkVGltZSkgKiBhbmltYXRpb24ubm9ybWFsaXplZFdlaWdodCAqIHN0YXRlV2VpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIHdoaWxlIHRyYW5zaXRpb25pbmcsIHNldCBhY3RpdmUgc3RhdGUgYW5pbWF0aW9ucyB0byBiZSB3ZWlnaHRlZCBieSAoaW50ZXJwb2xhdGlvblRpbWUpLlxuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uID0gc3RhdGUuYW5pbWF0aW9uc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSkuYmxlbmRXZWlnaHQgPSBpbnRlcnBvbGF0ZWRUaW1lICogYW5pbWF0aW9uLm5vcm1hbGl6ZWRXZWlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAvLyB3aGVuIGEgdHJhbnNpdGlvbiBlbmRzLCByZW1vdmUgYWxsIHByZXZpb3VzIHN0YXRlIGNsaXBzIGZyb20gdGhlIGV2YWx1YXRvclxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdGl2ZUNsaXBzID0gdGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvdGFsQ2xpcHMgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmNsaXBzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRvdGFsQ2xpcHMgLSBhY3RpdmVDbGlwczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IucmVtb3ZlQ2xpcCgwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzID0gW107XG4gICAgICAgICAgICAgICAgLy8gd2hlbiBhIHRyYW5zaXRpb24gZW5kcywgc2V0IHRoZSBhY3RpdmUgc3RhdGUgY2xpcCB3ZWlnaHRzIHNvIHRoZXkgc3VtIHRvIDFcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMuYWN0aXZlU3RhdGU7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0ZS5hbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGFuaW1hdGlvbiA9IHN0YXRlLmFuaW1hdGlvbnNbaV07XG4gICAgICAgICAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSBhbmltYXRpb24ubm9ybWFsaXplZFdlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmFjdGl2ZVN0YXRlLl9ibGVuZFRyZWUuY29uc3RydWN0b3IgIT09IEFuaW1Ob2RlKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLmFjdGl2ZVN0YXRlO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2ldO1xuICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjbGlwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlwLmJsZW5kV2VpZ2h0ID0gYW5pbWF0aW9uLm5vcm1hbGl6ZWRXZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYW5pbWF0aW9uLnBhcmVudC5zeW5jQW5pbWF0aW9ucykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAuc3BlZWQgPSBhbmltYXRpb24uc3BlZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci51cGRhdGUoZHQpO1xuICAgIH1cblxuICAgIGZpbmRQYXJhbWV0ZXIobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFyYW1ldGVyc1tuYW1lXTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEFuaW1Db250cm9sbGVyIH07XG4iXSwibmFtZXMiOlsiQW5pbUNvbnRyb2xsZXIiLCJjb25zdHJ1Y3RvciIsImFuaW1FdmFsdWF0b3IiLCJzdGF0ZXMiLCJ0cmFuc2l0aW9ucyIsInBhcmFtZXRlcnMiLCJhY3RpdmF0ZSIsImV2ZW50SGFuZGxlciIsImNvbnN1bWVkVHJpZ2dlcnMiLCJfYW5pbUV2YWx1YXRvciIsIl9zdGF0ZXMiLCJfc3RhdGVOYW1lcyIsIl9ldmVudEhhbmRsZXIiLCJfY29uc3VtZWRUcmlnZ2VycyIsImkiLCJsZW5ndGgiLCJuYW1lIiwiQW5pbVN0YXRlIiwic3BlZWQiLCJsb29wIiwiYmxlbmRUcmVlIiwicHVzaCIsIl90cmFuc2l0aW9ucyIsIm1hcCIsInRyYW5zaXRpb24iLCJBbmltVHJhbnNpdGlvbiIsIl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZSIsIl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGUiLCJfcGFyYW1ldGVycyIsIl9wcmV2aW91c1N0YXRlTmFtZSIsIl9hY3RpdmVTdGF0ZU5hbWUiLCJBTklNX1NUQVRFX1NUQVJUIiwiX3BsYXlpbmciLCJfYWN0aXZhdGUiLCJfY3VyclRyYW5zaXRpb25UaW1lIiwiX3RvdGFsVHJhbnNpdGlvblRpbWUiLCJfaXNUcmFuc2l0aW9uaW5nIiwiX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UiLCJBTklNX0lOVEVSUlVQVElPTl9OT05FIiwiX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcyIsIl90aW1lSW5TdGF0ZSIsIl90aW1lSW5TdGF0ZUJlZm9yZSIsImFjdGl2ZVN0YXRlIiwic3RhdGVOYW1lIiwiX2ZpbmRTdGF0ZSIsImFjdGl2ZVN0YXRlTmFtZSIsImFjdGl2ZVN0YXRlQW5pbWF0aW9ucyIsImFuaW1hdGlvbnMiLCJwcmV2aW91c1N0YXRlIiwicHJldmlvdXNTdGF0ZU5hbWUiLCJwbGF5YWJsZSIsInBsYXlpbmciLCJ2YWx1ZSIsImFjdGl2ZVN0YXRlUHJvZ3Jlc3MiLCJfZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUiLCJhY3RpdmVTdGF0ZUR1cmF0aW9uIiwiQU5JTV9TVEFURV9FTkQiLCJtYXhEdXJhdGlvbiIsImFjdGl2ZUNsaXAiLCJmaW5kQ2xpcCIsIk1hdGgiLCJtYXgiLCJ0cmFjayIsImR1cmF0aW9uIiwiYWN0aXZlU3RhdGVDdXJyZW50VGltZSIsInRpbWUiLCJjbGlwIiwidHJhbnNpdGlvbmluZyIsInRyYW5zaXRpb25Qcm9ncmVzcyIsImFzc2lnbk1hc2siLCJtYXNrIiwiQU5JTV9TVEFURV9BTlkiLCJfZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlIiwiZmlsdGVyIiwiZnJvbSIsInNvcnRQcmlvcml0eSIsIl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzIiwic291cmNlU3RhdGVOYW1lIiwiZGVzdGluYXRpb25TdGF0ZU5hbWUiLCJ0byIsIl90cmFuc2l0aW9uSGFzQ29uZGl0aW9uc01ldCIsImNvbmRpdGlvbnMiLCJjb25kaXRpb24iLCJwYXJhbWV0ZXIiLCJmaW5kUGFyYW1ldGVyIiwicGFyYW1ldGVyTmFtZSIsInByZWRpY2F0ZSIsIkFOSU1fR1JFQVRFUl9USEFOIiwiQU5JTV9MRVNTX1RIQU4iLCJBTklNX0dSRUFURVJfVEhBTl9FUVVBTF9UTyIsIkFOSU1fTEVTU19USEFOX0VRVUFMX1RPIiwiQU5JTV9FUVVBTF9UTyIsIkFOSU1fTk9UX0VRVUFMX1RPIiwiX2ZpbmRUcmFuc2l0aW9uIiwiY29uY2F0IiwiQU5JTV9JTlRFUlJVUFRJT05fUFJFViIsIkFOSU1fSU5URVJSVVBUSU9OX05FWFQiLCJBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQiLCJBTklNX0lOVEVSUlVQVElPTl9ORVhUX1BSRVYiLCJoYXNFeGl0VGltZSIsInByb2dyZXNzQmVmb3JlIiwicHJvZ3Jlc3MiLCJleGl0VGltZSIsImZsb29yIiwic3RhcnRUcmFuc2l0aW9uIiwidXBkYXRlU3RhdGVGcm9tVHJhbnNpdGlvbiIsInN0YXRlIiwiYW5pbWF0aW9uIiwidHlwZSIsIkFOSU1fUEFSQU1FVEVSX1RSSUdHRVIiLCJhZGQiLCJ3ZWlnaHQiLCJpbnRlcnBvbGF0ZWRUaW1lIiwibWluIiwiaiIsInBhdXNlIiwiaW50ZXJydXB0aW9uU291cmNlIiwiaGFzVHJhbnNpdGlvbk9mZnNldCIsInRyYW5zaXRpb25PZmZzZXQiLCJ0aW1lSW5TdGF0ZSIsInRpbWVJblN0YXRlQmVmb3JlIiwib2Zmc2V0VGltZSIsInRpbWVsaW5lRHVyYXRpb24iLCJOdW1iZXIiLCJpc0Zpbml0ZSIsIkFuaW1DbGlwIiwiYW5pbVRyYWNrIiwiYWRkQ2xpcCIsInJlc2V0IiwiYmxlbmRXZWlnaHQiLCJub3JtYWxpemVkV2VpZ2h0IiwicGxheSIsInN0YXJ0VGltZSIsIl90cmFuc2l0aW9uVG9TdGF0ZSIsIm5ld1N0YXRlTmFtZSIsInJlbW92ZUNsaXBzIiwiYXNzaWduQW5pbWF0aW9uIiwicGF0aFN0cmluZyIsInBhdGgiLCJzcGxpdCIsImFkZEFuaW1hdGlvbiIsInVuZGVmaW5lZCIsInJlbW92ZU5vZGVBbmltYXRpb25zIiwibm9kZU5hbWUiLCJBTklNX0NPTlRST0xfU1RBVEVTIiwiaW5kZXhPZiIsIkRlYnVnIiwiZXJyb3IiLCJyZWJpbmQiLCJ1cGRhdGUiLCJkdCIsInN0YXRlV2VpZ2h0IiwiYWN0aXZlQ2xpcHMiLCJ0b3RhbENsaXBzIiwiY2xpcHMiLCJyZW1vdmVDbGlwIiwiX2JsZW5kVHJlZSIsIkFuaW1Ob2RlIiwicGFyZW50Iiwic3luY0FuaW1hdGlvbnMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBd0JBLE1BQU1BLGNBQU4sQ0FBcUI7QUFrQmpCQyxFQUFBQSxXQUFXLENBQUNDLGFBQUQsRUFBZ0JDLE1BQWhCLEVBQXdCQyxXQUF4QixFQUFxQ0MsVUFBckMsRUFBaURDLFFBQWpELEVBQTJEQyxZQUEzRCxFQUF5RUMsZ0JBQXpFLEVBQTJGO0lBQ2xHLElBQUtDLENBQUFBLGNBQUwsR0FBc0JQLGFBQXRCLENBQUE7SUFDQSxJQUFLUSxDQUFBQSxPQUFMLEdBQWUsRUFBZixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsV0FBTCxHQUFtQixFQUFuQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsYUFBTCxHQUFxQkwsWUFBckIsQ0FBQTtJQUNBLElBQUtNLENBQUFBLGlCQUFMLEdBQXlCTCxnQkFBekIsQ0FBQTs7QUFDQSxJQUFBLEtBQUssSUFBSU0sQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR1gsTUFBTSxDQUFDWSxNQUEzQixFQUFtQ0QsQ0FBQyxFQUFwQyxFQUF3QztBQUNwQyxNQUFBLElBQUEsQ0FBS0osT0FBTCxDQUFhUCxNQUFNLENBQUNXLENBQUQsQ0FBTixDQUFVRSxJQUF2QixDQUFBLEdBQStCLElBQUlDLFNBQUosQ0FDM0IsSUFEMkIsRUFFM0JkLE1BQU0sQ0FBQ1csQ0FBRCxDQUFOLENBQVVFLElBRmlCLEVBRzNCYixNQUFNLENBQUNXLENBQUQsQ0FBTixDQUFVSSxLQUhpQixFQUkzQmYsTUFBTSxDQUFDVyxDQUFELENBQU4sQ0FBVUssSUFKaUIsRUFLM0JoQixNQUFNLENBQUNXLENBQUQsQ0FBTixDQUFVTSxTQUxpQixDQUEvQixDQUFBOztNQU9BLElBQUtULENBQUFBLFdBQUwsQ0FBaUJVLElBQWpCLENBQXNCbEIsTUFBTSxDQUFDVyxDQUFELENBQU4sQ0FBVUUsSUFBaEMsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLElBQUEsQ0FBS00sWUFBTCxHQUFvQmxCLFdBQVcsQ0FBQ21CLEdBQVosQ0FBaUJDLFVBQUQsSUFBZ0I7QUFDaEQsTUFBQSxPQUFPLElBQUlDLGNBQUosQ0FDQUQsUUFBQUEsQ0FBQUEsRUFBQUEsRUFBQUEsVUFEQSxDQUFQLENBQUEsQ0FBQTtBQUdILEtBSm1CLENBQXBCLENBQUE7SUFLQSxJQUFLRSxDQUFBQSw4QkFBTCxHQUFzQyxFQUF0QyxDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsa0NBQUwsR0FBMEMsRUFBMUMsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFdBQUwsR0FBbUJ2QixVQUFuQixDQUFBO0lBQ0EsSUFBS3dCLENBQUFBLGtCQUFMLEdBQTBCLElBQTFCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxnQkFBTCxHQUF3QkMsZ0JBQXhCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxRQUFMLEdBQWdCLEtBQWhCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxTQUFMLEdBQWlCM0IsUUFBakIsQ0FBQTtJQUVBLElBQUs0QixDQUFBQSxtQkFBTCxHQUEyQixHQUEzQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsb0JBQUwsR0FBNEIsR0FBNUIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLGdCQUFMLEdBQXdCLEtBQXhCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSw2QkFBTCxHQUFxQ0Msc0JBQXJDLENBQUE7SUFDQSxJQUFLQyxDQUFBQSx5QkFBTCxHQUFpQyxFQUFqQyxDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsWUFBTCxHQUFvQixDQUFwQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsa0JBQUwsR0FBMEIsQ0FBMUIsQ0FBQTtBQUNILEdBQUE7O0FBRWdCLEVBQUEsSUFBYnZDLGFBQWEsR0FBRztBQUNoQixJQUFBLE9BQU8sS0FBS08sY0FBWixDQUFBO0FBQ0gsR0FBQTs7RUFFYyxJQUFYaUMsV0FBVyxDQUFDQyxTQUFELEVBQVk7SUFDdkIsSUFBS2IsQ0FBQUEsZ0JBQUwsR0FBd0JhLFNBQXhCLENBQUE7QUFDSCxHQUFBOztBQUVjLEVBQUEsSUFBWEQsV0FBVyxHQUFHO0FBQ2QsSUFBQSxPQUFPLElBQUtFLENBQUFBLFVBQUwsQ0FBZ0IsSUFBQSxDQUFLZCxnQkFBckIsQ0FBUCxDQUFBO0FBQ0gsR0FBQTs7QUFFa0IsRUFBQSxJQUFmZSxlQUFlLEdBQUc7QUFDbEIsSUFBQSxPQUFPLEtBQUtmLGdCQUFaLENBQUE7QUFDSCxHQUFBOztBQUV3QixFQUFBLElBQXJCZ0IscUJBQXFCLEdBQUc7SUFDeEIsT0FBTyxJQUFBLENBQUtKLFdBQUwsQ0FBaUJLLFVBQXhCLENBQUE7QUFDSCxHQUFBOztFQUVnQixJQUFiQyxhQUFhLENBQUNMLFNBQUQsRUFBWTtJQUN6QixJQUFLZCxDQUFBQSxrQkFBTCxHQUEwQmMsU0FBMUIsQ0FBQTtBQUNILEdBQUE7O0FBRWdCLEVBQUEsSUFBYkssYUFBYSxHQUFHO0FBQ2hCLElBQUEsT0FBTyxJQUFLSixDQUFBQSxVQUFMLENBQWdCLElBQUEsQ0FBS2Ysa0JBQXJCLENBQVAsQ0FBQTtBQUNILEdBQUE7O0FBRW9CLEVBQUEsSUFBakJvQixpQkFBaUIsR0FBRztBQUNwQixJQUFBLE9BQU8sS0FBS3BCLGtCQUFaLENBQUE7QUFDSCxHQUFBOztBQUVXLEVBQUEsSUFBUnFCLFFBQVEsR0FBRztJQUNYLElBQUlBLFFBQVEsR0FBRyxJQUFmLENBQUE7O0FBQ0EsSUFBQSxLQUFLLElBQUlwQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLElBQUtILENBQUFBLFdBQUwsQ0FBaUJJLE1BQXJDLEVBQTZDRCxDQUFDLEVBQTlDLEVBQWtEO01BQzlDLElBQUksQ0FBQyxJQUFLSixDQUFBQSxPQUFMLENBQWEsSUFBQSxDQUFLQyxXQUFMLENBQWlCRyxDQUFqQixDQUFiLENBQWtDb0MsQ0FBQUEsUUFBdkMsRUFBaUQ7QUFDN0NBLFFBQUFBLFFBQVEsR0FBRyxLQUFYLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTs7QUFDRCxJQUFBLE9BQU9BLFFBQVAsQ0FBQTtBQUNILEdBQUE7O0VBRVUsSUFBUEMsT0FBTyxDQUFDQyxLQUFELEVBQVE7SUFDZixJQUFLcEIsQ0FBQUEsUUFBTCxHQUFnQm9CLEtBQWhCLENBQUE7QUFDSCxHQUFBOztBQUVVLEVBQUEsSUFBUEQsT0FBTyxHQUFHO0FBQ1YsSUFBQSxPQUFPLEtBQUtuQixRQUFaLENBQUE7QUFDSCxHQUFBOztBQUVzQixFQUFBLElBQW5CcUIsbUJBQW1CLEdBQUc7QUFDdEIsSUFBQSxPQUFPLElBQUtDLENBQUFBLDhCQUFMLENBQW9DLElBQUEsQ0FBS2QsWUFBekMsQ0FBUCxDQUFBO0FBQ0gsR0FBQTs7QUFFc0IsRUFBQSxJQUFuQmUsbUJBQW1CLEdBQUc7SUFDdEIsSUFBSSxJQUFBLENBQUtWLGVBQUwsS0FBeUJkLGdCQUF6QixJQUE2QyxJQUFLYyxDQUFBQSxlQUFMLEtBQXlCVyxjQUExRSxFQUNJLE9BQU8sR0FBUCxDQUFBO0lBRUosSUFBSUMsV0FBVyxHQUFHLEdBQWxCLENBQUE7O0FBQ0EsSUFBQSxLQUFLLElBQUkzQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLElBQUtnQyxDQUFBQSxxQkFBTCxDQUEyQi9CLE1BQS9DLEVBQXVERCxDQUFDLEVBQXhELEVBQTREO0FBQ3hELE1BQUEsTUFBTTRDLFVBQVUsR0FBRyxJQUFLakQsQ0FBQUEsY0FBTCxDQUFvQmtELFFBQXBCLENBQTZCLElBQUEsQ0FBS2IscUJBQUwsQ0FBMkJoQyxDQUEzQixDQUFBLENBQThCRSxJQUEzRCxDQUFuQixDQUFBOztBQUNBLE1BQUEsSUFBSTBDLFVBQUosRUFBZ0I7QUFDWkQsUUFBQUEsV0FBVyxHQUFHRyxJQUFJLENBQUNDLEdBQUwsQ0FBU0osV0FBVCxFQUFzQkMsVUFBVSxDQUFDSSxLQUFYLENBQWlCQyxRQUF2QyxDQUFkLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTs7QUFDRCxJQUFBLE9BQU9OLFdBQVAsQ0FBQTtBQUNILEdBQUE7O0VBRXlCLElBQXRCTyxzQkFBc0IsQ0FBQ0MsSUFBRCxFQUFPO0lBQzdCLElBQUt4QixDQUFBQSxrQkFBTCxHQUEwQndCLElBQTFCLENBQUE7SUFDQSxJQUFLekIsQ0FBQUEsWUFBTCxHQUFvQnlCLElBQXBCLENBQUE7O0FBQ0EsSUFBQSxLQUFLLElBQUluRCxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLElBQUtnQyxDQUFBQSxxQkFBTCxDQUEyQi9CLE1BQS9DLEVBQXVERCxDQUFDLEVBQXhELEVBQTREO0FBQ3hELE1BQUEsTUFBTW9ELElBQUksR0FBRyxJQUFLaEUsQ0FBQUEsYUFBTCxDQUFtQnlELFFBQW5CLENBQTRCLElBQUEsQ0FBS2IscUJBQUwsQ0FBMkJoQyxDQUEzQixDQUFBLENBQThCRSxJQUExRCxDQUFiLENBQUE7O0FBQ0EsTUFBQSxJQUFJa0QsSUFBSixFQUFVO1FBQ05BLElBQUksQ0FBQ0QsSUFBTCxHQUFZQSxJQUFaLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRXlCLEVBQUEsSUFBdEJELHNCQUFzQixHQUFHO0FBQ3pCLElBQUEsT0FBTyxLQUFLeEIsWUFBWixDQUFBO0FBQ0gsR0FBQTs7QUFFZ0IsRUFBQSxJQUFiMkIsYUFBYSxHQUFHO0FBQ2hCLElBQUEsT0FBTyxLQUFLL0IsZ0JBQVosQ0FBQTtBQUNILEdBQUE7O0FBRXFCLEVBQUEsSUFBbEJnQyxrQkFBa0IsR0FBRztBQUNyQixJQUFBLE9BQU8sSUFBS2xDLENBQUFBLG1CQUFMLEdBQTJCLElBQUEsQ0FBS0Msb0JBQXZDLENBQUE7QUFDSCxHQUFBOztBQUVTLEVBQUEsSUFBTmhDLE1BQU0sR0FBRztBQUNULElBQUEsT0FBTyxLQUFLUSxXQUFaLENBQUE7QUFDSCxHQUFBOztFQUVEMEQsVUFBVSxDQUFDQyxJQUFELEVBQU87QUFDYixJQUFBLE9BQU8sS0FBSzdELGNBQUwsQ0FBb0I0RCxVQUFwQixDQUErQkMsSUFBL0IsQ0FBUCxDQUFBO0FBQ0gsR0FBQTs7RUFFRDFCLFVBQVUsQ0FBQ0QsU0FBRCxFQUFZO0FBQ2xCLElBQUEsT0FBTyxJQUFLakMsQ0FBQUEsT0FBTCxDQUFhaUMsU0FBYixDQUFQLENBQUE7QUFDSCxHQUFBOztFQUVEVyw4QkFBOEIsQ0FBQ1csSUFBRCxFQUFPO0FBQ2pDLElBQUEsSUFBSSxLQUFLcEIsZUFBTCxLQUF5QmQsZ0JBQXpCLElBQTZDLEtBQUtjLGVBQUwsS0FBeUJXLGNBQXRFLElBQXdGLEtBQUtYLGVBQUwsS0FBeUIwQixjQUFySCxFQUNJLE9BQU8sR0FBUCxDQUFBOztBQUVKLElBQUEsTUFBTWIsVUFBVSxHQUFHLElBQUtqRCxDQUFBQSxjQUFMLENBQW9Ca0QsUUFBcEIsQ0FBNkIsSUFBQSxDQUFLYixxQkFBTCxDQUEyQixDQUEzQixDQUFBLENBQThCOUIsSUFBM0QsQ0FBbkIsQ0FBQTs7QUFDQSxJQUFBLElBQUkwQyxVQUFKLEVBQWdCO0FBQ1osTUFBQSxPQUFPTyxJQUFJLEdBQUdQLFVBQVUsQ0FBQ0ksS0FBWCxDQUFpQkMsUUFBL0IsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxPQUFPLElBQVAsQ0FBQTtBQUNILEdBQUE7O0VBR0RTLHlCQUF5QixDQUFDN0IsU0FBRCxFQUFZO0FBQ2pDLElBQUEsSUFBSXZDLFdBQVcsR0FBRyxJQUFBLENBQUtzQiw4QkFBTCxDQUFvQ2lCLFNBQXBDLENBQWxCLENBQUE7O0lBQ0EsSUFBSSxDQUFDdkMsV0FBTCxFQUFrQjtNQUNkQSxXQUFXLEdBQUcsS0FBS2tCLFlBQUwsQ0FBa0JtRCxNQUFsQixDQUF5QixVQUFVakQsVUFBVixFQUFzQjtBQUN6RCxRQUFBLE9BQU9BLFVBQVUsQ0FBQ2tELElBQVgsS0FBb0IvQixTQUEzQixDQUFBO0FBQ0gsT0FGYSxDQUFkLENBQUE7TUFLQWdDLFlBQVksQ0FBQ3ZFLFdBQUQsQ0FBWixDQUFBO0FBRUEsTUFBQSxJQUFBLENBQUtzQiw4QkFBTCxDQUFvQ2lCLFNBQXBDLENBQUEsR0FBaUR2QyxXQUFqRCxDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLE9BQU9BLFdBQVAsQ0FBQTtBQUNILEdBQUE7O0FBR0R3RSxFQUFBQSw2QkFBNkIsQ0FBQ0MsZUFBRCxFQUFrQkMsb0JBQWxCLEVBQXdDO0lBQ2pFLElBQUkxRSxXQUFXLEdBQUcsSUFBQSxDQUFLdUIsa0NBQUwsQ0FBd0NrRCxlQUFlLEdBQUcsSUFBbEIsR0FBeUJDLG9CQUFqRSxDQUFsQixDQUFBOztJQUNBLElBQUksQ0FBQzFFLFdBQUwsRUFBa0I7TUFDZEEsV0FBVyxHQUFHLEtBQUtrQixZQUFMLENBQWtCbUQsTUFBbEIsQ0FBeUIsVUFBVWpELFVBQVYsRUFBc0I7UUFDekQsT0FBT0EsVUFBVSxDQUFDa0QsSUFBWCxLQUFvQkcsZUFBcEIsSUFBdUNyRCxVQUFVLENBQUN1RCxFQUFYLEtBQWtCRCxvQkFBaEUsQ0FBQTtBQUNILE9BRmEsQ0FBZCxDQUFBO01BS0FILFlBQVksQ0FBQ3ZFLFdBQUQsQ0FBWixDQUFBO01BRUEsSUFBS3VCLENBQUFBLGtDQUFMLENBQXdDa0QsZUFBZSxHQUFHLElBQWxCLEdBQXlCQyxvQkFBakUsSUFBeUYxRSxXQUF6RixDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLE9BQU9BLFdBQVAsQ0FBQTtBQUNILEdBQUE7O0VBRUQ0RSwyQkFBMkIsQ0FBQ3hELFVBQUQsRUFBYTtBQUNwQyxJQUFBLE1BQU15RCxVQUFVLEdBQUd6RCxVQUFVLENBQUN5RCxVQUE5QixDQUFBOztBQUNBLElBQUEsS0FBSyxJQUFJbkUsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR21FLFVBQVUsQ0FBQ2xFLE1BQS9CLEVBQXVDRCxDQUFDLEVBQXhDLEVBQTRDO0FBQ3hDLE1BQUEsTUFBTW9FLFNBQVMsR0FBR0QsVUFBVSxDQUFDbkUsQ0FBRCxDQUE1QixDQUFBO01BQ0EsTUFBTXFFLFNBQVMsR0FBRyxJQUFLQyxDQUFBQSxhQUFMLENBQW1CRixTQUFTLENBQUNHLGFBQTdCLENBQWxCLENBQUE7O01BQ0EsUUFBUUgsU0FBUyxDQUFDSSxTQUFsQjtBQUNJLFFBQUEsS0FBS0MsaUJBQUw7VUFDSSxJQUFJLEVBQUVKLFNBQVMsQ0FBQy9CLEtBQVYsR0FBa0I4QixTQUFTLENBQUM5QixLQUE5QixDQUFKLEVBQTBDLE9BQU8sS0FBUCxDQUFBO0FBQzFDLFVBQUEsTUFBQTs7QUFDSixRQUFBLEtBQUtvQyxjQUFMO1VBQ0ksSUFBSSxFQUFFTCxTQUFTLENBQUMvQixLQUFWLEdBQWtCOEIsU0FBUyxDQUFDOUIsS0FBOUIsQ0FBSixFQUEwQyxPQUFPLEtBQVAsQ0FBQTtBQUMxQyxVQUFBLE1BQUE7O0FBQ0osUUFBQSxLQUFLcUMsMEJBQUw7VUFDSSxJQUFJLEVBQUVOLFNBQVMsQ0FBQy9CLEtBQVYsSUFBbUI4QixTQUFTLENBQUM5QixLQUEvQixDQUFKLEVBQTJDLE9BQU8sS0FBUCxDQUFBO0FBQzNDLFVBQUEsTUFBQTs7QUFDSixRQUFBLEtBQUtzQyx1QkFBTDtVQUNJLElBQUksRUFBRVAsU0FBUyxDQUFDL0IsS0FBVixJQUFtQjhCLFNBQVMsQ0FBQzlCLEtBQS9CLENBQUosRUFBMkMsT0FBTyxLQUFQLENBQUE7QUFDM0MsVUFBQSxNQUFBOztBQUNKLFFBQUEsS0FBS3VDLGFBQUw7VUFDSSxJQUFJLEVBQUVSLFNBQVMsQ0FBQy9CLEtBQVYsS0FBb0I4QixTQUFTLENBQUM5QixLQUFoQyxDQUFKLEVBQTRDLE9BQU8sS0FBUCxDQUFBO0FBQzVDLFVBQUEsTUFBQTs7QUFDSixRQUFBLEtBQUt3QyxpQkFBTDtVQUNJLElBQUksRUFBRVQsU0FBUyxDQUFDL0IsS0FBVixLQUFvQjhCLFNBQVMsQ0FBQzlCLEtBQWhDLENBQUosRUFBNEMsT0FBTyxLQUFQLENBQUE7QUFDNUMsVUFBQSxNQUFBO0FBbEJSLE9BQUE7QUFvQkgsS0FBQTs7QUFDRCxJQUFBLE9BQU8sSUFBUCxDQUFBO0FBQ0gsR0FBQTs7QUFFRHlDLEVBQUFBLGVBQWUsQ0FBQ25CLElBQUQsRUFBT0ssRUFBUCxFQUFXO0lBQ3RCLElBQUkzRSxXQUFXLEdBQUcsRUFBbEIsQ0FBQTs7SUFHQSxJQUFJc0UsSUFBSSxJQUFJSyxFQUFaLEVBQWdCO0FBQ1ozRSxNQUFBQSxXQUFXLEdBQUdBLFdBQVcsQ0FBQzBGLE1BQVosQ0FBbUIsSUFBQSxDQUFLbEIsNkJBQUwsQ0FBbUNGLElBQW5DLEVBQXlDSyxFQUF6QyxDQUFuQixDQUFkLENBQUE7QUFDSCxLQUZELE1BRU87TUFFSCxJQUFJLENBQUMsSUFBSzNDLENBQUFBLGdCQUFWLEVBQTRCO1FBQ3hCaEMsV0FBVyxHQUFHQSxXQUFXLENBQUMwRixNQUFaLENBQW1CLElBQUt0QixDQUFBQSx5QkFBTCxDQUErQixJQUFBLENBQUsxQyxnQkFBcEMsQ0FBbkIsQ0FBZCxDQUFBO1FBQ0ExQixXQUFXLEdBQUdBLFdBQVcsQ0FBQzBGLE1BQVosQ0FBbUIsS0FBS3RCLHlCQUFMLENBQStCRCxjQUEvQixDQUFuQixDQUFkLENBQUE7QUFDSCxPQUhELE1BR087QUFHSCxRQUFBLFFBQVEsS0FBS2xDLDZCQUFiO0FBQ0ksVUFBQSxLQUFLMEQsc0JBQUw7WUFDSTNGLFdBQVcsR0FBR0EsV0FBVyxDQUFDMEYsTUFBWixDQUFtQixJQUFLdEIsQ0FBQUEseUJBQUwsQ0FBK0IsSUFBQSxDQUFLM0Msa0JBQXBDLENBQW5CLENBQWQsQ0FBQTtZQUNBekIsV0FBVyxHQUFHQSxXQUFXLENBQUMwRixNQUFaLENBQW1CLEtBQUt0Qix5QkFBTCxDQUErQkQsY0FBL0IsQ0FBbkIsQ0FBZCxDQUFBO0FBQ0EsWUFBQSxNQUFBOztBQUNKLFVBQUEsS0FBS3lCLHNCQUFMO1lBQ0k1RixXQUFXLEdBQUdBLFdBQVcsQ0FBQzBGLE1BQVosQ0FBbUIsSUFBS3RCLENBQUFBLHlCQUFMLENBQStCLElBQUEsQ0FBSzFDLGdCQUFwQyxDQUFuQixDQUFkLENBQUE7WUFDQTFCLFdBQVcsR0FBR0EsV0FBVyxDQUFDMEYsTUFBWixDQUFtQixLQUFLdEIseUJBQUwsQ0FBK0JELGNBQS9CLENBQW5CLENBQWQsQ0FBQTtBQUNBLFlBQUEsTUFBQTs7QUFDSixVQUFBLEtBQUswQiwyQkFBTDtZQUNJN0YsV0FBVyxHQUFHQSxXQUFXLENBQUMwRixNQUFaLENBQW1CLElBQUt0QixDQUFBQSx5QkFBTCxDQUErQixJQUFBLENBQUszQyxrQkFBcEMsQ0FBbkIsQ0FBZCxDQUFBO1lBQ0F6QixXQUFXLEdBQUdBLFdBQVcsQ0FBQzBGLE1BQVosQ0FBbUIsSUFBS3RCLENBQUFBLHlCQUFMLENBQStCLElBQUEsQ0FBSzFDLGdCQUFwQyxDQUFuQixDQUFkLENBQUE7WUFDQTFCLFdBQVcsR0FBR0EsV0FBVyxDQUFDMEYsTUFBWixDQUFtQixLQUFLdEIseUJBQUwsQ0FBK0JELGNBQS9CLENBQW5CLENBQWQsQ0FBQTtBQUNBLFlBQUEsTUFBQTs7QUFDSixVQUFBLEtBQUsyQiwyQkFBTDtZQUNJOUYsV0FBVyxHQUFHQSxXQUFXLENBQUMwRixNQUFaLENBQW1CLElBQUt0QixDQUFBQSx5QkFBTCxDQUErQixJQUFBLENBQUsxQyxnQkFBcEMsQ0FBbkIsQ0FBZCxDQUFBO1lBQ0ExQixXQUFXLEdBQUdBLFdBQVcsQ0FBQzBGLE1BQVosQ0FBbUIsSUFBS3RCLENBQUFBLHlCQUFMLENBQStCLElBQUEsQ0FBSzNDLGtCQUFwQyxDQUFuQixDQUFkLENBQUE7WUFDQXpCLFdBQVcsR0FBR0EsV0FBVyxDQUFDMEYsTUFBWixDQUFtQixLQUFLdEIseUJBQUwsQ0FBK0JELGNBQS9CLENBQW5CLENBQWQsQ0FBQTtBQUNBLFlBQUEsTUFBQTtBQWxCUixTQUFBO0FBc0JILE9BQUE7QUFDSixLQUFBOztBQUdEbkUsSUFBQUEsV0FBVyxHQUFHQSxXQUFXLENBQUNxRSxNQUFaLENBQW9CakQsVUFBRCxJQUFnQjtBQUU3QyxNQUFBLElBQUlBLFVBQVUsQ0FBQ3VELEVBQVgsS0FBa0IsSUFBQSxDQUFLbEMsZUFBM0IsRUFBNEM7QUFDeEMsUUFBQSxPQUFPLEtBQVAsQ0FBQTtBQUNILE9BQUE7O01BRUQsSUFBSXJCLFVBQVUsQ0FBQzJFLFdBQWYsRUFBNEI7QUFDeEIsUUFBQSxJQUFJQyxjQUFjLEdBQUcsSUFBQSxDQUFLOUMsOEJBQUwsQ0FBb0MsSUFBQSxDQUFLYixrQkFBekMsQ0FBckIsQ0FBQTs7QUFDQSxRQUFBLElBQUk0RCxRQUFRLEdBQUcsSUFBQSxDQUFLL0MsOEJBQUwsQ0FBb0MsSUFBQSxDQUFLZCxZQUF6QyxDQUFmLENBQUE7O1FBRUEsSUFBSWhCLFVBQVUsQ0FBQzhFLFFBQVgsR0FBc0IsR0FBdEIsSUFBNkIsSUFBSzVELENBQUFBLFdBQUwsQ0FBaUJ2QixJQUFsRCxFQUF3RDtBQUNwRGlGLFVBQUFBLGNBQWMsSUFBSXhDLElBQUksQ0FBQzJDLEtBQUwsQ0FBV0gsY0FBWCxDQUFsQixDQUFBO0FBQ0FDLFVBQUFBLFFBQVEsSUFBSXpDLElBQUksQ0FBQzJDLEtBQUwsQ0FBV0YsUUFBWCxDQUFaLENBQUE7QUFDSCxTQUFBOztBQUVELFFBQUEsSUFBSSxFQUFFN0UsVUFBVSxDQUFDOEUsUUFBWCxHQUFzQkYsY0FBdEIsSUFBd0M1RSxVQUFVLENBQUM4RSxRQUFYLElBQXVCRCxRQUFqRSxDQUFKLEVBQWdGO0FBQzVFLFVBQUEsT0FBTyxJQUFQLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTs7QUFFRCxNQUFBLE9BQU8sSUFBS3JCLENBQUFBLDJCQUFMLENBQWlDeEQsVUFBakMsQ0FBUCxDQUFBO0FBQ0gsS0FyQmEsQ0FBZCxDQUFBOztBQXdCQSxJQUFBLElBQUlwQixXQUFXLENBQUNXLE1BQVosR0FBcUIsQ0FBekIsRUFBNEI7QUFDeEIsTUFBQSxNQUFNUyxVQUFVLEdBQUdwQixXQUFXLENBQUMsQ0FBRCxDQUE5QixDQUFBOztBQUNBLE1BQUEsSUFBSW9CLFVBQVUsQ0FBQ3VELEVBQVgsS0FBa0J2QixjQUF0QixFQUFzQztRQUNsQyxNQUFNZ0QsZUFBZSxHQUFHLElBQUtoQyxDQUFBQSx5QkFBTCxDQUErQnpDLGdCQUEvQixDQUFBLENBQWlELENBQWpELENBQXhCLENBQUE7O0FBQ0FQLFFBQUFBLFVBQVUsQ0FBQ3VELEVBQVgsR0FBZ0J5QixlQUFlLENBQUN6QixFQUFoQyxDQUFBO0FBQ0gsT0FBQTs7QUFDRCxNQUFBLE9BQU92RCxVQUFQLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsT0FBTyxJQUFQLENBQUE7QUFDSCxHQUFBOztFQUVEaUYseUJBQXlCLENBQUNqRixVQUFELEVBQWE7QUFDbEMsSUFBQSxJQUFJa0YsS0FBSixDQUFBO0FBQ0EsSUFBQSxJQUFJQyxTQUFKLENBQUE7QUFDQSxJQUFBLElBQUl6QyxJQUFKLENBQUE7SUFHQSxJQUFLbEIsQ0FBQUEsYUFBTCxHQUFxQnhCLFVBQVUsQ0FBQ2tELElBQVgsR0FBa0IsSUFBQSxDQUFLN0IsZUFBdkIsR0FBeUMsSUFBOUQsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLSCxXQUFMLEdBQW1CbEIsVUFBVSxDQUFDdUQsRUFBOUIsQ0FBQTs7QUFHQSxJQUFBLEtBQUssSUFBSWpFLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdVLFVBQVUsQ0FBQ3lELFVBQVgsQ0FBc0JsRSxNQUExQyxFQUFrREQsQ0FBQyxFQUFuRCxFQUF1RDtBQUNuRCxNQUFBLE1BQU1vRSxTQUFTLEdBQUcxRCxVQUFVLENBQUN5RCxVQUFYLENBQXNCbkUsQ0FBdEIsQ0FBbEIsQ0FBQTtNQUNBLE1BQU1xRSxTQUFTLEdBQUcsSUFBS0MsQ0FBQUEsYUFBTCxDQUFtQkYsU0FBUyxDQUFDRyxhQUE3QixDQUFsQixDQUFBOztBQUNBLE1BQUEsSUFBSUYsU0FBUyxDQUFDeUIsSUFBVixLQUFtQkMsc0JBQXZCLEVBQStDO0FBQzNDLFFBQUEsSUFBQSxDQUFLaEcsaUJBQUwsQ0FBdUJpRyxHQUF2QixDQUEyQjVCLFNBQVMsQ0FBQ0csYUFBckMsQ0FBQSxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0lBRUQsSUFBSSxJQUFBLENBQUtyQyxhQUFULEVBQXdCO01BQ3BCLElBQUksQ0FBQyxJQUFLWixDQUFBQSxnQkFBVixFQUE0QjtRQUN4QixJQUFLRyxDQUFBQSx5QkFBTCxHQUFpQyxFQUFqQyxDQUFBO0FBQ0gsT0FBQTs7TUFHRCxJQUFLQSxDQUFBQSx5QkFBTCxDQUErQmxCLElBQS9CLENBQW9DO1FBQ2hDTCxJQUFJLEVBQUUsS0FBS2Esa0JBRHFCO0FBRWhDa0YsUUFBQUEsTUFBTSxFQUFFLENBQUE7T0FGWixDQUFBLENBQUE7O01BT0EsTUFBTUMsZ0JBQWdCLEdBQUdwRCxJQUFJLENBQUNxRCxHQUFMLENBQVMsSUFBQSxDQUFLOUUsb0JBQUwsS0FBOEIsQ0FBOUIsR0FBa0MsSUFBS0QsQ0FBQUEsbUJBQUwsR0FBMkIsSUFBS0MsQ0FBQUEsb0JBQWxFLEdBQXlGLENBQWxHLEVBQXFHLEdBQXJHLENBQXpCLENBQUE7O0FBQ0EsTUFBQSxLQUFLLElBQUlyQixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHLElBQUt5QixDQUFBQSx5QkFBTCxDQUErQnhCLE1BQW5ELEVBQTJERCxDQUFDLEVBQTVELEVBQWdFO1FBRTVELElBQUksQ0FBQyxJQUFLc0IsQ0FBQUEsZ0JBQVYsRUFBNEI7QUFDeEIsVUFBQSxJQUFBLENBQUtHLHlCQUFMLENBQStCekIsQ0FBL0IsQ0FBa0NpRyxDQUFBQSxNQUFsQyxHQUEyQyxHQUEzQyxDQUFBO1NBREosTUFFTyxJQUFJakcsQ0FBQyxLQUFLLElBQUEsQ0FBS3lCLHlCQUFMLENBQStCeEIsTUFBL0IsR0FBd0MsQ0FBbEQsRUFBcUQ7QUFDeEQsVUFBQSxJQUFBLENBQUt3Qix5QkFBTCxDQUErQnpCLENBQS9CLEVBQWtDaUcsTUFBbEMsSUFBNkMsTUFBTUMsZ0JBQW5ELENBQUE7QUFDSCxTQUZNLE1BRUE7QUFDSCxVQUFBLElBQUEsQ0FBS3pFLHlCQUFMLENBQStCekIsQ0FBL0IsQ0FBa0NpRyxDQUFBQSxNQUFsQyxHQUEyQ0MsZ0JBQTNDLENBQUE7QUFDSCxTQUFBOztRQUNETixLQUFLLEdBQUcsSUFBSzlELENBQUFBLFVBQUwsQ0FBZ0IsSUFBQSxDQUFLTCx5QkFBTCxDQUErQnpCLENBQS9CLENBQWtDRSxDQUFBQSxJQUFsRCxDQUFSLENBQUE7O0FBR0EsUUFBQSxLQUFLLElBQUlrRyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHUixLQUFLLENBQUMzRCxVQUFOLENBQWlCaEMsTUFBckMsRUFBNkNtRyxDQUFDLEVBQTlDLEVBQWtEO0FBQzlDUCxVQUFBQSxTQUFTLEdBQUdELEtBQUssQ0FBQzNELFVBQU4sQ0FBaUJtRSxDQUFqQixDQUFaLENBQUE7QUFDQWhELFVBQUFBLElBQUksR0FBRyxJQUFBLENBQUt6RCxjQUFMLENBQW9Ca0QsUUFBcEIsQ0FBNkJnRCxTQUFTLENBQUMzRixJQUFWLEdBQWlCLFlBQWpCLEdBQWdDRixDQUE3RCxDQUFQLENBQUE7O1VBQ0EsSUFBSSxDQUFDb0QsSUFBTCxFQUFXO1lBQ1BBLElBQUksR0FBRyxLQUFLekQsY0FBTCxDQUFvQmtELFFBQXBCLENBQTZCZ0QsU0FBUyxDQUFDM0YsSUFBdkMsQ0FBUCxDQUFBO1lBQ0FrRCxJQUFJLENBQUNsRCxJQUFMLEdBQVkyRixTQUFTLENBQUMzRixJQUFWLEdBQWlCLFlBQWpCLEdBQWdDRixDQUE1QyxDQUFBO0FBQ0gsV0FBQTs7VUFFRCxJQUFJQSxDQUFDLEtBQUssSUFBS3lCLENBQUFBLHlCQUFMLENBQStCeEIsTUFBL0IsR0FBd0MsQ0FBbEQsRUFBcUQ7QUFDakRtRCxZQUFBQSxJQUFJLENBQUNpRCxLQUFMLEVBQUEsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0lBRUQsSUFBSy9FLENBQUFBLGdCQUFMLEdBQXdCLElBQXhCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0Qsb0JBQUwsR0FBNEJYLFVBQVUsQ0FBQ3lDLElBQXZDLENBQUE7SUFDQSxJQUFLL0IsQ0FBQUEsbUJBQUwsR0FBMkIsQ0FBM0IsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLRyw2QkFBTCxHQUFxQ2IsVUFBVSxDQUFDNEYsa0JBQWhELENBQUE7SUFHQSxNQUFNMUUsV0FBVyxHQUFHLElBQUEsQ0FBS0EsV0FBekIsQ0FBQTtBQUNBLElBQUEsTUFBTTJFLG1CQUFtQixHQUFHN0YsVUFBVSxDQUFDOEYsZ0JBQVgsSUFBK0I5RixVQUFVLENBQUM4RixnQkFBWCxHQUE4QixHQUE3RCxJQUFvRTlGLFVBQVUsQ0FBQzhGLGdCQUFYLEdBQThCLEdBQTlILENBQUE7SUFHQSxJQUFJQyxXQUFXLEdBQUcsQ0FBbEIsQ0FBQTtJQUNBLElBQUlDLGlCQUFpQixHQUFHLENBQXhCLENBQUE7O0FBQ0EsSUFBQSxJQUFJSCxtQkFBSixFQUF5QjtNQUNyQixNQUFNSSxVQUFVLEdBQUcvRSxXQUFXLENBQUNnRixnQkFBWixHQUErQmxHLFVBQVUsQ0FBQzhGLGdCQUE3RCxDQUFBO0FBQ0FDLE1BQUFBLFdBQVcsR0FBR0UsVUFBZCxDQUFBO0FBQ0FELE1BQUFBLGlCQUFpQixHQUFHQyxVQUFwQixDQUFBO0FBQ0gsS0FBQTs7SUFDRCxJQUFLakYsQ0FBQUEsWUFBTCxHQUFvQitFLFdBQXBCLENBQUE7SUFDQSxJQUFLOUUsQ0FBQUEsa0JBQUwsR0FBMEIrRSxpQkFBMUIsQ0FBQTs7QUFHQSxJQUFBLEtBQUssSUFBSTFHLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUc0QixXQUFXLENBQUNLLFVBQVosQ0FBdUJoQyxNQUEzQyxFQUFtREQsQ0FBQyxFQUFwRCxFQUF3RDtBQUNwRG9ELE1BQUFBLElBQUksR0FBRyxJQUFBLENBQUt6RCxjQUFMLENBQW9Ca0QsUUFBcEIsQ0FBNkJqQixXQUFXLENBQUNLLFVBQVosQ0FBdUJqQyxDQUF2QixDQUFBLENBQTBCRSxJQUF2RCxDQUFQLENBQUE7O01BQ0EsSUFBSSxDQUFDa0QsSUFBTCxFQUFXO1FBQ1AsTUFBTWhELEtBQUssR0FBR3lHLE1BQU0sQ0FBQ0MsUUFBUCxDQUFnQmxGLFdBQVcsQ0FBQ0ssVUFBWixDQUF1QmpDLENBQXZCLENBQUEsQ0FBMEJJLEtBQTFDLENBQW1Ed0IsR0FBQUEsV0FBVyxDQUFDSyxVQUFaLENBQXVCakMsQ0FBdkIsRUFBMEJJLEtBQTdFLEdBQXFGd0IsV0FBVyxDQUFDeEIsS0FBL0csQ0FBQTtRQUNBZ0QsSUFBSSxHQUFHLElBQUkyRCxRQUFKLENBQWFuRixXQUFXLENBQUNLLFVBQVosQ0FBdUJqQyxDQUF2QixDQUFBLENBQTBCZ0gsU0FBdkMsRUFBa0QsS0FBS3RGLFlBQXZELEVBQXFFdEIsS0FBckUsRUFBNEUsSUFBNUUsRUFBa0Z3QixXQUFXLENBQUN2QixJQUE5RixFQUFvRyxJQUFLUCxDQUFBQSxhQUF6RyxDQUFQLENBQUE7UUFDQXNELElBQUksQ0FBQ2xELElBQUwsR0FBWTBCLFdBQVcsQ0FBQ0ssVUFBWixDQUF1QmpDLENBQXZCLENBQUEsQ0FBMEJFLElBQXRDLENBQUE7O0FBQ0EsUUFBQSxJQUFBLENBQUtQLGNBQUwsQ0FBb0JzSCxPQUFwQixDQUE0QjdELElBQTVCLENBQUEsQ0FBQTtBQUNILE9BTEQsTUFLTztBQUNIQSxRQUFBQSxJQUFJLENBQUM4RCxLQUFMLEVBQUEsQ0FBQTtBQUNILE9BQUE7O0FBQ0QsTUFBQSxJQUFJeEcsVUFBVSxDQUFDeUMsSUFBWCxHQUFrQixDQUF0QixFQUF5QjtRQUNyQkMsSUFBSSxDQUFDK0QsV0FBTCxHQUFtQixHQUFuQixDQUFBO0FBQ0gsT0FGRCxNQUVPO1FBQ0gvRCxJQUFJLENBQUMrRCxXQUFMLEdBQW1CdkYsV0FBVyxDQUFDSyxVQUFaLENBQXVCakMsQ0FBdkIsQ0FBQSxDQUEwQm9ILGdCQUE3QyxDQUFBO0FBQ0gsT0FBQTs7QUFDRGhFLE1BQUFBLElBQUksQ0FBQ2lFLElBQUwsRUFBQSxDQUFBOztBQUNBLE1BQUEsSUFBSWQsbUJBQUosRUFBeUI7UUFDckJuRCxJQUFJLENBQUNELElBQUwsR0FBWXZCLFdBQVcsQ0FBQ2dGLGdCQUFaLEdBQStCbEcsVUFBVSxDQUFDOEYsZ0JBQXRELENBQUE7QUFDSCxPQUZELE1BRU87UUFDSCxNQUFNYyxTQUFTLEdBQUcxRixXQUFXLENBQUN4QixLQUFaLElBQXFCLENBQXJCLEdBQXlCLENBQXpCLEdBQTZCLElBQUEsQ0FBS3FDLG1CQUFwRCxDQUFBO1FBQ0FXLElBQUksQ0FBQ0QsSUFBTCxHQUFZbUUsU0FBWixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztFQUVEQyxrQkFBa0IsQ0FBQ0MsWUFBRCxFQUFlO0FBQzdCLElBQUEsSUFBSSxDQUFDLElBQUsxRixDQUFBQSxVQUFMLENBQWdCMEYsWUFBaEIsQ0FBTCxFQUFvQztBQUNoQyxNQUFBLE9BQUE7QUFDSCxLQUFBOztJQUdELElBQUk5RyxVQUFVLEdBQUcsSUFBS3FFLENBQUFBLGVBQUwsQ0FBcUIsSUFBSy9ELENBQUFBLGdCQUExQixFQUE0Q3dHLFlBQTVDLENBQWpCLENBQUE7O0lBQ0EsSUFBSSxDQUFDOUcsVUFBTCxFQUFpQjtNQUNiLElBQUtmLENBQUFBLGNBQUwsQ0FBb0I4SCxXQUFwQixFQUFBLENBQUE7O01BQ0EvRyxVQUFVLEdBQUcsSUFBSUMsY0FBSixDQUFtQjtBQUFFaUQsUUFBQUEsSUFBSSxFQUFFLElBQVI7QUFBY0ssUUFBQUEsRUFBRSxFQUFFdUQsWUFBQUE7QUFBbEIsT0FBbkIsQ0FBYixDQUFBO0FBQ0gsS0FBQTs7SUFDRCxJQUFLN0IsQ0FBQUEseUJBQUwsQ0FBK0JqRixVQUEvQixDQUFBLENBQUE7QUFDSCxHQUFBOztFQUVEZ0gsZUFBZSxDQUFDQyxVQUFELEVBQWFYLFNBQWIsRUFBd0I1RyxLQUF4QixFQUErQkMsSUFBL0IsRUFBcUM7QUFDaEQsSUFBQSxNQUFNdUgsSUFBSSxHQUFHRCxVQUFVLENBQUNFLEtBQVgsQ0FBaUIsR0FBakIsQ0FBYixDQUFBOztJQUNBLElBQUlqQyxLQUFLLEdBQUcsSUFBSzlELENBQUFBLFVBQUwsQ0FBZ0I4RixJQUFJLENBQUMsQ0FBRCxDQUFwQixDQUFaLENBQUE7O0lBQ0EsSUFBSSxDQUFDaEMsS0FBTCxFQUFZO0FBQ1JBLE1BQUFBLEtBQUssR0FBRyxJQUFJekYsU0FBSixDQUFjLElBQWQsRUFBb0J5SCxJQUFJLENBQUMsQ0FBRCxDQUF4QixFQUE2QixHQUE3QixDQUFSLENBQUE7QUFDQSxNQUFBLElBQUEsQ0FBS2hJLE9BQUwsQ0FBYWdJLElBQUksQ0FBQyxDQUFELENBQWpCLElBQXdCaEMsS0FBeEIsQ0FBQTs7QUFDQSxNQUFBLElBQUEsQ0FBSy9GLFdBQUwsQ0FBaUJVLElBQWpCLENBQXNCcUgsSUFBSSxDQUFDLENBQUQsQ0FBMUIsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFDRGhDLElBQUFBLEtBQUssQ0FBQ2tDLFlBQU4sQ0FBbUJGLElBQW5CLEVBQXlCWixTQUF6QixDQUFBLENBQUE7O0lBQ0EsSUFBSTVHLEtBQUssS0FBSzJILFNBQWQsRUFBeUI7TUFDckJuQyxLQUFLLENBQUN4RixLQUFOLEdBQWNBLEtBQWQsQ0FBQTtBQUNILEtBQUE7O0lBQ0QsSUFBSUMsSUFBSSxLQUFLMEgsU0FBYixFQUF3QjtNQUNwQm5DLEtBQUssQ0FBQ3ZGLElBQU4sR0FBYUEsSUFBYixDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFJLENBQUMsS0FBS2EsUUFBTixJQUFrQixLQUFLQyxTQUF2QixJQUFvQyxJQUFLaUIsQ0FBQUEsUUFBN0MsRUFBdUQ7QUFDbkQsTUFBQSxJQUFBLENBQUtpRixJQUFMLEVBQUEsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztFQUVEVyxvQkFBb0IsQ0FBQ0MsUUFBRCxFQUFXO0lBQzNCLElBQUlDLG1CQUFtQixDQUFDQyxPQUFwQixDQUE0QkYsUUFBNUIsQ0FBMEMsS0FBQSxDQUFDLENBQS9DLEVBQWtEO0FBQzlDLE1BQUEsT0FBTyxLQUFQLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsTUFBTXJDLEtBQUssR0FBRyxJQUFBLENBQUs5RCxVQUFMLENBQWdCbUcsUUFBaEIsQ0FBZCxDQUFBOztJQUNBLElBQUksQ0FBQ3JDLEtBQUwsRUFBWTtNQUNSd0MsS0FBSyxDQUFDQyxLQUFOLENBQVksMkVBQVosQ0FBQSxDQUFBO0FBQ0EsTUFBQSxPQUFPLEtBQVAsQ0FBQTtBQUNILEtBQUE7O0lBRUR6QyxLQUFLLENBQUMzRCxVQUFOLEdBQW1CLEVBQW5CLENBQUE7QUFDQSxJQUFBLE9BQU8sSUFBUCxDQUFBO0FBQ0gsR0FBQTs7RUFFRG9GLElBQUksQ0FBQ3hGLFNBQUQsRUFBWTtBQUNaLElBQUEsSUFBSUEsU0FBSixFQUFlO01BQ1gsSUFBSzBGLENBQUFBLGtCQUFMLENBQXdCMUYsU0FBeEIsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7SUFDRCxJQUFLWCxDQUFBQSxRQUFMLEdBQWdCLElBQWhCLENBQUE7QUFDSCxHQUFBOztBQUVEbUYsRUFBQUEsS0FBSyxHQUFHO0lBQ0osSUFBS25GLENBQUFBLFFBQUwsR0FBZ0IsS0FBaEIsQ0FBQTtBQUNILEdBQUE7O0FBRURnRyxFQUFBQSxLQUFLLEdBQUc7SUFDSixJQUFLbkcsQ0FBQUEsa0JBQUwsR0FBMEIsSUFBMUIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLGdCQUFMLEdBQXdCQyxnQkFBeEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFFBQUwsR0FBZ0IsS0FBaEIsQ0FBQTtJQUNBLElBQUtFLENBQUFBLG1CQUFMLEdBQTJCLEdBQTNCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxvQkFBTCxHQUE0QixHQUE1QixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsZ0JBQUwsR0FBd0IsS0FBeEIsQ0FBQTtJQUNBLElBQUtJLENBQUFBLFlBQUwsR0FBb0IsQ0FBcEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLGtCQUFMLEdBQTBCLENBQTFCLENBQUE7O0lBQ0EsSUFBS2hDLENBQUFBLGNBQUwsQ0FBb0I4SCxXQUFwQixFQUFBLENBQUE7QUFDSCxHQUFBOztBQUVEYSxFQUFBQSxNQUFNLEdBQUc7SUFDTCxJQUFLM0ksQ0FBQUEsY0FBTCxDQUFvQjJJLE1BQXBCLEVBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRURDLE1BQU0sQ0FBQ0MsRUFBRCxFQUFLO0lBQ1AsSUFBSSxDQUFDLElBQUt0SCxDQUFBQSxRQUFWLEVBQW9CO0FBQ2hCLE1BQUEsT0FBQTtBQUNILEtBQUE7O0FBQ0QsSUFBQSxJQUFJMEUsS0FBSixDQUFBO0FBQ0EsSUFBQSxJQUFJQyxTQUFKLENBQUE7QUFDQSxJQUFBLElBQUl6QyxJQUFKLENBQUE7SUFDQSxJQUFLekIsQ0FBQUEsa0JBQUwsR0FBMEIsSUFBQSxDQUFLRCxZQUEvQixDQUFBO0lBQ0EsSUFBS0EsQ0FBQUEsWUFBTCxJQUFxQjhHLEVBQXJCLENBQUE7O0FBR0EsSUFBQSxNQUFNOUgsVUFBVSxHQUFHLElBQUEsQ0FBS3FFLGVBQUwsQ0FBcUIsSUFBQSxDQUFLL0QsZ0JBQTFCLENBQW5CLENBQUE7O0FBQ0EsSUFBQSxJQUFJTixVQUFKLEVBQ0ksSUFBS2lGLENBQUFBLHlCQUFMLENBQStCakYsVUFBL0IsQ0FBQSxDQUFBOztJQUVKLElBQUksSUFBQSxDQUFLWSxnQkFBVCxFQUEyQjtNQUN2QixJQUFLRixDQUFBQSxtQkFBTCxJQUE0Qm9ILEVBQTVCLENBQUE7O0FBQ0EsTUFBQSxJQUFJLElBQUtwSCxDQUFBQSxtQkFBTCxJQUE0QixJQUFBLENBQUtDLG9CQUFyQyxFQUEyRDtBQUN2RCxRQUFBLE1BQU02RSxnQkFBZ0IsR0FBRyxJQUFLN0UsQ0FBQUEsb0JBQUwsS0FBOEIsQ0FBOUIsR0FBa0MsSUFBQSxDQUFLRCxtQkFBTCxHQUEyQixJQUFLQyxDQUFBQSxvQkFBbEUsR0FBeUYsQ0FBbEgsQ0FBQTs7QUFFQSxRQUFBLEtBQUssSUFBSXJCLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsSUFBS3lCLENBQUFBLHlCQUFMLENBQStCeEIsTUFBbkQsRUFBMkRELENBQUMsRUFBNUQsRUFBZ0U7VUFDNUQ0RixLQUFLLEdBQUcsSUFBSzlELENBQUFBLFVBQUwsQ0FBZ0IsSUFBQSxDQUFLTCx5QkFBTCxDQUErQnpCLENBQS9CLENBQWtDRSxDQUFBQSxJQUFsRCxDQUFSLENBQUE7QUFDQSxVQUFBLE1BQU11SSxXQUFXLEdBQUcsSUFBQSxDQUFLaEgseUJBQUwsQ0FBK0J6QixDQUEvQixFQUFrQ2lHLE1BQXRELENBQUE7O0FBQ0EsVUFBQSxLQUFLLElBQUlHLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdSLEtBQUssQ0FBQzNELFVBQU4sQ0FBaUJoQyxNQUFyQyxFQUE2Q21HLENBQUMsRUFBOUMsRUFBa0Q7QUFDOUNQLFlBQUFBLFNBQVMsR0FBR0QsS0FBSyxDQUFDM0QsVUFBTixDQUFpQm1FLENBQWpCLENBQVosQ0FBQTtBQUNBaEQsWUFBQUEsSUFBSSxHQUFHLElBQUEsQ0FBS3pELGNBQUwsQ0FBb0JrRCxRQUFwQixDQUE2QmdELFNBQVMsQ0FBQzNGLElBQVYsR0FBaUIsWUFBakIsR0FBZ0NGLENBQTdELENBQVAsQ0FBQTs7QUFDQSxZQUFBLElBQUlvRCxJQUFKLEVBQVU7Y0FDTkEsSUFBSSxDQUFDK0QsV0FBTCxHQUFtQixDQUFDLEdBQUEsR0FBTWpCLGdCQUFQLElBQTJCTCxTQUFTLENBQUN1QixnQkFBckMsR0FBd0RxQixXQUEzRSxDQUFBO0FBQ0gsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBOztRQUVEN0MsS0FBSyxHQUFHLEtBQUtoRSxXQUFiLENBQUE7O0FBQ0EsUUFBQSxLQUFLLElBQUk1QixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHNEYsS0FBSyxDQUFDM0QsVUFBTixDQUFpQmhDLE1BQXJDLEVBQTZDRCxDQUFDLEVBQTlDLEVBQWtEO0FBQzlDNkYsVUFBQUEsU0FBUyxHQUFHRCxLQUFLLENBQUMzRCxVQUFOLENBQWlCakMsQ0FBakIsQ0FBWixDQUFBO0FBQ0EsVUFBQSxJQUFBLENBQUtMLGNBQUwsQ0FBb0JrRCxRQUFwQixDQUE2QmdELFNBQVMsQ0FBQzNGLElBQXZDLENBQTZDaUgsQ0FBQUEsV0FBN0MsR0FBMkRqQixnQkFBZ0IsR0FBR0wsU0FBUyxDQUFDdUIsZ0JBQXhGLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FwQkQsTUFvQk87UUFDSCxJQUFLOUYsQ0FBQUEsZ0JBQUwsR0FBd0IsS0FBeEIsQ0FBQTtBQUVBLFFBQUEsTUFBTW9ILFdBQVcsR0FBRyxJQUFLMUcsQ0FBQUEscUJBQUwsQ0FBMkIvQixNQUEvQyxDQUFBO0FBQ0EsUUFBQSxNQUFNMEksVUFBVSxHQUFHLElBQUEsQ0FBS2hKLGNBQUwsQ0FBb0JpSixLQUFwQixDQUEwQjNJLE1BQTdDLENBQUE7O0FBQ0EsUUFBQSxLQUFLLElBQUlELENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcySSxVQUFVLEdBQUdELFdBQWpDLEVBQThDMUksQ0FBQyxFQUEvQyxFQUFtRDtBQUMvQyxVQUFBLElBQUEsQ0FBS0wsY0FBTCxDQUFvQmtKLFVBQXBCLENBQStCLENBQS9CLENBQUEsQ0FBQTtBQUNILFNBQUE7O1FBQ0QsSUFBS3BILENBQUFBLHlCQUFMLEdBQWlDLEVBQWpDLENBQUE7UUFFQW1FLEtBQUssR0FBRyxLQUFLaEUsV0FBYixDQUFBOztBQUNBLFFBQUEsS0FBSyxJQUFJNUIsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRzRGLEtBQUssQ0FBQzNELFVBQU4sQ0FBaUJoQyxNQUFyQyxFQUE2Q0QsQ0FBQyxFQUE5QyxFQUFrRDtBQUM5QzZGLFVBQUFBLFNBQVMsR0FBR0QsS0FBSyxDQUFDM0QsVUFBTixDQUFpQmpDLENBQWpCLENBQVosQ0FBQTtVQUNBb0QsSUFBSSxHQUFHLEtBQUt6RCxjQUFMLENBQW9Ca0QsUUFBcEIsQ0FBNkJnRCxTQUFTLENBQUMzRixJQUF2QyxDQUFQLENBQUE7O0FBQ0EsVUFBQSxJQUFJa0QsSUFBSixFQUFVO0FBQ05BLFlBQUFBLElBQUksQ0FBQytELFdBQUwsR0FBbUJ0QixTQUFTLENBQUN1QixnQkFBN0IsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBekNELE1BeUNPO01BQ0gsSUFBSSxJQUFBLENBQUt4RixXQUFMLENBQWlCa0gsVUFBakIsQ0FBNEIzSixXQUE1QixLQUE0QzRKLFFBQWhELEVBQTBEO1FBQ3REbkQsS0FBSyxHQUFHLEtBQUtoRSxXQUFiLENBQUE7O0FBQ0EsUUFBQSxLQUFLLElBQUk1QixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHNEYsS0FBSyxDQUFDM0QsVUFBTixDQUFpQmhDLE1BQXJDLEVBQTZDRCxDQUFDLEVBQTlDLEVBQWtEO0FBQzlDNkYsVUFBQUEsU0FBUyxHQUFHRCxLQUFLLENBQUMzRCxVQUFOLENBQWlCakMsQ0FBakIsQ0FBWixDQUFBO1VBQ0FvRCxJQUFJLEdBQUcsS0FBS3pELGNBQUwsQ0FBb0JrRCxRQUFwQixDQUE2QmdELFNBQVMsQ0FBQzNGLElBQXZDLENBQVAsQ0FBQTs7QUFDQSxVQUFBLElBQUlrRCxJQUFKLEVBQVU7QUFDTkEsWUFBQUEsSUFBSSxDQUFDK0QsV0FBTCxHQUFtQnRCLFNBQVMsQ0FBQ3VCLGdCQUE3QixDQUFBOztBQUNBLFlBQUEsSUFBSXZCLFNBQVMsQ0FBQ21ELE1BQVYsQ0FBaUJDLGNBQXJCLEVBQXFDO0FBQ2pDN0YsY0FBQUEsSUFBSSxDQUFDaEQsS0FBTCxHQUFheUYsU0FBUyxDQUFDekYsS0FBdkIsQ0FBQTtBQUNILGFBQUE7QUFDSixXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBOztBQUNELElBQUEsSUFBQSxDQUFLVCxjQUFMLENBQW9CNEksTUFBcEIsQ0FBMkJDLEVBQTNCLENBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRURsRSxhQUFhLENBQUNwRSxJQUFELEVBQU87QUFDaEIsSUFBQSxPQUFPLElBQUtZLENBQUFBLFdBQUwsQ0FBaUJaLElBQWpCLENBQVAsQ0FBQTtBQUNILEdBQUE7O0FBcmpCZ0I7Ozs7In0=
