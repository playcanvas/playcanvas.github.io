/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../../core/event-handler.js';
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { SoundInstance } from '../../../platform/sound/instance.js';
import { SoundInstance3d } from '../../../platform/sound/instance3d.js';

const instanceOptions = {
  volume: 0,
  pitch: 0,
  loop: false,
  startTime: 0,
  duration: 0,
  position: new Vec3(),
  maxDistance: 0,
  refDistance: 0,
  rollOffFactor: 0,
  distanceModel: 0,
  onPlay: null,
  onPause: null,
  onResume: null,
  onStop: null,
  onEnd: null
};

class SoundSlot extends EventHandler {

  constructor(component, name = 'Untitled', options = {}) {
    super();
    this.name = void 0;
    this.instances = [];
    this._component = component;
    this._assets = component.system.app.assets;
    this._manager = component.system.manager;
    this.name = name;
    this._volume = options.volume !== undefined ? math.clamp(Number(options.volume) || 0, 0, 1) : 1;
    this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;
    this._loop = !!(options.loop !== undefined ? options.loop : false);
    this._duration = options.duration > 0 ? options.duration : null;
    this._startTime = Math.max(0, Number(options.startTime) || 0);
    this._overlap = !!options.overlap;
    this._autoPlay = !!options.autoPlay;
    this._firstNode = null;
    this._lastNode = null;
    this._asset = options.asset;
    if (this._asset instanceof Asset) {
      this._asset = this._asset.id;
    }
    this._onInstancePlayHandler = this._onInstancePlay.bind(this);
    this._onInstancePauseHandler = this._onInstancePause.bind(this);
    this._onInstanceResumeHandler = this._onInstanceResume.bind(this);
    this._onInstanceStopHandler = this._onInstanceStop.bind(this);
    this._onInstanceEndHandler = this._onInstanceEnd.bind(this);
  }

  play() {
    if (!this.overlap) {
      this.stop();
    }

    if (!this.isLoaded && !this._hasAsset()) {
      Debug.warn(`Trying to play SoundSlot ${this.name} but it is not loaded and doesn't have an asset.`);
      return undefined;
    }
    const instance = this._createInstance();
    this.instances.push(instance);

    if (!this.isLoaded) {
      const onLoad = function onLoad(sound) {
        const playWhenLoaded = instance._playWhenLoaded;
        instance.sound = sound;
        if (playWhenLoaded) {
          instance.play();
        }
      };
      this.off('load', onLoad);
      this.once('load', onLoad);
      this.load();
    } else {
      instance.play();
    }
    return instance;
  }

