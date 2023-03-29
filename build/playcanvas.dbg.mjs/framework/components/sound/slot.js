/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../../core/event-handler.js';
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { SoundInstance } from '../../../platform/sound/instance.js';
import { SoundInstance3d } from '../../../platform/sound/instance3d.js';

// temporary object for creating instances
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

/**
 * The SoundSlot controls playback of an audio asset.
 *
 * @augments EventHandler
 */
class SoundSlot extends EventHandler {
  /**
   * The name of the slot.
   *
   * @type {string}
   */

  /**
   * An array that contains all the {@link SoundInstance}s currently being played by the slot.
   *
   * @type {SoundInstance[]}
   */

  /**
   * Create a new SoundSlot.
   *
   * @param {import('./component.js').SoundComponent} component - The Component that created this
   * slot.
   * @param {string} [name] - The name of the slot. Defaults to 'Untitled'.
   * @param {object} [options] - Settings for the slot.
   * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
   * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
   * @param {boolean} [options.loop=false] - If true the sound will restart when it reaches the
   * end.
   * @param {number} [options.startTime=0] - The start time from which the sound will start
   * playing.
   * @param {number} [options.duration=null] - The duration of the sound that the slot will play
   * starting from startTime.
   * @param {boolean} [options.overlap=false] - If true then sounds played from slot will be
   * played independently of each other. Otherwise the slot will first stop the current sound
   * before starting the new one.
   * @param {boolean} [options.autoPlay=false] - If true the slot will start playing as soon as
   * its audio asset is loaded.
   * @param {number} [options.asset=null] - The asset id of the audio asset that is going to be
   * played by this slot.
   */
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

  /**
   * Fired when a sound instance starts playing.
   *
   * @event SoundSlot#play
   * @param {SoundInstance} instance - The instance that started playing.
   */

  /**
   * Fired when a sound instance is paused.
   *
   * @event SoundSlot#pause
   * @param {SoundInstance} instance - The instance that was paused created to play the sound.
   */

  /**
   * Fired when a sound instance is resumed.
   *
   * @event SoundSlot#resume
   * @param {SoundInstance} instance - The instance that was resumed.
   */

  /**
   * Fired when a sound instance is stopped.
   *
   * @event SoundSlot#stop
   * @param {SoundInstance} instance - The instance that was stopped.
   */

  /**
   * Fired when the asset assigned to the slot is loaded.
   *
   * @event SoundSlot#load
   * @param {Sound} sound - The sound resource that was loaded.
   */

  /**
   * Plays a sound. If {@link SoundSlot#overlap} is true the new sound instance will be played
   * independently of any other instances already playing. Otherwise existing sound instances
   * will stop before playing the new sound.
   *
   * @returns {SoundInstance} The new sound instance.
   */
  play() {
    // stop if overlap is false
    if (!this.overlap) {
      this.stop();
    }

    // If not loaded and doesn't have asset - then we cannot play it.  Warn and exit.
    if (!this.isLoaded && !this._hasAsset()) {
      Debug.warn(`Trying to play SoundSlot ${this.name} but it is not loaded and doesn't have an asset.`);
      return undefined;
    }
    const instance = this._createInstance();
    this.instances.push(instance);

    // if not loaded then load first
    // and then set sound resource on the created instance
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

  /**
   * Pauses all sound instances. To continue playback call {@link SoundSlot#resume}.
   *
   * @returns {boolean} True if the sound instances paused successfully, false otherwise.
   */
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

  /**
   * Resumes playback of all paused sound instances.
   *
   * @returns {boolean} True if any instances were resumed.
   */
  resume() {
    let resumed = false;
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (instances[i].resume()) resumed = true;
    }
    return resumed;
  }

  /**
   * Stops playback of all sound instances.
   *
   * @returns {boolean} True if any instances were stopped.
   */
  stop() {
    let stopped = false;
    const instances = this.instances;
    let i = instances.length;
    // do this in reverse order because as each instance
    // is stopped it will be removed from the instances array
    // by the instance stop event handler
    while (i--) {
      instances[i].stop();
      stopped = true;
    }
    instances.length = 0;
    return stopped;
  }

  /**
   * Loads the asset assigned to this slot.
   */
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

  /**
   * Connect external Web Audio API nodes. Any sound played by this slot will automatically
   * attach the specified nodes to the source that plays the sound. You need to pass the first
   * node of the node graph that you created externally and the last node of that graph. The
   * first node will be connected to the audio source and the last node will be connected to the
   * destination of the AudioContext (e.g. speakers).
   *
   * @param {AudioNode} firstNode - The first node that will be connected to the audio source of
   * sound instances.
   * @param {AudioNode} [lastNode] - The last node that will be connected to the destination of
   * the AudioContext. If unspecified then the firstNode will be connected to the destination
   * instead.
   * @example
   * var context = app.systems.sound.context;
   * var analyzer = context.createAnalyzer();
   * var distortion = context.createWaveShaper();
   * var filter = context.createBiquadFilter();
   * analyzer.connect(distortion);
   * distortion.connect(filter);
   * slot.setExternalNodes(analyzer, filter);
   */
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

