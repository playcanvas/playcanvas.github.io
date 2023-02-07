/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { AnimTransition } from '../../anim/controller/anim-transition.js';
import { ANIM_LAYER_OVERWRITE } from '../../anim/controller/constants.js';

/**
 * The Anim Component Layer allows managers a single layer of the animation state graph.
 */
class AnimComponentLayer {
  /**
   * Create a new AnimComponentLayer instance.
   *
   * @param {string} name - The name of the layer.
   * @param {object} controller - The controller to manage this layers animations.
   * @param {import('./component.js').AnimComponent} component - The component that this layer is
   * a member of.
   * @param {number} [weight] - The weight of this layer. Defaults to 1.
   * @param {string} [blendType] - The blend type of this layer. Defaults to {@link ANIM_LAYER_OVERWRITE}.
   * @param {boolean} [normalizedWeight] - Whether the weight of this layer should be normalized
   * using the total weight of all layers.
   */
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

  /**
   * Returns the name of the layer.
   *
   * @type {string}
   */
  get name() {
    return this._name;
  }

  /**
   * Whether this layer is currently playing.
   *
   * @type {string}
   */
  set playing(value) {
    this._controller.playing = value;
  }
  get playing() {
    return this._controller.playing;
  }

  /**
   * Returns true if a state graph has been loaded and all states in the graph have been assigned
   * animation tracks.
   *
   * @type {string}
   */
  get playable() {
    return this._controller.playable;
  }

  /**
   * Returns the currently active state name.
   *
   * @type {string}
   */
  get activeState() {
    return this._controller.activeStateName;
  }

  /**
   * Returns the previously active state name.
   *
   * @type {string}
   */
  get previousState() {
    return this._controller.previousStateName;
  }

  /**
   * Returns the currently active states progress as a value normalized by the states animation
   * duration. Looped animations will return values greater than 1.
   *
   * @type {number}
   */
  get activeStateProgress() {
    return this._controller.activeStateProgress;
  }

  /**
   * Returns the currently active states duration.
   *
   * @type {number}
   */
  get activeStateDuration() {
    return this._controller.activeStateDuration;
  }

  /**
   * The active states time in seconds.
   *
   * @type {number}
   */
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

  /**
   * Returns whether the anim component layer is currently transitioning between states.
   *
   * @type {boolean}
   */
  get transitioning() {
    return this._controller.transitioning;
  }

  /**
   * If the anim component layer is currently transitioning between states, returns the progress.
   * Otherwise returns null.
   *
   * @type {number|null}
   */
  get transitionProgress() {
    if (this.transitioning) {
      return this._controller.transitionProgress;
    }
    return null;
  }

  /**
   * Lists all available states in this layers state graph.
   *
   * @type {string[]}
   */
  get states() {
    return this._controller.states;
  }

  /**
   * The blending weight of this layer. Used when calculating the value of properties that are
   * animated by more than one layer.
   *
   * @type {number}
   */
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

  /**
   * A mask of bones which should be animated or ignored by this layer.
   *
   * @type {object}
   * @example
   * entity.anim.baseLayer.mask = {
   *     // include the spine of the current model and all of its children
   *     "path/to/spine": {
   *         children: true
   *     },
   *     // include the hip of the current model but not all of its children
   *     "path/to/hip": true
   * };
   */
  set mask(value) {
    if (this._controller.assignMask(value)) {
      this._component.rebind();
    }
    this._mask = value;
  }
  get mask() {
    return this._mask;
  }

  /**
   * Start playing the animation in the current state.
   *
   * @param {string} [name] - If provided, will begin playing from the start of the state with
   * this name.
   */
  play(name) {
    this._controller.play(name);
  }

  /**
   * Pause the animation in the current state.
   */
  pause() {
    this._controller.pause();
  }

  /**
   * Reset the animation component to its initial state, including all parameters. The system
   * will be paused.
   */
  reset() {
    this._controller.reset();
  }

  /**
   * Rebind any animations in the layer to the currently present components and model of the anim
   * components entity.
   */
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

  /**
   * Blend from the current weight value to the provided weight value over a given amount of time.
   *
   * @param {number} weight - The new weight value to blend to.
   * @param {number} time - The duration of the blend in seconds.
   */
  blendToWeight(weight, time) {
    this._startingWeight = this.weight;
    this._targetWeight = weight;
    this._blendTime = Math.max(0, time);
    this._blendTimeElapsed = 0;
  }