  pause() {
    let paused = false;
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (instances[i].pause()) {
        paused = true;
      }
    }
    return paused;
  }

  resume() {
    let resumed = false;
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (instances[i].resume()) resumed = true;
    }
    return resumed;
  }

  stop() {
    let stopped = false;
    const instances = this.instances;
    let i = instances.length;
    while (i--) {
      instances[i].stop();
      stopped = true;
    }
    instances.length = 0;
    return stopped;
  }

  load() {
    if (!this._hasAsset()) return;
    const asset = this._assets.get(this._asset);
    if (!asset) {
      this._assets.off('add:' + this._asset, this._onAssetAdd, this);
      this._assets.once('add:' + this._asset, this._onAssetAdd, this);
      return;
    }
    asset.off('remove', this._onAssetRemoved, this);
    asset.on('remove', this._onAssetRemoved, this);
    if (!asset.resource) {
      asset.off('load', this._onAssetLoad, this);
      asset.once('load', this._onAssetLoad, this);
      this._assets.load(asset);
      return;
    }
    this.fire('load', asset.resource);
  }

  setExternalNodes(firstNode, lastNode) {
    if (!firstNode) {
      console.error('The firstNode must have a valid AudioNode');
      return;
    }
    if (!lastNode) {
      lastNode = firstNode;
    }
    this._firstNode = firstNode;
    this._lastNode = lastNode;

    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].setExternalNodes(firstNode, lastNode);
      }
    }
  }

  clearExternalNodes() {
    this._firstNode = null;
    this._lastNode = null;

    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].clearExternalNodes();
      }
    }
  }

  getExternalNodes() {
    return [this._firstNode, this._lastNode];
  }

  _hasAsset() {
    return this._asset != null;
  }

  _createInstance() {
    let instance = null;
    const component = this._component;
    let sound = null;

    if (this._hasAsset()) {
      const asset = this._assets.get(this._asset);
      if (asset) {
        sound = asset.resource;
      }
    }

    const data = instanceOptions;
    data.volume = this._volume * component.volume;
    data.pitch = this._pitch * component.pitch;
    data.loop = this._loop;
    data.startTime = this._startTime;
    data.duration = this._duration;
    data.onPlay = this._onInstancePlayHandler;
    data.onPause = this._onInstancePauseHandler;
    data.onResume = this._onInstanceResumeHandler;
    data.onStop = this._onInstanceStopHandler;
    data.onEnd = this._onInstanceEndHandler;
    if (component.positional) {
      data.position.copy(component.entity.getPosition());
      data.maxDistance = component.maxDistance;
      data.refDistance = component.refDistance;
      data.rollOffFactor = component.rollOffFactor;
      data.distanceModel = component.distanceModel;
      instance = new SoundInstance3d(this._manager, sound, data);
    } else {
      instance = new SoundInstance(this._manager, sound, data);
    }

    if (this._firstNode) {
      instance.setExternalNodes(this._firstNode, this._lastNode);
    }
    return instance;
  }
  _onInstancePlay(instance) {
    this.fire('play', instance);

    this._component.fire('play', this, instance);
  }
  _onInstancePause(instance) {
    this.fire('pause', instance);

    this._component.fire('pause', this, instance);
  }
  _onInstanceResume(instance) {
    this.fire('resume', instance);

    this._component.fire('resume', this, instance);
  }
  _onInstanceStop(instance) {
    const idx = this.instances.indexOf(instance);
    if (idx !== -1) {
      this.instances.splice(idx, 1);
    }

    this.fire('stop', instance);

    this._component.fire('stop', this, instance);
  }
  _onInstanceEnd(instance) {
    const idx = this.instances.indexOf(instance);
    if (idx !== -1) {
      this.instances.splice(idx, 1);
    }

    this.fire('end', instance);

    this._component.fire('end', this, instance);
  }
  _onAssetAdd(asset) {
    this.load();
  }
  _onAssetLoad(asset) {
    this.load();
  }
  _onAssetRemoved(asset) {
    asset.off('remove', this._onAssetRemoved, this);
    this._assets.off('add:' + asset.id, this._onAssetAdd, this);
    this.stop();
  }
  updatePosition(position) {
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      instances[i].position = position;
    }
  }

  set asset(value) {
    const old = this._asset;
    if (old) {
      this._assets.off('add:' + old, this._onAssetAdd, this);
      const oldAsset = this._assets.get(old);
      if (oldAsset) {
        oldAsset.off('remove', this._onAssetRemoved, this);
      }
    }
    this._asset = value;
    if (this._asset instanceof Asset) {
      this._asset = this._asset.id;
    }

    if (this._hasAsset() && this._component.enabled && this._component.entity.enabled) {
      this.load();
    }
  }
  get asset() {
    return this._asset;
  }

  set autoPlay(value) {
    this._autoPlay = !!value;
  }
  get autoPlay() {
    return this._autoPlay;
  }

  set duration(value) {
    this._duration = Math.max(0, Number(value) || 0) || null;

    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].duration = this._duration;
      }
    }
  }
  get duration() {
    let assetDuration = 0;
    if (this._hasAsset()) {
      const asset = this._assets.get(this._asset);
      assetDuration = asset != null && asset.resource ? asset.resource.duration : 0;
    }

    if (this._duration != null) {
      return this._duration % (assetDuration || 1);
    }
    return assetDuration;
  }

  get isLoaded() {
    if (this._hasAsset()) {
      const asset = this._assets.get(this._asset);
      if (asset) {
        return !!asset.resource;
      }
    }
    return false;
  }

  get isPaused() {
    const instances = this.instances;
    const len = instances.length;
    if (len === 0) return false;
    for (let i = 0; i < len; i++) {
      if (!instances[i].isPaused) return false;
    }
    return true;
  }

  get isPlaying() {
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (instances[i].isPlaying) return true;
    }
    return false;
  }

  get isStopped() {
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (!instances[i].isStopped) return false;
    }
    return true;
  }

  set loop(value) {
    this._loop = !!value;

    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      instances[i].loop = this._loop;
    }
  }
  get loop() {
    return this._loop;
  }

  set overlap(value) {
    this._overlap = !!value;
  }
  get overlap() {
    return this._overlap;
  }

  set pitch(value) {
    this._pitch = Math.max(Number(value) || 0, 0.01);

    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].pitch = this.pitch * this._component.pitch;
      }
    }
  }
  get pitch() {
    return this._pitch;
  }

  set startTime(value) {
    this._startTime = Math.max(0, Number(value) || 0);

    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].startTime = this._startTime;
      }
    }
  }
  get startTime() {
    return this._startTime;
  }

  set volume(value) {
    this._volume = math.clamp(Number(value) || 0, 0, 1);

    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].volume = this._volume * this._component.volume;
      }
    }
  }
  get volume() {
    return this._volume;
  }
}

