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
    /**
     * The name of the slot.
     *
     * @type {string}
     */
    this.name = void 0;
    /**
     * An array that contains all the {@link SoundInstance}s currently being played by the slot.
     *
     * @type {SoundInstance[]}
     */
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
   * @param {import('../../../platform/sound/sound.js').Sound} sound - The sound resource that
   * was loaded.
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
   * const context = app.systems.sound.context;
   * const analyzer = context.createAnalyzer();
   * const distortion = context.createWaveShaper();
   * const filter = context.createBiquadFilter();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2xvdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL3NvdW5kL3Nsb3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgU291bmRJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlLmpzJztcbmltcG9ydCB7IFNvdW5kSW5zdGFuY2UzZCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NvdW5kL2luc3RhbmNlM2QuanMnO1xuXG4vLyB0ZW1wb3Jhcnkgb2JqZWN0IGZvciBjcmVhdGluZyBpbnN0YW5jZXNcbmNvbnN0IGluc3RhbmNlT3B0aW9ucyA9IHtcbiAgICB2b2x1bWU6IDAsXG4gICAgcGl0Y2g6IDAsXG4gICAgbG9vcDogZmFsc2UsXG4gICAgc3RhcnRUaW1lOiAwLFxuICAgIGR1cmF0aW9uOiAwLFxuICAgIHBvc2l0aW9uOiBuZXcgVmVjMygpLFxuICAgIG1heERpc3RhbmNlOiAwLFxuICAgIHJlZkRpc3RhbmNlOiAwLFxuICAgIHJvbGxPZmZGYWN0b3I6IDAsXG4gICAgZGlzdGFuY2VNb2RlbDogMCxcbiAgICBvblBsYXk6IG51bGwsXG4gICAgb25QYXVzZTogbnVsbCxcbiAgICBvblJlc3VtZTogbnVsbCxcbiAgICBvblN0b3A6IG51bGwsXG4gICAgb25FbmQ6IG51bGxcbn07XG5cbi8qKlxuICogVGhlIFNvdW5kU2xvdCBjb250cm9scyBwbGF5YmFjayBvZiBhbiBhdWRpbyBhc3NldC5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFNvdW5kU2xvdCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIHNsb3QuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSB0aGF0IGNvbnRhaW5zIGFsbCB0aGUge0BsaW5rIFNvdW5kSW5zdGFuY2V9cyBjdXJyZW50bHkgYmVpbmcgcGxheWVkIGJ5IHRoZSBzbG90LlxuICAgICAqXG4gICAgICogQHR5cGUge1NvdW5kSW5zdGFuY2VbXX1cbiAgICAgKi9cbiAgICBpbnN0YW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTb3VuZFNsb3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9jb21wb25lbnQuanMnKS5Tb3VuZENvbXBvbmVudH0gY29tcG9uZW50IC0gVGhlIENvbXBvbmVudCB0aGF0IGNyZWF0ZWQgdGhpc1xuICAgICAqIHNsb3QuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBzbG90LiBEZWZhdWx0cyB0byAnVW50aXRsZWQnLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBTZXR0aW5ncyBmb3IgdGhlIHNsb3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnZvbHVtZT0xXSAtIFRoZSBwbGF5YmFjayB2b2x1bWUsIGJldHdlZW4gMCBhbmQgMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMucGl0Y2g9MV0gLSBUaGUgcmVsYXRpdmUgcGl0Y2gsIGRlZmF1bHQgb2YgMSwgcGxheXMgYXQgbm9ybWFsIHBpdGNoLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubG9vcD1mYWxzZV0gLSBJZiB0cnVlIHRoZSBzb3VuZCB3aWxsIHJlc3RhcnQgd2hlbiBpdCByZWFjaGVzIHRoZVxuICAgICAqIGVuZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3RhcnRUaW1lPTBdIC0gVGhlIHN0YXJ0IHRpbWUgZnJvbSB3aGljaCB0aGUgc291bmQgd2lsbCBzdGFydFxuICAgICAqIHBsYXlpbmcuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmR1cmF0aW9uPW51bGxdIC0gVGhlIGR1cmF0aW9uIG9mIHRoZSBzb3VuZCB0aGF0IHRoZSBzbG90IHdpbGwgcGxheVxuICAgICAqIHN0YXJ0aW5nIGZyb20gc3RhcnRUaW1lLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMub3ZlcmxhcD1mYWxzZV0gLSBJZiB0cnVlIHRoZW4gc291bmRzIHBsYXllZCBmcm9tIHNsb3Qgd2lsbCBiZVxuICAgICAqIHBsYXllZCBpbmRlcGVuZGVudGx5IG9mIGVhY2ggb3RoZXIuIE90aGVyd2lzZSB0aGUgc2xvdCB3aWxsIGZpcnN0IHN0b3AgdGhlIGN1cnJlbnQgc291bmRcbiAgICAgKiBiZWZvcmUgc3RhcnRpbmcgdGhlIG5ldyBvbmUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hdXRvUGxheT1mYWxzZV0gLSBJZiB0cnVlIHRoZSBzbG90IHdpbGwgc3RhcnQgcGxheWluZyBhcyBzb29uIGFzXG4gICAgICogaXRzIGF1ZGlvIGFzc2V0IGlzIGxvYWRlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYXNzZXQ9bnVsbF0gLSBUaGUgYXNzZXQgaWQgb2YgdGhlIGF1ZGlvIGFzc2V0IHRoYXQgaXMgZ29pbmcgdG8gYmVcbiAgICAgKiBwbGF5ZWQgYnkgdGhpcyBzbG90LlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNvbXBvbmVudCwgbmFtZSA9ICdVbnRpdGxlZCcsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2NvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gY29tcG9uZW50LnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gY29tcG9uZW50LnN5c3RlbS5tYW5hZ2VyO1xuXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgICAgICAgdGhpcy5fdm9sdW1lID0gb3B0aW9ucy52b2x1bWUgIT09IHVuZGVmaW5lZCA/IG1hdGguY2xhbXAoTnVtYmVyKG9wdGlvbnMudm9sdW1lKSB8fCAwLCAwLCAxKSA6IDE7XG4gICAgICAgIHRoaXMuX3BpdGNoID0gb3B0aW9ucy5waXRjaCAhPT0gdW5kZWZpbmVkID8gTWF0aC5tYXgoMC4wMSwgTnVtYmVyKG9wdGlvbnMucGl0Y2gpIHx8IDApIDogMTtcbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhKG9wdGlvbnMubG9vcCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5sb29wIDogZmFsc2UpO1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IG9wdGlvbnMuZHVyYXRpb24gPiAwID8gb3B0aW9ucy5kdXJhdGlvbiA6IG51bGw7XG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcihvcHRpb25zLnN0YXJ0VGltZSkgfHwgMCk7XG4gICAgICAgIHRoaXMuX292ZXJsYXAgPSAhIShvcHRpb25zLm92ZXJsYXApO1xuICAgICAgICB0aGlzLl9hdXRvUGxheSA9ICEhKG9wdGlvbnMuYXV0b1BsYXkpO1xuICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYXNzZXQgPSBvcHRpb25zLmFzc2V0O1xuICAgICAgICBpZiAodGhpcy5fYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXQgPSB0aGlzLl9hc3NldC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VQbGF5SGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VQbGF5LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VQYXVzZUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUGF1c2UuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb25JbnN0YW5jZVJlc3VtZUhhbmRsZXIgPSB0aGlzLl9vbkluc3RhbmNlUmVzdW1lLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VTdG9wSGFuZGxlciA9IHRoaXMuX29uSW5zdGFuY2VTdG9wLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX29uSW5zdGFuY2VFbmRIYW5kbGVyID0gdGhpcy5fb25JbnN0YW5jZUVuZC5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSBzb3VuZCBpbnN0YW5jZSBzdGFydHMgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZFNsb3QjcGxheVxuICAgICAqIEBwYXJhbSB7U291bmRJbnN0YW5jZX0gaW5zdGFuY2UgLSBUaGUgaW5zdGFuY2UgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kU2xvdCNwYXVzZVxuICAgICAqIEBwYXJhbSB7U291bmRJbnN0YW5jZX0gaW5zdGFuY2UgLSBUaGUgaW5zdGFuY2UgdGhhdCB3YXMgcGF1c2VkIGNyZWF0ZWQgdG8gcGxheSB0aGUgc291bmQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc291bmQgaW5zdGFuY2UgaXMgcmVzdW1lZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZFNsb3QjcmVzdW1lXG4gICAgICogQHBhcmFtIHtTb3VuZEluc3RhbmNlfSBpbnN0YW5jZSAtIFRoZSBpbnN0YW5jZSB0aGF0IHdhcyByZXN1bWVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNvdW5kIGluc3RhbmNlIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRTbG90I3N0b3BcbiAgICAgKiBAcGFyYW0ge1NvdW5kSW5zdGFuY2V9IGluc3RhbmNlIC0gVGhlIGluc3RhbmNlIHRoYXQgd2FzIHN0b3BwZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBhc3NldCBhc3NpZ25lZCB0byB0aGUgc2xvdCBpcyBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRTbG90I2xvYWRcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vLi4vcGxhdGZvcm0vc291bmQvc291bmQuanMnKS5Tb3VuZH0gc291bmQgLSBUaGUgc291bmQgcmVzb3VyY2UgdGhhdFxuICAgICAqIHdhcyBsb2FkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBQbGF5cyBhIHNvdW5kLiBJZiB7QGxpbmsgU291bmRTbG90I292ZXJsYXB9IGlzIHRydWUgdGhlIG5ldyBzb3VuZCBpbnN0YW5jZSB3aWxsIGJlIHBsYXllZFxuICAgICAqIGluZGVwZW5kZW50bHkgb2YgYW55IG90aGVyIGluc3RhbmNlcyBhbHJlYWR5IHBsYXlpbmcuIE90aGVyd2lzZSBleGlzdGluZyBzb3VuZCBpbnN0YW5jZXNcbiAgICAgKiB3aWxsIHN0b3AgYmVmb3JlIHBsYXlpbmcgdGhlIG5ldyBzb3VuZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTb3VuZEluc3RhbmNlfSBUaGUgbmV3IHNvdW5kIGluc3RhbmNlLlxuICAgICAqL1xuICAgIHBsYXkoKSB7XG4gICAgICAgIC8vIHN0b3AgaWYgb3ZlcmxhcCBpcyBmYWxzZVxuICAgICAgICBpZiAoIXRoaXMub3ZlcmxhcCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBub3QgbG9hZGVkIGFuZCBkb2Vzbid0IGhhdmUgYXNzZXQgLSB0aGVuIHdlIGNhbm5vdCBwbGF5IGl0LiAgV2FybiBhbmQgZXhpdC5cbiAgICAgICAgaWYgKCF0aGlzLmlzTG9hZGVkICYmICF0aGlzLl9oYXNBc3NldCgpKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gcGxheSBTb3VuZFNsb3QgJHt0aGlzLm5hbWV9IGJ1dCBpdCBpcyBub3QgbG9hZGVkIGFuZCBkb2Vzbid0IGhhdmUgYW4gYXNzZXQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzLl9jcmVhdGVJbnN0YW5jZSgpO1xuICAgICAgICB0aGlzLmluc3RhbmNlcy5wdXNoKGluc3RhbmNlKTtcblxuICAgICAgICAvLyBpZiBub3QgbG9hZGVkIHRoZW4gbG9hZCBmaXJzdFxuICAgICAgICAvLyBhbmQgdGhlbiBzZXQgc291bmQgcmVzb3VyY2Ugb24gdGhlIGNyZWF0ZWQgaW5zdGFuY2VcbiAgICAgICAgaWYgKCF0aGlzLmlzTG9hZGVkKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAoc291bmQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwbGF5V2hlbkxvYWRlZCA9IGluc3RhbmNlLl9wbGF5V2hlbkxvYWRlZDtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5zb3VuZCA9IHNvdW5kO1xuICAgICAgICAgICAgICAgIGlmIChwbGF5V2hlbkxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5wbGF5KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdGhpcy5vZmYoJ2xvYWQnLCBvbkxvYWQpO1xuICAgICAgICAgICAgdGhpcy5vbmNlKCdsb2FkJywgb25Mb2FkKTtcbiAgICAgICAgICAgIHRoaXMubG9hZCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW5zdGFuY2UucGxheSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyBhbGwgc291bmQgaW5zdGFuY2VzLiBUbyBjb250aW51ZSBwbGF5YmFjayBjYWxsIHtAbGluayBTb3VuZFNsb3QjcmVzdW1lfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzb3VuZCBpbnN0YW5jZXMgcGF1c2VkIHN1Y2Nlc3NmdWxseSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICBsZXQgcGF1c2VkID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXNbaV0ucGF1c2UoKSkge1xuICAgICAgICAgICAgICAgIHBhdXNlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcGF1c2VkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgcGxheWJhY2sgb2YgYWxsIHBhdXNlZCBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBhbnkgaW5zdGFuY2VzIHdlcmUgcmVzdW1lZC5cbiAgICAgKi9cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIGxldCByZXN1bWVkID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZXNbaV0ucmVzdW1lKCkpXG4gICAgICAgICAgICAgICAgcmVzdW1lZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdW1lZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyBwbGF5YmFjayBvZiBhbGwgc291bmQgaW5zdGFuY2VzLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgYW55IGluc3RhbmNlcyB3ZXJlIHN0b3BwZWQuXG4gICAgICovXG4gICAgc3RvcCgpIHtcbiAgICAgICAgbGV0IHN0b3BwZWQgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgbGV0IGkgPSBpbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICAvLyBkbyB0aGlzIGluIHJldmVyc2Ugb3JkZXIgYmVjYXVzZSBhcyBlYWNoIGluc3RhbmNlXG4gICAgICAgIC8vIGlzIHN0b3BwZWQgaXQgd2lsbCBiZSByZW1vdmVkIGZyb20gdGhlIGluc3RhbmNlcyBhcnJheVxuICAgICAgICAvLyBieSB0aGUgaW5zdGFuY2Ugc3RvcCBldmVudCBoYW5kbGVyXG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zdG9wKCk7XG4gICAgICAgICAgICBzdG9wcGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGluc3RhbmNlcy5sZW5ndGggPSAwO1xuXG4gICAgICAgIHJldHVybiBzdG9wcGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWRzIHRoZSBhc3NldCBhc3NpZ25lZCB0byB0aGlzIHNsb3QuXG4gICAgICovXG4gICAgbG9hZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9oYXNBc3NldCgpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLm9uY2UoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKCFhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Bc3NldExvYWQsIHRoaXMpO1xuICAgICAgICAgICAgYXNzZXQub25jZSgnbG9hZCcsIHRoaXMuX29uQXNzZXRMb2FkLCB0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLmxvYWQoYXNzZXQpO1xuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ2xvYWQnLCBhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdCBleHRlcm5hbCBXZWIgQXVkaW8gQVBJIG5vZGVzLiBBbnkgc291bmQgcGxheWVkIGJ5IHRoaXMgc2xvdCB3aWxsIGF1dG9tYXRpY2FsbHlcbiAgICAgKiBhdHRhY2ggdGhlIHNwZWNpZmllZCBub2RlcyB0byB0aGUgc291cmNlIHRoYXQgcGxheXMgdGhlIHNvdW5kLiBZb3UgbmVlZCB0byBwYXNzIHRoZSBmaXJzdFxuICAgICAqIG5vZGUgb2YgdGhlIG5vZGUgZ3JhcGggdGhhdCB5b3UgY3JlYXRlZCBleHRlcm5hbGx5IGFuZCB0aGUgbGFzdCBub2RlIG9mIHRoYXQgZ3JhcGguIFRoZVxuICAgICAqIGZpcnN0IG5vZGUgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGF1ZGlvIHNvdXJjZSBhbmQgdGhlIGxhc3Qgbm9kZSB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGVcbiAgICAgKiBkZXN0aW5hdGlvbiBvZiB0aGUgQXVkaW9Db250ZXh0IChlLmcuIHNwZWFrZXJzKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXVkaW9Ob2RlfSBmaXJzdE5vZGUgLSBUaGUgZmlyc3Qgbm9kZSB0aGF0IHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBhdWRpbyBzb3VyY2Ugb2ZcbiAgICAgKiBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtBdWRpb05vZGV9IFtsYXN0Tm9kZV0gLSBUaGUgbGFzdCBub2RlIHRoYXQgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIG9mXG4gICAgICogdGhlIEF1ZGlvQ29udGV4dC4gSWYgdW5zcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3ROb2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAqIGluc3RlYWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBjb250ZXh0ID0gYXBwLnN5c3RlbXMuc291bmQuY29udGV4dDtcbiAgICAgKiBjb25zdCBhbmFseXplciA9IGNvbnRleHQuY3JlYXRlQW5hbHl6ZXIoKTtcbiAgICAgKiBjb25zdCBkaXN0b3J0aW9uID0gY29udGV4dC5jcmVhdGVXYXZlU2hhcGVyKCk7XG4gICAgICogY29uc3QgZmlsdGVyID0gY29udGV4dC5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgKiBhbmFseXplci5jb25uZWN0KGRpc3RvcnRpb24pO1xuICAgICAqIGRpc3RvcnRpb24uY29ubmVjdChmaWx0ZXIpO1xuICAgICAqIHNsb3Quc2V0RXh0ZXJuYWxOb2RlcyhhbmFseXplciwgZmlsdGVyKTtcbiAgICAgKi9cbiAgICBzZXRFeHRlcm5hbE5vZGVzKGZpcnN0Tm9kZSwgbGFzdE5vZGUpIHtcbiAgICAgICAgaWYgKCEoZmlyc3ROb2RlKSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVGhlIGZpcnN0Tm9kZSBtdXN0IGhhdmUgYSB2YWxpZCBBdWRpb05vZGUnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbGFzdE5vZGUpIHtcbiAgICAgICAgICAgIGxhc3ROb2RlID0gZmlyc3ROb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gZmlyc3ROb2RlO1xuICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IGxhc3ROb2RlO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnN0YW5jZXMgaWYgbm90IG92ZXJsYXBwaW5nXG4gICAgICAgIGlmICghdGhpcy5fb3ZlcmxhcCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLnNldEV4dGVybmFsTm9kZXMoZmlyc3ROb2RlLCBsYXN0Tm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgYW55IGV4dGVybmFsIG5vZGVzIHNldCBieSB7QGxpbmsgU291bmRTbG90I3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqL1xuICAgIGNsZWFyRXh0ZXJuYWxOb2RlcygpIHtcbiAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBudWxsO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnN0YW5jZXMgaWYgbm90IG92ZXJsYXBwaW5nXG4gICAgICAgIGlmICghdGhpcy5fb3ZlcmxhcCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLmNsZWFyRXh0ZXJuYWxOb2RlcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB0d28gZXh0ZXJuYWwgbm9kZXMgc2V0IGJ5IHtAbGluayBTb3VuZFNsb3Qjc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7QXVkaW9Ob2RlW119IEFuIGFycmF5IG9mIDIgZWxlbWVudHMgdGhhdCBjb250YWlucyB0aGUgZmlyc3QgYW5kIGxhc3Qgbm9kZXMgc2V0IGJ5XG4gICAgICoge0BsaW5rIFNvdW5kU2xvdCNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKi9cbiAgICBnZXRFeHRlcm5hbE5vZGVzKCkge1xuICAgICAgICByZXR1cm4gW3RoaXMuX2ZpcnN0Tm9kZSwgdGhpcy5fbGFzdE5vZGVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydHMgd2hldGhlciBhbiBhc3NldCBpcyBzZXQgb24gdGhpcyBzbG90LlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xvdCBoYXMgYW4gYXNzZXQgYXNzaWduZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaGFzQXNzZXQoKSB7XG4gICAgICAgIC8vICE9IGludGVudGlvbmFsXG4gICAgICAgIHJldHVybiB0aGlzLl9hc3NldCAhPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcge0BsaW5rIFNvdW5kSW5zdGFuY2V9IHdpdGggdGhlIHByb3BlcnRpZXMgb2YgdGhlIHNsb3QuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U291bmRJbnN0YW5jZX0gVGhlIG5ldyBpbnN0YW5jZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jcmVhdGVJbnN0YW5jZSgpIHtcbiAgICAgICAgbGV0IGluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICBjb25zdCBjb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnQ7XG5cbiAgICAgICAgbGV0IHNvdW5kID0gbnVsbDtcblxuICAgICAgICAvLyBnZXQgc291bmQgcmVzb3VyY2VcbiAgICAgICAgaWYgKHRoaXMuX2hhc0Fzc2V0KCkpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBzb3VuZCA9IGFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBpbnN0YW5jZSBvcHRpb25zXG4gICAgICAgIGNvbnN0IGRhdGEgPSBpbnN0YW5jZU9wdGlvbnM7XG4gICAgICAgIGRhdGEudm9sdW1lID0gdGhpcy5fdm9sdW1lICogY29tcG9uZW50LnZvbHVtZTtcbiAgICAgICAgZGF0YS5waXRjaCA9IHRoaXMuX3BpdGNoICogY29tcG9uZW50LnBpdGNoO1xuICAgICAgICBkYXRhLmxvb3AgPSB0aGlzLl9sb29wO1xuICAgICAgICBkYXRhLnN0YXJ0VGltZSA9IHRoaXMuX3N0YXJ0VGltZTtcbiAgICAgICAgZGF0YS5kdXJhdGlvbiA9IHRoaXMuX2R1cmF0aW9uO1xuXG4gICAgICAgIGRhdGEub25QbGF5ID0gdGhpcy5fb25JbnN0YW5jZVBsYXlIYW5kbGVyO1xuICAgICAgICBkYXRhLm9uUGF1c2UgPSB0aGlzLl9vbkluc3RhbmNlUGF1c2VIYW5kbGVyO1xuICAgICAgICBkYXRhLm9uUmVzdW1lID0gdGhpcy5fb25JbnN0YW5jZVJlc3VtZUhhbmRsZXI7XG4gICAgICAgIGRhdGEub25TdG9wID0gdGhpcy5fb25JbnN0YW5jZVN0b3BIYW5kbGVyO1xuICAgICAgICBkYXRhLm9uRW5kID0gdGhpcy5fb25JbnN0YW5jZUVuZEhhbmRsZXI7XG5cbiAgICAgICAgaWYgKGNvbXBvbmVudC5wb3NpdGlvbmFsKSB7XG4gICAgICAgICAgICBkYXRhLnBvc2l0aW9uLmNvcHkoY29tcG9uZW50LmVudGl0eS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIGRhdGEubWF4RGlzdGFuY2UgPSBjb21wb25lbnQubWF4RGlzdGFuY2U7XG4gICAgICAgICAgICBkYXRhLnJlZkRpc3RhbmNlID0gY29tcG9uZW50LnJlZkRpc3RhbmNlO1xuICAgICAgICAgICAgZGF0YS5yb2xsT2ZmRmFjdG9yID0gY29tcG9uZW50LnJvbGxPZmZGYWN0b3I7XG4gICAgICAgICAgICBkYXRhLmRpc3RhbmNlTW9kZWwgPSBjb21wb25lbnQuZGlzdGFuY2VNb2RlbDtcblxuICAgICAgICAgICAgaW5zdGFuY2UgPSBuZXcgU291bmRJbnN0YW5jZTNkKHRoaXMuX21hbmFnZXIsIHNvdW5kLCBkYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGluc3RhbmNlID0gbmV3IFNvdW5kSW5zdGFuY2UodGhpcy5fbWFuYWdlciwgc291bmQsIGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaG9vayBleHRlcm5hbCBhdWRpbyBub2Rlc1xuICAgICAgICBpZiAodGhpcy5fZmlyc3ROb2RlKSB7XG4gICAgICAgICAgICBpbnN0YW5jZS5zZXRFeHRlcm5hbE5vZGVzKHRoaXMuX2ZpcnN0Tm9kZSwgdGhpcy5fbGFzdE5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgIH1cblxuICAgIF9vbkluc3RhbmNlUGxheShpbnN0YW5jZSkge1xuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gc2xvdFxuICAgICAgICB0aGlzLmZpcmUoJ3BsYXknLCBpbnN0YW5jZSk7XG5cbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIGNvbXBvbmVudFxuICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgncGxheScsIHRoaXMsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBfb25JbnN0YW5jZVBhdXNlKGluc3RhbmNlKSB7XG4gICAgICAgIC8vIHByb3BhZ2F0ZSBldmVudCB0byBzbG90XG4gICAgICAgIHRoaXMuZmlyZSgncGF1c2UnLCBpbnN0YW5jZSk7XG5cbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIGNvbXBvbmVudFxuICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgncGF1c2UnLCB0aGlzLCBpbnN0YW5jZSk7XG4gICAgfVxuXG4gICAgX29uSW5zdGFuY2VSZXN1bWUoaW5zdGFuY2UpIHtcbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIHNsb3RcbiAgICAgICAgdGhpcy5maXJlKCdyZXN1bWUnLCBpbnN0YW5jZSk7XG5cbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIGNvbXBvbmVudFxuICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgncmVzdW1lJywgdGhpcywgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIF9vbkluc3RhbmNlU3RvcChpbnN0YW5jZSkge1xuICAgICAgICAvLyByZW1vdmUgaW5zdGFuY2UgdGhhdCBzdG9wcGVkXG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuaW5zdGFuY2VzLmluZGV4T2YoaW5zdGFuY2UpO1xuICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcm9wYWdhdGUgZXZlbnQgdG8gc2xvdFxuICAgICAgICB0aGlzLmZpcmUoJ3N0b3AnLCBpbnN0YW5jZSk7XG5cbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIGNvbXBvbmVudFxuICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgnc3RvcCcsIHRoaXMsIGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICBfb25JbnN0YW5jZUVuZChpbnN0YW5jZSkge1xuICAgICAgICAvLyByZW1vdmUgaW5zdGFuY2UgdGhhdCBlbmRlZFxuICAgICAgICBjb25zdCBpZHggPSB0aGlzLmluc3RhbmNlcy5pbmRleE9mKGluc3RhbmNlKTtcbiAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIHNsb3RcbiAgICAgICAgdGhpcy5maXJlKCdlbmQnLCBpbnN0YW5jZSk7XG5cbiAgICAgICAgLy8gcHJvcGFnYXRlIGV2ZW50IHRvIGNvbXBvbmVudFxuICAgICAgICB0aGlzLl9jb21wb25lbnQuZmlyZSgnZW5kJywgdGhpcywgaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIF9vbkFzc2V0QWRkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubG9hZCgpO1xuICAgIH1cblxuICAgIF9vbkFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLmxvYWQoKTtcbiAgICB9XG5cbiAgICBfb25Bc3NldFJlbW92ZWQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2Fzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICB9XG5cbiAgICB1cGRhdGVQb3NpdGlvbihwb3NpdGlvbikge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaW5zdGFuY2VzW2ldLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXNzZXQgaWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfG51bGx9XG4gICAgICovXG4gICAgc2V0IGFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuX2Fzc2V0O1xuXG4gICAgICAgIGlmIChvbGQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5vZmYoJ2FkZDonICsgb2xkLCB0aGlzLl9vbkFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgIGNvbnN0IG9sZEFzc2V0ID0gdGhpcy5fYXNzZXRzLmdldChvbGQpO1xuICAgICAgICAgICAgaWYgKG9sZEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgb2xkQXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkFzc2V0UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hc3NldCA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXQgPSB0aGlzLl9hc3NldC5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvYWQgYXNzZXQgaWYgY29tcG9uZW50IGFuZCBlbnRpdHkgYXJlIGVuYWJsZWRcbiAgICAgICAgaWYgKHRoaXMuX2hhc0Fzc2V0KCkgJiYgdGhpcy5fY29tcG9uZW50LmVuYWJsZWQgJiYgdGhpcy5fY29tcG9uZW50LmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIHNsb3Qgd2lsbCBiZWdpbiBwbGF5aW5nIGFzIHNvb24gYXMgaXQgaXMgbG9hZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGF1dG9QbGF5KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2F1dG9QbGF5ID0gISF2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXV0b1BsYXkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvUGxheTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZHVyYXRpb24gb2YgdGhlIHNvdW5kIHRoYXQgdGhlIHNsb3Qgd2lsbCBwbGF5IHN0YXJ0aW5nIGZyb20gc3RhcnRUaW1lLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZHVyYXRpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZHVyYXRpb24gPSBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUpIHx8IDApIHx8IG51bGw7XG5cbiAgICAgICAgLy8gdXBkYXRlIGluc3RhbmNlcyBpZiBub24gb3ZlcmxhcHBpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9vdmVybGFwKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBkdXJhdGlvbigpIHtcbiAgICAgICAgbGV0IGFzc2V0RHVyYXRpb24gPSAwO1xuICAgICAgICBpZiAodGhpcy5faGFzQXNzZXQoKSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9hc3NldHMuZ2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIGFzc2V0RHVyYXRpb24gPSBhc3NldD8ucmVzb3VyY2UgPyBhc3NldC5yZXNvdXJjZS5kdXJhdGlvbiA6IDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAhPSBpbnRlbnRpb25hbFxuICAgICAgICBpZiAodGhpcy5fZHVyYXRpb24gIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2R1cmF0aW9uICUgKGFzc2V0RHVyYXRpb24gfHwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFzc2V0RHVyYXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBhc3NldCBvZiB0aGUgc2xvdCBpcyBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNMb2FkZWQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9oYXNBc3NldCgpKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2Fzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICEhYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbG90IGlzIGN1cnJlbnRseSBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQYXVzZWQoKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBjb25zdCBsZW4gPSBpbnN0YW5jZXMubGVuZ3RoO1xuICAgICAgICBpZiAobGVuID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghaW5zdGFuY2VzW2ldLmlzUGF1c2VkKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc2xvdCBpcyBjdXJyZW50bHkgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1BsYXlpbmcoKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaW5zdGFuY2VzW2ldLmlzUGxheWluZylcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNsb3QgaXMgY3VycmVudGx5IHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNTdG9wcGVkKCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKCFpbnN0YW5jZXNbaV0uaXNTdG9wcGVkKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIHNsb3Qgd2lsbCByZXN0YXJ0IHdoZW4gaXQgZmluaXNoZXMgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsb29wKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xvb3AgPSAhIXZhbHVlO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnN0YW5jZXMgaWYgbm9uIG92ZXJsYXBwaW5nXG4gICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpbnN0YW5jZXNbaV0ubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbG9vcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvb3A7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGVuIHNvdW5kcyBwbGF5ZWQgZnJvbSBzbG90IHdpbGwgYmUgcGxheWVkIGluZGVwZW5kZW50bHkgb2YgZWFjaCBvdGhlci4gT3RoZXJ3aXNlXG4gICAgICogdGhlIHNsb3Qgd2lsbCBmaXJzdCBzdG9wIHRoZSBjdXJyZW50IHNvdW5kIGJlZm9yZSBzdGFydGluZyB0aGUgbmV3IG9uZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBvdmVybGFwKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX292ZXJsYXAgPSAhIXZhbHVlO1xuICAgIH1cblxuICAgIGdldCBvdmVybGFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3ZlcmxhcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGl0Y2ggbW9kaWZpZXIgdG8gcGxheSB0aGUgc291bmQgd2l0aC4gTXVzdCBiZSBsYXJnZXIgdGhhbiAwLjAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcGl0Y2godmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcGl0Y2ggPSBNYXRoLm1heChOdW1iZXIodmFsdWUpIHx8IDAsIDAuMDEpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnN0YW5jZXMgaWYgbm9uIG92ZXJsYXBwaW5nXG4gICAgICAgIGlmICghdGhpcy5fb3ZlcmxhcCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLnBpdGNoID0gdGhpcy5waXRjaCAqIHRoaXMuX2NvbXBvbmVudC5waXRjaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwaXRjaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BpdGNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBzdGFydCB0aW1lIGZyb20gd2hpY2ggdGhlIHNvdW5kIHdpbGwgc3RhcnQgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHN0YXJ0VGltZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zdGFydFRpbWUgPSBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUpIHx8IDApO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnN0YW5jZXMgaWYgbm9uIG92ZXJsYXBwaW5nXG4gICAgICAgIGlmICghdGhpcy5fb3ZlcmxhcCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLnN0YXJ0VGltZSA9IHRoaXMuX3N0YXJ0VGltZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzdGFydFRpbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGFydFRpbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHZvbHVtZSBtb2RpZmllciB0byBwbGF5IHRoZSBzb3VuZCB3aXRoLiBJbiByYW5nZSAwLTEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCB2b2x1bWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdm9sdW1lID0gbWF0aC5jbGFtcChOdW1iZXIodmFsdWUpIHx8IDAsIDAsIDEpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnN0YW5jZXMgaWYgbm9uIG92ZXJsYXBwaW5nXG4gICAgICAgIGlmICghdGhpcy5fb3ZlcmxhcCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gaW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VzW2ldLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZSAqIHRoaXMuX2NvbXBvbmVudC52b2x1bWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdm9sdW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU291bmRTbG90IH07XG4iXSwibmFtZXMiOlsiaW5zdGFuY2VPcHRpb25zIiwidm9sdW1lIiwicGl0Y2giLCJsb29wIiwic3RhcnRUaW1lIiwiZHVyYXRpb24iLCJwb3NpdGlvbiIsIlZlYzMiLCJtYXhEaXN0YW5jZSIsInJlZkRpc3RhbmNlIiwicm9sbE9mZkZhY3RvciIsImRpc3RhbmNlTW9kZWwiLCJvblBsYXkiLCJvblBhdXNlIiwib25SZXN1bWUiLCJvblN0b3AiLCJvbkVuZCIsIlNvdW5kU2xvdCIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiY29tcG9uZW50IiwibmFtZSIsIm9wdGlvbnMiLCJpbnN0YW5jZXMiLCJfY29tcG9uZW50IiwiX2Fzc2V0cyIsInN5c3RlbSIsImFwcCIsImFzc2V0cyIsIl9tYW5hZ2VyIiwibWFuYWdlciIsIl92b2x1bWUiLCJ1bmRlZmluZWQiLCJtYXRoIiwiY2xhbXAiLCJOdW1iZXIiLCJfcGl0Y2giLCJNYXRoIiwibWF4IiwiX2xvb3AiLCJfZHVyYXRpb24iLCJfc3RhcnRUaW1lIiwiX292ZXJsYXAiLCJvdmVybGFwIiwiX2F1dG9QbGF5IiwiYXV0b1BsYXkiLCJfZmlyc3ROb2RlIiwiX2xhc3ROb2RlIiwiX2Fzc2V0IiwiYXNzZXQiLCJBc3NldCIsImlkIiwiX29uSW5zdGFuY2VQbGF5SGFuZGxlciIsIl9vbkluc3RhbmNlUGxheSIsImJpbmQiLCJfb25JbnN0YW5jZVBhdXNlSGFuZGxlciIsIl9vbkluc3RhbmNlUGF1c2UiLCJfb25JbnN0YW5jZVJlc3VtZUhhbmRsZXIiLCJfb25JbnN0YW5jZVJlc3VtZSIsIl9vbkluc3RhbmNlU3RvcEhhbmRsZXIiLCJfb25JbnN0YW5jZVN0b3AiLCJfb25JbnN0YW5jZUVuZEhhbmRsZXIiLCJfb25JbnN0YW5jZUVuZCIsInBsYXkiLCJzdG9wIiwiaXNMb2FkZWQiLCJfaGFzQXNzZXQiLCJEZWJ1ZyIsIndhcm4iLCJpbnN0YW5jZSIsIl9jcmVhdGVJbnN0YW5jZSIsInB1c2giLCJvbkxvYWQiLCJzb3VuZCIsInBsYXlXaGVuTG9hZGVkIiwiX3BsYXlXaGVuTG9hZGVkIiwib2ZmIiwib25jZSIsImxvYWQiLCJwYXVzZSIsInBhdXNlZCIsImkiLCJsZW4iLCJsZW5ndGgiLCJyZXN1bWUiLCJyZXN1bWVkIiwic3RvcHBlZCIsImdldCIsIl9vbkFzc2V0QWRkIiwiX29uQXNzZXRSZW1vdmVkIiwib24iLCJyZXNvdXJjZSIsIl9vbkFzc2V0TG9hZCIsImZpcmUiLCJzZXRFeHRlcm5hbE5vZGVzIiwiZmlyc3ROb2RlIiwibGFzdE5vZGUiLCJjb25zb2xlIiwiZXJyb3IiLCJjbGVhckV4dGVybmFsTm9kZXMiLCJnZXRFeHRlcm5hbE5vZGVzIiwiZGF0YSIsInBvc2l0aW9uYWwiLCJjb3B5IiwiZW50aXR5IiwiZ2V0UG9zaXRpb24iLCJTb3VuZEluc3RhbmNlM2QiLCJTb3VuZEluc3RhbmNlIiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInVwZGF0ZVBvc2l0aW9uIiwidmFsdWUiLCJvbGQiLCJvbGRBc3NldCIsImVuYWJsZWQiLCJhc3NldER1cmF0aW9uIiwiaXNQYXVzZWQiLCJpc1BsYXlpbmciLCJpc1N0b3BwZWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBV0E7QUFDQSxNQUFNQSxlQUFlLEdBQUc7QUFDcEJDLEVBQUFBLE1BQU0sRUFBRSxDQUFDO0FBQ1RDLEVBQUFBLEtBQUssRUFBRSxDQUFDO0FBQ1JDLEVBQUFBLElBQUksRUFBRSxLQUFLO0FBQ1hDLEVBQUFBLFNBQVMsRUFBRSxDQUFDO0FBQ1pDLEVBQUFBLFFBQVEsRUFBRSxDQUFDO0FBQ1hDLEVBQUFBLFFBQVEsRUFBRSxJQUFJQyxJQUFJLEVBQUU7QUFDcEJDLEVBQUFBLFdBQVcsRUFBRSxDQUFDO0FBQ2RDLEVBQUFBLFdBQVcsRUFBRSxDQUFDO0FBQ2RDLEVBQUFBLGFBQWEsRUFBRSxDQUFDO0FBQ2hCQyxFQUFBQSxhQUFhLEVBQUUsQ0FBQztBQUNoQkMsRUFBQUEsTUFBTSxFQUFFLElBQUk7QUFDWkMsRUFBQUEsT0FBTyxFQUFFLElBQUk7QUFDYkMsRUFBQUEsUUFBUSxFQUFFLElBQUk7QUFDZEMsRUFBQUEsTUFBTSxFQUFFLElBQUk7QUFDWkMsRUFBQUEsS0FBSyxFQUFFLElBQUE7QUFDWCxDQUFDLENBQUE7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLFNBQVMsU0FBU0MsWUFBWSxDQUFDO0FBZWpDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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