    // update instances if not overlapping
    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].setExternalNodes(firstNode, lastNode);
      }
    }
  }

  /**
   * Clears any external nodes set by {@link SoundSlot#setExternalNodes}.
   */
  clearExternalNodes() {
    this._firstNode = null;
    this._lastNode = null;

    // update instances if not overlapping
    if (!this._overlap) {
      const instances = this.instances;
      for (let i = 0, len = instances.length; i < len; i++) {
        instances[i].clearExternalNodes();
      }
    }
  }

  /**
   * Gets an array that contains the two external nodes set by {@link SoundSlot#setExternalNodes}.
   *
   * @returns {AudioNode[]} An array of 2 elements that contains the first and last nodes set by
   * {@link SoundSlot#setExternalNodes}.
   */
  getExternalNodes() {
    return [this._firstNode, this._lastNode];
  }

  /**
   * Reports whether an asset is set on this slot.
   *
   * @returns {boolean} Returns true if the slot has an asset assigned.
   * @private
   */
  _hasAsset() {
    // != intentional
    return this._asset != null;
  }

  /**
   * Creates a new {@link SoundInstance} with the properties of the slot.
   *
   * @returns {SoundInstance} The new instance.
   * @private
   */
  _createInstance() {
    let instance = null;
    const component = this._component;
    let sound = null;

    // get sound resource
    if (this._hasAsset()) {
      const asset = this._assets.get(this._asset);
      if (asset) {
        sound = asset.resource;
      }
    }

    // initialize instance options
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

    // hook external audio nodes
    if (this._firstNode) {
      instance.setExternalNodes(this._firstNode, this._lastNode);
    }
    return instance;
  }
  _onInstancePlay(instance) {
    // propagate event to slot
    this.fire('play', instance);

    // propagate event to component
    this._component.fire('play', this, instance);
  }
  _onInstancePause(instance) {
    // propagate event to slot
    this.fire('pause', instance);

    // propagate event to component
    this._component.fire('pause', this, instance);
  }
  _onInstanceResume(instance) {
    // propagate event to slot
    this.fire('resume', instance);

    // propagate event to component
    this._component.fire('resume', this, instance);
  }
  _onInstanceStop(instance) {
    // remove instance that stopped
    const idx = this.instances.indexOf(instance);
    if (idx !== -1) {
      this.instances.splice(idx, 1);
    }

    // propagate event to slot
    this.fire('stop', instance);

    // propagate event to component
    this._component.fire('stop', this, instance);
  }
  _onInstanceEnd(instance) {
    // remove instance that ended
    const idx = this.instances.indexOf(instance);
    if (idx !== -1) {
      this.instances.splice(idx, 1);
    }

    // propagate event to slot
    this.fire('end', instance);

    // propagate event to component
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

  /**
   * The asset id.
   *
   * @type {number|null}
   */
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

    // load asset if component and entity are enabled
    if (this._hasAsset() && this._component.enabled && this._component.entity.enabled) {
      this.load();
    }
  }
  get asset() {
    return this._asset;
  }

  /**
   * If true the slot will begin playing as soon as it is loaded.
   *
   * @type {boolean}
   */
  set autoPlay(value) {
    this._autoPlay = !!value;
  }
  get autoPlay() {
    return this._autoPlay;
  }

  /**
   * The duration of the sound that the slot will play starting from startTime.
   *
   * @type {number}
   */
  set duration(value) {
    this._duration = Math.max(0, Number(value) || 0) || null;

    // update instances if non overlapping
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

    // != intentional
    if (this._duration != null) {
      return this._duration % (assetDuration || 1);
    }
    return assetDuration;
  }

  /**
   * Returns true if the asset of the slot is loaded.
   *
   * @type {boolean}
   */
  get isLoaded() {
    if (this._hasAsset()) {
      const asset = this._assets.get(this._asset);
      if (asset) {
        return !!asset.resource;
      }
    }
    return false;
  }

  /**
   * Returns true if the slot is currently paused.
   *
   * @type {boolean}
   */
  get isPaused() {
    const instances = this.instances;
    const len = instances.length;
    if (len === 0) return false;
    for (let i = 0; i < len; i++) {
      if (!instances[i].isPaused) return false;
    }
    return true;
  }

  /**
   * Returns true if the slot is currently playing.
   *
   * @type {boolean}
   */
  get isPlaying() {
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (instances[i].isPlaying) return true;
    }
    return false;
  }

  /**
   * Returns true if the slot is currently stopped.
   *
   * @type {boolean}
   */
  get isStopped() {
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      if (!instances[i].isStopped) return false;
    }
    return true;
  }

  /**
   * If true the slot will restart when it finishes playing.
   *
   * @type {boolean}
   */
  set loop(value) {
    this._loop = !!value;

    // update instances if non overlapping
    const instances = this.instances;
    for (let i = 0, len = instances.length; i < len; i++) {
      instances[i].loop = this._loop;
    }
  }
  get loop() {
    return this._loop;
  }

  /**
   * If true then sounds played from slot will be played independently of each other. Otherwise
   * the slot will first stop the current sound before starting the new one.
   *
   * @type {boolean}
   */
  set overlap(value) {
    this._overlap = !!value;
  }
  get overlap() {
    return this._overlap;
  }

  /**
   * The pitch modifier to play the sound with. Must be larger than 0.01.
   *
   * @type {number}
   */
  set pitch(value) {
    this._pitch = Math.max(Number(value) || 0, 0.01);

    // update instances if non overlapping
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

  /**
   * The start time from which the sound will start playing.
   *
   * @type {number}
   */
  set startTime(value) {
    this._startTime = Math.max(0, Number(value) || 0);

    // update instances if non overlapping
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

  /**
   * The volume modifier to play the sound with. In range 0-1.
   *
   * @type {number}
   */
  set volume(value) {
    this._volume = math.clamp(Number(value) || 0, 0, 1);

    // update instances if non overlapping
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xvdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL3NvdW5kL3Nsb3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgU291bmRJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlLmpzJztcbmltcG9ydCB7IFNvdW5kSW5zdGFuY2UzZCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlM2QuanMnO1xuXG4vLyB0ZW1wb3Jhcnkgb2JqZWN0IGZvciBjcmVhdGluZyBpbnN0YW5jZXNcbmNvbnN0IGluc3RhbmNlT3B0aW9ucyA9IHtcbiAgICB2b2x1bWU6IDAsXG4gICAgcGl0Y2g6IDAsXG4gICAgbG9vcDogZmFsc2UsXG4gICAgc3RhcnRUaW1lOiAwLFxuICAgIGR1cmF0aW9uOiAwLFxuICAgIHBvc2l0aW9uOiBuZXcgVmVjMygpLFxuICAgIG1heERpc3RhbmNlOiAwLFxuICAgIHJlZkRpc3RhbmNlOiAwLFxuICAgIHJvbGxPZmZGYWN0b3I6IDAsXG4gICAgZGlzdGFuY2VNb2RlbDogMCxcbiAgICBvblBsYXk6IG51bGwsXG4gICAgb25QYXVzZTogbnVsbCxcbiAgICBvblJlc3VtZTogbnVsbCxcbiAgICBvblN0b3A6IG51bGwsXG4gICAgb25FbmQ6IG51bGxcbn07XG5cbi8qKlxuICogVGhlIFNvdW5kU2xvdCBjb250cm9scyBwbGF5YmFjayBvZiBhbiBhdWRpbyBhc3NldC5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFNvdW5kU2xvdCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIHNsb3QuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSB0aGF0IGNvbnRhaW5zIGFsbCB0aGUge0BsaW5rIFNvdW5kSW5zdGFuY2V9cyBjdXJyZW50bHkgYmVpbmcgcGxheWVkIGJ5IHRoZSBzbG90LlxuICAgICAqXG4gICAgICogQHR5cGUge1NvdW5kSW5zdGFuY2VbXX1cbiAgICAgKi9cbiAgICBpbnN0YW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTb3VuZFNsb3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9jb21wb25lbnQuanMnKS5Tb3VuZENvbXBvbmVudH0gY29tcG9uZW50IC0gVGhlIENvbXBvbmVudCB0aGF0IGNyZWF0ZWQgdGhpc1xuICAgICAqIHNsb3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90LiBEZWZhdWx0cyB0byAnVW50aXRsZWQnLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBTZXR0aW5ncyBmb3IgdGhlIHNsb3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnZvbHVtZT0xXSAtIFRoZSBwbGF5YmFjayB2b2x1bWUsIGJldHdlZW4gMCBhbmQgMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMucGl0Y2g9MV0gLSBUaGUgcmVsYXRpdmUgcGl0Y2gsIGRlZmF1bHQgb2YgMSwgcGxheXMgYXQgbm9ybWFsIHBpdGNoLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubG9vcD1mYWxzZV0gLSBJZiB0cnVlIHRoZSBzb3VuZCB3aWxsIHJlc3RhcnQgd2hlbiBpdCByZWFjaGVzIHRoZVxuICAgICAqIGVuZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3RhcnRUaW1lPTBdIC0gVGhlIHN0YXJ0IHRpbWUgZnJvbSB3aGljaCB0aGUgc291bmQgd2lsbCBzdGFydFxuICAgICAqIHBsYXlpbmcuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmR1cmF0aW9uPW51bGxdIC0gVGhlIGR1cmF0aW9uIG9mIHRoZSBzb3VuZCB0aGF0IHRoZSBzbG90IHdpbGwgcGxheVxuICAgICAqIHN0YXJ0aW5nIGZyb20gc3RhcnRUaW1lLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMub3ZlcmxhcD1mYWxzZV0gLSBJZiB0cnVlIHRoZW4gc291bmRzIHBsYXllZCBmcm9tIHNsb3Qgd2lsbCBiZVxuICAgICAqIHBsYXllZCBpbmRlcGVuZGVudGx5IG9mIGVhY2ggb3RoZXIuIE90aGVyd2lzZSB0aGUgc2xvdCB3aWxsIGZpcnN0IHN0b3AgdGhlIGN1cnJlbnQgc291bmRcbiAgICAgKiBiZWZvcmUgc3RhcnRpbmcgdGhlIG5ldyBvbmUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hdXRvUGxheT1mYWxzZV0gLSBJZiB0cnVlIHRoZSBzbG90IHdpbGwgc3RhcnQgcGxheWluZyBhcyBzb29uIGFzXG4gICAgICogaXRzIGF1ZGlvIGFzc2V0IGlzIGxvYWRlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYXNzZXQ9bnVsbF0gLSBUaGUgYXNzZXQgaWQgb2YgdGhlIGF1ZGlvIGFzc2V0IHRoYXQgaXMgZ29pbmcgdG8gYmVcbiAgICAgKiBwbGF5ZWQgYnkgdGhpcyBzbG90LlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNvbXBvbmVudCwgbmFtZSA9ICdVbnRpdGxlZCcsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2NvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gY29tcG9uZW50LnN5c3RlbS5tYW5hZ2VyO1xuXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgICAgICAgdGhpcy5fdm9sdW1lID0gb3B0aW9ucy52b2x1bWUgIT09IHVuZGVmaW5lZCA/IG1hdGguY2xhbXAoTnVtYmVyKG9wdGlvbnMudm9sdW1lKSB8fCAwLCAwLCAxKSA6IDE7XG4gICAgICAgIHRoaXMuX3BpdGNoID0gb3B0aW9ucy5waXRjaCAhPT0gdW5kZWZpbmVkID8gTWF0aC5tYXgoMC4wMSwgTnVtYmVyKG9wdGlvbnMucGl0Y2gpIHx8IDApIDogMTtcbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhKG9wdGlvbnMubG9vcCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5sb29wIDogZmFsc2UpO1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb24gPiAwID8gb3B0aW9ucy5kdXJhdGlvbiA6IG51bGw7XG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcihvcHRpb25zLnN0YXJ0VGltZSkgfHwgMCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXAgPSAhIShvcHRpb25zLm92ZXJsYXApO1xuICAgICAgICB0aGlzLl9hdXRvUGxheSA9ICEhKG9wdGlvbnMuYXV0b1BsYXkpO1xuICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYXNzZXQgPSBvcHRpb25zLmFzc2V0O1xuICAgICAgICBpZiAodGhpcy5fYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXQgPSB0aGlzLl9hc3NldC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VQbGF5SGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VQbGF5LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VQYXVzZUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUGF1c2UuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb25JbnN0YW5jZVJlc3VtZUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUmVzdW1lLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VTdG9wSGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VTdG9wLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VFbmRIYW5kbGVyID0gdGhpcy5fb25JbnN0YW5jZUVuZC5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBzdGFydHMgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZFNsb3QjcGxheVxuICAgICAqIEBwYXJhbSB7U291bmRJbnN0YW5jZX0gaW5zdGFuY2UgLSBUaGUgaW5zdGFuY2UgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kU2xvdCNwYXVzZVxuICAgICAqIEBwYXJhbSB7U291bmRJbnN0YW5jZX0gaW5zdGFuY2UgLSBUaGUgaW5zdGFuY2UgdGhhdCB3YXMgcGF1c2VkIGNyZWF0ZWQgdG8gcGxheSB0aGUgc291bmQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgcmVzdW1lZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZFNsb3QjcmVzdW1lXG4gICAgICogQHBhcmFtIHtTb3VuZEluc3RhbmNlfSBpbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSB0aGF0IHdhcyByZXN1bWVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNvdW5kIGluc3RhbmNlIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRTbG90I3N0b3BcbiAgICAgKiBAcGFyYW0ge1NvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlIHRoYXQgd2FzIHN0b3BwZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBhc3NldCBhc3NpZ25lZCB0byB0aGUgc2xvdCBpcyBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRTbG90I2xvYWRcbiAgICAgKiBAcGFyYW0ge1NvdW5kfSBzb3VuZCAtIFRoZSBzb3VuZCByZXNvdXJjZSB0aGF0IHdhcyBsb2FkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBQbGF5cyBhIHNvdW5kLiBJZiB7QGxpbmsgU291bmRTbG90I292ZXJsYXB9IGlzIHRydWUgdGhlIG5ldyBzb3VuZCBpbnN0YW5jZSB3aWxsIGJlIHBsYXllZFxuICAgICAqIGluZGVwZW5kZW50bHkgb2YgYW55IG90aGVyIGluc3RhbmNlcyBhbHJlYWR5IHBsYXlpbmcuIE90aGVyd2lzZSBleGlzdGluZyBzb3VuZCBpbnN0YW5jZXNcbiAgICAgKiB3aWxsIHN0b3AgYmVmb3JlIHBsYXlpbmcgdGhlIG5ldyBzb3VuZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTb3VuZEluc3RhbmNlfSBUaGUgbmV3IHNvdW5kIGluc3RhbmNlLlxuICAgICAqL1xuICAgIHBsYXkoKSB7XG4gICAgICAgIC8vIHN0b3AgaWYgb3ZlcmxhcCBpcyBmYWxzZVxuICAgICAgICBpZiAoIXRoaXMub3ZlcmxhcCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBub3QgbG9hZGVkIGFuZCBkb2Vzbid0IGhhdmUgYXNzZXQgLSB0aGVuIHdlIGNhbm5vdCBwbGF5IGl0LiAgV2FybiBhbmQgZXhpdC5cbiAgICAgICAgaWYgKCF0aGlzLmlzTG9hZGVkICYmICF0aGlzLl9oYXNBc3NldCgpKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gcGxheSBTb3VuZFNsb3QgJHt0aGlzLm5hbWV9IGJ1dCBpdCBpcyBub3QgbG9hZGVkIGFuZCBkb2Vzbid0IGhhdmUgYW4gYXNzZXQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzLl9jcmVhdGVJbnN0YW5jZSgpO1xuICAgICAgICB0aGlzLmluc3RhbmNlcy5wdXNoKGluc3RhbmNlKTtcblxuICAgICAgICAvLyBpZiBub3QgbG9hZGVkIHRoZW4gbG9hZCBmaXJzdFxuICAgICAgICAvLyBhbmQgdGhlbiBzZXQgc291bmQgcmVzb3VyY2Ugb24gdGhlIGNyZWF0ZWQgaW5zdGFuY2VcbiAgICAgICAgaWYgKCF0aGlzLmlzTG9hZGVkKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAoc291bmQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwbGF5V2hlbkxvYWRlZCA9IGluc3RhbmNlLl9wbGF5V2hlbkxvYWRlZDtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5zb3VuZCA9IHNvdW5kO1xuICAgICAgICAgICAgICAgIGlmIChwbGF5V2hlbkxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5wbGF5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdGhpcy5vZmYoJ2xvYWQnLCBvbkxvYWQpO1xuICAgICAgICAgICAgdGhpcy5vbmNlKCdsb2FkJywgb25Mb2FkKTtcbiAgICAgICAgICAgIHRoaXMubG9hZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5zdGFuY2UucGxheSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyBhbGwgc291bmQgaW5zdGFuY2VzLiBUbyBjb250aW51ZSBwbGF5YmFjayBjYWxsIHtAbGluayBTb3VuZFNsb3QjcmVzdW1lfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzb3VuZCBpbnN0YW5jZXMgcGF1c2VkIHN1Y2Nlc3NmdWxseSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICBsZXQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXNbaV0ucGF1c2UoKSkge1xuICAgICAgICAgICAgICAgIHBhdXNlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcGF1c2VkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgcGxheWJhY2sgb2YgYWxsIHBhdXNlZCBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBhbnkgaW5zdGFuY2VzIHdlcmUgcmVzdW1lZC5cbiAgICAgKi9cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIGxldCByZXN1bWVkID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXNbaV0ucmVzdW1lKCkpXG4gICAgICAgICAgICAgICAgcmVzdW1lZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdW1lZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyBwbGF5YmFjayBvZiBhbGwgc291bmQgaW5zdGFuY2VzLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgYW55IGluc3RhbmNlcyB3ZXJlIHN0b3BwZWQuXG4gICAgICovXG4gICAgc3RvcCgpIHtcbiAgICAgICAgbGV0IHN0b3BwZWQgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgbGV0IGkgPSBpbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICAvLyBkbyB0aGlzIGluIHJldmVyc2Ugb3JkZXIgYmVjYXVzZSBhcyBlYWNoIGluc3RhbmNlXG4gICAgICAgIC8vIGlzIHN0b3BwZWQgaXQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGluc3RhbmNlcyBhcnJheVxuICAgICAgICAvLyBieSB0aGUgaW5zdGFuY2Ugc3RvcCBldmVudCBoYW5kbGVyXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zdG9wKCk7XG4gICAgICAgICAgICBzdG9wcGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluc3RhbmNlcy5sZW5ndGggPSAwO1xuXG4gICAgICAgIHJldHVybiBzdG9wcGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWRzIHRoZSBhc3NldCBhc3NpZ25lZCB0byB0aGlzIHNsb3QuXG4gICAgICovXG4gICAgbG9hZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9oYXNBc3NldCgpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLm9uY2UoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKCFhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Bc3NldExvYWQsIHRoaXMpO1xuICAgICAgICAgICAgYXNzZXQub25jZSgnbG9hZCcsIHRoaXMuX29uQXNzZXRMb2FkLCB0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLmxvYWQoYXNzZXQpO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ2xvYWQnLCBhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdCBleHRlcm5hbCBXZWIgQXVkaW8gQVBJIG5vZGVzLiBBbnkgc291bmQgcGxheWVkIGJ5IHRoaXMgc2xvdCB3aWxsIGF1dG9tYXRpY2FsbHlcbiAgICAgKiBhdHRhY2ggdGhlIHNwZWNpZmllZCBub2RlcyB0byB0aGUgc291cmNlIHRoYXQgcGxheXMgdGhlIHNvdW5kLiBZb3UgbmVlZCB0byBwYXNzIHRoZSBmaXJzdFxuICAgICAqIG5vZGUgb2YgdGhlIG5vZGUgZ3JhcGggdGhhdCB5b3UgY3JlYXRlZCBleHRlcm5hbGx5IGFuZCB0aGUgbGFzdCBub2RlIG9mIHRoYXQgZ3JhcGguIFRoZVxuICAgICAqIGZpcnN0IG5vZGUgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGF1ZGlvIHNvdXJjZSBhbmQgdGhlIGxhc3Qgbm9kZSB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGVcbiAgICAgKiBkZXN0aW5hdGlvbiBvZiB0aGUgQXVkaW9Db250ZXh0IChlLmcuIHNwZWFrZXJzKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXVkaW9Ob2RlfSBmaXJzdE5vZGUgLSBUaGUgZmlyc3Qgbm9kZSB0aGF0IHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBhdWRpbyBzb3VyY2Ugb2ZcbiAgICAgKiBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtBdWRpb05vZGV9IFtsYXN0Tm9kZV0gLSBUaGUgbGFzdCBub2RlIHRoYXQgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIG9mXG4gICAgICogdGhlIEF1ZGlvQ29udGV4dC4gSWYgdW5zcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3ROb2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAqIGluc3RlYWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgY29udGV4dCA9IGFwcC5zeXN0ZW1zLnNvdW5kLmNvbnRleHQ7XG4gICAgICogdmFyIGFuYWx5emVyID0gY29udGV4dC5jcmVhdGVBbmFseXplcigpO1xuICAgICAqIHZhciBkaXN0b3J0aW9uID0gY29udGV4dC5jcmVhdGVXYXZlU2hhcGVyKCk7XG4gICAgICogdmFyIGZpbHRlciA9IGNvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICogYW5hbHl6ZXIuY29ubmVjdChkaXN0b3J0aW9uKTtcbiAgICAgKiBkaXN0b3J0aW9uLmNvbm5lY3QoZmlsdGVyKTtcbiAgICAgKiBzbG90LnNldEV4dGVybmFsTm9kZXMoYW5hbHl6ZXIsIGZpbHRlcik7XG4gICAgICovXG4gICAgc2V0RXh0ZXJuYWxOb2RlcyhmaXJzdE5vZGUsIGxhc3ROb2RlKSB7XG4gICAgICAgIGlmICghKGZpcnN0Tm9kZSkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1RoZSBmaXJzdE5vZGUgbXVzdCBoYXZlIGEgdmFsaWQgQXVkaW9Ob2RlJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWxhc3ROb2RlKSB7XG4gICAgICAgICAgICBsYXN0Tm9kZSA9IGZpcnN0Tm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2ZpcnN0Tm9kZSA9IGZpcnN0Tm9kZTtcbiAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBsYXN0Tm9kZTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vdCBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zZXRFeHRlcm5hbE5vZGVzKGZpcnN0Tm9kZSwgbGFzdE5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIGFueSBleHRlcm5hbCBub2RlcyBzZXQgYnkge0BsaW5rIFNvdW5kU2xvdCNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKi9cbiAgICBjbGVhckV4dGVybmFsTm9kZXMoKSB7XG4gICAgICAgIHRoaXMuX2ZpcnN0Tm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2xhc3ROb2RlID0gbnVsbDtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vdCBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5jbGVhckV4dGVybmFsTm9kZXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdHdvIGV4dGVybmFsIG5vZGVzIHNldCBieSB7QGxpbmsgU291bmRTbG90I3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge0F1ZGlvTm9kZVtdfSBBbiBhcnJheSBvZiAyIGVsZW1lbnRzIHRoYXQgY29udGFpbnMgdGhlIGZpcnN0IGFuZCBsYXN0IG5vZGVzIHNldCBieVxuICAgICAqIHtAbGluayBTb3VuZFNsb3Qjc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICovXG4gICAgZ2V0RXh0ZXJuYWxOb2RlcygpIHtcbiAgICAgICAgcmV0dXJuIFt0aGlzLl9maXJzdE5vZGUsIHRoaXMuX2xhc3ROb2RlXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgYW4gYXNzZXQgaXMgc2V0IG9uIHRoaXMgc2xvdC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3QgaGFzIGFuIGFzc2V0IGFzc2lnbmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhc0Fzc2V0KCkge1xuICAgICAgICAvLyAhPSBpbnRlbnRpb25hbFxuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXQgIT0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IHtAbGluayBTb3VuZEluc3RhbmNlfSB3aXRoIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBzbG90LlxuICAgICAqXG4gICAgICogQHJldHVybnMge1NvdW5kSW5zdGFuY2V9IFRoZSBuZXcgaW5zdGFuY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY3JlYXRlSW5zdGFuY2UoKSB7XG4gICAgICAgIGxldCBpbnN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgY29tcG9uZW50ID0gdGhpcy5fY29tcG9uZW50O1xuXG4gICAgICAgIGxldCBzb3VuZCA9IG51bGw7XG5cbiAgICAgICAgLy8gZ2V0IHNvdW5kIHJlc291cmNlXG4gICAgICAgIGlmICh0aGlzLl9oYXNBc3NldCgpKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2Fzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgc291bmQgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluaXRpYWxpemUgaW5zdGFuY2Ugb3B0aW9uc1xuICAgICAgICBjb25zdCBkYXRhID0gaW5zdGFuY2VPcHRpb25zO1xuICAgICAgICBkYXRhLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZSAqIGNvbXBvbmVudC52b2x1bWU7XG4gICAgICAgIGRhdGEucGl0Y2ggPSB0aGlzLl9waXRjaCAqIGNvbXBvbmVudC5waXRjaDtcbiAgICAgICAgZGF0YS5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgZGF0YS5zdGFydFRpbWUgPSB0aGlzLl9zdGFydFRpbWU7XG4gICAgICAgIGRhdGEuZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbjtcblxuICAgICAgICBkYXRhLm9uUGxheSA9IHRoaXMuX29uSW5zdGFuY2VQbGF5SGFuZGxlcjtcbiAgICAgICAgZGF0YS5vblBhdXNlID0gdGhpcy5fb25JbnN0YW5jZVBhdXNlSGFuZGxlcjtcbiAgICAgICAgZGF0YS5vblJlc3VtZSA9IHRoaXMuX29uSW5zdGFuY2VSZXN1bWVIYW5kbGVyO1xuICAgICAgICBkYXRhLm9uU3RvcCA9IHRoaXMuX29uSW5zdGFuY2VTdG9wSGFuZGxlcjtcbiAgICAgICAgZGF0YS5vbkVuZCA9IHRoaXMuX29uSW5zdGFuY2VFbmRIYW5kbGVyO1xuXG4gICAgICAgIGlmIChjb21wb25lbnQucG9zaXRpb25hbCkge1xuICAgICAgICAgICAgZGF0YS5wb3NpdGlvbi5jb3B5KGNvbXBvbmVudC5lbnRpdHkuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICBkYXRhLm1heERpc3RhbmNlID0gY29tcG9uZW50Lm1heERpc3RhbmNlO1xuICAgICAgICAgICAgZGF0YS5yZWZEaXN0YW5jZSA9IGNvbXBvbmVudC5yZWZEaXN0YW5jZTtcbiAgICAgICAgICAgIGRhdGEucm9sbE9mZkZhY3RvciA9IGNvbXBvbmVudC5yb2xsT2ZmRmFjdG9yO1xuICAgICAgICAgICAgZGF0YS5kaXN0YW5jZU1vZGVsID0gY29tcG9uZW50LmRpc3RhbmNlTW9kZWw7XG5cbiAgICAgICAgICAgIGluc3RhbmNlID0gbmV3IFNvdW5kSW5zdGFuY2UzZCh0aGlzLl9tYW5hZ2VyLCBzb3VuZCwgZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnN0YW5jZSA9IG5ldyBTb3VuZEluc3RhbmNlKHRoaXMuX21hbmFnZXIsIHNvdW5kLCBkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhvb2sgZXh0ZXJuYWwgYXVkaW8gbm9kZXNcbiAgICAgICAgaWYgKHRoaXMuX2ZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgaW5zdGFuY2Uuc2V0RXh0ZXJuYWxOb2Rlcyh0aGlzLl9maXJzdE5vZGUsIHRoaXMuX2xhc3ROb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICB9XG5cbiAgICBfb25JbnN0YW5jZVBsYXkoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIHNsb3RcbiAgICAgICAgdGhpcy5maXJlKCdwbGF5JywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3BsYXknLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VQYXVzZShpbnN0YW5jZSkge1xuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gc2xvdFxuICAgICAgICB0aGlzLmZpcmUoJ3BhdXNlJywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3BhdXNlJywgdGhpcywgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIF9vbkluc3RhbmNlUmVzdW1lKGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgncmVzdW1lJywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3Jlc3VtZScsIHRoaXMsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBfb25JbnN0YW5jZVN0b3AoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGluc3RhbmNlIHRoYXQgc3RvcHBlZFxuICAgICAgICBjb25zdCBpZHggPSB0aGlzLmluc3RhbmNlcy5pbmRleE9mKGluc3RhbmNlKTtcbiAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIHNsb3RcbiAgICAgICAgdGhpcy5maXJlKCdzdG9wJywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ3N0b3AnLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VFbmQoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGluc3RhbmNlIHRoYXQgZW5kZWRcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5pbnN0YW5jZXMuaW5kZXhPZihpbnN0YW5jZSk7XG4gICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgnZW5kJywgaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBjb21wb25lbnRcbiAgICAgICAgdGhpcy5fY29tcG9uZW50LmZpcmUoJ2VuZCcsIHRoaXMsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBfb25Bc3NldEFkZChhc3NldCkge1xuICAgICAgICB0aGlzLmxvYWQoKTtcbiAgICB9XG5cbiAgICBfb25Bc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5sb2FkKCk7XG4gICAgfVxuXG4gICAgX29uQXNzZXRSZW1vdmVkKGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbkFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlUG9zaXRpb24ocG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGluc3RhbmNlc1tpXS5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcnxudWxsfVxuICAgICAqL1xuICAgIHNldCBhc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLl9hc3NldDtcblxuICAgICAgICBpZiAob2xkKSB7XG4gICAgICAgICAgICB0aGlzLl9hc3NldHMub2ZmKCdhZGQ6JyArIG9sZCwgdGhpcy5fb25Bc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICBjb25zdCBvbGRBc3NldCA9IHRoaXMuX2Fzc2V0cy5nZXQob2xkKTtcbiAgICAgICAgICAgIGlmIChvbGRBc3NldCkge1xuICAgICAgICAgICAgICAgIG9sZEFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Bc3NldFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYXNzZXQgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0IGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gdGhpcy5fYXNzZXQuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb2FkIGFzc2V0IGlmIGNvbXBvbmVudCBhbmQgZW50aXR5IGFyZSBlbmFibGVkXG4gICAgICAgIGlmICh0aGlzLl9oYXNBc3NldCgpICYmIHRoaXMuX2NvbXBvbmVudC5lbmFibGVkICYmIHRoaXMuX2NvbXBvbmVudC5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBzbG90IHdpbGwgYmVnaW4gcGxheWluZyBhcyBzb29uIGFzIGl0IGlzIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBhdXRvUGxheSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hdXRvUGxheSA9ICEhdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9QbGF5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b1BsYXk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGR1cmF0aW9uIG9mIHRoZSBzb3VuZCB0aGF0IHRoZSBzbG90IHdpbGwgcGxheSBzdGFydGluZyBmcm9tIHN0YXJ0VGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGR1cmF0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2R1cmF0aW9uID0gTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlKSB8fCAwKSB8fCBudWxsO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnN0YW5jZXMgaWYgbm9uIG92ZXJsYXBwaW5nXG4gICAgICAgIGlmICghdGhpcy5fb3ZlcmxhcCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLmR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZHVyYXRpb24oKSB7XG4gICAgICAgIGxldCBhc3NldER1cmF0aW9uID0gMDtcbiAgICAgICAgaWYgKHRoaXMuX2hhc0Fzc2V0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgICAgICBhc3NldER1cmF0aW9uID0gYXNzZXQ/LnJlc291cmNlID8gYXNzZXQucmVzb3VyY2UuZHVyYXRpb24gOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gIT0gaW50ZW50aW9uYWxcbiAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9kdXJhdGlvbiAlIChhc3NldER1cmF0aW9uIHx8IDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhc3NldER1cmF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgYXNzZXQgb2YgdGhlIHNsb3QgaXMgbG9hZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzTG9hZGVkKCkge1xuICAgICAgICBpZiAodGhpcy5faGFzQXNzZXQoKSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhIWFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xvdCBpcyBjdXJyZW50bHkgcGF1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGF1c2VkKCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgY29uc3QgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDtcbiAgICAgICAgaWYgKGxlbiA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIWluc3RhbmNlc1tpXS5pc1BhdXNlZClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3QgaXMgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQbGF5aW5nKCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKGluc3RhbmNlc1tpXS5pc1BsYXlpbmcpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IGlzIGN1cnJlbnRseSBzdG9wcGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzU3RvcHBlZCgpIHtcbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghaW5zdGFuY2VzW2ldLmlzU3RvcHBlZClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBzbG90IHdpbGwgcmVzdGFydCB3aGVuIGl0IGZpbmlzaGVzIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbG9vcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9sb29wID0gISF2YWx1ZTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaW5zdGFuY2VzW2ldLmxvb3AgPSB0aGlzLl9sb29wO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxvb3AoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb29wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlbiBzb3VuZHMgcGxheWVkIGZyb20gc2xvdCB3aWxsIGJlIHBsYXllZCBpbmRlcGVuZGVudGx5IG9mIGVhY2ggb3RoZXIuIE90aGVyd2lzZVxuICAgICAqIHRoZSBzbG90IHdpbGwgZmlyc3Qgc3RvcCB0aGUgY3VycmVudCBzb3VuZCBiZWZvcmUgc3RhcnRpbmcgdGhlIG5ldyBvbmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgb3ZlcmxhcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9vdmVybGFwID0gISF2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgb3ZlcmxhcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX292ZXJsYXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBpdGNoIG1vZGlmaWVyIHRvIHBsYXkgdGhlIHNvdW5kIHdpdGguIE11c3QgYmUgbGFyZ2VyIHRoYW4gMC4wMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHBpdGNoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BpdGNoID0gTWF0aC5tYXgoTnVtYmVyKHZhbHVlKSB8fCAwLCAwLjAxKTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5waXRjaCA9IHRoaXMucGl0Y2ggKiB0aGlzLl9jb21wb25lbnQucGl0Y2g7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcGl0Y2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXRjaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhcnQgdGltZSBmcm9tIHdoaWNoIHRoZSBzb3VuZCB3aWxsIHN0YXJ0IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzdGFydFRpbWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc3RhcnRUaW1lID0gTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlKSB8fCAwKTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zdGFydFRpbWUgPSB0aGlzLl9zdGFydFRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3RhcnRUaW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhcnRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB2b2x1bWUgbW9kaWZpZXIgdG8gcGxheSB0aGUgc291bmQgd2l0aC4gSW4gcmFuZ2UgMC0xLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgdm9sdW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IG1hdGguY2xhbXAoTnVtYmVyKHZhbHVlKSB8fCAwLCAwLCAxKTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5zdGFuY2VzIGlmIG5vbiBvdmVybGFwcGluZ1xuICAgICAgICBpZiAoIXRoaXMuX292ZXJsYXApIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS52b2x1bWUgPSB0aGlzLl92b2x1bWUgKiB0aGlzLl9jb21wb25lbnQudm9sdW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHZvbHVtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNvdW5kU2xvdCB9O1xuIl0sIm5hbWVzIjpbImluc3RhbmNlT3B0aW9ucyIsInZvbHVtZSIsInBpdGNoIiwibG9vcCIsInN0YXJ0VGltZSIsImR1cmF0aW9uIiwicG9zaXRpb24iLCJWZWMzIiwibWF4RGlzdGFuY2UiLCJyZWZEaXN0YW5jZSIsInJvbGxPZmZGYWN0b3IiLCJkaXN0YW5jZU1vZGVsIiwib25QbGF5Iiwib25QYXVzZSIsIm9uUmVzdW1lIiwib25TdG9wIiwib25FbmQiLCJTb3VuZFNsb3QiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImNvbXBvbmVudCIsIm5hbWUiLCJvcHRpb25zIiwiaW5zdGFuY2VzIiwiX2NvbXBvbmVudCIsIl9hc3NldHMiLCJzeXN0ZW0iLCJhcHAiLCJhc3NldHMiLCJfbWFuYWdlciIsIm1hbmFnZXIiLCJfdm9sdW1lIiwidW5kZWZpbmVkIiwibWF0aCIsImNsYW1wIiwiTnVtYmVyIiwiX3BpdGNoIiwiTWF0aCIsIm1heCIsIl9sb29wIiwiX2R1cmF0aW9uIiwiX3N0YXJ0VGltZSIsIl9vdmVybGFwIiwib3ZlcmxhcCIsIl9hdXRvUGxheSIsImF1dG9QbGF5IiwiX2ZpcnN0Tm9kZSIsIl9sYXN0Tm9kZSIsIl9hc3NldCIsImFzc2V0IiwiQXNzZXQiLCJpZCIsIl9vbkluc3RhbmNlUGxheUhhbmRsZXIiLCJfb25JbnN0YW5jZVBsYXkiLCJiaW5kIiwiX29uSW5zdGFuY2VQYXVzZUhhbmRsZXIiLCJfb25JbnN0YW5jZVBhdXNlIiwiX29uSW5zdGFuY2VSZXN1bWVIYW5kbGVyIiwiX29uSW5zdGFuY2VSZXN1bWUiLCJfb25JbnN0YW5jZVN0b3BIYW5kbGVyIiwiX29uSW5zdGFuY2VTdG9wIiwiX29uSW5zdGFuY2VFbmRIYW5kbGVyIiwiX29uSW5zdGFuY2VFbmQiLCJwbGF5Iiwic3RvcCIsImlzTG9hZGVkIiwiX2hhc0Fzc2V0IiwiRGVidWciLCJ3YXJuIiwiaW5zdGFuY2UiLCJfY3JlYXRlSW5zdGFuY2UiLCJwdXNoIiwib25Mb2FkIiwic291bmQiLCJwbGF5V2hlbkxvYWRlZCIsIl9wbGF5V2hlbkxvYWRlZCIsIm9mZiIsIm9uY2UiLCJsb2FkIiwicGF1c2UiLCJwYXVzZWQiLCJpIiwibGVuIiwibGVuZ3RoIiwicmVzdW1lIiwicmVzdW1lZCIsInN0b3BwZWQiLCJnZXQiLCJfb25Bc3NldEFkZCIsIl9vbkFzc2V0UmVtb3ZlZCIsIm9uIiwicmVzb3VyY2UiLCJfb25Bc3NldExvYWQiLCJmaXJlIiwic2V0RXh0ZXJuYWxOb2RlcyIsImZpcnN0Tm9kZSIsImxhc3ROb2RlIiwiY29uc29sZSIsImVycm9yIiwiY2xlYXJFeHRlcm5hbE5vZGVzIiwiZ2V0RXh0ZXJuYWxOb2RlcyIsImRhdGEiLCJwb3NpdGlvbmFsIiwiY29weSIsImVudGl0eSIsImdldFBvc2l0aW9uIiwiU291bmRJbnN0YW5jZTNkIiwiU291bmRJbnN0YW5jZSIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJ1cGRhdGVQb3NpdGlvbiIsInZhbHVlIiwib2xkIiwib2xkQXNzZXQiLCJlbmFibGVkIiwiYXNzZXREdXJhdGlvbiIsImlzUGF1c2VkIiwiaXNQbGF5aW5nIiwiaXNTdG9wcGVkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBV0E7QUFDQSxNQUFNQSxlQUFlLEdBQUc7QUFDcEJDLEVBQUFBLE1BQU0sRUFBRSxDQUFDO0FBQ1RDLEVBQUFBLEtBQUssRUFBRSxDQUFDO0FBQ1JDLEVBQUFBLElBQUksRUFBRSxLQUFLO0FBQ1hDLEVBQUFBLFNBQVMsRUFBRSxDQUFDO0FBQ1pDLEVBQUFBLFFBQVEsRUFBRSxDQUFDO0VBQ1hDLFFBQVEsRUFBRSxJQUFJQyxJQUFJLEVBQUU7QUFDcEJDLEVBQUFBLFdBQVcsRUFBRSxDQUFDO0FBQ2RDLEVBQUFBLFdBQVcsRUFBRSxDQUFDO0FBQ2RDLEVBQUFBLGFBQWEsRUFBRSxDQUFDO0FBQ2hCQyxFQUFBQSxhQUFhLEVBQUUsQ0FBQztBQUNoQkMsRUFBQUEsTUFBTSxFQUFFLElBQUk7QUFDWkMsRUFBQUEsT0FBTyxFQUFFLElBQUk7QUFDYkMsRUFBQUEsUUFBUSxFQUFFLElBQUk7QUFDZEMsRUFBQUEsTUFBTSxFQUFFLElBQUk7QUFDWkMsRUFBQUEsS0FBSyxFQUFFLElBQUE7QUFDWCxDQUFDLENBQUE7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLFNBQVMsU0FBU0MsWUFBWSxDQUFDO0FBQ2pDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdB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
