/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../../core/event-handler.js';
import { Debug } from '../../../core/debug.js';
import { math } from '../../../math/math.js';
import { Vec3 } from '../../../math/vec3.js';
import { Asset } from '../../../asset/asset.js';
import { SoundInstance } from '../../../sound/instance.js';
import { SoundInstance3d } from '../../../sound/instance3d.js';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xvdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL3NvdW5kL3Nsb3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBTb3VuZEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc291bmQvaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgU291bmRJbnN0YW5jZTNkIH0gZnJvbSAnLi4vLi4vLi4vc291bmQvaW5zdGFuY2UzZC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2NvbXBvbmVudC5qcycpLlNvdW5kQ29tcG9uZW50fSBTb3VuZENvbXBvbmVudCAqL1xuXG4vLyB0ZW1wb3Jhcnkgb2JqZWN0IGZvciBjcmVhdGluZyBpbnN0YW5jZXNcbmNvbnN0IGluc3RhbmNlT3B0aW9ucyA9IHtcbiAgICB2b2x1bWU6IDAsXG4gICAgcGl0Y2g6IDAsXG4gICAgbG9vcDogZmFsc2UsXG4gICAgc3RhcnRUaW1lOiAwLFxuICAgIGR1cmF0aW9uOiAwLFxuICAgIHBvc2l0aW9uOiBuZXcgVmVjMygpLFxuICAgIG1heERpc3RhbmNlOiAwLFxuICAgIHJlZkRpc3RhbmNlOiAwLFxuICAgIHJvbGxPZmZGYWN0b3I6IDAsXG4gICAgZGlzdGFuY2VNb2RlbDogMCxcbiAgICBvblBsYXk6IG51bGwsXG4gICAgb25QYXVzZTogbnVsbCxcbiAgICBvblJlc3VtZTogbnVsbCxcbiAgICBvblN0b3A6IG51bGwsXG4gICAgb25FbmQ6IG51bGxcbn07XG5cbi8qKlxuICogVGhlIFNvdW5kU2xvdCBjb250cm9scyBwbGF5YmFjayBvZiBhbiBhdWRpbyBhc3NldC5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFNvdW5kU2xvdCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIHNsb3QuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSB0aGF0IGNvbnRhaW5zIGFsbCB0aGUge0BsaW5rIFNvdW5kSW5zdGFuY2V9cyBjdXJyZW50bHkgYmVpbmcgcGxheWVkIGJ5IHRoZSBzbG90LlxuICAgICAqXG4gICAgICogQHR5cGUge1NvdW5kSW5zdGFuY2VbXX1cbiAgICAgKi9cbiAgICBpbnN0YW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTb3VuZFNsb3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NvdW5kQ29tcG9uZW50fSBjb21wb25lbnQgLSBUaGUgQ29tcG9uZW50IHRoYXQgY3JlYXRlZCB0aGlzIHNsb3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90LiBEZWZhdWx0cyB0byAnVW50aXRsZWQnLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBTZXR0aW5ncyBmb3IgdGhlIHNsb3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnZvbHVtZT0xXSAtIFRoZSBwbGF5YmFjayB2b2x1bWUsIGJldHdlZW4gMCBhbmQgMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMucGl0Y2g9MV0gLSBUaGUgcmVsYXRpdmUgcGl0Y2gsIGRlZmF1bHQgb2YgMSwgcGxheXMgYXQgbm9ybWFsIHBpdGNoLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubG9vcD1mYWxzZV0gLSBJZiB0cnVlIHRoZSBzb3VuZCB3aWxsIHJlc3RhcnQgd2hlbiBpdCByZWFjaGVzIHRoZVxuICAgICAqIGVuZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3RhcnRUaW1lPTBdIC0gVGhlIHN0YXJ0IHRpbWUgZnJvbSB3aGljaCB0aGUgc291bmQgd2lsbCBzdGFydFxuICAgICAqIHBsYXlpbmcuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmR1cmF0aW9uPW51bGxdIC0gVGhlIGR1cmF0aW9uIG9mIHRoZSBzb3VuZCB0aGF0IHRoZSBzbG90IHdpbGwgcGxheVxuICAgICAqIHN0YXJ0aW5nIGZyb20gc3RhcnRUaW1lLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMub3ZlcmxhcD1mYWxzZV0gLSBJZiB0cnVlIHRoZW4gc291bmRzIHBsYXllZCBmcm9tIHNsb3Qgd2lsbCBiZVxuICAgICAqIHBsYXllZCBpbmRlcGVuZGVudGx5IG9mIGVhY2ggb3RoZXIuIE90aGVyd2lzZSB0aGUgc2xvdCB3aWxsIGZpcnN0IHN0b3AgdGhlIGN1cnJlbnQgc291bmRcbiAgICAgKiBiZWZvcmUgc3RhcnRpbmcgdGhlIG5ldyBvbmUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hdXRvUGxheT1mYWxzZV0gLSBJZiB0cnVlIHRoZSBzbG90IHdpbGwgc3RhcnQgcGxheWluZyBhcyBzb29uIGFzXG4gICAgICogaXRzIGF1ZGlvIGFzc2V0IGlzIGxvYWRlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYXNzZXQ9bnVsbF0gLSBUaGUgYXNzZXQgaWQgb2YgdGhlIGF1ZGlvIGFzc2V0IHRoYXQgaXMgZ29pbmcgdG8gYmVcbiAgICAgKiBwbGF5ZWQgYnkgdGhpcyBzbG90LlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNvbXBvbmVudCwgbmFtZSA9ICdVbnRpdGxlZCcsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2NvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gY29tcG9uZW50LnN5c3RlbS5tYW5hZ2VyO1xuXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgICAgICAgdGhpcy5fdm9sdW1lID0gb3B0aW9ucy52b2x1bWUgIT09IHVuZGVmaW5lZCA/IG1hdGguY2xhbXAoTnVtYmVyKG9wdGlvbnMudm9sdW1lKSB8fCAwLCAwLCAxKSA6IDE7XG4gICAgICAgIHRoaXMuX3BpdGNoID0gb3B0aW9ucy5waXRjaCAhPT0gdW5kZWZpbmVkID8gTWF0aC5tYXgoMC4wMSwgTnVtYmVyKG9wdGlvbnMucGl0Y2gpIHx8IDApIDogMTtcbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhKG9wdGlvbnMubG9vcCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5sb29wIDogZmFsc2UpO1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb24gPiAwID8gb3B0aW9ucy5kdXJhdGlvbiA6IG51bGw7XG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcihvcHRpb25zLnN0YXJ0VGltZSkgfHwgMCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXAgPSAhIShvcHRpb25zLm92ZXJsYXApO1xuICAgICAgICB0aGlzLl9hdXRvUGxheSA9ICEhKG9wdGlvbnMuYXV0b1BsYXkpO1xuICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYXNzZXQgPSBvcHRpb25zLmFzc2V0O1xuICAgICAgICBpZiAodGhpcy5fYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXQgPSB0aGlzLl9hc3NldC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VQbGF5SGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VQbGF5LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VQYXVzZUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUGF1c2UuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb25JbnN0YW5jZVJlc3VtZUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUmVzdW1lLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VTdG9wSGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VTdG9wLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VFbmRIYW5kbGVyID0gdGhpcy5fb25JbnN0YW5jZUVuZC5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBzdGFydHMgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZFNsb3QjcGxheVxuICAgICAqIEBwYXJhbSB7U291bmRJbnN0YW5jZX0gaW5zdGFuY2UgLSBUaGUgaW5zdGFuY2UgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kU2xvdCNwYXVzZVxuICAgICAqIEBwYXJhbSB7U291bmRJbnN0YW5jZX0gaW5zdGFuY2UgLSBUaGUgaW5zdGFuY2UgdGhhdCB3YXMgcGF1c2VkIGNyZWF0ZWQgdG8gcGxheSB0aGUgc291bmQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgcmVzdW1lZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZFNsb3QjcmVzdW1lXG4gICAgICogQHBhcmFtIHtTb3VuZEluc3RhbmNlfSBpbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSB0aGF0IHdhcyByZXN1bWVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNvdW5kIGluc3RhbmNlIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRTbG90I3N0b3BcbiAgICAgKiBAcGFyYW0ge1NvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlIHRoYXQgd2FzIHN0b3BwZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBhc3NldCBhc3NpZ25lZCB0byB0aGUgc2xvdCBpcyBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRTbG90I2xvYWRcbiAgICAgKiBAcGFyYW0ge1NvdW5kfSBzb3VuZCAtIFRoZSBzb3VuZCByZXNvdXJjZSB0aGF0IHdhcyBsb2FkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBQbGF5cyBhIHNvdW5kLiBJZiB7QGxpbmsgU291bmRTbG90I292ZXJsYXB9IGlzIHRydWUgdGhlIG5ldyBzb3VuZCBpbnN0YW5jZSB3aWxsIGJlIHBsYXllZFxuICAgICAqIGluZGVwZW5kZW50bHkgb2YgYW55IG90aGVyIGluc3RhbmNlcyBhbHJlYWR5IHBsYXlpbmcuIE90aGVyd2lzZSBleGlzdGluZyBzb3VuZCBpbnN0YW5jZXNcbiAgICAgKiB3aWxsIHN0b3AgYmVmb3JlIHBsYXlpbmcgdGhlIG5ldyBzb3VuZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTb3VuZEluc3RhbmNlfSBUaGUgbmV3IHNvdW5kIGluc3RhbmNlLlxuICAgICAqL1xuICAgIHBsYXkoKSB7XG4gICAgICAgIC8vIHN0b3AgaWYgb3ZlcmxhcCBpcyBmYWxzZVxuICAgICAgICBpZiAoIXRoaXMub3ZlcmxhcCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBub3QgbG9hZGVkIGFuZCBkb2Vzbid0IGhhdmUgYXNzZXQgLSB0aGVuIHdlIGNhbm5vdCBwbGF5IGl0LiAgV2FybiBhbmQgZXhpdC5cbiAgICAgICAgaWYgKCF0aGlzLmlzTG9hZGVkICYmICF0aGlzLl9oYXNBc3NldCgpKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gcGxheSBTb3VuZFNsb3QgJHt0aGlzLm5hbWV9IGJ1dCBpdCBpcyBub3QgbG9hZGVkIGFuZCBkb2Vzbid0IGhhdmUgYW4gYXNzZXQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzLl9jcmVhdGVJbnN0YW5jZSgpO1xuICAgICAgICB0aGlzLmluc3RhbmNlcy5wdXNoKGluc3RhbmNlKTtcblxuICAgICAgICAvLyBpZiBub3QgbG9hZGVkIHRoZW4gbG9hZCBmaXJzdFxuICAgICAgICAvLyBhbmQgdGhlbiBzZXQgc291bmQgcmVzb3VyY2Ugb24gdGhlIGNyZWF0ZWQgaW5zdGFuY2VcbiAgICAgICAgaWYgKCF0aGlzLmlzTG9hZGVkKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAoc291bmQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwbGF5V2hlbkxvYWRlZCA9IGluc3RhbmNlLl9wbGF5V2hlbkxvYWRlZDtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5zb3VuZCA9IHNvdW5kO1xuICAgICAgICAgICAgICAgIGlmIChwbGF5V2hlbkxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5wbGF5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdGhpcy5vZmYoJ2xvYWQnLCBvbkxvYWQpO1xuICAgICAgICAgICAgdGhpcy5vbmNlKCdsb2FkJywgb25Mb2FkKTtcbiAgICAgICAgICAgIHRoaXMubG9hZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5zdGFuY2UucGxheSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyBhbGwgc291bmQgaW5zdGFuY2VzLiBUbyBjb250aW51ZSBwbGF5YmFjayBjYWxsIHtAbGluayBTb3VuZFNsb3QjcmVzdW1lfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzb3VuZCBpbnN0YW5jZXMgcGF1c2VkIHN1Y2Nlc3NmdWxseSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICBsZXQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXNbaV0ucGF1c2UoKSkge1xuICAgICAgICAgICAgICAgIHBhdXNlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcGF1c2VkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgcGxheWJhY2sgb2YgYWxsIHBhdXNlZCBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBhbnkgaW5zdGFuY2VzIHdlcmUgcmVzdW1lZC5cbiAgICAgKi9cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIGxldCByZXN1bWVkID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXNbaV0ucmVzdW1lKCkpXG4gICAgICAgICAgICAgICAgcmVzdW1lZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdW1lZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyBwbGF5YmFjayBvZiBhbGwgc291bmQgaW5zdGFuY2VzLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgYW55IGluc3RhbmNlcyB3ZXJlIHN0b3BwZWQuXG4gICAgICovXG4gICAgc3RvcCgpIHtcbiAgICAgICAgbGV0IHN0b3BwZWQgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgbGV0IGkgPSBpbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICAvLyBkbyB0aGlzIGluIHJldmVyc2Ugb3JkZXIgYmVjYXVzZSBhcyBlYWNoIGluc3RhbmNlXG4gICAgICAgIC8vIGlzIHN0b3BwZWQgaXQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGluc3RhbmNlcyBhcnJheVxuICAgICAgICAvLyBieSB0aGUgaW5zdGFuY2Ugc3RvcCBldmVudCBoYW5kbGVyXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zdG9wKCk7XG4gICAgICAgICAgICBzdG9wcGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluc3RhbmNlcy5sZW5ndGggPSAwO1xuXG4gICAgICAgIHJldHVybiBzdG9wcGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWRzIHRoZSBhc3NldCBhc3NpZ25lZCB0byB0aGlzIHNsb3QuXG4gICAgICovXG4gICAgbG9hZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9oYXNBc3NldCgpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLm9uY2UoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKCFhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Bc3NldExvYWQsIHRoaXMpO1xuICAgICAgICAgICAgYXNzZXQub25jZSgnbG9hZCcsIHRoaXMuX29uQXNzZXRMb2FkLCB0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLmxvYWQoYXNzZXQpO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ2xvYWQnLCBhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdCBleHRlcm5hbCBXZWIgQXVkaW8gQVBJIG5vZGVzLiBBbnkgc291bmQgcGxheWVkIGJ5IHRoaXMgc2xvdCB3aWxsIGF1dG9tYXRpY2FsbHlcbiAgICAgKiBhdHRhY2ggdGhlIHNwZWNpZmllZCBub2RlcyB0byB0aGUgc291cmNlIHRoYXQgcGxheXMgdGhlIHNvdW5kLiBZb3UgbmVlZCB0byBwYXNzIHRoZSBmaXJzdFxuICAgICAqIG5vZGUgb2YgdGhlIG5vZGUgZ3JhcGggdGhhdCB5b3UgY3JlYXRlZCBleHRlcm5hbGx5IGFuZCB0aGUgbGFzdCBub2RlIG9mIHRoYXQgZ3JhcGguIFRoZVxuICAgICAqIGZpcnN0IG5vZGUgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGF1ZGlvIHNvdXJjZSBhbmQgdGhlIGxhc3Qgbm9kZSB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGVcbiAgICAgKiBkZXN0aW5hdGlvbiBvZiB0aGUgQXVkaW9Db250ZXh0IChlLmcuIHNwZWFrZXJzKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXVkaW9Ob2RlfSBmaXJzdE5vZGUgLSBUaGUgZmlyc3Qgbm9kZSB0aGF0IHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBhdWRpbyBzb3VyY2Ugb2ZcbiAgICAgKiBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtBdWRpb05vZGV9IFtsYXN0Tm9kZV0gLSBUaGUgbGFzdCBub2RlIHRoYXQgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIG9mXG4gICAgICogdGhlIEF1ZGlvQ29udGV4dC4gSWYgdW5zcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3ROb2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAqIGluc3RlYWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgY29udGV4dCA9IGFwcC5zeXN0ZW1zLnNvdW5kLmNvbnRleHQ7XG4gICAgICogdmFyIGFuYWx5emVyID0gY29udGV4dC5jcmVhdGVBbmFseXplcigpO1xuICAgICAqIHZhciBkaXN0b3J0aW9uID0gY29udGV4dC5jcmVhdGVXYXZlU2hhcGVyKCk7XG4gICAgICogdmFyIGZpbHRlciA9IGNvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICogYW5hbHl6ZXIuY29ubmVjdChkaXN0b3J0aW9uKTtcbiAgICAgKiBkaXN0b3J0aW9uLmNvbm5lY3QoZmlsdGVyKTtcbiAgICAgKiBzbG90LnNldEV4dGVybmFsTm9kZXMoYW5hbHl6ZXIsIGZpbHRlcik7XG4gICAgICovXG4gICAgc2V0RXh0ZXJuYWxOb2RlcyhmaXJzdE5vZGUsIGxhc3ROb2RlKSB7XG4gICAgICAgIGlmICghKGZpcnN0Tm9kZSkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1RoZSBmaXJzdE5vZGUgbXVzdCBoYXZlIGEgdmFsaWQgQXVkaW9Ob2RlJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWxhc3ROb2RlKSB7XG4gICAgICAgICAgICBsYXN0Tm9kZSA9IGZpcnN0Tm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2ZpcnN0Tm9kZSA9IGZpcnN0Tm9kZTtcbiAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBsYXN0Tm9kZTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vdCBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zZXRFeHRlcm5hbE5vZGVzKGZpcnN0Tm9kZSwgbGFzdE5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIGFueSBleHRlcm5hbCBub2RlcyBzZXQgYnkge0BsaW5rIFNvdW5kU2xvdCNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKi9cbiAgICBjbGVhckV4dGVybmFsTm9kZXMoKSB7XG4gICAgICAgIHRoaXMuX2ZpcnN0Tm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2xhc3ROb2RlID0gbnVsbDtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vdCBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5jbGVhckV4dGVybmFsTm9kZXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdHdvIGV4dGVybmFsIG5vZGVzIHNldCBieSB7QGxpbmsgU291bmRTbG90I3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge0F1ZGlvTm9kZVtdfSBBbiBhcnJheSBvZiAyIGVsZW1lbnRzIHRoYXQgY29udGFpbnMgdGhlIGZpcnN0IGFuZCBsYXN0IG5vZGVzIHNldCBieVxuICAgICAqIHtAbGluayBTb3VuZFNsb3Qjc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICovXG4gICAgZ2V0RXh0ZXJuYWxOb2RlcygpIHtcbiAgICAgICAgcmV0dXJuIFt0aGlzLl9maXJzdE5vZGUsIHRoaXMuX2xhc3ROb2RlXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgYW4gYXNzZXQgaXMgc2V0IG9uIHRoaXMgc2xvdC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3QgaGFzIGFuIGFzc2V0IGFzc2lnbmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhc0Fzc2V0KCkge1xuICAgICAgICAvLyAhPSBpbnRlbnRpb25hbFxuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXQgIT0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IHtAbGluayBTb3VuZEluc3RhbmNlfSB3aXRoIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBzbG90LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1NvdW5kSW5zdGFuY2V9IFRoZSBuZXcgaW5zdGFuY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY3JlYXRlSW5zdGFuY2UoKSB7XG4gICAgICAgIGxldCBpbnN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50O1xuXG4gICAgICAgIGxldCBzb3VuZCA9IG51bGw7XG5cbiAgICAgICAgLy8gZ2V0IHNvdW5kIHJlc291cmNlXG4gICAgICAgIGlmICh0aGlzLl9oYXNBc3NldCgpKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2Fzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgc291bmQgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluaXRpYWxpemUgaW5zdGFuY2Ugb3B0aW9uc1xuICAgICAgICBjb25zdCBkYXRhID0gaW5zdGFuY2VPcHRpb25zO1xuICAgICAgICBkYXRhLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZSAqIGNvbXBvbmVudC52b2x1bWU7XG4gICAgICAgIGRhdGEucGl0Y2ggPSB0aGlzLl9waXRjaCAqIGNvbXBvbmVudC5waXRjaDtcbiAgICAgICAgZGF0YS5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgZGF0YS5zdGFydFRpbWUgPSB0aGlzLl9zdGFydFRpbWU7XG4gICAgICAgIGRhdGEuZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbjtcblxuICAgICAgICBkYXRhLm9uUGxheSA9IHRoaXMuX29uSW5zdGFuY2VQbGF5SGFuZGxlcjtcbiAgICAgICAgZGF0YS5vblBhdXNlID0gdGhpcy5fb25JbnN0YW5jZVBhdXNlSGFuZGxlcjtcbiAgICAgICAgZGF0YS5vblJlc3VtZSA9IHRoaXMuX29uSW5zdGFuY2VSZXN1bWVIYW5kbGVyO1xuICAgICAgICBkYXRhLm9uU3RvcCA9IHRoaXMuX29uSW5zdGFuY2VTdG9wSGFuZGxlcjtcbiAgICAgICAgZGF0YS5vbkVuZCA9IHRoaXMuX29uSW5zdGFuY2VFbmRIYW5kbGVyO1xuXG4gICAgICAgIGlmIChjb21wb25lbnQucG9zaXRpb25hbCkge1xuICAgICAgICAgICAgZGF0YS5wb3NpdGlvbi5jb3B5KGNvbXBvbmVudC5lbnRpdHkuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICBkYXRhLm1heERpc3RhbmNlID0gY29tcG9uZW50Lm1heERpc3RhbmNlO1xuICAgICAgICAgICAgZGF0YS5yZWZEaXN0YW5jZSA9IGNvbXBvbmVudC5yZWZEaXN0YW5jZTtcbiAgICAgICAgICAgIGRhdGEucm9sbE9mZkZhY3RvciA9IGNvbXBvbmVudC5yb2xsT2ZmRmFjdG9yO1xuICAgICAgICAgICAgZGF0YS5kaXN0YW5jZU1vZGVsID0gY29tcG9uZW50LmRpc3RhbmNlTW9kZWw7XG5cbiAgICAgICAgICAgIGluc3RhbmNlID0gbmV3IFNvdW5kSW5zdGFuY2UzZCh0aGlzLl9tYW5hZ2VyLCBzb3VuZCwgZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnN0YW5jZSA9IG5ldyBTb3VuZEluc3RhbmNlKHRoaXMuX21hbmFnZXIsIHNvdW5kLCBkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhvb2sgZXh0ZXJuYWwgYXVkaW8gbm9kZXNcbiAgICAgICAgaWYgKHRoaXMuX2ZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgaW5zdGFuY2Uuc2V0RXh0ZXJuYWxOb2Rlcyh0aGlzLl9maXJzdE5vZGUsIHRoaXMuX2xhc3ROb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9XG5cbiAgICBfb25JbnN0YW5jZVBsYXkoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIHNsb3RcbiAgICAgICAgdGhpcy5maXJlKCdwbGF5JywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3BsYXknLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VQYXVzZShpbnN0YW5jZSkge1xuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gc2xvdFxuICAgICAgICB0aGlzLmZpcmUoJ3BhdXNlJywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3BhdXNlJywgdGhpcywgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIF9vbkluc3RhbmNlUmVzdW1lKGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgncmVzdW1lJywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3Jlc3VtZScsIHRoaXMsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBfb25JbnN0YW5jZVN0b3AoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGluc3RhbmNlIHRoYXQgc3RvcHBlZFxuICAgICAgICBjb25zdCBpZHggPSB0aGlzLmluc3RhbmNlcy5pbmRleE9mKGluc3RhbmNlKTtcbiAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIHNsb3RcbiAgICAgICAgdGhpcy5maXJlKCdzdG9wJywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3N0b3AnLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VFbmQoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGluc3RhbmNlIHRoYXQgZW5kZWRcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5pbnN0YW5jZXMuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgnZW5kJywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ2VuZCcsIHRoaXMsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBfb25Bc3NldEFkZChhc3NldCkge1xuICAgICAgICB0aGlzLmxvYWQoKTtcbiAgICB9XG5cbiAgICBfb25Bc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfVxuXG4gICAgX29uQXNzZXRSZW1vdmVkKGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbkFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlUG9zaXRpb24ocG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGluc3RhbmNlc1tpXS5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcnxudWxsfVxuICAgICAqL1xuICAgIHNldCBhc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLl9hc3NldDtcblxuICAgICAgICBpZiAob2xkKSB7XG4gICAgICAgICAgICB0aGlzLl9hc3NldHMub2ZmKCdhZGQ6JyArIG9sZCwgdGhpcy5fb25Bc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICBjb25zdCBvbGRBc3NldCA9IHRoaXMuX2Fzc2V0cy5nZXQob2xkKTtcbiAgICAgICAgICAgIGlmIChvbGRBc3NldCkge1xuICAgICAgICAgICAgICAgIG9sZEFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYXNzZXQgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0IGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gdGhpcy5fYXNzZXQuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb2FkIGFzc2V0IGlmIGNvbXBvbmVudCBhbmQgZW50aXR5IGFyZSBlbmFibGVkXG4gICAgICAgIGlmICh0aGlzLl9oYXNBc3NldCgpICYmIHRoaXMuX2NvbXBvbmVudC5lbmFibGVkICYmIHRoaXMuX2NvbXBvbmVudC5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBzbG90IHdpbGwgYmVnaW4gcGxheWluZyBhcyBzb29uIGFzIGl0IGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBhdXRvUGxheSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hdXRvUGxheSA9ICEhdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9QbGF5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b1BsYXk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGR1cmF0aW9uIG9mIHRoZSBzb3VuZCB0aGF0IHRoZSBzbG90IHdpbGwgcGxheSBzdGFydGluZyBmcm9tIHN0YXJ0VGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGR1cmF0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2R1cmF0aW9uID0gTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlKSB8fCAwKSB8fCBudWxsO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnN0YW5jZXMgaWYgbm9uIG92ZXJsYXBwaW5nXG4gICAgICAgIGlmICghdGhpcy5fb3ZlcmxhcCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLmR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZHVyYXRpb24oKSB7XG4gICAgICAgIGxldCBhc3NldER1cmF0aW9uID0gMDtcbiAgICAgICAgaWYgKHRoaXMuX2hhc0Fzc2V0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgICAgICBhc3NldER1cmF0aW9uID0gYXNzZXQ/LnJlc291cmNlID8gYXNzZXQucmVzb3VyY2UuZHVyYXRpb24gOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gIT0gaW50ZW50aW9uYWxcbiAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9kdXJhdGlvbiAlIChhc3NldER1cmF0aW9uIHx8IDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc3NldER1cmF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgYXNzZXQgb2YgdGhlIHNsb3QgaXMgbG9hZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzTG9hZGVkKCkge1xuICAgICAgICBpZiAodGhpcy5faGFzQXNzZXQoKSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhIWFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xvdCBpcyBjdXJyZW50bHkgcGF1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGF1c2VkKCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgY29uc3QgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgaWYgKGxlbiA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIWluc3RhbmNlc1tpXS5pc1BhdXNlZClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3QgaXMgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQbGF5aW5nKCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNlc1tpXS5pc1BsYXlpbmcpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IGlzIGN1cnJlbnRseSBzdG9wcGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzU3RvcHBlZCgpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghaW5zdGFuY2VzW2ldLmlzU3RvcHBlZClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBzbG90IHdpbGwgcmVzdGFydCB3aGVuIGl0IGZpbmlzaGVzIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbG9vcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9sb29wID0gISF2YWx1ZTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaW5zdGFuY2VzW2ldLmxvb3AgPSB0aGlzLl9sb29wO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxvb3AoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb29wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlbiBzb3VuZHMgcGxheWVkIGZyb20gc2xvdCB3aWxsIGJlIHBsYXllZCBpbmRlcGVuZGVudGx5IG9mIGVhY2ggb3RoZXIuIE90aGVyd2lzZVxuICAgICAqIHRoZSBzbG90IHdpbGwgZmlyc3Qgc3RvcCB0aGUgY3VycmVudCBzb3VuZCBiZWZvcmUgc3RhcnRpbmcgdGhlIG5ldyBvbmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgb3ZlcmxhcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9vdmVybGFwID0gISF2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgb3ZlcmxhcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX292ZXJsYXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBpdGNoIG1vZGlmaWVyIHRvIHBsYXkgdGhlIHNvdW5kIHdpdGguIE11c3QgYmUgbGFyZ2VyIHRoYW4gMC4wMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHBpdGNoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BpdGNoID0gTWF0aC5tYXgoTnVtYmVyKHZhbHVlKSB8fCAwLCAwLjAxKTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5waXRjaCA9IHRoaXMucGl0Y2ggKiB0aGlzLl9jb21wb25lbnQucGl0Y2g7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcGl0Y2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXRjaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhcnQgdGltZSBmcm9tIHdoaWNoIHRoZSBzb3VuZCB3aWxsIHN0YXJ0IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzdGFydFRpbWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc3RhcnRUaW1lID0gTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlKSB8fCAwKTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zdGFydFRpbWUgPSB0aGlzLl9zdGFydFRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3RhcnRUaW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhcnRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB2b2x1bWUgbW9kaWZpZXIgdG8gcGxheSB0aGUgc291bmQgd2l0aC4gSW4gcmFuZ2UgMC0xLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgdm9sdW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IG1hdGguY2xhbXAoTnVtYmVyKHZhbHVlKSB8fCAwLCAwLCAxKTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS52b2x1bWUgPSB0aGlzLl92b2x1bWUgKiB0aGlzLl9jb21wb25lbnQudm9sdW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHZvbHVtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNvdW5kU2xvdCB9O1xuIl0sIm5hbWVzIjpbImluc3RhbmNlT3B0aW9ucyIsInZvbHVtZSIsInBpdGNoIiwibG9vcCIsInN0YXJ0VGltZSIsImR1cmF0aW9uIiwicG9zaXRpb24iLCJWZWMzIiwibWF4RGlzdGFuY2UiLCJyZWZEaXN0YW5jZSIsInJvbGxPZmZGYWN0b3IiLCJkaXN0YW5jZU1vZGVsIiwib25QbGF5Iiwib25QYXVzZSIsIm9uUmVzdW1lIiwib25TdG9wIiwib25FbmQiLCJTb3VuZFNsb3QiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImNvbXBvbmVudCIsIm5hbWUiLCJvcHRpb25zIiwiaW5zdGFuY2VzIiwiX2NvbXBvbmVudCIsIl9hc3NldHMiLCJzeXN0ZW0iLCJhcHAiLCJhc3NldHMiLCJfbWFuYWdlciIsIm1hbmFnZXIiLCJfdm9sdW1lIiwidW5kZWZpbmVkIiwibWF0aCIsImNsYW1wIiwiTnVtYmVyIiwiX3BpdGNoIiwiTWF0aCIsIm1heCIsIl9sb29wIiwiX2R1cmF0aW9uIiwiX3N0YXJ0VGltZSIsIl9vdmVybGFwIiwib3ZlcmxhcCIsIl9hdXRvUGxheSIsImF1dG9QbGF5IiwiX2ZpcnN0Tm9kZSIsIl9sYXN0Tm9kZSIsIl9hc3NldCIsImFzc2V0IiwiQXNzZXQiLCJpZCIsIl9vbkluc3RhbmNlUGxheUhhbmRsZXIiLCJfb25JbnN0YW5jZVBsYXkiLCJiaW5kIiwiX29uSW5zdGFuY2VQYXVzZUhhbmRsZXIiLCJfb25JbnN0YW5jZVBhdXNlIiwiX29uSW5zdGFuY2VSZXN1bWVIYW5kbGVyIiwiX29uSW5zdGFuY2VSZXN1bWUiLCJfb25JbnN0YW5jZVN0b3BIYW5kbGVyIiwiX29uSW5zdGFuY2VTdG9wIiwiX29uSW5zdGFuY2VFbmRIYW5kbGVyIiwiX29uSW5zdGFuY2VFbmQiLCJwbGF5Iiwic3RvcCIsImlzTG9hZGVkIiwiX2hhc0Fzc2V0IiwiRGVidWciLCJ3YXJuIiwiaW5zdGFuY2UiLCJfY3JlYXRlSW5zdGFuY2UiLCJwdXNoIiwib25Mb2FkIiwic291bmQiLCJwbGF5V2hlbkxvYWRlZCIsIl9wbGF5V2hlbkxvYWRlZCIsIm9mZiIsIm9uY2UiLCJsb2FkIiwicGF1c2UiLCJwYXVzZWQiLCJpIiwibGVuIiwibGVuZ3RoIiwicmVzdW1lIiwicmVzdW1lZCIsInN0b3BwZWQiLCJnZXQiLCJfb25Bc3NldEFkZCIsIl9vbkFzc2V0UmVtb3ZlZCIsIm9uIiwicmVzb3VyY2UiLCJfb25Bc3NldExvYWQiLCJmaXJlIiwic2V0RXh0ZXJuYWxOb2RlcyIsImZpcnN0Tm9kZSIsImxhc3ROb2RlIiwiY29uc29sZSIsImVycm9yIiwiY2xlYXJFeHRlcm5hbE5vZGVzIiwiZ2V0RXh0ZXJuYWxOb2RlcyIsImRhdGEiLCJwb3NpdGlvbmFsIiwiY29weSIsImVudGl0eSIsImdldFBvc2l0aW9uIiwiU291bmRJbnN0YW5jZTNkIiwiU291bmRJbnN0YW5jZSIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJ1cGRhdGVQb3NpdGlvbiIsInZhbHVlIiwib2xkIiwib2xkQXNzZXQiLCJlbmFibGVkIiwiYXNzZXREdXJhdGlvbiIsImlzUGF1c2VkIiwiaXNQbGF5aW5nIiwiaXNTdG9wcGVkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBY0EsTUFBTUEsZUFBZSxHQUFHO0FBQ3BCQyxFQUFBQSxNQUFNLEVBQUUsQ0FEWTtBQUVwQkMsRUFBQUEsS0FBSyxFQUFFLENBRmE7QUFHcEJDLEVBQUFBLElBQUksRUFBRSxLQUhjO0FBSXBCQyxFQUFBQSxTQUFTLEVBQUUsQ0FKUztBQUtwQkMsRUFBQUEsUUFBUSxFQUFFLENBTFU7RUFNcEJDLFFBQVEsRUFBRSxJQUFJQyxJQUFKLEVBTlU7QUFPcEJDLEVBQUFBLFdBQVcsRUFBRSxDQVBPO0FBUXBCQyxFQUFBQSxXQUFXLEVBQUUsQ0FSTztBQVNwQkMsRUFBQUEsYUFBYSxFQUFFLENBVEs7QUFVcEJDLEVBQUFBLGFBQWEsRUFBRSxDQVZLO0FBV3BCQyxFQUFBQSxNQUFNLEVBQUUsSUFYWTtBQVlwQkMsRUFBQUEsT0FBTyxFQUFFLElBWlc7QUFhcEJDLEVBQUFBLFFBQVEsRUFBRSxJQWJVO0FBY3BCQyxFQUFBQSxNQUFNLEVBQUUsSUFkWTtBQWVwQkMsRUFBQUEsS0FBSyxFQUFFLElBQUE7QUFmYSxDQUF4QixDQUFBOztBQXVCQSxNQUFNQyxTQUFOLFNBQXdCQyxZQUF4QixDQUFxQztFQXFDakNDLFdBQVcsQ0FBQ0MsU0FBRCxFQUFZQyxJQUFJLEdBQUcsVUFBbkIsRUFBK0JDLE9BQU8sR0FBRyxFQUF6QyxFQUE2QztBQUNwRCxJQUFBLEtBQUEsRUFBQSxDQUFBO0FBRG9ELElBQUEsSUFBQSxDQS9CeERELElBK0J3RCxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBQUEsSUF4QnhERSxDQUFBQSxT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
