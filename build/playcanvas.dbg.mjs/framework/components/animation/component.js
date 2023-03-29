/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { AnimClip } from '../../anim/evaluator/anim-clip.js';
import { AnimEvaluator } from '../../anim/evaluator/anim-evaluator.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { DefaultAnimBinder } from '../../anim/binder/default-anim-binder.js';
import { Skeleton } from '../../../scene/animation/skeleton.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

/**
 * The Animation Component allows an Entity to playback animations on models.
 *
 * @augments Component
 */
class AnimationComponent extends Component {
  /**
   * @type {Object<string, import('../../../scene/animation/animation.js').Animation>}
   * @private
   */

  /**
   * @type {Array.<number|Asset>}
   * @private
   */

  /** @private */

  /**
   * @type {AnimEvaluator|null}
   * @ignore
   */

  /**
   * @type {import('../../../scene/model.js').Model|null}
   * @ignore
   */

  /**
   * Get the skeleton for the current model. If the model is loaded from glTF/glb, then the
   * skeleton is null.
   *
   * @type {Skeleton|null}
   */

  /**
   * @type {Skeleton|null}
   * @ignore
   */

  /**
   * @type {Skeleton|null}
   * @ignore
   */

  /**
   * @type {Object<string, string>}
   * @ignore
   */

  /**
   * @type {string|null}
   * @private
   */

  /**
   * @type {string|null}
   * @private
   */

  /** @private */

  /** @private */

  /** @private */

  /**
   * If true the first animation asset will begin playing when the scene is loaded.
   *
   * @type {boolean}
   */

  /**
   * Speed multiplier for animation play back. 1 is playback at normal speed and 0 pauses the
   * animation.
   *
   * @type {number}
   */

  /**
   * Create a new AnimationComponent instance.
   *
   * @param {import('./system.js').AnimationComponentSystem} system - The {@link ComponentSystem}
   * that created this component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this component is
   * attached to.
   */
  constructor(system, entity) {
    // eslint-disable-line no-useless-constructor
    super(system, entity);
    this._animations = {};
    this._assets = [];
    this._loop = true;
    this.animEvaluator = null;
    this.model = null;
    this.skeleton = null;
    this.fromSkel = null;
    this.toSkel = null;
    this.animationsIndex = {};
    this.prevAnim = null;
    this.currAnim = null;
    this.blend = 0;
    this.blending = false;
    this.blendSpeed = 0;
    this.activate = true;
    this.speed = 1;
  }

  /**
   * Get or set dictionary of animations by name.
   *
   * @type {Object<string, import('../../../scene/animation/animation.js').Animation>}
   */
  set animations(value) {
    this._animations = value;
    this.onSetAnimations();
  }
  get animations() {
    return this._animations;
  }

  /**
   * The array of animation assets. Can also be an array of asset ids.
   *
   * @type {Array.<number|Asset>}
   */
  set assets(value) {
    const assets = this._assets;
    if (assets && assets.length) {
      for (let i = 0; i < assets.length; i++) {
        // unsubscribe from change event for old assets
        if (assets[i]) {
          const asset = this.system.app.assets.get(assets[i]);
          if (asset) {
            asset.off('change', this.onAssetChanged, this);
            asset.off('remove', this.onAssetRemoved, this);
            const animName = this.animationsIndex[asset.id];
            if (this.currAnim === animName) this._stopCurrentAnimation();
            delete this.animations[animName];
            delete this.animationsIndex[asset.id];
          }
        }
      }
    }
    this._assets = value;
    const assetIds = value.map(value => {
      return value instanceof Asset ? value.id : value;
    });
    this.loadAnimationAssets(assetIds);
  }
  get assets() {
    return this._assets;
  }

  /**
   * Get or set the current time position (in seconds) of the animation.
   *
   * @type {number}
   */
  set currentTime(currentTime) {
    if (this.skeleton) {
      this.skeleton.currentTime = currentTime;
      this.skeleton.addTime(0);
      this.skeleton.updateGraph();
    }
    if (this.animEvaluator) {
      const clips = this.animEvaluator.clips;
      for (let i = 0; i < clips.length; ++i) {
        clips[i].time = currentTime;
      }
    }
  }
  get currentTime() {
    if (this.skeleton) {
      return this.skeleton._time;
    }
    if (this.animEvaluator) {
      // Get the last clip's current time which will be the one
      // that is currently being blended
      const clips = this.animEvaluator.clips;
      if (clips.length > 0) {
        return clips[clips.length - 1].time;
      }
    }
    return 0;
  }

  /**
   * Get the duration in seconds of the current animation. Returns 0 if no animation is playing.
   *
   * @type {number}
   */
  get duration() {
    if (this.currAnim) {
      return this.animations[this.currAnim].duration;
    }
    Debug.warn(`No animation is playing to get a duration. Returning 0.`);
    return 0;
  }

  /**
   * If true the animation will restart from the beginning when it reaches the end.
   *
   * @type {boolean}
   */
  set loop(value) {
    this._loop = value;
    if (this.skeleton) {
      this.skeleton.looping = value;
    }
    if (this.animEvaluator) {
      for (let i = 0; i < this.animEvaluator.clips.length; ++i) {
        this.animEvaluator.clips[i].loop = value;
      }
    }
  }
  get loop() {
    return this._loop;
  }

  /**
   * Start playing an animation.
   *
   * @param {string} name - The name of the animation asset to begin playing.
   * @param {number} [blendTime] - The time in seconds to blend from the current
   * animation state to the start of the animation being set. Defaults to 0.
   */
  play(name, blendTime = 0) {
    if (!this.enabled || !this.entity.enabled) {
      return;
    }
    if (!this.animations[name]) {
      Debug.error(`Trying to play animation '${name}' which doesn't exist`);
      return;
    }
    this.prevAnim = this.currAnim;
    this.currAnim = name;
    if (this.model) {
      if (!this.skeleton && !this.animEvaluator) {
        this._createAnimationController();
      }
      const prevAnim = this.animations[this.prevAnim];
      const currAnim = this.animations[this.currAnim];
      this.blending = blendTime > 0 && !!this.prevAnim;
      if (this.blending) {
        this.blend = 0;
        this.blendSpeed = 1 / blendTime;
      }
      if (this.skeleton) {
        if (this.blending) {
          // Blend from the current time of the current animation to the start of
          // the newly specified animation over the specified blend time period.
          this.fromSkel.animation = prevAnim;
          this.fromSkel.addTime(this.skeleton._time);
          this.toSkel.animation = currAnim;
        } else {
          this.skeleton.animation = currAnim;
        }
      }
      if (this.animEvaluator) {
        const animEvaluator = this.animEvaluator;
        if (this.blending) {
          // remove all but the last clip
          while (animEvaluator.clips.length > 1) {
            animEvaluator.removeClip(0);
          }
        } else {
          this.animEvaluator.removeClips();
        }
        const clip = new AnimClip(this.animations[this.currAnim], 0, 1.0, true, this.loop);
        clip.name = this.currAnim;
        clip.blendWeight = this.blending ? 0 : 1;
        clip.reset();
        this.animEvaluator.addClip(clip);
      }
    }
    this.playing = true;
  }

  /**
   * Return an animation.
   *
   * @param {string} name - The name of the animation asset.
   * @returns {import('../../../scene/animation/animation.js').Animation} An Animation.
   */
  getAnimation(name) {
    return this.animations[name];
  }

  /**
   * Set the model driven by this animation component.
   *
   * @param {import('../../../scene/model.js').Model} model - The model to set.
   * @ignore
   */
  setModel(model) {
    if (model !== this.model) {
      // reset animation controller
      this._resetAnimationController();

      // set the model
      this.model = model;

      // Reset the current animation on the new model
      if (this.animations && this.currAnim && this.animations[this.currAnim]) {
        this.play(this.currAnim);
      }
    }
  }
  onSetAnimations() {
    // If we have animations _and_ a model, we can create the skeletons
    const modelComponent = this.entity.model;
    if (modelComponent) {
      const m = modelComponent.model;
      if (m && m !== this.model) {
        this.setModel(m);
      }
    }
    if (!this.currAnim && this.activate && this.enabled && this.entity.enabled) {
      // Set the first loaded animation as the current
      const animationNames = Object.keys(this._animations);
      if (animationNames.length > 0) {
        this.play(animationNames[0]);
      }
    }
  }

  /** @private */
  _resetAnimationController() {
    this.skeleton = null;
    this.fromSkel = null;
    this.toSkel = null;
    this.animEvaluator = null;
  }

  /** @private */
  _createAnimationController() {
    const model = this.model;
    const animations = this.animations;

    // check which type of animations are loaded
    let hasJson = false;
    let hasGlb = false;
    for (const animation in animations) {
      if (animations.hasOwnProperty(animation)) {
        const anim = animations[animation];
        if (anim.constructor === AnimTrack) {
          hasGlb = true;
        } else {
          hasJson = true;
        }
      }
    }
    const graph = model.getGraph();
    if (hasJson) {
      this.fromSkel = new Skeleton(graph);
      this.toSkel = new Skeleton(graph);
      this.skeleton = new Skeleton(graph);
      this.skeleton.looping = this.loop;
      this.skeleton.setGraph(graph);
    } else if (hasGlb) {
      this.animEvaluator = new AnimEvaluator(new DefaultAnimBinder(this.entity));
    }
  }

  /**
   * @param {number[]} ids - Array of animation asset ids.
   * @private
   */
  loadAnimationAssets(ids) {
    if (!ids || !ids.length) return;
    const assets = this.system.app.assets;
    const onAssetReady = asset => {
      if (asset.resources.length > 1) {
        for (let i = 0; i < asset.resources.length; i++) {
          this.animations[asset.resources[i].name] = asset.resources[i];
          this.animationsIndex[asset.id] = asset.resources[i].name;
        }
      } else {
        this.animations[asset.name] = asset.resource;
        this.animationsIndex[asset.id] = asset.name;
      }
      /* eslint-disable no-self-assign */
      this.animations = this.animations; // assigning ensures set_animations event is fired
      /* eslint-enable no-self-assign */
    };

    const onAssetAdd = asset => {
      asset.off('change', this.onAssetChanged, this);
      asset.on('change', this.onAssetChanged, this);
      asset.off('remove', this.onAssetRemoved, this);
      asset.on('remove', this.onAssetRemoved, this);
      if (asset.resource) {
        onAssetReady(asset);
      } else {
        asset.once('load', onAssetReady, this);
        if (this.enabled && this.entity.enabled) assets.load(asset);
      }
    };
    for (let i = 0, l = ids.length; i < l; i++) {
      const asset = assets.get(ids[i]);
      if (asset) {
        onAssetAdd(asset);
      } else {
        assets.on('add:' + ids[i], onAssetAdd);
      }
    }
  }

  /**
   * Handle asset change events.
   *
   * @param {Asset} asset - The asset that changed.
   * @param {string} attribute - The name of the asset attribute that changed. Can be 'data',
   * 'file', 'resource' or 'resources'.
   * @param {*} newValue - The new value of the specified asset property.
   * @param {*} oldValue - The old value of the specified asset property.
   * @private
   */
  onAssetChanged(asset, attribute, newValue, oldValue) {
    if (attribute === 'resource' || attribute === 'resources') {
      // If the attribute is 'resources', newValue can be an empty array when the
      // asset is unloaded. Therefore, we should assign null in this case
      if (attribute === 'resources' && newValue && newValue.length === 0) {
        newValue = null;
      }

      // replace old animation with new one
      if (newValue) {
        let restarted = false;
        if (newValue.length > 1) {
          if (oldValue && oldValue.length > 1) {
            for (let i = 0; i < oldValue.length; i++) {
              delete this.animations[oldValue[i].name];
            }
          } else {
            delete this.animations[asset.name];
          }
          restarted = false;
          for (let i = 0; i < newValue.length; i++) {
            this.animations[newValue[i].name] = newValue[i];
            if (!restarted && this.currAnim === newValue[i].name) {
              // restart animation
              if (this.playing && this.enabled && this.entity.enabled) {
                restarted = true;
                this.play(newValue[i].name);
              }
            }
          }
          if (!restarted) {
            this._stopCurrentAnimation();
            this.onSetAnimations();
          }
        } else {
          if (oldValue && oldValue.length > 1) {
            for (let i = 0; i < oldValue.length; i++) {
              delete this.animations[oldValue[i].name];
            }
          }
          this.animations[asset.name] = newValue[0] || newValue;
          restarted = false;
          if (this.currAnim === asset.name) {
            // restart animation
            if (this.playing && this.enabled && this.entity.enabled) {
              restarted = true;
              this.play(asset.name);
            }
          }
          if (!restarted) {
            this._stopCurrentAnimation();
            this.onSetAnimations();
          }
        }
        this.animationsIndex[asset.id] = asset.name;
      } else {
        if (oldValue.length > 1) {
          for (let i = 0; i < oldValue.length; i++) {
            delete this.animations[oldValue[i].name];
            if (this.currAnim === oldValue[i].name) {
              this._stopCurrentAnimation();
            }
          }
        } else {
          delete this.animations[asset.name];
          if (this.currAnim === asset.name) {
            this._stopCurrentAnimation();
          }
        }
        delete this.animationsIndex[asset.id];
      }
    }
  }