  /**
   * Add a mask to this layer.
   *
   * @param {object} [mask] - The mask to assign to the layer. If not provided the current mask
   * in the layer will be removed.
   * @example
   * entity.anim.baseLayer.assignMask({
   *     // include the spine of the current model and all of its children
   *     "path/to/spine": {
   *         children: true
   *     },
   *     // include the hip of the current model but not all of its children
   *     "path/to/hip": true
   * });
   * @ignore
   */
  assignMask(mask) {
    Debug.deprecated('The pc.AnimComponentLayer#assignMask function is now deprecated. Assign masks to the pc.AnimComponentLayer#mask property instead.');
    if (this._controller.assignMask(mask)) {
      this._component.rebind();
    }
    this._mask = mask;
  }

  /**
   * Assigns an animation track to a state or blend tree node in the current graph. If a state
   * for the given nodePath doesn't exist, it will be created. If all states nodes are linked and
   * the {@link AnimComponent#activate} value was set to true then the component will begin
   * playing.
   *
   * @param {string} nodePath - Either the state name or the path to a blend tree node that this
   * animation should be associated with. Each section of a blend tree path is split using a
   * period (`.`) therefore state names should not include this character (e.g "MyStateName" or
   * "MyStateName.BlendTreeNode").
   * @param {object} animTrack - The animation track that will be assigned to this state and
   * played whenever this state is active.
   * @param {number} [speed] - Update the speed of the state you are assigning an animation to.
   * Defaults to 1.
   * @param {boolean} [loop] - Update the loop property of the state you are assigning an
   * animation to. Defaults to true.
   */
  assignAnimation(nodePath, animTrack, speed, loop) {
    if (animTrack.constructor !== AnimTrack) {
      Debug.error('assignAnimation: animTrack supplied to function was not of type AnimTrack');
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

  /**
   * Removes animations from a node in the loaded state graph.
   *
   * @param {string} nodeName - The name of the node that should have its animation tracks removed.
   */
  removeNodeAnimations(nodeName) {
    if (this._controller.removeNodeAnimations(nodeName)) {
      this._component.playing = false;
    }
  }

  /**
   * Returns the asset that is associated with the given state.
   *
   * @param {string} stateName - The name of the state to get the asset for.
   * @returns {import('../../asset/asset.js').Asset} The asset associated with the given state.
   */
  getAnimationAsset(stateName) {
    return this._component.animationAssets[`${this.name}:${stateName}`];
  }

  /**
   * Transition to any state in the current layers graph. Transitions can be instant or take an
   * optional blend time.
   *
   * @param {string} to - The state that this transition will transition to.
   * @param {number} [time] - The duration of the transition in seconds. Defaults to 0.
   * @param {number} [transitionOffset] - If provided, the destination state will begin playing
   * its animation at this time. Given in normalized time, based on the states duration & must be
   * between 0 and 1. Defaults to null.
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LWxheWVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbS9jb21wb25lbnQtbGF5ZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbmltcG9ydCB7IEFuaW1UcmFjayB9IGZyb20gJy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tdHJhY2suanMnO1xuaW1wb3J0IHsgQW5pbVRyYW5zaXRpb24gfSBmcm9tICcuLi8uLi9hbmltL2NvbnRyb2xsZXIvYW5pbS10cmFuc2l0aW9uLmpzJztcbmltcG9ydCB7IEFOSU1fTEFZRVJfT1ZFUldSSVRFIH0gZnJvbSAnLi4vLi4vYW5pbS9jb250cm9sbGVyL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogVGhlIEFuaW0gQ29tcG9uZW50IExheWVyIGFsbG93cyBtYW5hZ2VycyBhIHNpbmdsZSBsYXllciBvZiB0aGUgYW5pbWF0aW9uIHN0YXRlIGdyYXBoLlxuICovXG5jbGFzcyBBbmltQ29tcG9uZW50TGF5ZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltQ29tcG9uZW50TGF5ZXIgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBsYXllci5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gY29udHJvbGxlciAtIFRoZSBjb250cm9sbGVyIHRvIG1hbmFnZSB0aGlzIGxheWVycyBhbmltYXRpb25zLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2NvbXBvbmVudC5qcycpLkFuaW1Db21wb25lbnR9IGNvbXBvbmVudCAtIFRoZSBjb21wb25lbnQgdGhhdCB0aGlzIGxheWVyIGlzXG4gICAgICogYSBtZW1iZXIgb2YuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3ZWlnaHRdIC0gVGhlIHdlaWdodCBvZiB0aGlzIGxheWVyLiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbYmxlbmRUeXBlXSAtIFRoZSBibGVuZCB0eXBlIG9mIHRoaXMgbGF5ZXIuIERlZmF1bHRzIHRvIHtAbGluayBBTklNX0xBWUVSX09WRVJXUklURX0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbbm9ybWFsaXplZFdlaWdodF0gLSBXaGV0aGVyIHRoZSB3ZWlnaHQgb2YgdGhpcyBsYXllciBzaG91bGQgYmUgbm9ybWFsaXplZFxuICAgICAqIHVzaW5nIHRoZSB0b3RhbCB3ZWlnaHQgb2YgYWxsIGxheWVycy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lLCBjb250cm9sbGVyLCBjb21wb25lbnQsIHdlaWdodCA9IDEsIGJsZW5kVHlwZSA9IEFOSU1fTEFZRVJfT1ZFUldSSVRFLCBub3JtYWxpemVkV2VpZ2h0ID0gdHJ1ZSkge1xuICAgICAgICB0aGlzLl9uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5fY29udHJvbGxlciA9IGNvbnRyb2xsZXI7XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5fd2VpZ2h0ID0gd2VpZ2h0O1xuICAgICAgICB0aGlzLl9ibGVuZFR5cGUgPSBibGVuZFR5cGU7XG4gICAgICAgIHRoaXMuX25vcm1hbGl6ZWRXZWlnaHQgPSBub3JtYWxpemVkV2VpZ2h0O1xuICAgICAgICB0aGlzLl9tYXNrID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYmxlbmRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fYmxlbmRUaW1lRWxhcHNlZCA9IDA7XG4gICAgICAgIHRoaXMuX3N0YXJ0aW5nV2VpZ2h0ID0gMDtcbiAgICAgICAgdGhpcy5fdGFyZ2V0V2VpZ2h0ID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBuYW1lIG9mIHRoZSBsYXllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IG5hbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9uYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhpcyBsYXllciBpcyBjdXJyZW50bHkgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHBsYXlpbmcodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29udHJvbGxlci5wbGF5aW5nID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHBsYXlpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb250cm9sbGVyLnBsYXlpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIGEgc3RhdGUgZ3JhcGggaGFzIGJlZW4gbG9hZGVkIGFuZCBhbGwgc3RhdGVzIGluIHRoZSBncmFwaCBoYXZlIGJlZW4gYXNzaWduZWRcbiAgICAgKiBhbmltYXRpb24gdHJhY2tzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXQgcGxheWFibGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb250cm9sbGVyLnBsYXlhYmxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGN1cnJlbnRseSBhY3RpdmUgc3RhdGUgbmFtZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IGFjdGl2ZVN0YXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udHJvbGxlci5hY3RpdmVTdGF0ZU5hbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcHJldmlvdXNseSBhY3RpdmUgc3RhdGUgbmFtZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHByZXZpb3VzU3RhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb250cm9sbGVyLnByZXZpb3VzU3RhdGVOYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGN1cnJlbnRseSBhY3RpdmUgc3RhdGVzIHByb2dyZXNzIGFzIGEgdmFsdWUgbm9ybWFsaXplZCBieSB0aGUgc3RhdGVzIGFuaW1hdGlvblxuICAgICAqIGR1cmF0aW9uLiBMb29wZWQgYW5pbWF0aW9ucyB3aWxsIHJldHVybiB2YWx1ZXMgZ3JlYXRlciB0aGFuIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBhY3RpdmVTdGF0ZVByb2dyZXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udHJvbGxlci5hY3RpdmVTdGF0ZVByb2dyZXNzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGN1cnJlbnRseSBhY3RpdmUgc3RhdGVzIGR1cmF0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgYWN0aXZlU3RhdGVEdXJhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnRyb2xsZXIuYWN0aXZlU3RhdGVEdXJhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWN0aXZlIHN0YXRlcyB0aW1lIGluIHNlY29uZHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhY3RpdmVTdGF0ZUN1cnJlbnRUaW1lKHRpbWUpIHtcbiAgICAgICAgY29uc3QgY29udHJvbGxlciA9IHRoaXMuX2NvbnRyb2xsZXI7XG4gICAgICAgIGNvbnN0IGxheWVyUGxheWluZyA9IGNvbnRyb2xsZXIucGxheWluZztcbiAgICAgICAgY29udHJvbGxlci5wbGF5aW5nID0gdHJ1ZTtcbiAgICAgICAgY29udHJvbGxlci5hY3RpdmVTdGF0ZUN1cnJlbnRUaW1lID0gdGltZTtcbiAgICAgICAgaWYgKCFsYXllclBsYXlpbmcpIHtcbiAgICAgICAgICAgIGNvbnRyb2xsZXIudXBkYXRlKDApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRyb2xsZXIucGxheWluZyA9IGxheWVyUGxheWluZztcbiAgICB9XG5cbiAgICBnZXQgYWN0aXZlU3RhdGVDdXJyZW50VGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnRyb2xsZXIuYWN0aXZlU3RhdGVDdXJyZW50VGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHdoZXRoZXIgdGhlIGFuaW0gY29tcG9uZW50IGxheWVyIGlzIGN1cnJlbnRseSB0cmFuc2l0aW9uaW5nIGJldHdlZW4gc3RhdGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRyYW5zaXRpb25pbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb250cm9sbGVyLnRyYW5zaXRpb25pbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIGFuaW0gY29tcG9uZW50IGxheWVyIGlzIGN1cnJlbnRseSB0cmFuc2l0aW9uaW5nIGJldHdlZW4gc3RhdGVzLCByZXR1cm5zIHRoZSBwcm9ncmVzcy5cbiAgICAgKiBPdGhlcndpc2UgcmV0dXJucyBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcnxudWxsfVxuICAgICAqL1xuICAgIGdldCB0cmFuc2l0aW9uUHJvZ3Jlc3MoKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jb250cm9sbGVyLnRyYW5zaXRpb25Qcm9ncmVzcztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaXN0cyBhbGwgYXZhaWxhYmxlIHN0YXRlcyBpbiB0aGlzIGxheWVycyBzdGF0ZSBncmFwaC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmdbXX1cbiAgICAgKi9cbiAgICBnZXQgc3RhdGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udHJvbGxlci5zdGF0ZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGJsZW5kaW5nIHdlaWdodCBvZiB0aGlzIGxheWVyLiBVc2VkIHdoZW4gY2FsY3VsYXRpbmcgdGhlIHZhbHVlIG9mIHByb3BlcnRpZXMgdGhhdCBhcmVcbiAgICAgKiBhbmltYXRlZCBieSBtb3JlIHRoYW4gb25lIGxheWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgd2VpZ2h0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3dlaWdodCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9jb21wb25lbnQuZGlydGlmeVRhcmdldHMoKTtcbiAgICB9XG5cbiAgICBnZXQgd2VpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2VpZ2h0O1xuICAgIH1cblxuICAgIHNldCBibGVuZFR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9ibGVuZFR5cGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2JsZW5kVHlwZSA9IHZhbHVlO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NvbnRyb2xsZXIubm9ybWFsaXplV2VpZ2h0cykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudC5yZWJpbmQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBibGVuZFR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ibGVuZFR5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBtYXNrIG9mIGJvbmVzIHdoaWNoIHNob3VsZCBiZSBhbmltYXRlZCBvciBpZ25vcmVkIGJ5IHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBleGFtcGxlXG4gICAgICogZW50aXR5LmFuaW0uYmFzZUxheWVyLm1hc2sgPSB7XG4gICAgICogICAgIC8vIGluY2x1ZGUgdGhlIHNwaW5lIG9mIHRoZSBjdXJyZW50IG1vZGVsIGFuZCBhbGwgb2YgaXRzIGNoaWxkcmVuXG4gICAgICogICAgIFwicGF0aC90by9zcGluZVwiOiB7XG4gICAgICogICAgICAgICBjaGlsZHJlbjogdHJ1ZVxuICAgICAqICAgICB9LFxuICAgICAqICAgICAvLyBpbmNsdWRlIHRoZSBoaXAgb2YgdGhlIGN1cnJlbnQgbW9kZWwgYnV0IG5vdCBhbGwgb2YgaXRzIGNoaWxkcmVuXG4gICAgICogICAgIFwicGF0aC90by9oaXBcIjogdHJ1ZVxuICAgICAqIH07XG4gICAgICovXG4gICAgc2V0IG1hc2sodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbnRyb2xsZXIuYXNzaWduTWFzayh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBvbmVudC5yZWJpbmQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9tYXNrID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG1hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IHBsYXlpbmcgdGhlIGFuaW1hdGlvbiBpbiB0aGUgY3VycmVudCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBJZiBwcm92aWRlZCwgd2lsbCBiZWdpbiBwbGF5aW5nIGZyb20gdGhlIHN0YXJ0IG9mIHRoZSBzdGF0ZSB3aXRoXG4gICAgICogdGhpcyBuYW1lLlxuICAgICAqL1xuICAgIHBsYXkobmFtZSkge1xuICAgICAgICB0aGlzLl9jb250cm9sbGVyLnBsYXkobmFtZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGF1c2UgdGhlIGFuaW1hdGlvbiBpbiB0aGUgY3VycmVudCBzdGF0ZS5cbiAgICAgKi9cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgdGhpcy5fY29udHJvbGxlci5wYXVzZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0IHRoZSBhbmltYXRpb24gY29tcG9uZW50IHRvIGl0cyBpbml0aWFsIHN0YXRlLCBpbmNsdWRpbmcgYWxsIHBhcmFtZXRlcnMuIFRoZSBzeXN0ZW1cbiAgICAgKiB3aWxsIGJlIHBhdXNlZC5cbiAgICAgKi9cbiAgICByZXNldCgpIHtcbiAgICAgICAgdGhpcy5fY29udHJvbGxlci5yZXNldCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYmluZCBhbnkgYW5pbWF0aW9ucyBpbiB0aGUgbGF5ZXIgdG8gdGhlIGN1cnJlbnRseSBwcmVzZW50IGNvbXBvbmVudHMgYW5kIG1vZGVsIG9mIHRoZSBhbmltXG4gICAgICogY29tcG9uZW50cyBlbnRpdHkuXG4gICAgICovXG4gICAgcmViaW5kKCkge1xuICAgICAgICB0aGlzLl9jb250cm9sbGVyLnJlYmluZCgpO1xuICAgIH1cblxuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICBpZiAodGhpcy5fYmxlbmRUaW1lKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYmxlbmRUaW1lRWxhcHNlZCA8IHRoaXMuX2JsZW5kVGltZSkge1xuICAgICAgICAgICAgICAgIHRoaXMud2VpZ2h0ID0gbWF0aC5sZXJwKHRoaXMuX3N0YXJ0aW5nV2VpZ2h0LCB0aGlzLl90YXJnZXRXZWlnaHQsIHRoaXMuX2JsZW5kVGltZUVsYXBzZWQgLyB0aGlzLl9ibGVuZFRpbWUpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2JsZW5kVGltZUVsYXBzZWQgKz0gZHQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMud2VpZ2h0ID0gdGhpcy5fdGFyZ2V0V2VpZ2h0O1xuICAgICAgICAgICAgICAgIHRoaXMuX2JsZW5kVGltZSA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmxlbmRUaW1lRWxhcHNlZCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3RhcnRpbmdXZWlnaHQgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldFdlaWdodCA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY29udHJvbGxlci51cGRhdGUoZHQpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQmxlbmQgZnJvbSB0aGUgY3VycmVudCB3ZWlnaHQgdmFsdWUgdG8gdGhlIHByb3ZpZGVkIHdlaWdodCB2YWx1ZSBvdmVyIGEgZ2l2ZW4gYW1vdW50IG9mIHRpbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2VpZ2h0IC0gVGhlIG5ldyB3ZWlnaHQgdmFsdWUgdG8gYmxlbmQgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRpbWUgLSBUaGUgZHVyYXRpb24gb2YgdGhlIGJsZW5kIGluIHNlY29uZHMuXG4gICAgICovXG4gICAgYmxlbmRUb1dlaWdodCh3ZWlnaHQsIHRpbWUpIHtcbiAgICAgICAgdGhpcy5fc3RhcnRpbmdXZWlnaHQgPSB0aGlzLndlaWdodDtcbiAgICAgICAgdGhpcy5fdGFyZ2V0V2VpZ2h0ID0gd2VpZ2h0O1xuICAgICAgICB0aGlzLl9ibGVuZFRpbWUgPSBNYXRoLm1heCgwLCB0aW1lKTtcbiAgICAgICAgdGhpcy5fYmxlbmRUaW1lRWxhcHNlZCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgbWFzayB0byB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFttYXNrXSAtIFRoZSBtYXNrIHRvIGFzc2lnbiB0byB0aGUgbGF5ZXIuIElmIG5vdCBwcm92aWRlZCB0aGUgY3VycmVudCBtYXNrXG4gICAgICogaW4gdGhlIGxheWVyIHdpbGwgYmUgcmVtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVudGl0eS5hbmltLmJhc2VMYXllci5hc3NpZ25NYXNrKHtcbiAgICAgKiAgICAgLy8gaW5jbHVkZSB0aGUgc3BpbmUgb2YgdGhlIGN1cnJlbnQgbW9kZWwgYW5kIGFsbCBvZiBpdHMgY2hpbGRyZW5cbiAgICAgKiAgICAgXCJwYXRoL3RvL3NwaW5lXCI6IHtcbiAgICAgKiAgICAgICAgIGNoaWxkcmVuOiB0cnVlXG4gICAgICogICAgIH0sXG4gICAgICogICAgIC8vIGluY2x1ZGUgdGhlIGhpcCBvZiB0aGUgY3VycmVudCBtb2RlbCBidXQgbm90IGFsbCBvZiBpdHMgY2hpbGRyZW5cbiAgICAgKiAgICAgXCJwYXRoL3RvL2hpcFwiOiB0cnVlXG4gICAgICogfSk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFzc2lnbk1hc2sobWFzaykge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdUaGUgcGMuQW5pbUNvbXBvbmVudExheWVyI2Fzc2lnbk1hc2sgZnVuY3Rpb24gaXMgbm93IGRlcHJlY2F0ZWQuIEFzc2lnbiBtYXNrcyB0byB0aGUgcGMuQW5pbUNvbXBvbmVudExheWVyI21hc2sgcHJvcGVydHkgaW5zdGVhZC4nKTtcbiAgICAgICAgaWYgKHRoaXMuX2NvbnRyb2xsZXIuYXNzaWduTWFzayhtYXNrKSkge1xuICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50LnJlYmluZCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX21hc2sgPSBtYXNrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbnMgYW4gYW5pbWF0aW9uIHRyYWNrIHRvIGEgc3RhdGUgb3IgYmxlbmQgdHJlZSBub2RlIGluIHRoZSBjdXJyZW50IGdyYXBoLiBJZiBhIHN0YXRlXG4gICAgICogZm9yIHRoZSBnaXZlbiBub2RlUGF0aCBkb2Vzbid0IGV4aXN0LCBpdCB3aWxsIGJlIGNyZWF0ZWQuIElmIGFsbCBzdGF0ZXMgbm9kZXMgYXJlIGxpbmtlZCBhbmRcbiAgICAgKiB0aGUge0BsaW5rIEFuaW1Db21wb25lbnQjYWN0aXZhdGV9IHZhbHVlIHdhcyBzZXQgdG8gdHJ1ZSB0aGVuIHRoZSBjb21wb25lbnQgd2lsbCBiZWdpblxuICAgICAqIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbm9kZVBhdGggLSBFaXRoZXIgdGhlIHN0YXRlIG5hbWUgb3IgdGhlIHBhdGggdG8gYSBibGVuZCB0cmVlIG5vZGUgdGhhdCB0aGlzXG4gICAgICogYW5pbWF0aW9uIHNob3VsZCBiZSBhc3NvY2lhdGVkIHdpdGguIEVhY2ggc2VjdGlvbiBvZiBhIGJsZW5kIHRyZWUgcGF0aCBpcyBzcGxpdCB1c2luZyBhXG4gICAgICogcGVyaW9kIChgLmApIHRoZXJlZm9yZSBzdGF0ZSBuYW1lcyBzaG91bGQgbm90IGluY2x1ZGUgdGhpcyBjaGFyYWN0ZXIgKGUuZyBcIk15U3RhdGVOYW1lXCIgb3JcbiAgICAgKiBcIk15U3RhdGVOYW1lLkJsZW5kVHJlZU5vZGVcIikuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGFuaW1UcmFjayAtIFRoZSBhbmltYXRpb24gdHJhY2sgdGhhdCB3aWxsIGJlIGFzc2lnbmVkIHRvIHRoaXMgc3RhdGUgYW5kXG4gICAgICogcGxheWVkIHdoZW5ldmVyIHRoaXMgc3RhdGUgaXMgYWN0aXZlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc3BlZWRdIC0gVXBkYXRlIHRoZSBzcGVlZCBvZiB0aGUgc3RhdGUgeW91IGFyZSBhc3NpZ25pbmcgYW4gYW5pbWF0aW9uIHRvLlxuICAgICAqIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbbG9vcF0gLSBVcGRhdGUgdGhlIGxvb3AgcHJvcGVydHkgb2YgdGhlIHN0YXRlIHlvdSBhcmUgYXNzaWduaW5nIGFuXG4gICAgICogYW5pbWF0aW9uIHRvLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqL1xuICAgIGFzc2lnbkFuaW1hdGlvbihub2RlUGF0aCwgYW5pbVRyYWNrLCBzcGVlZCwgbG9vcCkge1xuICAgICAgICBpZiAoYW5pbVRyYWNrLmNvbnN0cnVjdG9yICE9PSBBbmltVHJhY2spIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKCdhc3NpZ25BbmltYXRpb246IGFuaW1UcmFjayBzdXBwbGllZCB0byBmdW5jdGlvbiB3YXMgbm90IG9mIHR5cGUgQW5pbVRyYWNrJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY29udHJvbGxlci5hc3NpZ25BbmltYXRpb24obm9kZVBhdGgsIGFuaW1UcmFjaywgc3BlZWQsIGxvb3ApO1xuICAgICAgICBpZiAodGhpcy5fY29udHJvbGxlci5fdHJhbnNpdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9jb250cm9sbGVyLl90cmFuc2l0aW9ucy5wdXNoKG5ldyBBbmltVHJhbnNpdGlvbih7XG4gICAgICAgICAgICAgICAgZnJvbTogJ1NUQVJUJyxcbiAgICAgICAgICAgICAgICB0bzogbm9kZVBhdGhcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fY29tcG9uZW50LmFjdGl2YXRlICYmIHRoaXMuX2NvbXBvbmVudC5wbGF5YWJsZSkge1xuICAgICAgICAgICAgdGhpcy5fY29tcG9uZW50LnBsYXlpbmcgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbmltYXRpb25zIGZyb20gYSBub2RlIGluIHRoZSBsb2FkZWQgc3RhdGUgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbm9kZU5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgbm9kZSB0aGF0IHNob3VsZCBoYXZlIGl0cyBhbmltYXRpb24gdHJhY2tzIHJlbW92ZWQuXG4gICAgICovXG4gICAgcmVtb3ZlTm9kZUFuaW1hdGlvbnMobm9kZU5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbnRyb2xsZXIucmVtb3ZlTm9kZUFuaW1hdGlvbnMobm9kZU5hbWUpKSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wb25lbnQucGxheWluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgYXNzZXQgdGhhdCBpcyBhc3NvY2lhdGVkIHdpdGggdGhlIGdpdmVuIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0YXRlTmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBzdGF0ZSB0byBnZXQgdGhlIGFzc2V0IGZvci5cbiAgICAgKiBAcmV0dXJucyB7aW1wb3J0KCcuLi8uLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBUaGUgYXNzZXQgYXNzb2NpYXRlZCB3aXRoIHRoZSBnaXZlbiBzdGF0ZS5cbiAgICAgKi9cbiAgICBnZXRBbmltYXRpb25Bc3NldChzdGF0ZU5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudC5hbmltYXRpb25Bc3NldHNbYCR7dGhpcy5uYW1lfToke3N0YXRlTmFtZX1gXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmFuc2l0aW9uIHRvIGFueSBzdGF0ZSBpbiB0aGUgY3VycmVudCBsYXllcnMgZ3JhcGguIFRyYW5zaXRpb25zIGNhbiBiZSBpbnN0YW50IG9yIHRha2UgYW5cbiAgICAgKiBvcHRpb25hbCBibGVuZCB0aW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRvIC0gVGhlIHN0YXRlIHRoYXQgdGhpcyB0cmFuc2l0aW9uIHdpbGwgdHJhbnNpdGlvbiB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVdIC0gVGhlIGR1cmF0aW9uIG9mIHRoZSB0cmFuc2l0aW9uIGluIHNlY29uZHMuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt0cmFuc2l0aW9uT2Zmc2V0XSAtIElmIHByb3ZpZGVkLCB0aGUgZGVzdGluYXRpb24gc3RhdGUgd2lsbCBiZWdpbiBwbGF5aW5nXG4gICAgICogaXRzIGFuaW1hdGlvbiBhdCB0aGlzIHRpbWUuIEdpdmVuIGluIG5vcm1hbGl6ZWQgdGltZSwgYmFzZWQgb24gdGhlIHN0YXRlcyBkdXJhdGlvbiAmIG11c3QgYmVcbiAgICAgKiBiZXR3ZWVuIDAgYW5kIDEuIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICovXG4gICAgdHJhbnNpdGlvbih0bywgdGltZSA9IDAsIHRyYW5zaXRpb25PZmZzZXQgPSBudWxsKSB7XG4gICAgICAgIHRoaXMuX2NvbnRyb2xsZXIudXBkYXRlU3RhdGVGcm9tVHJhbnNpdGlvbihuZXcgQW5pbVRyYW5zaXRpb24oe1xuICAgICAgICAgICAgZnJvbTogdGhpcy5fY29udHJvbGxlci5hY3RpdmVTdGF0ZU5hbWUsXG4gICAgICAgICAgICB0byxcbiAgICAgICAgICAgIHRpbWUsXG4gICAgICAgICAgICB0cmFuc2l0aW9uT2Zmc2V0XG4gICAgICAgIH0pKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEFuaW1Db21wb25lbnRMYXllciB9O1xuIl0sIm5hbWVzIjpbIkFuaW1Db21wb25lbnRMYXllciIsImNvbnN0cnVjdG9yIiwibmFtZSIsImNvbnRyb2xsZXIiLCJjb21wb25lbnQiLCJ3ZWlnaHQiLCJibGVuZFR5cGUiLCJBTklNX0xBWUVSX09WRVJXUklURSIsIm5vcm1hbGl6ZWRXZWlnaHQiLCJfbmFtZSIsIl9jb250cm9sbGVyIiwiX2NvbXBvbmVudCIsIl93ZWlnaHQiLCJfYmxlbmRUeXBlIiwiX25vcm1hbGl6ZWRXZWlnaHQiLCJfbWFzayIsIl9ibGVuZFRpbWUiLCJfYmxlbmRUaW1lRWxhcHNlZCIsIl9zdGFydGluZ1dlaWdodCIsIl90YXJnZXRXZWlnaHQiLCJwbGF5aW5nIiwidmFsdWUiLCJwbGF5YWJsZSIsImFjdGl2ZVN0YXRlIiwiYWN0aXZlU3RhdGVOYW1lIiwicHJldmlvdXNTdGF0ZSIsInByZXZpb3VzU3RhdGVOYW1lIiwiYWN0aXZlU3RhdGVQcm9ncmVzcyIsImFjdGl2ZVN0YXRlRHVyYXRpb24iLCJhY3RpdmVTdGF0ZUN1cnJlbnRUaW1lIiwidGltZSIsImxheWVyUGxheWluZyIsInVwZGF0ZSIsInRyYW5zaXRpb25pbmciLCJ0cmFuc2l0aW9uUHJvZ3Jlc3MiLCJzdGF0ZXMiLCJkaXJ0aWZ5VGFyZ2V0cyIsIm5vcm1hbGl6ZVdlaWdodHMiLCJyZWJpbmQiLCJtYXNrIiwiYXNzaWduTWFzayIsInBsYXkiLCJwYXVzZSIsInJlc2V0IiwiZHQiLCJtYXRoIiwibGVycCIsImJsZW5kVG9XZWlnaHQiLCJNYXRoIiwibWF4IiwiRGVidWciLCJkZXByZWNhdGVkIiwiYXNzaWduQW5pbWF0aW9uIiwibm9kZVBhdGgiLCJhbmltVHJhY2siLCJzcGVlZCIsImxvb3AiLCJBbmltVHJhY2siLCJlcnJvciIsIl90cmFuc2l0aW9ucyIsImxlbmd0aCIsInB1c2giLCJBbmltVHJhbnNpdGlvbiIsImZyb20iLCJ0byIsImFjdGl2YXRlIiwicmVtb3ZlTm9kZUFuaW1hdGlvbnMiLCJub2RlTmFtZSIsImdldEFuaW1hdGlvbkFzc2V0Iiwic3RhdGVOYW1lIiwiYW5pbWF0aW9uQXNzZXRzIiwidHJhbnNpdGlvbiIsInRyYW5zaXRpb25PZmZzZXQiLCJ1cGRhdGVTdGF0ZUZyb21UcmFuc2l0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQU9BO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGtCQUFrQixDQUFDO0FBQ3JCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXLENBQUNDLElBQUksRUFBRUMsVUFBVSxFQUFFQyxTQUFTLEVBQUVDLE1BQU0sR0FBRyxDQUFDLEVBQUVDLFNBQVMsR0FBR0Msb0JBQW9CLEVBQUVDLGdCQUFnQixHQUFHLElBQUksRUFBRTtJQUM1RyxJQUFJLENBQUNDLEtBQUssR0FBR1AsSUFBSSxDQUFBO0lBQ2pCLElBQUksQ0FBQ1EsV0FBVyxHQUFHUCxVQUFVLENBQUE7SUFDN0IsSUFBSSxDQUFDUSxVQUFVLEdBQUdQLFNBQVMsQ0FBQTtJQUMzQixJQUFJLENBQUNRLE9BQU8sR0FBR1AsTUFBTSxDQUFBO0lBQ3JCLElBQUksQ0FBQ1EsVUFBVSxHQUFHUCxTQUFTLENBQUE7SUFD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
