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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1jb250cm9sbGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2FuaW0vY29udHJvbGxlci9hbmltLWNvbnRyb2xsZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHNvcnRQcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvc29ydC5qcyc7XG5pbXBvcnQgeyBBbmltQ2xpcCB9IGZyb20gJy4uL2V2YWx1YXRvci9hbmltLWNsaXAuanMnO1xuaW1wb3J0IHsgQW5pbVN0YXRlIH0gZnJvbSAnLi9hbmltLXN0YXRlLmpzJztcbmltcG9ydCB7IEFuaW1Ob2RlIH0gZnJvbSAnLi9hbmltLW5vZGUuanMnO1xuaW1wb3J0IHsgQW5pbVRyYW5zaXRpb24gfSBmcm9tICcuL2FuaW0tdHJhbnNpdGlvbi5qcyc7XG5pbXBvcnQge1xuICAgIEFOSU1fR1JFQVRFUl9USEFOLCBBTklNX0xFU1NfVEhBTiwgQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE8sIEFOSU1fTEVTU19USEFOX0VRVUFMX1RPLCBBTklNX0VRVUFMX1RPLCBBTklNX05PVF9FUVVBTF9UTyxcbiAgICBBTklNX0lOVEVSUlVQVElPTl9OT05FLCBBTklNX0lOVEVSUlVQVElPTl9QUkVWLCBBTklNX0lOVEVSUlVQVElPTl9ORVhULCBBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQsIEFOSU1fSU5URVJSVVBUSU9OX05FWFRfUFJFVixcbiAgICBBTklNX1BBUkFNRVRFUl9UUklHR0VSLFxuICAgIEFOSU1fU1RBVEVfU1RBUlQsIEFOSU1fU1RBVEVfRU5ELCBBTklNX1NUQVRFX0FOWSwgQU5JTV9DT05UUk9MX1NUQVRFU1xufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogVGhlIEFuaW1Db250cm9sbGVyIG1hbmFnZXMgdGhlIGFuaW1hdGlvbnMgZm9yIGl0cyBlbnRpdHksIGJhc2VkIG9uIHRoZSBwcm92aWRlZCBzdGF0ZSBncmFwaCBhbmRcbiAqIHBhcmFtZXRlcnMuIEl0cyB1cGRhdGUgbWV0aG9kIGRldGVybWluZXMgd2hpY2ggc3RhdGUgdGhlIGNvbnRyb2xsZXIgc2hvdWxkIGJlIGluIGJhc2VkIG9uIHRoZVxuICogY3VycmVudCB0aW1lLCBwYXJhbWV0ZXJzIGFuZCBhdmFpbGFibGUgc3RhdGVzIC8gdHJhbnNpdGlvbnMuIEl0IGFsc28gZW5zdXJlcyB0aGUgQW5pbUV2YWx1YXRvclxuICogaXMgc3VwcGxpZWQgd2l0aCB0aGUgY29ycmVjdCBhbmltYXRpb25zLCBiYXNlZCBvbiB0aGUgY3VycmVudGx5IGFjdGl2ZSBzdGF0ZS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEFuaW1Db250cm9sbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQW5pbUNvbnRyb2xsZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZXZhbHVhdG9yL2FuaW0tZXZhbHVhdG9yLmpzJykuQW5pbUV2YWx1YXRvcn0gYW5pbUV2YWx1YXRvciAtIFRoZVxuICAgICAqIGFuaW1hdGlvbiBldmFsdWF0b3IgdXNlZCB0byBibGVuZCBhbGwgY3VycmVudCBwbGF5aW5nIGFuaW1hdGlvbiBrZXlmcmFtZXMgYW5kIHVwZGF0ZSB0aGVcbiAgICAgKiBlbnRpdGllcyBwcm9wZXJ0aWVzIGJhc2VkIG9uIHRoZSBjdXJyZW50IGFuaW1hdGlvbiB2YWx1ZXMuXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gc3RhdGVzIC0gVGhlIGxpc3Qgb2Ygc3RhdGVzIHVzZWQgdG8gZm9ybSB0aGUgY29udHJvbGxlciBzdGF0ZSBncmFwaC5cbiAgICAgKiBAcGFyYW0ge29iamVjdFtdfSB0cmFuc2l0aW9ucyAtIFRoZSBsaXN0IG9mIHRyYW5zaXRpb25zIHVzZWQgdG8gZm9ybSB0aGUgY29udHJvbGxlciBzdGF0ZVxuICAgICAqIGdyYXBoLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0W119IHBhcmFtZXRlcnMgLSBUaGUgYW5pbSBjb21wb25lbnRzIHBhcmFtZXRlcnMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBhY3RpdmF0ZSAtIERldGVybWluZXMgd2hldGhlciB0aGUgYW5pbSBjb250cm9sbGVyIHNob3VsZCBhdXRvbWF0aWNhbGx5IHBsYXlcbiAgICAgKiBvbmNlIGFsbCB7QGxpbmsgQW5pbU5vZGVzfSBhcmUgYXNzaWduZWQgYW5pbWF0aW9ucy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJykuRXZlbnRIYW5kbGVyfSBldmVudEhhbmRsZXIgLSBUaGUgZXZlbnRcbiAgICAgKiBoYW5kbGVyIHdoaWNoIHNob3VsZCBiZSBub3RpZmllZCB3aXRoIGFuaW0gZXZlbnRzLlxuICAgICAqIEBwYXJhbSB7U2V0fSBjb25zdW1lZFRyaWdnZXJzIC0gVXNlZCB0byBzZXQgdHJpZ2dlcnMgYmFjayB0byB0aGVpciBkZWZhdWx0IHN0YXRlIGFmdGVyIHRoZXlcbiAgICAgKiBoYXZlIGJlZW4gY29uc3VtZWQgYnkgYSB0cmFuc2l0aW9uLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFuaW1FdmFsdWF0b3IsIHN0YXRlcywgdHJhbnNpdGlvbnMsIHBhcmFtZXRlcnMsIGFjdGl2YXRlLCBldmVudEhhbmRsZXIsIGNvbnN1bWVkVHJpZ2dlcnMpIHtcbiAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvciA9IGFuaW1FdmFsdWF0b3I7XG4gICAgICAgIHRoaXMuX3N0YXRlcyA9IHt9O1xuICAgICAgICB0aGlzLl9zdGF0ZU5hbWVzID0gW107XG4gICAgICAgIHRoaXMuX2V2ZW50SGFuZGxlciA9IGV2ZW50SGFuZGxlcjtcbiAgICAgICAgdGhpcy5fY29uc3VtZWRUcmlnZ2VycyA9IGNvbnN1bWVkVHJpZ2dlcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZXNbc3RhdGVzW2ldLm5hbWVdID0gbmV3IEFuaW1TdGF0ZShcbiAgICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAgIHN0YXRlc1tpXS5uYW1lLFxuICAgICAgICAgICAgICAgIHN0YXRlc1tpXS5zcGVlZCxcbiAgICAgICAgICAgICAgICBzdGF0ZXNbaV0ubG9vcCxcbiAgICAgICAgICAgICAgICBzdGF0ZXNbaV0uYmxlbmRUcmVlXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVOYW1lcy5wdXNoKHN0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl90cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLm1hcCgodHJhbnNpdGlvbikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBBbmltVHJhbnNpdGlvbih7XG4gICAgICAgICAgICAgICAgLi4udHJhbnNpdGlvblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZSA9IHt9O1xuICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGUgPSB7fTtcbiAgICAgICAgdGhpcy5fcGFyYW1ldGVycyA9IHBhcmFtZXRlcnM7XG4gICAgICAgIHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYWN0aXZlU3RhdGVOYW1lID0gQU5JTV9TVEFURV9TVEFSVDtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hY3RpdmF0ZSA9IGFjdGl2YXRlO1xuXG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UgPSBBTklNX0lOVEVSUlVQVElPTl9OT05FO1xuICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMgPSBbXTtcblxuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSA9IDA7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gMDtcbiAgICB9XG5cbiAgICBnZXQgYW5pbUV2YWx1YXRvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1FdmFsdWF0b3I7XG4gICAgfVxuXG4gICAgc2V0IGFjdGl2ZVN0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICB0aGlzLl9hY3RpdmVTdGF0ZU5hbWUgPSBzdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmluZFN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0IGFjdGl2ZVN0YXRlTmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FjdGl2ZVN0YXRlTmFtZTtcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVBbmltYXRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5hY3RpdmVTdGF0ZS5hbmltYXRpb25zO1xuICAgIH1cblxuICAgIHNldCBwcmV2aW91c1N0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICB0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSA9IHN0YXRlTmFtZTtcbiAgICB9XG5cbiAgICBnZXQgcHJldmlvdXNTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbmRTdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSk7XG4gICAgfVxuXG4gICAgZ2V0IHByZXZpb3VzU3RhdGVOYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJldmlvdXNTdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgZ2V0IHBsYXlhYmxlKCkge1xuICAgICAgICBsZXQgcGxheWFibGUgPSB0cnVlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3N0YXRlTmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc3RhdGVzW3RoaXMuX3N0YXRlTmFtZXNbaV1dLnBsYXlhYmxlKSB7XG4gICAgICAgICAgICAgICAgcGxheWFibGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGxheWFibGU7XG4gICAgfVxuXG4gICAgc2V0IHBsYXlpbmcodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcGxheWluZyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBwbGF5aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGxheWluZztcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVQcm9ncmVzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEFjdGl2ZVN0YXRlUHJvZ3Jlc3NGb3JUaW1lKHRoaXMuX3RpbWVJblN0YXRlKTtcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVEdXJhdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX1NUQVJUIHx8IHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX0VORClcbiAgICAgICAgICAgIHJldHVybiAwLjA7XG5cbiAgICAgICAgbGV0IG1heER1cmF0aW9uID0gMC4wO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYWN0aXZlU3RhdGVBbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBhY3RpdmVDbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcCh0aGlzLmFjdGl2ZVN0YXRlQW5pbWF0aW9uc1tpXS5uYW1lKTtcbiAgICAgICAgICAgIGlmIChhY3RpdmVDbGlwKSB7XG4gICAgICAgICAgICAgICAgbWF4RHVyYXRpb24gPSBNYXRoLm1heChtYXhEdXJhdGlvbiwgYWN0aXZlQ2xpcC50cmFjay5kdXJhdGlvbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1heER1cmF0aW9uO1xuICAgIH1cblxuICAgIHNldCBhY3RpdmVTdGF0ZUN1cnJlbnRUaW1lKHRpbWUpIHtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGVCZWZvcmUgPSB0aW1lO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSA9IHRpbWU7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNsaXAgPSB0aGlzLmFuaW1FdmFsdWF0b3IuZmluZENsaXAodGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnNbaV0ubmFtZSk7XG4gICAgICAgICAgICBpZiAoY2xpcCkge1xuICAgICAgICAgICAgICAgIGNsaXAudGltZSA9IHRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVDdXJyZW50VGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RpbWVJblN0YXRlO1xuICAgIH1cblxuICAgIGdldCB0cmFuc2l0aW9uaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNUcmFuc2l0aW9uaW5nO1xuICAgIH1cblxuICAgIGdldCB0cmFuc2l0aW9uUHJvZ3Jlc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgLyB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lO1xuICAgIH1cblxuICAgIGdldCBzdGF0ZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZU5hbWVzO1xuICAgIH1cblxuICAgIGFzc2lnbk1hc2sobWFzaykge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pbUV2YWx1YXRvci5hc3NpZ25NYXNrKG1hc2spO1xuICAgIH1cblxuICAgIF9maW5kU3RhdGUoc3RhdGVOYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZXNbc3RhdGVOYW1lXTtcbiAgICB9XG5cbiAgICBfZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUodGltZSkge1xuICAgICAgICBpZiAodGhpcy5hY3RpdmVTdGF0ZU5hbWUgPT09IEFOSU1fU1RBVEVfU1RBUlQgfHwgdGhpcy5hY3RpdmVTdGF0ZU5hbWUgPT09IEFOSU1fU1RBVEVfRU5EIHx8IHRoaXMuYWN0aXZlU3RhdGVOYW1lID09PSBBTklNX1NUQVRFX0FOWSlcbiAgICAgICAgICAgIHJldHVybiAxLjA7XG5cbiAgICAgICAgY29uc3QgYWN0aXZlQ2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAodGhpcy5hY3RpdmVTdGF0ZUFuaW1hdGlvbnNbMF0ubmFtZSk7XG4gICAgICAgIGlmIChhY3RpdmVDbGlwKSB7XG4gICAgICAgICAgICByZXR1cm4gYWN0aXZlQ2xpcC5wcm9ncmVzc0ZvclRpbWUodGltZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYWxsIHRoZSB0cmFuc2l0aW9ucyB0aGF0IGhhdmUgdGhlIGdpdmVuIHN0YXRlTmFtZSBhcyB0aGVpciBzb3VyY2Ugc3RhdGVcbiAgICBfZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHN0YXRlTmFtZSkge1xuICAgICAgICBsZXQgdHJhbnNpdGlvbnMgPSB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZVtzdGF0ZU5hbWVdO1xuICAgICAgICBpZiAoIXRyYW5zaXRpb25zKSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRoaXMuX3RyYW5zaXRpb25zLmZpbHRlcihmdW5jdGlvbiAodHJhbnNpdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cmFuc2l0aW9uLmZyb20gPT09IHN0YXRlTmFtZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBzb3J0IHRyYW5zaXRpb25zIGluIHByaW9yaXR5IG9yZGVyXG4gICAgICAgICAgICBzb3J0UHJpb3JpdHkodHJhbnNpdGlvbnMpO1xuXG4gICAgICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZVtzdGF0ZU5hbWVdID0gdHJhbnNpdGlvbnM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRyYW5zaXRpb25zO1xuICAgIH1cblxuICAgIC8vIHJldHVybiBhbGwgdGhlIHRyYW5zaXRpb25zIHRoYXQgY29udGFpbiB0aGUgZ2l2ZW4gc291cmNlIGFuZCBkZXN0aW5hdGlvbiBzdGF0ZXNcbiAgICBfZmluZFRyYW5zaXRpb25zQmV0d2VlblN0YXRlcyhzb3VyY2VTdGF0ZU5hbWUsIGRlc3RpbmF0aW9uU3RhdGVOYW1lKSB7XG4gICAgICAgIGxldCB0cmFuc2l0aW9ucyA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXNDYWNoZVtzb3VyY2VTdGF0ZU5hbWUgKyAnLT4nICsgZGVzdGluYXRpb25TdGF0ZU5hbWVdO1xuICAgICAgICBpZiAoIXRyYW5zaXRpb25zKSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRoaXMuX3RyYW5zaXRpb25zLmZpbHRlcihmdW5jdGlvbiAodHJhbnNpdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cmFuc2l0aW9uLmZyb20gPT09IHNvdXJjZVN0YXRlTmFtZSAmJiB0cmFuc2l0aW9uLnRvID09PSBkZXN0aW5hdGlvblN0YXRlTmFtZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBzb3J0IHRyYW5zaXRpb25zIGluIHByaW9yaXR5IG9yZGVyXG4gICAgICAgICAgICBzb3J0UHJpb3JpdHkodHJhbnNpdGlvbnMpO1xuXG4gICAgICAgICAgICB0aGlzLl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGVbc291cmNlU3RhdGVOYW1lICsgJy0+JyArIGRlc3RpbmF0aW9uU3RhdGVOYW1lXSA9IHRyYW5zaXRpb25zO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cmFuc2l0aW9ucztcbiAgICB9XG5cbiAgICBfdHJhbnNpdGlvbkhhc0NvbmRpdGlvbnNNZXQodHJhbnNpdGlvbikge1xuICAgICAgICBjb25zdCBjb25kaXRpb25zID0gdHJhbnNpdGlvbi5jb25kaXRpb25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbmRpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IGNvbmRpdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXIgPSB0aGlzLmZpbmRQYXJhbWV0ZXIoY29uZGl0aW9uLnBhcmFtZXRlck5hbWUpO1xuICAgICAgICAgICAgc3dpdGNoIChjb25kaXRpb24ucHJlZGljYXRlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBBTklNX0dSRUFURVJfVEhBTjpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlID4gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIEFOSU1fTEVTU19USEFOOlxuICAgICAgICAgICAgICAgICAgICBpZiAoIShwYXJhbWV0ZXIudmFsdWUgPCBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9HUkVBVEVSX1RIQU5fRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA+PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9MRVNTX1RIQU5fRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSA8PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9FUVVBTF9UTzpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEocGFyYW1ldGVyLnZhbHVlID09PSBjb25kaXRpb24udmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9OT1RfRVFVQUxfVE86XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHBhcmFtZXRlci52YWx1ZSAhPT0gY29uZGl0aW9uLnZhbHVlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBfZmluZFRyYW5zaXRpb24oZnJvbSwgdG8pIHtcbiAgICAgICAgbGV0IHRyYW5zaXRpb25zID0gW107XG5cbiAgICAgICAgLy8gSWYgZnJvbSBhbmQgdG8gYXJlIHN1cHBsaWVkLCBmaW5kIHRyYW5zaXRpb25zIHRoYXQgaW5jbHVkZSB0aGUgcmVxdWlyZWQgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBzdGF0ZXNcbiAgICAgICAgaWYgKGZyb20gJiYgdG8pIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0JldHdlZW5TdGF0ZXMoZnJvbSwgdG8pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIElmIG5vIHRyYW5zaXRpb24gaXMgYWN0aXZlLCBsb29rIGZvciB0cmFuc2l0aW9ucyBmcm9tIHRoZSBhY3RpdmUgJiBhbnkgc3RhdGVzLlxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fYWN0aXZlU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSBsb29rIGZvciB0cmFuc2l0aW9ucyBmcm9tIHRoZSBwcmV2aW91cyBhbmQgYWN0aXZlIHN0YXRlcyBiYXNlZCBvbiB0aGUgY3VycmVudCBpbnRlcnJ1cHRpb24gc291cmNlLlxuICAgICAgICAgICAgICAgIC8vIEFjY2VwdCB0cmFuc2l0aW9ucyBmcm9tIHRoZSBhbnkgc3RhdGUgdW5sZXNzIHRoZSBpbnRlcnJ1cHRpb24gc291cmNlIGlzIHNldCB0byBub25lXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0aGlzLl90cmFuc2l0aW9uSW50ZXJydXB0aW9uU291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fUFJFVjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9wcmV2aW91c1N0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9ORVhUOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfQU5ZKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQ6XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUodGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZSh0aGlzLl9hY3RpdmVTdGF0ZU5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb25zID0gdHJhbnNpdGlvbnMuY29uY2F0KHRoaXMuX2ZpbmRUcmFuc2l0aW9uc0Zyb21TdGF0ZShBTklNX1NUQVRFX0FOWSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgQU5JTV9JTlRFUlJVUFRJT05fTkVYVF9QUkVWOlxuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5jb25jYXQodGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHRyYW5zaXRpb25zLmNvbmNhdCh0aGlzLl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGUoQU5JTV9TVEFURV9BTlkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEFOSU1fSU5URVJSVVBUSU9OX05PTkU6XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmlsdGVyIG91dCB0cmFuc2l0aW9ucyB0aGF0IGRvbid0IGhhdmUgdGhlaXIgY29uZGl0aW9ucyBtZXRcbiAgICAgICAgdHJhbnNpdGlvbnMgPSB0cmFuc2l0aW9ucy5maWx0ZXIoKHRyYW5zaXRpb24pID0+IHtcbiAgICAgICAgICAgIC8vIGlmIHRoZSB0cmFuc2l0aW9uIGlzIG1vdmluZyB0byB0aGUgYWxyZWFkeSBhY3RpdmUgc3RhdGUsIGlnbm9yZSBpdFxuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24udG8gPT09IHRoaXMuYWN0aXZlU3RhdGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gd2hlbiBhbiBleGl0IHRpbWUgaXMgcHJlc2VudCwgd2Ugc2hvdWxkIG9ubHkgZXhpdCBpZiBpdCBmYWxscyB3aXRoaW4gdGhlIGN1cnJlbnQgZnJhbWUgZGVsdGEgdGltZVxuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24uaGFzRXhpdFRpbWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgcHJvZ3Jlc3NCZWZvcmUgPSB0aGlzLl9nZXRBY3RpdmVTdGF0ZVByb2dyZXNzRm9yVGltZSh0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSk7XG4gICAgICAgICAgICAgICAgbGV0IHByb2dyZXNzID0gdGhpcy5fZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUodGhpcy5fdGltZUluU3RhdGUpO1xuICAgICAgICAgICAgICAgIC8vIHdoZW4gdGhlIGV4aXQgdGltZSBpcyBzbWFsbGVyIHRoYW4gMSBhbmQgdGhlIHN0YXRlIGlzIGxvb3BpbmcsIHdlIHNob3VsZCBjaGVjayBmb3IgYW4gZXhpdCBlYWNoIGxvb3BcbiAgICAgICAgICAgICAgICBpZiAodHJhbnNpdGlvbi5leGl0VGltZSA8IDEuMCAmJiB0aGlzLmFjdGl2ZVN0YXRlLmxvb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NCZWZvcmUgLT0gTWF0aC5mbG9vcihwcm9ncmVzc0JlZm9yZSk7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzIC09IE1hdGguZmxvb3IocHJvZ3Jlc3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gZmFsc2UgaWYgZXhpdCB0aW1lIGlzbid0IHdpdGhpbiB0aGUgZnJhbWVzIGRlbHRhIHRpbWVcbiAgICAgICAgICAgICAgICBpZiAoISh0cmFuc2l0aW9uLmV4aXRUaW1lID4gcHJvZ3Jlc3NCZWZvcmUgJiYgdHJhbnNpdGlvbi5leGl0VGltZSA8PSBwcm9ncmVzcykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaWYgdGhlIGV4aXRUaW1lIGNvbmRpdGlvbiBoYXMgYmVlbiBtZXQgb3IgaXMgbm90IHByZXNlbnQsIGNoZWNrIGNvbmRpdGlvbiBwYXJhbWV0ZXJzXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdHJhbnNpdGlvbkhhc0NvbmRpdGlvbnNNZXQodHJhbnNpdGlvbik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGUgaGlnaGVzdCBwcmlvcml0eSB0cmFuc2l0aW9uIHRvIHVzZVxuICAgICAgICBpZiAodHJhbnNpdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgdHJhbnNpdGlvbiA9IHRyYW5zaXRpb25zWzBdO1xuICAgICAgICAgICAgaWYgKHRyYW5zaXRpb24udG8gPT09IEFOSU1fU1RBVEVfRU5EKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRUcmFuc2l0aW9uID0gdGhpcy5fZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlKEFOSU1fU1RBVEVfU1RBUlQpWzBdO1xuICAgICAgICAgICAgICAgIHRyYW5zaXRpb24udG8gPSBzdGFydFRyYW5zaXRpb24udG87XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJhbnNpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB1cGRhdGVTdGF0ZUZyb21UcmFuc2l0aW9uKHRyYW5zaXRpb24pIHtcbiAgICAgICAgbGV0IHN0YXRlO1xuICAgICAgICBsZXQgYW5pbWF0aW9uO1xuICAgICAgICBsZXQgY2xpcDtcbiAgICAgICAgLy8gSWYgdHJhbnNpdGlvbi5mcm9tIGlzIHNldCwgdHJhbnNpdGlvbiBmcm9tIHRoZSBhY3RpdmUgc3RhdGUgaXJyZWdhcmRsZXNzIG9mIHRoZSB0cmFuc2l0aW9uLmZyb20gdmFsdWUgKHRoaXMgY291bGQgYmUgdGhlIHByZXZpb3VzLCBhY3RpdmUgb3IgQU5ZIHN0YXRlcykuXG4gICAgICAgIC8vIE90aGVyd2lzZSB0aGUgcHJldmlvdXNTdGF0ZSBpcyBjbGVhcmVkLlxuICAgICAgICB0aGlzLnByZXZpb3VzU3RhdGUgPSB0cmFuc2l0aW9uLmZyb20gPyB0aGlzLmFjdGl2ZVN0YXRlTmFtZSA6IG51bGw7XG4gICAgICAgIHRoaXMuYWN0aXZlU3RhdGUgPSB0cmFuc2l0aW9uLnRvO1xuXG4gICAgICAgIC8vIHR1cm4gb2ZmIGFueSB0cmlnZ2VycyB3aGljaCB3ZXJlIHJlcXVpcmVkIHRvIGFjdGl2YXRlIHRoaXMgdHJhbnNpdGlvblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyYW5zaXRpb24uY29uZGl0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29uZGl0aW9uID0gdHJhbnNpdGlvbi5jb25kaXRpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gdGhpcy5maW5kUGFyYW1ldGVyKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXIudHlwZSA9PT0gQU5JTV9QQVJBTUVURVJfVFJJR0dFUikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbnN1bWVkVHJpZ2dlcnMuYWRkKGNvbmRpdGlvbi5wYXJhbWV0ZXJOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnByZXZpb3VzU3RhdGUpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5faXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzID0gW107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlY29yZCB0aGUgdHJhbnNpdGlvbiBzb3VyY2Ugc3RhdGUgaW4gdGhlIHByZXZpb3VzIHN0YXRlcyBhcnJheVxuICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRoaXMuX3ByZXZpb3VzU3RhdGVOYW1lLFxuICAgICAgICAgICAgICAgIHdlaWdodDogMVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgbmV3IHRyYW5zaXRpb24gd2FzIGFjdGl2YXRlZCBkdXJpbmcgYW5vdGhlciB0cmFuc2l0aW9uLCB1cGRhdGUgdGhlIHByZXZpb3VzIHRyYW5zaXRpb24gc3RhdGUgd2VpZ2h0cyBiYXNlZFxuICAgICAgICAgICAgLy8gb24gdGhlIHByb2dyZXNzIHRocm91Z2ggdGhlIHByZXZpb3VzIHRyYW5zaXRpb24uXG4gICAgICAgICAgICBjb25zdCBpbnRlcnBvbGF0ZWRUaW1lID0gTWF0aC5taW4odGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSAhPT0gMCA/IHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSAvIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgOiAxLCAxLjApO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBpbnRlcnBvbGF0ZSB0aGUgd2VpZ2h0cyBvZiB0aGUgbW9zdCByZWNlbnQgcHJldmlvdXMgc3RhdGUgYW5kIGFsbCBvdGhlciBwcmV2aW91cyBzdGF0ZXMgYmFzZWQgb24gdGhlIHByb2dyZXNzIHRocm91Z2ggdGhlIHByZXZpb3VzIHRyYW5zaXRpb25cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ud2VpZ2h0ID0gMS4wO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaSAhPT0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCAqPSAoMS4wIC0gaW50ZXJwb2xhdGVkVGltZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodCA9IGludGVycG9sYXRlZFRpbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlc1tpXS5uYW1lKTtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgdGhlIGFuaW1hdGlvbnMgb2YgcHJldmlvdXMgc3RhdGVzLCBzZXQgdGhlaXIgbmFtZSB0byBpbmNsdWRlIHRoZWlyIHBvc2l0aW9uIGluIHRoZSBwcmV2aW91cyBzdGF0ZSBhcnJheVxuICAgICAgICAgICAgICAgIC8vIHRvIHVuaXF1ZWx5IGlkZW50aWZ5IGFuaW1hdGlvbnMgZnJvbSB0aGUgc2FtZSBzdGF0ZSB0aGF0IHdlcmUgYWRkZWQgZHVyaW5nIGRpZmZlcmVudCB0cmFuc2l0aW9uc1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2pdO1xuICAgICAgICAgICAgICAgICAgICBjbGlwID0gdGhpcy5fYW5pbUV2YWx1YXRvci5maW5kQ2xpcChhbmltYXRpb24ubmFtZSArICcucHJldmlvdXMuJyArIGkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAubmFtZSA9IGFuaW1hdGlvbi5uYW1lICsgJy5wcmV2aW91cy4nICsgaTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyAvLyBwYXVzZSBwcmV2aW91cyBhbmltYXRpb24gY2xpcHMgdG8gcmVkdWNlIHRoZWlyIGltcGFjdCBvbiBwZXJmb3JtYW5jZVxuICAgICAgICAgICAgICAgICAgICBpZiAoaSAhPT0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAucGF1c2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgPSB0cmFuc2l0aW9uLnRpbWU7XG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UgPSB0cmFuc2l0aW9uLmludGVycnVwdGlvblNvdXJjZTtcblxuXG4gICAgICAgIGNvbnN0IGFjdGl2ZVN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgY29uc3QgaGFzVHJhbnNpdGlvbk9mZnNldCA9IHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldCAmJiB0cmFuc2l0aW9uLnRyYW5zaXRpb25PZmZzZXQgPiAwLjAgJiYgdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0IDwgMS4wO1xuXG4gICAgICAgIC8vIHNldCB0aGUgdGltZSBpbiB0aGUgbmV3IHN0YXRlIHRvIDAgb3IgdG8gYSB2YWx1ZSBiYXNlZCBvbiB0cmFuc2l0aW9uT2Zmc2V0IGlmIG9uZSB3YXMgZ2l2ZW5cbiAgICAgICAgbGV0IHRpbWVJblN0YXRlID0gMDtcbiAgICAgICAgbGV0IHRpbWVJblN0YXRlQmVmb3JlID0gMDtcbiAgICAgICAgaWYgKGhhc1RyYW5zaXRpb25PZmZzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9mZnNldFRpbWUgPSBhY3RpdmVTdGF0ZS50aW1lbGluZUR1cmF0aW9uICogdHJhbnNpdGlvbi50cmFuc2l0aW9uT2Zmc2V0O1xuICAgICAgICAgICAgdGltZUluU3RhdGUgPSBvZmZzZXRUaW1lO1xuICAgICAgICAgICAgdGltZUluU3RhdGVCZWZvcmUgPSBvZmZzZXRUaW1lO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlID0gdGltZUluU3RhdGU7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlQmVmb3JlID0gdGltZUluU3RhdGVCZWZvcmU7XG5cbiAgICAgICAgLy8gQWRkIGNsaXBzIHRvIHRoZSBldmFsdWF0b3IgZm9yIGVhY2ggYW5pbWF0aW9uIGluIHRoZSBuZXcgc3RhdGUuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWN0aXZlU3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5uYW1lKTtcbiAgICAgICAgICAgIGlmICghY2xpcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwZWVkID0gTnVtYmVyLmlzRmluaXRlKGFjdGl2ZVN0YXRlLmFuaW1hdGlvbnNbaV0uc3BlZWQpID8gYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5zcGVlZCA6IGFjdGl2ZVN0YXRlLnNwZWVkO1xuICAgICAgICAgICAgICAgIGNsaXAgPSBuZXcgQW5pbUNsaXAoYWN0aXZlU3RhdGUuYW5pbWF0aW9uc1tpXS5hbmltVHJhY2ssIHRoaXMuX3RpbWVJblN0YXRlLCBzcGVlZCwgdHJ1ZSwgYWN0aXZlU3RhdGUubG9vcCwgdGhpcy5fZXZlbnRIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICBjbGlwLm5hbWUgPSBhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLm5hbWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci5hZGRDbGlwKGNsaXApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjbGlwLnJlc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHJhbnNpdGlvbi50aW1lID4gMCkge1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSAwLjA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSBhY3RpdmVTdGF0ZS5hbmltYXRpb25zW2ldLm5vcm1hbGl6ZWRXZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjbGlwLnBsYXkoKTtcbiAgICAgICAgICAgIGlmIChoYXNUcmFuc2l0aW9uT2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgY2xpcC50aW1lID0gYWN0aXZlU3RhdGUudGltZWxpbmVEdXJhdGlvbiAqIHRyYW5zaXRpb24udHJhbnNpdGlvbk9mZnNldDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gYWN0aXZlU3RhdGUuc3BlZWQgPj0gMCA/IDAgOiB0aGlzLmFjdGl2ZVN0YXRlRHVyYXRpb247XG4gICAgICAgICAgICAgICAgY2xpcC50aW1lID0gc3RhcnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3RyYW5zaXRpb25Ub1N0YXRlKG5ld1N0YXRlTmFtZSkge1xuICAgICAgICBpZiAoIXRoaXMuX2ZpbmRTdGF0ZShuZXdTdGF0ZU5hbWUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb3ZlIHRvIHRoZSBnaXZlbiBzdGF0ZSwgaWYgYSB0cmFuc2l0aW9uIGlzIHByZXNlbnQgaW4gdGhlIHN0YXRlIGdyYXBoIHVzZSBpdC4gT3RoZXJ3aXNlIG1vdmUgaW5zdGFudGx5IHRvIGl0LlxuICAgICAgICBsZXQgdHJhbnNpdGlvbiA9IHRoaXMuX2ZpbmRUcmFuc2l0aW9uKHRoaXMuX2FjdGl2ZVN0YXRlTmFtZSwgbmV3U3RhdGVOYW1lKTtcbiAgICAgICAgaWYgKCF0cmFuc2l0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXBzKCk7XG4gICAgICAgICAgICB0cmFuc2l0aW9uID0gbmV3IEFuaW1UcmFuc2l0aW9uKHsgZnJvbTogbnVsbCwgdG86IG5ld1N0YXRlTmFtZSB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlRnJvbVRyYW5zaXRpb24odHJhbnNpdGlvbik7XG4gICAgfVxuXG4gICAgYXNzaWduQW5pbWF0aW9uKHBhdGhTdHJpbmcsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IHBhdGhTdHJpbmcuc3BsaXQoJy4nKTtcbiAgICAgICAgbGV0IHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKHBhdGhbMF0pO1xuICAgICAgICBpZiAoIXN0YXRlKSB7XG4gICAgICAgICAgICBzdGF0ZSA9IG5ldyBBbmltU3RhdGUodGhpcywgcGF0aFswXSwgMS4wKTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlc1twYXRoWzBdXSA9IHN0YXRlO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGVOYW1lcy5wdXNoKHBhdGhbMF0pO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmFkZEFuaW1hdGlvbihwYXRoLCBhbmltVHJhY2spO1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnVwZGF0ZUNsaXBUcmFjayhzdGF0ZS5uYW1lLCBhbmltVHJhY2spO1xuICAgICAgICBpZiAoc3BlZWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3RhdGUuc3BlZWQgPSBzcGVlZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobG9vcCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzdGF0ZS5sb29wID0gbG9vcDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5fcGxheWluZyAmJiB0aGlzLl9hY3RpdmF0ZSAmJiB0aGlzLnBsYXlhYmxlKSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZU5vZGVBbmltYXRpb25zKG5vZGVOYW1lKSB7XG4gICAgICAgIGlmIChBTklNX0NPTlRST0xfU1RBVEVTLmluZGV4T2Yobm9kZU5hbWUpICE9PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YXRlID0gdGhpcy5fZmluZFN0YXRlKG5vZGVOYW1lKTtcbiAgICAgICAgaWYgKCFzdGF0ZSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0F0dGVtcHRpbmcgdG8gdW5hc3NpZ24gYW5pbWF0aW9uIHRyYWNrcyBmcm9tIGEgc3RhdGUgdGhhdCBkb2VzIG5vdCBleGlzdC4nLCBub2RlTmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0ZS5hbmltYXRpb25zID0gW107XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHBsYXkoc3RhdGVOYW1lKSB7XG4gICAgICAgIGlmIChzdGF0ZU5hbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3RyYW5zaXRpb25Ub1N0YXRlKHN0YXRlTmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcGxheWluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIHRoaXMuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICByZXNldCgpIHtcbiAgICAgICAgdGhpcy5fcHJldmlvdXNTdGF0ZU5hbWUgPSBudWxsO1xuICAgICAgICB0aGlzLl9hY3RpdmVTdGF0ZU5hbWUgPSBBTklNX1NUQVRFX1NUQVJUO1xuICAgICAgICB0aGlzLl9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5fdG90YWxUcmFuc2l0aW9uVGltZSA9IDEuMDtcbiAgICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RpbWVJblN0YXRlID0gMDtcbiAgICAgICAgdGhpcy5fdGltZUluU3RhdGVCZWZvcmUgPSAwO1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXBzKCk7XG4gICAgfVxuXG4gICAgcmViaW5kKCkge1xuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnJlYmluZCgpO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBpZiAoIXRoaXMuX3BsYXlpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc3RhdGU7XG4gICAgICAgIGxldCBhbmltYXRpb247XG4gICAgICAgIGxldCBjbGlwO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZUJlZm9yZSA9IHRoaXMuX3RpbWVJblN0YXRlO1xuICAgICAgICB0aGlzLl90aW1lSW5TdGF0ZSArPSBkdCAqIHRoaXMuYWN0aXZlU3RhdGUuc3BlZWQ7XG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiBiZXR3ZWVuIHN0YXRlcyBpZiBhIHRyYW5zaXRpb24gaXMgYXZhaWxhYmxlIGZyb20gdGhlIGFjdGl2ZSBzdGF0ZVxuICAgICAgICBjb25zdCB0cmFuc2l0aW9uID0gdGhpcy5fZmluZFRyYW5zaXRpb24odGhpcy5fYWN0aXZlU3RhdGVOYW1lKTtcbiAgICAgICAgaWYgKHRyYW5zaXRpb24pXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXRlRnJvbVRyYW5zaXRpb24odHJhbnNpdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMuX2lzVHJhbnNpdGlvbmluZykge1xuICAgICAgICAgICAgdGhpcy5fY3VyclRyYW5zaXRpb25UaW1lICs9IGR0O1xuICAgICAgICAgICAgaWYgKHRoaXMuX2N1cnJUcmFuc2l0aW9uVGltZSA8PSB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW50ZXJwb2xhdGVkVGltZSA9IHRoaXMuX3RvdGFsVHJhbnNpdGlvblRpbWUgIT09IDAgPyB0aGlzLl9jdXJyVHJhbnNpdGlvblRpbWUgLyB0aGlzLl90b3RhbFRyYW5zaXRpb25UaW1lIDogMTtcbiAgICAgICAgICAgICAgICAvLyB3aGlsZSB0cmFuc2l0aW9uaW5nLCBzZXQgYWxsIHByZXZpb3VzIHN0YXRlIGFuaW1hdGlvbnMgdG8gYmUgd2VpZ2h0ZWQgYnkgKDEuMCAtIGludGVycG9sYXRpb25UaW1lKS5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMuX2ZpbmRTdGF0ZSh0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXNbaV0ubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlV2VpZ2h0ID0gdGhpcy5fdHJhbnNpdGlvblByZXZpb3VzU3RhdGVzW2ldLndlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBzdGF0ZS5hbmltYXRpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2pdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUgKyAnLnByZXZpb3VzLicgKyBpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjbGlwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpcC5ibGVuZFdlaWdodCA9ICgxLjAgLSBpbnRlcnBvbGF0ZWRUaW1lKSAqIGFuaW1hdGlvbi5ub3JtYWxpemVkV2VpZ2h0ICogc3RhdGVXZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gd2hpbGUgdHJhbnNpdGlvbmluZywgc2V0IGFjdGl2ZSBzdGF0ZSBhbmltYXRpb25zIHRvIGJlIHdlaWdodGVkIGJ5IChpbnRlcnBvbGF0aW9uVGltZSkuXG4gICAgICAgICAgICAgICAgc3RhdGUgPSB0aGlzLmFjdGl2ZVN0YXRlO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGUuYW5pbWF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBhbmltYXRpb24gPSBzdGF0ZS5hbmltYXRpb25zW2ldO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKS5ibGVuZFdlaWdodCA9IGludGVycG9sYXRlZFRpbWUgKiBhbmltYXRpb24ubm9ybWFsaXplZFdlaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIC8vIHdoZW4gYSB0cmFuc2l0aW9uIGVuZHMsIHJlbW92ZSBhbGwgcHJldmlvdXMgc3RhdGUgY2xpcHMgZnJvbSB0aGUgZXZhbHVhdG9yXG4gICAgICAgICAgICAgICAgY29uc3QgYWN0aXZlQ2xpcHMgPSB0aGlzLmFjdGl2ZVN0YXRlQW5pbWF0aW9ucy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgY29uc3QgdG90YWxDbGlwcyA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuY2xpcHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG90YWxDbGlwcyAtIGFjdGl2ZUNsaXBzOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYW5pbUV2YWx1YXRvci5yZW1vdmVDbGlwKDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl90cmFuc2l0aW9uUHJldmlvdXNTdGF0ZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAvLyB3aGVuIGEgdHJhbnNpdGlvbiBlbmRzLCBzZXQgdGhlIGFjdGl2ZSBzdGF0ZSBjbGlwIHdlaWdodHMgc28gdGhleSBzdW0gdG8gMVxuICAgICAgICAgICAgICAgIHN0YXRlID0gdGhpcy5hY3RpdmVTdGF0ZTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRlLmFuaW1hdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgYW5pbWF0aW9uID0gc3RhdGUuYW5pbWF0aW9uc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY2xpcCA9IHRoaXMuX2FuaW1FdmFsdWF0b3IuZmluZENsaXAoYW5pbWF0aW9uLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2xpcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xpcC5ibGVuZFdlaWdodCA9IGFuaW1hdGlvbi5ub3JtYWxpemVkV2VpZ2h0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuYWN0aXZlU3RhdGUuX2JsZW5kVHJlZS5jb25zdHJ1Y3RvciAhPT0gQW5pbU5vZGUpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IHRoaXMuYWN0aXZlU3RhdGU7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0ZS5hbmltYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGFuaW1hdGlvbiA9IHN0YXRlLmFuaW1hdGlvbnNbaV07XG4gICAgICAgICAgICAgICAgICAgIGNsaXAgPSB0aGlzLl9hbmltRXZhbHVhdG9yLmZpbmRDbGlwKGFuaW1hdGlvbi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNsaXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSBhbmltYXRpb24ubm9ybWFsaXplZFdlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhbmltYXRpb24ucGFyZW50LnN5bmNBbmltYXRpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpcC5zcGVlZCA9IGFuaW1hdGlvbi5zcGVlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9hbmltRXZhbHVhdG9yLnVwZGF0ZShkdCwgdGhpcy5hY3RpdmVTdGF0ZS5oYXNBbmltYXRpb25zKTtcbiAgICB9XG5cbiAgICBmaW5kUGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhcmFtZXRlcnNbbmFtZV07XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltQ29udHJvbGxlciB9O1xuIl0sIm5hbWVzIjpbIkFuaW1Db250cm9sbGVyIiwiY29uc3RydWN0b3IiLCJhbmltRXZhbHVhdG9yIiwic3RhdGVzIiwidHJhbnNpdGlvbnMiLCJwYXJhbWV0ZXJzIiwiYWN0aXZhdGUiLCJldmVudEhhbmRsZXIiLCJjb25zdW1lZFRyaWdnZXJzIiwiX2FuaW1FdmFsdWF0b3IiLCJfc3RhdGVzIiwiX3N0YXRlTmFtZXMiLCJfZXZlbnRIYW5kbGVyIiwiX2NvbnN1bWVkVHJpZ2dlcnMiLCJpIiwibGVuZ3RoIiwibmFtZSIsIkFuaW1TdGF0ZSIsInNwZWVkIiwibG9vcCIsImJsZW5kVHJlZSIsInB1c2giLCJfdHJhbnNpdGlvbnMiLCJtYXAiLCJ0cmFuc2l0aW9uIiwiQW5pbVRyYW5zaXRpb24iLCJfZXh0ZW5kcyIsIl9maW5kVHJhbnNpdGlvbnNGcm9tU3RhdGVDYWNoZSIsIl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzQ2FjaGUiLCJfcGFyYW1ldGVycyIsIl9wcmV2aW91c1N0YXRlTmFtZSIsIl9hY3RpdmVTdGF0ZU5hbWUiLCJBTklNX1NUQVRFX1NUQVJUIiwiX3BsYXlpbmciLCJfYWN0aXZhdGUiLCJfY3VyclRyYW5zaXRpb25UaW1lIiwiX3RvdGFsVHJhbnNpdGlvblRpbWUiLCJfaXNUcmFuc2l0aW9uaW5nIiwiX3RyYW5zaXRpb25JbnRlcnJ1cHRpb25Tb3VyY2UiLCJBTklNX0lOVEVSUlVQVElPTl9OT05FIiwiX3RyYW5zaXRpb25QcmV2aW91c1N0YXRlcyIsIl90aW1lSW5TdGF0ZSIsIl90aW1lSW5TdGF0ZUJlZm9yZSIsImFjdGl2ZVN0YXRlIiwic3RhdGVOYW1lIiwiX2ZpbmRTdGF0ZSIsImFjdGl2ZVN0YXRlTmFtZSIsImFjdGl2ZVN0YXRlQW5pbWF0aW9ucyIsImFuaW1hdGlvbnMiLCJwcmV2aW91c1N0YXRlIiwicHJldmlvdXNTdGF0ZU5hbWUiLCJwbGF5YWJsZSIsInBsYXlpbmciLCJ2YWx1ZSIsImFjdGl2ZVN0YXRlUHJvZ3Jlc3MiLCJfZ2V0QWN0aXZlU3RhdGVQcm9ncmVzc0ZvclRpbWUiLCJhY3RpdmVTdGF0ZUR1cmF0aW9uIiwiQU5JTV9TVEFURV9FTkQiLCJtYXhEdXJhdGlvbiIsImFjdGl2ZUNsaXAiLCJmaW5kQ2xpcCIsIk1hdGgiLCJtYXgiLCJ0cmFjayIsImR1cmF0aW9uIiwiYWN0aXZlU3RhdGVDdXJyZW50VGltZSIsInRpbWUiLCJjbGlwIiwidHJhbnNpdGlvbmluZyIsInRyYW5zaXRpb25Qcm9ncmVzcyIsImFzc2lnbk1hc2siLCJtYXNrIiwiQU5JTV9TVEFURV9BTlkiLCJwcm9ncmVzc0ZvclRpbWUiLCJfZmluZFRyYW5zaXRpb25zRnJvbVN0YXRlIiwiZmlsdGVyIiwiZnJvbSIsInNvcnRQcmlvcml0eSIsIl9maW5kVHJhbnNpdGlvbnNCZXR3ZWVuU3RhdGVzIiwic291cmNlU3RhdGVOYW1lIiwiZGVzdGluYXRpb25TdGF0ZU5hbWUiLCJ0byIsIl90cmFuc2l0aW9uSGFzQ29uZGl0aW9uc01ldCIsImNvbmRpdGlvbnMiLCJjb25kaXRpb24iLCJwYXJhbWV0ZXIiLCJmaW5kUGFyYW1ldGVyIiwicGFyYW1ldGVyTmFtZSIsInByZWRpY2F0ZSIsIkFOSU1fR1JFQVRFUl9USEFOIiwiQU5JTV9MRVNTX1RIQU4iLCJBTklNX0dSRUFURVJfVEhBTl9FUVVBTF9UTyIsIkFOSU1fTEVTU19USEFOX0VRVUFMX1RPIiwiQU5JTV9FUVVBTF9UTyIsIkFOSU1fTk9UX0VRVUFMX1RPIiwiX2ZpbmRUcmFuc2l0aW9uIiwiY29uY2F0IiwiQU5JTV9JTlRFUlJVUFRJT05fUFJFViIsIkFOSU1fSU5URVJSVVBUSU9OX05FWFQiLCJBTklNX0lOVEVSUlVQVElPTl9QUkVWX05FWFQiLCJBTklNX0lOVEVSUlVQVElPTl9ORVhUX1BSRVYiLCJoYXNFeGl0VGltZSIsInByb2dyZXNzQmVmb3JlIiwicHJvZ3Jlc3MiLCJleGl0VGltZSIsImZsb29yIiwic3RhcnRUcmFuc2l0aW9uIiwidXBkYXRlU3RhdGVGcm9tVHJhbnNpdGlvbiIsInN0YXRlIiwiYW5pbWF0aW9uIiwidHlwZSIsIkFOSU1fUEFSQU1FVEVSX1RSSUdHRVIiLCJhZGQiLCJ3ZWlnaHQiLCJpbnRlcnBvbGF0ZWRUaW1lIiwibWluIiwiaiIsInBhdXNlIiwiaW50ZXJydXB0aW9uU291cmNlIiwiaGFzVHJhbnNpdGlvbk9mZnNldCIsInRyYW5zaXRpb25PZmZzZXQiLCJ0aW1lSW5TdGF0ZSIsInRpbWVJblN0YXRlQmVmb3JlIiwib2Zmc2V0VGltZSIsInRpbWVsaW5lRHVyYXRpb24iLCJOdW1iZXIiLCJpc0Zpbml0ZSIsIkFuaW1DbGlwIiwiYW5pbVRyYWNrIiwiYWRkQ2xpcCIsInJlc2V0IiwiYmxlbmRXZWlnaHQiLCJub3JtYWxpemVkV2VpZ2h0IiwicGxheSIsInN0YXJ0VGltZSIsIl90cmFuc2l0aW9uVG9TdGF0ZSIsIm5ld1N0YXRlTmFtZSIsInJlbW92ZUNsaXBzIiwiYXNzaWduQW5pbWF0aW9uIiwicGF0aFN0cmluZyIsInBhdGgiLCJzcGxpdCIsImFkZEFuaW1hdGlvbiIsInVwZGF0ZUNsaXBUcmFjayIsInVuZGVmaW5lZCIsInJlbW92ZU5vZGVBbmltYXRpb25zIiwibm9kZU5hbWUiLCJBTklNX0NPTlRST0xfU1RBVEVTIiwiaW5kZXhPZiIsIkRlYnVnIiwiZXJyb3IiLCJyZWJpbmQiLCJ1cGRhdGUiLCJkdCIsInN0YXRlV2VpZ2h0IiwiYWN0aXZlQ2xpcHMiLCJ0b3RhbENsaXBzIiwiY2xpcHMiLCJyZW1vdmVDbGlwIiwiX2JsZW5kVHJlZSIsIkFuaW1Ob2RlIiwicGFyZW50Iiwic3luY0FuaW1hdGlvbnMiLCJoYXNBbmltYXRpb25zIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsY0FBYyxDQUFDO0FBQ2pCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsYUFBYSxFQUFFQyxNQUFNLEVBQUVDLFdBQVcsRUFBRUMsVUFBVSxFQUFFQyxRQUFRLEVBQUVDLFlBQVksRUFBRUMsZ0JBQWdCLEVBQUU7SUFDbEcsSUFBSSxDQUFDQyxjQUFjLEdBQUdQLGFBQWEsQ0FBQTtBQUNuQyxJQUFBLElBQUksQ0FBQ1EsT0FBTyxHQUFHLEVBQUUsQ0FBQTtJQUNqQixJQUFJLENBQUNDLFdBQVcsR0FBRyxFQUFFLENBQUE7SUFDckIsSUFBSSxDQUFDQyxhQUFhLEdBQUdMLFlBQVksQ0FBQTtJQUNqQyxJQUFJLENBQUNNLGlCQUFpQixHQUFHTCxnQkFBZ0IsQ0FBQTtBQUN6QyxJQUFBLEtBQUssSUFBSU0sQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHWCxNQUFNLENBQUNZLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsTUFBQSxJQUFJLENBQUNKLE9BQU8sQ0FBQ1AsTUFBTSxDQUFDVyxDQUFDLENBQUMsQ0FBQ0UsSUFBSSxDQUFDLEdBQUcsSUFBSUMsU0FBUyxDQUN4QyxJQUFJLEVBQ0pkLE1BQU0sQ0FBQ1csQ0FBQyxDQUFDLENBQUNFLElBQUksRUFDZGIsTUFBTSxDQUFDVyxDQUFDLENBQUMsQ0FBQ0ksS0FBSyxFQUNmZixNQUFNLENBQUNXLENBQUMs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
