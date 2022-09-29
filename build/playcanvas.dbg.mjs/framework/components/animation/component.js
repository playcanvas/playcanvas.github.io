/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { AnimClip } from '../../../anim/evaluator/anim-clip.js';
import { AnimEvaluator } from '../../../anim/evaluator/anim-evaluator.js';
import { AnimTrack } from '../../../anim/evaluator/anim-track.js';
import { DefaultAnimBinder } from '../../../anim/binder/default-anim-binder.js';
import { Skeleton } from '../../../animation/skeleton.js';
import { Asset } from '../../../asset/asset.js';
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
    return this.animations[this.currAnim].duration;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYW5pbWF0aW9uL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBBbmltQ2xpcCB9IGZyb20gJy4uLy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tY2xpcC5qcyc7XG5pbXBvcnQgeyBBbmltRXZhbHVhdG9yIH0gZnJvbSAnLi4vLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1ldmFsdWF0b3IuanMnO1xuaW1wb3J0IHsgQW5pbVRyYWNrIH0gZnJvbSAnLi4vLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS10cmFjay5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0QW5pbUJpbmRlciB9IGZyb20gJy4uLy4uLy4uL2FuaW0vYmluZGVyL2RlZmF1bHQtYW5pbS1iaW5kZXIuanMnO1xuXG5pbXBvcnQgeyBTa2VsZXRvbiB9IGZyb20gJy4uLy4uLy4uL2FuaW1hdGlvbi9za2VsZXRvbi5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vYW5pbWF0aW9uL2FuaW1hdGlvbi5qcycpLkFuaW1hdGlvbn0gQW5pbWF0aW9uICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnKS5Nb2RlbH0gTW9kZWwgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IEVudGl0eSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuQW5pbWF0aW9uQ29tcG9uZW50U3lzdGVtfSBBbmltYXRpb25Db21wb25lbnRTeXN0ZW0gKi9cblxuLyoqXG4gKiBUaGUgQW5pbWF0aW9uIENvbXBvbmVudCBhbGxvd3MgYW4gRW50aXR5IHRvIHBsYXliYWNrIGFuaW1hdGlvbnMgb24gbW9kZWxzLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgQW5pbWF0aW9uQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgQW5pbWF0aW9uPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hbmltYXRpb25zID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXJyYXkuPG51bWJlcnxBc3NldD59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYXNzZXRzID0gW107XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbG9vcCA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QW5pbUV2YWx1YXRvcnxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhbmltRXZhbHVhdG9yID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNb2RlbHxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBtb2RlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHNrZWxldG9uIGZvciB0aGUgY3VycmVudCBtb2RlbC4gSWYgdGhlIG1vZGVsIGlzIGxvYWRlZCBmcm9tIGdsVEYvZ2xiLCB0aGVuIHRoZVxuICAgICAqIHNrZWxldG9uIGlzIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2tlbGV0b258bnVsbH1cbiAgICAgKi9cbiAgICBza2VsZXRvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U2tlbGV0b258bnVsbH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZnJvbVNrZWwgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NrZWxldG9ufG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHRvU2tlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYW5pbWF0aW9uc0luZGV4ID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwcmV2QW5pbSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7c3RyaW5nfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBjdXJyQW5pbSA9IG51bGw7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBibGVuZCA9IDA7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBibGVuZGluZyA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgYmxlbmRTcGVlZCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBmaXJzdCBhbmltYXRpb24gYXNzZXQgd2lsbCBiZWdpbiBwbGF5aW5nIHdoZW4gdGhlIHNjZW5lIGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFjdGl2YXRlID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFNwZWVkIG11bHRpcGxpZXIgZm9yIGFuaW1hdGlvbiBwbGF5IGJhY2suIDEgaXMgcGxheWJhY2sgYXQgbm9ybWFsIHNwZWVkIGFuZCAwIHBhdXNlcyB0aGVcbiAgICAgKiBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNwZWVkID0gMTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBbmltYXRpb25Db21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FuaW1hdGlvbkNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIHtAbGluayBDb21wb25lbnRTeXN0ZW19IHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tdXNlbGVzcy1jb25zdHJ1Y3RvclxuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IG9yIHNldCBkaWN0aW9uYXJ5IG9mIGFuaW1hdGlvbnMgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBBbmltYXRpb24+fVxuICAgICAqL1xuICAgIHNldCBhbmltYXRpb25zKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FuaW1hdGlvbnMgPSB2YWx1ZTtcblxuICAgICAgICB0aGlzLm9uU2V0QW5pbWF0aW9ucygpO1xuICAgIH1cblxuICAgIGdldCBhbmltYXRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pbWF0aW9ucztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXJyYXkgb2YgYW5pbWF0aW9uIGFzc2V0cy4gQ2FuIGFsc28gYmUgYW4gYXJyYXkgb2YgYXNzZXQgaWRzLlxuICAgICAqXG4gICAgICogQHR5cGUge0FycmF5LjxudW1iZXJ8QXNzZXQ+fVxuICAgICAqL1xuICAgIHNldCBhc3NldHModmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fYXNzZXRzO1xuXG4gICAgICAgIGlmIChhc3NldHMgJiYgYXNzZXRzLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIGNoYW5nZSBldmVudCBmb3Igb2xkIGFzc2V0c1xuICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldHNbaV0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5vbkFzc2V0Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbmltTmFtZSA9IHRoaXMuYW5pbWF0aW9uc0luZGV4W2Fzc2V0LmlkXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0gPT09IGFuaW1OYW1lKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3N0b3BDdXJyZW50QW5pbWF0aW9uKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbYW5pbU5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc0luZGV4W2Fzc2V0LmlkXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Fzc2V0cyA9IHZhbHVlO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0SWRzID0gdmFsdWUubWFwKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSA/IHZhbHVlLmlkIDogdmFsdWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMubG9hZEFuaW1hdGlvbkFzc2V0cyhhc3NldElkcyk7XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgb3Igc2V0IHRoZSBjdXJyZW50IHRpbWUgcG9zaXRpb24gKGluIHNlY29uZHMpIG9mIHRoZSBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjdXJyZW50VGltZShjdXJyZW50VGltZSkge1xuICAgICAgICBpZiAodGhpcy5za2VsZXRvbikge1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5jdXJyZW50VGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5hZGRUaW1lKDApO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi51cGRhdGVHcmFwaCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYW5pbUV2YWx1YXRvcikge1xuICAgICAgICAgICAgY29uc3QgY2xpcHMgPSB0aGlzLmFuaW1FdmFsdWF0b3IuY2xpcHM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNsaXBzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgY2xpcHNbaV0udGltZSA9IGN1cnJlbnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGN1cnJlbnRUaW1lKCkge1xuICAgICAgICBpZiAodGhpcy5za2VsZXRvbikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2tlbGV0b24uX3RpbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5hbmltRXZhbHVhdG9yKSB7XG4gICAgICAgICAgICAvLyBHZXQgdGhlIGxhc3QgY2xpcCdzIGN1cnJlbnQgdGltZSB3aGljaCB3aWxsIGJlIHRoZSBvbmVcbiAgICAgICAgICAgIC8vIHRoYXQgaXMgY3VycmVudGx5IGJlaW5nIGJsZW5kZWRcbiAgICAgICAgICAgIGNvbnN0IGNsaXBzID0gdGhpcy5hbmltRXZhbHVhdG9yLmNsaXBzO1xuICAgICAgICAgICAgaWYgKGNsaXBzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY2xpcHNbY2xpcHMubGVuZ3RoIC0gMV0udGltZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZHVyYXRpb24gaW4gc2Vjb25kcyBvZiB0aGUgY3VycmVudCBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBkdXJhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYW5pbWF0aW9uc1t0aGlzLmN1cnJBbmltXS5kdXJhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBhbmltYXRpb24gd2lsbCByZXN0YXJ0IGZyb20gdGhlIGJlZ2lubmluZyB3aGVuIGl0IHJlYWNoZXMgdGhlIGVuZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsb29wKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xvb3AgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5za2VsZXRvbikge1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5sb29waW5nID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5hbmltRXZhbHVhdG9yKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYW5pbUV2YWx1YXRvci5jbGlwcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvci5jbGlwc1tpXS5sb29wID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbG9vcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvb3A7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgcGxheWluZyBhbiBhbmltYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBhbmltYXRpb24gYXNzZXQgdG8gYmVnaW4gcGxheWluZy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2JsZW5kVGltZV0gLSBUaGUgdGltZSBpbiBzZWNvbmRzIHRvIGJsZW5kIGZyb20gdGhlIGN1cnJlbnRcbiAgICAgKiBhbmltYXRpb24gc3RhdGUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBhbmltYXRpb24gYmVpbmcgc2V0LiBEZWZhdWx0cyB0byAwLlxuICAgICAqL1xuICAgIHBsYXkobmFtZSwgYmxlbmRUaW1lID0gMCkge1xuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmFuaW1hdGlvbnNbbmFtZV0pIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKGBUcnlpbmcgdG8gcGxheSBhbmltYXRpb24gJyR7bmFtZX0nIHdoaWNoIGRvZXNuJ3QgZXhpc3RgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucHJldkFuaW0gPSB0aGlzLmN1cnJBbmltO1xuICAgICAgICB0aGlzLmN1cnJBbmltID0gbmFtZTtcblxuICAgICAgICBpZiAodGhpcy5tb2RlbCkge1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuc2tlbGV0b24gJiYgIXRoaXMuYW5pbUV2YWx1YXRvcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2NyZWF0ZUFuaW1hdGlvbkNvbnRyb2xsZXIoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJldkFuaW0gPSB0aGlzLmFuaW1hdGlvbnNbdGhpcy5wcmV2QW5pbV07XG4gICAgICAgICAgICBjb25zdCBjdXJyQW5pbSA9IHRoaXMuYW5pbWF0aW9uc1t0aGlzLmN1cnJBbmltXTtcblxuICAgICAgICAgICAgdGhpcy5ibGVuZGluZyA9IGJsZW5kVGltZSA+IDAgJiYgISF0aGlzLnByZXZBbmltO1xuICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmJsZW5kID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLmJsZW5kU3BlZWQgPSAxIC8gYmxlbmRUaW1lO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5za2VsZXRvbikge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEJsZW5kIGZyb20gdGhlIGN1cnJlbnQgdGltZSBvZiB0aGUgY3VycmVudCBhbmltYXRpb24gdG8gdGhlIHN0YXJ0IG9mXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBuZXdseSBzcGVjaWZpZWQgYW5pbWF0aW9uIG92ZXIgdGhlIHNwZWNpZmllZCBibGVuZCB0aW1lIHBlcmlvZC5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mcm9tU2tlbC5hbmltYXRpb24gPSBwcmV2QW5pbTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mcm9tU2tlbC5hZGRUaW1lKHRoaXMuc2tlbGV0b24uX3RpbWUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRvU2tlbC5hbmltYXRpb24gPSBjdXJyQW5pbTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNrZWxldG9uLmFuaW1hdGlvbiA9IGN1cnJBbmltO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuYW5pbUV2YWx1YXRvcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFuaW1FdmFsdWF0b3IgPSB0aGlzLmFuaW1FdmFsdWF0b3I7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5ibGVuZGluZykge1xuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgYWxsIGJ1dCB0aGUgbGFzdCBjbGlwXG4gICAgICAgICAgICAgICAgICAgIHdoaWxlIChhbmltRXZhbHVhdG9yLmNsaXBzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuaW1FdmFsdWF0b3IucmVtb3ZlQ2xpcCgwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvci5yZW1vdmVDbGlwcygpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNsaXAgPSBuZXcgQW5pbUNsaXAodGhpcy5hbmltYXRpb25zW3RoaXMuY3VyckFuaW1dLCAwLCAxLjAsIHRydWUsIHRoaXMubG9vcCk7XG4gICAgICAgICAgICAgICAgY2xpcC5uYW1lID0gdGhpcy5jdXJyQW5pbTtcbiAgICAgICAgICAgICAgICBjbGlwLmJsZW5kV2VpZ2h0ID0gdGhpcy5ibGVuZGluZyA/IDAgOiAxO1xuICAgICAgICAgICAgICAgIGNsaXAucmVzZXQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IuYWRkQ2xpcChjbGlwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGxheWluZyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGFuIGFuaW1hdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGFuaW1hdGlvbiBhc3NldC5cbiAgICAgKiBAcmV0dXJucyB7QW5pbWF0aW9ufSBBbiBBbmltYXRpb24uXG4gICAgICovXG4gICAgZ2V0QW5pbWF0aW9uKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYW5pbWF0aW9uc1tuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIG1vZGVsIGRyaXZlbiBieSB0aGlzIGFuaW1hdGlvbiBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01vZGVsfSBtb2RlbCAtIFRoZSBtb2RlbCB0byBzZXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldE1vZGVsKG1vZGVsKSB7XG4gICAgICAgIGlmIChtb2RlbCAhPT0gdGhpcy5tb2RlbCkge1xuICAgICAgICAgICAgLy8gcmVzZXQgYW5pbWF0aW9uIGNvbnRyb2xsZXJcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0QW5pbWF0aW9uQ29udHJvbGxlcigpO1xuXG4gICAgICAgICAgICAvLyBzZXQgdGhlIG1vZGVsXG4gICAgICAgICAgICB0aGlzLm1vZGVsID0gbW9kZWw7XG5cbiAgICAgICAgICAgIC8vIFJlc2V0IHRoZSBjdXJyZW50IGFuaW1hdGlvbiBvbiB0aGUgbmV3IG1vZGVsXG4gICAgICAgICAgICBpZiAodGhpcy5hbmltYXRpb25zICYmIHRoaXMuY3VyckFuaW0gJiYgdGhpcy5hbmltYXRpb25zW3RoaXMuY3VyckFuaW1dKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KHRoaXMuY3VyckFuaW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRBbmltYXRpb25zKCkge1xuICAgICAgICAvLyBJZiB3ZSBoYXZlIGFuaW1hdGlvbnMgX2FuZF8gYSBtb2RlbCwgd2UgY2FuIGNyZWF0ZSB0aGUgc2tlbGV0b25zXG4gICAgICAgIGNvbnN0IG1vZGVsQ29tcG9uZW50ID0gdGhpcy5lbnRpdHkubW9kZWw7XG4gICAgICAgIGlmIChtb2RlbENvbXBvbmVudCkge1xuICAgICAgICAgICAgY29uc3QgbSA9IG1vZGVsQ29tcG9uZW50Lm1vZGVsO1xuICAgICAgICAgICAgaWYgKG0gJiYgbSAhPT0gdGhpcy5tb2RlbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0TW9kZWwobSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuY3VyckFuaW0gJiYgdGhpcy5hY3RpdmF0ZSAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgLy8gU2V0IHRoZSBmaXJzdCBsb2FkZWQgYW5pbWF0aW9uIGFzIHRoZSBjdXJyZW50XG4gICAgICAgICAgICBjb25zdCBhbmltYXRpb25OYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMuX2FuaW1hdGlvbnMpO1xuICAgICAgICAgICAgaWYgKGFuaW1hdGlvbk5hbWVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBsYXkoYW5pbWF0aW9uTmFtZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3Jlc2V0QW5pbWF0aW9uQ29udHJvbGxlcigpIHtcbiAgICAgICAgdGhpcy5za2VsZXRvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuZnJvbVNrZWwgPSBudWxsO1xuICAgICAgICB0aGlzLnRvU2tlbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfY3JlYXRlQW5pbWF0aW9uQ29udHJvbGxlcigpIHtcbiAgICAgICAgY29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsO1xuICAgICAgICBjb25zdCBhbmltYXRpb25zID0gdGhpcy5hbmltYXRpb25zO1xuXG4gICAgICAgIC8vIGNoZWNrIHdoaWNoIHR5cGUgb2YgYW5pbWF0aW9ucyBhcmUgbG9hZGVkXG4gICAgICAgIGxldCBoYXNKc29uID0gZmFsc2U7XG4gICAgICAgIGxldCBoYXNHbGIgPSBmYWxzZTtcbiAgICAgICAgZm9yIChjb25zdCBhbmltYXRpb24gaW4gYW5pbWF0aW9ucykge1xuICAgICAgICAgICAgaWYgKGFuaW1hdGlvbnMuaGFzT3duUHJvcGVydHkoYW5pbWF0aW9uKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFuaW0gPSBhbmltYXRpb25zW2FuaW1hdGlvbl07XG4gICAgICAgICAgICAgICAgaWYgKGFuaW0uY29uc3RydWN0b3IgPT09IEFuaW1UcmFjaykge1xuICAgICAgICAgICAgICAgICAgICBoYXNHbGIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc0pzb24gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyYXBoID0gbW9kZWwuZ2V0R3JhcGgoKTtcbiAgICAgICAgaWYgKGhhc0pzb24pIHtcbiAgICAgICAgICAgIHRoaXMuZnJvbVNrZWwgPSBuZXcgU2tlbGV0b24oZ3JhcGgpO1xuICAgICAgICAgICAgdGhpcy50b1NrZWwgPSBuZXcgU2tlbGV0b24oZ3JhcGgpO1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbiA9IG5ldyBTa2VsZXRvbihncmFwaCk7XG4gICAgICAgICAgICB0aGlzLnNrZWxldG9uLmxvb3BpbmcgPSB0aGlzLmxvb3A7XG4gICAgICAgICAgICB0aGlzLnNrZWxldG9uLnNldEdyYXBoKGdyYXBoKTtcbiAgICAgICAgfSBlbHNlIGlmIChoYXNHbGIpIHtcbiAgICAgICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvciA9IG5ldyBBbmltRXZhbHVhdG9yKG5ldyBEZWZhdWx0QW5pbUJpbmRlcih0aGlzLmVudGl0eSkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gaWRzIC0gQXJyYXkgb2YgYW5pbWF0aW9uIGFzc2V0IGlkcy5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGxvYWRBbmltYXRpb25Bc3NldHMoaWRzKSB7XG4gICAgICAgIGlmICghaWRzIHx8ICFpZHMubGVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG5cbiAgICAgICAgY29uc3Qgb25Bc3NldFJlYWR5ID0gKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2VzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0LnJlc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNbYXNzZXQucmVzb3VyY2VzW2ldLm5hbWVdID0gYXNzZXQucmVzb3VyY2VzW2ldO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF0gPSBhc3NldC5yZXNvdXJjZXNbaV0ubmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9uc1thc3NldC5uYW1lXSA9IGFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9uc0luZGV4W2Fzc2V0LmlkXSA9IGFzc2V0Lm5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICAgICAgdGhpcy5hbmltYXRpb25zID0gdGhpcy5hbmltYXRpb25zOyAvLyBhc3NpZ25pbmcgZW5zdXJlcyBzZXRfYW5pbWF0aW9ucyBldmVudCBpcyBmaXJlZFxuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG9uQXNzZXRBZGQgPSAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5vbkFzc2V0Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5vbkFzc2V0Q2hhbmdlZCwgdGhpcyk7XG5cbiAgICAgICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG5cbiAgICAgICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgIG9uQXNzZXRSZWFkeShhc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFzc2V0Lm9uY2UoJ2xvYWQnLCBvbkFzc2V0UmVhZHksIHRoaXMpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gaWRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KGlkc1tpXSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBvbkFzc2V0QWRkKGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIGlkc1tpXSwgb25Bc3NldEFkZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgYXNzZXQgY2hhbmdlIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgY2hhbmdlZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYXR0cmlidXRlIC0gVGhlIG5hbWUgb2YgdGhlIGFzc2V0IGF0dHJpYnV0ZSB0aGF0IGNoYW5nZWQuIENhbiBiZSAnZGF0YScsXG4gICAgICogJ2ZpbGUnLCAncmVzb3VyY2UnIG9yICdyZXNvdXJjZXMnLlxuICAgICAqIEBwYXJhbSB7Kn0gbmV3VmFsdWUgLSBUaGUgbmV3IHZhbHVlIG9mIHRoZSBzcGVjaWZpZWQgYXNzZXQgcHJvcGVydHkuXG4gICAgICogQHBhcmFtIHsqfSBvbGRWYWx1ZSAtIFRoZSBvbGQgdmFsdWUgb2YgdGhlIHNwZWNpZmllZCBhc3NldCBwcm9wZXJ0eS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uQXNzZXRDaGFuZ2VkKGFzc2V0LCBhdHRyaWJ1dGUsIG5ld1ZhbHVlLCBvbGRWYWx1ZSkge1xuICAgICAgICBpZiAoYXR0cmlidXRlID09PSAncmVzb3VyY2UnIHx8IGF0dHJpYnV0ZSA9PT0gJ3Jlc291cmNlcycpIHtcbiAgICAgICAgICAgIC8vIElmIHRoZSBhdHRyaWJ1dGUgaXMgJ3Jlc291cmNlcycsIG5ld1ZhbHVlIGNhbiBiZSBhbiBlbXB0eSBhcnJheSB3aGVuIHRoZVxuICAgICAgICAgICAgLy8gYXNzZXQgaXMgdW5sb2FkZWQuIFRoZXJlZm9yZSwgd2Ugc2hvdWxkIGFzc2lnbiBudWxsIGluIHRoaXMgY2FzZVxuICAgICAgICAgICAgaWYgKGF0dHJpYnV0ZSA9PT0gJ3Jlc291cmNlcycgJiYgbmV3VmFsdWUgJiYgbmV3VmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZXBsYWNlIG9sZCBhbmltYXRpb24gd2l0aCBuZXcgb25lXG4gICAgICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzdGFydGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKG5ld1ZhbHVlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9sZFZhbHVlICYmIG9sZFZhbHVlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5hbmltYXRpb25zW29sZFZhbHVlW2ldLm5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc1thc3NldC5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXN0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hbmltYXRpb25zW25ld1ZhbHVlW2ldLm5hbWVdID0gbmV3VmFsdWVbaV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmVzdGFydGVkICYmIHRoaXMuY3VyckFuaW0gPT09IG5ld1ZhbHVlW2ldLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZXN0YXJ0IGFuaW1hdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnBsYXlpbmcgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdGFydGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5KG5ld1ZhbHVlW2ldLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlc3RhcnRlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RvcEN1cnJlbnRBbmltYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub25TZXRBbmltYXRpb25zKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAob2xkVmFsdWUgJiYgb2xkVmFsdWUubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvbGRWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbb2xkVmFsdWVbaV0ubmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNbYXNzZXQubmFtZV0gPSBuZXdWYWx1ZVswXSB8fCBuZXdWYWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdGFydGVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJBbmltID09PSBhc3NldC5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZXN0YXJ0IGFuaW1hdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGxheWluZyAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wbGF5KGFzc2V0Lm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVzdGFydGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9wQ3VycmVudEFuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vblNldEFuaW1hdGlvbnMoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF0gPSBhc3NldC5uYW1lO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAob2xkVmFsdWUubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9sZFZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5hbmltYXRpb25zW29sZFZhbHVlW2ldLm5hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0gPT09IG9sZFZhbHVlW2ldLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9wQ3VycmVudEFuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc1thc3NldC5uYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VyckFuaW0gPT09IGFzc2V0Lm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3N0b3BDdXJyZW50QW5pbWF0aW9uKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc0luZGV4W2Fzc2V0LmlkXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgd2FzIHJlbW92ZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkFzc2V0UmVtb3ZlZChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMub25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0aGlzLmFuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgIGlmIChhc3NldC5yZXNvdXJjZXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXNzZXQucmVzb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNbYXNzZXQucmVzb3VyY2VzW2ldLm5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyQW5pbSA9PT0gYXNzZXQucmVzb3VyY2VzW2ldLm5hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9wQ3VycmVudEFuaW1hdGlvbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYW5pbWF0aW9uc1thc3NldC5uYW1lXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyQW5pbSA9PT0gYXNzZXQubmFtZSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RvcEN1cnJlbnRBbmltYXRpb24oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFuaW1hdGlvbnNJbmRleFthc3NldC5pZF07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc3RvcEN1cnJlbnRBbmltYXRpb24oKSB7XG4gICAgICAgIHRoaXMuY3VyckFuaW0gPSBudWxsO1xuXG4gICAgICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5za2VsZXRvbikge1xuICAgICAgICAgICAgdGhpcy5za2VsZXRvbi5jdXJyZW50VGltZSA9IDA7XG4gICAgICAgICAgICB0aGlzLnNrZWxldG9uLmFuaW1hdGlvbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuYW5pbUV2YWx1YXRvcikge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFuaW1FdmFsdWF0b3IuY2xpcHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IuY2xpcHNbaV0uc3RvcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5hbmltRXZhbHVhdG9yLnVwZGF0ZSgwKTtcbiAgICAgICAgICAgIHRoaXMuYW5pbUV2YWx1YXRvci5yZW1vdmVDbGlwcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIHN1cGVyLm9uRW5hYmxlKCk7XG5cbiAgICAgICAgLy8gbG9hZCBhc3NldHMgaWYgdGhleSdyZSBub3QgbG9hZGVkXG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuYXNzZXRzO1xuICAgICAgICBjb25zdCByZWdpc3RyeSA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGlmIChhc3NldHMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBhc3NldHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsZXQgYXNzZXQgPSBhc3NldHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKCEoYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkpXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gcmVnaXN0cnkuZ2V0KGFzc2V0KTtcblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCAmJiAhYXNzZXQucmVzb3VyY2UpXG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJ5LmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYWN0aXZhdGUgJiYgIXRoaXMuY3VyckFuaW0pIHtcbiAgICAgICAgICAgIGNvbnN0IGFuaW1hdGlvbk5hbWVzID0gT2JqZWN0LmtleXModGhpcy5hbmltYXRpb25zKTtcbiAgICAgICAgICAgIGlmIChhbmltYXRpb25OYW1lcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGFuaW1hdGlvbk5hbWVzWzBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uQmVmb3JlUmVtb3ZlKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYXNzZXRzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgIC8vIHRoaXMuYXNzZXRzIGNhbiBiZSBhbiBhcnJheSBvZiBwYy5Bc3NldHMgb3IgYW4gYXJyYXkgb2YgbnVtYmVycyAoYXNzZXRJZHMpXG4gICAgICAgICAgICBsZXQgYXNzZXQgPSB0aGlzLmFzc2V0c1tpXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYXNzZXQgPT09ICAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWFzc2V0KSBjb250aW51ZTtcblxuICAgICAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLm9uQXNzZXRDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNrZWxldG9uID0gbnVsbDtcbiAgICAgICAgdGhpcy5mcm9tU2tlbCA9IG51bGw7XG4gICAgICAgIHRoaXMudG9Ta2VsID0gbnVsbDtcblxuICAgICAgICB0aGlzLmFuaW1FdmFsdWF0b3IgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSB0aGUgc3RhdGUgb2YgdGhlIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGRlbHRhLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgLy8gdXBkYXRlIGJsZW5kaW5nXG4gICAgICAgIGlmICh0aGlzLmJsZW5kaW5nKSB7XG4gICAgICAgICAgICB0aGlzLmJsZW5kICs9IGR0ICogdGhpcy5ibGVuZFNwZWVkO1xuICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmQgPj0gMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuYmxlbmQgPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIHNrZWxldG9uXG4gICAgICAgIGlmICh0aGlzLnBsYXlpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IHNrZWxldG9uID0gdGhpcy5za2VsZXRvbjtcbiAgICAgICAgICAgIGlmIChza2VsZXRvbiAhPT0gbnVsbCAmJiB0aGlzLm1vZGVsICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tlbGV0b24uYmxlbmQodGhpcy5mcm9tU2tlbCwgdGhpcy50b1NrZWwsIHRoaXMuYmxlbmQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEFkdmFuY2UgdGhlIGFuaW1hdGlvbiwgaW50ZXJwb2xhdGluZyBrZXlmcmFtZXMgYXQgZWFjaCBhbmltYXRlZCBub2RlIGluXG4gICAgICAgICAgICAgICAgICAgIC8vIHNrZWxldG9uXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlbHRhID0gZHQgKiB0aGlzLnNwZWVkO1xuICAgICAgICAgICAgICAgICAgICBza2VsZXRvbi5hZGRUaW1lKGRlbHRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuc3BlZWQgPiAwICYmIChza2VsZXRvbi5fdGltZSA9PT0gc2tlbGV0b24uYW5pbWF0aW9uLmR1cmF0aW9uKSAmJiAhdGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNwZWVkIDwgMCAmJiBza2VsZXRvbi5fdGltZSA9PT0gMCAmJiAhdGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnBsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmJsZW5kaW5nICYmICh0aGlzLmJsZW5kID09PSAxKSkge1xuICAgICAgICAgICAgICAgICAgICBza2VsZXRvbi5hbmltYXRpb24gPSB0aGlzLnRvU2tlbC5hbmltYXRpb247XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgc2tlbGV0b24udXBkYXRlR3JhcGgoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBhbmltIGNvbnRyb2xsZXJcbiAgICAgICAgY29uc3QgYW5pbUV2YWx1YXRvciA9IHRoaXMuYW5pbUV2YWx1YXRvcjtcbiAgICAgICAgaWYgKGFuaW1FdmFsdWF0b3IpIHtcblxuICAgICAgICAgICAgLy8gZm9yY2UgYWxsIGNsaXBzJyBzcGVlZCBhbmQgcGxheWluZyBzdGF0ZSBmcm9tIHRoZSBjb21wb25lbnRcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYW5pbUV2YWx1YXRvci5jbGlwcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNsaXAgPSBhbmltRXZhbHVhdG9yLmNsaXBzW2ldO1xuICAgICAgICAgICAgICAgIGNsaXAuc3BlZWQgPSB0aGlzLnNwZWVkO1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5wbGF5aW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNsaXAucGF1c2UoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjbGlwLnJlc3VtZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIGJsZW5kIHdlaWdodFxuICAgICAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcgJiYgYW5pbUV2YWx1YXRvci5jbGlwcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgYW5pbUV2YWx1YXRvci5jbGlwc1sxXS5ibGVuZFdlaWdodCA9IHRoaXMuYmxlbmQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGFuaW1FdmFsdWF0b3IudXBkYXRlKGR0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGJsZW5kaW5nIGZsYWdcbiAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcgJiYgdGhpcy5ibGVuZCA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5ibGVuZGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltYXRpb25Db21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJBbmltYXRpb25Db21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9hbmltYXRpb25zIiwiX2Fzc2V0cyIsIl9sb29wIiwiYW5pbUV2YWx1YXRvciIsIm1vZGVsIiwic2tlbGV0b24iLCJmcm9tU2tlbCIsInRvU2tlbCIsImFuaW1hdGlvbnNJbmRleCIsInByZXZBbmltIiwiY3VyckFuaW0iLCJibGVuZCIsImJsZW5kaW5nIiwiYmxlbmRTcGVlZCIsImFjdGl2YXRlIiwic3BlZWQiLCJhbmltYXRpb25zIiwidmFsdWUiLCJvblNldEFuaW1hdGlvbnMiLCJhc3NldHMiLCJsZW5ndGgiLCJpIiwiYXNzZXQiLCJhcHAiLCJnZXQiLCJvZmYiLCJvbkFzc2V0Q2hhbmdlZCIsIm9uQXNzZXRSZW1vdmVkIiwiYW5pbU5hbWUiLCJpZCIsIl9zdG9wQ3VycmVudEFuaW1hdGlvbiIsImFzc2V0SWRzIiwibWFwIiwiQXNzZXQiLCJsb2FkQW5pbWF0aW9uQXNzZXRzIiwiY3VycmVudFRpbWUiLCJhZGRUaW1lIiwidXBkYXRlR3JhcGgiLCJjbGlwcyIsInRpbWUiLCJfdGltZSIsImR1cmF0aW9uIiwibG9vcCIsImxvb3BpbmciLCJwbGF5IiwibmFtZSIsImJsZW5kVGltZSIsImVuYWJsZWQiLCJEZWJ1ZyIsImVycm9yIiwiX2NyZWF0ZUFuaW1hdGlvbkNvbnRyb2xsZXIiLCJhbmltYXRpb24iLCJyZW1vdmVDbGlwIiwicmVtb3ZlQ2xpcHMiLCJjbGlwIiwiQW5pbUNsaXAiLCJibGVuZFdlaWdodCIsInJlc2V0IiwiYWRkQ2xpcCIsInBsYXlpbmciLCJnZXRBbmltYXRpb24iLCJzZXRNb2RlbCIsIl9yZXNldEFuaW1hdGlvbkNvbnRyb2xsZXIiLCJtb2RlbENvbXBvbmVudCIsIm0iLCJhbmltYXRpb25OYW1lcyIsIk9iamVjdCIsImtleXMiLCJoYXNKc29uIiwiaGFzR2xiIiwiaGFzT3duUHJvcGVydHkiLCJhbmltIiwiQW5pbVRyYWNrIiwiZ3JhcGgiLCJnZXRHcmFwaCIsIlNrZWxldG9uIiwic2V0R3JhcGgiLCJBbmltRXZhbHVhdG9yIiwiRGVmYXVsdEFuaW1CaW5kZXIiLCJpZHMiLCJvbkFzc2V0UmVhZHkiLCJyZXNvdXJjZXMiLCJyZXNvdXJjZSIsIm9uQXNzZXRBZGQiLCJvbiIsIm9uY2UiLCJsb2FkIiwibCIsImF0dHJpYnV0ZSIsIm5ld1ZhbHVlIiwib2xkVmFsdWUiLCJyZXN0YXJ0ZWQiLCJzdG9wIiwidXBkYXRlIiwib25FbmFibGUiLCJyZWdpc3RyeSIsImxlbiIsIm9uQmVmb3JlUmVtb3ZlIiwiZHQiLCJkZWx0YSIsInBhdXNlIiwicmVzdW1lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQXVCQSxNQUFNQSxrQkFBTixTQUFpQ0MsU0FBakMsQ0FBMkM7QUFnR3ZDQyxFQUFBQSxXQUFXLENBQUNDLE1BQUQsRUFBU0MsTUFBVCxFQUFpQjtJQUN4QixLQUFNRCxDQUFBQSxNQUFOLEVBQWNDLE1BQWQsQ0FBQSxDQUFBO0lBRHdCLElBM0Y1QkMsQ0FBQUEsV0EyRjRCLEdBM0ZkLEVBMkZjLENBQUE7SUFBQSxJQXJGNUJDLENBQUFBLE9BcUY0QixHQXJGbEIsRUFxRmtCLENBQUE7SUFBQSxJQWxGNUJDLENBQUFBLEtBa0Y0QixHQWxGcEIsSUFrRm9CLENBQUE7SUFBQSxJQTVFNUJDLENBQUFBLGFBNEU0QixHQTVFWixJQTRFWSxDQUFBO0lBQUEsSUF0RTVCQyxDQUFBQSxLQXNFNEIsR0F0RXBCLElBc0VvQixDQUFBO0lBQUEsSUE5RDVCQyxDQUFBQSxRQThENEIsR0E5RGpCLElBOERpQixDQUFBO0lBQUEsSUF4RDVCQyxDQUFBQSxRQXdENEIsR0F4RGpCLElBd0RpQixDQUFBO0lBQUEsSUFsRDVCQyxDQUFBQSxNQWtENEIsR0FsRG5CLElBa0RtQixDQUFBO0lBQUEsSUE1QzVCQyxDQUFBQSxlQTRDNEIsR0E1Q1YsRUE0Q1UsQ0FBQTtJQUFBLElBdEM1QkMsQ0FBQUEsUUFzQzRCLEdBdENqQixJQXNDaUIsQ0FBQTtJQUFBLElBaEM1QkMsQ0FBQUEsUUFnQzRCLEdBaENqQixJQWdDaUIsQ0FBQTtJQUFBLElBN0I1QkMsQ0FBQUEsS0E2QjRCLEdBN0JwQixDQTZCb0IsQ0FBQTtJQUFBLElBMUI1QkMsQ0FBQUEsUUEwQjRCLEdBMUJqQixLQTBCaUIsQ0FBQTtJQUFBLElBdkI1QkMsQ0FBQUEsVUF1QjRCLEdBdkJmLENBdUJlLENBQUE7SUFBQSxJQWhCNUJDLENBQUFBLFFBZ0I0QixHQWhCakIsSUFnQmlCLENBQUE7SUFBQSxJQVI1QkMsQ0FBQUEsS0FRNEIsR0FScEIsQ0FRb0IsQ0FBQTtBQUUzQixHQUFBOztFQU9hLElBQVZDLFVBQVUsQ0FBQ0MsS0FBRCxFQUFRO0lBQ2xCLElBQUtqQixDQUFBQSxXQUFMLEdBQW1CaUIsS0FBbkIsQ0FBQTtBQUVBLElBQUEsSUFBQSxDQUFLQyxlQUFMLEVBQUEsQ0FBQTtBQUNILEdBQUE7O0FBRWEsRUFBQSxJQUFWRixVQUFVLEdBQUc7QUFDYixJQUFBLE9BQU8sS0FBS2hCLFdBQVosQ0FBQTtBQUNILEdBQUE7O0VBT1MsSUFBTm1CLE1BQU0sQ0FBQ0YsS0FBRCxFQUFRO0lBQ2QsTUFBTUUsTUFBTSxHQUFHLElBQUEsQ0FBS2xCLE9BQXBCLENBQUE7O0FBRUEsSUFBQSxJQUFJa0IsTUFBTSxJQUFJQSxNQUFNLENBQUNDLE1BQXJCLEVBQTZCO0FBQ3pCLE1BQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHRixNQUFNLENBQUNDLE1BQTNCLEVBQW1DQyxDQUFDLEVBQXBDLEVBQXdDO0FBRXBDLFFBQUEsSUFBSUYsTUFBTSxDQUFDRSxDQUFELENBQVYsRUFBZTtBQUNYLFVBQUEsTUFBTUMsS0FBSyxHQUFHLElBQUt4QixDQUFBQSxNQUFMLENBQVl5QixHQUFaLENBQWdCSixNQUFoQixDQUF1QkssR0FBdkIsQ0FBMkJMLE1BQU0sQ0FBQ0UsQ0FBRCxDQUFqQyxDQUFkLENBQUE7O0FBQ0EsVUFBQSxJQUFJQyxLQUFKLEVBQVc7WUFDUEEsS0FBSyxDQUFDRyxHQUFOLENBQVUsUUFBVixFQUFvQixJQUFLQyxDQUFBQSxjQUF6QixFQUF5QyxJQUF6QyxDQUFBLENBQUE7WUFDQUosS0FBSyxDQUFDRyxHQUFOLENBQVUsUUFBVixFQUFvQixJQUFLRSxDQUFBQSxjQUF6QixFQUF5QyxJQUF6QyxDQUFBLENBQUE7WUFFQSxNQUFNQyxRQUFRLEdBQUcsSUFBS3BCLENBQUFBLGVBQUwsQ0FBcUJjLEtBQUssQ0FBQ08sRUFBM0IsQ0FBakIsQ0FBQTtBQUVBLFlBQUEsSUFBSSxLQUFLbkIsUUFBTCxLQUFrQmtCLFFBQXRCLEVBQ0ksS0FBS0UscUJBQUwsRUFBQSxDQUFBO0FBRUosWUFBQSxPQUFPLElBQUtkLENBQUFBLFVBQUwsQ0FBZ0JZLFFBQWhCLENBQVAsQ0FBQTtBQUNBLFlBQUEsT0FBTyxLQUFLcEIsZUFBTCxDQUFxQmMsS0FBSyxDQUFDTyxFQUEzQixDQUFQLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBOztJQUVELElBQUs1QixDQUFBQSxPQUFMLEdBQWVnQixLQUFmLENBQUE7QUFFQSxJQUFBLE1BQU1jLFFBQVEsR0FBR2QsS0FBSyxDQUFDZSxHQUFOLENBQVdmLEtBQUQsSUFBVztNQUNsQyxPQUFRQSxLQUFLLFlBQVlnQixLQUFsQixHQUEyQmhCLEtBQUssQ0FBQ1ksRUFBakMsR0FBc0NaLEtBQTdDLENBQUE7QUFDSCxLQUZnQixDQUFqQixDQUFBO0lBSUEsSUFBS2lCLENBQUFBLG1CQUFMLENBQXlCSCxRQUF6QixDQUFBLENBQUE7QUFDSCxHQUFBOztBQUVTLEVBQUEsSUFBTlosTUFBTSxHQUFHO0FBQ1QsSUFBQSxPQUFPLEtBQUtsQixPQUFaLENBQUE7QUFDSCxHQUFBOztFQU9jLElBQVhrQyxXQUFXLENBQUNBLFdBQUQsRUFBYztJQUN6QixJQUFJLElBQUEsQ0FBSzlCLFFBQVQsRUFBbUI7QUFDZixNQUFBLElBQUEsQ0FBS0EsUUFBTCxDQUFjOEIsV0FBZCxHQUE0QkEsV0FBNUIsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLOUIsUUFBTCxDQUFjK0IsT0FBZCxDQUFzQixDQUF0QixDQUFBLENBQUE7TUFDQSxJQUFLL0IsQ0FBQUEsUUFBTCxDQUFjZ0MsV0FBZCxFQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUksSUFBQSxDQUFLbEMsYUFBVCxFQUF3QjtBQUNwQixNQUFBLE1BQU1tQyxLQUFLLEdBQUcsSUFBS25DLENBQUFBLGFBQUwsQ0FBbUJtQyxLQUFqQyxDQUFBOztBQUNBLE1BQUEsS0FBSyxJQUFJakIsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR2lCLEtBQUssQ0FBQ2xCLE1BQTFCLEVBQWtDLEVBQUVDLENBQXBDLEVBQXVDO0FBQ25DaUIsUUFBQUEsS0FBSyxDQUFDakIsQ0FBRCxDQUFMLENBQVNrQixJQUFULEdBQWdCSixXQUFoQixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVjLEVBQUEsSUFBWEEsV0FBVyxHQUFHO0lBQ2QsSUFBSSxJQUFBLENBQUs5QixRQUFULEVBQW1CO01BQ2YsT0FBTyxJQUFBLENBQUtBLFFBQUwsQ0FBY21DLEtBQXJCLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUksSUFBQSxDQUFLckMsYUFBVCxFQUF3QjtBQUdwQixNQUFBLE1BQU1tQyxLQUFLLEdBQUcsSUFBS25DLENBQUFBLGFBQUwsQ0FBbUJtQyxLQUFqQyxDQUFBOztBQUNBLE1BQUEsSUFBSUEsS0FBSyxDQUFDbEIsTUFBTixHQUFlLENBQW5CLEVBQXNCO1FBQ2xCLE9BQU9rQixLQUFLLENBQUNBLEtBQUssQ0FBQ2xCLE1BQU4sR0FBZSxDQUFoQixDQUFMLENBQXdCbUIsSUFBL0IsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsT0FBTyxDQUFQLENBQUE7QUFDSCxHQUFBOztBQU9XLEVBQUEsSUFBUkUsUUFBUSxHQUFHO0FBQ1gsSUFBQSxPQUFPLEtBQUt6QixVQUFMLENBQWdCLElBQUtOLENBQUFBLFFBQXJCLEVBQStCK0IsUUFBdEMsQ0FBQTtBQUNILEdBQUE7O0VBT08sSUFBSkMsSUFBSSxDQUFDekIsS0FBRCxFQUFRO0lBQ1osSUFBS2YsQ0FBQUEsS0FBTCxHQUFhZSxLQUFiLENBQUE7O0lBRUEsSUFBSSxJQUFBLENBQUtaLFFBQVQsRUFBbUI7QUFDZixNQUFBLElBQUEsQ0FBS0EsUUFBTCxDQUFjc0MsT0FBZCxHQUF3QjFCLEtBQXhCLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUksSUFBQSxDQUFLZCxhQUFULEVBQXdCO0FBQ3BCLE1BQUEsS0FBSyxJQUFJa0IsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRyxJQUFBLENBQUtsQixhQUFMLENBQW1CbUMsS0FBbkIsQ0FBeUJsQixNQUE3QyxFQUFxRCxFQUFFQyxDQUF2RCxFQUEwRDtRQUN0RCxJQUFLbEIsQ0FBQUEsYUFBTCxDQUFtQm1DLEtBQW5CLENBQXlCakIsQ0FBekIsQ0FBNEJxQixDQUFBQSxJQUE1QixHQUFtQ3pCLEtBQW5DLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRU8sRUFBQSxJQUFKeUIsSUFBSSxHQUFHO0FBQ1AsSUFBQSxPQUFPLEtBQUt4QyxLQUFaLENBQUE7QUFDSCxHQUFBOztBQVNEMEMsRUFBQUEsSUFBSSxDQUFDQyxJQUFELEVBQU9DLFNBQVMsR0FBRyxDQUFuQixFQUFzQjtJQUN0QixJQUFJLENBQUMsS0FBS0MsT0FBTixJQUFpQixDQUFDLElBQUtoRCxDQUFBQSxNQUFMLENBQVlnRCxPQUFsQyxFQUEyQztBQUN2QyxNQUFBLE9BQUE7QUFDSCxLQUFBOztBQUVELElBQUEsSUFBSSxDQUFDLElBQUsvQixDQUFBQSxVQUFMLENBQWdCNkIsSUFBaEIsQ0FBTCxFQUE0QjtBQUN4QkcsTUFBQUEsS0FBSyxDQUFDQyxLQUFOLENBQWEsQ0FBQSwwQkFBQSxFQUE0QkosSUFBSyxDQUE5QyxxQkFBQSxDQUFBLENBQUEsQ0FBQTtBQUNBLE1BQUEsT0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBS3BDLENBQUFBLFFBQUwsR0FBZ0IsSUFBQSxDQUFLQyxRQUFyQixDQUFBO0lBQ0EsSUFBS0EsQ0FBQUEsUUFBTCxHQUFnQm1DLElBQWhCLENBQUE7O0lBRUEsSUFBSSxJQUFBLENBQUt6QyxLQUFULEVBQWdCO0FBRVosTUFBQSxJQUFJLENBQUMsSUFBS0MsQ0FBQUEsUUFBTixJQUFrQixDQUFDLElBQUEsQ0FBS0YsYUFBNUIsRUFBMkM7QUFDdkMsUUFBQSxJQUFBLENBQUsrQywwQkFBTCxFQUFBLENBQUE7QUFDSCxPQUFBOztBQUVELE1BQUEsTUFBTXpDLFFBQVEsR0FBRyxJQUFBLENBQUtPLFVBQUwsQ0FBZ0IsSUFBQSxDQUFLUCxRQUFyQixDQUFqQixDQUFBO0FBQ0EsTUFBQSxNQUFNQyxRQUFRLEdBQUcsSUFBQSxDQUFLTSxVQUFMLENBQWdCLElBQUEsQ0FBS04sUUFBckIsQ0FBakIsQ0FBQTtNQUVBLElBQUtFLENBQUFBLFFBQUwsR0FBZ0JrQyxTQUFTLEdBQUcsQ0FBWixJQUFpQixDQUFDLENBQUMsSUFBQSxDQUFLckMsUUFBeEMsQ0FBQTs7TUFDQSxJQUFJLElBQUEsQ0FBS0csUUFBVCxFQUFtQjtRQUNmLElBQUtELENBQUFBLEtBQUwsR0FBYSxDQUFiLENBQUE7UUFDQSxJQUFLRSxDQUFBQSxVQUFMLEdBQWtCLENBQUEsR0FBSWlDLFNBQXRCLENBQUE7QUFDSCxPQUFBOztNQUVELElBQUksSUFBQSxDQUFLekMsUUFBVCxFQUFtQjtRQUNmLElBQUksSUFBQSxDQUFLTyxRQUFULEVBQW1CO0FBR2YsVUFBQSxJQUFBLENBQUtOLFFBQUwsQ0FBYzZDLFNBQWQsR0FBMEIxQyxRQUExQixDQUFBO0FBQ0EsVUFBQSxJQUFBLENBQUtILFFBQUwsQ0FBYzhCLE9BQWQsQ0FBc0IsSUFBSy9CLENBQUFBLFFBQUwsQ0FBY21DLEtBQXBDLENBQUEsQ0FBQTtBQUNBLFVBQUEsSUFBQSxDQUFLakMsTUFBTCxDQUFZNEMsU0FBWixHQUF3QnpDLFFBQXhCLENBQUE7QUFDSCxTQU5ELE1BTU87QUFDSCxVQUFBLElBQUEsQ0FBS0wsUUFBTCxDQUFjOEMsU0FBZCxHQUEwQnpDLFFBQTFCLENBQUE7QUFDSCxTQUFBO0FBQ0osT0FBQTs7TUFFRCxJQUFJLElBQUEsQ0FBS1AsYUFBVCxFQUF3QjtRQUNwQixNQUFNQSxhQUFhLEdBQUcsSUFBQSxDQUFLQSxhQUEzQixDQUFBOztRQUVBLElBQUksSUFBQSxDQUFLUyxRQUFULEVBQW1CO0FBRWYsVUFBQSxPQUFPVCxhQUFhLENBQUNtQyxLQUFkLENBQW9CbEIsTUFBcEIsR0FBNkIsQ0FBcEMsRUFBdUM7WUFDbkNqQixhQUFhLENBQUNpRCxVQUFkLENBQXlCLENBQXpCLENBQUEsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUxELE1BS087VUFDSCxJQUFLakQsQ0FBQUEsYUFBTCxDQUFtQmtELFdBQW5CLEVBQUEsQ0FBQTtBQUNILFNBQUE7O1FBRUQsTUFBTUMsSUFBSSxHQUFHLElBQUlDLFFBQUosQ0FBYSxJQUFLdkMsQ0FBQUEsVUFBTCxDQUFnQixJQUFLTixDQUFBQSxRQUFyQixDQUFiLEVBQTZDLENBQTdDLEVBQWdELEdBQWhELEVBQXFELElBQXJELEVBQTJELElBQUEsQ0FBS2dDLElBQWhFLENBQWIsQ0FBQTtBQUNBWSxRQUFBQSxJQUFJLENBQUNULElBQUwsR0FBWSxJQUFBLENBQUtuQyxRQUFqQixDQUFBO1FBQ0E0QyxJQUFJLENBQUNFLFdBQUwsR0FBbUIsSUFBQSxDQUFLNUMsUUFBTCxHQUFnQixDQUFoQixHQUFvQixDQUF2QyxDQUFBO0FBQ0EwQyxRQUFBQSxJQUFJLENBQUNHLEtBQUwsRUFBQSxDQUFBO0FBQ0EsUUFBQSxJQUFBLENBQUt0RCxhQUFMLENBQW1CdUQsT0FBbkIsQ0FBMkJKLElBQTNCLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztJQUVELElBQUtLLENBQUFBLE9BQUwsR0FBZSxJQUFmLENBQUE7QUFDSCxHQUFBOztFQVFEQyxZQUFZLENBQUNmLElBQUQsRUFBTztBQUNmLElBQUEsT0FBTyxJQUFLN0IsQ0FBQUEsVUFBTCxDQUFnQjZCLElBQWhCLENBQVAsQ0FBQTtBQUNILEdBQUE7O0VBUURnQixRQUFRLENBQUN6RCxLQUFELEVBQVE7QUFDWixJQUFBLElBQUlBLEtBQUssS0FBSyxJQUFLQSxDQUFBQSxLQUFuQixFQUEwQjtBQUV0QixNQUFBLElBQUEsQ0FBSzBELHlCQUFMLEVBQUEsQ0FBQTs7TUFHQSxJQUFLMUQsQ0FBQUEsS0FBTCxHQUFhQSxLQUFiLENBQUE7O0FBR0EsTUFBQSxJQUFJLElBQUtZLENBQUFBLFVBQUwsSUFBbUIsSUFBQSxDQUFLTixRQUF4QixJQUFvQyxJQUFLTSxDQUFBQSxVQUFMLENBQWdCLElBQUEsQ0FBS04sUUFBckIsQ0FBeEMsRUFBd0U7UUFDcEUsSUFBS2tDLENBQUFBLElBQUwsQ0FBVSxJQUFBLENBQUtsQyxRQUFmLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFRFEsRUFBQUEsZUFBZSxHQUFHO0FBRWQsSUFBQSxNQUFNNkMsY0FBYyxHQUFHLElBQUtoRSxDQUFBQSxNQUFMLENBQVlLLEtBQW5DLENBQUE7O0FBQ0EsSUFBQSxJQUFJMkQsY0FBSixFQUFvQjtBQUNoQixNQUFBLE1BQU1DLENBQUMsR0FBR0QsY0FBYyxDQUFDM0QsS0FBekIsQ0FBQTs7QUFDQSxNQUFBLElBQUk0RCxDQUFDLElBQUlBLENBQUMsS0FBSyxJQUFBLENBQUs1RCxLQUFwQixFQUEyQjtRQUN2QixJQUFLeUQsQ0FBQUEsUUFBTCxDQUFjRyxDQUFkLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsSUFBSSxDQUFDLElBQUEsQ0FBS3RELFFBQU4sSUFBa0IsS0FBS0ksUUFBdkIsSUFBbUMsSUFBS2lDLENBQUFBLE9BQXhDLElBQW1ELElBQUEsQ0FBS2hELE1BQUwsQ0FBWWdELE9BQW5FLEVBQTRFO01BRXhFLE1BQU1rQixjQUFjLEdBQUdDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLElBQUEsQ0FBS25FLFdBQWpCLENBQXZCLENBQUE7O0FBQ0EsTUFBQSxJQUFJaUUsY0FBYyxDQUFDN0MsTUFBZixHQUF3QixDQUE1QixFQUErQjtBQUMzQixRQUFBLElBQUEsQ0FBS3dCLElBQUwsQ0FBVXFCLGNBQWMsQ0FBQyxDQUFELENBQXhCLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFHREgsRUFBQUEseUJBQXlCLEdBQUc7SUFDeEIsSUFBS3pELENBQUFBLFFBQUwsR0FBZ0IsSUFBaEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFFBQUwsR0FBZ0IsSUFBaEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLE1BQUwsR0FBYyxJQUFkLENBQUE7SUFFQSxJQUFLSixDQUFBQSxhQUFMLEdBQXFCLElBQXJCLENBQUE7QUFDSCxHQUFBOztBQUdEK0MsRUFBQUEsMEJBQTBCLEdBQUc7SUFDekIsTUFBTTlDLEtBQUssR0FBRyxJQUFBLENBQUtBLEtBQW5CLENBQUE7SUFDQSxNQUFNWSxVQUFVLEdBQUcsSUFBQSxDQUFLQSxVQUF4QixDQUFBO0lBR0EsSUFBSW9ELE9BQU8sR0FBRyxLQUFkLENBQUE7SUFDQSxJQUFJQyxNQUFNLEdBQUcsS0FBYixDQUFBOztBQUNBLElBQUEsS0FBSyxNQUFNbEIsU0FBWCxJQUF3Qm5DLFVBQXhCLEVBQW9DO0FBQ2hDLE1BQUEsSUFBSUEsVUFBVSxDQUFDc0QsY0FBWCxDQUEwQm5CLFNBQTFCLENBQUosRUFBMEM7QUFDdEMsUUFBQSxNQUFNb0IsSUFBSSxHQUFHdkQsVUFBVSxDQUFDbUMsU0FBRCxDQUF2QixDQUFBOztBQUNBLFFBQUEsSUFBSW9CLElBQUksQ0FBQzFFLFdBQUwsS0FBcUIyRSxTQUF6QixFQUFvQztBQUNoQ0gsVUFBQUEsTUFBTSxHQUFHLElBQVQsQ0FBQTtBQUNILFNBRkQsTUFFTztBQUNIRCxVQUFBQSxPQUFPLEdBQUcsSUFBVixDQUFBO0FBQ0gsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsTUFBTUssS0FBSyxHQUFHckUsS0FBSyxDQUFDc0UsUUFBTixFQUFkLENBQUE7O0FBQ0EsSUFBQSxJQUFJTixPQUFKLEVBQWE7QUFDVCxNQUFBLElBQUEsQ0FBSzlELFFBQUwsR0FBZ0IsSUFBSXFFLFFBQUosQ0FBYUYsS0FBYixDQUFoQixDQUFBO0FBQ0EsTUFBQSxJQUFBLENBQUtsRSxNQUFMLEdBQWMsSUFBSW9FLFFBQUosQ0FBYUYsS0FBYixDQUFkLENBQUE7QUFDQSxNQUFBLElBQUEsQ0FBS3BFLFFBQUwsR0FBZ0IsSUFBSXNFLFFBQUosQ0FBYUYsS0FBYixDQUFoQixDQUFBO0FBQ0EsTUFBQSxJQUFBLENBQUtwRSxRQUFMLENBQWNzQyxPQUFkLEdBQXdCLEtBQUtELElBQTdCLENBQUE7QUFDQSxNQUFBLElBQUEsQ0FBS3JDLFFBQUwsQ0FBY3VFLFFBQWQsQ0FBdUJILEtBQXZCLENBQUEsQ0FBQTtLQUxKLE1BTU8sSUFBSUosTUFBSixFQUFZO01BQ2YsSUFBS2xFLENBQUFBLGFBQUwsR0FBcUIsSUFBSTBFLGFBQUosQ0FBa0IsSUFBSUMsaUJBQUosQ0FBc0IsSUFBQSxDQUFLL0UsTUFBM0IsQ0FBbEIsQ0FBckIsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztFQU1EbUMsbUJBQW1CLENBQUM2QyxHQUFELEVBQU07QUFDckIsSUFBQSxJQUFJLENBQUNBLEdBQUQsSUFBUSxDQUFDQSxHQUFHLENBQUMzRCxNQUFqQixFQUNJLE9BQUE7QUFFSixJQUFBLE1BQU1ELE1BQU0sR0FBRyxJQUFBLENBQUtyQixNQUFMLENBQVl5QixHQUFaLENBQWdCSixNQUEvQixDQUFBOztJQUVBLE1BQU02RCxZQUFZLEdBQUkxRCxLQUFELElBQVc7QUFDNUIsTUFBQSxJQUFJQSxLQUFLLENBQUMyRCxTQUFOLENBQWdCN0QsTUFBaEIsR0FBeUIsQ0FBN0IsRUFBZ0M7QUFDNUIsUUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdDLEtBQUssQ0FBQzJELFNBQU4sQ0FBZ0I3RCxNQUFwQyxFQUE0Q0MsQ0FBQyxFQUE3QyxFQUFpRDtBQUM3QyxVQUFBLElBQUEsQ0FBS0wsVUFBTCxDQUFnQk0sS0FBSyxDQUFDMkQsU0FBTixDQUFnQjVELENBQWhCLENBQW1Cd0IsQ0FBQUEsSUFBbkMsSUFBMkN2QixLQUFLLENBQUMyRCxTQUFOLENBQWdCNUQsQ0FBaEIsQ0FBM0MsQ0FBQTtBQUNBLFVBQUEsSUFBQSxDQUFLYixlQUFMLENBQXFCYyxLQUFLLENBQUNPLEVBQTNCLENBQUEsR0FBaUNQLEtBQUssQ0FBQzJELFNBQU4sQ0FBZ0I1RCxDQUFoQixDQUFBLENBQW1Cd0IsSUFBcEQsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUxELE1BS087UUFDSCxJQUFLN0IsQ0FBQUEsVUFBTCxDQUFnQk0sS0FBSyxDQUFDdUIsSUFBdEIsQ0FBOEJ2QixHQUFBQSxLQUFLLENBQUM0RCxRQUFwQyxDQUFBO1FBQ0EsSUFBSzFFLENBQUFBLGVBQUwsQ0FBcUJjLEtBQUssQ0FBQ08sRUFBM0IsQ0FBaUNQLEdBQUFBLEtBQUssQ0FBQ3VCLElBQXZDLENBQUE7QUFDSCxPQUFBOztNQUVELElBQUs3QixDQUFBQSxVQUFMLEdBQWtCLElBQUEsQ0FBS0EsVUFBdkIsQ0FBQTtLQVhKLENBQUE7O0lBZUEsTUFBTW1FLFVBQVUsR0FBSTdELEtBQUQsSUFBVztNQUMxQkEsS0FBSyxDQUFDRyxHQUFOLENBQVUsUUFBVixFQUFvQixJQUFLQyxDQUFBQSxjQUF6QixFQUF5QyxJQUF6QyxDQUFBLENBQUE7TUFDQUosS0FBSyxDQUFDOEQsRUFBTixDQUFTLFFBQVQsRUFBbUIsSUFBSzFELENBQUFBLGNBQXhCLEVBQXdDLElBQXhDLENBQUEsQ0FBQTtNQUVBSixLQUFLLENBQUNHLEdBQU4sQ0FBVSxRQUFWLEVBQW9CLElBQUtFLENBQUFBLGNBQXpCLEVBQXlDLElBQXpDLENBQUEsQ0FBQTtNQUNBTCxLQUFLLENBQUM4RCxFQUFOLENBQVMsUUFBVCxFQUFtQixJQUFLekQsQ0FBQUEsY0FBeEIsRUFBd0MsSUFBeEMsQ0FBQSxDQUFBOztNQUVBLElBQUlMLEtBQUssQ0FBQzRELFFBQVYsRUFBb0I7UUFDaEJGLFlBQVksQ0FBQzFELEtBQUQsQ0FBWixDQUFBO0FBQ0gsT0FGRCxNQUVPO0FBQ0hBLFFBQUFBLEtBQUssQ0FBQytELElBQU4sQ0FBVyxNQUFYLEVBQW1CTCxZQUFuQixFQUFpQyxJQUFqQyxDQUFBLENBQUE7QUFDQSxRQUFBLElBQUksSUFBS2pDLENBQUFBLE9BQUwsSUFBZ0IsSUFBQSxDQUFLaEQsTUFBTCxDQUFZZ0QsT0FBaEMsRUFDSTVCLE1BQU0sQ0FBQ21FLElBQVAsQ0FBWWhFLEtBQVosQ0FBQSxDQUFBO0FBQ1AsT0FBQTtLQWJMLENBQUE7O0FBZ0JBLElBQUEsS0FBSyxJQUFJRCxDQUFDLEdBQUcsQ0FBUixFQUFXa0UsQ0FBQyxHQUFHUixHQUFHLENBQUMzRCxNQUF4QixFQUFnQ0MsQ0FBQyxHQUFHa0UsQ0FBcEMsRUFBdUNsRSxDQUFDLEVBQXhDLEVBQTRDO01BQ3hDLE1BQU1DLEtBQUssR0FBR0gsTUFBTSxDQUFDSyxHQUFQLENBQVd1RCxHQUFHLENBQUMxRCxDQUFELENBQWQsQ0FBZCxDQUFBOztBQUNBLE1BQUEsSUFBSUMsS0FBSixFQUFXO1FBQ1A2RCxVQUFVLENBQUM3RCxLQUFELENBQVYsQ0FBQTtBQUNILE9BRkQsTUFFTztRQUNISCxNQUFNLENBQUNpRSxFQUFQLENBQVUsTUFBQSxHQUFTTCxHQUFHLENBQUMxRCxDQUFELENBQXRCLEVBQTJCOEQsVUFBM0IsQ0FBQSxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztFQVlEekQsY0FBYyxDQUFDSixLQUFELEVBQVFrRSxTQUFSLEVBQW1CQyxRQUFuQixFQUE2QkMsUUFBN0IsRUFBdUM7QUFDakQsSUFBQSxJQUFJRixTQUFTLEtBQUssVUFBZCxJQUE0QkEsU0FBUyxLQUFLLFdBQTlDLEVBQTJEO01BR3ZELElBQUlBLFNBQVMsS0FBSyxXQUFkLElBQTZCQyxRQUE3QixJQUF5Q0EsUUFBUSxDQUFDckUsTUFBVCxLQUFvQixDQUFqRSxFQUFvRTtBQUNoRXFFLFFBQUFBLFFBQVEsR0FBRyxJQUFYLENBQUE7QUFDSCxPQUFBOztBQUdELE1BQUEsSUFBSUEsUUFBSixFQUFjO1FBQ1YsSUFBSUUsU0FBUyxHQUFHLEtBQWhCLENBQUE7O0FBQ0EsUUFBQSxJQUFJRixRQUFRLENBQUNyRSxNQUFULEdBQWtCLENBQXRCLEVBQXlCO0FBQ3JCLFVBQUEsSUFBSXNFLFFBQVEsSUFBSUEsUUFBUSxDQUFDdEUsTUFBVCxHQUFrQixDQUFsQyxFQUFxQztBQUNqQyxZQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBR3FFLFFBQVEsQ0FBQ3RFLE1BQTdCLEVBQXFDQyxDQUFDLEVBQXRDLEVBQTBDO2NBQ3RDLE9BQU8sSUFBQSxDQUFLTCxVQUFMLENBQWdCMEUsUUFBUSxDQUFDckUsQ0FBRCxDQUFSLENBQVl3QixJQUE1QixDQUFQLENBQUE7QUFDSCxhQUFBO0FBQ0osV0FKRCxNQUlPO0FBQ0gsWUFBQSxPQUFPLEtBQUs3QixVQUFMLENBQWdCTSxLQUFLLENBQUN1QixJQUF0QixDQUFQLENBQUE7QUFDSCxXQUFBOztBQUNEOEMsVUFBQUEsU0FBUyxHQUFHLEtBQVosQ0FBQTs7QUFDQSxVQUFBLEtBQUssSUFBSXRFLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdvRSxRQUFRLENBQUNyRSxNQUE3QixFQUFxQ0MsQ0FBQyxFQUF0QyxFQUEwQztBQUN0QyxZQUFBLElBQUEsQ0FBS0wsVUFBTCxDQUFnQnlFLFFBQVEsQ0FBQ3BFLENBQUQsQ0FBUixDQUFZd0IsSUFBNUIsQ0FBb0M0QyxHQUFBQSxRQUFRLENBQUNwRSxDQUFELENBQTVDLENBQUE7O0FBRUEsWUFBQSxJQUFJLENBQUNzRSxTQUFELElBQWMsSUFBQSxDQUFLakYsUUFBTCxLQUFrQitFLFFBQVEsQ0FBQ3BFLENBQUQsQ0FBUixDQUFZd0IsSUFBaEQsRUFBc0Q7Y0FFbEQsSUFBSSxJQUFBLENBQUtjLE9BQUwsSUFBZ0IsSUFBS1osQ0FBQUEsT0FBckIsSUFBZ0MsSUFBS2hELENBQUFBLE1BQUwsQ0FBWWdELE9BQWhELEVBQXlEO0FBQ3JENEMsZ0JBQUFBLFNBQVMsR0FBRyxJQUFaLENBQUE7QUFDQSxnQkFBQSxJQUFBLENBQUsvQyxJQUFMLENBQVU2QyxRQUFRLENBQUNwRSxDQUFELENBQVIsQ0FBWXdCLElBQXRCLENBQUEsQ0FBQTtBQUNILGVBQUE7QUFDSixhQUFBO0FBQ0osV0FBQTs7VUFDRCxJQUFJLENBQUM4QyxTQUFMLEVBQWdCO0FBQ1osWUFBQSxJQUFBLENBQUs3RCxxQkFBTCxFQUFBLENBQUE7O0FBQ0EsWUFBQSxJQUFBLENBQUtaLGVBQUwsRUFBQSxDQUFBO0FBQ0gsV0FBQTtBQUNKLFNBeEJELE1Bd0JPO0FBQ0gsVUFBQSxJQUFJd0UsUUFBUSxJQUFJQSxRQUFRLENBQUN0RSxNQUFULEdBQWtCLENBQWxDLEVBQXFDO0FBQ2pDLFlBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHcUUsUUFBUSxDQUFDdEUsTUFBN0IsRUFBcUNDLENBQUMsRUFBdEMsRUFBMEM7Y0FDdEMsT0FBTyxJQUFBLENBQUtMLFVBQUwsQ0FBZ0IwRSxRQUFRLENBQUNyRSxDQUFELENBQVIsQ0FBWXdCLElBQTVCLENBQVAsQ0FBQTtBQUNILGFBQUE7QUFDSixXQUFBOztVQUVELElBQUs3QixDQUFBQSxVQUFMLENBQWdCTSxLQUFLLENBQUN1QixJQUF0QixDQUE4QjRDLEdBQUFBLFFBQVEsQ0FBQyxDQUFELENBQVIsSUFBZUEsUUFBN0MsQ0FBQTtBQUNBRSxVQUFBQSxTQUFTLEdBQUcsS0FBWixDQUFBOztBQUNBLFVBQUEsSUFBSSxLQUFLakYsUUFBTCxLQUFrQlksS0FBSyxDQUFDdUIsSUFBNUIsRUFBa0M7WUFFOUIsSUFBSSxJQUFBLENBQUtjLE9BQUwsSUFBZ0IsSUFBS1osQ0FBQUEsT0FBckIsSUFBZ0MsSUFBS2hELENBQUFBLE1BQUwsQ0FBWWdELE9BQWhELEVBQXlEO0FBQ3JENEMsY0FBQUEsU0FBUyxHQUFHLElBQVosQ0FBQTtBQUNBLGNBQUEsSUFBQSxDQUFLL0MsSUFBTCxDQUFVdEIsS0FBSyxDQUFDdUIsSUFBaEIsQ0FBQSxDQUFBO0FBQ0gsYUFBQTtBQUNKLFdBQUE7O1VBQ0QsSUFBSSxDQUFDOEMsU0FBTCxFQUFnQjtBQUNaLFlBQUEsSUFBQSxDQUFLN0QscUJBQUwsRUFBQSxDQUFBOztBQUNBLFlBQUEsSUFBQSxDQUFLWixlQUFMLEVBQUEsQ0FBQTtBQUNILFdBQUE7QUFDSixTQUFBOztRQUNELElBQUtWLENBQUFBLGVBQUwsQ0FBcUJjLEtBQUssQ0FBQ08sRUFBM0IsQ0FBaUNQLEdBQUFBLEtBQUssQ0FBQ3VCLElBQXZDLENBQUE7QUFDSCxPQWhERCxNQWdETztBQUNILFFBQUEsSUFBSTZDLFFBQVEsQ0FBQ3RFLE1BQVQsR0FBa0IsQ0FBdEIsRUFBeUI7QUFDckIsVUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdxRSxRQUFRLENBQUN0RSxNQUE3QixFQUFxQ0MsQ0FBQyxFQUF0QyxFQUEwQztZQUN0QyxPQUFPLElBQUEsQ0FBS0wsVUFBTCxDQUFnQjBFLFFBQVEsQ0FBQ3JFLENBQUQsQ0FBUixDQUFZd0IsSUFBNUIsQ0FBUCxDQUFBOztZQUNBLElBQUksSUFBQSxDQUFLbkMsUUFBTCxLQUFrQmdGLFFBQVEsQ0FBQ3JFLENBQUQsQ0FBUixDQUFZd0IsSUFBbEMsRUFBd0M7QUFDcEMsY0FBQSxJQUFBLENBQUtmLHFCQUFMLEVBQUEsQ0FBQTtBQUNILGFBQUE7QUFDSixXQUFBO0FBQ0osU0FQRCxNQU9PO0FBQ0gsVUFBQSxPQUFPLEtBQUtkLFVBQUwsQ0FBZ0JNLEtBQUssQ0FBQ3VCLElBQXRCLENBQVAsQ0FBQTs7QUFDQSxVQUFBLElBQUksS0FBS25DLFFBQUwsS0FBa0JZLEtBQUssQ0FBQ3VCLElBQTVCLEVBQWtDO0FBQzlCLFlBQUEsSUFBQSxDQUFLZixxQkFBTCxFQUFBLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FBQTs7QUFDRCxRQUFBLE9BQU8sS0FBS3RCLGVBQUwsQ0FBcUJjLEtBQUssQ0FBQ08sRUFBM0IsQ0FBUCxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztFQU1ERixjQUFjLENBQUNMLEtBQUQsRUFBUTtJQUNsQkEsS0FBSyxDQUFDRyxHQUFOLENBQVUsUUFBVixFQUFvQixJQUFLRSxDQUFBQSxjQUF6QixFQUF5QyxJQUF6QyxDQUFBLENBQUE7O0lBRUEsSUFBSSxJQUFBLENBQUtYLFVBQVQsRUFBcUI7QUFDakIsTUFBQSxJQUFJTSxLQUFLLENBQUMyRCxTQUFOLENBQWdCN0QsTUFBaEIsR0FBeUIsQ0FBN0IsRUFBZ0M7QUFDNUIsUUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdDLEtBQUssQ0FBQzJELFNBQU4sQ0FBZ0I3RCxNQUFwQyxFQUE0Q0MsQ0FBQyxFQUE3QyxFQUFpRDtVQUM3QyxPQUFPLElBQUEsQ0FBS0wsVUFBTCxDQUFnQk0sS0FBSyxDQUFDMkQsU0FBTixDQUFnQjVELENBQWhCLENBQW1Cd0IsQ0FBQUEsSUFBbkMsQ0FBUCxDQUFBO0FBQ0EsVUFBQSxJQUFJLElBQUtuQyxDQUFBQSxRQUFMLEtBQWtCWSxLQUFLLENBQUMyRCxTQUFOLENBQWdCNUQsQ0FBaEIsQ0FBbUJ3QixDQUFBQSxJQUF6QyxFQUNJLElBQUEsQ0FBS2YscUJBQUwsRUFBQSxDQUFBO0FBQ1AsU0FBQTtBQUNKLE9BTkQsTUFNTztBQUNILFFBQUEsT0FBTyxLQUFLZCxVQUFMLENBQWdCTSxLQUFLLENBQUN1QixJQUF0QixDQUFQLENBQUE7UUFDQSxJQUFJLElBQUEsQ0FBS25DLFFBQUwsS0FBa0JZLEtBQUssQ0FBQ3VCLElBQTVCLEVBQ0ksS0FBS2YscUJBQUwsRUFBQSxDQUFBO0FBQ1AsT0FBQTs7QUFDRCxNQUFBLE9BQU8sS0FBS3RCLGVBQUwsQ0FBcUJjLEtBQUssQ0FBQ08sRUFBM0IsQ0FBUCxDQUFBO0FBQ0gsS0FBQTtBQUNKLEdBQUE7O0FBR0RDLEVBQUFBLHFCQUFxQixHQUFHO0lBQ3BCLElBQUtwQixDQUFBQSxRQUFMLEdBQWdCLElBQWhCLENBQUE7SUFFQSxJQUFLaUQsQ0FBQUEsT0FBTCxHQUFlLEtBQWYsQ0FBQTs7SUFDQSxJQUFJLElBQUEsQ0FBS3RELFFBQVQsRUFBbUI7QUFDZixNQUFBLElBQUEsQ0FBS0EsUUFBTCxDQUFjOEIsV0FBZCxHQUE0QixDQUE1QixDQUFBO0FBQ0EsTUFBQSxJQUFBLENBQUs5QixRQUFMLENBQWM4QyxTQUFkLEdBQTBCLElBQTFCLENBQUE7QUFDSCxLQUFBOztJQUNELElBQUksSUFBQSxDQUFLaEQsYUFBVCxFQUF3QjtBQUNwQixNQUFBLEtBQUssSUFBSWtCLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsSUFBQSxDQUFLbEIsYUFBTCxDQUFtQm1DLEtBQW5CLENBQXlCbEIsTUFBN0MsRUFBcUQsRUFBRUMsQ0FBdkQsRUFBMEQ7QUFDdEQsUUFBQSxJQUFBLENBQUtsQixhQUFMLENBQW1CbUMsS0FBbkIsQ0FBeUJqQixDQUF6QixFQUE0QnVFLElBQTVCLEVBQUEsQ0FBQTtBQUNILE9BQUE7O0FBQ0QsTUFBQSxJQUFBLENBQUt6RixhQUFMLENBQW1CMEYsTUFBbkIsQ0FBMEIsQ0FBMUIsQ0FBQSxDQUFBO01BQ0EsSUFBSzFGLENBQUFBLGFBQUwsQ0FBbUJrRCxXQUFuQixFQUFBLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7QUFFRHlDLEVBQUFBLFFBQVEsR0FBRztBQUNQLElBQUEsS0FBQSxDQUFNQSxRQUFOLEVBQUEsQ0FBQTtJQUdBLE1BQU0zRSxNQUFNLEdBQUcsSUFBQSxDQUFLQSxNQUFwQixDQUFBO0FBQ0EsSUFBQSxNQUFNNEUsUUFBUSxHQUFHLElBQUEsQ0FBS2pHLE1BQUwsQ0FBWXlCLEdBQVosQ0FBZ0JKLE1BQWpDLENBQUE7O0FBQ0EsSUFBQSxJQUFJQSxNQUFKLEVBQVk7QUFDUixNQUFBLEtBQUssSUFBSUUsQ0FBQyxHQUFHLENBQVIsRUFBVzJFLEdBQUcsR0FBRzdFLE1BQU0sQ0FBQ0MsTUFBN0IsRUFBcUNDLENBQUMsR0FBRzJFLEdBQXpDLEVBQThDM0UsQ0FBQyxFQUEvQyxFQUFtRDtBQUMvQyxRQUFBLElBQUlDLEtBQUssR0FBR0gsTUFBTSxDQUFDRSxDQUFELENBQWxCLENBQUE7QUFDQSxRQUFBLElBQUksRUFBRUMsS0FBSyxZQUFZVyxLQUFuQixDQUFKLEVBQ0lYLEtBQUssR0FBR3lFLFFBQVEsQ0FBQ3ZFLEdBQVQsQ0FBYUYsS0FBYixDQUFSLENBQUE7UUFFSixJQUFJQSxLQUFLLElBQUksQ0FBQ0EsS0FBSyxDQUFDNEQsUUFBcEIsRUFDSWEsUUFBUSxDQUFDVCxJQUFULENBQWNoRSxLQUFkLENBQUEsQ0FBQTtBQUNQLE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsSUFBSSxLQUFLUixRQUFMLElBQWlCLENBQUMsSUFBQSxDQUFLSixRQUEzQixFQUFxQztNQUNqQyxNQUFNdUQsY0FBYyxHQUFHQyxNQUFNLENBQUNDLElBQVAsQ0FBWSxJQUFBLENBQUtuRCxVQUFqQixDQUF2QixDQUFBOztBQUNBLE1BQUEsSUFBSWlELGNBQWMsQ0FBQzdDLE1BQWYsR0FBd0IsQ0FBNUIsRUFBK0I7QUFDM0IsUUFBQSxJQUFBLENBQUt3QixJQUFMLENBQVVxQixjQUFjLENBQUMsQ0FBRCxDQUF4QixDQUFBLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRURnQyxFQUFBQSxjQUFjLEdBQUc7QUFDYixJQUFBLEtBQUssSUFBSTVFLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsSUFBS0YsQ0FBQUEsTUFBTCxDQUFZQyxNQUFoQyxFQUF3Q0MsQ0FBQyxFQUF6QyxFQUE2QztBQUd6QyxNQUFBLElBQUlDLEtBQUssR0FBRyxJQUFBLENBQUtILE1BQUwsQ0FBWUUsQ0FBWixDQUFaLENBQUE7O0FBQ0EsTUFBQSxJQUFJLE9BQU9DLEtBQVAsS0FBa0IsUUFBdEIsRUFBZ0M7UUFDNUJBLEtBQUssR0FBRyxJQUFLeEIsQ0FBQUEsTUFBTCxDQUFZeUIsR0FBWixDQUFnQkosTUFBaEIsQ0FBdUJLLEdBQXZCLENBQTJCRixLQUEzQixDQUFSLENBQUE7QUFDSCxPQUFBOztNQUVELElBQUksQ0FBQ0EsS0FBTCxFQUFZLFNBQUE7TUFFWkEsS0FBSyxDQUFDRyxHQUFOLENBQVUsUUFBVixFQUFvQixJQUFLQyxDQUFBQSxjQUF6QixFQUF5QyxJQUF6QyxDQUFBLENBQUE7TUFDQUosS0FBSyxDQUFDRyxHQUFOLENBQVUsUUFBVixFQUFvQixJQUFLRSxDQUFBQSxjQUF6QixFQUF5QyxJQUF6QyxDQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUt0QixDQUFBQSxRQUFMLEdBQWdCLElBQWhCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxRQUFMLEdBQWdCLElBQWhCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxNQUFMLEdBQWMsSUFBZCxDQUFBO0lBRUEsSUFBS0osQ0FBQUEsYUFBTCxHQUFxQixJQUFyQixDQUFBO0FBQ0gsR0FBQTs7RUFRRDBGLE1BQU0sQ0FBQ0ssRUFBRCxFQUFLO0lBRVAsSUFBSSxJQUFBLENBQUt0RixRQUFULEVBQW1CO0FBQ2YsTUFBQSxJQUFBLENBQUtELEtBQUwsSUFBY3VGLEVBQUUsR0FBRyxLQUFLckYsVUFBeEIsQ0FBQTs7QUFDQSxNQUFBLElBQUksSUFBS0YsQ0FBQUEsS0FBTCxJQUFjLENBQWxCLEVBQXFCO1FBQ2pCLElBQUtBLENBQUFBLEtBQUwsR0FBYSxDQUFiLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTs7SUFHRCxJQUFJLElBQUEsQ0FBS2dELE9BQVQsRUFBa0I7TUFDZCxNQUFNdEQsUUFBUSxHQUFHLElBQUEsQ0FBS0EsUUFBdEIsQ0FBQTs7TUFDQSxJQUFJQSxRQUFRLEtBQUssSUFBYixJQUFxQixLQUFLRCxLQUFMLEtBQWUsSUFBeEMsRUFBOEM7UUFDMUMsSUFBSSxJQUFBLENBQUtRLFFBQVQsRUFBbUI7VUFDZlAsUUFBUSxDQUFDTSxLQUFULENBQWUsSUFBS0wsQ0FBQUEsUUFBcEIsRUFBOEIsSUFBS0MsQ0FBQUEsTUFBbkMsRUFBMkMsSUFBQSxDQUFLSSxLQUFoRCxDQUFBLENBQUE7QUFDSCxTQUZELE1BRU87QUFHSCxVQUFBLE1BQU13RixLQUFLLEdBQUdELEVBQUUsR0FBRyxLQUFLbkYsS0FBeEIsQ0FBQTtVQUNBVixRQUFRLENBQUMrQixPQUFULENBQWlCK0QsS0FBakIsQ0FBQSxDQUFBOztBQUNBLFVBQUEsSUFBSSxLQUFLcEYsS0FBTCxHQUFhLENBQWIsSUFBbUJWLFFBQVEsQ0FBQ21DLEtBQVQsS0FBbUJuQyxRQUFRLENBQUM4QyxTQUFULENBQW1CVixRQUF6RCxJQUFzRSxDQUFDLElBQUEsQ0FBS0MsSUFBaEYsRUFBc0Y7WUFDbEYsSUFBS2lCLENBQUFBLE9BQUwsR0FBZSxLQUFmLENBQUE7QUFDSCxXQUZELE1BRU8sSUFBSSxJQUFBLENBQUs1QyxLQUFMLEdBQWEsQ0FBYixJQUFrQlYsUUFBUSxDQUFDbUMsS0FBVCxLQUFtQixDQUFyQyxJQUEwQyxDQUFDLElBQUEsQ0FBS0UsSUFBcEQsRUFBMEQ7WUFDN0QsSUFBS2lCLENBQUFBLE9BQUwsR0FBZSxLQUFmLENBQUE7QUFDSCxXQUFBO0FBQ0osU0FBQTs7QUFFRCxRQUFBLElBQUksS0FBSy9DLFFBQUwsSUFBa0IsS0FBS0QsS0FBTCxLQUFlLENBQXJDLEVBQXlDO0FBQ3JDTixVQUFBQSxRQUFRLENBQUM4QyxTQUFULEdBQXFCLElBQUs1QyxDQUFBQSxNQUFMLENBQVk0QyxTQUFqQyxDQUFBO0FBQ0gsU0FBQTs7QUFFRDlDLFFBQUFBLFFBQVEsQ0FBQ2dDLFdBQVQsRUFBQSxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0lBR0QsTUFBTWxDLGFBQWEsR0FBRyxJQUFBLENBQUtBLGFBQTNCLENBQUE7O0FBQ0EsSUFBQSxJQUFJQSxhQUFKLEVBQW1CO0FBR2YsTUFBQSxLQUFLLElBQUlrQixDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHbEIsYUFBYSxDQUFDbUMsS0FBZCxDQUFvQmxCLE1BQXhDLEVBQWdELEVBQUVDLENBQWxELEVBQXFEO0FBQ2pELFFBQUEsTUFBTWlDLElBQUksR0FBR25ELGFBQWEsQ0FBQ21DLEtBQWQsQ0FBb0JqQixDQUFwQixDQUFiLENBQUE7QUFDQWlDLFFBQUFBLElBQUksQ0FBQ3ZDLEtBQUwsR0FBYSxJQUFBLENBQUtBLEtBQWxCLENBQUE7O1FBQ0EsSUFBSSxDQUFDLElBQUs0QyxDQUFBQSxPQUFWLEVBQW1CO0FBQ2ZMLFVBQUFBLElBQUksQ0FBQzhDLEtBQUwsRUFBQSxDQUFBO0FBQ0gsU0FGRCxNQUVPO0FBQ0g5QyxVQUFBQSxJQUFJLENBQUMrQyxNQUFMLEVBQUEsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBOztNQUdELElBQUksSUFBQSxDQUFLekYsUUFBTCxJQUFpQlQsYUFBYSxDQUFDbUMsS0FBZCxDQUFvQmxCLE1BQXBCLEdBQTZCLENBQWxELEVBQXFEO1FBQ2pEakIsYUFBYSxDQUFDbUMsS0FBZCxDQUFvQixDQUFwQixFQUF1QmtCLFdBQXZCLEdBQXFDLEtBQUs3QyxLQUExQyxDQUFBO0FBQ0gsT0FBQTs7TUFFRFIsYUFBYSxDQUFDMEYsTUFBZCxDQUFxQkssRUFBckIsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFHRCxJQUFBLElBQUksS0FBS3RGLFFBQUwsSUFBaUIsS0FBS0QsS0FBTCxLQUFlLENBQXBDLEVBQXVDO01BQ25DLElBQUtDLENBQUFBLFFBQUwsR0FBZ0IsS0FBaEIsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztBQXZxQnNDOzs7OyJ9
