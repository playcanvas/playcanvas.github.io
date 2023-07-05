import { EventHandler } from '../../core/event-handler.js';
import { math } from '../../core/math/math.js';
import { hasAudioContext } from '../audio/capabilities.js';

const STATE_PLAYING = 0;
const STATE_PAUSED = 1;
const STATE_STOPPED = 2;

/**
 * Return time % duration but always return a number instead of NaN when duration is 0.
 *
 * @param {number} time - The time.
 * @param {number} duration - The duration.
 * @returns {number} The time % duration.
 * @ignore
 */
function capTime(time, duration) {
  return time % duration || 0;
}

/**
 * A SoundInstance plays a {@link Sound}.
 *
 * @augments EventHandler
 */
class SoundInstance extends EventHandler {
  /**
   * Create a new SoundInstance instance.
   *
   * @param {import('./manager.js').SoundManager} manager - The sound manager.
   * @param {import('./sound.js').Sound} sound - The sound to play.
   * @param {object} options - Options for the instance.
   * @param {number} [options.volume=1] - The playback volume, between 0 and 1.
   * @param {number} [options.pitch=1] - The relative pitch, default of 1, plays at normal pitch.
   * @param {boolean} [options.loop=false] - Whether the sound should loop when it reaches the
   * end or not.
   * @param {number} [options.startTime=0] - The time from which the playback will start in
   * seconds. Default is 0 to start at the beginning.
   * @param {number} [options.duration=0] - The total time after the startTime in seconds when
   * playback will stop or restart if loop is true.
   * @param {Function} [options.onPlay=null] - Function called when the instance starts playing.
   * @param {Function} [options.onPause=null] - Function called when the instance is paused.
   * @param {Function} [options.onResume=null] - Function called when the instance is resumed.
   * @param {Function} [options.onStop=null] - Function called when the instance is stopped.
   * @param {Function} [options.onEnd=null] - Function called when the instance ends.
   */
  constructor(manager, sound, options) {
    super();

    /**
     * @type {import('./manager.js').SoundManager}
     * @private
     */
    /**
     * Gets the source that plays the sound resource. If the Web Audio API is not supported the
     * type of source is [Audio](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio).
     * Source is only available after calling play.
     *
     * @type {AudioBufferSourceNode}
     */
    this.source = null;
    this._manager = manager;

    /**
     * @type {number}
     * @private
     */
    this._volume = options.volume !== undefined ? math.clamp(Number(options.volume) || 0, 0, 1) : 1;

    /**
     * @type {number}
     * @private
     */
    this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;

    /**
     * @type {boolean}
     * @private
     */
    this._loop = !!(options.loop !== undefined ? options.loop : false);

    /**
     * @type {import('./sound.js').Sound}
     * @private
     */
    this._sound = sound;

    /**
     * Start at 'stopped'.
     *
     * @type {number}
     * @private
     */
    this._state = STATE_STOPPED;

    /**
     * True if the manager was suspended.
     *
     * @type {boolean}
     * @private
     */
    this._suspended = false;

    /**
     * Greater than 0 if we want to suspend the event handled to the 'onended' event.
     * When an 'onended' event is suspended, this counter is decremented by 1.
     * When a future 'onended' event is to be suspended, this counter is incremented by 1.
     *
     * @type {number}
     * @private
     */
    this._suspendEndEvent = 0;

    /**
     * True if we want to suspend firing instance events.
     *
     * @type {boolean}
     * @private
     */
    this._suspendInstanceEvents = false;

    /**
     * If true then the instance will start playing its source when its created.
     *
     * @type {boolean}
     * @private
     */
    this._playWhenLoaded = true;

    /**
     * @type {number}
     * @private
     */
    this._startTime = Math.max(0, Number(options.startTime) || 0);

    /**
     * @type {number}
     * @private
     */
    this._duration = Math.max(0, Number(options.duration) || 0);

    /**
     * @type {number|null}
     * @private
     */
    this._startOffset = null;

    // external event handlers
    /** @private */
    this._onPlayCallback = options.onPlay;
    /** @private */
    this._onPauseCallback = options.onPause;
    /** @private */
    this._onResumeCallback = options.onResume;
    /** @private */
    this._onStopCallback = options.onStop;
    /** @private */
    this._onEndCallback = options.onEnd;
    if (hasAudioContext()) {
      /**
       * @type {number}
       * @private
       */
      this._startedAt = 0;

      /**
       * Manually keep track of the playback position because the Web Audio API does not
       * provide a way to do this accurately if the playbackRate is not 1.
       *
       * @type {number}
       * @private
       */
      this._currentTime = 0;

      /**
       * @type {number}
       * @private
       */
      this._currentOffset = 0;

      /**
       * The input node is the one that is connected to the source.
       *
       * @type {AudioNode|null}
       * @private
       */
      this._inputNode = null;

      /**
       * The connected node is the one that is connected to the destination (speakers). Any
       * external nodes will be connected to this node.
       *
       * @type {AudioNode|null}
       * @private
       */
      this._connectorNode = null;

      /**
       * The first external node set by a user.
       *
       * @type {AudioNode|null}
       * @private
       */
      this._firstNode = null;

      /**
       * The last external node set by a user.
       *
       * @type {AudioNode|null}
       * @private
       */
      this._lastNode = null;

      /**
       * Set to true if a play() request was issued when the AudioContext was still suspended,
       * and will therefore wait until it is resumed to play the audio.
       *
       * @type {boolean}
       * @private
       */
      this._waitingContextSuspension = false;
      this._initializeNodes();

      /** @private */
      this._endedHandler = this._onEnded.bind(this);
    } else {
      /** @private */
      this._isReady = false;

      /** @private */
      this._loadedMetadataHandler = this._onLoadedMetadata.bind(this);
      /** @private */
      this._timeUpdateHandler = this._onTimeUpdate.bind(this);
      /** @private */
      this._endedHandler = this._onEnded.bind(this);
      this._createSource();
    }
  }

  /**
   * Fired when the instance starts playing its source.
   *
   * @event SoundInstance#play
   */

  /**
   * Fired when the instance is paused.
   *
   * @event SoundInstance#pause
   */

  /**
   * Fired when the instance is resumed.
   *
   * @event SoundInstance#resume
   */

  /**
   * Fired when the instance is stopped.
   *
   * @event SoundInstance#stop
   */

  /**
   * Fired when the sound currently played by the instance ends.
   *
   * @event SoundInstance#end
   */

  /**
   * Gets or sets the current time of the sound that is playing. If the value provided is bigger
   * than the duration of the instance it will wrap from the beginning.
   *
   * @type {number}
   */
  set currentTime(value) {
    if (value < 0) return;
    if (this._state === STATE_PLAYING) {
      const suspend = this._suspendInstanceEvents;
      this._suspendInstanceEvents = true;

      // stop first which will set _startOffset to null
      this.stop();

      // set _startOffset and play
      this._startOffset = value;
      this.play();
      this._suspendInstanceEvents = suspend;
    } else {
      // set _startOffset which will be used when the instance will start playing
      this._startOffset = value;
      // set _currentTime
      this._currentTime = value;
    }
  }
  get currentTime() {
    // if the user has set the currentTime and we have not used it yet
    // then just return that
    if (this._startOffset !== null) {
      return this._startOffset;
    }

    // if the sound is paused return the currentTime calculated when
    // pause() was called
    if (this._state === STATE_PAUSED) {
      return this._currentTime;
    }

    // if the sound is stopped or we don't have a source
    // return 0
    if (this._state === STATE_STOPPED || !this.source) {
      return 0;
    }

    // recalculate current time
    this._updateCurrentTime();
    return this._currentTime;
  }

  /**
   * The duration of the sound that the instance will play starting from startTime.
   *
   * @type {number}
   */
  set duration(value) {
    this._duration = Math.max(0, Number(value) || 0);

    // restart
    const isPlaying = this._state === STATE_PLAYING;
    this.stop();
    if (isPlaying) {
      this.play();
    }
  }
  get duration() {
    if (!this._sound) {
      return 0;
    }
    if (this._duration) {
      return capTime(this._duration, this._sound.duration);
    }
    return this._sound.duration;
  }

  /**
   * Returns true if the instance is currently paused.
   *
   * @type {boolean}
   */
  get isPaused() {
    return this._state === STATE_PAUSED;
  }

  /**
   * Returns true if the instance is currently playing.
   *
   * @type {boolean}
   */
  get isPlaying() {
    return this._state === STATE_PLAYING;
  }

  /**
   * Returns true if the instance is currently stopped.
   *
   * @type {boolean}
   */
  get isStopped() {
    return this._state === STATE_STOPPED;
  }

  /**
   * Returns true if the instance is currently suspended because the window is not focused.
   *
   * @type {boolean}
   */
  get isSuspended() {
    return this._suspended;
  }

  /**
   * If true the instance will restart when it finishes playing.
   *
   * @type {boolean}
   */
  set loop(value) {
    this._loop = !!value;
    if (this.source) {
      this.source.loop = this._loop;
    }
  }
  get loop() {
    return this._loop;
  }

  /**
   * The pitch modifier to play the sound with. Must be larger than 0.01.
   *
   * @type {number}
   */
  set pitch(pitch) {
    // set offset to current time so that
    // we calculate the rest of the time with the new pitch
    // from now on
    this._currentOffset = this.currentTime;
    this._startedAt = this._manager.context.currentTime;
    this._pitch = Math.max(Number(pitch) || 0, 0.01);
    if (this.source) {
      this.source.playbackRate.value = this._pitch;
    }
  }
  get pitch() {
    return this._pitch;
  }

  /**
   * The sound resource that the instance will play.
   *
   * @type {import('./sound.js').Sound}
   */
  set sound(value) {
    this._sound = value;
    if (this._state !== STATE_STOPPED) {
      this.stop();
    } else {
      this._createSource();
    }
  }
  get sound() {
    return this._sound;
  }

  /**
   * The start time from which the sound will start playing.
   *
   * @type {number}
   */
  set startTime(value) {
    this._startTime = Math.max(0, Number(value) || 0);

    // restart
    const isPlaying = this._state === STATE_PLAYING;
    this.stop();
    if (isPlaying) {
      this.play();
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
  set volume(volume) {
    volume = math.clamp(volume, 0, 1);
    this._volume = volume;
    if (this.gain) {
      this.gain.gain.value = volume * this._manager.volume;
    }
  }
  get volume() {
    return this._volume;
  }

  /** @private */
  _onPlay() {
    this.fire('play');
    if (this._onPlayCallback) this._onPlayCallback(this);
  }

  /** @private */
  _onPause() {
    this.fire('pause');
    if (this._onPauseCallback) this._onPauseCallback(this);
  }

  /** @private */
  _onResume() {
    this.fire('resume');
    if (this._onResumeCallback) this._onResumeCallback(this);
  }

  /** @private */
  _onStop() {
    this.fire('stop');
    if (this._onStopCallback) this._onStopCallback(this);
  }

  /** @private */
  _onEnded() {
    // the callback is not fired synchronously
    // so only decrement _suspendEndEvent when the
    // callback is fired
    if (this._suspendEndEvent > 0) {
      this._suspendEndEvent--;
      return;
    }
    this.fire('end');
    if (this._onEndCallback) this._onEndCallback(this);
    this.stop();
  }

  /**
   * Handle the manager's 'volumechange' event.
   *
   * @private
   */
  _onManagerVolumeChange() {
    this.volume = this._volume;
  }

  /**
   * Handle the manager's 'suspend' event.
   *
   * @private
   */
  _onManagerSuspend() {
    if (this._state === STATE_PLAYING && !this._suspended) {
      this._suspended = true;
      this.pause();
    }
  }

  /**
   * Handle the manager's 'resume' event.
   *
   * @private
   */
  _onManagerResume() {
    if (this._suspended) {
      this._suspended = false;
      this.resume();
    }
  }

  /**
   * Creates internal audio nodes and connects them.
   *
   * @private
   */
  _initializeNodes() {
    // create gain node for volume control
    this.gain = this._manager.context.createGain();
    this._inputNode = this.gain;
    // the gain node is also the connector node for 2D sound instances
    this._connectorNode = this.gain;
    this._connectorNode.connect(this._manager.context.destination);
  }

  /**
   * Attempt to begin playback the sound.
   * If the AudioContext is suspended, the audio will only start once it's resumed.
   * If the sound is already playing, this will restart the sound.
   *
   * @returns {boolean} True if the sound was started immediately.
   */
  play() {
    if (this._state !== STATE_STOPPED) {
      this.stop();
    }
    // set state to playing
    this._state = STATE_PLAYING;
    // no need for this anymore
    this._playWhenLoaded = false;

    // play() was already issued but hasn't actually started yet
    if (this._waitingContextSuspension) {
      return false;
    }

    // manager is suspended so audio cannot start now - wait for manager to resume
    if (this._manager.suspended) {
      this._manager.once('resume', this._playAudioImmediate, this);
      this._waitingContextSuspension = true;
      return false;
    }
    this._playAudioImmediate();
    return true;
  }

  /**
   * Immediately play the sound.
   * This method assumes the AudioContext is ready (not suspended or locked).
   *
   * @private
   */
  _playAudioImmediate() {
    this._waitingContextSuspension = false;

    // between play() and the manager being ready to play, a stop() or pause() call was made
    if (this._state !== STATE_PLAYING) {
      return;
    }
    if (!this.source) {
      this._createSource();
    }

    // calculate start offset
    let offset = capTime(this._startOffset, this.duration);
    offset = capTime(this._startTime + offset, this._sound.duration);
    // reset start offset now that we started the sound
    this._startOffset = null;

    // start source with specified offset and duration
    if (this._duration) {
      this.source.start(0, offset, this._duration);
    } else {
      this.source.start(0, offset);
    }

    // reset times
    this._startedAt = this._manager.context.currentTime;
    this._currentTime = 0;
    this._currentOffset = offset;

    // Initialize volume and loop - note moved to be after start() because of Chrome bug
    this.volume = this._volume;
    this.loop = this._loop;
    this.pitch = this._pitch;

    // handle suspend events / volumechange events
    this._manager.on('volumechange', this._onManagerVolumeChange, this);
    this._manager.on('suspend', this._onManagerSuspend, this);
    this._manager.on('resume', this._onManagerResume, this);
    this._manager.on('destroy', this._onManagerDestroy, this);
    if (!this._suspendInstanceEvents) {
      this._onPlay();
    }
  }

  /**
   * Pauses playback of sound. Call resume() to resume playback from the same position.
   *
   * @returns {boolean} Returns true if the sound was paused.
   */
  pause() {
    // no need for this anymore
    this._playWhenLoaded = false;
    if (this._state !== STATE_PLAYING) return false;

    // set state to paused
    this._state = STATE_PAUSED;

    // play() was issued but hasn't actually started yet.
    if (this._waitingContextSuspension) {
      return true;
    }

    // store current time
    this._updateCurrentTime();

    // Stop the source and re-create it because we cannot reuse the same source.
    // Suspend the end event as we are manually stopping the source
    this._suspendEndEvent++;
    this.source.stop(0);
    this.source = null;

    // reset user-set start offset
    this._startOffset = null;
    if (!this._suspendInstanceEvents) this._onPause();
    return true;
  }

  /**
   * Resumes playback of the sound. Playback resumes at the point that the audio was paused.
   *
   * @returns {boolean} Returns true if the sound was resumed.
   */
  resume() {
    if (this._state !== STATE_PAUSED) {
      return false;
    }

    // start at point where sound was paused
    let offset = this.currentTime;

    // set state back to playing
    this._state = STATE_PLAYING;

    // play() was issued but hasn't actually started yet
    if (this._waitingContextSuspension) {
      return true;
    }
    if (!this.source) {
      this._createSource();
    }

    // if the user set the 'currentTime' property while the sound
    // was paused then use that as the offset instead
    if (this._startOffset !== null) {
      offset = capTime(this._startOffset, this.duration);
      offset = capTime(this._startTime + offset, this._sound.duration);

      // reset offset
      this._startOffset = null;
    }

    // start source
    if (this._duration) {
      this.source.start(0, offset, this._duration);
    } else {
      this.source.start(0, offset);
    }
    this._startedAt = this._manager.context.currentTime;
    this._currentOffset = offset;

    // Initialize parameters
    this.volume = this._volume;
    this.loop = this._loop;
    this.pitch = this._pitch;
    this._playWhenLoaded = false;
    if (!this._suspendInstanceEvents) this._onResume();
    return true;
  }

  /**
   * Stops playback of sound. Calling play() again will restart playback from the beginning of
   * the sound.
   *
   * @returns {boolean} Returns true if the sound was stopped.
   */
  stop() {
    this._playWhenLoaded = false;
    if (this._state === STATE_STOPPED) return false;

    // set state to stopped
    const wasPlaying = this._state === STATE_PLAYING;
    this._state = STATE_STOPPED;

    // play() was issued but hasn't actually started yet
    if (this._waitingContextSuspension) {
      return true;
    }

    // unsubscribe from manager events
    this._manager.off('volumechange', this._onManagerVolumeChange, this);
    this._manager.off('suspend', this._onManagerSuspend, this);
    this._manager.off('resume', this._onManagerResume, this);
    this._manager.off('destroy', this._onManagerDestroy, this);

    // reset stored times
    this._startedAt = 0;
    this._currentTime = 0;
    this._currentOffset = 0;
    this._startOffset = null;
    this._suspendEndEvent++;
    if (wasPlaying && this.source) {
      this.source.stop(0);
    }
    this.source = null;
    if (!this._suspendInstanceEvents) this._onStop();
    return true;
  }

  /**
   * Connects external Web Audio API nodes. You need to pass the first node of the node graph
   * that you created externally and the last node of that graph. The first node will be
   * connected to the audio source and the last node will be connected to the destination of the
   * AudioContext (e.g. speakers). Requires Web Audio API support.
   *
   * @param {AudioNode} firstNode - The first node that will be connected to the audio source of sound instances.
   * @param {AudioNode} [lastNode] - The last node that will be connected to the destination of the AudioContext.
   * If unspecified then the firstNode will be connected to the destination instead.
   * @example
   * const context = app.systems.sound.context;
   * const analyzer = context.createAnalyzer();
   * const distortion = context.createWaveShaper();
   * const filter = context.createBiquadFilter();
   * analyzer.connect(distortion);
   * distortion.connect(filter);
   * instance.setExternalNodes(analyzer, filter);
   */
  setExternalNodes(firstNode, lastNode) {
    if (!firstNode) {
      console.error('The firstNode must be a valid Audio Node');
      return;
    }
    if (!lastNode) {
      lastNode = firstNode;
    }

    // connections are:
    // source -> inputNode -> connectorNode -> [firstNode -> ... -> lastNode] -> speakers

    const speakers = this._manager.context.destination;
    if (this._firstNode !== firstNode) {
      if (this._firstNode) {
        // if firstNode already exists means the connector node
        // is connected to it so disconnect it
        this._connectorNode.disconnect(this._firstNode);
      } else {
        // if firstNode does not exist means that its connected
        // to the speakers so disconnect it
        this._connectorNode.disconnect(speakers);
      }

      // set first node and connect with connector node
      this._firstNode = firstNode;
      this._connectorNode.connect(firstNode);
    }
    if (this._lastNode !== lastNode) {
      if (this._lastNode) {
        // if last node exists means it's connected to the speakers so disconnect it
        this._lastNode.disconnect(speakers);
      }

      // set last node and connect with speakers
      this._lastNode = lastNode;
      this._lastNode.connect(speakers);
    }
  }

  /**
   * Clears any external nodes set by {@link SoundInstance#setExternalNodes}.
   */
  clearExternalNodes() {
    const speakers = this._manager.context.destination;

    // break existing connections
    if (this._firstNode) {
      this._connectorNode.disconnect(this._firstNode);
      this._firstNode = null;
    }
    if (this._lastNode) {
      this._lastNode.disconnect(speakers);
      this._lastNode = null;
    }

    // reset connect to speakers
    this._connectorNode.connect(speakers);
  }

  /**
   * Gets any external nodes set by {@link SoundInstance#setExternalNodes}.
   *
   * @returns {AudioNode[]} Returns an array that contains the two nodes set by
   * {@link SoundInstance#setExternalNodes}.
   */
  getExternalNodes() {
    return [this._firstNode, this._lastNode];
  }

  /**
   * Creates the source for the instance.
   *
   * @returns {AudioBufferSourceNode|null} Returns the created source or null if the sound
   * instance has no {@link Sound} associated with it.
   * @private
   */
  _createSource() {
    if (!this._sound) {
      return null;
    }
    const context = this._manager.context;
    if (this._sound.buffer) {
      this.source = context.createBufferSource();
      this.source.buffer = this._sound.buffer;

      // Connect up the nodes
      this.source.connect(this._inputNode);

      // set events
      this.source.onended = this._endedHandler;

      // set loopStart and loopEnd so that the source starts and ends at the correct user-set times
      this.source.loopStart = capTime(this._startTime, this.source.buffer.duration);
      if (this._duration) {
        this.source.loopEnd = Math.max(this.source.loopStart, capTime(this._startTime + this._duration, this.source.buffer.duration));
      }
    }
    return this.source;
  }

  /**
   * Sets the current time taking into account the time the instance started playing, the current
   * pitch and the current time offset.
   *
   * @private
   */
  _updateCurrentTime() {
    this._currentTime = capTime((this._manager.context.currentTime - this._startedAt) * this._pitch + this._currentOffset, this.duration);
  }

  /**
   * Handle the manager's 'destroy' event.
   *
   * @private
   */
  _onManagerDestroy() {
    if (this.source && this._state === STATE_PLAYING) {
      this.source.stop(0);
      this.source = null;
    }
  }
}
if (!hasAudioContext()) {
  Object.assign(SoundInstance.prototype, {
    play: function () {
      if (this._state !== STATE_STOPPED) {
        this.stop();
      }
      if (!this.source) {
        if (!this._createSource()) {
          return false;
        }
      }
      this.volume = this._volume;
      this.pitch = this._pitch;
      this.loop = this._loop;
      this.source.play();
      this._state = STATE_PLAYING;
      this._playWhenLoaded = false;
      this._manager.on('volumechange', this._onManagerVolumeChange, this);
      this._manager.on('suspend', this._onManagerSuspend, this);
      this._manager.on('resume', this._onManagerResume, this);
      this._manager.on('destroy', this._onManagerDestroy, this);

      // suspend immediately if manager is suspended
      if (this._manager.suspended) this._onManagerSuspend();
      if (!this._suspendInstanceEvents) this._onPlay();
      return true;
    },
    pause: function () {
      if (!this.source || this._state !== STATE_PLAYING) return false;
      this._suspendEndEvent++;
      this.source.pause();
      this._playWhenLoaded = false;
      this._state = STATE_PAUSED;
      this._startOffset = null;
      if (!this._suspendInstanceEvents) this._onPause();
      return true;
    },
    resume: function () {
      if (!this.source || this._state !== STATE_PAUSED) return false;
      this._state = STATE_PLAYING;
      this._playWhenLoaded = false;
      if (this.source.paused) {
        this.source.play();
        if (!this._suspendInstanceEvents) this._onResume();
      }
      return true;
    },
    stop: function () {
      if (!this.source || this._state === STATE_STOPPED) return false;
      this._manager.off('volumechange', this._onManagerVolumeChange, this);
      this._manager.off('suspend', this._onManagerSuspend, this);
      this._manager.off('resume', this._onManagerResume, this);
      this._manager.off('destroy', this._onManagerDestroy, this);
      this._suspendEndEvent++;
      this.source.pause();
      this._playWhenLoaded = false;
      this._state = STATE_STOPPED;
      this._startOffset = null;
      if (!this._suspendInstanceEvents) this._onStop();
      return true;
    },
    setExternalNodes: function () {
      // not supported
    },
    clearExternalNodes: function () {
      // not supported
    },
    getExternalNodes: function () {
      // not supported but return same type of result
      return [null, null];
    },
    // Sets start time after loadedmetadata is fired which is required by most browsers
    _onLoadedMetadata: function () {
      this.source.removeEventListener('loadedmetadata', this._loadedMetadataHandler);
      this._isReady = true;

      // calculate start time for source
      let offset = capTime(this._startOffset, this.duration);
      offset = capTime(this._startTime + offset, this._sound.duration);
      // reset currentTime
      this._startOffset = null;

      // set offset on source
      this.source.currentTime = offset;
    },
    _createSource: function () {
      if (this._sound && this._sound.audio) {
        this._isReady = false;
        this.source = this._sound.audio.cloneNode(true);

        // set events
        this.source.addEventListener('loadedmetadata', this._loadedMetadataHandler);
        this.source.addEventListener('timeupdate', this._timeUpdateHandler);
        this.source.onended = this._endedHandler;
      }
      return this.source;
    },
    // called every time the 'currentTime' is changed
    _onTimeUpdate: function () {
      if (!this._duration) return;

      // if the currentTime passes the end then if looping go back to the beginning
      // otherwise manually stop
      if (this.source.currentTime > capTime(this._startTime + this._duration, this.source.duration)) {
        if (this.loop) {
          this.source.currentTime = capTime(this._startTime, this.source.duration);
        } else {
          // remove listener to prevent multiple calls
          this.source.removeEventListener('timeupdate', this._timeUpdateHandler);
          this.source.pause();

          // call this manually because it doesn't work in all browsers in this case
          this._onEnded();
        }
      }
    },
    _onManagerDestroy: function () {
      if (this.source) {
        this.source.pause();
      }
    }
  });
  Object.defineProperty(SoundInstance.prototype, 'volume', {
    get: function () {
      return this._volume;
    },
    set: function (volume) {
      volume = math.clamp(volume, 0, 1);
      this._volume = volume;
      if (this.source) {
        this.source.volume = volume * this._manager.volume;
      }
    }
  });
  Object.defineProperty(SoundInstance.prototype, 'pitch', {
    get: function () {
      return this._pitch;
    },
    set: function (pitch) {
      this._pitch = Math.max(Number(pitch) || 0, 0.01);
      if (this.source) {
        this.source.playbackRate = this._pitch;
      }
    }
  });
  Object.defineProperty(SoundInstance.prototype, 'sound', {
    get: function () {
      return this._sound;
    },
    set: function (value) {
      this.stop();
      this._sound = value;
    }
  });
  Object.defineProperty(SoundInstance.prototype, 'currentTime', {
    get: function () {
      if (this._startOffset !== null) {
        return this._startOffset;
      }
      if (this._state === STATE_STOPPED || !this.source) {
        return 0;
      }
      return this.source.currentTime - this._startTime;
    },
    set: function (value) {
      if (value < 0) return;
      this._startOffset = value;
      if (this.source && this._isReady) {
        this.source.currentTime = capTime(this._startTime + capTime(value, this.duration), this._sound.duration);
        this._startOffset = null;
      }
    }
  });
}

export { SoundInstance };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFuY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9zb3VuZC9pbnN0YW5jZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQgeyBoYXNBdWRpb0NvbnRleHQgfSBmcm9tICcuLi9hdWRpby9jYXBhYmlsaXRpZXMuanMnO1xuXG5jb25zdCBTVEFURV9QTEFZSU5HID0gMDtcbmNvbnN0IFNUQVRFX1BBVVNFRCA9IDE7XG5jb25zdCBTVEFURV9TVE9QUEVEID0gMjtcblxuLyoqXG4gKiBSZXR1cm4gdGltZSAlIGR1cmF0aW9uIGJ1dCBhbHdheXMgcmV0dXJuIGEgbnVtYmVyIGluc3RlYWQgb2YgTmFOIHdoZW4gZHVyYXRpb24gaXMgMC5cbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZSAtIFRoZSB0aW1lLlxuICogQHBhcmFtIHtudW1iZXJ9IGR1cmF0aW9uIC0gVGhlIGR1cmF0aW9uLlxuICogQHJldHVybnMge251bWJlcn0gVGhlIHRpbWUgJSBkdXJhdGlvbi5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gY2FwVGltZSh0aW1lLCBkdXJhdGlvbikge1xuICAgIHJldHVybiAodGltZSAlIGR1cmF0aW9uKSB8fCAwO1xufVxuXG4vKipcbiAqIEEgU291bmRJbnN0YW5jZSBwbGF5cyBhIHtAbGluayBTb3VuZH0uXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBTb3VuZEluc3RhbmNlIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBzb3VyY2UgdGhhdCBwbGF5cyB0aGUgc291bmQgcmVzb3VyY2UuIElmIHRoZSBXZWIgQXVkaW8gQVBJIGlzIG5vdCBzdXBwb3J0ZWQgdGhlXG4gICAgICogdHlwZSBvZiBzb3VyY2UgaXMgW0F1ZGlvXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9IVE1ML0VsZW1lbnQvYXVkaW8pLlxuICAgICAqIFNvdXJjZSBpcyBvbmx5IGF2YWlsYWJsZSBhZnRlciBjYWxsaW5nIHBsYXkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXVkaW9CdWZmZXJTb3VyY2VOb2RlfVxuICAgICAqL1xuICAgIHNvdXJjZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU291bmRJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21hbmFnZXIuanMnKS5Tb3VuZE1hbmFnZXJ9IG1hbmFnZXIgLSBUaGUgc291bmQgbWFuYWdlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zb3VuZC5qcycpLlNvdW5kfSBzb3VuZCAtIFRoZSBzb3VuZCB0byBwbGF5LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gT3B0aW9ucyBmb3IgdGhlIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy52b2x1bWU9MV0gLSBUaGUgcGxheWJhY2sgdm9sdW1lLCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnBpdGNoPTFdIC0gVGhlIHJlbGF0aXZlIHBpdGNoLCBkZWZhdWx0IG9mIDEsIHBsYXlzIGF0IG5vcm1hbCBwaXRjaC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmxvb3A9ZmFsc2VdIC0gV2hldGhlciB0aGUgc291bmQgc2hvdWxkIGxvb3Agd2hlbiBpdCByZWFjaGVzIHRoZVxuICAgICAqIGVuZCBvciBub3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0VGltZT0wXSAtIFRoZSB0aW1lIGZyb20gd2hpY2ggdGhlIHBsYXliYWNrIHdpbGwgc3RhcnQgaW5cbiAgICAgKiBzZWNvbmRzLiBEZWZhdWx0IGlzIDAgdG8gc3RhcnQgYXQgdGhlIGJlZ2lubmluZy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZHVyYXRpb249MF0gLSBUaGUgdG90YWwgdGltZSBhZnRlciB0aGUgc3RhcnRUaW1lIGluIHNlY29uZHMgd2hlblxuICAgICAqIHBsYXliYWNrIHdpbGwgc3RvcCBvciByZXN0YXJ0IGlmIGxvb3AgaXMgdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblBsYXk9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2Ugc3RhcnRzIHBsYXlpbmcuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25QYXVzZT1udWxsXSAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyBwYXVzZWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25SZXN1bWU9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgcmVzdW1lZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblN0b3A9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgc3RvcHBlZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vbkVuZD1udWxsXSAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBpbnN0YW5jZSBlbmRzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIsIHNvdW5kLCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdm9sdW1lID0gb3B0aW9ucy52b2x1bWUgIT09IHVuZGVmaW5lZCA/IG1hdGguY2xhbXAoTnVtYmVyKG9wdGlvbnMudm9sdW1lKSB8fCAwLCAwLCAxKSA6IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9waXRjaCA9IG9wdGlvbnMucGl0Y2ggIT09IHVuZGVmaW5lZCA/IE1hdGgubWF4KDAuMDEsIE51bWJlcihvcHRpb25zLnBpdGNoKSB8fCAwKSA6IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhKG9wdGlvbnMubG9vcCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5sb29wIDogZmFsc2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3NvdW5kLmpzJykuU291bmR9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zb3VuZCA9IHNvdW5kO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdGFydCBhdCAnc3RvcHBlZCcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1NUT1BQRUQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRydWUgaWYgdGhlIG1hbmFnZXIgd2FzIHN1c3BlbmRlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdXNwZW5kZWQgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogR3JlYXRlciB0aGFuIDAgaWYgd2Ugd2FudCB0byBzdXNwZW5kIHRoZSBldmVudCBoYW5kbGVkIHRvIHRoZSAnb25lbmRlZCcgZXZlbnQuXG4gICAgICAgICAqIFdoZW4gYW4gJ29uZW5kZWQnIGV2ZW50IGlzIHN1c3BlbmRlZCwgdGhpcyBjb3VudGVyIGlzIGRlY3JlbWVudGVkIGJ5IDEuXG4gICAgICAgICAqIFdoZW4gYSBmdXR1cmUgJ29uZW5kZWQnIGV2ZW50IGlzIHRvIGJlIHN1c3BlbmRlZCwgdGhpcyBjb3VudGVyIGlzIGluY3JlbWVudGVkIGJ5IDEuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdXNwZW5kRW5kRXZlbnQgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHdlIHdhbnQgdG8gc3VzcGVuZCBmaXJpbmcgaW5zdGFuY2UgZXZlbnRzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cyA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiB0cnVlIHRoZW4gdGhlIGluc3RhbmNlIHdpbGwgc3RhcnQgcGxheWluZyBpdHMgc291cmNlIHdoZW4gaXRzIGNyZWF0ZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3RhcnRUaW1lID0gTWF0aC5tYXgoMCwgTnVtYmVyKG9wdGlvbnMuc3RhcnRUaW1lKSB8fCAwKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2R1cmF0aW9uID0gTWF0aC5tYXgoMCwgTnVtYmVyKG9wdGlvbnMuZHVyYXRpb24pIHx8IDApO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgLy8gZXh0ZXJuYWwgZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX29uUGxheUNhbGxiYWNrID0gb3B0aW9ucy5vblBsYXk7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vblBhdXNlQ2FsbGJhY2sgPSBvcHRpb25zLm9uUGF1c2U7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vblJlc3VtZUNhbGxiYWNrID0gb3B0aW9ucy5vblJlc3VtZTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX29uU3RvcENhbGxiYWNrID0gb3B0aW9ucy5vblN0b3A7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vbkVuZENhbGxiYWNrID0gb3B0aW9ucy5vbkVuZDtcblxuICAgICAgICBpZiAoaGFzQXVkaW9Db250ZXh0KCkpIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0ZWRBdCA9IDA7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogTWFudWFsbHkga2VlcCB0cmFjayBvZiB0aGUgcGxheWJhY2sgcG9zaXRpb24gYmVjYXVzZSB0aGUgV2ViIEF1ZGlvIEFQSSBkb2VzIG5vdFxuICAgICAgICAgICAgICogcHJvdmlkZSBhIHdheSB0byBkbyB0aGlzIGFjY3VyYXRlbHkgaWYgdGhlIHBsYXliYWNrUmF0ZSBpcyBub3QgMS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSAwO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgaW5wdXQgbm9kZSBpcyB0aGUgb25lIHRoYXQgaXMgY29ubmVjdGVkIHRvIHRoZSBzb3VyY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0F1ZGlvTm9kZXxudWxsfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5faW5wdXROb2RlID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgY29ubmVjdGVkIG5vZGUgaXMgdGhlIG9uZSB0aGF0IGlzIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb24gKHNwZWFrZXJzKS4gQW55XG4gICAgICAgICAgICAgKiBleHRlcm5hbCBub2RlcyB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGlzIG5vZGUuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0F1ZGlvTm9kZXxudWxsfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGZpcnN0IGV4dGVybmFsIG5vZGUgc2V0IGJ5IGEgdXNlci5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7QXVkaW9Ob2RlfG51bGx9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBsYXN0IGV4dGVybmFsIG5vZGUgc2V0IGJ5IGEgdXNlci5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7QXVkaW9Ob2RlfG51bGx9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogU2V0IHRvIHRydWUgaWYgYSBwbGF5KCkgcmVxdWVzdCB3YXMgaXNzdWVkIHdoZW4gdGhlIEF1ZGlvQ29udGV4dCB3YXMgc3RpbGwgc3VzcGVuZGVkLFxuICAgICAgICAgICAgICogYW5kIHdpbGwgdGhlcmVmb3JlIHdhaXQgdW50aWwgaXQgaXMgcmVzdW1lZCB0byBwbGF5IHRoZSBhdWRpby5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbiA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplTm9kZXMoKTtcblxuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl9lbmRlZEhhbmRsZXIgPSB0aGlzLl9vbkVuZGVkLmJpbmQodGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgICAgIHRoaXMuX2lzUmVhZHkgPSBmYWxzZTtcblxuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl9sb2FkZWRNZXRhZGF0YUhhbmRsZXIgPSB0aGlzLl9vbkxvYWRlZE1ldGFkYXRhLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgICAgIHRoaXMuX3RpbWVVcGRhdGVIYW5kbGVyID0gdGhpcy5fb25UaW1lVXBkYXRlLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgICAgIHRoaXMuX2VuZGVkSGFuZGxlciA9IHRoaXMuX29uRW5kZWQuYmluZCh0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBpbnN0YW5jZSBzdGFydHMgcGxheWluZyBpdHMgc291cmNlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kSW5zdGFuY2UjcGxheVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kSW5zdGFuY2UjcGF1c2VcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluc3RhbmNlIGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRJbnN0YW5jZSNyZXN1bWVcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluc3RhbmNlIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRJbnN0YW5jZSNzdG9wXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBzb3VuZCBjdXJyZW50bHkgcGxheWVkIGJ5IHRoZSBpbnN0YW5jZSBlbmRzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kSW5zdGFuY2UjZW5kXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBHZXRzIG9yIHNldHMgdGhlIGN1cnJlbnQgdGltZSBvZiB0aGUgc291bmQgdGhhdCBpcyBwbGF5aW5nLiBJZiB0aGUgdmFsdWUgcHJvdmlkZWQgaXMgYmlnZ2VyXG4gICAgICogdGhhbiB0aGUgZHVyYXRpb24gb2YgdGhlIGluc3RhbmNlIGl0IHdpbGwgd3JhcCBmcm9tIHRoZSBiZWdpbm5pbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjdXJyZW50VGltZSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgPCAwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HKSB7XG4gICAgICAgICAgICBjb25zdCBzdXNwZW5kID0gdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzO1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gc3RvcCBmaXJzdCB3aGljaCB3aWxsIHNldCBfc3RhcnRPZmZzZXQgdG8gbnVsbFxuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG5cbiAgICAgICAgICAgIC8vIHNldCBfc3RhcnRPZmZzZXQgYW5kIHBsYXlcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cyA9IHN1c3BlbmQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBzZXQgX3N0YXJ0T2Zmc2V0IHdoaWNoIHdpbGwgYmUgdXNlZCB3aGVuIHRoZSBpbnN0YW5jZSB3aWxsIHN0YXJ0IHBsYXlpbmdcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gdmFsdWU7XG4gICAgICAgICAgICAvLyBzZXQgX2N1cnJlbnRUaW1lXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50VGltZSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGN1cnJlbnRUaW1lKCkge1xuICAgICAgICAvLyBpZiB0aGUgdXNlciBoYXMgc2V0IHRoZSBjdXJyZW50VGltZSBhbmQgd2UgaGF2ZSBub3QgdXNlZCBpdCB5ZXRcbiAgICAgICAgLy8gdGhlbiBqdXN0IHJldHVybiB0aGF0XG4gICAgICAgIGlmICh0aGlzLl9zdGFydE9mZnNldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0T2Zmc2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIHNvdW5kIGlzIHBhdXNlZCByZXR1cm4gdGhlIGN1cnJlbnRUaW1lIGNhbGN1bGF0ZWQgd2hlblxuICAgICAgICAvLyBwYXVzZSgpIHdhcyBjYWxsZWRcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9QQVVTRUQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jdXJyZW50VGltZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBzb3VuZCBpcyBzdG9wcGVkIG9yIHdlIGRvbid0IGhhdmUgYSBzb3VyY2VcbiAgICAgICAgLy8gcmV0dXJuIDBcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9TVE9QUEVEIHx8ICF0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWNhbGN1bGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgICAgdGhpcy5fdXBkYXRlQ3VycmVudFRpbWUoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkdXJhdGlvbiBvZiB0aGUgc291bmQgdGhhdCB0aGUgaW5zdGFuY2Ugd2lsbCBwbGF5IHN0YXJ0aW5nIGZyb20gc3RhcnRUaW1lLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZHVyYXRpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZHVyYXRpb24gPSBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUpIHx8IDApO1xuXG4gICAgICAgIC8vIHJlc3RhcnRcbiAgICAgICAgY29uc3QgaXNQbGF5aW5nID0gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICBpZiAoaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBkdXJhdGlvbigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zb3VuZCkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FwVGltZSh0aGlzLl9kdXJhdGlvbiwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3VuZC5kdXJhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGluc3RhbmNlIGlzIGN1cnJlbnRseSBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQYXVzZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUEFVU0VEO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgaW5zdGFuY2UgaXMgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQbGF5aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBpbnN0YW5jZSBpcyBjdXJyZW50bHkgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1N0b3BwZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGluc3RhbmNlIGlzIGN1cnJlbnRseSBzdXNwZW5kZWQgYmVjYXVzZSB0aGUgd2luZG93IGlzIG5vdCBmb2N1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzU3VzcGVuZGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VzcGVuZGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGluc3RhbmNlIHdpbGwgcmVzdGFydCB3aGVuIGl0IGZpbmlzaGVzIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbG9vcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9sb29wID0gISF2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsb29wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGl0Y2ggbW9kaWZpZXIgdG8gcGxheSB0aGUgc291bmQgd2l0aC4gTXVzdCBiZSBsYXJnZXIgdGhhbiAwLjAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcGl0Y2gocGl0Y2gpIHtcbiAgICAgICAgLy8gc2V0IG9mZnNldCB0byBjdXJyZW50IHRpbWUgc28gdGhhdFxuICAgICAgICAvLyB3ZSBjYWxjdWxhdGUgdGhlIHJlc3Qgb2YgdGhlIHRpbWUgd2l0aCB0aGUgbmV3IHBpdGNoXG4gICAgICAgIC8vIGZyb20gbm93IG9uXG4gICAgICAgIHRoaXMuX2N1cnJlbnRPZmZzZXQgPSB0aGlzLmN1cnJlbnRUaW1lO1xuICAgICAgICB0aGlzLl9zdGFydGVkQXQgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3VycmVudFRpbWU7XG5cbiAgICAgICAgdGhpcy5fcGl0Y2ggPSBNYXRoLm1heChOdW1iZXIocGl0Y2gpIHx8IDAsIDAuMDEpO1xuICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnBsYXliYWNrUmF0ZS52YWx1ZSA9IHRoaXMuX3BpdGNoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHBpdGNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGl0Y2g7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHNvdW5kIHJlc291cmNlIHRoYXQgdGhlIGluc3RhbmNlIHdpbGwgcGxheS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc291bmQuanMnKS5Tb3VuZH1cbiAgICAgKi9cbiAgICBzZXQgc291bmQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc291bmQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1NUT1BQRUQpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc291bmQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3VuZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhcnQgdGltZSBmcm9tIHdoaWNoIHRoZSBzb3VuZCB3aWxsIHN0YXJ0IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzdGFydFRpbWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc3RhcnRUaW1lID0gTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlKSB8fCAwKTtcblxuICAgICAgICAvLyByZXN0YXJ0XG4gICAgICAgIGNvbnN0IGlzUGxheWluZyA9IHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HO1xuICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgaWYgKGlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3RhcnRUaW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhcnRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB2b2x1bWUgbW9kaWZpZXIgdG8gcGxheSB0aGUgc291bmQgd2l0aC4gSW4gcmFuZ2UgMC0xLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgdm9sdW1lKHZvbHVtZSkge1xuICAgICAgICB2b2x1bWUgPSBtYXRoLmNsYW1wKHZvbHVtZSwgMCwgMSk7XG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgaWYgKHRoaXMuZ2Fpbikge1xuICAgICAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSB2b2x1bWUgKiB0aGlzLl9tYW5hZ2VyLnZvbHVtZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB2b2x1bWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92b2x1bWU7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uUGxheSgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdwbGF5Jyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uUGxheUNhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25QbGF5Q2FsbGJhY2sodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uUGF1c2UoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncGF1c2UnKTtcblxuICAgICAgICBpZiAodGhpcy5fb25QYXVzZUNhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25QYXVzZUNhbGxiYWNrKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblJlc3VtZSgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdyZXN1bWUnKTtcblxuICAgICAgICBpZiAodGhpcy5fb25SZXN1bWVDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uUmVzdW1lQ2FsbGJhY2sodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU3RvcCgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdzdG9wJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uU3RvcENhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25TdG9wQ2FsbGJhY2sodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uRW5kZWQoKSB7XG4gICAgICAgIC8vIHRoZSBjYWxsYmFjayBpcyBub3QgZmlyZWQgc3luY2hyb25vdXNseVxuICAgICAgICAvLyBzbyBvbmx5IGRlY3JlbWVudCBfc3VzcGVuZEVuZEV2ZW50IHdoZW4gdGhlXG4gICAgICAgIC8vIGNhbGxiYWNrIGlzIGZpcmVkXG4gICAgICAgIGlmICh0aGlzLl9zdXNwZW5kRW5kRXZlbnQgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kRW5kRXZlbnQtLTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnZW5kJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uRW5kQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9vbkVuZENhbGxiYWNrKHRoaXMpO1xuXG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmRsZSB0aGUgbWFuYWdlcidzICd2b2x1bWVjaGFuZ2UnIGV2ZW50LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYW5hZ2VyVm9sdW1lQ2hhbmdlKCkge1xuICAgICAgICB0aGlzLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAnc3VzcGVuZCcgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hbmFnZXJTdXNwZW5kKCkge1xuICAgICAgICBpZiAodGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkcgJiYgIXRoaXMuX3N1c3BlbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMucGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmRsZSB0aGUgbWFuYWdlcidzICdyZXN1bWUnIGV2ZW50LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYW5hZ2VyUmVzdW1lKCkge1xuICAgICAgICBpZiAodGhpcy5fc3VzcGVuZGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMucmVzdW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGludGVybmFsIGF1ZGlvIG5vZGVzIGFuZCBjb25uZWN0cyB0aGVtLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW5pdGlhbGl6ZU5vZGVzKCkge1xuICAgICAgICAvLyBjcmVhdGUgZ2FpbiBub2RlIGZvciB2b2x1bWUgY29udHJvbFxuICAgICAgICB0aGlzLmdhaW4gPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLl9pbnB1dE5vZGUgPSB0aGlzLmdhaW47XG4gICAgICAgIC8vIHRoZSBnYWluIG5vZGUgaXMgYWxzbyB0aGUgY29ubmVjdG9yIG5vZGUgZm9yIDJEIHNvdW5kIGluc3RhbmNlc1xuICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlID0gdGhpcy5nYWluO1xuICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmNvbm5lY3QodGhpcy5fbWFuYWdlci5jb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0IHRvIGJlZ2luIHBsYXliYWNrIHRoZSBzb3VuZC5cbiAgICAgKiBJZiB0aGUgQXVkaW9Db250ZXh0IGlzIHN1c3BlbmRlZCwgdGhlIGF1ZGlvIHdpbGwgb25seSBzdGFydCBvbmNlIGl0J3MgcmVzdW1lZC5cbiAgICAgKiBJZiB0aGUgc291bmQgaXMgYWxyZWFkeSBwbGF5aW5nLCB0aGlzIHdpbGwgcmVzdGFydCB0aGUgc291bmQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc291bmQgd2FzIHN0YXJ0ZWQgaW1tZWRpYXRlbHkuXG4gICAgICovXG4gICAgcGxheSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9TVE9QUEVEKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgc3RhdGUgdG8gcGxheWluZ1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgIC8vIG5vIG5lZWQgZm9yIHRoaXMgYW55bW9yZVxuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHBsYXkoKSB3YXMgYWxyZWFkeSBpc3N1ZWQgYnV0IGhhc24ndCBhY3R1YWxseSBzdGFydGVkIHlldFxuICAgICAgICBpZiAodGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYW5hZ2VyIGlzIHN1c3BlbmRlZCBzbyBhdWRpbyBjYW5ub3Qgc3RhcnQgbm93IC0gd2FpdCBmb3IgbWFuYWdlciB0byByZXN1bWVcbiAgICAgICAgaWYgKHRoaXMuX21hbmFnZXIuc3VzcGVuZGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uY2UoJ3Jlc3VtZScsIHRoaXMuX3BsYXlBdWRpb0ltbWVkaWF0ZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24gPSB0cnVlO1xuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wbGF5QXVkaW9JbW1lZGlhdGUoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbW1lZGlhdGVseSBwbGF5IHRoZSBzb3VuZC5cbiAgICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoZSBBdWRpb0NvbnRleHQgaXMgcmVhZHkgKG5vdCBzdXNwZW5kZWQgb3IgbG9ja2VkKS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BsYXlBdWRpb0ltbWVkaWF0ZSgpIHtcbiAgICAgICAgdGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYmV0d2VlbiBwbGF5KCkgYW5kIHRoZSBtYW5hZ2VyIGJlaW5nIHJlYWR5IHRvIHBsYXksIGEgc3RvcCgpIG9yIHBhdXNlKCkgY2FsbCB3YXMgbWFkZVxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdXJjZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIHN0YXJ0IG9mZnNldFxuICAgICAgICBsZXQgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydE9mZnNldCwgdGhpcy5kdXJhdGlvbik7XG4gICAgICAgIG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgb2Zmc2V0LCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG4gICAgICAgIC8vIHJlc2V0IHN0YXJ0IG9mZnNldCBub3cgdGhhdCB3ZSBzdGFydGVkIHRoZSBzb3VuZFxuICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgLy8gc3RhcnQgc291cmNlIHdpdGggc3BlY2lmaWVkIG9mZnNldCBhbmQgZHVyYXRpb25cbiAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwLCBvZmZzZXQsIHRoaXMuX2R1cmF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXNldCB0aW1lc1xuICAgICAgICB0aGlzLl9zdGFydGVkQXQgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IG9mZnNldDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHZvbHVtZSBhbmQgbG9vcCAtIG5vdGUgbW92ZWQgdG8gYmUgYWZ0ZXIgc3RhcnQoKSBiZWNhdXNlIG9mIENocm9tZSBidWdcbiAgICAgICAgdGhpcy52b2x1bWUgPSB0aGlzLl92b2x1bWU7XG4gICAgICAgIHRoaXMubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIHRoaXMucGl0Y2ggPSB0aGlzLl9waXRjaDtcblxuICAgICAgICAvLyBoYW5kbGUgc3VzcGVuZCBldmVudHMgLyB2b2x1bWVjaGFuZ2UgZXZlbnRzXG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3ZvbHVtZWNoYW5nZScsIHRoaXMuX29uTWFuYWdlclZvbHVtZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3N1c3BlbmQnLCB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vbigncmVzdW1lJywgdGhpcy5fb25NYW5hZ2VyUmVzdW1lLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vbignZGVzdHJveScsIHRoaXMuX29uTWFuYWdlckRlc3Ryb3ksIHRoaXMpO1xuXG4gICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKSB7XG4gICAgICAgICAgICB0aGlzLl9vblBsYXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyBwbGF5YmFjayBvZiBzb3VuZC4gQ2FsbCByZXN1bWUoKSB0byByZXN1bWUgcGxheWJhY2sgZnJvbSB0aGUgc2FtZSBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHNvdW5kIHdhcyBwYXVzZWQuXG4gICAgICovXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIC8vIG5vIG5lZWQgZm9yIHRoaXMgYW55bW9yZVxuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfUExBWUlORylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBzZXQgc3RhdGUgdG8gcGF1c2VkXG4gICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUEFVU0VEO1xuXG4gICAgICAgIC8vIHBsYXkoKSB3YXMgaXNzdWVkIGJ1dCBoYXNuJ3QgYWN0dWFsbHkgc3RhcnRlZCB5ZXQuXG4gICAgICAgIGlmICh0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcmUgY3VycmVudCB0aW1lXG4gICAgICAgIHRoaXMuX3VwZGF0ZUN1cnJlbnRUaW1lKCk7XG5cbiAgICAgICAgLy8gU3RvcCB0aGUgc291cmNlIGFuZCByZS1jcmVhdGUgaXQgYmVjYXVzZSB3ZSBjYW5ub3QgcmV1c2UgdGhlIHNhbWUgc291cmNlLlxuICAgICAgICAvLyBTdXNwZW5kIHRoZSBlbmQgZXZlbnQgYXMgd2UgYXJlIG1hbnVhbGx5IHN0b3BwaW5nIHRoZSBzb3VyY2VcbiAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50Kys7XG4gICAgICAgIHRoaXMuc291cmNlLnN0b3AoMCk7XG4gICAgICAgIHRoaXMuc291cmNlID0gbnVsbDtcblxuICAgICAgICAvLyByZXNldCB1c2VyLXNldCBzdGFydCBvZmZzZXRcbiAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgdGhpcy5fb25QYXVzZSgpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgcGxheWJhY2sgb2YgdGhlIHNvdW5kLiBQbGF5YmFjayByZXN1bWVzIGF0IHRoZSBwb2ludCB0aGF0IHRoZSBhdWRpbyB3YXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgc291bmQgd2FzIHJlc3VtZWQuXG4gICAgICovXG4gICAgcmVzdW1lKCkge1xuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1BBVVNFRCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RhcnQgYXQgcG9pbnQgd2hlcmUgc291bmQgd2FzIHBhdXNlZFxuICAgICAgICBsZXQgb2Zmc2V0ID0gdGhpcy5jdXJyZW50VGltZTtcblxuICAgICAgICAvLyBzZXQgc3RhdGUgYmFjayB0byBwbGF5aW5nXG4gICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUExBWUlORztcblxuICAgICAgICAvLyBwbGF5KCkgd2FzIGlzc3VlZCBidXQgaGFzbid0IGFjdHVhbGx5IHN0YXJ0ZWQgeWV0XG4gICAgICAgIGlmICh0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgdXNlciBzZXQgdGhlICdjdXJyZW50VGltZScgcHJvcGVydHkgd2hpbGUgdGhlIHNvdW5kXG4gICAgICAgIC8vIHdhcyBwYXVzZWQgdGhlbiB1c2UgdGhhdCBhcyB0aGUgb2Zmc2V0IGluc3RlYWRcbiAgICAgICAgaWYgKHRoaXMuX3N0YXJ0T2Zmc2V0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0T2Zmc2V0LCB0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgb2Zmc2V0LCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG5cbiAgICAgICAgICAgIC8vIHJlc2V0IG9mZnNldFxuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RhcnQgc291cmNlXG4gICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgb2Zmc2V0LCB0aGlzLl9kdXJhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwLCBvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gb2Zmc2V0O1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgcGFyYW1ldGVyc1xuICAgICAgICB0aGlzLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgdGhpcy5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgdGhpcy5waXRjaCA9IHRoaXMuX3BpdGNoO1xuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgdGhpcy5fb25SZXN1bWUoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyBwbGF5YmFjayBvZiBzb3VuZC4gQ2FsbGluZyBwbGF5KCkgYWdhaW4gd2lsbCByZXN0YXJ0IHBsYXliYWNrIGZyb20gdGhlIGJlZ2lubmluZyBvZlxuICAgICAqIHRoZSBzb3VuZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHNvdW5kIHdhcyBzdG9wcGVkLlxuICAgICAqL1xuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9TVE9QUEVEKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIHNldCBzdGF0ZSB0byBzdG9wcGVkXG4gICAgICAgIGNvbnN0IHdhc1BsYXlpbmcgPSB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORztcbiAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9TVE9QUEVEO1xuXG4gICAgICAgIC8vIHBsYXkoKSB3YXMgaXNzdWVkIGJ1dCBoYXNuJ3QgYWN0dWFsbHkgc3RhcnRlZCB5ZXRcbiAgICAgICAgaWYgKHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIG1hbmFnZXIgZXZlbnRzXG4gICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZignc3VzcGVuZCcsIHRoaXMuX29uTWFuYWdlclN1c3BlbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZigncmVzdW1lJywgdGhpcy5fb25NYW5hZ2VyUmVzdW1lLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ2Rlc3Ryb3knLCB0aGlzLl9vbk1hbmFnZXJEZXN0cm95LCB0aGlzKTtcblxuICAgICAgICAvLyByZXNldCBzdG9yZWQgdGltZXNcbiAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gMDtcbiAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gMDtcblxuICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50Kys7XG4gICAgICAgIGlmICh3YXNQbGF5aW5nICYmIHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdG9wKDApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc291cmNlID0gbnVsbDtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgIHRoaXMuX29uU3RvcCgpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3RzIGV4dGVybmFsIFdlYiBBdWRpbyBBUEkgbm9kZXMuIFlvdSBuZWVkIHRvIHBhc3MgdGhlIGZpcnN0IG5vZGUgb2YgdGhlIG5vZGUgZ3JhcGhcbiAgICAgKiB0aGF0IHlvdSBjcmVhdGVkIGV4dGVybmFsbHkgYW5kIHRoZSBsYXN0IG5vZGUgb2YgdGhhdCBncmFwaC4gVGhlIGZpcnN0IG5vZGUgd2lsbCBiZVxuICAgICAqIGNvbm5lY3RlZCB0byB0aGUgYXVkaW8gc291cmNlIGFuZCB0aGUgbGFzdCBub2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvbiBvZiB0aGVcbiAgICAgKiBBdWRpb0NvbnRleHQgKGUuZy4gc3BlYWtlcnMpLiBSZXF1aXJlcyBXZWIgQXVkaW8gQVBJIHN1cHBvcnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0F1ZGlvTm9kZX0gZmlyc3ROb2RlIC0gVGhlIGZpcnN0IG5vZGUgdGhhdCB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgYXVkaW8gc291cmNlIG9mIHNvdW5kIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge0F1ZGlvTm9kZX0gW2xhc3ROb2RlXSAtIFRoZSBsYXN0IG5vZGUgdGhhdCB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb24gb2YgdGhlIEF1ZGlvQ29udGV4dC5cbiAgICAgKiBJZiB1bnNwZWNpZmllZCB0aGVuIHRoZSBmaXJzdE5vZGUgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIGluc3RlYWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBjb250ZXh0ID0gYXBwLnN5c3RlbXMuc291bmQuY29udGV4dDtcbiAgICAgKiBjb25zdCBhbmFseXplciA9IGNvbnRleHQuY3JlYXRlQW5hbHl6ZXIoKTtcbiAgICAgKiBjb25zdCBkaXN0b3J0aW9uID0gY29udGV4dC5jcmVhdGVXYXZlU2hhcGVyKCk7XG4gICAgICogY29uc3QgZmlsdGVyID0gY29udGV4dC5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgKiBhbmFseXplci5jb25uZWN0KGRpc3RvcnRpb24pO1xuICAgICAqIGRpc3RvcnRpb24uY29ubmVjdChmaWx0ZXIpO1xuICAgICAqIGluc3RhbmNlLnNldEV4dGVybmFsTm9kZXMoYW5hbHl6ZXIsIGZpbHRlcik7XG4gICAgICovXG4gICAgc2V0RXh0ZXJuYWxOb2RlcyhmaXJzdE5vZGUsIGxhc3ROb2RlKSB7XG4gICAgICAgIGlmICghZmlyc3ROb2RlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUaGUgZmlyc3ROb2RlIG11c3QgYmUgYSB2YWxpZCBBdWRpbyBOb2RlJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWxhc3ROb2RlKSB7XG4gICAgICAgICAgICBsYXN0Tm9kZSA9IGZpcnN0Tm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvbm5lY3Rpb25zIGFyZTpcbiAgICAgICAgLy8gc291cmNlIC0+IGlucHV0Tm9kZSAtPiBjb25uZWN0b3JOb2RlIC0+IFtmaXJzdE5vZGUgLT4gLi4uIC0+IGxhc3ROb2RlXSAtPiBzcGVha2Vyc1xuXG4gICAgICAgIGNvbnN0IHNwZWFrZXJzID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmRlc3RpbmF0aW9uO1xuXG4gICAgICAgIGlmICh0aGlzLl9maXJzdE5vZGUgIT09IGZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2ZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIGZpcnN0Tm9kZSBhbHJlYWR5IGV4aXN0cyBtZWFucyB0aGUgY29ubmVjdG9yIG5vZGVcbiAgICAgICAgICAgICAgICAvLyBpcyBjb25uZWN0ZWQgdG8gaXQgc28gZGlzY29ubmVjdCBpdFxuICAgICAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuZGlzY29ubmVjdCh0aGlzLl9maXJzdE5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBmaXJzdE5vZGUgZG9lcyBub3QgZXhpc3QgbWVhbnMgdGhhdCBpdHMgY29ubmVjdGVkXG4gICAgICAgICAgICAgICAgLy8gdG8gdGhlIHNwZWFrZXJzIHNvIGRpc2Nvbm5lY3QgaXRcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmRpc2Nvbm5lY3Qoc3BlYWtlcnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgZmlyc3Qgbm9kZSBhbmQgY29ubmVjdCB3aXRoIGNvbm5lY3RvciBub2RlXG4gICAgICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBmaXJzdE5vZGU7XG4gICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmNvbm5lY3QoZmlyc3ROb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9sYXN0Tm9kZSAhPT0gbGFzdE5vZGUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9sYXN0Tm9kZSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIGxhc3Qgbm9kZSBleGlzdHMgbWVhbnMgaXQncyBjb25uZWN0ZWQgdG8gdGhlIHNwZWFrZXJzIHNvIGRpc2Nvbm5lY3QgaXRcbiAgICAgICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZS5kaXNjb25uZWN0KHNwZWFrZXJzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGxhc3Qgbm9kZSBhbmQgY29ubmVjdCB3aXRoIHNwZWFrZXJzXG4gICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IGxhc3ROb2RlO1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUuY29ubmVjdChzcGVha2Vycyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgYW55IGV4dGVybmFsIG5vZGVzIHNldCBieSB7QGxpbmsgU291bmRJbnN0YW5jZSNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKi9cbiAgICBjbGVhckV4dGVybmFsTm9kZXMoKSB7XG4gICAgICAgIGNvbnN0IHNwZWFrZXJzID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmRlc3RpbmF0aW9uO1xuXG4gICAgICAgIC8vIGJyZWFrIGV4aXN0aW5nIGNvbm5lY3Rpb25zXG4gICAgICAgIGlmICh0aGlzLl9maXJzdE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuZGlzY29ubmVjdCh0aGlzLl9maXJzdE5vZGUpO1xuICAgICAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9sYXN0Tm9kZSkge1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUuZGlzY29ubmVjdChzcGVha2Vycyk7XG4gICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXNldCBjb25uZWN0IHRvIHNwZWFrZXJzXG4gICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuY29ubmVjdChzcGVha2Vycyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBhbnkgZXh0ZXJuYWwgbm9kZXMgc2V0IGJ5IHtAbGluayBTb3VuZEluc3RhbmNlI3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge0F1ZGlvTm9kZVtdfSBSZXR1cm5zIGFuIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHR3byBub2RlcyBzZXQgYnlcbiAgICAgKiB7QGxpbmsgU291bmRJbnN0YW5jZSNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKi9cbiAgICBnZXRFeHRlcm5hbE5vZGVzKCkge1xuICAgICAgICByZXR1cm4gW3RoaXMuX2ZpcnN0Tm9kZSwgdGhpcy5fbGFzdE5vZGVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgdGhlIHNvdXJjZSBmb3IgdGhlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0F1ZGlvQnVmZmVyU291cmNlTm9kZXxudWxsfSBSZXR1cm5zIHRoZSBjcmVhdGVkIHNvdXJjZSBvciBudWxsIGlmIHRoZSBzb3VuZFxuICAgICAqIGluc3RhbmNlIGhhcyBubyB7QGxpbmsgU291bmR9IGFzc29jaWF0ZWQgd2l0aCBpdC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jcmVhdGVTb3VyY2UoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc291bmQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29udGV4dCA9IHRoaXMuX21hbmFnZXIuY29udGV4dDtcblxuICAgICAgICBpZiAodGhpcy5fc291bmQuYnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IGNvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5idWZmZXIgPSB0aGlzLl9zb3VuZC5idWZmZXI7XG5cbiAgICAgICAgICAgIC8vIENvbm5lY3QgdXAgdGhlIG5vZGVzXG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5jb25uZWN0KHRoaXMuX2lucHV0Tm9kZSk7XG5cbiAgICAgICAgICAgIC8vIHNldCBldmVudHNcbiAgICAgICAgICAgIHRoaXMuc291cmNlLm9uZW5kZWQgPSB0aGlzLl9lbmRlZEhhbmRsZXI7XG5cbiAgICAgICAgICAgIC8vIHNldCBsb29wU3RhcnQgYW5kIGxvb3BFbmQgc28gdGhhdCB0aGUgc291cmNlIHN0YXJ0cyBhbmQgZW5kcyBhdCB0aGUgY29ycmVjdCB1c2VyLXNldCB0aW1lc1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UubG9vcFN0YXJ0ID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUsIHRoaXMuc291cmNlLmJ1ZmZlci5kdXJhdGlvbik7XG4gICAgICAgICAgICBpZiAodGhpcy5fZHVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5sb29wRW5kID0gTWF0aC5tYXgodGhpcy5zb3VyY2UubG9vcFN0YXJ0LCBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIHRoaXMuX2R1cmF0aW9uLCB0aGlzLnNvdXJjZS5idWZmZXIuZHVyYXRpb24pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLnNvdXJjZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjdXJyZW50IHRpbWUgdGFraW5nIGludG8gYWNjb3VudCB0aGUgdGltZSB0aGUgaW5zdGFuY2Ugc3RhcnRlZCBwbGF5aW5nLCB0aGUgY3VycmVudFxuICAgICAqIHBpdGNoIGFuZCB0aGUgY3VycmVudCB0aW1lIG9mZnNldC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZUN1cnJlbnRUaW1lKCkge1xuICAgICAgICB0aGlzLl9jdXJyZW50VGltZSA9IGNhcFRpbWUoKHRoaXMuX21hbmFnZXIuY29udGV4dC5jdXJyZW50VGltZSAtIHRoaXMuX3N0YXJ0ZWRBdCkgKiB0aGlzLl9waXRjaCArIHRoaXMuX2N1cnJlbnRPZmZzZXQsIHRoaXMuZHVyYXRpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmRsZSB0aGUgbWFuYWdlcidzICdkZXN0cm95JyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWFuYWdlckRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZSAmJiB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORykge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RvcCgwKTtcbiAgICAgICAgICAgIHRoaXMuc291cmNlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuaWYgKCFoYXNBdWRpb0NvbnRleHQoKSkge1xuICAgIE9iamVjdC5hc3NpZ24oU291bmRJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICAgICAgcGxheTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9TVE9QUEVEKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NyZWF0ZVNvdXJjZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudm9sdW1lID0gdGhpcy5fdm9sdW1lO1xuICAgICAgICAgICAgdGhpcy5waXRjaCA9IHRoaXMuX3BpdGNoO1xuICAgICAgICAgICAgdGhpcy5sb29wID0gdGhpcy5fbG9vcDtcblxuICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheSgpO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QTEFZSU5HO1xuICAgICAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbigndm9sdW1lY2hhbmdlJywgdGhpcy5fb25NYW5hZ2VyVm9sdW1lQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3N1c3BlbmQnLCB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3Jlc3VtZScsIHRoaXMuX29uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdkZXN0cm95JywgdGhpcy5fb25NYW5hZ2VyRGVzdHJveSwgdGhpcyk7XG5cbiAgICAgICAgICAgIC8vIHN1c3BlbmQgaW1tZWRpYXRlbHkgaWYgbWFuYWdlciBpcyBzdXNwZW5kZWRcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYW5hZ2VyLnN1c3BlbmRlZClcbiAgICAgICAgICAgICAgICB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kKCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgICAgIHRoaXMuX29uUGxheSgpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgICB9LFxuXG4gICAgICAgIHBhdXNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc291cmNlIHx8IHRoaXMuX3N0YXRlICE9PSBTVEFURV9QTEFZSU5HKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50Kys7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5wYXVzZSgpO1xuICAgICAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUEFVU0VEO1xuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLl9vblBhdXNlKCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlc3VtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSB8fCB0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfUEFVU0VEKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QTEFZSU5HO1xuICAgICAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZS5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5wbGF5KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb25SZXN1bWUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSB8fCB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3N1c3BlbmQnLCB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdyZXN1bWUnLCB0aGlzLl9vbk1hbmFnZXJSZXN1bWUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ2Rlc3Ryb3knLCB0aGlzLl9vbk1hbmFnZXJEZXN0cm95LCB0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50Kys7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5wYXVzZSgpO1xuICAgICAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfU1RPUFBFRDtcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5fb25TdG9wKCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldEV4dGVybmFsTm9kZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgfSxcblxuICAgICAgICBjbGVhckV4dGVybmFsTm9kZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgfSxcblxuICAgICAgICBnZXRFeHRlcm5hbE5vZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGJ1dCByZXR1cm4gc2FtZSB0eXBlIG9mIHJlc3VsdFxuICAgICAgICAgICAgcmV0dXJuIFtudWxsLCBudWxsXTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBTZXRzIHN0YXJ0IHRpbWUgYWZ0ZXIgbG9hZGVkbWV0YWRhdGEgaXMgZmlyZWQgd2hpY2ggaXMgcmVxdWlyZWQgYnkgbW9zdCBicm93c2Vyc1xuICAgICAgICBfb25Mb2FkZWRNZXRhZGF0YTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLl9sb2FkZWRNZXRhZGF0YUhhbmRsZXIpO1xuXG4gICAgICAgICAgICB0aGlzLl9pc1JlYWR5ID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHN0YXJ0IHRpbWUgZm9yIHNvdXJjZVxuICAgICAgICAgICAgbGV0IG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRPZmZzZXQsIHRoaXMuZHVyYXRpb24pO1xuICAgICAgICAgICAgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyBvZmZzZXQsIHRoaXMuX3NvdW5kLmR1cmF0aW9uKTtcbiAgICAgICAgICAgIC8vIHJlc2V0IGN1cnJlbnRUaW1lXG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIHNldCBvZmZzZXQgb24gc291cmNlXG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5jdXJyZW50VGltZSA9IG9mZnNldDtcbiAgICAgICAgfSxcblxuICAgICAgICBfY3JlYXRlU291cmNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc291bmQgJiYgdGhpcy5fc291bmQuYXVkaW8pIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2lzUmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZSA9IHRoaXMuX3NvdW5kLmF1ZGlvLmNsb25lTm9kZSh0cnVlKTtcblxuICAgICAgICAgICAgICAgIC8vIHNldCBldmVudHNcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIHRoaXMuX2xvYWRlZE1ldGFkYXRhSGFuZGxlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHRoaXMuX3RpbWVVcGRhdGVIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5vbmVuZGVkID0gdGhpcy5fZW5kZWRIYW5kbGVyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gY2FsbGVkIGV2ZXJ5IHRpbWUgdGhlICdjdXJyZW50VGltZScgaXMgY2hhbmdlZFxuICAgICAgICBfb25UaW1lVXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2R1cmF0aW9uKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIGN1cnJlbnRUaW1lIHBhc3NlcyB0aGUgZW5kIHRoZW4gaWYgbG9vcGluZyBnbyBiYWNrIHRvIHRoZSBiZWdpbm5pbmdcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSBtYW51YWxseSBzdG9wXG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UuY3VycmVudFRpbWUgPiBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIHRoaXMuX2R1cmF0aW9uLCB0aGlzLnNvdXJjZS5kdXJhdGlvbikpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLmN1cnJlbnRUaW1lID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUsIHRoaXMuc291cmNlLmR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgbGlzdGVuZXIgdG8gcHJldmVudCBtdWx0aXBsZSBjYWxsc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdGhpcy5fdGltZVVwZGF0ZUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5wYXVzZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbGwgdGhpcyBtYW51YWxseSBiZWNhdXNlIGl0IGRvZXNuJ3Qgd29yayBpbiBhbGwgYnJvd3NlcnMgaW4gdGhpcyBjYXNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uRW5kZWQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgX29uTWFuYWdlckRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnBhdXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwgJ3ZvbHVtZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZvbHVtZSkge1xuICAgICAgICAgICAgdm9sdW1lID0gbWF0aC5jbGFtcCh2b2x1bWUsIDAsIDEpO1xuICAgICAgICAgICAgdGhpcy5fdm9sdW1lID0gdm9sdW1lO1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2Uudm9sdW1lID0gdm9sdW1lICogdGhpcy5fbWFuYWdlci52b2x1bWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwgJ3BpdGNoJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9waXRjaDtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChwaXRjaCkge1xuICAgICAgICAgICAgdGhpcy5fcGl0Y2ggPSBNYXRoLm1heChOdW1iZXIocGl0Y2gpIHx8IDAsIDAuMDEpO1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheWJhY2tSYXRlID0gdGhpcy5fcGl0Y2g7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwgJ3NvdW5kJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zb3VuZDtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9zb3VuZCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwgJ2N1cnJlbnRUaW1lJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zdGFydE9mZnNldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zdGFydE9mZnNldDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9TVE9QUEVEIHx8ICF0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2UuY3VycmVudFRpbWUgLSB0aGlzLl9zdGFydFRpbWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA8IDApIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSAmJiB0aGlzLl9pc1JlYWR5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UuY3VycmVudFRpbWUgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIGNhcFRpbWUodmFsdWUsIHRoaXMuZHVyYXRpb24pLCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmV4cG9ydCB7IFNvdW5kSW5zdGFuY2UgfTtcbiJdLCJuYW1lcyI6WyJTVEFURV9QTEFZSU5HIiwiU1RBVEVfUEFVU0VEIiwiU1RBVEVfU1RPUFBFRCIsImNhcFRpbWUiLCJ0aW1lIiwiZHVyYXRpb24iLCJTb3VuZEluc3RhbmNlIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJtYW5hZ2VyIiwic291bmQiLCJvcHRpb25zIiwic291cmNlIiwiX21hbmFnZXIiLCJfdm9sdW1lIiwidm9sdW1lIiwidW5kZWZpbmVkIiwibWF0aCIsImNsYW1wIiwiTnVtYmVyIiwiX3BpdGNoIiwicGl0Y2giLCJNYXRoIiwibWF4IiwiX2xvb3AiLCJsb29wIiwiX3NvdW5kIiwiX3N0YXRlIiwiX3N1c3BlbmRlZCIsIl9zdXNwZW5kRW5kRXZlbnQiLCJfc3VzcGVuZEluc3RhbmNlRXZlbnRzIiwiX3BsYXlXaGVuTG9hZGVkIiwiX3N0YXJ0VGltZSIsInN0YXJ0VGltZSIsIl9kdXJhdGlvbiIsIl9zdGFydE9mZnNldCIsIl9vblBsYXlDYWxsYmFjayIsIm9uUGxheSIsIl9vblBhdXNlQ2FsbGJhY2siLCJvblBhdXNlIiwiX29uUmVzdW1lQ2FsbGJhY2siLCJvblJlc3VtZSIsIl9vblN0b3BDYWxsYmFjayIsIm9uU3RvcCIsIl9vbkVuZENhbGxiYWNrIiwib25FbmQiLCJoYXNBdWRpb0NvbnRleHQiLCJfc3RhcnRlZEF0IiwiX2N1cnJlbnRUaW1lIiwiX2N1cnJlbnRPZmZzZXQiLCJfaW5wdXROb2RlIiwiX2Nvbm5lY3Rvck5vZGUiLCJfZmlyc3ROb2RlIiwiX2xhc3ROb2RlIiwiX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbiIsIl9pbml0aWFsaXplTm9kZXMiLCJfZW5kZWRIYW5kbGVyIiwiX29uRW5kZWQiLCJiaW5kIiwiX2lzUmVhZHkiLCJfbG9hZGVkTWV0YWRhdGFIYW5kbGVyIiwiX29uTG9hZGVkTWV0YWRhdGEiLCJfdGltZVVwZGF0ZUhhbmRsZXIiLCJfb25UaW1lVXBkYXRlIiwiX2NyZWF0ZVNvdXJjZSIsImN1cnJlbnRUaW1lIiwidmFsdWUiLCJzdXNwZW5kIiwic3RvcCIsInBsYXkiLCJfdXBkYXRlQ3VycmVudFRpbWUiLCJpc1BsYXlpbmciLCJpc1BhdXNlZCIsImlzU3RvcHBlZCIsImlzU3VzcGVuZGVkIiwiY29udGV4dCIsInBsYXliYWNrUmF0ZSIsImdhaW4iLCJfb25QbGF5IiwiZmlyZSIsIl9vblBhdXNlIiwiX29uUmVzdW1lIiwiX29uU3RvcCIsIl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UiLCJfb25NYW5hZ2VyU3VzcGVuZCIsInBhdXNlIiwiX29uTWFuYWdlclJlc3VtZSIsInJlc3VtZSIsImNyZWF0ZUdhaW4iLCJjb25uZWN0IiwiZGVzdGluYXRpb24iLCJzdXNwZW5kZWQiLCJvbmNlIiwiX3BsYXlBdWRpb0ltbWVkaWF0ZSIsIm9mZnNldCIsInN0YXJ0Iiwib24iLCJfb25NYW5hZ2VyRGVzdHJveSIsIndhc1BsYXlpbmciLCJvZmYiLCJzZXRFeHRlcm5hbE5vZGVzIiwiZmlyc3ROb2RlIiwibGFzdE5vZGUiLCJjb25zb2xlIiwiZXJyb3IiLCJzcGVha2VycyIsImRpc2Nvbm5lY3QiLCJjbGVhckV4dGVybmFsTm9kZXMiLCJnZXRFeHRlcm5hbE5vZGVzIiwiYnVmZmVyIiwiY3JlYXRlQnVmZmVyU291cmNlIiwib25lbmRlZCIsImxvb3BTdGFydCIsImxvb3BFbmQiLCJPYmplY3QiLCJhc3NpZ24iLCJwcm90b3R5cGUiLCJwYXVzZWQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiYXVkaW8iLCJjbG9uZU5vZGUiLCJhZGRFdmVudExpc3RlbmVyIiwiZGVmaW5lUHJvcGVydHkiLCJnZXQiLCJzZXQiXSwibWFwcGluZ3MiOiI7Ozs7QUFNQSxNQUFNQSxhQUFhLEdBQUcsQ0FBQyxDQUFBO0FBQ3ZCLE1BQU1DLFlBQVksR0FBRyxDQUFDLENBQUE7QUFDdEIsTUFBTUMsYUFBYSxHQUFHLENBQUMsQ0FB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