  /**
   * @param {Asset} asset - The asset that was removed.
   * @private
   */
  onAssetRemoved(asset) {
    asset.off('remove', this.onAssetRemoved, this);
    if (this.animations) {
      if (asset.resources.length > 1) {
        for (let i = 0; i < asset.resources.length; i++) {
          delete this.animations[asset.resources[i].name];
          if (this.currAnim === asset.resources[i].name) this._stopCurrentAnimation();
        }
      } else {
        delete this.animations[asset.name];
        if (this.currAnim === asset.name) this._stopCurrentAnimation();
      }
      delete this.animationsIndex[asset.id];
    }
  }

  /** @private */
  _stopCurrentAnimation() {
    this.currAnim = null;
    this.playing = false;
    if (this.skeleton) {
      this.skeleton.currentTime = 0;
      this.skeleton.animation = null;
    }
    if (this.animEvaluator) {
      for (let i = 0; i < this.animEvaluator.clips.length; ++i) {
        this.animEvaluator.clips[i].stop();
      }
      this.animEvaluator.update(0);
      this.animEvaluator.removeClips();
    }
  }
  onEnable() {
    super.onEnable();

    // load assets if they're not loaded
    const assets = this.assets;
    const registry = this.system.app.assets;
    if (assets) {
      for (let i = 0, len = assets.length; i < len; i++) {
        let asset = assets[i];
        if (!(asset instanceof Asset)) asset = registry.get(asset);
        if (asset && !asset.resource) registry.load(asset);
      }
    }
    if (this.activate && !this.currAnim) {
      const animationNames = Object.keys(this.animations);
      if (animationNames.length > 0) {
        this.play(animationNames[0]);
      }
    }
  }
  onBeforeRemove() {
    for (let i = 0; i < this.assets.length; i++) {
      // this.assets can be an array of pc.Assets or an array of numbers (assetIds)
      let asset = this.assets[i];
      if (typeof asset === 'number') {
        asset = this.system.app.assets.get(asset);
      }
      if (!asset) continue;
      asset.off('change', this.onAssetChanged, this);
      asset.off('remove', this.onAssetRemoved, this);
    }
    this.skeleton = null;
    this.fromSkel = null;
    this.toSkel = null;
    this.animEvaluator = null;
  }

  /**
   * Update the state of the component.
   *
   * @param {number} dt - The time delta.
   * @ignore
   */
  update(dt) {
    // update blending
    if (this.blending) {
      this.blend += dt * this.blendSpeed;
      if (this.blend >= 1) {
        this.blend = 1;
      }
    }

    // update skeleton
    if (this.playing) {
      const skeleton = this.skeleton;
      if (skeleton !== null && this.model !== null) {
        if (this.blending) {
          skeleton.blend(this.fromSkel, this.toSkel, this.blend);
        } else {
          // Advance the animation, interpolating keyframes at each animated node in
          // skeleton
          const delta = dt * this.speed;
          skeleton.addTime(delta);
          if (this.speed > 0 && skeleton._time === skeleton.animation.duration && !this.loop) {
            this.playing = false;
          } else if (this.speed < 0 && skeleton._time === 0 && !this.loop) {
            this.playing = false;
          }
        }
        if (this.blending && this.blend === 1) {
          skeleton.animation = this.toSkel.animation;
        }
        skeleton.updateGraph();
      }
    }

    // update anim controller
    const animEvaluator = this.animEvaluator;
    if (animEvaluator) {
      // force all clips' speed and playing state from the component
      for (let i = 0; i < animEvaluator.clips.length; ++i) {
        const clip = animEvaluator.clips[i];
        clip.speed = this.speed;
        if (!this.playing) {
          clip.pause();
        } else {
          clip.resume();
        }
      }

      // update blend weight
      if (this.blending && animEvaluator.clips.length > 1) {
        animEvaluator.clips[1].blendWeight = this.blend;
      }
      animEvaluator.update(dt);
    }

    // clear blending flag
    if (this.blending && this.blend === 1) {
      this.blending = false;
    }
  }
}

export { AnimationComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbWF0aW9uL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBBbmltQ2xpcCB9IGZyb20gJy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tY2xpcC5qcyc7XG5pbXBvcnQgeyBBbmltRXZhbHVhdG9yIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmFsdWF0b3IuanMnO1xuaW1wb3J0IHsgQW5pbVRyYWNrIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS10cmFjay5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0QW5pbUJpbmRlciB9IGZyb20gJy4uLy4uL2FuaW0vYmluZGVyL2RlZmF1bHQtYW5pbS1iaW5kZXIuanMnO1xuXG5pbXBvcnQgeyBTa2VsZXRvbiB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2FuaW1hdGlvbi9za2VsZXRvbi5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG4vKipcbiAqIFRoZSBBbmltYXRpb24gQ29tcG9uZW50IGFsbG93cyBhbiBFbnRpdHkgdG8gcGxheWJhY2sgYW5pbWF0aW9ucyBvbiBtb2RlbHMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBBbmltYXRpb25Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2FuaW1hdGlvbi9hbmltYXRpb24uanMnKS5BbmltYXRpb24+fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FuaW1hdGlvbnMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheS48bnVtYmVyfEFzc2V0Pn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hc3NldHMgPSBbXTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9sb29wID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBbmltRXZhbHVhdG9yfG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFuaW1FdmFsdWF0b3IgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnKS5Nb2RlbHxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtb2RlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHNrZWxldG9uIGZvciB0aGUgY3VycmVudCBtb2RlbC4gSWYgdGhlIG1vZGVsIGlzIGxvYWRlZCBmcm9tIGdsVEYvZ2xiLCB0aGVuIHRoZVxuICAgICAqIHNrZWxldG9uIGlzIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2tlbGV0b258bnVsbH1cbiAgICAgKi9cbiAgICBza2VsZXRvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U2tlbGV0b258bnVsbH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZnJvbVNrZWwgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NrZWxldG9ufG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHRvU2tlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYW5pbWF0aW9uc0luZGV4ID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwcmV2QW5pbSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBjdXJyQW5pbSA9IG51bGw7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBibGVuZCA9IDA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBibGVuZGluZyA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgYmxlbmRTcGVlZCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBmaXJzdCBhbmltYXRpb24gYXNzZXQgd2lsbCBiZWdpbiBwbGF5aW5nIHdoZW4gdGhlIHNjZW5lIGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFjdGl2YXRlID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFNwZWVkIG11bHRpcGxpZXIgZm9yIGFuaW1hdGlvbiBwbGF5IGJhY2suIDEgaXMgcGxheWJhY2sgYXQgbm9ybWFsIHNwZWVkIGFuZCAwIHBhdXNlcyB0aGVcbiAgICAgKiBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNwZWVkID0gMTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltYXRpb25Db21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5BbmltYXRpb25Db21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSB7QGxpbmsgQ29tcG9uZW50U3lzdGVtfVxuICAgICAqIHRoYXQgY3JlYXRlZCB0aGlzIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBjb21wb25lbnQgaXNcbiAgICAgKiBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVzZWxlc3MtY29uc3RydWN0b3JcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBvciBzZXQgZGljdGlvbmFyeSBvZiBhbmltYXRpb25zIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgaW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9hbmltYXRpb24vYW5pbWF0aW9uLmpzJykuQW5pbWF0aW9uPn1cbiAgICAgKi9cbiAgICBzZXQgYW5pbWF0aW9ucyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hbmltYXRpb25zID0gdmFsdWU7XG5cbiAgICAgICAgdGhpcy5vblNldEFuaW1hdGlvbnMoKTtcbiAgICB9XG5cbiAgICBnZXQgYW5pbWF0aW9ucygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaW1hdGlvbnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFycmF5IG9mIGFuaW1hdGlvbiBhc3NldHMuIENhbiBhbHNvIGJlIGFuIGFycmF5IG9mIGFzc2V0IGlkcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheS48bnVtYmVyfEFzc2V0Pn1cbiAgICAgKi9cbiAgICBzZXQgYXNzZXRzKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX2Fzc2V0cztcblxuICAgICAgICBpZiAoYXNzZXRzICYmIGFzc2V0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXNzZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgLy8gdW5zdWJzY3JpYmUgZnJvbSBjaGFuZ2UgZXZlbnQgZm9yIG9sZCBhc3NldHNcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoYXNzZXRzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMub25Bc3NldENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uQXNzZXRSZW1vdmVkLCB0aGlzKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYW5pbU5hbWUgPSB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJBbmltID09PSBhbmltTmFtZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9wQ3VycmVudEFuaW1hdGlvbigpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5hbmltYXRpb25zW2FuaW1OYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hc3NldHMgPSB2YWx1ZTtcblxuICAgICAgICBjb25zdCBhc3NldElkcyA9IHZhbHVlLm1hcCgodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkgPyB2YWx1ZS5pZCA6IHZhbHVlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmxvYWRBbmltYXRpb25Bc3NldHMoYXNzZXRJZHMpO1xuICAgIH1cblxuICAgIGdldCBhc3NldHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3NldHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IG9yIHNldCB0aGUgY3VycmVudCB0aW1lIHBvc2l0aW9uIChpbiBzZWNvbmRzKSBvZiB0aGUgYW5pbWF0aW9uLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY3VycmVudFRpbWUoY3VycmVudFRpbWUpIHtcbiAgICAgICAgaWYgKHRoaXMuc2tlbGV0b24pIHtcbiAgICAgICAgICAgIHRoaXMuc2tlbGV0b24uY3VycmVudFRpbWUgPSBjdXJyZW50VGltZTtcbiAgICAgICAgICAgIHRoaXMuc2tlbGV0b24uYWRkVGltZSgwKTtcbiAgICAgICAgICAgIHRoaXMuc2tlbGV0b24udXBkYXRlR3JhcGgoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmFuaW1FdmFsdWF0b3IpIHtcbiAgICAgICAgICAgIGNvbnN0IGNsaXBzID0gdGhpcy5hbmltRXZhbHVhdG9yLmNsaXBzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbGlwcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIGNsaXBzW2ldLnRpbWUgPSBjdXJyZW50VGltZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXJyZW50VGltZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuc2tlbGV0b24pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNrZWxldG9uLl90aW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYW5pbUV2YWx1YXRvcikge1xuICAgICAgICAgICAgLy8gR2V0IHRoZSBsYXN0IGNsaXAncyBjdXJyZW50IHRpbWUgd2hpY2ggd2lsbCBiZSB0aGUgb25lXG4gICAgICAgICAgICAvLyB0aGF0IGlzIGN1cnJlbnRseSBiZWluZyBibGVuZGVkXG4gICAgICAgICAgICBjb25zdCBjbGlwcyA9IHRoaXMuYW5pbUV2YWx1YXRvci5jbGlwcztcbiAgICAgICAgICAgIGlmIChjbGlwcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNsaXBzW2NsaXBzLmxlbmd0aCAtIDFdLnRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGR1cmF0aW9uIGluIHNlY29uZHMgb2YgdGhlIGN1cnJlbnQgYW5pbWF0aW9uLiBSZXR1cm5zIDAgaWYgbm8gYW5pbWF0aW9uIGlzIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBkdXJhdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFuaW1hdGlvbnNbdGhpcy5jdXJyQW5pbV0uZHVyYXRpb247XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy53YXJuKGBObyBhbmltYXRpb24gaXMgcGxheWluZyB0byBnZXQgYSBkdXJhdGlvbi4gUmV0dXJuaW5nIDAuYCk7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGFuaW1hdGlvbiB3aWxsIHJlc3RhcnQgZnJvbSB0aGUgYmVnaW5uaW5nIHdoZW4gaXQgcmVhY2hlcyB0aGUgZW5kLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGxvb3AodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbG9vcCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLnNrZWxldG9uKSB7XG4gICAgICAgICAgICB0aGlzLnNrZWxldG9uLmxvb3BpbmcgPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmFuaW1FdmFsdWF0b3IpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hbmltRXZhbHVhdG9yLmNsaXBzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yLmNsaXBzW2ldLmxvb3AgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsb29wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBwbGF5aW5nIGFuIGFuaW1hdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGFuaW1hdGlvbiBhc3NldCB0byBiZWdpbiBwbGF5aW5nLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYmxlbmRUaW1lXSAtIFRoZSB0aW1lIGluIHNlY29uZHMgdG8gYmxlbmQgZnJvbSB0aGUgY3VycmVudFxuICAgICAqIGFuaW1hdGlvbiBzdGF0ZSB0byB0aGUgc3RhcnQgb2YgdGhlIGFuaW1hdGlvbiBiZWluZyBzZXQuIERlZmF1bHRzIHRvIDAuXG4gICAgICovXG4gICAgcGxheShuYW1lLCBibGVuZFRpbWUgPSAwKSB7XG4gICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuYW5pbWF0aW9uc1tuYW1lXSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYFRyeWluZyB0byBwbGF5IGFuaW1hdGlvbiAnJHtuYW1lfScgd2hpY2ggZG9lc24ndCBleGlzdGApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcmV2QW5pbSA9IHRoaXMuY3VyckFuaW07XG4gICAgICAgIHRoaXMuY3VyckFuaW0gPSBuYW1lO1xuXG4gICAgICAgIGlmICh0aGlzLm1vZGVsKSB7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5za2VsZXRvbiAmJiAhdGhpcy5hbmltRXZhbHVhdG9yKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY3JlYXRlQW5pbWF0aW9uQ29udHJvbGxlcigpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcmV2QW5pbSA9IHRoaXMuYW5pbWF0aW9uc1t0aGlzLnByZXZBbmltXTtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJBbmltID0gdGhpcy5hbmltYXRpb25zW3RoaXMuY3VyckFuaW1dO1xuXG4gICAgICAgICAgICB0aGlzLmJsZW5kaW5nID0gYmxlbmRUaW1lID4gMCAmJiAhIXRoaXMucHJldkFuaW07XG4gICAgICAgICAgICBpZiAodGhpcy5ibGVuZGluZykge1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmQgPSAwO1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmRTcGVlZCA9IDEgLyBibGVuZFRpbWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNrZWxldG9uKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQmxlbmQgZnJvbSB0aGUgY3VycmVudCB0aW1lIG9mIHRoZSBjdXJyZW50IGFuaW1hdGlvbiB0byB0aGUgc3RhcnQgb2ZcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIG5ld2x5IHNwZWNpZmllZCBhbmltYXRpb24gb3ZlciB0aGUgc3BlY2lmaWVkIGJsZW5kIHRpbWUgcGVyaW9kLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLmZyb21Ta2VsLmFuaW1hdGlvbiA9IHByZXZBbmltO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZyb21Ta2VsLmFkZFRpbWUodGhpcy5za2VsZXRvbi5fdGltZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9Ta2VsLmFuaW1hdGlvbiA9IGN1cnJBbmltO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2tlbGV0b24uYW5pbWF0aW9uID0gY3VyckFuaW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5hbmltRXZhbHVhdG9yKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYW5pbUV2YWx1YXRvciA9IHRoaXMuYW5pbUV2YWx1YXRvcjtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBhbGwgYnV0IHRoZSBsYXN0IGNsaXBcbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKGFuaW1FdmFsdWF0b3IuY2xpcHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYW5pbUV2YWx1YXRvci5yZW1vdmVDbGlwKDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yLnJlbW92ZUNsaXBzKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY2xpcCA9IG5ldyBBbmltQ2xpcCh0aGlzLmFuaW1hdGlvbnNbdGhpcy5jdXJyQW5pbV0sIDAsIDEuMCwgdHJ1ZSwgdGhpcy5sb29wKTtcbiAgICAgICAgICAgICAgICBjbGlwLm5hbWUgPSB0aGlzLmN1cnJBbmltO1xuICAgICAgICAgICAgICAgIGNsaXAuYmxlbmRXZWlnaHQgPSB0aGlzLmJsZW5kaW5nID8gMCA6IDE7XG4gICAgICAgICAgICAgICAgY2xpcC5yZXNldCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvci5hZGRDbGlwKGNsaXApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wbGF5aW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYW4gYW5pbWF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYW5pbWF0aW9uIGFzc2V0LlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2FuaW1hdGlvbi9hbmltYXRpb24uanMnKS5BbmltYXRpb259IEFuIEFuaW1hdGlvbi5cbiAgICAgKi9cbiAgICBnZXRBbmltYXRpb24obmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5hbmltYXRpb25zW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgbW9kZWwgZHJpdmVuIGJ5IHRoaXMgYW5pbWF0aW9uIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9tb2RlbC5qcycpLk1vZGVsfSBtb2RlbCAtIFRoZSBtb2RlbCB0byBzZXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldE1vZGVsKG1vZGVsKSB7XG4gICAgICAgIGlmIChtb2RlbCAhPT0gdGhpcy5tb2RlbCkge1xuICAgICAgICAgICAgLy8gcmVzZXQgYW5pbWF0aW9uIGNvbnRyb2xsZXJcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0QW5pbWF0aW9uQ29udHJvbGxlcigpO1xuXG4gICAgICAgICAgICAvLyBzZXQgdGhlIG1vZGVsXG4gICAgICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG5cbiAgICAgICAgICAgIC8vIFJlc2V0IHRoZSBjdXJyZW50IGFuaW1hdGlvbiBvbiB0aGUgbmV3IG1vZGVsXG4gICAgICAgICAgICBpZiAodGhpcy5hbmltYXRpb25zICYmIHRoaXMuY3VyckFuaW0gJiYgdGhpcy5hbmltYXRpb25zW3RoaXMuY3VyckFuaW1dKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KHRoaXMuY3VyckFuaW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRBbmltYXRpb25zKCkge1xuICAgICAgICAvLyBJZiB3ZSBoYXZlIGFuaW1hdGlvbnMgX2FuZF8gYSBtb2RlbCwgd2UgY2FuIGNyZWF0ZSB0aGUgc2tlbGV0b25zXG4gICAgICAgIGNvbnN0IG1vZGVsQ29tcG9uZW50ID0gdGhpcy5lbnRpdHkubW9kZWw7XG4gICAgICAgIGlmIChtb2RlbENvbXBvbmVudCkge1xuICAgICAgICAgICAgY29uc3QgbSA9IG1vZGVsQ29tcG9uZW50Lm1vZGVsO1xuICAgICAgICAgICAgaWYgKG0gJiYgbSAhPT0gdGhpcy5tb2RlbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TW9kZWwobSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuY3VyckFuaW0gJiYgdGhpcy5hY3RpdmF0ZSAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgLy8gU2V0IHRoZSBmaXJzdCBsb2FkZWQgYW5pbWF0aW9uIGFzIHRoZSBjdXJyZW50XG4gICAgICAgICAgICBjb25zdCBhbmltYXRpb25OYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMuX2FuaW1hdGlvbnMpO1xuICAgICAgICAgICAgaWYgKGFuaW1hdGlvbk5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBsYXkoYW5pbWF0aW9uTmFtZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3Jlc2V0QW5pbWF0aW9uQ29udHJvbGxlcigpIHtcbiAgICAgICAgdGhpcy5za2VsZXRvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuZnJvbVNrZWwgPSBudWxsO1xuICAgICAgICB0aGlzLnRvU2tlbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfY3JlYXRlQW5pbWF0aW9uQ29udHJvbGxlcigpIHtcbiAgICAgICAgY29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgICAgICBjb25zdCBhbmltYXRpb25zID0gdGhpcy5hbmltYXRpb25zO1xuXG4gICAgICAgIC8vIGNoZWNrIHdoaWNoIHR5cGUgb2YgYW5pbWF0aW9ucyBhcmUgbG9hZGVkXG4gICAgICAgIGxldCBoYXNKc29uID0gZmFsc2U7XG4gICAgICAgIGxldCBoYXNHbGIgPSBmYWxzZTtcbiAgICAgICAgZm9yIChjb25zdCBhbmltYXRpb24gaW4gYW5pbWF0aW9ucykge1xuICAgICAgICAgICAgaWYgKGFuaW1hdGlvbnMuaGFzT3duUHJvcGVydHkoYW5pbWF0aW9uKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFuaW0gPSBhbmltYXRpb25zW2FuaW1hdGlvbl07XG4gICAgICAgICAgICAgICAgaWYgKGFuaW0uY29uc3RydWN0b3IgPT09IEFuaW1UcmFjaykge1xuICAgICAgICAgICAgICAgICAgICBoYXNHbGIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc0pzb24gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyYXBoID0gbW9kZWwuZ2V0R3JhcGgoKTtcbiAgICAgICAgaWYgKGhhc0pzb24pIHtcbiAgICAgICAgICAgIHRoaXMuZnJvbVNrZWwgPSBuZXcgU2tlbGV0b24oZ3JhcGgpO1xuICAgICAgICAgICAgdGhpcy50b1NrZWwgPSBuZXcgU2tlbGV0b24oZ3JhcGgpO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbiA9IG5ldyBTa2VsZXRvbihncmFwaCk7XG4gICAgICAgICAgICB0aGlzLnNrZWxldG9uLmxvb3BpbmcgPSB0aGlzLmxvb3A7XG4gICAgICAgICAgICB0aGlzLnNrZWxldG9uLnNldEdyYXBoKGdyYXBoKTtcbiAgICAgICAgfSBlbHNlIGlmIChoYXNHbGIpIHtcbiAgICAgICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvciA9IG5ldyBBbmltRXZhbHVhdG9yKG5ldyBEZWZhdWx0QW5pbUJpbmRlcih0aGlzLmVudGl0eSkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gaWRzIC0gQXJyYXkgb2YgYW5pbWF0aW9uIGFzc2V0IGlkcy5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGxvYWRBbmltYXRpb25Bc3NldHMoaWRzKSB7XG4gICAgICAgIGlmICghaWRzIHx8ICFpZHMubGVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG5cbiAgICAgICAgY29uc3Qgb25Bc3NldFJlYWR5ID0gKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2VzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0LnJlc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNbYXNzZXQucmVzb3VyY2VzW2ldLm5hbWVdID0gYXNzZXQucmVzb3VyY2VzW2ldO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF0gPSBhc3NldC5yZXNvdXJjZXNbaV0ubmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9uc1thc3NldC5uYW1lXSA9IGFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9uc0luZGV4W2Fzc2V0LmlkXSA9IGFzc2V0Lm5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICAgICAgdGhpcy5hbmltYXRpb25zID0gdGhpcy5hbmltYXRpb25zOyAvLyBhc3NpZ25pbmcgZW5zdXJlcyBzZXRfYW5pbWF0aW9ucyBldmVudCBpcyBmaXJlZFxuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG9uQXNzZXRBZGQgPSAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5vbkFzc2V0Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5vbkFzc2V0Q2hhbmdlZCwgdGhpcyk7XG5cbiAgICAgICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG5cbiAgICAgICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgIG9uQXNzZXRSZWFkeShhc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFzc2V0Lm9uY2UoJ2xvYWQnLCBvbkFzc2V0UmVhZHksIHRoaXMpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gaWRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KGlkc1tpXSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBvbkFzc2V0QWRkKGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIGlkc1tpXSwgb25Bc3NldEFkZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgYXNzZXQgY2hhbmdlIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgY2hhbmdlZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYXR0cmlidXRlIC0gVGhlIG5hbWUgb2YgdGhlIGFzc2V0IGF0dHJpYnV0ZSB0aGF0IGNoYW5nZWQuIENhbiBiZSAnZGF0YScsXG4gICAgICogJ2ZpbGUnLCAncmVzb3VyY2UnIG9yICdyZXNvdXJjZXMnLlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBUaGUgbmV3IHZhbHVlIG9mIHRoZSBzcGVjaWZpZWQgYXNzZXQgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBvbGRWYWx1ZSAtIFRoZSBvbGQgdmFsdWUgb2YgdGhlIHNwZWNpZmllZCBhc3NldCBwcm9wZXJ0eS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uQXNzZXRDaGFuZ2VkKGFzc2V0LCBhdHRyaWJ1dGUsIG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICBpZiAoYXR0cmlidXRlID09PSAncmVzb3VyY2UnIHx8IGF0dHJpYnV0ZSA9PT0gJ3Jlc291cmNlcycpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZSBhdHRyaWJ1dGUgaXMgJ3Jlc291cmNlcycsIG5ld1ZhbHVlIGNhbiBiZSBhbiBlbXB0eSBhcnJheSB3aGVuIHRoZVxuICAgICAgICAgICAgLy8gYXNzZXQgaXMgdW5sb2FkZWQuIFRoZXJlZm9yZSwgd2Ugc2hvdWxkIGFzc2lnbiBudWxsIGluIHRoaXMgY2FzZVxuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZSA9PT0gJ3Jlc291cmNlcycgJiYgbmV3VmFsdWUgJiYgbmV3VmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZXBsYWNlIG9sZCBhbmltYXRpb24gd2l0aCBuZXcgb25lXG4gICAgICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzdGFydGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKG5ld1ZhbHVlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9sZFZhbHVlICYmIG9sZFZhbHVlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5hbmltYXRpb25zW29sZFZhbHVlW2ldLm5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc1thc3NldC5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXN0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hbmltYXRpb25zW25ld1ZhbHVlW2ldLm5hbWVdID0gbmV3VmFsdWVbaV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmVzdGFydGVkICYmIHRoaXMuY3VyckFuaW0gPT09IG5ld1ZhbHVlW2ldLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZXN0YXJ0IGFuaW1hdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXlpbmcgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdGFydGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5KG5ld1ZhbHVlW2ldLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlc3RhcnRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RvcEN1cnJlbnRBbmltYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25TZXRBbmltYXRpb25zKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAob2xkVmFsdWUgJiYgb2xkVmFsdWUubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvbGRWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbb2xkVmFsdWVbaV0ubmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNbYXNzZXQubmFtZV0gPSBuZXdWYWx1ZVswXSB8fCBuZXdWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdGFydGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJBbmltID09PSBhc3NldC5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZXN0YXJ0IGFuaW1hdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWluZyAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5KGFzc2V0Lm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVzdGFydGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9wQ3VycmVudEFuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vblNldEFuaW1hdGlvbnMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF0gPSBhc3NldC5uYW1lO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAob2xkVmFsdWUubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9sZFZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5hbmltYXRpb25zW29sZFZhbHVlW2ldLm5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0gPT09IG9sZFZhbHVlW2ldLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9wQ3VycmVudEFuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc1thc3NldC5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0gPT09IGFzc2V0Lm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3N0b3BDdXJyZW50QW5pbWF0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc0luZGV4W2Fzc2V0LmlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgd2FzIHJlbW92ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkFzc2V0UmVtb3ZlZChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0aGlzLmFuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChhc3NldC5yZXNvdXJjZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXNzZXQucmVzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbYXNzZXQucmVzb3VyY2VzW2ldLm5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyQW5pbSA9PT0gYXNzZXQucmVzb3VyY2VzW2ldLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9wQ3VycmVudEFuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc1thc3NldC5uYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyQW5pbSA9PT0gYXNzZXQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RvcEN1cnJlbnRBbmltYXRpb24oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc3RvcEN1cnJlbnRBbmltYXRpb24oKSB7XG4gICAgICAgIHRoaXMuY3VyckFuaW0gPSBudWxsO1xuXG4gICAgICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5za2VsZXRvbikge1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgICAgICB0aGlzLnNrZWxldG9uLmFuaW1hdGlvbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuYW5pbUV2YWx1YXRvcikge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFuaW1FdmFsdWF0b3IuY2xpcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IuY2xpcHNbaV0uc3RvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yLnVwZGF0ZSgwKTtcbiAgICAgICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvci5yZW1vdmVDbGlwcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIHN1cGVyLm9uRW5hYmxlKCk7XG5cbiAgICAgICAgLy8gbG9hZCBhc3NldHMgaWYgdGhleSdyZSBub3QgbG9hZGVkXG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuYXNzZXRzO1xuICAgICAgICBjb25zdCByZWdpc3RyeSA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGlmIChhc3NldHMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhc3NldHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsZXQgYXNzZXQgPSBhc3NldHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKCEoYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkpXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gcmVnaXN0cnkuZ2V0KGFzc2V0KTtcblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCAmJiAhYXNzZXQucmVzb3VyY2UpXG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJ5LmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYWN0aXZhdGUgJiYgIXRoaXMuY3VyckFuaW0pIHtcbiAgICAgICAgICAgIGNvbnN0IGFuaW1hdGlvbk5hbWVzID0gT2JqZWN0LmtleXModGhpcy5hbmltYXRpb25zKTtcbiAgICAgICAgICAgIGlmIChhbmltYXRpb25OYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGFuaW1hdGlvbk5hbWVzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYXNzZXRzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8vIHRoaXMuYXNzZXRzIGNhbiBiZSBhbiBhcnJheSBvZiBwYy5Bc3NldHMgb3IgYW4gYXJyYXkgb2YgbnVtYmVycyAoYXNzZXRJZHMpXG4gICAgICAgICAgICBsZXQgYXNzZXQgPSB0aGlzLmFzc2V0c1tpXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYXNzZXQgPT09ICAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWFzc2V0KSBjb250aW51ZTtcblxuICAgICAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLm9uQXNzZXRDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNrZWxldG9uID0gbnVsbDtcbiAgICAgICAgdGhpcy5mcm9tU2tlbCA9IG51bGw7XG4gICAgICAgIHRoaXMudG9Ta2VsID0gbnVsbDtcblxuICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSB0aGUgc3RhdGUgb2YgdGhlIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGRlbHRhLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgLy8gdXBkYXRlIGJsZW5kaW5nXG4gICAgICAgIGlmICh0aGlzLmJsZW5kaW5nKSB7XG4gICAgICAgICAgICB0aGlzLmJsZW5kICs9IGR0ICogdGhpcy5ibGVuZFNwZWVkO1xuICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmQgPj0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmQgPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIHNrZWxldG9uXG4gICAgICAgIGlmICh0aGlzLnBsYXlpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IHNrZWxldG9uID0gdGhpcy5za2VsZXRvbjtcbiAgICAgICAgICAgIGlmIChza2VsZXRvbiAhPT0gbnVsbCAmJiB0aGlzLm1vZGVsICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tlbGV0b24uYmxlbmQodGhpcy5mcm9tU2tlbCwgdGhpcy50b1NrZWwsIHRoaXMuYmxlbmQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFkdmFuY2UgdGhlIGFuaW1hdGlvbiwgaW50ZXJwb2xhdGluZyBrZXlmcmFtZXMgYXQgZWFjaCBhbmltYXRlZCBub2RlIGluXG4gICAgICAgICAgICAgICAgICAgIC8vIHNrZWxldG9uXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlbHRhID0gZHQgKiB0aGlzLnNwZWVkO1xuICAgICAgICAgICAgICAgICAgICBza2VsZXRvbi5hZGRUaW1lKGRlbHRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuc3BlZWQgPiAwICYmIChza2VsZXRvbi5fdGltZSA9PT0gc2tlbGV0b24uYW5pbWF0aW9uLmR1cmF0aW9uKSAmJiAhdGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNwZWVkIDwgMCAmJiBza2VsZXRvbi5fdGltZSA9PT0gMCAmJiAhdGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsZW5kaW5nICYmICh0aGlzLmJsZW5kID09PSAxKSkge1xuICAgICAgICAgICAgICAgICAgICBza2VsZXRvbi5hbmltYXRpb24gPSB0aGlzLnRvU2tlbC5hbmltYXRpb247XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc2tlbGV0b24udXBkYXRlR3JhcGgoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBhbmltIGNvbnRyb2xsZXJcbiAgICAgICAgY29uc3QgYW5pbUV2YWx1YXRvciA9IHRoaXMuYW5pbUV2YWx1YXRvcjtcbiAgICAgICAgaWYgKGFuaW1FdmFsdWF0b3IpIHtcblxuICAgICAgICAgICAgLy8gZm9yY2UgYWxsIGNsaXBzJyBzcGVlZCBhbmQgcGxheWluZyBzdGF0ZSBmcm9tIHRoZSBjb21wb25lbnRcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYW5pbUV2YWx1YXRvci5jbGlwcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNsaXAgPSBhbmltRXZhbHVhdG9yLmNsaXBzW2ldO1xuICAgICAgICAgICAgICAgIGNsaXAuc3BlZWQgPSB0aGlzLnNwZWVkO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5wbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsaXAucGF1c2UoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjbGlwLnJlc3VtZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIGJsZW5kIHdlaWdodFxuICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcgJiYgYW5pbUV2YWx1YXRvci5jbGlwcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgYW5pbUV2YWx1YXRvci5jbGlwc1sxXS5ibGVuZFdlaWdodCA9IHRoaXMuYmxlbmQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFuaW1FdmFsdWF0b3IudXBkYXRlKGR0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGJsZW5kaW5nIGZsYWdcbiAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcgJiYgdGhpcy5ibGVuZCA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5ibGVuZGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltYXRpb25Db21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJBbmltYXRpb25Db21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9hbmltYXRpb25zIiwiX2Fzc2V0cyIsIl9sb29wIiwiYW5pbUV2YWx1YXRvciIsIm1vZGVsIiwic2tlbGV0b24iLCJmcm9tU2tlbCIsInRvU2tlbCIsImFuaW1hdGlvbnNJbmRleCIsInByZXZBbmltIiwiY3VyckFuaW0iLCJibGVuZCIsImJsZW5kaW5nIiwiYmxlbmRTcGVlZCIsImFjdGl2YXRlIiwic3BlZWQiLCJhbmltYXRpb25zIiwidmFsdWUiLCJvblNldEFuaW1hdGlvbnMiLCJhc3NldHMiLCJsZW5ndGgiLCJpIiwiYXNzZXQiLCJhcHAiLCJnZXQiLCJvZmYiLCJvbkFzc2V0Q2hhbmdlZCIsIm9uQXNzZXRSZW1vdmVkIiwiYW5pbU5hbWUiLCJpZCIsIl9zdG9wQ3VycmVudEFuaW1hdGlvbiIsImFzc2V0SWRzIiwibWFwIiwiQXNzZXQiLCJsb2FkQW5pbWF0aW9uQXNzZXRzIiwiY3VycmVudFRpbWUiLCJhZGRUaW1lIiwidXBkYXRlR3JhcGgiLCJjbGlwcyIsInRpbWUiLCJfdGltZSIsImR1cmF0aW9uIiwiRGVidWciLCJ3YXJuIiwibG9vcCIsImxvb3BpbmciLCJwbGF5IiwibmFtZSIsImJsZW5kVGltZSIsImVuYWJsZWQiLCJlcnJvciIsIl9jcmVhdGVBbmltYXRpb25Db250cm9sbGVyIiwiYW5pbWF0aW9uIiwicmVtb3ZlQ2xpcCIsInJlbW92ZUNsaXBzIiwiY2xpcCIsIkFuaW1DbGlwIiwiYmxlbmRXZWlnaHQiLCJyZXNldCIsImFkZENsaXAiLCJwbGF5aW5nIiwiZ2V0QW5pbWF0aW9uIiwic2V0TW9kZWwiLCJfcmVzZXRBbmltYXRpb25Db250cm9sbGVyIiwibW9kZWxDb21wb25lbnQiLCJtIiwiYW5pbWF0aW9uTmFtZXMiLCJPYmplY3QiLCJrZXlzIiwiaGFzSnNvbiIsImhhc0dsYiIsImhhc093blByb3BlcnR5IiwiYW5pbSIsIkFuaW1UcmFjayIsImdyYXBoIiwiZ2V0R3JhcGgiLCJTa2VsZXRvbiIsInNldEdyYXBoIiwiQW5pbUV2YWx1YXRvciIsIkRlZmF1bHRBbmltQmluZGVyIiwiaWRzIiwib25Bc3NldFJlYWR5IiwicmVzb3VyY2VzIiwicmVzb3VyY2UiLCJvbkFzc2V0QWRkIiwib24iLCJvbmNlIiwibG9hZCIsImwiLCJhdHRyaWJ1dGUiLCJuZXdWYWx1ZSIsIm9sZFZhbHVlIiwicmVzdGFydGVkIiwic3RvcCIsInVwZGF0ZSIsIm9uRW5hYmxlIiwicmVnaXN0cnkiLCJsZW4iLCJvbkJlZm9yZVJlbW92ZSIsImR0IiwiZGVsdGEiLCJwYXVzZSIsInJlc3VtZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsa0JBQWtCLFNBQVNDLFNBQVMsQ0FBQztBQUN2QztBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTs7QUFHQTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7O0FBR0E7O0FBR0E7O0FBR0E7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFO0FBQUU7QUFDMUIsSUFBQSxLQUFLLENBQUNELE1BQU0sRUFBRUMsTUFBTSxDQUFDLENBQUE7SUFBQyxJQTlGMUJDLENBQUFBLFdBQVcsR0FBRyxFQUFFLENBQUE7SUFBQSxJQU1oQkMsQ0FBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQTtJQUFBLElBR1pDLENBQUFBLEtBQUssR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1aQyxDQUFBQSxhQUFhLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFNcEJDLENBQUFBLEtBQUssR0FBRyxJQUFJLENBQUE7SUFBQSxJQVFaQyxDQUFBQSxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFNZkMsQ0FBQUEsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUFBLElBTWZDLENBQUFBLE1BQU0sR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1iQyxDQUFBQSxlQUFlLEdBQUcsRUFBRSxDQUFBO0lBQUEsSUFNcEJDLENBQUFBLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1mQyxDQUFBQSxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFHZkMsQ0FBQUEsS0FBSyxHQUFHLENBQUMsQ0FBQTtJQUFBLElBR1RDLENBQUFBLFFBQVEsR0FBRyxLQUFLLENBQUE7SUFBQSxJQUdoQkMsQ0FBQUEsVUFBVSxHQUFHLENBQUMsQ0FBQTtJQUFBLElBT2RDLENBQUFBLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFBQSxJQVFmQyxDQUFBQSxLQUFLLEdBQUcsQ0FBQyxDQUFBO0FBWVQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsVUFBVSxDQUFDQyxLQUFLLEVBQUU7SUFDbEIsSUFBSSxDQUFDakIsV0FBVyxHQUFHaUIsS0FBSyxDQUFBO0lBRXhCLElBQUksQ0FBQ0MsZUFBZSxFQUFFLENBQUE7QUFDMUIsR0FBQTtBQUVBLEVBQUEsSUFBSUYsVUFBVSxHQUFHO0lBQ2IsT0FBTyxJQUFJLENBQUNoQixXQUFXLENBQUE7QUFDM0IsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSW1CLE1BQU0sQ0FBQ0YsS0FBSyxFQUFFO0FBQ2QsSUFBQSxNQUFNRSxNQUFNLEdBQUcsSUFBSSxDQUFDbEIsT0FBTyxDQUFBO0FBRTNCLElBQUEsSUFBSWtCLE1BQU0sSUFBSUEsTUFBTSxDQUFDQyxNQUFNLEVBQUU7QUFDekIsTUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0YsTUFBTSxDQUFDQyxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO0FBQ3BDO0FBQ0EsUUFBQSxJQUFJRixNQUFNLENBQUNFLENBQUMsQ0FBQyxFQUFFO0FBQ1gsVUFBQSxNQUFNQyxLQUFLLEdBQUcsSUFBSSxDQUFDeEIsTUFBTSxDQUFDeUIsR0FBRyxDQUFDSixNQUFNLENBQUNLLEdBQUcsQ0FBQ0wsTUFBTSxDQUFDRSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ25ELFVBQUEsSUFBSUMsS0FBSyxFQUFFO1lBQ1BBLEtBQUssQ0FBQ0csR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQTtZQUM5Q0osS0FBSyxDQUFDRyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ0UsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO1lBRTlDLE1BQU1DLFFBQVEsR0FBRyxJQUFJLENBQUNwQixlQUFlLENBQUNjLEtBQUssQ0FBQ08sRUFBRSxDQUFDLENBQUE7WUFFL0MsSUFBSSxJQUFJLENBQUNuQixRQUFRLEtBQUtrQixRQUFRLEVBQzFCLElBQUksQ0FBQ0UscUJBQXFCLEVBQUUsQ0FBQTtBQUVoQyxZQUFBLE9BQU8sSUFBSSxDQUFDZCxVQUFVLENBQUNZLFFBQVEsQ0FBQyxDQUFBO0FBQ2hDLFlBQUEsT0FBTyxJQUFJLENBQUNwQixlQUFlLENBQUNjLEtBQUssQ0FBQ08sRUFBRSxDQUFDLENBQUE7QUFDekMsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtJQUVBLElBQUksQ0FBQzVCLE9BQU8sR0FBR2dCLEtBQUssQ0FBQTtBQUVwQixJQUFBLE1BQU1jLFFBQVEsR0FBR2QsS0FBSyxDQUFDZSxHQUFHLENBQUVmLEtBQUssSUFBSztNQUNsQyxPQUFRQSxLQUFLLFlBQVlnQixLQUFLLEdBQUloQixLQUFLLENBQUNZLEVBQUUsR0FBR1osS0FBSyxDQUFBO0FBQ3RELEtBQUMsQ0FBQyxDQUFBO0FBRUYsSUFBQSxJQUFJLENBQUNpQixtQkFBbUIsQ0FBQ0gsUUFBUSxDQUFDLENBQUE7QUFDdEMsR0FBQTtBQUVBLEVBQUEsSUFBSVosTUFBTSxHQUFHO0lBQ1QsT0FBTyxJQUFJLENBQUNsQixPQUFPLENBQUE7QUFDdkIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSWtDLFdBQVcsQ0FBQ0EsV0FBVyxFQUFFO0lBQ3pCLElBQUksSUFBSSxDQUFDOUIsUUFBUSxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUNBLFFBQVEsQ0FBQzhCLFdBQVcsR0FBR0EsV0FBVyxDQUFBO0FBQ3ZDLE1BQUEsSUFBSSxDQUFDOUIsUUFBUSxDQUFDK0IsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3hCLE1BQUEsSUFBSSxDQUFDL0IsUUFBUSxDQUFDZ0MsV0FBVyxFQUFFLENBQUE7QUFDL0IsS0FBQTtJQUVBLElBQUksSUFBSSxDQUFDbEMsYUFBYSxFQUFFO0FBQ3BCLE1BQUEsTUFBTW1DLEtBQUssR0FBRyxJQUFJLENBQUNuQyxhQUFhLENBQUNtQyxLQUFLLENBQUE7QUFDdEMsTUFBQSxLQUFLLElBQUlqQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdpQixLQUFLLENBQUNsQixNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO0FBQ25DaUIsUUFBQUEsS0FBSyxDQUFDakIsQ0FBQyxDQUFDLENBQUNrQixJQUFJLEdBQUdKLFdBQVcsQ0FBQTtBQUMvQixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUlBLFdBQVcsR0FBRztJQUNkLElBQUksSUFBSSxDQUFDOUIsUUFBUSxFQUFFO0FBQ2YsTUFBQSxPQUFPLElBQUksQ0FBQ0EsUUFBUSxDQUFDbUMsS0FBSyxDQUFBO0FBQzlCLEtBQUE7SUFFQSxJQUFJLElBQUksQ0FBQ3JDLGFBQWEsRUFBRTtBQUNwQjtBQUNBO0FBQ0EsTUFBQSxNQUFNbUMsS0FBSyxHQUFHLElBQUksQ0FBQ25DLGFBQWEsQ0FBQ21DLEtBQUssQ0FBQTtBQUN0QyxNQUFBLElBQUlBLEtBQUssQ0FBQ2xCLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDbEIsT0FBT2tCLEtBQUssQ0FBQ0EsS0FBSyxDQUFDbEIsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDbUIsSUFBSSxDQUFBO0FBQ3ZDLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPLENBQUMsQ0FBQTtBQUNaLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJLEVBQUEsSUFBSUUsUUFBUSxHQUFHO0lBQ1gsSUFBSSxJQUFJLENBQUMvQixRQUFRLEVBQUU7TUFDZixPQUFPLElBQUksQ0FBQ00sVUFBVSxDQUFDLElBQUksQ0FBQ04sUUFBUSxDQUFDLENBQUMrQixRQUFRLENBQUE7QUFDbEQsS0FBQTtBQUVBQyxJQUFBQSxLQUFLLENBQUNDLElBQUksQ0FBRSxDQUFBLHVEQUFBLENBQXdELENBQUMsQ0FBQTtBQUNyRSxJQUFBLE9BQU8sQ0FBQyxDQUFBO0FBQ1osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsSUFBSSxDQUFDM0IsS0FBSyxFQUFFO0lBQ1osSUFBSSxDQUFDZixLQUFLLEdBQUdlLEtBQUssQ0FBQTtJQUVsQixJQUFJLElBQUksQ0FBQ1osUUFBUSxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUNBLFFBQVEsQ0FBQ3dDLE9BQU8sR0FBRzVCLEtBQUssQ0FBQTtBQUNqQyxLQUFBO0lBRUEsSUFBSSxJQUFJLENBQUNkLGFBQWEsRUFBRTtBQUNwQixNQUFBLEtBQUssSUFBSWtCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNsQixhQUFhLENBQUNtQyxLQUFLLENBQUNsQixNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO1FBQ3RELElBQUksQ0FBQ2xCLGFBQWEsQ0FBQ21DLEtBQUssQ0FBQ2pCLENBQUMsQ0FBQyxDQUFDdUIsSUFBSSxHQUFHM0IsS0FBSyxDQUFBO0FBQzVDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSTJCLElBQUksR0FBRztJQUNQLE9BQU8sSUFBSSxDQUFDMUMsS0FBSyxDQUFBO0FBQ3JCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTRDLEVBQUFBLElBQUksQ0FBQ0MsSUFBSSxFQUFFQyxTQUFTLEdBQUcsQ0FBQyxFQUFFO0lBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUNDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQ2xELE1BQU0sQ0FBQ2tELE9BQU8sRUFBRTtBQUN2QyxNQUFBLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDakMsVUFBVSxDQUFDK0IsSUFBSSxDQUFDLEVBQUU7QUFDeEJMLE1BQUFBLEtBQUssQ0FBQ1EsS0FBSyxDQUFFLENBQTRCSCwwQkFBQUEsRUFBQUEsSUFBSyx1QkFBc0IsQ0FBQyxDQUFBO0FBQ3JFLE1BQUEsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ3RDLFFBQVEsR0FBRyxJQUFJLENBQUNDLFFBQVEsQ0FBQTtJQUM3QixJQUFJLENBQUNBLFFBQVEsR0FBR3FDLElBQUksQ0FBQTtJQUVwQixJQUFJLElBQUksQ0FBQzNDLEtBQUssRUFBRTtNQUVaLElBQUksQ0FBQyxJQUFJLENBQUNDLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQ0YsYUFBYSxFQUFFO1FBQ3ZDLElBQUksQ0FBQ2dELDBCQUEwQixFQUFFLENBQUE7QUFDckMsT0FBQTtNQUVBLE1BQU0xQyxRQUFRLEdBQUcsSUFBSSxDQUFDTyxVQUFVLENBQUMsSUFBSSxDQUFDUCxRQUFRLENBQUMsQ0FBQTtNQUMvQyxNQUFNQyxRQUFRLEdBQUcsSUFBSSxDQUFDTSxVQUFVLENBQUMsSUFBSSxDQUFDTixRQUFRLENBQUMsQ0FBQTtNQUUvQyxJQUFJLENBQUNFLFFBQVEsR0FBR29DLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQ3ZDLFFBQVEsQ0FBQTtNQUNoRCxJQUFJLElBQUksQ0FBQ0csUUFBUSxFQUFFO1FBQ2YsSUFBSSxDQUFDRCxLQUFLLEdBQUcsQ0FBQyxDQUFBO0FBQ2QsUUFBQSxJQUFJLENBQUNFLFVBQVUsR0FBRyxDQUFDLEdBQUdtQyxTQUFTLENBQUE7QUFDbkMsT0FBQTtNQUVBLElBQUksSUFBSSxDQUFDM0MsUUFBUSxFQUFFO1FBQ2YsSUFBSSxJQUFJLENBQUNPLFFBQVEsRUFBRTtBQUNmO0FBQ0E7QUFDQSxVQUFBLElBQUksQ0FBQ04sUUFBUSxDQUFDOEMsU0FBUyxHQUFHM0MsUUFBUSxDQUFBO1VBQ2xDLElBQUksQ0FBQ0gsUUFBUSxDQUFDOEIsT0FBTyxDQUFDLElBQUksQ0FBQy9CLFFBQVEsQ0FBQ21DLEtBQUssQ0FBQyxDQUFBO0FBQzFDLFVBQUEsSUFBSSxDQUFDakMsTUFBTSxDQUFDNkMsU0FBUyxHQUFHMUMsUUFBUSxDQUFBO0FBQ3BDLFNBQUMsTUFBTTtBQUNILFVBQUEsSUFBSSxDQUFDTCxRQUFRLENBQUMrQyxTQUFTLEdBQUcxQyxRQUFRLENBQUE7QUFDdEMsU0FBQTtBQUNKLE9BQUE7TUFFQSxJQUFJLElBQUksQ0FBQ1AsYUFBYSxFQUFFO0FBQ3BCLFFBQUEsTUFBTUEsYUFBYSxHQUFHLElBQUksQ0FBQ0EsYUFBYSxDQUFBO1FBRXhDLElBQUksSUFBSSxDQUFDUyxRQUFRLEVBQUU7QUFDZjtBQUNBLFVBQUEsT0FBT1QsYUFBYSxDQUFDbUMsS0FBSyxDQUFDbEIsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUNuQ2pCLFlBQUFBLGFBQWEsQ0FBQ2tELFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvQixXQUFBO0FBQ0osU0FBQyxNQUFNO0FBQ0gsVUFBQSxJQUFJLENBQUNsRCxhQUFhLENBQUNtRCxXQUFXLEVBQUUsQ0FBQTtBQUNwQyxTQUFBO1FBRUEsTUFBTUMsSUFBSSxHQUFHLElBQUlDLFFBQVEsQ0FBQyxJQUFJLENBQUN4QyxVQUFVLENBQUMsSUFBSSxDQUFDTixRQUFRLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUNrQyxJQUFJLENBQUMsQ0FBQTtBQUNsRlcsUUFBQUEsSUFBSSxDQUFDUixJQUFJLEdBQUcsSUFBSSxDQUFDckMsUUFBUSxDQUFBO1FBQ3pCNkMsSUFBSSxDQUFDRSxXQUFXLEdBQUcsSUFBSSxDQUFDN0MsUUFBUSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUE7UUFDeEMyQyxJQUFJLENBQUNHLEtBQUssRUFBRSxDQUFBO0FBQ1osUUFBQSxJQUFJLENBQUN2RCxhQUFhLENBQUN3RCxPQUFPLENBQUNKLElBQUksQ0FBQyxDQUFBO0FBQ3BDLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSSxDQUFDSyxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFlBQVksQ0FBQ2QsSUFBSSxFQUFFO0FBQ2YsSUFBQSxPQUFPLElBQUksQ0FBQy9CLFVBQVUsQ0FBQytCLElBQUksQ0FBQyxDQUFBO0FBQ2hDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0llLFFBQVEsQ0FBQzFELEtBQUssRUFBRTtBQUNaLElBQUEsSUFBSUEsS0FBSyxLQUFLLElBQUksQ0FBQ0EsS0FBSyxFQUFFO0FBQ3RCO01BQ0EsSUFBSSxDQUFDMkQseUJBQXlCLEVBQUUsQ0FBQTs7QUFFaEM7TUFDQSxJQUFJLENBQUMzRCxLQUFLLEdBQUdBLEtBQUssQ0FBQTs7QUFFbEI7QUFDQSxNQUFBLElBQUksSUFBSSxDQUFDWSxVQUFVLElBQUksSUFBSSxDQUFDTixRQUFRLElBQUksSUFBSSxDQUFDTSxVQUFVLENBQUMsSUFBSSxDQUFDTixRQUFRLENBQUMsRUFBRTtBQUNwRSxRQUFBLElBQUksQ0FBQ29DLElBQUksQ0FBQyxJQUFJLENBQUNwQyxRQUFRLENBQUMsQ0FBQTtBQUM1QixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQVEsRUFBQUEsZUFBZSxHQUFHO0FBQ2Q7QUFDQSxJQUFBLE1BQU04QyxjQUFjLEdBQUcsSUFBSSxDQUFDakUsTUFBTSxDQUFDSyxLQUFLLENBQUE7QUFDeEMsSUFBQSxJQUFJNEQsY0FBYyxFQUFFO0FBQ2hCLE1BQUEsTUFBTUMsQ0FBQyxHQUFHRCxjQUFjLENBQUM1RCxLQUFLLENBQUE7QUFDOUIsTUFBQSxJQUFJNkQsQ0FBQyxJQUFJQSxDQUFDLEtBQUssSUFBSSxDQUFDN0QsS0FBSyxFQUFFO0FBQ3ZCLFFBQUEsSUFBSSxDQUFDMEQsUUFBUSxDQUFDRyxDQUFDLENBQUMsQ0FBQTtBQUNwQixPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3ZELFFBQVEsSUFBSSxJQUFJLENBQUNJLFFBQVEsSUFBSSxJQUFJLENBQUNtQyxPQUFPLElBQUksSUFBSSxDQUFDbEQsTUFBTSxDQUFDa0QsT0FBTyxFQUFFO0FBQ3hFO01BQ0EsTUFBTWlCLGNBQWMsR0FBR0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsSUFBSSxDQUFDcEUsV0FBVyxDQUFDLENBQUE7QUFDcEQsTUFBQSxJQUFJa0UsY0FBYyxDQUFDOUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUMzQixRQUFBLElBQUksQ0FBQzBCLElBQUksQ0FBQ29CLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2hDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNBSCxFQUFBQSx5QkFBeUIsR0FBRztJQUN4QixJQUFJLENBQUMxRCxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNwQixJQUFJLENBQUNDLE1BQU0sR0FBRyxJQUFJLENBQUE7SUFFbEIsSUFBSSxDQUFDSixhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDQWdELEVBQUFBLDBCQUEwQixHQUFHO0FBQ3pCLElBQUEsTUFBTS9DLEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQTtBQUN4QixJQUFBLE1BQU1ZLFVBQVUsR0FBRyxJQUFJLENBQUNBLFVBQVUsQ0FBQTs7QUFFbEM7SUFDQSxJQUFJcUQsT0FBTyxHQUFHLEtBQUssQ0FBQTtJQUNuQixJQUFJQyxNQUFNLEdBQUcsS0FBSyxDQUFBO0FBQ2xCLElBQUEsS0FBSyxNQUFNbEIsU0FBUyxJQUFJcEMsVUFBVSxFQUFFO0FBQ2hDLE1BQUEsSUFBSUEsVUFBVSxDQUFDdUQsY0FBYyxDQUFDbkIsU0FBUyxDQUFDLEVBQUU7QUFDdEMsUUFBQSxNQUFNb0IsSUFBSSxHQUFHeEQsVUFBVSxDQUFDb0MsU0FBUyxDQUFDLENBQUE7QUFDbEMsUUFBQSxJQUFJb0IsSUFBSSxDQUFDM0UsV0FBVyxLQUFLNEUsU0FBUyxFQUFFO0FBQ2hDSCxVQUFBQSxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBQ2pCLFNBQUMsTUFBTTtBQUNIRCxVQUFBQSxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ2xCLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsTUFBTUssS0FBSyxHQUFHdEUsS0FBSyxDQUFDdUUsUUFBUSxFQUFFLENBQUE7QUFDOUIsSUFBQSxJQUFJTixPQUFPLEVBQUU7QUFDVCxNQUFBLElBQUksQ0FBQy9ELFFBQVEsR0FBRyxJQUFJc0UsUUFBUSxDQUFDRixLQUFLLENBQUMsQ0FBQTtBQUNuQyxNQUFBLElBQUksQ0FBQ25FLE1BQU0sR0FBRyxJQUFJcUUsUUFBUSxDQUFDRixLQUFLLENBQUMsQ0FBQTtBQUNqQyxNQUFBLElBQUksQ0FBQ3JFLFFBQVEsR0FBRyxJQUFJdUUsUUFBUSxDQUFDRixLQUFLLENBQUMsQ0FBQTtBQUNuQyxNQUFBLElBQUksQ0FBQ3JFLFFBQVEsQ0FBQ3dDLE9BQU8sR0FBRyxJQUFJLENBQUNELElBQUksQ0FBQTtBQUNqQyxNQUFBLElBQUksQ0FBQ3ZDLFFBQVEsQ0FBQ3dFLFFBQVEsQ0FBQ0gsS0FBSyxDQUFDLENBQUE7S0FDaEMsTUFBTSxJQUFJSixNQUFNLEVBQUU7QUFDZixNQUFBLElBQUksQ0FBQ25FLGFBQWEsR0FBRyxJQUFJMkUsYUFBYSxDQUFDLElBQUlDLGlCQUFpQixDQUFDLElBQUksQ0FBQ2hGLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDOUUsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7RUFDSW1DLG1CQUFtQixDQUFDOEMsR0FBRyxFQUFFO0FBQ3JCLElBQUEsSUFBSSxDQUFDQSxHQUFHLElBQUksQ0FBQ0EsR0FBRyxDQUFDNUQsTUFBTSxFQUNuQixPQUFBO0lBRUosTUFBTUQsTUFBTSxHQUFHLElBQUksQ0FBQ3JCLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ0osTUFBTSxDQUFBO0lBRXJDLE1BQU04RCxZQUFZLEdBQUkzRCxLQUFLLElBQUs7QUFDNUIsTUFBQSxJQUFJQSxLQUFLLENBQUM0RCxTQUFTLENBQUM5RCxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQzVCLFFBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdDLEtBQUssQ0FBQzRELFNBQVMsQ0FBQzlELE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFDN0MsVUFBQSxJQUFJLENBQUNMLFVBQVUsQ0FBQ00sS0FBSyxDQUFDNEQsU0FBUyxDQUFDN0QsQ0FBQyxDQUFDLENBQUMwQixJQUFJLENBQUMsR0FBR3pCLEtBQUssQ0FBQzRELFNBQVMsQ0FBQzdELENBQUMsQ0FBQyxDQUFBO0FBQzdELFVBQUEsSUFBSSxDQUFDYixlQUFlLENBQUNjLEtBQUssQ0FBQ08sRUFBRSxDQUFDLEdBQUdQLEtBQUssQ0FBQzRELFNBQVMsQ0FBQzdELENBQUMsQ0FBQyxDQUFDMEIsSUFBSSxDQUFBO0FBQzVELFNBQUE7QUFDSixPQUFDLE1BQU07UUFDSCxJQUFJLENBQUMvQixVQUFVLENBQUNNLEtBQUssQ0FBQ3lCLElBQUksQ0FBQyxHQUFHekIsS0FBSyxDQUFDNkQsUUFBUSxDQUFBO1FBQzVDLElBQUksQ0FBQzNFLGVBQWUsQ0FBQ2MsS0FBSyxDQUFDTyxFQUFFLENBQUMsR0FBR1AsS0FBSyxDQUFDeUIsSUFBSSxDQUFBO0FBQy9DLE9BQUE7QUFDQTtBQUNBLE1BQUEsSUFBSSxDQUFDL0IsVUFBVSxHQUFHLElBQUksQ0FBQ0EsVUFBVSxDQUFDO0FBQ2xDO0tBQ0gsQ0FBQTs7SUFFRCxNQUFNb0UsVUFBVSxHQUFJOUQsS0FBSyxJQUFLO01BQzFCQSxLQUFLLENBQUNHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUE7TUFDOUNKLEtBQUssQ0FBQytELEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDM0QsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO01BRTdDSixLQUFLLENBQUNHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDRSxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUE7TUFDOUNMLEtBQUssQ0FBQytELEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDMUQsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO01BRTdDLElBQUlMLEtBQUssQ0FBQzZELFFBQVEsRUFBRTtRQUNoQkYsWUFBWSxDQUFDM0QsS0FBSyxDQUFDLENBQUE7QUFDdkIsT0FBQyxNQUFNO1FBQ0hBLEtBQUssQ0FBQ2dFLElBQUksQ0FBQyxNQUFNLEVBQUVMLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN0QyxRQUFBLElBQUksSUFBSSxDQUFDaEMsT0FBTyxJQUFJLElBQUksQ0FBQ2xELE1BQU0sQ0FBQ2tELE9BQU8sRUFDbkM5QixNQUFNLENBQUNvRSxJQUFJLENBQUNqRSxLQUFLLENBQUMsQ0FBQTtBQUMxQixPQUFBO0tBQ0gsQ0FBQTtBQUVELElBQUEsS0FBSyxJQUFJRCxDQUFDLEdBQUcsQ0FBQyxFQUFFbUUsQ0FBQyxHQUFHUixHQUFHLENBQUM1RCxNQUFNLEVBQUVDLENBQUMsR0FBR21FLENBQUMsRUFBRW5FLENBQUMsRUFBRSxFQUFFO01BQ3hDLE1BQU1DLEtBQUssR0FBR0gsTUFBTSxDQUFDSyxHQUFHLENBQUN3RCxHQUFHLENBQUMzRCxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2hDLE1BQUEsSUFBSUMsS0FBSyxFQUFFO1FBQ1A4RCxVQUFVLENBQUM5RCxLQUFLLENBQUMsQ0FBQTtBQUNyQixPQUFDLE1BQU07UUFDSEgsTUFBTSxDQUFDa0UsRUFBRSxDQUFDLE1BQU0sR0FBR0wsR0FBRyxDQUFDM0QsQ0FBQyxDQUFDLEVBQUUrRCxVQUFVLENBQUMsQ0FBQTtBQUMxQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSTFELGNBQWMsQ0FBQ0osS0FBSyxFQUFFbUUsU0FBUyxFQUFFQyxRQUFRLEVBQUVDLFFBQVEsRUFBRTtBQUNqRCxJQUFBLElBQUlGLFNBQVMsS0FBSyxVQUFVLElBQUlBLFNBQVMsS0FBSyxXQUFXLEVBQUU7QUFDdkQ7QUFDQTtNQUNBLElBQUlBLFNBQVMsS0FBSyxXQUFXLElBQUlDLFFBQVEsSUFBSUEsUUFBUSxDQUFDdEUsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUNoRXNFLFFBQUFBLFFBQVEsR0FBRyxJQUFJLENBQUE7QUFDbkIsT0FBQTs7QUFFQTtBQUNBLE1BQUEsSUFBSUEsUUFBUSxFQUFFO1FBQ1YsSUFBSUUsU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUNyQixRQUFBLElBQUlGLFFBQVEsQ0FBQ3RFLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDckIsVUFBQSxJQUFJdUUsUUFBUSxJQUFJQSxRQUFRLENBQUN2RSxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQ2pDLFlBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdzRSxRQUFRLENBQUN2RSxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO2NBQ3RDLE9BQU8sSUFBSSxDQUFDTCxVQUFVLENBQUMyRSxRQUFRLENBQUN0RSxDQUFDLENBQUMsQ0FBQzBCLElBQUksQ0FBQyxDQUFBO0FBQzVDLGFBQUE7QUFDSixXQUFDLE1BQU07QUFDSCxZQUFBLE9BQU8sSUFBSSxDQUFDL0IsVUFBVSxDQUFDTSxLQUFLLENBQUN5QixJQUFJLENBQUMsQ0FBQTtBQUN0QyxXQUFBO0FBQ0E2QyxVQUFBQSxTQUFTLEdBQUcsS0FBSyxDQUFBO0FBQ2pCLFVBQUEsS0FBSyxJQUFJdkUsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHcUUsUUFBUSxDQUFDdEUsTUFBTSxFQUFFQyxDQUFDLEVBQUUsRUFBRTtBQUN0QyxZQUFBLElBQUksQ0FBQ0wsVUFBVSxDQUFDMEUsUUFBUSxDQUFDckUsQ0FBQyxDQUFDLENBQUMwQixJQUFJLENBQUMsR0FBRzJDLFFBQVEsQ0FBQ3JFLENBQUMsQ0FBQyxDQUFBO0FBRS9DLFlBQUEsSUFBSSxDQUFDdUUsU0FBUyxJQUFJLElBQUksQ0FBQ2xGLFFBQVEsS0FBS2dGLFFBQVEsQ0FBQ3JFLENBQUMsQ0FBQyxDQUFDMEIsSUFBSSxFQUFFO0FBQ2xEO0FBQ0EsY0FBQSxJQUFJLElBQUksQ0FBQ2EsT0FBTyxJQUFJLElBQUksQ0FBQ1gsT0FBTyxJQUFJLElBQUksQ0FBQ2xELE1BQU0sQ0FBQ2tELE9BQU8sRUFBRTtBQUNyRDJDLGdCQUFBQSxTQUFTLEdBQUcsSUFBSSxDQUFBO2dCQUNoQixJQUFJLENBQUM5QyxJQUFJLENBQUM0QyxRQUFRLENBQUNyRSxDQUFDLENBQUMsQ0FBQzBCLElBQUksQ0FBQyxDQUFBO0FBQy9CLGVBQUE7QUFDSixhQUFBO0FBQ0osV0FBQTtVQUNBLElBQUksQ0FBQzZDLFNBQVMsRUFBRTtZQUNaLElBQUksQ0FBQzlELHFCQUFxQixFQUFFLENBQUE7WUFDNUIsSUFBSSxDQUFDWixlQUFlLEVBQUUsQ0FBQTtBQUMxQixXQUFBO0FBQ0osU0FBQyxNQUFNO0FBQ0gsVUFBQSxJQUFJeUUsUUFBUSxJQUFJQSxRQUFRLENBQUN2RSxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQ2pDLFlBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdzRSxRQUFRLENBQUN2RSxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO2NBQ3RDLE9BQU8sSUFBSSxDQUFDTCxVQUFVLENBQUMyRSxRQUFRLENBQUN0RSxDQUFDLENBQUMsQ0FBQzBCLElBQUksQ0FBQyxDQUFBO0FBQzVDLGFBQUE7QUFDSixXQUFBO0FBRUEsVUFBQSxJQUFJLENBQUMvQixVQUFVLENBQUNNLEtBQUssQ0FBQ3lCLElBQUksQ0FBQyxHQUFHMkMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJQSxRQUFRLENBQUE7QUFDckRFLFVBQUFBLFNBQVMsR0FBRyxLQUFLLENBQUE7QUFDakIsVUFBQSxJQUFJLElBQUksQ0FBQ2xGLFFBQVEsS0FBS1ksS0FBSyxDQUFDeUIsSUFBSSxFQUFFO0FBQzlCO0FBQ0EsWUFBQSxJQUFJLElBQUksQ0FBQ2EsT0FBTyxJQUFJLElBQUksQ0FBQ1gsT0FBTyxJQUFJLElBQUksQ0FBQ2xELE1BQU0sQ0FBQ2tELE9BQU8sRUFBRTtBQUNyRDJDLGNBQUFBLFNBQVMsR0FBRyxJQUFJLENBQUE7QUFDaEIsY0FBQSxJQUFJLENBQUM5QyxJQUFJLENBQUN4QixLQUFLLENBQUN5QixJQUFJLENBQUMsQ0FBQTtBQUN6QixhQUFBO0FBQ0osV0FBQTtVQUNBLElBQUksQ0FBQzZDLFNBQVMsRUFBRTtZQUNaLElBQUksQ0FBQzlELHFCQUFxQixFQUFFLENBQUE7WUFDNUIsSUFBSSxDQUFDWixlQUFlLEVBQUUsQ0FBQTtBQUMxQixXQUFBO0FBQ0osU0FBQTtRQUNBLElBQUksQ0FBQ1YsZUFBZSxDQUFDYyxLQUFLLENBQUNPLEVBQUUsQ0FBQyxHQUFHUCxLQUFLLENBQUN5QixJQUFJLENBQUE7QUFDL0MsT0FBQyxNQUFNO0FBQ0gsUUFBQSxJQUFJNEMsUUFBUSxDQUFDdkUsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUNyQixVQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHc0UsUUFBUSxDQUFDdkUsTUFBTSxFQUFFQyxDQUFDLEVBQUUsRUFBRTtZQUN0QyxPQUFPLElBQUksQ0FBQ0wsVUFBVSxDQUFDMkUsUUFBUSxDQUFDdEUsQ0FBQyxDQUFDLENBQUMwQixJQUFJLENBQUMsQ0FBQTtZQUN4QyxJQUFJLElBQUksQ0FBQ3JDLFFBQVEsS0FBS2lGLFFBQVEsQ0FBQ3RFLENBQUMsQ0FBQyxDQUFDMEIsSUFBSSxFQUFFO2NBQ3BDLElBQUksQ0FBQ2pCLHFCQUFxQixFQUFFLENBQUE7QUFDaEMsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFDLE1BQU07QUFDSCxVQUFBLE9BQU8sSUFBSSxDQUFDZCxVQUFVLENBQUNNLEtBQUssQ0FBQ3lCLElBQUksQ0FBQyxDQUFBO0FBQ2xDLFVBQUEsSUFBSSxJQUFJLENBQUNyQyxRQUFRLEtBQUtZLEtBQUssQ0FBQ3lCLElBQUksRUFBRTtZQUM5QixJQUFJLENBQUNqQixxQkFBcUIsRUFBRSxDQUFBO0FBQ2hDLFdBQUE7QUFDSixTQUFBO0FBQ0EsUUFBQSxPQUFPLElBQUksQ0FBQ3RCLGVBQWUsQ0FBQ2MsS0FBSyxDQUFDTyxFQUFFLENBQUMsQ0FBQTtBQUN6QyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7RUFDSUYsY0FBYyxDQUFDTCxLQUFLLEVBQUU7SUFDbEJBLEtBQUssQ0FBQ0csR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNFLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUU5QyxJQUFJLElBQUksQ0FBQ1gsVUFBVSxFQUFFO0FBQ2pCLE1BQUEsSUFBSU0sS0FBSyxDQUFDNEQsU0FBUyxDQUFDOUQsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM1QixRQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHQyxLQUFLLENBQUM0RCxTQUFTLENBQUM5RCxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO0FBQzdDLFVBQUEsT0FBTyxJQUFJLENBQUNMLFVBQVUsQ0FBQ00sS0FBSyxDQUFDNEQsU0FBUyxDQUFDN0QsQ0FBQyxDQUFDLENBQUMwQixJQUFJLENBQUMsQ0FBQTtBQUMvQyxVQUFBLElBQUksSUFBSSxDQUFDckMsUUFBUSxLQUFLWSxLQUFLLENBQUM0RCxTQUFTLENBQUM3RCxDQUFDLENBQUMsQ0FBQzBCLElBQUksRUFDekMsSUFBSSxDQUFDakIscUJBQXFCLEVBQUUsQ0FBQTtBQUNwQyxTQUFBO0FBQ0osT0FBQyxNQUFNO0FBQ0gsUUFBQSxPQUFPLElBQUksQ0FBQ2QsVUFBVSxDQUFDTSxLQUFLLENBQUN5QixJQUFJLENBQUMsQ0FBQTtRQUNsQyxJQUFJLElBQUksQ0FBQ3JDLFFBQVEsS0FBS1ksS0FBSyxDQUFDeUIsSUFBSSxFQUM1QixJQUFJLENBQUNqQixxQkFBcUIsRUFBRSxDQUFBO0FBQ3BDLE9BQUE7QUFDQSxNQUFBLE9BQU8sSUFBSSxDQUFDdEIsZUFBZSxDQUFDYyxLQUFLLENBQUNPLEVBQUUsQ0FBQyxDQUFBO0FBQ3pDLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0FDLEVBQUFBLHFCQUFxQixHQUFHO0lBQ3BCLElBQUksQ0FBQ3BCLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFFcEIsSUFBSSxDQUFDa0QsT0FBTyxHQUFHLEtBQUssQ0FBQTtJQUNwQixJQUFJLElBQUksQ0FBQ3ZELFFBQVEsRUFBRTtBQUNmLE1BQUEsSUFBSSxDQUFDQSxRQUFRLENBQUM4QixXQUFXLEdBQUcsQ0FBQyxDQUFBO0FBQzdCLE1BQUEsSUFBSSxDQUFDOUIsUUFBUSxDQUFDK0MsU0FBUyxHQUFHLElBQUksQ0FBQTtBQUNsQyxLQUFBO0lBQ0EsSUFBSSxJQUFJLENBQUNqRCxhQUFhLEVBQUU7QUFDcEIsTUFBQSxLQUFLLElBQUlrQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDbEIsYUFBYSxDQUFDbUMsS0FBSyxDQUFDbEIsTUFBTSxFQUFFLEVBQUVDLENBQUMsRUFBRTtRQUN0RCxJQUFJLENBQUNsQixhQUFhLENBQUNtQyxLQUFLLENBQUNqQixDQUFDLENBQUMsQ0FBQ3dFLElBQUksRUFBRSxDQUFBO0FBQ3RDLE9BQUE7QUFDQSxNQUFBLElBQUksQ0FBQzFGLGFBQWEsQ0FBQzJGLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM1QixNQUFBLElBQUksQ0FBQzNGLGFBQWEsQ0FBQ21ELFdBQVcsRUFBRSxDQUFBO0FBQ3BDLEtBQUE7QUFDSixHQUFBO0FBRUF5QyxFQUFBQSxRQUFRLEdBQUc7SUFDUCxLQUFLLENBQUNBLFFBQVEsRUFBRSxDQUFBOztBQUVoQjtBQUNBLElBQUEsTUFBTTVFLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtJQUMxQixNQUFNNkUsUUFBUSxHQUFHLElBQUksQ0FBQ2xHLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ0osTUFBTSxDQUFBO0FBQ3ZDLElBQUEsSUFBSUEsTUFBTSxFQUFFO0FBQ1IsTUFBQSxLQUFLLElBQUlFLENBQUMsR0FBRyxDQUFDLEVBQUU0RSxHQUFHLEdBQUc5RSxNQUFNLENBQUNDLE1BQU0sRUFBRUMsQ0FBQyxHQUFHNEUsR0FBRyxFQUFFNUUsQ0FBQyxFQUFFLEVBQUU7QUFDL0MsUUFBQSxJQUFJQyxLQUFLLEdBQUdILE1BQU0sQ0FBQ0UsQ0FBQyxDQUFDLENBQUE7QUFDckIsUUFBQSxJQUFJLEVBQUVDLEtBQUssWUFBWVcsS0FBSyxDQUFDLEVBQ3pCWCxLQUFLLEdBQUcwRSxRQUFRLENBQUN4RSxHQUFHLENBQUNGLEtBQUssQ0FBQyxDQUFBO0FBRS9CLFFBQUEsSUFBSUEsS0FBSyxJQUFJLENBQUNBLEtBQUssQ0FBQzZELFFBQVEsRUFDeEJhLFFBQVEsQ0FBQ1QsSUFBSSxDQUFDakUsS0FBSyxDQUFDLENBQUE7QUFDNUIsT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLElBQUksQ0FBQ1IsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDSixRQUFRLEVBQUU7TUFDakMsTUFBTXdELGNBQWMsR0FBR0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsSUFBSSxDQUFDcEQsVUFBVSxDQUFDLENBQUE7QUFDbkQsTUFBQSxJQUFJa0QsY0FBYyxDQUFDOUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUMzQixRQUFBLElBQUksQ0FBQzBCLElBQUksQ0FBQ29CLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2hDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBZ0MsRUFBQUEsY0FBYyxHQUFHO0FBQ2IsSUFBQSxLQUFLLElBQUk3RSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDRixNQUFNLENBQUNDLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFFekM7QUFDQSxNQUFBLElBQUlDLEtBQUssR0FBRyxJQUFJLENBQUNILE1BQU0sQ0FBQ0UsQ0FBQyxDQUFDLENBQUE7QUFDMUIsTUFBQSxJQUFJLE9BQU9DLEtBQUssS0FBTSxRQUFRLEVBQUU7QUFDNUJBLFFBQUFBLEtBQUssR0FBRyxJQUFJLENBQUN4QixNQUFNLENBQUN5QixHQUFHLENBQUNKLE1BQU0sQ0FBQ0ssR0FBRyxDQUFDRixLQUFLLENBQUMsQ0FBQTtBQUM3QyxPQUFBO01BRUEsSUFBSSxDQUFDQSxLQUFLLEVBQUUsU0FBQTtNQUVaQSxLQUFLLENBQUNHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUE7TUFDOUNKLEtBQUssQ0FBQ0csR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNFLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNsRCxLQUFBO0lBRUEsSUFBSSxDQUFDdEIsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNwQixJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBRWxCLElBQUksQ0FBQ0osYUFBYSxHQUFHLElBQUksQ0FBQTtBQUM3QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJMkYsTUFBTSxDQUFDSyxFQUFFLEVBQUU7QUFDUDtJQUNBLElBQUksSUFBSSxDQUFDdkYsUUFBUSxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUNELEtBQUssSUFBSXdGLEVBQUUsR0FBRyxJQUFJLENBQUN0RixVQUFVLENBQUE7QUFDbEMsTUFBQSxJQUFJLElBQUksQ0FBQ0YsS0FBSyxJQUFJLENBQUMsRUFBRTtRQUNqQixJQUFJLENBQUNBLEtBQUssR0FBRyxDQUFDLENBQUE7QUFDbEIsT0FBQTtBQUNKLEtBQUE7O0FBRUE7SUFDQSxJQUFJLElBQUksQ0FBQ2lELE9BQU8sRUFBRTtBQUNkLE1BQUEsTUFBTXZELFFBQVEsR0FBRyxJQUFJLENBQUNBLFFBQVEsQ0FBQTtNQUM5QixJQUFJQSxRQUFRLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQ0QsS0FBSyxLQUFLLElBQUksRUFBRTtRQUMxQyxJQUFJLElBQUksQ0FBQ1EsUUFBUSxFQUFFO0FBQ2ZQLFVBQUFBLFFBQVEsQ0FBQ00sS0FBSyxDQUFDLElBQUksQ0FBQ0wsUUFBUSxFQUFFLElBQUksQ0FBQ0MsTUFBTSxFQUFFLElBQUksQ0FBQ0ksS0FBSyxDQUFDLENBQUE7QUFDMUQsU0FBQyxNQUFNO0FBQ0g7QUFDQTtBQUNBLFVBQUEsTUFBTXlGLEtBQUssR0FBR0QsRUFBRSxHQUFHLElBQUksQ0FBQ3BGLEtBQUssQ0FBQTtBQUM3QlYsVUFBQUEsUUFBUSxDQUFDK0IsT0FBTyxDQUFDZ0UsS0FBSyxDQUFDLENBQUE7VUFDdkIsSUFBSSxJQUFJLENBQUNyRixLQUFLLEdBQUcsQ0FBQyxJQUFLVixRQUFRLENBQUNtQyxLQUFLLEtBQUtuQyxRQUFRLENBQUMrQyxTQUFTLENBQUNYLFFBQVMsSUFBSSxDQUFDLElBQUksQ0FBQ0csSUFBSSxFQUFFO1lBQ2xGLElBQUksQ0FBQ2dCLE9BQU8sR0FBRyxLQUFLLENBQUE7QUFDeEIsV0FBQyxNQUFNLElBQUksSUFBSSxDQUFDN0MsS0FBSyxHQUFHLENBQUMsSUFBSVYsUUFBUSxDQUFDbUMsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQ0ksSUFBSSxFQUFFO1lBQzdELElBQUksQ0FBQ2dCLE9BQU8sR0FBRyxLQUFLLENBQUE7QUFDeEIsV0FBQTtBQUNKLFNBQUE7UUFFQSxJQUFJLElBQUksQ0FBQ2hELFFBQVEsSUFBSyxJQUFJLENBQUNELEtBQUssS0FBSyxDQUFFLEVBQUU7QUFDckNOLFVBQUFBLFFBQVEsQ0FBQytDLFNBQVMsR0FBRyxJQUFJLENBQUM3QyxNQUFNLENBQUM2QyxTQUFTLENBQUE7QUFDOUMsU0FBQTtRQUVBL0MsUUFBUSxDQUFDZ0MsV0FBVyxFQUFFLENBQUE7QUFDMUIsT0FBQTtBQUNKLEtBQUE7O0FBRUE7QUFDQSxJQUFBLE1BQU1sQyxhQUFhLEdBQUcsSUFBSSxDQUFDQSxhQUFhLENBQUE7QUFDeEMsSUFBQSxJQUFJQSxhQUFhLEVBQUU7QUFFZjtBQUNBLE1BQUEsS0FBSyxJQUFJa0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHbEIsYUFBYSxDQUFDbUMsS0FBSyxDQUFDbEIsTUFBTSxFQUFFLEVBQUVDLENBQUMsRUFBRTtBQUNqRCxRQUFBLE1BQU1rQyxJQUFJLEdBQUdwRCxhQUFhLENBQUNtQyxLQUFLLENBQUNqQixDQUFDLENBQUMsQ0FBQTtBQUNuQ2tDLFFBQUFBLElBQUksQ0FBQ3hDLEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQTtBQUN2QixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUM2QyxPQUFPLEVBQUU7VUFDZkwsSUFBSSxDQUFDOEMsS0FBSyxFQUFFLENBQUE7QUFDaEIsU0FBQyxNQUFNO1VBQ0g5QyxJQUFJLENBQUMrQyxNQUFNLEVBQUUsQ0FBQTtBQUNqQixTQUFBO0FBQ0osT0FBQTs7QUFFQTtNQUNBLElBQUksSUFBSSxDQUFDMUYsUUFBUSxJQUFJVCxhQUFhLENBQUNtQyxLQUFLLENBQUNsQixNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ2pEakIsYUFBYSxDQUFDbUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDbUIsV0FBVyxHQUFHLElBQUksQ0FBQzlDLEtBQUssQ0FBQTtBQUNuRCxPQUFBO0FBRUFSLE1BQUFBLGFBQWEsQ0FBQzJGLE1BQU0sQ0FBQ0ssRUFBRSxDQUFDLENBQUE7QUFDNUIsS0FBQTs7QUFFQTtJQUNBLElBQUksSUFBSSxDQUFDdkYsUUFBUSxJQUFJLElBQUksQ0FBQ0QsS0FBSyxLQUFLLENBQUMsRUFBRTtNQUNuQyxJQUFJLENBQUNDLFFBQVEsR0FBRyxLQUFLLENBQUE7QUFDekIsS0FBQTtBQUNKLEdBQUE7QUFDSjs7OzsifQ==
