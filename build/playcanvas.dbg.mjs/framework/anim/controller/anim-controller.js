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
   * @param {boolean} activate - Determines whether the anim controller should automatically play
   * once all {@link AnimNodes} are assigned animations.
   * @param {import('../../../core/event-handler.js').EventHandler} eventHandler - The event
   * handler which should be notified with anim events.
   * @param {Function} findParameter - Retrieves a parameter which is used to control the transition between states.
   * @param {Function} consumeTrigger - Used to set triggers back to their default state after they
   * have been consumed by a transition.
   */
  constructor(animEvaluator, states, transitions, activate, eventHandler, findParameter, consumeTrigger) {
    this.findParameter = name => {
      return this._findParameter(name);
    };
    this._animEvaluator = animEvaluator;
    this._states = {};
    this._stateNames = [];
    this._eventHandler = eventHandler;
    this._findParameter = findParameter;
    this._consumeTrigger = consumeTrigger;
    for (let i = 0; i < states.length; i++) {
      this._states[states[i].name] = new AnimState(this, states[i].name, states[i].speed, states[i].loop, states[i].blendTree);
      this._stateNames.push(states[i].name);
    }
    this._transitions = transitions.map(transition => {
      return new AnimTransition(_extends({}, transition));
    });
    this._findTransitionsFromStateCache = {};
    this._findTransitionsBetweenStatesCache = {};
    this._previousStateName = null;
    this._activeStateName = ANIM_STATE_START;
    this._activeStateDuration = 0.0;
    this._activeStateDurationDirty = true;
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
    if (this._activeStateDurationDirty) {
      let maxDuration = 0.0;
      for (let i = 0; i < this.activeStateAnimations.length; i++) {
        const activeClip = this._animEvaluator.findClip(this.activeStateAnimations[i].name);
        if (activeClip) {
          maxDuration = Math.max(maxDuration, activeClip.track.duration);
        }
      }
      this._activeStateDuration = maxDuration;
      this._activeStateDurationDirty = false;
    }
    return this._activeStateDuration;
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
      const parameter = this._findParameter(condition.parameterName);
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
        // if the delta time is 0 and the progress matches the exit time, the exitTime condition has been met
        if (progress === progressBefore) {
          if (progress !== transition.exitTime) {
            return null;
          }
          // otherwise if the delta time is greater than 0, return false if exit time isn't within the frames delta time
        } else if (!(transition.exitTime > progressBefore && transition.exitTime <= progress)) {
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
    // when transitioning to a new state, we need to recalculate the duration of the active state based on its animations
    this._activeStateDurationDirty = true;

    // turn off any triggers which were required to activate this transition
    for (let i = 0; i < transition.conditions.length; i++) {
      const condition = transition.conditions[i];
      const parameter = this._findParameter(condition.parameterName);
      if (parameter.type === ANIM_PARAMETER_TRIGGER) {
        this._consumeTrigger(condition.parameterName);
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
      state = new AnimState(this, path[0], speed);
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

    // when a new animation is added, the active state duration needs to be recalculated
    this._activeStateDurationDirty = true;
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
    // update time when looping or when the active state is not at the end of its duration
    if (this.activeState.loop || this._timeInState < this.activeStateDuration) {
      this._timeInStateBefore = this._timeInState;
      this._timeInState += dt * this.activeState.speed;
      // if the active state is not looping and the time in state is greater than the duration, set the time in state to the state duration
      // and update the delta time accordingly
      if (!this.activeState.loop && this._timeInState > this.activeStateDuration) {
        this._timeInState = this.activeStateDuration;
        dt = this.activeStateDuration - this._timeInStateBefore;
      }
    }

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
}

export { AnimController };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1jb250cm9sbGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2FuaW0vY29udHJvbGxlci9hbmltLWNvbnRyb2xsZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHNvcnRQcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvc29ydC5qcyc7XG5pbXBvcnQgeyBBbmltQ2xpcCB9IGZyb20gJy4uL2V2YWx1YXRvci9hbmltLWNsaXAuanMnO1xuaW1wb3J0IHsgQW5pbVN0YXRlIH0gZnJvbSAnLi9hbmltLXN0YXRlLmpzJztcbmltcG9ydCB7IEFuaW1Ob2RlIH0gZnJvbSAnLi9hbmltLW5vZGUuanMnO1xuaW1wb3J0IHsgQW5pbVRyYW5zaXRpb24gfSBmcm9tICcuL2FuaW0tdHJhbnNpdGlvbi5qcyc7XG5pbXBvcnQge1xuICAgIEFOSU1fR1JFQVRFUl9USEFOLCBBTklNX0xFU1NfVEhBTiwgQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE8sIEFOSU1fTEVTU19USEFOX0VRVUFMX1RPLCBBTklNX0VRVUFMX1RPLCBBTklNX05PVF9FUVVBTF9UTyxcbiAgICBBTklNX0lOVEVSUlVQVElPTl9OT05FLCBBTklNX0lOVEVSUlVQVElPTl9QUkVWLCBBTklNX0lOVEVSUlVQVElPTl9ORVhULCBBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQsIEFOSU1fSU5URVJSVVBUSU9OX05FWFRfUFJFVixcbiAgICBBTklNX1BBUkFNRVRFUl9UUklHR0VSLFxuICAgIEFOSU1fU1RBVEVfU1RBUlQsIEFOSU1fU1RBVEVfRU5ELCBBTklNX1NUQVRFX0FOWSwgQU5JTV9DT05UUk9MX1NUQVRFU1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogVGhlIEFuaW1Db250cm9sbGVyIG1hbmFnZXMgdGhlIGFuaW1hdGlvbnMgZm9yIGl0cyBlbnRpdHksIGJhc2VkIG9uIHRoZSBwcm92aWRlZCBzdGF0ZSBncmFwaCBhbmRcbiAqIHBhcmFtZXRlcnMuIEl0cyB1cGRhdGUgbWV0aG9kIGRldGVybWluZXMgd2hpY2ggc3RhdGUgdGhlIGNvbnRyb2xsZXIgc2hvdWxkIGJlIGluIGJhc2VkIG9uIHRoZVxuICogY3VycmVudCB0aW1lLCBwYXJhbWV0ZXJzIGFuZCBhdmFpbGFibGUgc3RhdGVzIC8gdHJhbnNpdGlvbnMuIEl0IGFsc28gZW5zdXJlcyB0aGUgQW5pbUV2YWx1YXRvclxuICogaXMgc3VwcGxpZWQgd2l0aCB0aGUgY29ycmVjdCBhbmltYXRpb25zLCBiYXNlZCBvbiB0aGUgY3VycmVudGx5IGFjdGl2ZSBzdGF0ZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEFuaW1Db250cm9sbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQW5pbUNvbnRyb2xsZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZXZhbHVhdG9yL2FuaW0tZXZhbHVhdG9yLmpzJykuQW5pbUV2YWx1YXRvcn0gYW5pbUV2YWx1YXRvciAtIFRoZVxuICAgICAqIGFuaW1hdGlvbiBldmFsdWF0b3IgdXNlZCB0byBibGVuZCBhbGwgY3VycmVudCBwbGF5aW5nIGFuaW1hdGlvbiBrZXlmcmFtZXMgYW5kIHVwZGF0ZSB0aGVcbiAgICAgKiBlbnRpdGllcyBwcm9wZXJ0aWVzIGJhc2VkIG9uIHRoZSBjdXJyZW50IGFuaW1hdGlvbiB2YWx1ZXMuXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gc3RhdGVzIC0gVGhlIGxpc3Qgb2Ygc3RhdGVzIHVzZWQgdG8gZm9ybSB0aGUgY29udHJvbGxlciBzdGF0ZSBncmFwaC5cbiAgICAgKiBAcGFyYW0ge29iamVjdFtdfSB0cmFuc2l0aW9ucyAtIFRoZSBsaXN0IG9mIHRyYW5zaXRpb25zIHVzZWQgdG8gZm9ybSB0aGUgY29udHJvbGxlciBzdGF0ZVxuICAgICAqIGdyYXBoLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYWN0aXZhdGUgLSBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIGFuaW0gY29udHJvbGxlciBzaG91bGQgYXV0b21hdGljYWxseSBwbGF5XG4gICAgICogb25jZSBhbGwge0BsaW5rIEFuaW1Ob2Rlc30gYXJlIGFzc2lnbmVkIGFuaW1hdGlvbnMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcycpLkV2ZW50SGFuZGxlcn0gZXZlbnRIYW5kbGVyIC0gVGhlIGV2ZW50XG4gICAgICogaGFuZGxlciB3aGljaCBzaG91bGQgYmUgbm90aWZpZWQgd2l0aCBhbmltIGV2ZW50cy5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmaW5kUGFyYW1ldGVyIC0gUmV0cmlldmVzIGEgcGFyYW1ldGVyIHdoaWNoIGlzIHVzZWQgdG8gY29udHJvbCB0aGUgdHJhbnNpdGlvbiBiZXR3ZWVuIHN0YXRlcy5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb25zdW1lVHJpZ2dlciAtIFVzZWQgdG8gc2V0IHRyaWdnZXJzIGJhY2sgdG8gdGhlaXIgZGVmYXVsdCBzdGF0ZSBhZnRlciB0aGV5XG4gICAgICogaGF2ZSBiZWVuIGNvbnN1bWVkIGJ5IGEgdHJhbnNpdGlvbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhbmltRXZhbHVhdG9yLCBzdGF0ZXMsIHRyYW5zaXRpb25zLCBhY3RpdmF0ZSwgZXZlbnRIYW5kbGVyLCBmaW5kUGFyYW1ldGVyLCBjb25zdW1lVHJpZ2dlcikge1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yID0gYW5pbUV2YWx1YXRvcjtcbiAgICAgICAgdGhpcy5fc3RhdGVzID0ge307XG4gICAgICAgIHRoaXMuX3N0YXRlTmFtZXMgPSBbXTtcbiAgICAgICAgdGhpcy5fZXZlbnRIYW5kbGVyID0gZXZlbnRIYW5kbGVyO1xuICAgICAgICB0aGlzLl9maW5kUGFyYW1ldGVyID0gZmluZFBhcmFtZXRlcjtcbiAgICAgICAgdGhpcy5fY29uc3VtZVRyaWdnZXIgPSBjb25zdW1lVHJpZ2dlcjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlc1tzdGF0ZXNbaV0ubmFtZV0gPSBuZXcgQW5pbVN0YXRlKFxuICAgICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICAgc3RhdGVzW2ldLm5hbWUsXG4gICAgICAgICAgICAgICAgc3RhdGVzW2ldLnNwZWVkLFxuICAgICAgICAgICAgICAgIHN0YXRlc1tpXS5sb29wLFxuICAgICAgICAgICAgICAgIHN0YXRlc1tpXS5ibGVuZFRyZWVcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZU5hbWVzLnB1c2goc3RhdGVzW2ldLm5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3RyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMubWFwKCh0cmFuc2l0aW9uKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEFuaW1UcmFuc2l0aW9uKHtcbiAgICAgICAgICAgICAgICAuLi50cmFuc2l0aW9uXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZUNhY2hlID0ge307XG4gICAgICAgIHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXNDYWNoZSA9IHt9O1xuICAgICAgICB0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSA9IEFOSU1fU1RBVEVfU1RBUlQ7XG4gICAgICAgIHRoaXMuX2FjdGl2ZVN0YXRlRHVyYXRpb24gPSAwLjA7XG4gICAgICAgIHRoaXMuX2FjdGl2ZVN0YXRlRHVyYXRpb25EaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYWN0aXZhdGUgPSBhY3RpdmF0ZTtcblxuICAgICAgICB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgPSAxLjA7XG4gICAgICAgIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgPSAxLjA7XG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90cmFuc2l0aW9uSW50ZXJydXB0aW9uU291cmNlID0gQU5JTV9JTlRFUlJVUFRJT05fTk9ORTtcbiAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzID0gW107XG5cbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGUgPSAwO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSA9IDA7XG4gICAgfVxuXG4gICAgZ2V0IGFuaW1FdmFsdWF0b3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmltRXZhbHVhdG9yO1xuICAgIH1cblxuICAgIHNldCBhY3RpdmVTdGF0ZShzdGF0ZU5hbWUpIHtcbiAgICAgICAgdGhpcy5fYWN0aXZlU3RhdGVOYW1lID0gc3RhdGVOYW1lO1xuICAgIH1cblxuICAgIGdldCBhY3RpdmVTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbmRTdGF0ZSh0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpO1xuICAgIH1cblxuICAgIGdldCBhY3RpdmVTdGF0ZU5hbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hY3RpdmVTdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlQW5pbWF0aW9ucygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWN0aXZlU3RhdGUuYW5pbWF0aW9ucztcbiAgICB9XG5cbiAgICBzZXQgcHJldmlvdXNTdGF0ZShzdGF0ZU5hbWUpIHtcbiAgICAgICAgdGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUgPSBzdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IHByZXZpb3VzU3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9maW5kU3RhdGUodGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUpO1xuICAgIH1cblxuICAgIGdldCBwcmV2aW91c1N0YXRlTmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lO1xuICAgIH1cblxuICAgIGdldCBwbGF5YWJsZSgpIHtcbiAgICAgICAgbGV0IHBsYXlhYmxlID0gdHJ1ZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9zdGF0ZU5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX3N0YXRlc1t0aGlzLl9zdGF0ZU5hbWVzW2ldXS5wbGF5YWJsZSkge1xuICAgICAgICAgICAgICAgIHBsYXlhYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBsYXlhYmxlO1xuICAgIH1cblxuICAgIHNldCBwbGF5aW5nKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgcGxheWluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BsYXlpbmc7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlUHJvZ3Jlc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRBY3RpdmVTdGF0ZVByb2dyZXNzRm9yVGltZSh0aGlzLl90aW1lSW5TdGF0ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlRHVyYXRpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl9hY3RpdmVTdGF0ZUR1cmF0aW9uRGlydHkpIHtcbiAgICAgICAgICAgIGxldCBtYXhEdXJhdGlvbiA9IDAuMDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhY3RpdmVDbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcCh0aGlzLmFjdGl2ZVN0YXRlQW5pbWF0aW9uc1tpXS5uYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoYWN0aXZlQ2xpcCkge1xuICAgICAgICAgICAgICAgICAgICBtYXhEdXJhdGlvbiA9IE1hdGgubWF4KG1heER1cmF0aW9uLCBhY3RpdmVDbGlwLnRyYWNrLmR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVTdGF0ZUR1cmF0aW9uID0gbWF4RHVyYXRpb247XG4gICAgICAgICAgICB0aGlzLl9hY3RpdmVTdGF0ZUR1cmF0aW9uRGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fYWN0aXZlU3RhdGVEdXJhdGlvbjtcbiAgICB9XG5cbiAgICBzZXQgYWN0aXZlU3RhdGVDdXJyZW50VGltZSh0aW1lKSB7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gdGltZTtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGUgPSB0aW1lO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjbGlwID0gdGhpcy5hbmltRXZhbHVhdG9yLmZpbmRDbGlwKHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zW2ldLm5hbWUpO1xuICAgICAgICAgICAgaWYgKGNsaXApIHtcbiAgICAgICAgICAgICAgICBjbGlwLnRpbWUgPSB0aW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlQ3VycmVudFRpbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90aW1lSW5TdGF0ZTtcbiAgICB9XG5cbiAgICBnZXQgdHJhbnNpdGlvbmluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lzVHJhbnNpdGlvbmluZztcbiAgICB9XG5cbiAgICBnZXQgdHJhbnNpdGlvblByb2dyZXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VyclRyYW5zaXRpb25UaW1lIC8gdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZTtcbiAgICB9XG5cbiAgICBnZXQgc3RhdGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGVOYW1lcztcbiAgICB9XG5cbiAgICBhc3NpZ25NYXNrKG1hc2spIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1FdmFsdWF0b3IuYXNzaWduTWFzayhtYXNrKTtcbiAgICB9XG5cbiAgICBfZmluZFN0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGVzW3N0YXRlTmFtZV07XG4gICAgfVxuXG4gICAgX2dldEFjdGl2ZVN0YXRlUHJvZ3Jlc3NGb3JUaW1lKHRpbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX1NUQVJUIHx8IHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX0VORCB8fCB0aGlzLmFjdGl2ZVN0YXRlTmFtZSA9PT0gQU5JTV9TVEFURV9BTlkpXG4gICAgICAgICAgICByZXR1cm4gMS4wO1xuXG4gICAgICAgIGNvbnN0IGFjdGl2ZUNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zWzBdLm5hbWUpO1xuICAgICAgICBpZiAoYWN0aXZlQ2xpcCkge1xuICAgICAgICAgICAgcmV0dXJuIGFjdGl2ZUNsaXAucHJvZ3Jlc3NGb3JUaW1lKHRpbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJuIGFsbCB0aGUgdHJhbnNpdGlvbnMgdGhhdCBoYXZlIHRoZSBnaXZlbiBzdGF0ZU5hbWUgYXMgdGhlaXIgc291cmNlIHN0YXRlXG4gICAgX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShzdGF0ZU5hbWUpIHtcbiAgICAgICAgbGV0IHRyYW5zaXRpb25zID0gdGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlQ2FjaGVbc3RhdGVOYW1lXTtcbiAgICAgICAgaWYgKCF0cmFuc2l0aW9ucykge1xuICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0aGlzLl90cmFuc2l0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKHRyYW5zaXRpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJhbnNpdGlvbi5mcm9tID09PSBzdGF0ZU5hbWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gc29ydCB0cmFuc2l0aW9ucyBpbiBwcmlvcml0eSBvcmRlclxuICAgICAgICAgICAgc29ydFByaW9yaXR5KHRyYW5zaXRpb25zKTtcblxuICAgICAgICAgICAgdGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlQ2FjaGVbc3RhdGVOYW1lXSA9IHRyYW5zaXRpb25zO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cmFuc2l0aW9ucztcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYWxsIHRoZSB0cmFuc2l0aW9ucyB0aGF0IGNvbnRhaW4gdGhlIGdpdmVuIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gc3RhdGVzXG4gICAgX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXMoc291cmNlU3RhdGVOYW1lLCBkZXN0aW5hdGlvblN0YXRlTmFtZSkge1xuICAgICAgICBsZXQgdHJhbnNpdGlvbnMgPSB0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGVbc291cmNlU3RhdGVOYW1lICsgJy0+JyArIGRlc3RpbmF0aW9uU3RhdGVOYW1lXTtcbiAgICAgICAgaWYgKCF0cmFuc2l0aW9ucykge1xuICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0aGlzLl90cmFuc2l0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKHRyYW5zaXRpb24pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJhbnNpdGlvbi5mcm9tID09PSBzb3VyY2VTdGF0ZU5hbWUgJiYgdHJhbnNpdGlvbi50byA9PT0gZGVzdGluYXRpb25TdGF0ZU5hbWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gc29ydCB0cmFuc2l0aW9ucyBpbiBwcmlvcml0eSBvcmRlclxuICAgICAgICAgICAgc29ydFByaW9yaXR5KHRyYW5zaXRpb25zKTtcblxuICAgICAgICAgICAgdGhpcy5fZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlc0NhY2hlW3NvdXJjZVN0YXRlTmFtZSArICctPicgKyBkZXN0aW5hdGlvblN0YXRlTmFtZV0gPSB0cmFuc2l0aW9ucztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJhbnNpdGlvbnM7XG4gICAgfVxuXG4gICAgX3RyYW5zaXRpb25IYXNDb25kaXRpb25zTWV0KHRyYW5zaXRpb24pIHtcbiAgICAgICAgY29uc3QgY29uZGl0aW9ucyA9IHRyYW5zaXRpb24uY29uZGl0aW9ucztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb25kaXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb25kaXRpb24gPSBjb25kaXRpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gdGhpcy5fZmluZFBhcmFtZXRlcihjb25kaXRpb24ucGFyYW1ldGVyTmFtZSk7XG4gICAgICAgICAgICBzd2l0Y2ggKGNvbmRpdGlvbi5wcmVkaWNhdGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIEFOSU1fR1JFQVRFUl9USEFOOlxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwYXJhbWV0ZXIudmFsdWUgPiBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9MRVNTX1RIQU46XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA8IGNvbmRpdGlvbi52YWx1ZSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBBTklNX0dSRUFURVJfVEhBTl9FUVVBTF9UTzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlID49IGNvbmRpdGlvbi52YWx1ZSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBBTklNX0xFU1NfVEhBTl9FUVVBTF9UTzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlIDw9IGNvbmRpdGlvbi52YWx1ZSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBBTklNX0VRVUFMX1RPOlxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwYXJhbWV0ZXIudmFsdWUgPT09IGNvbmRpdGlvbi52YWx1ZSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBBTklNX05PVF9FUVVBTF9UTzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlICE9PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIF9maW5kVHJhbnNpdGlvbihmcm9tLCB0bykge1xuICAgICAgICBsZXQgdHJhbnNpdGlvbnMgPSBbXTtcblxuICAgICAgICAvLyBJZiBmcm9tIGFuZCB0byBhcmUgc3VwcGxpZWQsIGZpbmQgdHJhbnNpdGlvbnMgdGhhdCBpbmNsdWRlIHRoZSByZXF1aXJlZCBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIHN0YXRlc1xuICAgICAgICBpZiAoZnJvbSAmJiB0bykge1xuICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlcyhmcm9tLCB0bykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gSWYgbm8gdHJhbnNpdGlvbiBpcyBhY3RpdmUsIGxvb2sgZm9yIHRyYW5zaXRpb25zIGZyb20gdGhlIGFjdGl2ZSAmIGFueSBzdGF0ZXMuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUoQU5JTV9TVEFURV9BTlkpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlIGxvb2sgZm9yIHRyYW5zaXRpb25zIGZyb20gdGhlIHByZXZpb3VzIGFuZCBhY3RpdmUgc3RhdGVzIGJhc2VkIG9uIHRoZSBjdXJyZW50IGludGVycnVwdGlvbiBzb3VyY2UuXG4gICAgICAgICAgICAgICAgLy8gQWNjZXB0IHRyYW5zaXRpb25zIGZyb20gdGhlIGFueSBzdGF0ZSB1bmxlc3MgdGhlIGludGVycnVwdGlvbiBzb3VyY2UgaXMgc2V0IHRvIG5vbmVcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRoaXMuX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9QUkVWOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUoQU5JTV9TVEFURV9BTlkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEFOSU1fSU5URVJSVVBUSU9OX05FWFQ6XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fYWN0aXZlU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUoQU5JTV9TVEFURV9BTlkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEFOSU1fSU5URVJSVVBUSU9OX1BSRVZfTkVYVDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9ORVhUX1BSRVY6XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fYWN0aXZlU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX0FOWSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fTk9ORTpcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmaWx0ZXIgb3V0IHRyYW5zaXRpb25zIHRoYXQgZG9uJ3QgaGF2ZSB0aGVpciBjb25kaXRpb25zIG1ldFxuICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmZpbHRlcigodHJhbnNpdGlvbikgPT4ge1xuICAgICAgICAgICAgLy8gaWYgdGhlIHRyYW5zaXRpb24gaXMgbW92aW5nIHRvIHRoZSBhbHJlYWR5IGFjdGl2ZSBzdGF0ZSwgaWdub3JlIGl0XG4gICAgICAgICAgICBpZiAodHJhbnNpdGlvbi50byA9PT0gdGhpcy5hY3RpdmVTdGF0ZU5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB3aGVuIGFuIGV4aXQgdGltZSBpcyBwcmVzZW50LCB3ZSBzaG91bGQgb25seSBleGl0IGlmIGl0IGZhbGxzIHdpdGhpbiB0aGUgY3VycmVudCBmcmFtZSBkZWx0YSB0aW1lXG4gICAgICAgICAgICBpZiAodHJhbnNpdGlvbi5oYXNFeGl0VGltZSkge1xuICAgICAgICAgICAgICAgIGxldCBwcm9ncmVzc0JlZm9yZSA9IHRoaXMuX2dldEFjdGl2ZVN0YXRlUHJvZ3Jlc3NGb3JUaW1lKHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlKTtcbiAgICAgICAgICAgICAgICBsZXQgcHJvZ3Jlc3MgPSB0aGlzLl9nZXRBY3RpdmVTdGF0ZVByb2dyZXNzRm9yVGltZSh0aGlzLl90aW1lSW5TdGF0ZSk7XG4gICAgICAgICAgICAgICAgLy8gd2hlbiB0aGUgZXhpdCB0aW1lIGlzIHNtYWxsZXIgdGhhbiAxIGFuZCB0aGUgc3RhdGUgaXMgbG9vcGluZywgd2Ugc2hvdWxkIGNoZWNrIGZvciBhbiBleGl0IGVhY2ggbG9vcFxuICAgICAgICAgICAgICAgIGlmICh0cmFuc2l0aW9uLmV4aXRUaW1lIDwgMS4wICYmIHRoaXMuYWN0aXZlU3RhdGUubG9vcCkge1xuICAgICAgICAgICAgICAgICAgICBwcm9ncmVzc0JlZm9yZSAtPSBNYXRoLmZsb29yKHByb2dyZXNzQmVmb3JlKTtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3MgLT0gTWF0aC5mbG9vcihwcm9ncmVzcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBkZWx0YSB0aW1lIGlzIDAgYW5kIHRoZSBwcm9ncmVzcyBtYXRjaGVzIHRoZSBleGl0IHRpbWUsIHRoZSBleGl0VGltZSBjb25kaXRpb24gaGFzIGJlZW4gbWV0XG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzID09PSBwcm9ncmVzc0JlZm9yZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MgIT09IHRyYW5zaXRpb24uZXhpdFRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGlmIHRoZSBkZWx0YSB0aW1lIGlzIGdyZWF0ZXIgdGhhbiAwLCByZXR1cm4gZmFsc2UgaWYgZXhpdCB0aW1lIGlzbid0IHdpdGhpbiB0aGUgZnJhbWVzIGRlbHRhIHRpbWVcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCEodHJhbnNpdGlvbi5leGl0VGltZSA+IHByb2dyZXNzQmVmb3JlICYmIHRyYW5zaXRpb24uZXhpdFRpbWUgPD0gcHJvZ3Jlc3MpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIGlmIHRoZSBleGl0VGltZSBjb25kaXRpb24gaGFzIGJlZW4gbWV0IG9yIGlzIG5vdCBwcmVzZW50LCBjaGVjayBjb25kaXRpb24gcGFyYW1ldGVyc1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3RyYW5zaXRpb25IYXNDb25kaXRpb25zTWV0KHRyYW5zaXRpb24pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIGhpZ2hlc3QgcHJpb3JpdHkgdHJhbnNpdGlvbiB0byB1c2VcbiAgICAgICAgaWYgKHRyYW5zaXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zaXRpb24gPSB0cmFuc2l0aW9uc1swXTtcbiAgICAgICAgICAgIGlmICh0cmFuc2l0aW9uLnRvID09PSBBTklNX1NUQVRFX0VORCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0VHJhbnNpdGlvbiA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX1NUQVJUKVswXTtcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9uLnRvID0gc3RhcnRUcmFuc2l0aW9uLnRvO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRyYW5zaXRpb247XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdXBkYXRlU3RhdGVGcm9tVHJhbnNpdGlvbih0cmFuc2l0aW9uKSB7XG4gICAgICAgIGxldCBzdGF0ZTtcbiAgICAgICAgbGV0IGFuaW1hdGlvbjtcbiAgICAgICAgbGV0IGNsaXA7XG4gICAgICAgIC8vIElmIHRyYW5zaXRpb24uZnJvbSBpcyBzZXQsIHRyYW5zaXRpb24gZnJvbSB0aGUgYWN0aXZlIHN0YXRlIGlycmVnYXJkbGVzcyBvZiB0aGUgdHJhbnNpdGlvbi5mcm9tIHZhbHVlICh0aGlzIGNvdWxkIGJlIHRoZSBwcmV2aW91cywgYWN0aXZlIG9yIEFOWSBzdGF0ZXMpLlxuICAgICAgICAvLyBPdGhlcndpc2UgdGhlIHByZXZpb3VzU3RhdGUgaXMgY2xlYXJlZC5cbiAgICAgICAgdGhpcy5wcmV2aW91c1N0YXRlID0gdHJhbnNpdGlvbi5mcm9tID8gdGhpcy5hY3RpdmVTdGF0ZU5hbWUgOiBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZVN0YXRlID0gdHJhbnNpdGlvbi50bztcbiAgICAgICAgLy8gd2hlbiB0cmFuc2l0aW9uaW5nIHRvIGEgbmV3IHN0YXRlLCB3ZSBuZWVkIHRvIHJlY2FsY3VsYXRlIHRoZSBkdXJhdGlvbiBvZiB0aGUgYWN0aXZlIHN0YXRlIGJhc2VkIG9uIGl0cyBhbmltYXRpb25zXG4gICAgICAgIHRoaXMuX2FjdGl2ZVN0YXRlRHVyYXRpb25EaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgLy8gdHVybiBvZmYgYW55IHRyaWdnZXJzIHdoaWNoIHdlcmUgcmVxdWlyZWQgdG8gYWN0aXZhdGUgdGhpcyB0cmFuc2l0aW9uXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJhbnNpdGlvbi5jb25kaXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb25kaXRpb24gPSB0cmFuc2l0aW9uLmNvbmRpdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXIgPSB0aGlzLl9maW5kUGFyYW1ldGVyKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXIudHlwZSA9PT0gQU5JTV9QQVJBTUVURVJfVFJJR0dFUikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVUcmlnZ2VyKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnByZXZpb3VzU3RhdGUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzID0gW107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlY29yZCB0aGUgdHJhbnNpdGlvbiBzb3VyY2Ugc3RhdGUgaW4gdGhlIHByZXZpb3VzIHN0YXRlcyBhcnJheVxuICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lLFxuICAgICAgICAgICAgICAgIHdlaWdodDogMVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgbmV3IHRyYW5zaXRpb24gd2FzIGFjdGl2YXRlZCBkdXJpbmcgYW5vdGhlciB0cmFuc2l0aW9uLCB1cGRhdGUgdGhlIHByZXZpb3VzIHRyYW5zaXRpb24gc3RhdGUgd2VpZ2h0cyBiYXNlZFxuICAgICAgICAgICAgLy8gb24gdGhlIHByb2dyZXNzIHRocm91Z2ggdGhlIHByZXZpb3VzIHRyYW5zaXRpb24uXG4gICAgICAgICAgICBjb25zdCBpbnRlcnBvbGF0ZWRUaW1lID0gTWF0aC5taW4odGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSAhPT0gMCA/IHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSAvIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgOiAxLCAxLjApO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBpbnRlcnBvbGF0ZSB0aGUgd2VpZ2h0cyBvZiB0aGUgbW9zdCByZWNlbnQgcHJldmlvdXMgc3RhdGUgYW5kIGFsbCBvdGhlciBwcmV2aW91cyBzdGF0ZXMgYmFzZWQgb24gdGhlIHByb2dyZXNzIHRocm91Z2ggdGhlIHByZXZpb3VzIHRyYW5zaXRpb25cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ud2VpZ2h0ID0gMS4wO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaSAhPT0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCAqPSAoMS4wIC0gaW50ZXJwb2xhdGVkVGltZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCA9IGludGVycG9sYXRlZFRpbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgdGhlIGFuaW1hdGlvbnMgb2YgcHJldmlvdXMgc3RhdGVzLCBzZXQgdGhlaXIgbmFtZSB0byBpbmNsdWRlIHRoZWlyIHBvc2l0aW9uIGluIHRoZSBwcmV2aW91cyBzdGF0ZSBhcnJheVxuICAgICAgICAgICAgICAgIC8vIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IGFuaW1hdGlvbnMgZnJvbSB0aGUgc2FtZSBzdGF0ZSB0aGF0IHdlcmUgYWRkZWQgZHVyaW5nIGRpZmZlcmVudCB0cmFuc2l0aW9uc1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2pdO1xuICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSArICcucHJldmlvdXMuJyArIGkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAubmFtZSA9IGFuaW1hdGlvbi5uYW1lICsgJy5wcmV2aW91cy4nICsgaTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyAvLyBwYXVzZSBwcmV2aW91cyBhbmltYXRpb24gY2xpcHMgdG8gcmVkdWNlIHRoZWlyIGltcGFjdCBvbiBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgICAgICAgICBpZiAoaSAhPT0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAucGF1c2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgPSB0cmFuc2l0aW9uLnRpbWU7XG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UgPSB0cmFuc2l0aW9uLmludGVycnVwdGlvblNvdXJjZTtcblxuXG4gICAgICAgIGNvbnN0IGFjdGl2ZVN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgY29uc3QgaGFzVHJhbnNpdGlvbk9mZnNldCA9IHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldCAmJiB0cmFuc2l0aW9uLnRyYW5zaXRpb25PZmZzZXQgPiAwLjAgJiYgdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0IDwgMS4wO1xuXG4gICAgICAgIC8vIHNldCB0aGUgdGltZSBpbiB0aGUgbmV3IHN0YXRlIHRvIDAgb3IgdG8gYSB2YWx1ZSBiYXNlZCBvbiB0cmFuc2l0aW9uT2Zmc2V0IGlmIG9uZSB3YXMgZ2l2ZW5cbiAgICAgICAgbGV0IHRpbWVJblN0YXRlID0gMDtcbiAgICAgICAgbGV0IHRpbWVJblN0YXRlQmVmb3JlID0gMDtcbiAgICAgICAgaWYgKGhhc1RyYW5zaXRpb25PZmZzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9mZnNldFRpbWUgPSBhY3RpdmVTdGF0ZS50aW1lbGluZUR1cmF0aW9uICogdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0O1xuICAgICAgICAgICAgdGltZUluU3RhdGUgPSBvZmZzZXRUaW1lO1xuICAgICAgICAgICAgdGltZUluU3RhdGVCZWZvcmUgPSBvZmZzZXRUaW1lO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlID0gdGltZUluU3RhdGU7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gdGltZUluU3RhdGVCZWZvcmU7XG5cbiAgICAgICAgLy8gQWRkIGNsaXBzIHRvIHRoZSBldmFsdWF0b3IgZm9yIGVhY2ggYW5pbWF0aW9uIGluIHRoZSBuZXcgc3RhdGUuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWN0aXZlU3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5uYW1lKTtcbiAgICAgICAgICAgIGlmICghY2xpcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwZWVkID0gTnVtYmVyLmlzRmluaXRlKGFjdGl2ZVN0YXRlLmFuaW1hdGlvbnNbaV0uc3BlZWQpID8gYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5zcGVlZCA6IGFjdGl2ZVN0YXRlLnNwZWVkO1xuICAgICAgICAgICAgICAgIGNsaXAgPSBuZXcgQW5pbUNsaXAoYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5hbmltVHJhY2ssIHRoaXMuX3RpbWVJblN0YXRlLCBzcGVlZCwgdHJ1ZSwgYWN0aXZlU3RhdGUubG9vcCwgdGhpcy5fZXZlbnRIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICBjbGlwLm5hbWUgPSBhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLm5hbWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci5hZGRDbGlwKGNsaXApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjbGlwLnJlc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHJhbnNpdGlvbi50aW1lID4gMCkge1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSAwLjA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSBhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLm5vcm1hbGl6ZWRXZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbGlwLnBsYXkoKTtcbiAgICAgICAgICAgIGlmIChoYXNUcmFuc2l0aW9uT2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgY2xpcC50aW1lID0gYWN0aXZlU3RhdGUudGltZWxpbmVEdXJhdGlvbiAqIHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gYWN0aXZlU3RhdGUuc3BlZWQgPj0gMCA/IDAgOiB0aGlzLmFjdGl2ZVN0YXRlRHVyYXRpb247XG4gICAgICAgICAgICAgICAgY2xpcC50aW1lID0gc3RhcnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3RyYW5zaXRpb25Ub1N0YXRlKG5ld1N0YXRlTmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX2ZpbmRTdGF0ZShuZXdTdGF0ZU5hbWUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb3ZlIHRvIHRoZSBnaXZlbiBzdGF0ZSwgaWYgYSB0cmFuc2l0aW9uIGlzIHByZXNlbnQgaW4gdGhlIHN0YXRlIGdyYXBoIHVzZSBpdC4gT3RoZXJ3aXNlIG1vdmUgaW5zdGFudGx5IHRvIGl0LlxuICAgICAgICBsZXQgdHJhbnNpdGlvbiA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSwgbmV3U3RhdGVOYW1lKTtcbiAgICAgICAgaWYgKCF0cmFuc2l0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXBzKCk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uID0gbmV3IEFuaW1UcmFuc2l0aW9uKHsgZnJvbTogbnVsbCwgdG86IG5ld1N0YXRlTmFtZSB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlRnJvbVRyYW5zaXRpb24odHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgYXNzaWduQW5pbWF0aW9uKHBhdGhTdHJpbmcsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IHBhdGhTdHJpbmcuc3BsaXQoJy4nKTtcbiAgICAgICAgbGV0IHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHBhdGhbMF0pO1xuICAgICAgICBpZiAoIXN0YXRlKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IG5ldyBBbmltU3RhdGUodGhpcywgcGF0aFswXSwgc3BlZWQpO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVzW3BhdGhbMF1dID0gc3RhdGU7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZU5hbWVzLnB1c2gocGF0aFswXSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUuYWRkQW5pbWF0aW9uKHBhdGgsIGFuaW1UcmFjayk7XG4gICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IudXBkYXRlQ2xpcFRyYWNrKHN0YXRlLm5hbWUsIGFuaW1UcmFjayk7XG4gICAgICAgIGlmIChzcGVlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdGF0ZS5zcGVlZCA9IHNwZWVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsb29wICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHN0YXRlLmxvb3AgPSBsb29wO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLl9wbGF5aW5nICYmIHRoaXMuX2FjdGl2YXRlICYmIHRoaXMucGxheWFibGUpIHtcbiAgICAgICAgICAgIHRoaXMucGxheSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2hlbiBhIG5ldyBhbmltYXRpb24gaXMgYWRkZWQsIHRoZSBhY3RpdmUgc3RhdGUgZHVyYXRpb24gbmVlZHMgdG8gYmUgcmVjYWxjdWxhdGVkXG4gICAgICAgIHRoaXMuX2FjdGl2ZVN0YXRlRHVyYXRpb25EaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgcmVtb3ZlTm9kZUFuaW1hdGlvbnMobm9kZU5hbWUpIHtcbiAgICAgICAgaWYgKEFOSU1fQ09OVFJPTF9TVEFURVMuaW5kZXhPZihub2RlTmFtZSkgIT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLl9maW5kU3RhdGUobm9kZU5hbWUpO1xuICAgICAgICBpZiAoIXN0YXRlKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcignQXR0ZW1wdGluZyB0byB1bmFzc2lnbiBhbmltYXRpb24gdHJhY2tzIGZyb20gYSBzdGF0ZSB0aGF0IGRvZXMgbm90IGV4aXN0LicsIG5vZGVOYW1lKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRlLmFuaW1hdGlvbnMgPSBbXTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcGxheShzdGF0ZU5hbWUpIHtcbiAgICAgICAgaWYgKHN0YXRlTmFtZSkge1xuICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblRvU3RhdGUoc3RhdGVOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9wbGF5aW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlc2V0KCkge1xuICAgICAgICB0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSA9IEFOSU1fU1RBVEVfU1RBUlQ7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fY3VyclRyYW5zaXRpb25UaW1lID0gMS4wO1xuICAgICAgICB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lID0gMS4wO1xuICAgICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGUgPSAwO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSA9IDA7XG4gICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IucmVtb3ZlQ2xpcHMoKTtcbiAgICB9XG5cbiAgICByZWJpbmQoKSB7XG4gICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IucmViaW5kKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlKGR0KSB7XG4gICAgICAgIGlmICghdGhpcy5fcGxheWluZykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzdGF0ZTtcbiAgICAgICAgbGV0IGFuaW1hdGlvbjtcbiAgICAgICAgbGV0IGNsaXA7XG4gICAgICAgIC8vIHVwZGF0ZSB0aW1lIHdoZW4gbG9vcGluZyBvciB3aGVuIHRoZSBhY3RpdmUgc3RhdGUgaXMgbm90IGF0IHRoZSBlbmQgb2YgaXRzIGR1cmF0aW9uXG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZVN0YXRlLmxvb3AgfHwgdGhpcy5fdGltZUluU3RhdGUgPCB0aGlzLmFjdGl2ZVN0YXRlRHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gdGhpcy5fdGltZUluU3RhdGU7XG4gICAgICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSArPSBkdCAqIHRoaXMuYWN0aXZlU3RhdGUuc3BlZWQ7XG4gICAgICAgICAgICAvLyBpZiB0aGUgYWN0aXZlIHN0YXRlIGlzIG5vdCBsb29waW5nIGFuZCB0aGUgdGltZSBpbiBzdGF0ZSBpcyBncmVhdGVyIHRoYW4gdGhlIGR1cmF0aW9uLCBzZXQgdGhlIHRpbWUgaW4gc3RhdGUgdG8gdGhlIHN0YXRlIGR1cmF0aW9uXG4gICAgICAgICAgICAvLyBhbmQgdXBkYXRlIHRoZSBkZWx0YSB0aW1lIGFjY29yZGluZ2x5XG4gICAgICAgICAgICBpZiAoIXRoaXMuYWN0aXZlU3RhdGUubG9vcCAmJiB0aGlzLl90aW1lSW5TdGF0ZSA+IHRoaXMuYWN0aXZlU3RhdGVEdXJhdGlvbikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RpbWVJblN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZUR1cmF0aW9uO1xuICAgICAgICAgICAgICAgIGR0ID0gdGhpcy5hY3RpdmVTdGF0ZUR1cmF0aW9uIC0gdGhpcy5fdGltZUluU3RhdGVCZWZvcmU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0cmFuc2l0aW9uIGJldHdlZW4gc3RhdGVzIGlmIGEgdHJhbnNpdGlvbiBpcyBhdmFpbGFibGUgZnJvbSB0aGUgYWN0aXZlIHN0YXRlXG4gICAgICAgIGNvbnN0IHRyYW5zaXRpb24gPSB0aGlzLl9maW5kVHJhbnNpdGlvbih0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpO1xuICAgICAgICBpZiAodHJhbnNpdGlvbilcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdGVGcm9tVHJhbnNpdGlvbih0cmFuc2l0aW9uKTtcblxuICAgICAgICBpZiAodGhpcy5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgKz0gZHQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fY3VyclRyYW5zaXRpb25UaW1lIDw9IHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbnRlcnBvbGF0ZWRUaW1lID0gdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSAhPT0gMCA/IHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSAvIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgOiAxO1xuICAgICAgICAgICAgICAgIC8vIHdoaWxlIHRyYW5zaXRpb25pbmcsIHNldCBhbGwgcHJldmlvdXMgc3RhdGUgYW5pbWF0aW9ucyB0byBiZSB3ZWlnaHRlZCBieSAoMS4wIC0gaW50ZXJwb2xhdGlvblRpbWUpLlxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdGVXZWlnaHQgPSB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ud2VpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuaW1hdGlvbiA9IHN0YXRlLmFuaW1hdGlvbnNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSArICcucHJldmlvdXMuJyArIGkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlwLmJsZW5kV2VpZ2h0ID0gKDEuMCAtIGludGVycG9sYXRlZFRpbWUpICogYW5pbWF0aW9uLm5vcm1hbGl6ZWRXZWlnaHQgKiBzdGF0ZVdlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyB3aGlsZSB0cmFuc2l0aW9uaW5nLCBzZXQgYWN0aXZlIHN0YXRlIGFuaW1hdGlvbnMgdG8gYmUgd2VpZ2h0ZWQgYnkgKGludGVycG9sYXRpb25UaW1lKS5cbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMuYWN0aXZlU3RhdGU7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0ZS5hbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGFuaW1hdGlvbiA9IHN0YXRlLmFuaW1hdGlvbnNbaV07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUpLmJsZW5kV2VpZ2h0ID0gaW50ZXJwb2xhdGVkVGltZSAqIGFuaW1hdGlvbi5ub3JtYWxpemVkV2VpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgLy8gd2hlbiBhIHRyYW5zaXRpb24gZW5kcywgcmVtb3ZlIGFsbCBwcmV2aW91cyBzdGF0ZSBjbGlwcyBmcm9tIHRoZSBldmFsdWF0b3JcbiAgICAgICAgICAgICAgICBjb25zdCBhY3RpdmVDbGlwcyA9IHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBjb25zdCB0b3RhbENsaXBzID0gdGhpcy5fYW5pbUV2YWx1YXRvci5jbGlwcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b3RhbENsaXBzIC0gYWN0aXZlQ2xpcHM7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXAoMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcyA9IFtdO1xuICAgICAgICAgICAgICAgIC8vIHdoZW4gYSB0cmFuc2l0aW9uIGVuZHMsIHNldCB0aGUgYWN0aXZlIHN0YXRlIGNsaXAgd2VpZ2h0cyBzbyB0aGV5IHN1bSB0byAxXG4gICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLmFjdGl2ZVN0YXRlO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2ldO1xuICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjbGlwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlwLmJsZW5kV2VpZ2h0ID0gYW5pbWF0aW9uLm5vcm1hbGl6ZWRXZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5hY3RpdmVTdGF0ZS5fYmxlbmRUcmVlLmNvbnN0cnVjdG9yICE9PSBBbmltTm9kZSkge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uID0gc3RhdGUuYW5pbWF0aW9uc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2xpcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xpcC5ibGVuZFdlaWdodCA9IGFuaW1hdGlvbi5ub3JtYWxpemVkV2VpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFuaW1hdGlvbi5wYXJlbnQuc3luY0FuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGlwLnNwZWVkID0gYW5pbWF0aW9uLnNwZWVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2FuaW1FdmFsdWF0b3IudXBkYXRlKGR0LCB0aGlzLmFjdGl2ZVN0YXRlLmhhc0FuaW1hdGlvbnMpO1xuICAgIH1cblxuICAgIGZpbmRQYXJhbWV0ZXIgPSAobmFtZSkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmluZFBhcmFtZXRlcihuYW1lKTtcbiAgICB9O1xufVxuXG5leHBvcnQgeyBBbmltQ29udHJvbGxlciB9O1xuIl0sIm5hbWVzIjpbIkFuaW1Db250cm9sbGVyIiwiY29uc3RydWN0b3IiLCJhbmltRXZhbHVhdG9yIiwic3RhdGVzIiwidHJhbnNpdGlvbnMiLCJhY3RpdmF0ZSIsImV2ZW50SGFuZGxlciIsImZpbmRQYXJhbWV0ZXIiLCJjb25zdW1lVHJpZ2dlciIsIm5hbWUiLCJfZmluZFBhcmFtZXRlciIsIl9hbmltRXZhbHVhdG9yIiwiX3N0YXRlcyIsIl9zdGF0ZU5hbWVzIiwiX2V2ZW50SGFuZGxlciIsIl9jb25zdW1lVHJpZ2dlciIsImkiLCJsZW5ndGgiLCJBbmltU3RhdGUiLCJzcGVlZCIsImxvb3AiLCJibGVuZFRyZWUiLCJwdXNoIiwiX3RyYW5zaXRpb25zIiwibWFwIiwidHJhbnNpdGlvbiIsIkFuaW1UcmFuc2l0aW9uIiwiX2V4dGVuZHMiLCJfZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlQ2FjaGUiLCJfZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlc0NhY2hlIiwiX3ByZXZpb3VzU3RhdGVOYW1lIiwiX2FjdGl2ZVN0YXRlTmFtZSIsIkFOSU1fU1RBVEVfU1RBUlQiLCJfYWN0aXZlU3RhdGVEdXJhdGlvbiIsIl9hY3RpdmVTdGF0ZUR1cmF0aW9uRGlydHkiLCJfcGxheWluZyIsIl9hY3RpdmF0ZSIsIl9jdXJyVHJhbnNpdGlvblRpbWUiLCJfdG90YWxUcmFuc2l0aW9uVGltZSIsIl9pc1RyYW5zaXRpb25pbmciLCJfdHJhbnNpdGlvbkludGVycnVwdGlvblNvdXJjZSIsIkFOSU1fSU5URVJSVVBUSU9OX05PTkUiLCJfdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzIiwiX3RpbWVJblN0YXRlIiwiX3RpbWVJblN0YXRlQmVmb3JlIiwiYWN0aXZlU3RhdGUiLCJzdGF0ZU5hbWUiLCJfZmluZFN0YXRlIiwiYWN0aXZlU3RhdGVOYW1lIiwiYWN0aXZlU3RhdGVBbmltYXRpb25zIiwiYW5pbWF0aW9ucyIsInByZXZpb3VzU3RhdGUiLCJwcmV2aW91c1N0YXRlTmFtZSIsInBsYXlhYmxlIiwicGxheWluZyIsInZhbHVlIiwiYWN0aXZlU3RhdGVQcm9ncmVzcyIsIl9nZXRBY3RpdmVTdGF0ZVByb2dyZXNzRm9yVGltZSIsImFjdGl2ZVN0YXRlRHVyYXRpb24iLCJtYXhEdXJhdGlvbiIsImFjdGl2ZUNsaXAiLCJmaW5kQ2xpcCIsIk1hdGgiLCJtYXgiLCJ0cmFjayIsImR1cmF0aW9uIiwiYWN0aXZlU3RhdGVDdXJyZW50VGltZSIsInRpbWUiLCJjbGlwIiwidHJhbnNpdGlvbmluZyIsInRyYW5zaXRpb25Qcm9ncmVzcyIsImFzc2lnbk1hc2siLCJtYXNrIiwiQU5JTV9TVEFURV9FTkQiLCJBTklNX1NUQVRFX0FOWSIsInByb2dyZXNzRm9yVGltZSIsIl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUiLCJmaWx0ZXIiLCJmcm9tIiwic29ydFByaW9yaXR5IiwiX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXMiLCJzb3VyY2VTdGF0ZU5hbWUiLCJkZXN0aW5hdGlvblN0YXRlTmFtZSIsInRvIiwiX3RyYW5zaXRpb25IYXNDb25kaXRpb25zTWV0IiwiY29uZGl0aW9ucyIsImNvbmRpdGlvbiIsInBhcmFtZXRlciIsInBhcmFtZXRlck5hbWUiLCJwcmVkaWNhdGUiLCJBTklNX0dSRUFURVJfVEhBTiIsIkFOSU1fTEVTU19USEFOIiwiQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE8iLCJBTklNX0xFU1NfVEhBTl9FUVVBTF9UTyIsIkFOSU1fRVFVQUxfVE8iLCJBTklNX05PVF9FUVVBTF9UTyIsIl9maW5kVHJhbnNpdGlvbiIsImNvbmNhdCIsIkFOSU1fSU5URVJSVVBUSU9OX1BSRVYiLCJBTklNX0lOVEVSUlVQVElPTl9ORVhUIiwiQU5JTV9JTlRFUlJVUFRJT05fUFJFVl9ORVhUIiwiQU5JTV9JTlRFUlJVUFRJT05fTkVYVF9QUkVWIiwiaGFzRXhpdFRpbWUiLCJwcm9ncmVzc0JlZm9yZSIsInByb2dyZXNzIiwiZXhpdFRpbWUiLCJmbG9vciIsInN0YXJ0VHJhbnNpdGlvbiIsInVwZGF0ZVN0YXRlRnJvbVRyYW5zaXRpb24iLCJzdGF0ZSIsImFuaW1hdGlvbiIsInR5cGUiLCJBTklNX1BBUkFNRVRFUl9UUklHR0VSIiwid2VpZ2h0IiwiaW50ZXJwb2xhdGVkVGltZSIsIm1pbiIsImoiLCJwYXVzZSIsImludGVycnVwdGlvblNvdXJjZSIsImhhc1RyYW5zaXRpb25PZmZzZXQiLCJ0cmFuc2l0aW9uT2Zmc2V0IiwidGltZUluU3RhdGUiLCJ0aW1lSW5TdGF0ZUJlZm9yZSIsIm9mZnNldFRpbWUiLCJ0aW1lbGluZUR1cmF0aW9uIiwiTnVtYmVyIiwiaXNGaW5pdGUiLCJBbmltQ2xpcCIsImFuaW1UcmFjayIsImFkZENsaXAiLCJyZXNldCIsImJsZW5kV2VpZ2h0Iiwibm9ybWFsaXplZFdlaWdodCIsInBsYXkiLCJzdGFydFRpbWUiLCJfdHJhbnNpdGlvblRvU3RhdGUiLCJuZXdTdGF0ZU5hbWUiLCJyZW1vdmVDbGlwcyIsImFzc2lnbkFuaW1hdGlvbiIsInBhdGhTdHJpbmciLCJwYXRoIiwic3BsaXQiLCJhZGRBbmltYXRpb24iLCJ1cGRhdGVDbGlwVHJhY2siLCJ1bmRlZmluZWQiLCJyZW1vdmVOb2RlQW5pbWF0aW9ucyIsIm5vZGVOYW1lIiwiQU5JTV9DT05UUk9MX1NUQVRFUyIsImluZGV4T2YiLCJEZWJ1ZyIsImVycm9yIiwicmViaW5kIiwidXBkYXRlIiwiZHQiLCJzdGF0ZVdlaWdodCIsImFjdGl2ZUNsaXBzIiwidG90YWxDbGlwcyIsImNsaXBzIiwicmVtb3ZlQ2xpcCIsIl9ibGVuZFRyZWUiLCJBbmltTm9kZSIsInBhcmVudCIsInN5bmNBbmltYXRpb25zIiwiaGFzQW5pbWF0aW9ucyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGNBQWMs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
