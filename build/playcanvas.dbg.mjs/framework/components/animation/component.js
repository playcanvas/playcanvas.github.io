/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { AnimClip } from '../../anim/evaluator/anim-clip.js';
import { AnimEvaluator } from '../../anim/evaluator/anim-evaluator.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { DefaultAnimBinder } from '../../anim/binder/default-anim-binder.js';
import { Skeleton } from '../../../scene/animation/skeleton.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

class AnimationComponent extends Component {

  constructor(system, entity) {
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

  set animations(value) {
    this._animations = value;
    this.onSetAnimations();
  }
  get animations() {
    return this._animations;
  }

  set assets(value) {
    const assets = this._assets;
    if (assets && assets.length) {
      for (let i = 0; i < assets.length; i++) {
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
      const clips = this.animEvaluator.clips;
      if (clips.length > 0) {
        return clips[clips.length - 1].time;
      }
    }
    return 0;
  }

  get duration() {
    if (this.currAnim) {
      return this.animations[this.currAnim].duration;
    }
    Debug.warn(`No animation is playing to get a duration. Returning 0.`);
    return 0;
  }

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

  getAnimation(name) {
    return this.animations[name];
  }

  setModel(model) {
    if (model !== this.model) {
      this._resetAnimationController();

      this.model = model;

      if (this.animations && this.currAnim && this.animations[this.currAnim]) {
        this.play(this.currAnim);
      }
    }
  }
  onSetAnimations() {
    const modelComponent = this.entity.model;
    if (modelComponent) {
      const m = modelComponent.model;
      if (m && m !== this.model) {
        this.setModel(m);
      }
    }
    if (!this.currAnim && this.activate && this.enabled && this.entity.enabled) {
      const animationNames = Object.keys(this._animations);
      if (animationNames.length > 0) {
        this.play(animationNames[0]);
      }
    }
  }

  _resetAnimationController() {
    this.skeleton = null;
    this.fromSkel = null;
    this.toSkel = null;
    this.animEvaluator = null;
  }

  _createAnimationController() {
    const model = this.model;
    const animations = this.animations;

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
      this.animations = this.animations;
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

  onAssetChanged(asset, attribute, newValue, oldValue) {
    if (attribute === 'resource' || attribute === 'resources') {
      if (attribute === 'resources' && newValue && newValue.length === 0) {
        newValue = null;
      }

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

  update(dt) {
    if (this.blending) {
      this.blend += dt * this.blendSpeed;
      if (this.blend >= 1) {
        this.blend = 1;
      }
    }

    if (this.playing) {
      const skeleton = this.skeleton;
      if (skeleton !== null && this.model !== null) {
        if (this.blending) {
          skeleton.blend(this.fromSkel, this.toSkel, this.blend);
        } else {
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

    const animEvaluator = this.animEvaluator;
    if (animEvaluator) {
      for (let i = 0; i < animEvaluator.clips.length; ++i) {
        const clip = animEvaluator.clips[i];
        clip.speed = this.speed;
        if (!this.playing) {
          clip.pause();
        } else {
          clip.resume();
        }
      }

      if (this.blending && animEvaluator.clips.length > 1) {
        animEvaluator.clips[1].blendWeight = this.blend;
      }
      animEvaluator.update(dt);
    }

    if (this.blending && this.blend === 1) {
      this.blending = false;
    }
  }
}

export { AnimationComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbWF0aW9uL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBBbmltQ2xpcCB9IGZyb20gJy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tY2xpcC5qcyc7XG5pbXBvcnQgeyBBbmltRXZhbHVhdG9yIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmFsdWF0b3IuanMnO1xuaW1wb3J0IHsgQW5pbVRyYWNrIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS10cmFjay5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0QW5pbUJpbmRlciB9IGZyb20gJy4uLy4uL2FuaW0vYmluZGVyL2RlZmF1bHQtYW5pbS1iaW5kZXIuanMnO1xuXG5pbXBvcnQgeyBTa2VsZXRvbiB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2FuaW1hdGlvbi9za2VsZXRvbi5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvYW5pbWF0aW9uL2FuaW1hdGlvbi5qcycpLkFuaW1hdGlvbn0gQW5pbWF0aW9uICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnKS5Nb2RlbH0gTW9kZWwgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IEVudGl0eSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuQW5pbWF0aW9uQ29tcG9uZW50U3lzdGVtfSBBbmltYXRpb25Db21wb25lbnRTeXN0ZW0gKi9cblxuLyoqXG4gKiBUaGUgQW5pbWF0aW9uIENvbXBvbmVudCBhbGxvd3MgYW4gRW50aXR5IHRvIHBsYXliYWNrIGFuaW1hdGlvbnMgb24gbW9kZWxzLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgQW5pbWF0aW9uQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgQW5pbWF0aW9uPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hbmltYXRpb25zID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXJyYXkuPG51bWJlcnxBc3NldD59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYXNzZXRzID0gW107XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbG9vcCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QW5pbUV2YWx1YXRvcnxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhbmltRXZhbHVhdG9yID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNb2RlbHxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtb2RlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHNrZWxldG9uIGZvciB0aGUgY3VycmVudCBtb2RlbC4gSWYgdGhlIG1vZGVsIGlzIGxvYWRlZCBmcm9tIGdsVEYvZ2xiLCB0aGVuIHRoZVxuICAgICAqIHNrZWxldG9uIGlzIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2tlbGV0b258bnVsbH1cbiAgICAgKi9cbiAgICBza2VsZXRvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U2tlbGV0b258bnVsbH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZnJvbVNrZWwgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NrZWxldG9ufG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHRvU2tlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYW5pbWF0aW9uc0luZGV4ID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwcmV2QW5pbSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBjdXJyQW5pbSA9IG51bGw7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBibGVuZCA9IDA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBibGVuZGluZyA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgYmxlbmRTcGVlZCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBmaXJzdCBhbmltYXRpb24gYXNzZXQgd2lsbCBiZWdpbiBwbGF5aW5nIHdoZW4gdGhlIHNjZW5lIGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFjdGl2YXRlID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFNwZWVkIG11bHRpcGxpZXIgZm9yIGFuaW1hdGlvbiBwbGF5IGJhY2suIDEgaXMgcGxheWJhY2sgYXQgbm9ybWFsIHNwZWVkIGFuZCAwIHBhdXNlcyB0aGVcbiAgICAgKiBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNwZWVkID0gMTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltYXRpb25Db21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FuaW1hdGlvbkNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIHtAbGluayBDb21wb25lbnRTeXN0ZW19IHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdXNlbGVzcy1jb25zdHJ1Y3RvclxuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IG9yIHNldCBkaWN0aW9uYXJ5IG9mIGFuaW1hdGlvbnMgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBBbmltYXRpb24+fVxuICAgICAqL1xuICAgIHNldCBhbmltYXRpb25zKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FuaW1hdGlvbnMgPSB2YWx1ZTtcblxuICAgICAgICB0aGlzLm9uU2V0QW5pbWF0aW9ucygpO1xuICAgIH1cblxuICAgIGdldCBhbmltYXRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pbWF0aW9ucztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXJyYXkgb2YgYW5pbWF0aW9uIGFzc2V0cy4gQ2FuIGFsc28gYmUgYW4gYXJyYXkgb2YgYXNzZXQgaWRzLlxuICAgICAqXG4gICAgICogQHR5cGUge0FycmF5LjxudW1iZXJ8QXNzZXQ+fVxuICAgICAqL1xuICAgIHNldCBhc3NldHModmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fYXNzZXRzO1xuXG4gICAgICAgIGlmIChhc3NldHMgJiYgYXNzZXRzLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIGNoYW5nZSBldmVudCBmb3Igb2xkIGFzc2V0c1xuICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldHNbaV0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5vbkFzc2V0Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbmltTmFtZSA9IHRoaXMuYW5pbWF0aW9uc0luZGV4W2Fzc2V0LmlkXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0gPT09IGFuaW1OYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3N0b3BDdXJyZW50QW5pbWF0aW9uKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbYW5pbU5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc0luZGV4W2Fzc2V0LmlkXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Fzc2V0cyA9IHZhbHVlO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0SWRzID0gdmFsdWUubWFwKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSA/IHZhbHVlLmlkIDogdmFsdWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMubG9hZEFuaW1hdGlvbkFzc2V0cyhhc3NldElkcyk7XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgb3Igc2V0IHRoZSBjdXJyZW50IHRpbWUgcG9zaXRpb24gKGluIHNlY29uZHMpIG9mIHRoZSBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjdXJyZW50VGltZShjdXJyZW50VGltZSkge1xuICAgICAgICBpZiAodGhpcy5za2VsZXRvbikge1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5jdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5hZGRUaW1lKDApO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi51cGRhdGVHcmFwaCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYW5pbUV2YWx1YXRvcikge1xuICAgICAgICAgICAgY29uc3QgY2xpcHMgPSB0aGlzLmFuaW1FdmFsdWF0b3IuY2xpcHM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsaXBzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgY2xpcHNbaV0udGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGN1cnJlbnRUaW1lKCkge1xuICAgICAgICBpZiAodGhpcy5za2VsZXRvbikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2tlbGV0b24uX3RpbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5hbmltRXZhbHVhdG9yKSB7XG4gICAgICAgICAgICAvLyBHZXQgdGhlIGxhc3QgY2xpcCdzIGN1cnJlbnQgdGltZSB3aGljaCB3aWxsIGJlIHRoZSBvbmVcbiAgICAgICAgICAgIC8vIHRoYXQgaXMgY3VycmVudGx5IGJlaW5nIGJsZW5kZWRcbiAgICAgICAgICAgIGNvbnN0IGNsaXBzID0gdGhpcy5hbmltRXZhbHVhdG9yLmNsaXBzO1xuICAgICAgICAgICAgaWYgKGNsaXBzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2xpcHNbY2xpcHMubGVuZ3RoIC0gMV0udGltZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZHVyYXRpb24gaW4gc2Vjb25kcyBvZiB0aGUgY3VycmVudCBhbmltYXRpb24uIFJldHVybnMgMCBpZiBubyBhbmltYXRpb24gaXMgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGR1cmF0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5jdXJyQW5pbSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYW5pbWF0aW9uc1t0aGlzLmN1cnJBbmltXS5kdXJhdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLndhcm4oYE5vIGFuaW1hdGlvbiBpcyBwbGF5aW5nIHRvIGdldCBhIGR1cmF0aW9uLiBSZXR1cm5pbmcgMC5gKTtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgYW5pbWF0aW9uIHdpbGwgcmVzdGFydCBmcm9tIHRoZSBiZWdpbm5pbmcgd2hlbiBpdCByZWFjaGVzIHRoZSBlbmQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbG9vcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9sb29wID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuc2tlbGV0b24pIHtcbiAgICAgICAgICAgIHRoaXMuc2tlbGV0b24ubG9vcGluZyA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYW5pbUV2YWx1YXRvcikge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFuaW1FdmFsdWF0b3IuY2xpcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IuY2xpcHNbaV0ubG9vcCA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxvb3AoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb29wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IHBsYXlpbmcgYW4gYW5pbWF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYW5pbWF0aW9uIGFzc2V0IHRvIGJlZ2luIHBsYXlpbmcuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtibGVuZFRpbWVdIC0gVGhlIHRpbWUgaW4gc2Vjb25kcyB0byBibGVuZCBmcm9tIHRoZSBjdXJyZW50XG4gICAgICogYW5pbWF0aW9uIHN0YXRlIHRvIHRoZSBzdGFydCBvZiB0aGUgYW5pbWF0aW9uIGJlaW5nIHNldC4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKi9cbiAgICBwbGF5KG5hbWUsIGJsZW5kVGltZSA9IDApIHtcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5hbmltYXRpb25zW25hbWVdKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihgVHJ5aW5nIHRvIHBsYXkgYW5pbWF0aW9uICcke25hbWV9JyB3aGljaCBkb2Vzbid0IGV4aXN0YCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnByZXZBbmltID0gdGhpcy5jdXJyQW5pbTtcbiAgICAgICAgdGhpcy5jdXJyQW5pbSA9IG5hbWU7XG5cbiAgICAgICAgaWYgKHRoaXMubW9kZWwpIHtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNrZWxldG9uICYmICF0aGlzLmFuaW1FdmFsdWF0b3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jcmVhdGVBbmltYXRpb25Db250cm9sbGVyKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByZXZBbmltID0gdGhpcy5hbmltYXRpb25zW3RoaXMucHJldkFuaW1dO1xuICAgICAgICAgICAgY29uc3QgY3VyckFuaW0gPSB0aGlzLmFuaW1hdGlvbnNbdGhpcy5jdXJyQW5pbV07XG5cbiAgICAgICAgICAgIHRoaXMuYmxlbmRpbmcgPSBibGVuZFRpbWUgPiAwICYmICEhdGhpcy5wcmV2QW5pbTtcbiAgICAgICAgICAgIGlmICh0aGlzLmJsZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5ibGVuZFNwZWVkID0gMSAvIGJsZW5kVGltZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuc2tlbGV0b24pIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ibGVuZGluZykge1xuICAgICAgICAgICAgICAgICAgICAvLyBCbGVuZCBmcm9tIHRoZSBjdXJyZW50IHRpbWUgb2YgdGhlIGN1cnJlbnQgYW5pbWF0aW9uIHRvIHRoZSBzdGFydCBvZlxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgbmV3bHkgc3BlY2lmaWVkIGFuaW1hdGlvbiBvdmVyIHRoZSBzcGVjaWZpZWQgYmxlbmQgdGltZSBwZXJpb2QuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnJvbVNrZWwuYW5pbWF0aW9uID0gcHJldkFuaW07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZnJvbVNrZWwuYWRkVGltZSh0aGlzLnNrZWxldG9uLl90aW1lKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b1NrZWwuYW5pbWF0aW9uID0gY3VyckFuaW07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5hbmltYXRpb24gPSBjdXJyQW5pbTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmFuaW1FdmFsdWF0b3IpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhbmltRXZhbHVhdG9yID0gdGhpcy5hbmltRXZhbHVhdG9yO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGFsbCBidXQgdGhlIGxhc3QgY2xpcFxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoYW5pbUV2YWx1YXRvci5jbGlwcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhbmltRXZhbHVhdG9yLnJlbW92ZUNsaXAoMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IucmVtb3ZlQ2xpcHMoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjbGlwID0gbmV3IEFuaW1DbGlwKHRoaXMuYW5pbWF0aW9uc1t0aGlzLmN1cnJBbmltXSwgMCwgMS4wLCB0cnVlLCB0aGlzLmxvb3ApO1xuICAgICAgICAgICAgICAgIGNsaXAubmFtZSA9IHRoaXMuY3VyckFuaW07XG4gICAgICAgICAgICAgICAgY2xpcC5ibGVuZFdlaWdodCA9IHRoaXMuYmxlbmRpbmcgPyAwIDogMTtcbiAgICAgICAgICAgICAgICBjbGlwLnJlc2V0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yLmFkZENsaXAoY2xpcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBsYXlpbmcgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhbiBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBhbmltYXRpb24gYXNzZXQuXG4gICAgICogQHJldHVybnMge0FuaW1hdGlvbn0gQW4gQW5pbWF0aW9uLlxuICAgICAqL1xuICAgIGdldEFuaW1hdGlvbihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFuaW1hdGlvbnNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBtb2RlbCBkcml2ZW4gYnkgdGhpcyBhbmltYXRpb24gY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNb2RlbH0gbW9kZWwgLSBUaGUgbW9kZWwgdG8gc2V0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRNb2RlbChtb2RlbCkge1xuICAgICAgICBpZiAobW9kZWwgIT09IHRoaXMubW9kZWwpIHtcbiAgICAgICAgICAgIC8vIHJlc2V0IGFuaW1hdGlvbiBjb250cm9sbGVyXG4gICAgICAgICAgICB0aGlzLl9yZXNldEFuaW1hdGlvbkNvbnRyb2xsZXIoKTtcblxuICAgICAgICAgICAgLy8gc2V0IHRoZSBtb2RlbFxuICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG1vZGVsO1xuXG4gICAgICAgICAgICAvLyBSZXNldCB0aGUgY3VycmVudCBhbmltYXRpb24gb24gdGhlIG5ldyBtb2RlbFxuICAgICAgICAgICAgaWYgKHRoaXMuYW5pbWF0aW9ucyAmJiB0aGlzLmN1cnJBbmltICYmIHRoaXMuYW5pbWF0aW9uc1t0aGlzLmN1cnJBbmltXSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGxheSh0aGlzLmN1cnJBbmltKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0QW5pbWF0aW9ucygpIHtcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSBhbmltYXRpb25zIF9hbmRfIGEgbW9kZWwsIHdlIGNhbiBjcmVhdGUgdGhlIHNrZWxldG9uc1xuICAgICAgICBjb25zdCBtb2RlbENvbXBvbmVudCA9IHRoaXMuZW50aXR5Lm1vZGVsO1xuICAgICAgICBpZiAobW9kZWxDb21wb25lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG0gPSBtb2RlbENvbXBvbmVudC5tb2RlbDtcbiAgICAgICAgICAgIGlmIChtICYmIG0gIT09IHRoaXMubW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldE1vZGVsKG0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmN1cnJBbmltICYmIHRoaXMuYWN0aXZhdGUgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIFNldCB0aGUgZmlyc3QgbG9hZGVkIGFuaW1hdGlvbiBhcyB0aGUgY3VycmVudFxuICAgICAgICAgICAgY29uc3QgYW5pbWF0aW9uTmFtZXMgPSBPYmplY3Qua2V5cyh0aGlzLl9hbmltYXRpb25zKTtcbiAgICAgICAgICAgIGlmIChhbmltYXRpb25OYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGFuaW1hdGlvbk5hbWVzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZXNldEFuaW1hdGlvbkNvbnRyb2xsZXIoKSB7XG4gICAgICAgIHRoaXMuc2tlbGV0b24gPSBudWxsO1xuICAgICAgICB0aGlzLmZyb21Ta2VsID0gbnVsbDtcbiAgICAgICAgdGhpcy50b1NrZWwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvciA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2NyZWF0ZUFuaW1hdGlvbkNvbnRyb2xsZXIoKSB7XG4gICAgICAgIGNvbnN0IG1vZGVsID0gdGhpcy5tb2RlbDtcbiAgICAgICAgY29uc3QgYW5pbWF0aW9ucyA9IHRoaXMuYW5pbWF0aW9ucztcblxuICAgICAgICAvLyBjaGVjayB3aGljaCB0eXBlIG9mIGFuaW1hdGlvbnMgYXJlIGxvYWRlZFxuICAgICAgICBsZXQgaGFzSnNvbiA9IGZhbHNlO1xuICAgICAgICBsZXQgaGFzR2xiID0gZmFsc2U7XG4gICAgICAgIGZvciAoY29uc3QgYW5pbWF0aW9uIGluIGFuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChhbmltYXRpb25zLmhhc093blByb3BlcnR5KGFuaW1hdGlvbikpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhbmltID0gYW5pbWF0aW9uc1thbmltYXRpb25dO1xuICAgICAgICAgICAgICAgIGlmIChhbmltLmNvbnN0cnVjdG9yID09PSBBbmltVHJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgaGFzR2xiID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBoYXNKc29uID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncmFwaCA9IG1vZGVsLmdldEdyYXBoKCk7XG4gICAgICAgIGlmIChoYXNKc29uKSB7XG4gICAgICAgICAgICB0aGlzLmZyb21Ta2VsID0gbmV3IFNrZWxldG9uKGdyYXBoKTtcbiAgICAgICAgICAgIHRoaXMudG9Ta2VsID0gbmV3IFNrZWxldG9uKGdyYXBoKTtcbiAgICAgICAgICAgIHRoaXMuc2tlbGV0b24gPSBuZXcgU2tlbGV0b24oZ3JhcGgpO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5sb29waW5nID0gdGhpcy5sb29wO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5zZXRHcmFwaChncmFwaCk7XG4gICAgICAgIH0gZWxzZSBpZiAoaGFzR2xiKSB7XG4gICAgICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IgPSBuZXcgQW5pbUV2YWx1YXRvcihuZXcgRGVmYXVsdEFuaW1CaW5kZXIodGhpcy5lbnRpdHkpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGlkcyAtIEFycmF5IG9mIGFuaW1hdGlvbiBhc3NldCBpZHMuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBsb2FkQW5pbWF0aW9uQXNzZXRzKGlkcykge1xuICAgICAgICBpZiAoIWlkcyB8fCAhaWRzLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGNvbnN0IG9uQXNzZXRSZWFkeSA9IChhc3NldCkgPT4ge1xuICAgICAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NldC5yZXNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hbmltYXRpb25zW2Fzc2V0LnJlc291cmNlc1tpXS5uYW1lXSA9IGFzc2V0LnJlc291cmNlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hbmltYXRpb25zSW5kZXhbYXNzZXQuaWRdID0gYXNzZXQucmVzb3VyY2VzW2ldLm5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNbYXNzZXQubmFtZV0gPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF0gPSBhc3NldC5uYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9ucyA9IHRoaXMuYW5pbWF0aW9uczsgLy8gYXNzaWduaW5nIGVuc3VyZXMgc2V0X2FuaW1hdGlvbnMgZXZlbnQgaXMgZmlyZWRcbiAgICAgICAgICAgIC8qIGVzbGludC1lbmFibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBvbkFzc2V0QWRkID0gKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMub25Bc3NldENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMub25Bc3NldENoYW5nZWQsIHRoaXMpO1xuXG4gICAgICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBvbkFzc2V0UmVhZHkoYXNzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NldC5vbmNlKCdsb2FkJywgb25Bc3NldFJlYWR5LCB0aGlzKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGlkcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChpZHNbaV0pO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgb25Bc3NldEFkZChhc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyBpZHNbaV0sIG9uQXNzZXRBZGQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIGFzc2V0IGNoYW5nZSBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IGNoYW5nZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGF0dHJpYnV0ZSAtIFRoZSBuYW1lIG9mIHRoZSBhc3NldCBhdHRyaWJ1dGUgdGhhdCBjaGFuZ2VkLiBDYW4gYmUgJ2RhdGEnLFxuICAgICAqICdmaWxlJywgJ3Jlc291cmNlJyBvciAncmVzb3VyY2VzJy5cbiAgICAgKiBAcGFyYW0geyp9IG5ld1ZhbHVlIC0gVGhlIG5ldyB2YWx1ZSBvZiB0aGUgc3BlY2lmaWVkIGFzc2V0IHByb3BlcnR5LlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBUaGUgb2xkIHZhbHVlIG9mIHRoZSBzcGVjaWZpZWQgYXNzZXQgcHJvcGVydHkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkFzc2V0Q2hhbmdlZChhc3NldCwgYXR0cmlidXRlLCBuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZSA9PT0gJ3Jlc291cmNlJyB8fCBhdHRyaWJ1dGUgPT09ICdyZXNvdXJjZXMnKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGUgYXR0cmlidXRlIGlzICdyZXNvdXJjZXMnLCBuZXdWYWx1ZSBjYW4gYmUgYW4gZW1wdHkgYXJyYXkgd2hlbiB0aGVcbiAgICAgICAgICAgIC8vIGFzc2V0IGlzIHVubG9hZGVkLiBUaGVyZWZvcmUsIHdlIHNob3VsZCBhc3NpZ24gbnVsbCBpbiB0aGlzIGNhc2VcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGUgPT09ICdyZXNvdXJjZXMnICYmIG5ld1ZhbHVlICYmIG5ld1ZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVwbGFjZSBvbGQgYW5pbWF0aW9uIHdpdGggbmV3IG9uZVxuICAgICAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgbGV0IHJlc3RhcnRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChuZXdWYWx1ZS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChvbGRWYWx1ZSAmJiBvbGRWYWx1ZS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9sZFZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc1tvbGRWYWx1ZVtpXS5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbYXNzZXQubmFtZV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVzdGFydGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmV3VmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9uc1tuZXdWYWx1ZVtpXS5uYW1lXSA9IG5ld1ZhbHVlW2ldO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJlc3RhcnRlZCAmJiB0aGlzLmN1cnJBbmltID09PSBuZXdWYWx1ZVtpXS5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmVzdGFydCBhbmltYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5wbGF5aW5nICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxheShuZXdWYWx1ZVtpXS5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZXN0YXJ0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3N0b3BDdXJyZW50QW5pbWF0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm9uU2V0QW5pbWF0aW9ucygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9sZFZhbHVlICYmIG9sZFZhbHVlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5hbmltYXRpb25zW29sZFZhbHVlW2ldLm5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hbmltYXRpb25zW2Fzc2V0Lm5hbWVdID0gbmV3VmFsdWVbMF0gfHwgbmV3VmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIHJlc3RhcnRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyQW5pbSA9PT0gYXNzZXQubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmVzdGFydCBhbmltYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXlpbmcgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN0YXJ0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGxheShhc3NldC5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlc3RhcnRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RvcEN1cnJlbnRBbmltYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25TZXRBbmltYXRpb25zKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5hbmltYXRpb25zSW5kZXhbYXNzZXQuaWRdID0gYXNzZXQubmFtZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG9sZFZhbHVlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvbGRWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc1tvbGRWYWx1ZVtpXS5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJBbmltID09PSBvbGRWYWx1ZVtpXS5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RvcEN1cnJlbnRBbmltYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbYXNzZXQubmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJBbmltID09PSBhc3NldC5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9wQ3VycmVudEFuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25Bc3NldFJlbW92ZWQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLm9uQXNzZXRSZW1vdmVkLCB0aGlzKTtcblxuICAgICAgICBpZiAodGhpcy5hbmltYXRpb25zKSB7XG4gICAgICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2VzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0LnJlc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5hbmltYXRpb25zW2Fzc2V0LnJlc291cmNlc1tpXS5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0gPT09IGFzc2V0LnJlc291cmNlc1tpXS5uYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RvcEN1cnJlbnRBbmltYXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbYXNzZXQubmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0gPT09IGFzc2V0Lm5hbWUpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3N0b3BDdXJyZW50QW5pbWF0aW9uKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5hbmltYXRpb25zSW5kZXhbYXNzZXQuaWRdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3N0b3BDdXJyZW50QW5pbWF0aW9uKCkge1xuICAgICAgICB0aGlzLmN1cnJBbmltID0gbnVsbDtcblxuICAgICAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuc2tlbGV0b24pIHtcbiAgICAgICAgICAgIHRoaXMuc2tlbGV0b24uY3VycmVudFRpbWUgPSAwO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5hbmltYXRpb24gPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmFuaW1FdmFsdWF0b3IpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5hbmltRXZhbHVhdG9yLmNsaXBzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yLmNsaXBzW2ldLnN0b3AoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvci51cGRhdGUoMCk7XG4gICAgICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IucmVtb3ZlQ2xpcHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBzdXBlci5vbkVuYWJsZSgpO1xuXG4gICAgICAgIC8vIGxvYWQgYXNzZXRzIGlmIHRoZXkncmUgbm90IGxvYWRlZFxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLmFzc2V0cztcbiAgICAgICAgY29uc3QgcmVnaXN0cnkgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBpZiAoYXNzZXRzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gYXNzZXRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGV0IGFzc2V0ID0gYXNzZXRzW2ldO1xuICAgICAgICAgICAgICAgIGlmICghKGFzc2V0IGluc3RhbmNlb2YgQXNzZXQpKVxuICAgICAgICAgICAgICAgICAgICBhc3NldCA9IHJlZ2lzdHJ5LmdldChhc3NldCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYXNzZXQgJiYgIWFzc2V0LnJlc291cmNlKVxuICAgICAgICAgICAgICAgICAgICByZWdpc3RyeS5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmFjdGl2YXRlICYmICF0aGlzLmN1cnJBbmltKSB7XG4gICAgICAgICAgICBjb25zdCBhbmltYXRpb25OYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMuYW5pbWF0aW9ucyk7XG4gICAgICAgICAgICBpZiAoYW5pbWF0aW9uTmFtZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMucGxheShhbmltYXRpb25OYW1lc1swXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkJlZm9yZVJlbW92ZSgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFzc2V0cy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAvLyB0aGlzLmFzc2V0cyBjYW4gYmUgYW4gYXJyYXkgb2YgcGMuQXNzZXRzIG9yIGFuIGFycmF5IG9mIG51bWJlcnMgKGFzc2V0SWRzKVxuICAgICAgICAgICAgbGV0IGFzc2V0ID0gdGhpcy5hc3NldHNbaV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIGFzc2V0ID09PSAgJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFhc3NldCkgY29udGludWU7XG5cbiAgICAgICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5vbkFzc2V0Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5za2VsZXRvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuZnJvbVNrZWwgPSBudWxsO1xuICAgICAgICB0aGlzLnRvU2tlbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIHN0YXRlIG9mIHRoZSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgdGltZSBkZWx0YS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGR0KSB7XG4gICAgICAgIC8vIHVwZGF0ZSBibGVuZGluZ1xuICAgICAgICBpZiAodGhpcy5ibGVuZGluZykge1xuICAgICAgICAgICAgdGhpcy5ibGVuZCArPSBkdCAqIHRoaXMuYmxlbmRTcGVlZDtcbiAgICAgICAgICAgIGlmICh0aGlzLmJsZW5kID49IDEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJsZW5kID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBza2VsZXRvblxuICAgICAgICBpZiAodGhpcy5wbGF5aW5nKSB7XG4gICAgICAgICAgICBjb25zdCBza2VsZXRvbiA9IHRoaXMuc2tlbGV0b247XG4gICAgICAgICAgICBpZiAoc2tlbGV0b24gIT09IG51bGwgJiYgdGhpcy5tb2RlbCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIHNrZWxldG9uLmJsZW5kKHRoaXMuZnJvbVNrZWwsIHRoaXMudG9Ta2VsLCB0aGlzLmJsZW5kKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBBZHZhbmNlIHRoZSBhbmltYXRpb24sIGludGVycG9sYXRpbmcga2V5ZnJhbWVzIGF0IGVhY2ggYW5pbWF0ZWQgbm9kZSBpblxuICAgICAgICAgICAgICAgICAgICAvLyBza2VsZXRvblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWx0YSA9IGR0ICogdGhpcy5zcGVlZDtcbiAgICAgICAgICAgICAgICAgICAgc2tlbGV0b24uYWRkVGltZShkZWx0YSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnNwZWVkID4gMCAmJiAoc2tlbGV0b24uX3RpbWUgPT09IHNrZWxldG9uLmFuaW1hdGlvbi5kdXJhdGlvbikgJiYgIXRoaXMubG9vcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5zcGVlZCA8IDAgJiYgc2tlbGV0b24uX3RpbWUgPT09IDAgJiYgIXRoaXMubG9vcCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ibGVuZGluZyAmJiAodGhpcy5ibGVuZCA9PT0gMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tlbGV0b24uYW5pbWF0aW9uID0gdGhpcy50b1NrZWwuYW5pbWF0aW9uO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHNrZWxldG9uLnVwZGF0ZUdyYXBoKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgYW5pbSBjb250cm9sbGVyXG4gICAgICAgIGNvbnN0IGFuaW1FdmFsdWF0b3IgPSB0aGlzLmFuaW1FdmFsdWF0b3I7XG4gICAgICAgIGlmIChhbmltRXZhbHVhdG9yKSB7XG5cbiAgICAgICAgICAgIC8vIGZvcmNlIGFsbCBjbGlwcycgc3BlZWQgYW5kIHBsYXlpbmcgc3RhdGUgZnJvbSB0aGUgY29tcG9uZW50XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFuaW1FdmFsdWF0b3IuY2xpcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbGlwID0gYW5pbUV2YWx1YXRvci5jbGlwc1tpXTtcbiAgICAgICAgICAgICAgICBjbGlwLnNwZWVkID0gdGhpcy5zcGVlZDtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMucGxheWluZykge1xuICAgICAgICAgICAgICAgICAgICBjbGlwLnBhdXNlKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2xpcC5yZXN1bWUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBibGVuZCB3ZWlnaHRcbiAgICAgICAgICAgIGlmICh0aGlzLmJsZW5kaW5nICYmIGFuaW1FdmFsdWF0b3IuY2xpcHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGFuaW1FdmFsdWF0b3IuY2xpcHNbMV0uYmxlbmRXZWlnaHQgPSB0aGlzLmJsZW5kO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhbmltRXZhbHVhdG9yLnVwZGF0ZShkdCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGVhciBibGVuZGluZyBmbGFnXG4gICAgICAgIGlmICh0aGlzLmJsZW5kaW5nICYmIHRoaXMuYmxlbmQgPT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgQW5pbWF0aW9uQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiQW5pbWF0aW9uQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfYW5pbWF0aW9ucyIsIl9hc3NldHMiLCJfbG9vcCIsImFuaW1FdmFsdWF0b3IiLCJtb2RlbCIsInNrZWxldG9uIiwiZnJvbVNrZWwiLCJ0b1NrZWwiLCJhbmltYXRpb25zSW5kZXgiLCJwcmV2QW5pbSIsImN1cnJBbmltIiwiYmxlbmQiLCJibGVuZGluZyIsImJsZW5kU3BlZWQiLCJhY3RpdmF0ZSIsInNwZWVkIiwiYW5pbWF0aW9ucyIsInZhbHVlIiwib25TZXRBbmltYXRpb25zIiwiYXNzZXRzIiwibGVuZ3RoIiwiaSIsImFzc2V0IiwiYXBwIiwiZ2V0Iiwib2ZmIiwib25Bc3NldENoYW5nZWQiLCJvbkFzc2V0UmVtb3ZlZCIsImFuaW1OYW1lIiwiaWQiLCJfc3RvcEN1cnJlbnRBbmltYXRpb24iLCJhc3NldElkcyIsIm1hcCIsIkFzc2V0IiwibG9hZEFuaW1hdGlvbkFzc2V0cyIsImN1cnJlbnRUaW1lIiwiYWRkVGltZSIsInVwZGF0ZUdyYXBoIiwiY2xpcHMiLCJ0aW1lIiwiX3RpbWUiLCJkdXJhdGlvbiIsIkRlYnVnIiwid2FybiIsImxvb3AiLCJsb29waW5nIiwicGxheSIsIm5hbWUiLCJibGVuZFRpbWUiLCJlbmFibGVkIiwiZXJyb3IiLCJfY3JlYXRlQW5pbWF0aW9uQ29udHJvbGxlciIsImFuaW1hdGlvbiIsInJlbW92ZUNsaXAiLCJyZW1vdmVDbGlwcyIsImNsaXAiLCJBbmltQ2xpcCIsImJsZW5kV2VpZ2h0IiwicmVzZXQiLCJhZGRDbGlwIiwicGxheWluZyIsImdldEFuaW1hdGlvbiIsInNldE1vZGVsIiwiX3Jlc2V0QW5pbWF0aW9uQ29udHJvbGxlciIsIm1vZGVsQ29tcG9uZW50IiwibSIsImFuaW1hdGlvbk5hbWVzIiwiT2JqZWN0Iiwia2V5cyIsImhhc0pzb24iLCJoYXNHbGIiLCJoYXNPd25Qcm9wZXJ0eSIsImFuaW0iLCJBbmltVHJhY2siLCJncmFwaCIsImdldEdyYXBoIiwiU2tlbGV0b24iLCJzZXRHcmFwaCIsIkFuaW1FdmFsdWF0b3IiLCJEZWZhdWx0QW5pbUJpbmRlciIsImlkcyIsIm9uQXNzZXRSZWFkeSIsInJlc291cmNlcyIsInJlc291cmNlIiwib25Bc3NldEFkZCIsIm9uIiwib25jZSIsImxvYWQiLCJsIiwiYXR0cmlidXRlIiwibmV3VmFsdWUiLCJvbGRWYWx1ZSIsInJlc3RhcnRlZCIsInN0b3AiLCJ1cGRhdGUiLCJvbkVuYWJsZSIsInJlZ2lzdHJ5IiwibGVuIiwib25CZWZvcmVSZW1vdmUiLCJkdCIsImRlbHRhIiwicGF1c2UiLCJyZXN1bWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBdUJBLE1BQU1BLGtCQUFrQixTQUFTQyxTQUFTLENBQUM7O0FBZ0d2Q0MsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUFDLElBNUYxQkMsQ0FBQUEsV0FBVyxHQUFHLEVBQUUsQ0FBQTtJQUFBLElBTWhCQyxDQUFBQSxPQUFPLEdBQUcsRUFBRSxDQUFBO0lBQUEsSUFHWkMsQ0FBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtJQUFBLElBTVpDLENBQUFBLGFBQWEsR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1wQkMsQ0FBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtJQUFBLElBUVpDLENBQUFBLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1mQyxDQUFBQSxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFNZkMsQ0FBQUEsTUFBTSxHQUFHLElBQUksQ0FBQTtJQUFBLElBTWJDLENBQUFBLGVBQWUsR0FBRyxFQUFFLENBQUE7SUFBQSxJQU1wQkMsQ0FBQUEsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUFBLElBTWZDLENBQUFBLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFB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