export { SoundSlot };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xvdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL3NvdW5kL3Nsb3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgU291bmRJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlLmpzJztcbmltcG9ydCB7IFNvdW5kSW5zdGFuY2UzZCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlM2QuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9jb21wb25lbnQuanMnKS5Tb3VuZENvbXBvbmVudH0gU291bmRDb21wb25lbnQgKi9cblxuLy8gdGVtcG9yYXJ5IG9iamVjdCBmb3IgY3JlYXRpbmcgaW5zdGFuY2VzXG5jb25zdCBpbnN0YW5jZU9wdGlvbnMgPSB7XG4gICAgdm9sdW1lOiAwLFxuICAgIHBpdGNoOiAwLFxuICAgIGxvb3A6IGZhbHNlLFxuICAgIHN0YXJ0VGltZTogMCxcbiAgICBkdXJhdGlvbjogMCxcbiAgICBwb3NpdGlvbjogbmV3IFZlYzMoKSxcbiAgICBtYXhEaXN0YW5jZTogMCxcbiAgICByZWZEaXN0YW5jZTogMCxcbiAgICByb2xsT2ZmRmFjdG9yOiAwLFxuICAgIGRpc3RhbmNlTW9kZWw6IDAsXG4gICAgb25QbGF5OiBudWxsLFxuICAgIG9uUGF1c2U6IG51bGwsXG4gICAgb25SZXN1bWU6IG51bGwsXG4gICAgb25TdG9wOiBudWxsLFxuICAgIG9uRW5kOiBudWxsXG59O1xuXG4vKipcbiAqIFRoZSBTb3VuZFNsb3QgY29udHJvbHMgcGxheWJhY2sgb2YgYW4gYXVkaW8gYXNzZXQuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBTb3VuZFNsb3QgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIFRoZSBuYW1lIG9mIHRoZSBzbG90LlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBuYW1lO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgdGhhdCBjb250YWlucyBhbGwgdGhlIHtAbGluayBTb3VuZEluc3RhbmNlfXMgY3VycmVudGx5IGJlaW5nIHBsYXllZCBieSB0aGUgc2xvdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTb3VuZEluc3RhbmNlW119XG4gICAgICovXG4gICAgaW5zdGFuY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU291bmRTbG90LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTb3VuZENvbXBvbmVudH0gY29tcG9uZW50IC0gVGhlIENvbXBvbmVudCB0aGF0IGNyZWF0ZWQgdGhpcyBzbG90LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgc2xvdC4gRGVmYXVsdHMgdG8gJ1VudGl0bGVkJy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gU2V0dGluZ3MgZm9yIHRoZSBzbG90LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy52b2x1bWU9MV0gLSBUaGUgcGxheWJhY2sgdm9sdW1lLCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnBpdGNoPTFdIC0gVGhlIHJlbGF0aXZlIHBpdGNoLCBkZWZhdWx0IG9mIDEsIHBsYXlzIGF0IG5vcm1hbCBwaXRjaC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmxvb3A9ZmFsc2VdIC0gSWYgdHJ1ZSB0aGUgc291bmQgd2lsbCByZXN0YXJ0IHdoZW4gaXQgcmVhY2hlcyB0aGVcbiAgICAgKiBlbmQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0VGltZT0wXSAtIFRoZSBzdGFydCB0aW1lIGZyb20gd2hpY2ggdGhlIHNvdW5kIHdpbGwgc3RhcnRcbiAgICAgKiBwbGF5aW5nLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5kdXJhdGlvbj1udWxsXSAtIFRoZSBkdXJhdGlvbiBvZiB0aGUgc291bmQgdGhhdCB0aGUgc2xvdCB3aWxsIHBsYXlcbiAgICAgKiBzdGFydGluZyBmcm9tIHN0YXJ0VGltZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLm92ZXJsYXA9ZmFsc2VdIC0gSWYgdHJ1ZSB0aGVuIHNvdW5kcyBwbGF5ZWQgZnJvbSBzbG90IHdpbGwgYmVcbiAgICAgKiBwbGF5ZWQgaW5kZXBlbmRlbnRseSBvZiBlYWNoIG90aGVyLiBPdGhlcndpc2UgdGhlIHNsb3Qgd2lsbCBmaXJzdCBzdG9wIHRoZSBjdXJyZW50IHNvdW5kXG4gICAgICogYmVmb3JlIHN0YXJ0aW5nIHRoZSBuZXcgb25lLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYXV0b1BsYXk9ZmFsc2VdIC0gSWYgdHJ1ZSB0aGUgc2xvdCB3aWxsIHN0YXJ0IHBsYXlpbmcgYXMgc29vbiBhc1xuICAgICAqIGl0cyBhdWRpbyBhc3NldCBpcyBsb2FkZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFzc2V0PW51bGxdIC0gVGhlIGFzc2V0IGlkIG9mIHRoZSBhdWRpbyBhc3NldCB0aGF0IGlzIGdvaW5nIHRvIGJlXG4gICAgICogcGxheWVkIGJ5IHRoaXMgc2xvdC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihjb21wb25lbnQsIG5hbWUgPSAnVW50aXRsZWQnLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9jb21wb25lbnQgPSBjb21wb25lbnQ7XG4gICAgICAgIHRoaXMuX2Fzc2V0cyA9IGNvbXBvbmVudC5zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgdGhpcy5fbWFuYWdlciA9IGNvbXBvbmVudC5zeXN0ZW0ubWFuYWdlcjtcblxuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuXG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IG9wdGlvbnMudm9sdW1lICE9PSB1bmRlZmluZWQgPyBtYXRoLmNsYW1wKE51bWJlcihvcHRpb25zLnZvbHVtZSkgfHwgMCwgMCwgMSkgOiAxO1xuICAgICAgICB0aGlzLl9waXRjaCA9IG9wdGlvbnMucGl0Y2ggIT09IHVuZGVmaW5lZCA/IE1hdGgubWF4KDAuMDEsIE51bWJlcihvcHRpb25zLnBpdGNoKSB8fCAwKSA6IDE7XG4gICAgICAgIHRoaXMuX2xvb3AgPSAhIShvcHRpb25zLmxvb3AgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubG9vcCA6IGZhbHNlKTtcbiAgICAgICAgdGhpcy5fZHVyYXRpb24gPSBvcHRpb25zLmR1cmF0aW9uID4gMCA/IG9wdGlvbnMuZHVyYXRpb24gOiBudWxsO1xuICAgICAgICB0aGlzLl9zdGFydFRpbWUgPSBNYXRoLm1heCgwLCBOdW1iZXIob3B0aW9ucy5zdGFydFRpbWUpIHx8IDApO1xuICAgICAgICB0aGlzLl9vdmVybGFwID0gISEob3B0aW9ucy5vdmVybGFwKTtcbiAgICAgICAgdGhpcy5fYXV0b1BsYXkgPSAhIShvcHRpb25zLmF1dG9QbGF5KTtcbiAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2Fzc2V0ID0gb3B0aW9ucy5hc3NldDtcbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0IGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gdGhpcy5fYXNzZXQuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9vbkluc3RhbmNlUGxheUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUGxheS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9vbkluc3RhbmNlUGF1c2VIYW5kbGVyID0gdGhpcy5fb25JbnN0YW5jZVBhdXNlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VSZXN1bWVIYW5kbGVyID0gdGhpcy5fb25JbnN0YW5jZVJlc3VtZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9vbkluc3RhbmNlU3RvcEhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlU3RvcC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9vbkluc3RhbmNlRW5kSGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VFbmQuYmluZCh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2Ugc3RhcnRzIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRTbG90I3BsYXlcbiAgICAgKiBAcGFyYW0ge1NvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlIHRoYXQgc3RhcnRlZCBwbGF5aW5nLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNvdW5kIGluc3RhbmNlIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZFNsb3QjcGF1c2VcbiAgICAgKiBAcGFyYW0ge1NvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlIHRoYXQgd2FzIHBhdXNlZCBjcmVhdGVkIHRvIHBsYXkgdGhlIHNvdW5kLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNvdW5kIGluc3RhbmNlIGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRTbG90I3Jlc3VtZVxuICAgICAqIEBwYXJhbSB7U291bmRJbnN0YW5jZX0gaW5zdGFuY2UgLSBUaGUgaW5zdGFuY2UgdGhhdCB3YXMgcmVzdW1lZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBpcyBzdG9wcGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kU2xvdCNzdG9wXG4gICAgICogQHBhcmFtIHtTb3VuZEluc3RhbmNlfSBpbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSB0aGF0IHdhcyBzdG9wcGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgYXNzZXQgYXNzaWduZWQgdG8gdGhlIHNsb3QgaXMgbG9hZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kU2xvdCNsb2FkXG4gICAgICogQHBhcmFtIHtTb3VuZH0gc291bmQgLSBUaGUgc291bmQgcmVzb3VyY2UgdGhhdCB3YXMgbG9hZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogUGxheXMgYSBzb3VuZC4gSWYge0BsaW5rIFNvdW5kU2xvdCNvdmVybGFwfSBpcyB0cnVlIHRoZSBuZXcgc291bmQgaW5zdGFuY2Ugd2lsbCBiZSBwbGF5ZWRcbiAgICAgKiBpbmRlcGVuZGVudGx5IG9mIGFueSBvdGhlciBpbnN0YW5jZXMgYWxyZWFkeSBwbGF5aW5nLiBPdGhlcndpc2UgZXhpc3Rpbmcgc291bmQgaW5zdGFuY2VzXG4gICAgICogd2lsbCBzdG9wIGJlZm9yZSBwbGF5aW5nIHRoZSBuZXcgc291bmQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U291bmRJbnN0YW5jZX0gVGhlIG5ldyBzb3VuZCBpbnN0YW5jZS5cbiAgICAgKi9cbiAgICBwbGF5KCkge1xuICAgICAgICAvLyBzdG9wIGlmIG92ZXJsYXAgaXMgZmFsc2VcbiAgICAgICAgaWYgKCF0aGlzLm92ZXJsYXApIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbm90IGxvYWRlZCBhbmQgZG9lc24ndCBoYXZlIGFzc2V0IC0gdGhlbiB3ZSBjYW5ub3QgcGxheSBpdC4gIFdhcm4gYW5kIGV4aXQuXG4gICAgICAgIGlmICghdGhpcy5pc0xvYWRlZCAmJiAhdGhpcy5faGFzQXNzZXQoKSkge1xuICAgICAgICAgICAgRGVidWcud2FybihgVHJ5aW5nIHRvIHBsYXkgU291bmRTbG90ICR7dGhpcy5uYW1lfSBidXQgaXQgaXMgbm90IGxvYWRlZCBhbmQgZG9lc24ndCBoYXZlIGFuIGFzc2V0LmApO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlID0gdGhpcy5fY3JlYXRlSW5zdGFuY2UoKTtcbiAgICAgICAgdGhpcy5pbnN0YW5jZXMucHVzaChpbnN0YW5jZSk7XG5cbiAgICAgICAgLy8gaWYgbm90IGxvYWRlZCB0aGVuIGxvYWQgZmlyc3RcbiAgICAgICAgLy8gYW5kIHRoZW4gc2V0IHNvdW5kIHJlc291cmNlIG9uIHRoZSBjcmVhdGVkIGluc3RhbmNlXG4gICAgICAgIGlmICghdGhpcy5pc0xvYWRlZCkge1xuICAgICAgICAgICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKHNvdW5kKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGxheVdoZW5Mb2FkZWQgPSBpbnN0YW5jZS5fcGxheVdoZW5Mb2FkZWQ7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2Uuc291bmQgPSBzb3VuZDtcbiAgICAgICAgICAgICAgICBpZiAocGxheVdoZW5Mb2FkZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UucGxheSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHRoaXMub2ZmKCdsb2FkJywgb25Mb2FkKTtcbiAgICAgICAgICAgIHRoaXMub25jZSgnbG9hZCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB0aGlzLmxvYWQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGluc3RhbmNlLnBsYXkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXVzZXMgYWxsIHNvdW5kIGluc3RhbmNlcy4gVG8gY29udGludWUgcGxheWJhY2sgY2FsbCB7QGxpbmsgU291bmRTbG90I3Jlc3VtZX0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc291bmQgaW5zdGFuY2VzIHBhdXNlZCBzdWNjZXNzZnVsbHksIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgbGV0IHBhdXNlZCA9IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2VzW2ldLnBhdXNlKCkpIHtcbiAgICAgICAgICAgICAgICBwYXVzZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHBhdXNlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIHBsYXliYWNrIG9mIGFsbCBwYXVzZWQgc291bmQgaW5zdGFuY2VzLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgYW55IGluc3RhbmNlcyB3ZXJlIHJlc3VtZWQuXG4gICAgICovXG4gICAgcmVzdW1lKCkge1xuICAgICAgICBsZXQgcmVzdW1lZCA9IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2VzW2ldLnJlc3VtZSgpKVxuICAgICAgICAgICAgICAgIHJlc3VtZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VtZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgcGxheWJhY2sgb2YgYWxsIHNvdW5kIGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGFueSBpbnN0YW5jZXMgd2VyZSBzdG9wcGVkLlxuICAgICAqL1xuICAgIHN0b3AoKSB7XG4gICAgICAgIGxldCBzdG9wcGVkID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGxldCBpID0gaW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgLy8gZG8gdGhpcyBpbiByZXZlcnNlIG9yZGVyIGJlY2F1c2UgYXMgZWFjaCBpbnN0YW5jZVxuICAgICAgICAvLyBpcyBzdG9wcGVkIGl0IHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBpbnN0YW5jZXMgYXJyYXlcbiAgICAgICAgLy8gYnkgdGhlIGluc3RhbmNlIHN0b3AgZXZlbnQgaGFuZGxlclxuICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICBpbnN0YW5jZXNbaV0uc3RvcCgpO1xuICAgICAgICAgICAgc3RvcHBlZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpbnN0YW5jZXMubGVuZ3RoID0gMDtcblxuICAgICAgICByZXR1cm4gc3RvcHBlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkcyB0aGUgYXNzZXQgYXNzaWduZWQgdG8gdGhpcyBzbG90LlxuICAgICAqL1xuICAgIGxvYWQoKSB7XG4gICAgICAgIGlmICghdGhpcy5faGFzQXNzZXQoKSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2Fzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9hc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX2Fzc2V0LCB0aGlzLl9vbkFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5vbmNlKCdhZGQ6JyArIHRoaXMuX2Fzc2V0LCB0aGlzLl9vbkFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgIGlmICghYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgIGFzc2V0Lm9uY2UoJ2xvYWQnLCB0aGlzLl9vbkFzc2V0TG9hZCwgdGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5sb2FkKGFzc2V0KTtcblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCdsb2FkJywgYXNzZXQucmVzb3VyY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3QgZXh0ZXJuYWwgV2ViIEF1ZGlvIEFQSSBub2Rlcy4gQW55IHNvdW5kIHBsYXllZCBieSB0aGlzIHNsb3Qgd2lsbCBhdXRvbWF0aWNhbGx5XG4gICAgICogYXR0YWNoIHRoZSBzcGVjaWZpZWQgbm9kZXMgdG8gdGhlIHNvdXJjZSB0aGF0IHBsYXlzIHRoZSBzb3VuZC4gWW91IG5lZWQgdG8gcGFzcyB0aGUgZmlyc3RcbiAgICAgKiBub2RlIG9mIHRoZSBub2RlIGdyYXBoIHRoYXQgeW91IGNyZWF0ZWQgZXh0ZXJuYWxseSBhbmQgdGhlIGxhc3Qgbm9kZSBvZiB0aGF0IGdyYXBoLiBUaGVcbiAgICAgKiBmaXJzdCBub2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBhdWRpbyBzb3VyY2UgYW5kIHRoZSBsYXN0IG5vZGUgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlXG4gICAgICogZGVzdGluYXRpb24gb2YgdGhlIEF1ZGlvQ29udGV4dCAoZS5nLiBzcGVha2VycykuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0F1ZGlvTm9kZX0gZmlyc3ROb2RlIC0gVGhlIGZpcnN0IG5vZGUgdGhhdCB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgYXVkaW8gc291cmNlIG9mXG4gICAgICogc291bmQgaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSB7QXVkaW9Ob2RlfSBbbGFzdE5vZGVdIC0gVGhlIGxhc3Qgbm9kZSB0aGF0IHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvbiBvZlxuICAgICAqIHRoZSBBdWRpb0NvbnRleHQuIElmIHVuc3BlY2lmaWVkIHRoZW4gdGhlIGZpcnN0Tm9kZSB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgKiBpbnN0ZWFkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGNvbnRleHQgPSBhcHAuc3lzdGVtcy5zb3VuZC5jb250ZXh0O1xuICAgICAqIHZhciBhbmFseXplciA9IGNvbnRleHQuY3JlYXRlQW5hbHl6ZXIoKTtcbiAgICAgKiB2YXIgZGlzdG9ydGlvbiA9IGNvbnRleHQuY3JlYXRlV2F2ZVNoYXBlcigpO1xuICAgICAqIHZhciBmaWx0ZXIgPSBjb250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAqIGFuYWx5emVyLmNvbm5lY3QoZGlzdG9ydGlvbik7XG4gICAgICogZGlzdG9ydGlvbi5jb25uZWN0KGZpbHRlcik7XG4gICAgICogc2xvdC5zZXRFeHRlcm5hbE5vZGVzKGFuYWx5emVyLCBmaWx0ZXIpO1xuICAgICAqL1xuICAgIHNldEV4dGVybmFsTm9kZXMoZmlyc3ROb2RlLCBsYXN0Tm9kZSkge1xuICAgICAgICBpZiAoIShmaXJzdE5vZGUpKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUaGUgZmlyc3ROb2RlIG11c3QgaGF2ZSBhIHZhbGlkIEF1ZGlvTm9kZScpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFsYXN0Tm9kZSkge1xuICAgICAgICAgICAgbGFzdE5vZGUgPSBmaXJzdE5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBmaXJzdE5vZGU7XG4gICAgICAgIHRoaXMuX2xhc3ROb2RlID0gbGFzdE5vZGU7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub3Qgb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uc2V0RXh0ZXJuYWxOb2RlcyhmaXJzdE5vZGUsIGxhc3ROb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFycyBhbnkgZXh0ZXJuYWwgbm9kZXMgc2V0IGJ5IHtAbGluayBTb3VuZFNsb3Qjc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICovXG4gICAgY2xlYXJFeHRlcm5hbE5vZGVzKCkge1xuICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub3Qgb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uY2xlYXJFeHRlcm5hbE5vZGVzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGFuIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHR3byBleHRlcm5hbCBub2RlcyBzZXQgYnkge0BsaW5rIFNvdW5kU2xvdCNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBdWRpb05vZGVbXX0gQW4gYXJyYXkgb2YgMiBlbGVtZW50cyB0aGF0IGNvbnRhaW5zIHRoZSBmaXJzdCBhbmQgbGFzdCBub2RlcyBzZXQgYnlcbiAgICAgKiB7QGxpbmsgU291bmRTbG90I3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqL1xuICAgIGdldEV4dGVybmFsTm9kZXMoKSB7XG4gICAgICAgIHJldHVybiBbdGhpcy5fZmlyc3ROb2RlLCB0aGlzLl9sYXN0Tm9kZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0cyB3aGV0aGVyIGFuIGFzc2V0IGlzIHNldCBvbiB0aGlzIHNsb3QuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IGhhcyBhbiBhc3NldCBhc3NpZ25lZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oYXNBc3NldCgpIHtcbiAgICAgICAgLy8gIT0gaW50ZW50aW9uYWxcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0ICE9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyB7QGxpbmsgU291bmRJbnN0YW5jZX0gd2l0aCB0aGUgcHJvcGVydGllcyBvZiB0aGUgc2xvdC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTb3VuZEluc3RhbmNlfSBUaGUgbmV3IGluc3RhbmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZUluc3RhbmNlKCkge1xuICAgICAgICBsZXQgaW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHRoaXMuX2NvbXBvbmVudDtcblxuICAgICAgICBsZXQgc291bmQgPSBudWxsO1xuXG4gICAgICAgIC8vIGdldCBzb3VuZCByZXNvdXJjZVxuICAgICAgICBpZiAodGhpcy5faGFzQXNzZXQoKSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHNvdW5kID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbml0aWFsaXplIGluc3RhbmNlIG9wdGlvbnNcbiAgICAgICAgY29uc3QgZGF0YSA9IGluc3RhbmNlT3B0aW9ucztcbiAgICAgICAgZGF0YS52b2x1bWUgPSB0aGlzLl92b2x1bWUgKiBjb21wb25lbnQudm9sdW1lO1xuICAgICAgICBkYXRhLnBpdGNoID0gdGhpcy5fcGl0Y2ggKiBjb21wb25lbnQucGl0Y2g7XG4gICAgICAgIGRhdGEubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIGRhdGEuc3RhcnRUaW1lID0gdGhpcy5fc3RhcnRUaW1lO1xuICAgICAgICBkYXRhLmR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb247XG5cbiAgICAgICAgZGF0YS5vblBsYXkgPSB0aGlzLl9vbkluc3RhbmNlUGxheUhhbmRsZXI7XG4gICAgICAgIGRhdGEub25QYXVzZSA9IHRoaXMuX29uSW5zdGFuY2VQYXVzZUhhbmRsZXI7XG4gICAgICAgIGRhdGEub25SZXN1bWUgPSB0aGlzLl9vbkluc3RhbmNlUmVzdW1lSGFuZGxlcjtcbiAgICAgICAgZGF0YS5vblN0b3AgPSB0aGlzLl9vbkluc3RhbmNlU3RvcEhhbmRsZXI7XG4gICAgICAgIGRhdGEub25FbmQgPSB0aGlzLl9vbkluc3RhbmNlRW5kSGFuZGxlcjtcblxuICAgICAgICBpZiAoY29tcG9uZW50LnBvc2l0aW9uYWwpIHtcbiAgICAgICAgICAgIGRhdGEucG9zaXRpb24uY29weShjb21wb25lbnQuZW50aXR5LmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgZGF0YS5tYXhEaXN0YW5jZSA9IGNvbXBvbmVudC5tYXhEaXN0YW5jZTtcbiAgICAgICAgICAgIGRhdGEucmVmRGlzdGFuY2UgPSBjb21wb25lbnQucmVmRGlzdGFuY2U7XG4gICAgICAgICAgICBkYXRhLnJvbGxPZmZGYWN0b3IgPSBjb21wb25lbnQucm9sbE9mZkZhY3RvcjtcbiAgICAgICAgICAgIGRhdGEuZGlzdGFuY2VNb2RlbCA9IGNvbXBvbmVudC5kaXN0YW5jZU1vZGVsO1xuXG4gICAgICAgICAgICBpbnN0YW5jZSA9IG5ldyBTb3VuZEluc3RhbmNlM2QodGhpcy5fbWFuYWdlciwgc291bmQsIGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5zdGFuY2UgPSBuZXcgU291bmRJbnN0YW5jZSh0aGlzLl9tYW5hZ2VyLCBzb3VuZCwgZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBob29rIGV4dGVybmFsIGF1ZGlvIG5vZGVzXG4gICAgICAgIGlmICh0aGlzLl9maXJzdE5vZGUpIHtcbiAgICAgICAgICAgIGluc3RhbmNlLnNldEV4dGVybmFsTm9kZXModGhpcy5fZmlyc3ROb2RlLCB0aGlzLl9sYXN0Tm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VQbGF5KGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgncGxheScsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdwbGF5JywgdGhpcywgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIF9vbkluc3RhbmNlUGF1c2UoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIHNsb3RcbiAgICAgICAgdGhpcy5maXJlKCdwYXVzZScsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdwYXVzZScsIHRoaXMsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBfb25JbnN0YW5jZVJlc3VtZShpbnN0YW5jZSkge1xuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gc2xvdFxuICAgICAgICB0aGlzLmZpcmUoJ3Jlc3VtZScsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdyZXN1bWUnLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VTdG9wKGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHJlbW92ZSBpbnN0YW5jZSB0aGF0IHN0b3BwZWRcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5pbnN0YW5jZXMuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgnc3RvcCcsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdzdG9wJywgdGhpcywgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIF9vbkluc3RhbmNlRW5kKGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHJlbW92ZSBpbnN0YW5jZSB0aGF0IGVuZGVkXG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuaW5zdGFuY2VzLmluZGV4T2YoaW5zdGFuY2UpO1xuICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gc2xvdFxuICAgICAgICB0aGlzLmZpcmUoJ2VuZCcsIGluc3RhbmNlKTtcblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gY29tcG9uZW50XG4gICAgICAgIHRoaXMuX2NvbXBvbmVudC5maXJlKCdlbmQnLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uQXNzZXRBZGQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfVxuXG4gICAgX29uQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubG9hZCgpO1xuICAgIH1cblxuICAgIF9vbkFzc2V0UmVtb3ZlZChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25Bc3NldEFkZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgIH1cblxuICAgIHVwZGF0ZVBvc2l0aW9uKHBvc2l0aW9uKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpbnN0YW5jZXNbaV0ucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ8bnVsbH1cbiAgICAgKi9cbiAgICBzZXQgYXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5fYXNzZXQ7XG5cbiAgICAgICAgaWYgKG9sZCkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLm9mZignYWRkOicgKyBvbGQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgY29uc3Qgb2xkQXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KG9sZCk7XG4gICAgICAgICAgICBpZiAob2xkQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBvbGRBc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uQXNzZXRSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Fzc2V0ID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9hc3NldCBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9hc3NldCA9IHRoaXMuX2Fzc2V0LmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9hZCBhc3NldCBpZiBjb21wb25lbnQgYW5kIGVudGl0eSBhcmUgZW5hYmxlZFxuICAgICAgICBpZiAodGhpcy5faGFzQXNzZXQoKSAmJiB0aGlzLl9jb21wb25lbnQuZW5hYmxlZCAmJiB0aGlzLl9jb21wb25lbnQuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgc2xvdCB3aWxsIGJlZ2luIHBsYXlpbmcgYXMgc29vbiBhcyBpdCBpcyBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgYXV0b1BsYXkodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXV0b1BsYXkgPSAhIXZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhdXRvUGxheSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F1dG9QbGF5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkdXJhdGlvbiBvZiB0aGUgc291bmQgdGhhdCB0aGUgc2xvdCB3aWxsIHBsYXkgc3RhcnRpbmcgZnJvbSBzdGFydFRpbWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBkdXJhdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZSkgfHwgMCkgfHwgbnVsbDtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5kdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGR1cmF0aW9uKCkge1xuICAgICAgICBsZXQgYXNzZXREdXJhdGlvbiA9IDA7XG4gICAgICAgIGlmICh0aGlzLl9oYXNBc3NldCgpKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2Fzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgYXNzZXREdXJhdGlvbiA9IGFzc2V0Py5yZXNvdXJjZSA/IGFzc2V0LnJlc291cmNlLmR1cmF0aW9uIDogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICE9IGludGVudGlvbmFsXG4gICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbiAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZHVyYXRpb24gJSAoYXNzZXREdXJhdGlvbiB8fCAxKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYXNzZXREdXJhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGFzc2V0IG9mIHRoZSBzbG90IGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc0xvYWRlZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2hhc0Fzc2V0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gISFhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3QgaXMgY3VycmVudGx5IHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1BhdXNlZCgpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7XG4gICAgICAgIGlmIChsZW4gPT09IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKCFpbnN0YW5jZXNbaV0uaXNQYXVzZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IGlzIGN1cnJlbnRseSBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGxheWluZygpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXNbaV0uaXNQbGF5aW5nKVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xvdCBpcyBjdXJyZW50bHkgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1N0b3BwZWQoKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIWluc3RhbmNlc1tpXS5pc1N0b3BwZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgc2xvdCB3aWxsIHJlc3RhcnQgd2hlbiBpdCBmaW5pc2hlcyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGxvb3AodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhdmFsdWU7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGluc3RhbmNlc1tpXS5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsb29wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZW4gc291bmRzIHBsYXllZCBmcm9tIHNsb3Qgd2lsbCBiZSBwbGF5ZWQgaW5kZXBlbmRlbnRseSBvZiBlYWNoIG90aGVyLiBPdGhlcndpc2VcbiAgICAgKiB0aGUgc2xvdCB3aWxsIGZpcnN0IHN0b3AgdGhlIGN1cnJlbnQgc291bmQgYmVmb3JlIHN0YXJ0aW5nIHRoZSBuZXcgb25lLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IG92ZXJsYXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fb3ZlcmxhcCA9ICEhdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG92ZXJsYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdmVybGFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwaXRjaCBtb2RpZmllciB0byBwbGF5IHRoZSBzb3VuZCB3aXRoLiBNdXN0IGJlIGxhcmdlciB0aGFuIDAuMDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBwaXRjaCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9waXRjaCA9IE1hdGgubWF4KE51bWJlcih2YWx1ZSkgfHwgMCwgMC4wMSk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0ucGl0Y2ggPSB0aGlzLnBpdGNoICogdGhpcy5fY29tcG9uZW50LnBpdGNoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHBpdGNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGl0Y2g7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHN0YXJ0IHRpbWUgZnJvbSB3aGljaCB0aGUgc291bmQgd2lsbCBzdGFydCBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc3RhcnRUaW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZSkgfHwgMCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uc3RhcnRUaW1lID0gdGhpcy5fc3RhcnRUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHN0YXJ0VGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0VGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdm9sdW1lIG1vZGlmaWVyIHRvIHBsYXkgdGhlIHNvdW5kIHdpdGguIEluIHJhbmdlIDAtMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHZvbHVtZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl92b2x1bWUgPSBtYXRoLmNsYW1wKE51bWJlcih2YWx1ZSkgfHwgMCwgMCwgMSk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0udm9sdW1lID0gdGhpcy5fdm9sdW1lICogdGhpcy5fY29tcG9uZW50LnZvbHVtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB2b2x1bWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92b2x1bWU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTb3VuZFNsb3QgfTtcbiJdLCJuYW1lcyI6WyJpbnN0YW5jZU9wdGlvbnMiLCJ2b2x1bWUiLCJwaXRjaCIsImxvb3AiLCJzdGFydFRpbWUiLCJkdXJhdGlvbiIsInBvc2l0aW9uIiwiVmVjMyIsIm1heERpc3RhbmNlIiwicmVmRGlzdGFuY2UiLCJyb2xsT2ZmRmFjdG9yIiwiZGlzdGFuY2VNb2RlbCIsIm9uUGxheSIsIm9uUGF1c2UiLCJvblJlc3VtZSIsIm9uU3RvcCIsIm9uRW5kIiwiU291bmRTbG90IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJjb21wb25lbnQiLCJuYW1lIiwib3B0aW9ucyIsImluc3RhbmNlcyIsIl9jb21wb25lbnQiLCJfYXNzZXRzIiwic3lzdGVtIiwiYXBwIiwiYXNzZXRzIiwiX21hbmFnZXIiLCJtYW5hZ2VyIiwiX3ZvbHVtZSIsInVuZGVmaW5lZCIsIm1hdGgiLCJjbGFtcCIsIk51bWJlciIsIl9waXRjaCIsIk1hdGgiLCJtYXgiLCJfbG9vcCIsIl9kdXJhdGlvbiIsIl9zdGFydFRpbWUiLCJfb3ZlcmxhcCIsIm92ZXJsYXAiLCJfYXV0b1BsYXkiLCJhdXRvUGxheSIsIl9maXJzdE5vZGUiLCJfbGFzdE5vZGUiLCJfYXNzZXQiLCJhc3NldCIsIkFzc2V0IiwiaWQiLCJfb25JbnN0YW5jZVBsYXlIYW5kbGVyIiwiX29uSW5zdGFuY2VQbGF5IiwiYmluZCIsIl9vbkluc3RhbmNlUGF1c2VIYW5kbGVyIiwiX29uSW5zdGFuY2VQYXVzZSIsIl9vbkluc3RhbmNlUmVzdW1lSGFuZGxlciIsIl9vbkluc3RhbmNlUmVzdW1lIiwiX29uSW5zdGFuY2VTdG9wSGFuZGxlciIsIl9vbkluc3RhbmNlU3RvcCIsIl9vbkluc3RhbmNlRW5kSGFuZGxlciIsIl9vbkluc3RhbmNlRW5kIiwicGxheSIsInN0b3AiLCJpc0xvYWRlZCIsIl9oYXNBc3NldCIsIkRlYnVnIiwid2FybiIsImluc3RhbmNlIiwiX2NyZWF0ZUluc3RhbmNlIiwicHVzaCIsIm9uTG9hZCIsInNvdW5kIiwicGxheVdoZW5Mb2FkZWQiLCJfcGxheVdoZW5Mb2FkZWQiLCJvZmYiLCJvbmNlIiwibG9hZCIsInBhdXNlIiwicGF1c2VkIiwiaSIsImxlbiIsImxlbmd0aCIsInJlc3VtZSIsInJlc3VtZWQiLCJzdG9wcGVkIiwiZ2V0IiwiX29uQXNzZXRBZGQiLCJfb25Bc3NldFJlbW92ZWQiLCJvbiIsInJlc291cmNlIiwiX29uQXNzZXRMb2FkIiwiZmlyZSIsInNldEV4dGVybmFsTm9kZXMiLCJmaXJzdE5vZGUiLCJsYXN0Tm9kZSIsImNvbnNvbGUiLCJlcnJvciIsImNsZWFyRXh0ZXJuYWxOb2RlcyIsImdldEV4dGVybmFsTm9kZXMiLCJkYXRhIiwicG9zaXRpb25hbCIsImNvcHkiLCJlbnRpdHkiLCJnZXRQb3NpdGlvbiIsIlNvdW5kSW5zdGFuY2UzZCIsIlNvdW5kSW5zdGFuY2UiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwidXBkYXRlUG9zaXRpb24iLCJ2YWx1ZSIsIm9sZCIsIm9sZEFzc2V0IiwiZW5hYmxlZCIsImFzc2V0RHVyYXRpb24iLCJpc1BhdXNlZCIsImlzUGxheWluZyIsImlzU3RvcHBlZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQWNBLE1BQU1BLGVBQWUsR0FBRztBQUNwQkMsRUFBQUEsTUFBTSxFQUFFLENBQUM7QUFDVEMsRUFBQUEsS0FBSyxFQUFFLENBQUM7QUFDUkMsRUFBQUEsSUFBSSxFQUFFLEtBQUs7QUFDWEMsRUFBQUEsU0FBUyxFQUFFLENBQUM7QUFDWkMsRUFBQUEsUUFBUSxFQUFFLENBQUM7RUFDWEMsUUFBUSxFQUFFLElBQUlDLElBQUksRUFBRTtBQUNwQkMsRUFBQUEsV0FBVyxFQUFFLENBQUM7QUFDZEMsRUFBQUEsV0FBVyxFQUFFLENBQUM7QUFDZEMsRUFBQUEsYUFBYSxFQUFFLENBQUM7QUFDaEJDLEVBQUFBLGFBQWEsRUFBRSxDQUFDO0FBQ2hCQyxFQUFBQSxNQUFNLEVBQUUsSUFBSTtBQUNaQyxFQUFBQSxPQUFPLEVBQUUsSUFBSTtBQUNiQyxFQUFBQSxRQUFRLEVBQUUsSUFBSTtBQUNkQyxFQUFBQSxNQUFNLEVBQUUsSUFBSTtBQUNaQyxFQUFBQSxLQUFLLEVBQUUsSUFBQTtBQUNYLENBQUMsQ0FBQTs7QUFPRCxNQUFNQyxTQUFTLFNBQVNDLFlBQVksQ0FBQzs7RUFxQ2pDQyxXQUFXLENBQUNDLFNBQVMsRUFBRUMsSUFBSSxHQUFHLFVBQVUsRUFBRUMsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUNwRCxJQUFBLEtBQUssRUFBRSxDQUFBO0FBQUMsSUFBQSxJQUFBLENBaENaRCxJQUFJLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFBQSxJQU9KRSxDQUFBQSxT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
