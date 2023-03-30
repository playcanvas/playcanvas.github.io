/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { Debug } from '../../../core/debug.js';
import { sortPriority } from '../../../core/sort.js';
import { AnimClip } from '../evaluator/anim-clip.js';
import { AnimState } from './anim-state.js';
import { AnimNode } from './anim-node.js';
import { AnimTransition } from './anim-transition.js';
import { ANIM_STATE_START, ANIM_INTERRUPTION_NONE, ANIM_STATE_END, ANIM_STATE_ANY, ANIM_NOT_EQUAL_TO, ANIM_EQUAL_TO, ANIM_LESS_THAN_EQUAL_TO, ANIM_GREATER_THAN_EQUAL_TO, ANIM_LESS_THAN, ANIM_GREATER_THAN, ANIM_INTERRUPTION_NEXT_PREV, ANIM_INTERRUPTION_PREV_NEXT, ANIM_INTERRUPTION_NEXT, ANIM_INTERRUPTION_PREV, ANIM_PARAMETER_TRIGGER, ANIM_CONTROL_STATES } from './constants.js';

/**
 * The AnimController manages the animations for its entity, based on the provided state graph and
 * parameters. Its update method determines which state the controller should be in based on the
 * current time, parameters and available states / transitions. It also ensures the AnimEvaluator
 * is supplied with the correct animations, based on the currently active state.
 *
 * @ignore
 */
class AnimController {
  /**
   * Create a new AnimController.
   *
   * @param {import('../evaluator/anim-evaluator.js').AnimEvaluator} animEvaluator - The
   * animation evaluator used to blend all current playing animation keyframes and update the
   * entities properties based on the current animation values.
   * @param {object[]} states - The list of states used to form the controller state graph.
   * @param {object[]} transitions - The list of transitions used to form the controller state
   * graph.
   * @param {object[]} parameters - The anim components parameters.
   * @param {boolean} activate - Determines whether the anim controller should automatically play
   * once all {@link AnimNodes} are assigned animations.
   * @param {import('../../../core/event-handler.js').EventHandler} eventHandler - The event
   * handler which should be notified with anim events.
   * @param {Set} consumedTriggers - Used to set triggers back to their default state after they
   * have been consumed by a transition.
   */
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

  // return all the transitions that have the given stateName as their source state
  _findTransitionsFromState(stateName) {
    let transitions = this._findTransitionsFromStateCache[stateName];
    if (!transitions) {
      transitions = this._transitions.filter(function (transition) {
        return transition.from === stateName;
      });

      // sort transitions in priority order
      sortPriority(transitions);
      this._findTransitionsFromStateCache[stateName] = transitions;
    }
    return transitions;
  }

  // return all the transitions that contain the given source and destination states
  _findTransitionsBetweenStates(sourceStateName, destinationStateName) {
    let transitions = this._findTransitionsBetweenStatesCache[sourceStateName + '->' + destinationStateName];
    if (!transitions) {
      transitions = this._transitions.filter(function (transition) {
        return transition.from === sourceStateName && transition.to === destinationStateName;
      });

      // sort transitions in priority order
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

    // If from and to are supplied, find transitions that include the required source and destination states
    if (from && to) {
      transitions = transitions.concat(this._findTransitionsBetweenStates(from, to));
    } else {
      // If no transition is active, look for transitions from the active & any states.
      if (!this._isTransitioning) {
        transitions = transitions.concat(this._findTransitionsFromState(this._activeStateName));
        transitions = transitions.concat(this._findTransitionsFromState(ANIM_STATE_ANY));
      } else {
        // Otherwise look for transitions from the previous and active states based on the current interruption source.
        // Accept transitions from the any state unless the interruption source is set to none
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

    // filter out transitions that don't have their conditions met
    transitions = transitions.filter(transition => {
      // if the transition is moving to the already active state, ignore it
      if (transition.to === this.activeStateName) {
        return false;
      }
      // when an exit time is present, we should only exit if it falls within the current frame delta time
      if (transition.hasExitTime) {
        let progressBefore = this._getActiveStateProgressForTime(this._timeInStateBefore);
        let progress = this._getActiveStateProgressForTime(this._timeInState);
        // when the exit time is smaller than 1 and the state is looping, we should check for an exit each loop
        if (transition.exitTime < 1.0 && this.activeState.loop) {
          progressBefore -= Math.floor(progressBefore);
          progress -= Math.floor(progress);
        }
        // return false if exit time isn't within the frames delta time
        if (!(transition.exitTime > progressBefore && transition.exitTime <= progress)) {
          return null;
        }
      }
      // if the exitTime condition has been met or is not present, check condition parameters
      return this._transitionHasConditionsMet(transition);
    });

    // return the highest priority transition to use
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
    // If transition.from is set, transition from the active state irregardless of the transition.from value (this could be the previous, active or ANY states).
    // Otherwise the previousState is cleared.
    this.previousState = transition.from ? this.activeStateName : null;
    this.activeState = transition.to;

    // turn off any triggers which were required to activate this transition
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

      // record the transition source state in the previous states array
      this._transitionPreviousStates.push({
        name: this._previousStateName,
        weight: 1
      });

      // if this new transition was activated during another transition, update the previous transition state weights based
      // on the progress through the previous transition.
      const interpolatedTime = Math.min(this._totalTransitionTime !== 0 ? this._currTransitionTime / this._totalTransitionTime : 1, 1.0);
      for (let i = 0; i < this._transitionPreviousStates.length; i++) {
        // interpolate the weights of the most recent previous state and all other previous states based on the progress through the previous transition
        if (!this._isTransitioning) {
          this._transitionPreviousStates[i].weight = 1.0;
        } else if (i !== this._transitionPreviousStates.length - 1) {
          this._transitionPreviousStates[i].weight *= 1.0 - interpolatedTime;
        } else {
          this._transitionPreviousStates[i].weight = interpolatedTime;
        }
        state = this._findState(this._transitionPreviousStates[i].name);
        // update the animations of previous states, set their name to include their position in the previous state array
        // to uniquely identify animations from the same state that were added during different transitions
        for (let j = 0; j < state.animations.length; j++) {
          animation = state.animations[j];
          clip = this._animEvaluator.findClip(animation.name + '.previous.' + i);
          if (!clip) {
            clip = this._animEvaluator.findClip(animation.name);
            clip.name = animation.name + '.previous.' + i;
          }
          // // pause previous animation clips to reduce their impact on performance
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

    // set the time in the new state to 0 or to a value based on transitionOffset if one was given
    let timeInState = 0;
    let timeInStateBefore = 0;
    if (hasTransitionOffset) {
      const offsetTime = activeState.timelineDuration * transition.transitionOffset;
      timeInState = offsetTime;
      timeInStateBefore = offsetTime;
    }
    this._timeInState = timeInState;
    this._timeInStateBefore = timeInStateBefore;

    // Add clips to the evaluator for each animation in the new state.
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

    // move to the given state, if a transition is present in the state graph use it. Otherwise move instantly to it.
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
      Debug.error('Attempting to unassign animation tracks from a state that does not exist.', nodeName);
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

    // transition between states if a transition is available from the active state
    const transition = this._findTransition(this._activeStateName);
    if (transition) this.updateStateFromTransition(transition);
    if (this._isTransitioning) {
      this._currTransitionTime += dt;
      if (this._currTransitionTime <= this._totalTransitionTime) {
        const interpolatedTime = this._totalTransitionTime !== 0 ? this._currTransitionTime / this._totalTransitionTime : 1;
        // while transitioning, set all previous state animations to be weighted by (1.0 - interpolationTime).
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
        // while transitioning, set active state animations to be weighted by (interpolationTime).
        state = this.activeState;
        for (let i = 0; i < state.animations.length; i++) {
          animation = state.animations[i];
          this._animEvaluator.findClip(animation.name).blendWeight = interpolatedTime * animation.normalizedWeight;
        }
      } else {
        this._isTransitioning = false;
        // when a transition ends, remove all previous state clips from the evaluator
        const activeClips = this.activeStateAnimations.length;
        const totalClips = this._animEvaluator.clips.length;
        for (let i = 0; i < totalClips - activeClips; i++) {
          this._animEvaluator.removeClip(0);
        }
        this._transitionPreviousStates = [];
        // when a transition ends, set the active state clip weights so they sum to 1
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1jb250cm9sbGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2FuaW0vY29udHJvbGxlci9hbmltLWNvbnRyb2xsZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHNvcnRQcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvc29ydC5qcyc7XG5pbXBvcnQgeyBBbmltQ2xpcCB9IGZyb20gJy4uL2V2YWx1YXRvci9hbmltLWNsaXAuanMnO1xuaW1wb3J0IHsgQW5pbVN0YXRlIH0gZnJvbSAnLi9hbmltLXN0YXRlLmpzJztcbmltcG9ydCB7IEFuaW1Ob2RlIH0gZnJvbSAnLi9hbmltLW5vZGUuanMnO1xuaW1wb3J0IHsgQW5pbVRyYW5zaXRpb24gfSBmcm9tICcuL2FuaW0tdHJhbnNpdGlvbi5qcyc7XG5pbXBvcnQge1xuICAgIEFOSU1fR1JFQVRFUl9USEFOLCBBTklNX0xFU1NfVEhBTiwgQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE8sIEFOSU1fTEVTU19USEFOX0VRVUFMX1RPLCBBTklNX0VRVUFMX1RPLCBBTklNX05PVF9FUVVBTF9UTyxcbiAgICBBTklNX0lOVEVSUlVQVElPTl9OT05FLCBBTklNX0lOVEVSUlVQVElPTl9QUkVWLCBBTklNX0lOVEVSUlVQVElPTl9ORVhULCBBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQsIEFOSU1fSU5URVJSVVBUSU9OX05FWFRfUFJFVixcbiAgICBBTklNX1BBUkFNRVRFUl9UUklHR0VSLFxuICAgIEFOSU1fU1RBVEVfU1RBUlQsIEFOSU1fU1RBVEVfRU5ELCBBTklNX1NUQVRFX0FOWSwgQU5JTV9DT05UUk9MX1NUQVRFU1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogVGhlIEFuaW1Db250cm9sbGVyIG1hbmFnZXMgdGhlIGFuaW1hdGlvbnMgZm9yIGl0cyBlbnRpdHksIGJhc2VkIG9uIHRoZSBwcm92aWRlZCBzdGF0ZSBncmFwaCBhbmRcbiAqIHBhcmFtZXRlcnMuIEl0cyB1cGRhdGUgbWV0aG9kIGRldGVybWluZXMgd2hpY2ggc3RhdGUgdGhlIGNvbnRyb2xsZXIgc2hvdWxkIGJlIGluIGJhc2VkIG9uIHRoZVxuICogY3VycmVudCB0aW1lLCBwYXJhbWV0ZXJzIGFuZCBhdmFpbGFibGUgc3RhdGVzIC8gdHJhbnNpdGlvbnMuIEl0IGFsc28gZW5zdXJlcyB0aGUgQW5pbUV2YWx1YXRvclxuICogaXMgc3VwcGxpZWQgd2l0aCB0aGUgY29ycmVjdCBhbmltYXRpb25zLCBiYXNlZCBvbiB0aGUgY3VycmVudGx5IGFjdGl2ZSBzdGF0ZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEFuaW1Db250cm9sbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQW5pbUNvbnRyb2xsZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZXZhbHVhdG9yL2FuaW0tZXZhbHVhdG9yLmpzJykuQW5pbUV2YWx1YXRvcn0gYW5pbUV2YWx1YXRvciAtIFRoZVxuICAgICAqIGFuaW1hdGlvbiBldmFsdWF0b3IgdXNlZCB0byBibGVuZCBhbGwgY3VycmVudCBwbGF5aW5nIGFuaW1hdGlvbiBrZXlmcmFtZXMgYW5kIHVwZGF0ZSB0aGVcbiAgICAgKiBlbnRpdGllcyBwcm9wZXJ0aWVzIGJhc2VkIG9uIHRoZSBjdXJyZW50IGFuaW1hdGlvbiB2YWx1ZXMuXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gc3RhdGVzIC0gVGhlIGxpc3Qgb2Ygc3RhdGVzIHVzZWQgdG8gZm9ybSB0aGUgY29udHJvbGxlciBzdGF0ZSBncmFwaC5cbiAgICAgKiBAcGFyYW0ge29iamVjdFtdfSB0cmFuc2l0aW9ucyAtIFRoZSBsaXN0IG9mIHRyYW5zaXRpb25zIHVzZWQgdG8gZm9ybSB0aGUgY29udHJvbGxlciBzdGF0ZVxuICAgICAqIGdyYXBoLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0W119IHBhcmFtZXRlcnMgLSBUaGUgYW5pbSBjb21wb25lbnRzIHBhcmFtZXRlcnMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBhY3RpdmF0ZSAtIERldGVybWluZXMgd2hldGhlciB0aGUgYW5pbSBjb250cm9sbGVyIHNob3VsZCBhdXRvbWF0aWNhbGx5IHBsYXlcbiAgICAgKiBvbmNlIGFsbCB7QGxpbmsgQW5pbU5vZGVzfSBhcmUgYXNzaWduZWQgYW5pbWF0aW9ucy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJykuRXZlbnRIYW5kbGVyfSBldmVudEhhbmRsZXIgLSBUaGUgZXZlbnRcbiAgICAgKiBoYW5kbGVyIHdoaWNoIHNob3VsZCBiZSBub3RpZmllZCB3aXRoIGFuaW0gZXZlbnRzLlxuICAgICAqIEBwYXJhbSB7U2V0fSBjb25zdW1lZFRyaWdnZXJzIC0gVXNlZCB0byBzZXQgdHJpZ2dlcnMgYmFjayB0byB0aGVpciBkZWZhdWx0IHN0YXRlIGFmdGVyIHRoZXlcbiAgICAgKiBoYXZlIGJlZW4gY29uc3VtZWQgYnkgYSB0cmFuc2l0aW9uLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFuaW1FdmFsdWF0b3IsIHN0YXRlcywgdHJhbnNpdGlvbnMsIHBhcmFtZXRlcnMsIGFjdGl2YXRlLCBldmVudEhhbmRsZXIsIGNvbnN1bWVkVHJpZ2dlcnMpIHtcbiAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvciA9IGFuaW1FdmFsdWF0b3I7XG4gICAgICAgIHRoaXMuX3N0YXRlcyA9IHt9O1xuICAgICAgICB0aGlzLl9zdGF0ZU5hbWVzID0gW107XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlciA9IGV2ZW50SGFuZGxlcjtcbiAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2VycyA9IGNvbnN1bWVkVHJpZ2dlcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZXNbc3RhdGVzW2ldLm5hbWVdID0gbmV3IEFuaW1TdGF0ZShcbiAgICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAgIHN0YXRlc1tpXS5uYW1lLFxuICAgICAgICAgICAgICAgIHN0YXRlc1tpXS5zcGVlZCxcbiAgICAgICAgICAgICAgICBzdGF0ZXNbaV0ubG9vcCxcbiAgICAgICAgICAgICAgICBzdGF0ZXNbaV0uYmxlbmRUcmVlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVOYW1lcy5wdXNoKHN0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl90cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLm1hcCgodHJhbnNpdGlvbikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBbmltVHJhbnNpdGlvbih7XG4gICAgICAgICAgICAgICAgLi4udHJhbnNpdGlvblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZSA9IHt9O1xuICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGUgPSB7fTtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHBhcmFtZXRlcnM7XG4gICAgICAgIHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYWN0aXZlU3RhdGVOYW1lID0gQU5JTV9TVEFURV9TVEFSVDtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hY3RpdmF0ZSA9IGFjdGl2YXRlO1xuXG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UgPSBBTklNX0lOVEVSUlVQVElPTl9OT05FO1xuICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMgPSBbXTtcblxuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSA9IDA7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gMDtcbiAgICB9XG5cbiAgICBnZXQgYW5pbUV2YWx1YXRvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1FdmFsdWF0b3I7XG4gICAgfVxuXG4gICAgc2V0IGFjdGl2ZVN0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICB0aGlzLl9hY3RpdmVTdGF0ZU5hbWUgPSBzdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmluZFN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlTmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVN0YXRlTmFtZTtcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVBbmltYXRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hY3RpdmVTdGF0ZS5hbmltYXRpb25zO1xuICAgIH1cblxuICAgIHNldCBwcmV2aW91c1N0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICB0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSA9IHN0YXRlTmFtZTtcbiAgICB9XG5cbiAgICBnZXQgcHJldmlvdXNTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbmRTdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0IHByZXZpb3VzU3RhdGVOYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJldmlvdXNTdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IHBsYXlhYmxlKCkge1xuICAgICAgICBsZXQgcGxheWFibGUgPSB0cnVlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3N0YXRlTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc3RhdGVzW3RoaXMuX3N0YXRlTmFtZXNbaV1dLnBsYXlhYmxlKSB7XG4gICAgICAgICAgICAgICAgcGxheWFibGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGxheWFibGU7XG4gICAgfVxuXG4gICAgc2V0IHBsYXlpbmcodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBwbGF5aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGxheWluZztcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVQcm9ncmVzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEFjdGl2ZVN0YXRlUHJvZ3Jlc3NGb3JUaW1lKHRoaXMuX3RpbWVJblN0YXRlKTtcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVEdXJhdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX1NUQVJUIHx8IHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX0VORClcbiAgICAgICAgICAgIHJldHVybiAwLjA7XG5cbiAgICAgICAgbGV0IG1heER1cmF0aW9uID0gMC4wO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBhY3RpdmVDbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcCh0aGlzLmFjdGl2ZVN0YXRlQW5pbWF0aW9uc1tpXS5uYW1lKTtcbiAgICAgICAgICAgIGlmIChhY3RpdmVDbGlwKSB7XG4gICAgICAgICAgICAgICAgbWF4RHVyYXRpb24gPSBNYXRoLm1heChtYXhEdXJhdGlvbiwgYWN0aXZlQ2xpcC50cmFjay5kdXJhdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1heER1cmF0aW9uO1xuICAgIH1cblxuICAgIHNldCBhY3RpdmVTdGF0ZUN1cnJlbnRUaW1lKHRpbWUpIHtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGVCZWZvcmUgPSB0aW1lO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSA9IHRpbWU7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNsaXAgPSB0aGlzLmFuaW1FdmFsdWF0b3IuZmluZENsaXAodGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnNbaV0ubmFtZSk7XG4gICAgICAgICAgICBpZiAoY2xpcCkge1xuICAgICAgICAgICAgICAgIGNsaXAudGltZSA9IHRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVDdXJyZW50VGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbWVJblN0YXRlO1xuICAgIH1cblxuICAgIGdldCB0cmFuc2l0aW9uaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNUcmFuc2l0aW9uaW5nO1xuICAgIH1cblxuICAgIGdldCB0cmFuc2l0aW9uUHJvZ3Jlc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgLyB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lO1xuICAgIH1cblxuICAgIGdldCBzdGF0ZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZU5hbWVzO1xuICAgIH1cblxuICAgIGFzc2lnbk1hc2sobWFzaykge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pbUV2YWx1YXRvci5hc3NpZ25NYXNrKG1hc2spO1xuICAgIH1cblxuICAgIF9maW5kU3RhdGUoc3RhdGVOYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZXNbc3RhdGVOYW1lXTtcbiAgICB9XG5cbiAgICBfZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUodGltZSkge1xuICAgICAgICBpZiAodGhpcy5hY3RpdmVTdGF0ZU5hbWUgPT09IEFOSU1fU1RBVEVfU1RBUlQgfHwgdGhpcy5hY3RpdmVTdGF0ZU5hbWUgPT09IEFOSU1fU1RBVEVfRU5EIHx8IHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX0FOWSlcbiAgICAgICAgICAgIHJldHVybiAxLjA7XG5cbiAgICAgICAgY29uc3QgYWN0aXZlQ2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAodGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnNbMF0ubmFtZSk7XG4gICAgICAgIGlmIChhY3RpdmVDbGlwKSB7XG4gICAgICAgICAgICByZXR1cm4gYWN0aXZlQ2xpcC5wcm9ncmVzc0ZvclRpbWUodGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYWxsIHRoZSB0cmFuc2l0aW9ucyB0aGF0IGhhdmUgdGhlIGdpdmVuIHN0YXRlTmFtZSBhcyB0aGVpciBzb3VyY2Ugc3RhdGVcbiAgICBfZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICBsZXQgdHJhbnNpdGlvbnMgPSB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZVtzdGF0ZU5hbWVdO1xuICAgICAgICBpZiAoIXRyYW5zaXRpb25zKSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRoaXMuX3RyYW5zaXRpb25zLmZpbHRlcihmdW5jdGlvbiAodHJhbnNpdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cmFuc2l0aW9uLmZyb20gPT09IHN0YXRlTmFtZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBzb3J0IHRyYW5zaXRpb25zIGluIHByaW9yaXR5IG9yZGVyXG4gICAgICAgICAgICBzb3J0UHJpb3JpdHkodHJhbnNpdGlvbnMpO1xuXG4gICAgICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZVtzdGF0ZU5hbWVdID0gdHJhbnNpdGlvbnM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRyYW5zaXRpb25zO1xuICAgIH1cblxuICAgIC8vIHJldHVybiBhbGwgdGhlIHRyYW5zaXRpb25zIHRoYXQgY29udGFpbiB0aGUgZ2l2ZW4gc291cmNlIGFuZCBkZXN0aW5hdGlvbiBzdGF0ZXNcbiAgICBfZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlcyhzb3VyY2VTdGF0ZU5hbWUsIGRlc3RpbmF0aW9uU3RhdGVOYW1lKSB7XG4gICAgICAgIGxldCB0cmFuc2l0aW9ucyA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXNDYWNoZVtzb3VyY2VTdGF0ZU5hbWUgKyAnLT4nICsgZGVzdGluYXRpb25TdGF0ZU5hbWVdO1xuICAgICAgICBpZiAoIXRyYW5zaXRpb25zKSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRoaXMuX3RyYW5zaXRpb25zLmZpbHRlcihmdW5jdGlvbiAodHJhbnNpdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cmFuc2l0aW9uLmZyb20gPT09IHNvdXJjZVN0YXRlTmFtZSAmJiB0cmFuc2l0aW9uLnRvID09PSBkZXN0aW5hdGlvblN0YXRlTmFtZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBzb3J0IHRyYW5zaXRpb25zIGluIHByaW9yaXR5IG9yZGVyXG4gICAgICAgICAgICBzb3J0UHJpb3JpdHkodHJhbnNpdGlvbnMpO1xuXG4gICAgICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGVbc291cmNlU3RhdGVOYW1lICsgJy0+JyArIGRlc3RpbmF0aW9uU3RhdGVOYW1lXSA9IHRyYW5zaXRpb25zO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cmFuc2l0aW9ucztcbiAgICB9XG5cbiAgICBfdHJhbnNpdGlvbkhhc0NvbmRpdGlvbnNNZXQodHJhbnNpdGlvbikge1xuICAgICAgICBjb25zdCBjb25kaXRpb25zID0gdHJhbnNpdGlvbi5jb25kaXRpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbmRpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IGNvbmRpdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXIgPSB0aGlzLmZpbmRQYXJhbWV0ZXIoY29uZGl0aW9uLnBhcmFtZXRlck5hbWUpO1xuICAgICAgICAgICAgc3dpdGNoIChjb25kaXRpb24ucHJlZGljYXRlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBBTklNX0dSRUFURVJfVEhBTjpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlID4gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEFOSU1fTEVTU19USEFOOlxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwYXJhbWV0ZXIudmFsdWUgPCBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA+PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9MRVNTX1RIQU5fRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA8PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9FUVVBTF9UTzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlID09PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9OT1RfRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSAhPT0gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBfZmluZFRyYW5zaXRpb24oZnJvbSwgdG8pIHtcbiAgICAgICAgbGV0IHRyYW5zaXRpb25zID0gW107XG5cbiAgICAgICAgLy8gSWYgZnJvbSBhbmQgdG8gYXJlIHN1cHBsaWVkLCBmaW5kIHRyYW5zaXRpb25zIHRoYXQgaW5jbHVkZSB0aGUgcmVxdWlyZWQgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBzdGF0ZXNcbiAgICAgICAgaWYgKGZyb20gJiYgdG8pIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXMoZnJvbSwgdG8pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIElmIG5vIHRyYW5zaXRpb24gaXMgYWN0aXZlLCBsb29rIGZvciB0cmFuc2l0aW9ucyBmcm9tIHRoZSBhY3RpdmUgJiBhbnkgc3RhdGVzLlxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fYWN0aXZlU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSBsb29rIGZvciB0cmFuc2l0aW9ucyBmcm9tIHRoZSBwcmV2aW91cyBhbmQgYWN0aXZlIHN0YXRlcyBiYXNlZCBvbiB0aGUgY3VycmVudCBpbnRlcnJ1cHRpb24gc291cmNlLlxuICAgICAgICAgICAgICAgIC8vIEFjY2VwdCB0cmFuc2l0aW9ucyBmcm9tIHRoZSBhbnkgc3RhdGUgdW5sZXNzIHRoZSBpbnRlcnJ1cHRpb24gc291cmNlIGlzIHNldCB0byBub25lXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLl90cmFuc2l0aW9uSW50ZXJydXB0aW9uU291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fUFJFVjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9ORVhUOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQ6XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX0FOWSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fTkVYVF9QUkVWOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUoQU5JTV9TVEFURV9BTlkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEFOSU1fSU5URVJSVVBUSU9OX05PTkU6XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmlsdGVyIG91dCB0cmFuc2l0aW9ucyB0aGF0IGRvbid0IGhhdmUgdGhlaXIgY29uZGl0aW9ucyBtZXRcbiAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5maWx0ZXIoKHRyYW5zaXRpb24pID0+IHtcbiAgICAgICAgICAgIC8vIGlmIHRoZSB0cmFuc2l0aW9uIGlzIG1vdmluZyB0byB0aGUgYWxyZWFkeSBhY3RpdmUgc3RhdGUsIGlnbm9yZSBpdFxuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24udG8gPT09IHRoaXMuYWN0aXZlU3RhdGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gd2hlbiBhbiBleGl0IHRpbWUgaXMgcHJlc2VudCwgd2Ugc2hvdWxkIG9ubHkgZXhpdCBpZiBpdCBmYWxscyB3aXRoaW4gdGhlIGN1cnJlbnQgZnJhbWUgZGVsdGEgdGltZVxuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24uaGFzRXhpdFRpbWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgcHJvZ3Jlc3NCZWZvcmUgPSB0aGlzLl9nZXRBY3RpdmVTdGF0ZVByb2dyZXNzRm9yVGltZSh0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSk7XG4gICAgICAgICAgICAgICAgbGV0IHByb2dyZXNzID0gdGhpcy5fZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUodGhpcy5fdGltZUluU3RhdGUpO1xuICAgICAgICAgICAgICAgIC8vIHdoZW4gdGhlIGV4aXQgdGltZSBpcyBzbWFsbGVyIHRoYW4gMSBhbmQgdGhlIHN0YXRlIGlzIGxvb3BpbmcsIHdlIHNob3VsZCBjaGVjayBmb3IgYW4gZXhpdCBlYWNoIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodHJhbnNpdGlvbi5leGl0VGltZSA8IDEuMCAmJiB0aGlzLmFjdGl2ZVN0YXRlLmxvb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NCZWZvcmUgLT0gTWF0aC5mbG9vcihwcm9ncmVzc0JlZm9yZSk7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzIC09IE1hdGguZmxvb3IocHJvZ3Jlc3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gZmFsc2UgaWYgZXhpdCB0aW1lIGlzbid0IHdpdGhpbiB0aGUgZnJhbWVzIGRlbHRhIHRpbWVcbiAgICAgICAgICAgICAgICBpZiAoISh0cmFuc2l0aW9uLmV4aXRUaW1lID4gcHJvZ3Jlc3NCZWZvcmUgJiYgdHJhbnNpdGlvbi5leGl0VGltZSA8PSBwcm9ncmVzcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaWYgdGhlIGV4aXRUaW1lIGNvbmRpdGlvbiBoYXMgYmVlbiBtZXQgb3IgaXMgbm90IHByZXNlbnQsIGNoZWNrIGNvbmRpdGlvbiBwYXJhbWV0ZXJzXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdHJhbnNpdGlvbkhhc0NvbmRpdGlvbnNNZXQodHJhbnNpdGlvbik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGUgaGlnaGVzdCBwcmlvcml0eSB0cmFuc2l0aW9uIHRvIHVzZVxuICAgICAgICBpZiAodHJhbnNpdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgdHJhbnNpdGlvbiA9IHRyYW5zaXRpb25zWzBdO1xuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24udG8gPT09IEFOSU1fU1RBVEVfRU5EKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRUcmFuc2l0aW9uID0gdGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfU1RBUlQpWzBdO1xuICAgICAgICAgICAgICAgIHRyYW5zaXRpb24udG8gPSBzdGFydFRyYW5zaXRpb24udG87XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJhbnNpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB1cGRhdGVTdGF0ZUZyb21UcmFuc2l0aW9uKHRyYW5zaXRpb24pIHtcbiAgICAgICAgbGV0IHN0YXRlO1xuICAgICAgICBsZXQgYW5pbWF0aW9uO1xuICAgICAgICBsZXQgY2xpcDtcbiAgICAgICAgLy8gSWYgdHJhbnNpdGlvbi5mcm9tIGlzIHNldCwgdHJhbnNpdGlvbiBmcm9tIHRoZSBhY3RpdmUgc3RhdGUgaXJyZWdhcmRsZXNzIG9mIHRoZSB0cmFuc2l0aW9uLmZyb20gdmFsdWUgKHRoaXMgY291bGQgYmUgdGhlIHByZXZpb3VzLCBhY3RpdmUgb3IgQU5ZIHN0YXRlcykuXG4gICAgICAgIC8vIE90aGVyd2lzZSB0aGUgcHJldmlvdXNTdGF0ZSBpcyBjbGVhcmVkLlxuICAgICAgICB0aGlzLnByZXZpb3VzU3RhdGUgPSB0cmFuc2l0aW9uLmZyb20gPyB0aGlzLmFjdGl2ZVN0YXRlTmFtZSA6IG51bGw7XG4gICAgICAgIHRoaXMuYWN0aXZlU3RhdGUgPSB0cmFuc2l0aW9uLnRvO1xuXG4gICAgICAgIC8vIHR1cm4gb2ZmIGFueSB0cmlnZ2VycyB3aGljaCB3ZXJlIHJlcXVpcmVkIHRvIGFjdGl2YXRlIHRoaXMgdHJhbnNpdGlvblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyYW5zaXRpb24uY29uZGl0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29uZGl0aW9uID0gdHJhbnNpdGlvbi5jb25kaXRpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gdGhpcy5maW5kUGFyYW1ldGVyKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXIudHlwZSA9PT0gQU5JTV9QQVJBTUVURVJfVFJJR0dFUikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMuYWRkKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnByZXZpb3VzU3RhdGUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzID0gW107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlY29yZCB0aGUgdHJhbnNpdGlvbiBzb3VyY2Ugc3RhdGUgaW4gdGhlIHByZXZpb3VzIHN0YXRlcyBhcnJheVxuICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lLFxuICAgICAgICAgICAgICAgIHdlaWdodDogMVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgbmV3IHRyYW5zaXRpb24gd2FzIGFjdGl2YXRlZCBkdXJpbmcgYW5vdGhlciB0cmFuc2l0aW9uLCB1cGRhdGUgdGhlIHByZXZpb3VzIHRyYW5zaXRpb24gc3RhdGUgd2VpZ2h0cyBiYXNlZFxuICAgICAgICAgICAgLy8gb24gdGhlIHByb2dyZXNzIHRocm91Z2ggdGhlIHByZXZpb3VzIHRyYW5zaXRpb24uXG4gICAgICAgICAgICBjb25zdCBpbnRlcnBvbGF0ZWRUaW1lID0gTWF0aC5taW4odGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSAhPT0gMCA/IHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSAvIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgOiAxLCAxLjApO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBpbnRlcnBvbGF0ZSB0aGUgd2VpZ2h0cyBvZiB0aGUgbW9zdCByZWNlbnQgcHJldmlvdXMgc3RhdGUgYW5kIGFsbCBvdGhlciBwcmV2aW91cyBzdGF0ZXMgYmFzZWQgb24gdGhlIHByb2dyZXNzIHRocm91Z2ggdGhlIHByZXZpb3VzIHRyYW5zaXRpb25cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ud2VpZ2h0ID0gMS4wO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaSAhPT0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCAqPSAoMS4wIC0gaW50ZXJwb2xhdGVkVGltZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCA9IGludGVycG9sYXRlZFRpbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgdGhlIGFuaW1hdGlvbnMgb2YgcHJldmlvdXMgc3RhdGVzLCBzZXQgdGhlaXIgbmFtZSB0byBpbmNsdWRlIHRoZWlyIHBvc2l0aW9uIGluIHRoZSBwcmV2aW91cyBzdGF0ZSBhcnJheVxuICAgICAgICAgICAgICAgIC8vIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IGFuaW1hdGlvbnMgZnJvbSB0aGUgc2FtZSBzdGF0ZSB0aGF0IHdlcmUgYWRkZWQgZHVyaW5nIGRpZmZlcmVudCB0cmFuc2l0aW9uc1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2pdO1xuICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSArICcucHJldmlvdXMuJyArIGkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAubmFtZSA9IGFuaW1hdGlvbi5uYW1lICsgJy5wcmV2aW91cy4nICsgaTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyAvLyBwYXVzZSBwcmV2aW91cyBhbmltYXRpb24gY2xpcHMgdG8gcmVkdWNlIHRoZWlyIGltcGFjdCBvbiBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgICAgICAgICBpZiAoaSAhPT0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAucGF1c2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgPSB0cmFuc2l0aW9uLnRpbWU7XG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UgPSB0cmFuc2l0aW9uLmludGVycnVwdGlvblNvdXJjZTtcblxuXG4gICAgICAgIGNvbnN0IGFjdGl2ZVN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgY29uc3QgaGFzVHJhbnNpdGlvbk9mZnNldCA9IHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldCAmJiB0cmFuc2l0aW9uLnRyYW5zaXRpb25PZmZzZXQgPiAwLjAgJiYgdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0IDwgMS4wO1xuXG4gICAgICAgIC8vIHNldCB0aGUgdGltZSBpbiB0aGUgbmV3IHN0YXRlIHRvIDAgb3IgdG8gYSB2YWx1ZSBiYXNlZCBvbiB0cmFuc2l0aW9uT2Zmc2V0IGlmIG9uZSB3YXMgZ2l2ZW5cbiAgICAgICAgbGV0IHRpbWVJblN0YXRlID0gMDtcbiAgICAgICAgbGV0IHRpbWVJblN0YXRlQmVmb3JlID0gMDtcbiAgICAgICAgaWYgKGhhc1RyYW5zaXRpb25PZmZzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9mZnNldFRpbWUgPSBhY3RpdmVTdGF0ZS50aW1lbGluZUR1cmF0aW9uICogdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0O1xuICAgICAgICAgICAgdGltZUluU3RhdGUgPSBvZmZzZXRUaW1lO1xuICAgICAgICAgICAgdGltZUluU3RhdGVCZWZvcmUgPSBvZmZzZXRUaW1lO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlID0gdGltZUluU3RhdGU7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gdGltZUluU3RhdGVCZWZvcmU7XG5cbiAgICAgICAgLy8gQWRkIGNsaXBzIHRvIHRoZSBldmFsdWF0b3IgZm9yIGVhY2ggYW5pbWF0aW9uIGluIHRoZSBuZXcgc3RhdGUuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWN0aXZlU3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5uYW1lKTtcbiAgICAgICAgICAgIGlmICghY2xpcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwZWVkID0gTnVtYmVyLmlzRmluaXRlKGFjdGl2ZVN0YXRlLmFuaW1hdGlvbnNbaV0uc3BlZWQpID8gYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5zcGVlZCA6IGFjdGl2ZVN0YXRlLnNwZWVkO1xuICAgICAgICAgICAgICAgIGNsaXAgPSBuZXcgQW5pbUNsaXAoYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5hbmltVHJhY2ssIHRoaXMuX3RpbWVJblN0YXRlLCBzcGVlZCwgdHJ1ZSwgYWN0aXZlU3RhdGUubG9vcCwgdGhpcy5fZXZlbnRIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICBjbGlwLm5hbWUgPSBhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLm5hbWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci5hZGRDbGlwKGNsaXApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjbGlwLnJlc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHJhbnNpdGlvbi50aW1lID4gMCkge1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSAwLjA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSBhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLm5vcm1hbGl6ZWRXZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbGlwLnBsYXkoKTtcbiAgICAgICAgICAgIGlmIChoYXNUcmFuc2l0aW9uT2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgY2xpcC50aW1lID0gYWN0aXZlU3RhdGUudGltZWxpbmVEdXJhdGlvbiAqIHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gYWN0aXZlU3RhdGUuc3BlZWQgPj0gMCA/IDAgOiB0aGlzLmFjdGl2ZVN0YXRlRHVyYXRpb247XG4gICAgICAgICAgICAgICAgY2xpcC50aW1lID0gc3RhcnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3RyYW5zaXRpb25Ub1N0YXRlKG5ld1N0YXRlTmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX2ZpbmRTdGF0ZShuZXdTdGF0ZU5hbWUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb3ZlIHRvIHRoZSBnaXZlbiBzdGF0ZSwgaWYgYSB0cmFuc2l0aW9uIGlzIHByZXNlbnQgaW4gdGhlIHN0YXRlIGdyYXBoIHVzZSBpdC4gT3RoZXJ3aXNlIG1vdmUgaW5zdGFudGx5IHRvIGl0LlxuICAgICAgICBsZXQgdHJhbnNpdGlvbiA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSwgbmV3U3RhdGVOYW1lKTtcbiAgICAgICAgaWYgKCF0cmFuc2l0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXBzKCk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uID0gbmV3IEFuaW1UcmFuc2l0aW9uKHsgZnJvbTogbnVsbCwgdG86IG5ld1N0YXRlTmFtZSB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlRnJvbVRyYW5zaXRpb24odHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgYXNzaWduQW5pbWF0aW9uKHBhdGhTdHJpbmcsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IHBhdGhTdHJpbmcuc3BsaXQoJy4nKTtcbiAgICAgICAgbGV0IHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHBhdGhbMF0pO1xuICAgICAgICBpZiAoIXN0YXRlKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IG5ldyBBbmltU3RhdGUodGhpcywgcGF0aFswXSwgMS4wKTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlc1twYXRoWzBdXSA9IHN0YXRlO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVOYW1lcy5wdXNoKHBhdGhbMF0pO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmFkZEFuaW1hdGlvbihwYXRoLCBhbmltVHJhY2spO1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnVwZGF0ZUNsaXBUcmFjayhzdGF0ZS5uYW1lLCBhbmltVHJhY2spO1xuICAgICAgICBpZiAoc3BlZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3RhdGUuc3BlZWQgPSBzcGVlZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobG9vcCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdGF0ZS5sb29wID0gbG9vcDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fcGxheWluZyAmJiB0aGlzLl9hY3RpdmF0ZSAmJiB0aGlzLnBsYXlhYmxlKSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZU5vZGVBbmltYXRpb25zKG5vZGVOYW1lKSB7XG4gICAgICAgIGlmIChBTklNX0NPTlRST0xfU1RBVEVTLmluZGV4T2Yobm9kZU5hbWUpICE9PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKG5vZGVOYW1lKTtcbiAgICAgICAgaWYgKCFzdGF0ZSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0F0dGVtcHRpbmcgdG8gdW5hc3NpZ24gYW5pbWF0aW9uIHRyYWNrcyBmcm9tIGEgc3RhdGUgdGhhdCBkb2VzIG5vdCBleGlzdC4nLCBub2RlTmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZS5hbmltYXRpb25zID0gW107XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHBsYXkoc3RhdGVOYW1lKSB7XG4gICAgICAgIGlmIChzdGF0ZU5hbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25Ub1N0YXRlKHN0YXRlTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcGxheWluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICByZXNldCgpIHtcbiAgICAgICAgdGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUgPSBudWxsO1xuICAgICAgICB0aGlzLl9hY3RpdmVTdGF0ZU5hbWUgPSBBTklNX1NUQVRFX1NUQVJUO1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlID0gMDtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGVCZWZvcmUgPSAwO1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXBzKCk7XG4gICAgfVxuXG4gICAgcmViaW5kKCkge1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlYmluZCgpO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBpZiAoIXRoaXMuX3BsYXlpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc3RhdGU7XG4gICAgICAgIGxldCBhbmltYXRpb247XG4gICAgICAgIGxldCBjbGlwO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSA9IHRoaXMuX3RpbWVJblN0YXRlO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSArPSBkdCAqIHRoaXMuYWN0aXZlU3RhdGUuc3BlZWQ7XG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiBiZXR3ZWVuIHN0YXRlcyBpZiBhIHRyYW5zaXRpb24gaXMgYXZhaWxhYmxlIGZyb20gdGhlIGFjdGl2ZSBzdGF0ZVxuICAgICAgICBjb25zdCB0cmFuc2l0aW9uID0gdGhpcy5fZmluZFRyYW5zaXRpb24odGhpcy5fYWN0aXZlU3RhdGVOYW1lKTtcbiAgICAgICAgaWYgKHRyYW5zaXRpb24pXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlRnJvbVRyYW5zaXRpb24odHJhbnNpdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgICAgdGhpcy5fY3VyclRyYW5zaXRpb25UaW1lICs9IGR0O1xuICAgICAgICAgICAgaWYgKHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA8PSB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW50ZXJwb2xhdGVkVGltZSA9IHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgIT09IDAgPyB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgLyB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lIDogMTtcbiAgICAgICAgICAgICAgICAvLyB3aGlsZSB0cmFuc2l0aW9uaW5nLCBzZXQgYWxsIHByZXZpb3VzIHN0YXRlIGFuaW1hdGlvbnMgdG8gYmUgd2VpZ2h0ZWQgYnkgKDEuMCAtIGludGVycG9sYXRpb25UaW1lKS5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMuX2ZpbmRTdGF0ZSh0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlV2VpZ2h0ID0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBzdGF0ZS5hbmltYXRpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2pdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUgKyAnLnByZXZpb3VzLicgKyBpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjbGlwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpcC5ibGVuZFdlaWdodCA9ICgxLjAgLSBpbnRlcnBvbGF0ZWRUaW1lKSAqIGFuaW1hdGlvbi5ub3JtYWxpemVkV2VpZ2h0ICogc3RhdGVXZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gd2hpbGUgdHJhbnNpdGlvbmluZywgc2V0IGFjdGl2ZSBzdGF0ZSBhbmltYXRpb25zIHRvIGJlIHdlaWdodGVkIGJ5IChpbnRlcnBvbGF0aW9uVGltZSkuXG4gICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLmFjdGl2ZVN0YXRlO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2ldO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKS5ibGVuZFdlaWdodCA9IGludGVycG9sYXRlZFRpbWUgKiBhbmltYXRpb24ubm9ybWFsaXplZFdlaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIC8vIHdoZW4gYSB0cmFuc2l0aW9uIGVuZHMsIHJlbW92ZSBhbGwgcHJldmlvdXMgc3RhdGUgY2xpcHMgZnJvbSB0aGUgZXZhbHVhdG9yXG4gICAgICAgICAgICAgICAgY29uc3QgYWN0aXZlQ2xpcHMgPSB0aGlzLmFjdGl2ZVN0YXRlQW5pbWF0aW9ucy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgY29uc3QgdG90YWxDbGlwcyA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuY2xpcHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG90YWxDbGlwcyAtIGFjdGl2ZUNsaXBzOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci5yZW1vdmVDbGlwKDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAvLyB3aGVuIGEgdHJhbnNpdGlvbiBlbmRzLCBzZXQgdGhlIGFjdGl2ZSBzdGF0ZSBjbGlwIHdlaWdodHMgc28gdGhleSBzdW0gdG8gMVxuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uID0gc3RhdGUuYW5pbWF0aW9uc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2xpcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xpcC5ibGVuZFdlaWdodCA9IGFuaW1hdGlvbi5ub3JtYWxpemVkV2VpZ2h0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuYWN0aXZlU3RhdGUuX2JsZW5kVHJlZS5jb25zdHJ1Y3RvciAhPT0gQW5pbU5vZGUpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMuYWN0aXZlU3RhdGU7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0ZS5hbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGFuaW1hdGlvbiA9IHN0YXRlLmFuaW1hdGlvbnNbaV07XG4gICAgICAgICAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSBhbmltYXRpb24ubm9ybWFsaXplZFdlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhbmltYXRpb24ucGFyZW50LnN5bmNBbmltYXRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpcC5zcGVlZCA9IGFuaW1hdGlvbi5zcGVlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnVwZGF0ZShkdCwgdGhpcy5hY3RpdmVTdGF0ZS5oYXNBbmltYXRpb25zKTtcbiAgICB9XG5cbiAgICBmaW5kUGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcmFtZXRlcnNbbmFtZV07XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltQ29udHJvbGxlciB9O1xuIl0sIm5hbWVzIjpbIkFuaW1Db250cm9sbGVyIiwiY29uc3RydWN0b3IiLCJhbmltRXZhbHVhdG9yIiwic3RhdGVzIiwidHJhbnNpdGlvbnMiLCJwYXJhbWV0ZXJzIiwiYWN0aXZhdGUiLCJldmVudEhhbmRsZXIiLCJjb25zdW1lZFRyaWdnZXJzIiwiX2FuaW1FdmFsdWF0b3IiLCJfc3RhdGVzIiwiX3N0YXRlTmFtZXMiLCJfZXZlbnRIYW5kbGVyIiwiX2NvbnN1bWVkVHJpZ2dlcnMiLCJpIiwibGVuZ3RoIiwibmFtZSIsIkFuaW1TdGF0ZSIsInNwZWVkIiwibG9vcCIsImJsZW5kVHJlZSIsInB1c2giLCJfdHJhbnNpdGlvbnMiLCJtYXAiLCJ0cmFuc2l0aW9uIiwiQW5pbVRyYW5zaXRpb24iLCJfZXh0ZW5kcyIsIl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZSIsIl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGUiLCJfcGFyYW1ldGVycyIsIl9wcmV2aW91c1N0YXRlTmFtZSIsIl9hY3RpdmVTdGF0ZU5hbWUiLCJBTklNX1NUQVRFX1NUQVJUIiwiX3BsYXlpbmciLCJfYWN0aXZhdGUiLCJfY3VyclRyYW5zaXRpb25UaW1lIiwiX3RvdGFsVHJhbnNpdGlvblRpbWUiLCJfaXNUcmFuc2l0aW9uaW5nIiwiX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UiLCJBTklNX0lOVEVSUlVQVElPTl9OT05FIiwiX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcyIsIl90aW1lSW5TdGF0ZSIsIl90aW1lSW5TdGF0ZUJlZm9yZSIsImFjdGl2ZVN0YXRlIiwic3RhdGVOYW1lIiwiX2ZpbmRTdGF0ZSIsImFjdGl2ZVN0YXRlTmFtZSIsImFjdGl2ZVN0YXRlQW5pbWF0aW9ucyIsImFuaW1hdGlvbnMiLCJwcmV2aW91c1N0YXRlIiwicHJldmlvdXNTdGF0ZU5hbWUiLCJwbGF5YWJsZSIsInBsYXlpbmciLCJ2YWx1ZSIsImFjdGl2ZVN0YXRlUHJvZ3Jlc3MiLCJfZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUiLCJhY3RpdmVTdGF0ZUR1cmF0aW9uIiwiQU5JTV9TVEFURV9FTkQiLCJtYXhEdXJhdGlvbiIsImFjdGl2ZUNsaXAiLCJmaW5kQ2xpcCIsIk1hdGgiLCJtYXgiLCJ0cmFjayIsImR1cmF0aW9uIiwiYWN0aXZlU3RhdGVDdXJyZW50VGltZSIsInRpbWUiLCJjbGlwIiwidHJhbnNpdGlvbmluZyIsInRyYW5zaXRpb25Qcm9ncmVzcyIsImFzc2lnbk1hc2siLCJtYXNrIiwiQU5JTV9TVEFURV9BTlkiLCJwcm9ncmVzc0ZvclRpbWUiLCJfZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlIiwiZmlsdGVyIiwiZnJvbSIsInNvcnRQcmlvcml0eSIsIl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzIiwic291cmNlU3RhdGVOYW1lIiwiZGVzdGluYXRpb25TdGF0ZU5hbWUiLCJ0byIsIl90cmFuc2l0aW9uSGFzQ29uZGl0aW9uc01ldCIsImNvbmRpdGlvbnMiLCJjb25kaXRpb24iLCJwYXJhbWV0ZXIiLCJmaW5kUGFyYW1ldGVyIiwicGFyYW1ldGVyTmFtZSIsInByZWRpY2F0ZSIsIkFOSU1fR1JFQVRFUl9USEFOIiwiQU5JTV9MRVNTX1RIQU4iLCJBTklNX0dSRUFURVJfVEhBTl9FUVVBTF9UTyIsIkFOSU1fTEVTU19USEFOX0VRVUFMX1RPIiwiQU5JTV9FUVVBTF9UTyIsIkFOSU1fTk9UX0VRVUFMX1RPIiwiX2ZpbmRUcmFuc2l0aW9uIiwiY29uY2F0IiwiQU5JTV9JTlRFUlJVUFRJT05fUFJFViIsIkFOSU1fSU5URVJSVVBUSU9OX05FWFQiLCJBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQiLCJBTklNX0lOVEVSUlVQVElPTl9ORVhUX1BSRVYiLCJoYXNFeGl0VGltZSIsInByb2dyZXNzQmVmb3JlIiwicHJvZ3Jlc3MiLCJleGl0VGltZSIsImZsb29yIiwic3RhcnRUcmFuc2l0aW9uIiwidXBkYXRlU3RhdGVGcm9tVHJhbnNpdGlvbiIsInN0YXRlIiwiYW5pbWF0aW9uIiwidHlwZSIsIkFOSU1fUEFSQU1FVEVSX1RSSUdHRVIiLCJhZGQiLCJ3ZWlnaHQiLCJpbnRlcnBvbGF0ZWRUaW1lIiwibWluIiwiaiIsInBhdXNlIiwiaW50ZXJydXB0aW9uU291cmNlIiwiaGFzVHJhbnNpdGlvbk9mZnNldCIsInRyYW5zaXRpb25PZmZzZXQiLCJ0aW1lSW5TdGF0ZSIsInRpbWVJblN0YXRlQmVmb3JlIiwib2Zmc2V0VGltZSIsInRpbWVsaW5lRHVyYXRpb24iLCJOdW1iZXIiLCJpc0Zpbml0ZSIsIkFuaW1DbGlwIiwiYW5pbVRyYWNrIiwiYWRkQ2xpcCIsInJlc2V0IiwiYmxlbmRXZWlnaHQiLCJub3JtYWxpemVkV2VpZ2h0IiwicGxheSIsInN0YXJ0VGltZSIsIl90cmFuc2l0aW9uVG9TdGF0ZSIsIm5ld1N0YXRlTmFtZSIsInJlbW92ZUNsaXBzIiwiYXNzaWduQW5pbWF0aW9uIiwicGF0aFN0cmluZyIsInBhdGgiLCJzcGxpdCIsImFkZEFuaW1hdGlvbiIsInVwZGF0ZUNsaXBUcmFjayIsInVuZGVmaW5lZCIsInJlbW92ZU5vZGVBbmltYXRpb25zIiwibm9kZU5hbWUiLCJBTklNX0NPTlRST0xfU1RBVEVTIiwiaW5kZXhPZiIsIkRlYnVnIiwiZXJyb3IiLCJyZWJpbmQiLCJ1cGRhdGUiLCJkdCIsInN0YXRlV2VpZ2h0IiwiYWN0aXZlQ2xpcHMiLCJ0b3RhbENsaXBzIiwiY2xpcHMiLCJyZW1vdmVDbGlwIiwiX2JsZW5kVHJlZSIsIkFuaW1Ob2RlIiwicGFyZW50Iiwic3luY0FuaW1hdGlvbnMiLCJoYXNBbmltYXRpb25zIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQWFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxjQUFjLENBQUM7QUFDakI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxhQUFhLEVBQUVDLE1BQU0sRUFBRUMsV0FBVyxFQUFFQyxVQUFVLEVBQUVDLFFBQVEsRUFBRUMsWUFBWSxFQUFFQyxnQkFBZ0IsRUFBRTtJQUNsRyxJQUFJLENBQUNDLGNBQWMsR0FBR1AsYUFBYSxDQUFBO0FBQ25DLElBQUEsSUFBSSxDQUFDUSxPQUFPLEdBQUcsRUFBRSxDQUFBO0lBQ2pCLElBQUksQ0FBQ0MsV0FBVyxHQUFHLEVBQUUsQ0FBQTtJQUNyQixJQUFJLENBQUNDLGFBQWEsR0FBR0wsWUFBWSxDQUFBO0lBQ2pDLElBQUksQ0FBQ00saUJBQWlCLEdBQUdMLGdCQUFnQixDQUFBO0FBQ3pDLElBQUEsS0FBSyxJQUFJTSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdYLE1BQU0sQ0FBQ1ksTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNwQyxNQUFBLElBQUksQ0FBQ0osT0FBTyxDQUFDUCxNQUFNLENBQUNXLENBQUMsQ0FBQyxDQUFDRSxJQUFJLENBQUMsR0FBRyxJQUFJQyxTQUFTLENBQ3hDLElBQUksRUFDSmQsTUFBTSxDQUFDVyxDQUFDLENBQUMsQ0FBQ0UsSUFBSSxFQUNkYixNQUFNLENBQUNXLENBQUMsQ0FBQyxDQUFDSSxLQUFLLEVBQ2ZmLE1BQU0sQ0FBQ1cs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
