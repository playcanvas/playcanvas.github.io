/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../core/event-handler.js';
import { math } from '../../core/math/math.js';
import { hasAudioContext } from '../audio/capabilities.js';

const STATE_PLAYING = 0;
const STATE_PAUSED = 1;
const STATE_STOPPED = 2;

function capTime(time, duration) {
  return time % duration || 0;
}

class SoundInstance extends EventHandler {

  constructor(manager, sound, options) {
    super();

    this.source = null;
    this._manager = manager;

    this._volume = options.volume !== undefined ? math.clamp(Number(options.volume) || 0, 0, 1) : 1;

    this._pitch = options.pitch !== undefined ? Math.max(0.01, Number(options.pitch) || 0) : 1;

    this._loop = !!(options.loop !== undefined ? options.loop : false);

    this._sound = sound;

    this._state = STATE_STOPPED;

    this._suspended = false;

    this._suspendEndEvent = 0;

    this._suspendInstanceEvents = false;

    this._playWhenLoaded = true;

    this._startTime = Math.max(0, Number(options.startTime) || 0);

    this._duration = Math.max(0, Number(options.duration) || 0);

    this._startOffset = null;

    this._onPlayCallback = options.onPlay;
    this._onPauseCallback = options.onPause;
    this._onResumeCallback = options.onResume;
    this._onStopCallback = options.onStop;
    this._onEndCallback = options.onEnd;
    if (hasAudioContext()) {
      this._startedAt = 0;

      this._currentTime = 0;

      this._currentOffset = 0;

      this._inputNode = null;

      this._connectorNode = null;

      this._firstNode = null;

      this._lastNode = null;

      this._waitingContextSuspension = false;
      this._initializeNodes();

      this._endedHandler = this._onEnded.bind(this);
    } else {
      this._isReady = false;

      this._loadedMetadataHandler = this._onLoadedMetadata.bind(this);
      this._timeUpdateHandler = this._onTimeUpdate.bind(this);
      this._endedHandler = this._onEnded.bind(this);
      this._createSource();
    }
  }

  set currentTime(value) {
    if (value < 0) return;
    if (this._state === STATE_PLAYING) {
      const suspend = this._suspendInstanceEvents;
      this._suspendInstanceEvents = true;

      this.stop();

      this._startOffset = value;
      this.play();
      this._suspendInstanceEvents = suspend;
    } else {
      this._startOffset = value;
      this._currentTime = value;
    }
  }
  get currentTime() {
    if (this._startOffset !== null) {
      return this._startOffset;
    }

    if (this._state === STATE_PAUSED) {
      return this._currentTime;
    }

    if (this._state === STATE_STOPPED || !this.source) {
      return 0;
    }

    this._updateCurrentTime();
    return this._currentTime;
  }

  set duration(value) {
    this._duration = Math.max(0, Number(value) || 0);

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

  get isPaused() {
    return this._state === STATE_PAUSED;
  }

  get isPlaying() {
    return this._state === STATE_PLAYING;
  }

  get isStopped() {
    return this._state === STATE_STOPPED;
  }

  get isSuspended() {
    return this._suspended;
  }

  set loop(value) {
    this._loop = !!value;
    if (this.source) {
      this.source.loop = this._loop;
    }
  }
  get loop() {
    return this._loop;
  }

  set pitch(pitch) {
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

  set startTime(value) {
    this._startTime = Math.max(0, Number(value) || 0);

    const isPlaying = this._state === STATE_PLAYING;
    this.stop();
    if (isPlaying) {
      this.play();
    }
  }
  get startTime() {
    return this._startTime;
  }

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

  _onPlay() {
    this.fire('play');
    if (this._onPlayCallback) this._onPlayCallback(this);
  }

  _onPause() {
    this.fire('pause');
    if (this._onPauseCallback) this._onPauseCallback(this);
  }

  _onResume() {
    this.fire('resume');
    if (this._onResumeCallback) this._onResumeCallback(this);
  }

  _onStop() {
    this.fire('stop');
    if (this._onStopCallback) this._onStopCallback(this);
  }

  _onEnded() {
    if (this._suspendEndEvent > 0) {
      this._suspendEndEvent--;
      return;
    }
    this.fire('end');
    if (this._onEndCallback) this._onEndCallback(this);
    this.stop();
  }

  _onManagerVolumeChange() {
    this.volume = this._volume;
  }

  _onManagerSuspend() {
    if (this._state === STATE_PLAYING && !this._suspended) {
      this._suspended = true;
      this.pause();
    }
  }

  _onManagerResume() {
    if (this._suspended) {
      this._suspended = false;
      this.resume();
    }
  }

  _initializeNodes() {
    this.gain = this._manager.context.createGain();
    this._inputNode = this.gain;
    this._connectorNode = this.gain;
    this._connectorNode.connect(this._manager.context.destination);
  }

  play() {
    if (this._state !== STATE_STOPPED) {
      this.stop();
    }
    this._state = STATE_PLAYING;
    this._playWhenLoaded = false;

    if (this._waitingContextSuspension) {
      return false;
    }

    if (this._manager.suspended) {
      this._manager.once('resume', this._playAudioImmediate, this);
      this._waitingContextSuspension = true;
      return false;
    }
    this._playAudioImmediate();
    return true;
  }

  _playAudioImmediate() {
    this._waitingContextSuspension = false;

    if (this._state !== STATE_PLAYING) {
      return;
    }
    if (!this.source) {
      this._createSource();
    }

    let offset = capTime(this._startOffset, this.duration);
    offset = capTime(this._startTime + offset, this._sound.duration);
    this._startOffset = null;

    if (this._duration) {
      this.source.start(0, offset, this._duration);
    } else {
      this.source.start(0, offset);
    }

    this._startedAt = this._manager.context.currentTime;
    this._currentTime = 0;
    this._currentOffset = offset;

    this.volume = this._volume;
    this.loop = this._loop;
    this.pitch = this._pitch;

    this._manager.on('volumechange', this._onManagerVolumeChange, this);
    this._manager.on('suspend', this._onManagerSuspend, this);
    this._manager.on('resume', this._onManagerResume, this);
    this._manager.on('destroy', this._onManagerDestroy, this);
    if (!this._suspendInstanceEvents) {
      this._onPlay();
    }
  }

  pause() {
    this._playWhenLoaded = false;
    if (this._state !== STATE_PLAYING) return false;

    this._state = STATE_PAUSED;

    if (this._waitingContextSuspension) {
      return true;
    }

    this._updateCurrentTime();

    this._suspendEndEvent++;
    this.source.stop(0);
    this.source = null;

    this._startOffset = null;
    if (!this._suspendInstanceEvents) this._onPause();
    return true;
  }

  resume() {
    if (this._state !== STATE_PAUSED) {
      return false;
    }

    this._state = STATE_PLAYING;

    if (this._waitingContextSuspension) {
      return true;
    }
    if (!this.source) {
      this._createSource();
    }

    let offset = this.currentTime;

    if (this._startOffset !== null) {
      offset = capTime(this._startOffset, this.duration);
      offset = capTime(this._startTime + offset, this._sound.duration);

      this._startOffset = null;
    }

    if (this._duration) {
      this.source.start(0, offset, this._duration);
    } else {
      this.source.start(0, offset);
    }
    this._startedAt = this._manager.context.currentTime;
    this._currentOffset = offset;

    this.volume = this._volume;
    this.loop = this._loop;
    this.pitch = this._pitch;
    this._playWhenLoaded = false;
    if (!this._suspendInstanceEvents) this._onResume();
    return true;
  }

  stop() {
    this._playWhenLoaded = false;
    if (this._state === STATE_STOPPED) return false;

    const wasPlaying = this._state === STATE_PLAYING;
    this._state = STATE_STOPPED;

    if (this._waitingContextSuspension) {
      return true;
    }

    this._manager.off('volumechange', this._onManagerVolumeChange, this);
    this._manager.off('suspend', this._onManagerSuspend, this);
    this._manager.off('resume', this._onManagerResume, this);
    this._manager.off('destroy', this._onManagerDestroy, this);

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

  setExternalNodes(firstNode, lastNode) {
    if (!firstNode) {
      console.error('The firstNode must be a valid Audio Node');
      return;
    }
    if (!lastNode) {
      lastNode = firstNode;
    }

    const speakers = this._manager.context.destination;
    if (this._firstNode !== firstNode) {
      if (this._firstNode) {
        this._connectorNode.disconnect(this._firstNode);
      } else {
        this._connectorNode.disconnect(speakers);
      }

      this._firstNode = firstNode;
      this._connectorNode.connect(firstNode);
    }
    if (this._lastNode !== lastNode) {
      if (this._lastNode) {
        this._lastNode.disconnect(speakers);
      }

      this._lastNode = lastNode;
      this._lastNode.connect(speakers);
    }
  }

  clearExternalNodes() {
    const speakers = this._manager.context.destination;

    if (this._firstNode) {
      this._connectorNode.disconnect(this._firstNode);
      this._firstNode = null;
    }
    if (this._lastNode) {
      this._lastNode.disconnect(speakers);
      this._lastNode = null;
    }

    this._connectorNode.connect(speakers);
  }

  getExternalNodes() {
    return [this._firstNode, this._lastNode];
  }

  _createSource() {
    if (!this._sound) {
      return null;
    }
    const context = this._manager.context;
    if (this._sound.buffer) {
      this.source = context.createBufferSource();
      this.source.buffer = this._sound.buffer;

      this.source.connect(this._inputNode);

      this.source.onended = this._endedHandler;

      this.source.loopStart = capTime(this._startTime, this.source.buffer.duration);
      if (this._duration) {
        this.source.loopEnd = Math.max(this.source.loopStart, capTime(this._startTime + this._duration, this.source.buffer.duration));
      }
    }
    return this.source;
  }

  _updateCurrentTime() {
    this._currentTime = capTime((this._manager.context.currentTime - this._startedAt) * this._pitch + this._currentOffset, this.duration);
  }

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
    },
    clearExternalNodes: function () {
    },
    getExternalNodes: function () {
      return [null, null];
    },
    _onLoadedMetadata: function () {
      this.source.removeEventListener('loadedmetadata', this._loadedMetadataHandler);
      this._isReady = true;

      let offset = capTime(this._startOffset, this.duration);
      offset = capTime(this._startTime + offset, this._sound.duration);
      this._startOffset = null;

      this.source.currentTime = offset;
    },
    _createSource: function () {
      if (this._sound && this._sound.audio) {
        this._isReady = false;
        this.source = this._sound.audio.cloneNode(true);

        this.source.addEventListener('loadedmetadata', this._loadedMetadataHandler);
        this.source.addEventListener('timeupdate', this._timeUpdateHandler);
        this.source.onended = this._endedHandler;
      }
      return this.source;
    },
    _onTimeUpdate: function () {
      if (!this._duration) return;

      if (this.source.currentTime > capTime(this._startTime + this._duration, this.source.duration)) {
        if (this.loop) {
          this.source.currentTime = capTime(this._startTime, this.source.duration);
        } else {
          this.source.removeEventListener('timeupdate', this._timeUpdateHandler);
          this.source.pause();

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFuY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9zb3VuZC9pbnN0YW5jZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQgeyBoYXNBdWRpb0NvbnRleHQgfSBmcm9tICcuLi9hdWRpby9jYXBhYmlsaXRpZXMuanMnO1xuXG5jb25zdCBTVEFURV9QTEFZSU5HID0gMDtcbmNvbnN0IFNUQVRFX1BBVVNFRCA9IDE7XG5jb25zdCBTVEFURV9TVE9QUEVEID0gMjtcblxuLyoqXG4gKiBSZXR1cm4gdGltZSAlIGR1cmF0aW9uIGJ1dCBhbHdheXMgcmV0dXJuIGEgbnVtYmVyIGluc3RlYWQgb2YgTmFOIHdoZW4gZHVyYXRpb24gaXMgMC5cbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZSAtIFRoZSB0aW1lLlxuICogQHBhcmFtIHtudW1iZXJ9IGR1cmF0aW9uIC0gVGhlIGR1cmF0aW9uLlxuICogQHJldHVybnMge251bWJlcn0gVGhlIHRpbWUgJSBkdXJhdGlvbi5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gY2FwVGltZSh0aW1lLCBkdXJhdGlvbikge1xuICAgIHJldHVybiAodGltZSAlIGR1cmF0aW9uKSB8fCAwO1xufVxuXG4vKipcbiAqIEEgU291bmRJbnN0YW5jZSBwbGF5cyBhIHtAbGluayBTb3VuZH0uXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBTb3VuZEluc3RhbmNlIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBzb3VyY2UgdGhhdCBwbGF5cyB0aGUgc291bmQgcmVzb3VyY2UuIElmIHRoZSBXZWIgQXVkaW8gQVBJIGlzIG5vdCBzdXBwb3J0ZWQgdGhlXG4gICAgICogdHlwZSBvZiBzb3VyY2UgaXMgW0F1ZGlvXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9IVE1ML0VsZW1lbnQvYXVkaW8pLlxuICAgICAqIFNvdXJjZSBpcyBvbmx5IGF2YWlsYWJsZSBhZnRlciBjYWxsaW5nIHBsYXkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXVkaW9CdWZmZXJTb3VyY2VOb2RlfVxuICAgICAqL1xuICAgIHNvdXJjZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU291bmRJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21hbmFnZXIuanMnKS5Tb3VuZE1hbmFnZXJ9IG1hbmFnZXIgLSBUaGUgc291bmQgbWFuYWdlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zb3VuZC5qcycpLlNvdW5kfSBzb3VuZCAtIFRoZSBzb3VuZCB0byBwbGF5LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gT3B0aW9ucyBmb3IgdGhlIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy52b2x1bWU9MV0gLSBUaGUgcGxheWJhY2sgdm9sdW1lLCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnBpdGNoPTFdIC0gVGhlIHJlbGF0aXZlIHBpdGNoLCBkZWZhdWx0IG9mIDEsIHBsYXlzIGF0IG5vcm1hbCBwaXRjaC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmxvb3A9ZmFsc2VdIC0gV2hldGhlciB0aGUgc291bmQgc2hvdWxkIGxvb3Agd2hlbiBpdCByZWFjaGVzIHRoZVxuICAgICAqIGVuZCBvciBub3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0VGltZT0wXSAtIFRoZSB0aW1lIGZyb20gd2hpY2ggdGhlIHBsYXliYWNrIHdpbGwgc3RhcnQgaW5cbiAgICAgKiBzZWNvbmRzLiBEZWZhdWx0IGlzIDAgdG8gc3RhcnQgYXQgdGhlIGJlZ2lubmluZy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZHVyYXRpb249MF0gLSBUaGUgdG90YWwgdGltZSBhZnRlciB0aGUgc3RhcnRUaW1lIGluIHNlY29uZHMgd2hlblxuICAgICAqIHBsYXliYWNrIHdpbGwgc3RvcCBvciByZXN0YXJ0IGlmIGxvb3AgaXMgdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblBsYXk9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2Ugc3RhcnRzIHBsYXlpbmcuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25QYXVzZT1udWxsXSAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyBwYXVzZWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25SZXN1bWU9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgcmVzdW1lZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblN0b3A9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgc3RvcHBlZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vbkVuZD1udWxsXSAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBpbnN0YW5jZSBlbmRzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIsIHNvdW5kLCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21hbmFnZXIgPSBtYW5hZ2VyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fdm9sdW1lID0gb3B0aW9ucy52b2x1bWUgIT09IHVuZGVmaW5lZCA/IG1hdGguY2xhbXAoTnVtYmVyKG9wdGlvbnMudm9sdW1lKSB8fCAwLCAwLCAxKSA6IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9waXRjaCA9IG9wdGlvbnMucGl0Y2ggIT09IHVuZGVmaW5lZCA/IE1hdGgubWF4KDAuMDEsIE51bWJlcihvcHRpb25zLnBpdGNoKSB8fCAwKSA6IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhKG9wdGlvbnMubG9vcCAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5sb29wIDogZmFsc2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3NvdW5kLmpzJykuU291bmR9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zb3VuZCA9IHNvdW5kO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdGFydCBhdCAnc3RvcHBlZCcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1NUT1BQRUQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRydWUgaWYgdGhlIG1hbmFnZXIgd2FzIHN1c3BlbmRlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdXNwZW5kZWQgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogR3JlYXRlciB0aGFuIDAgaWYgd2Ugd2FudCB0byBzdXNwZW5kIHRoZSBldmVudCBoYW5kbGVkIHRvIHRoZSAnb25lbmRlZCcgZXZlbnQuXG4gICAgICAgICAqIFdoZW4gYW4gJ29uZW5kZWQnIGV2ZW50IGlzIHN1c3BlbmRlZCwgdGhpcyBjb3VudGVyIGlzIGRlY3JlbWVudGVkIGJ5IDEuXG4gICAgICAgICAqIFdoZW4gYSBmdXR1cmUgJ29uZW5kZWQnIGV2ZW50IGlzIHRvIGJlIHN1c3BlbmRlZCwgdGhpcyBjb3VudGVyIGlzIGluY3JlbWVudGVkIGJ5IDEuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdXNwZW5kRW5kRXZlbnQgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHdlIHdhbnQgdG8gc3VzcGVuZCBmaXJpbmcgaW5zdGFuY2UgZXZlbnRzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cyA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiB0cnVlIHRoZW4gdGhlIGluc3RhbmNlIHdpbGwgc3RhcnQgcGxheWluZyBpdHMgc291cmNlIHdoZW4gaXRzIGNyZWF0ZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3RhcnRUaW1lID0gTWF0aC5tYXgoMCwgTnVtYmVyKG9wdGlvbnMuc3RhcnRUaW1lKSB8fCAwKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2R1cmF0aW9uID0gTWF0aC5tYXgoMCwgTnVtYmVyKG9wdGlvbnMuZHVyYXRpb24pIHx8IDApO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgLy8gZXh0ZXJuYWwgZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX29uUGxheUNhbGxiYWNrID0gb3B0aW9ucy5vblBsYXk7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vblBhdXNlQ2FsbGJhY2sgPSBvcHRpb25zLm9uUGF1c2U7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vblJlc3VtZUNhbGxiYWNrID0gb3B0aW9ucy5vblJlc3VtZTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX29uU3RvcENhbGxiYWNrID0gb3B0aW9ucy5vblN0b3A7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vbkVuZENhbGxiYWNrID0gb3B0aW9ucy5vbkVuZDtcblxuICAgICAgICBpZiAoaGFzQXVkaW9Db250ZXh0KCkpIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0ZWRBdCA9IDA7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogTWFudWFsbHkga2VlcCB0cmFjayBvZiB0aGUgcGxheWJhY2sgcG9zaXRpb24gYmVjYXVzZSB0aGUgV2ViIEF1ZGlvIEFQSSBkb2VzIG5vdFxuICAgICAgICAgICAgICogcHJvdmlkZSBhIHdheSB0byBkbyB0aGlzIGFjY3VyYXRlbHkgaWYgdGhlIHBsYXliYWNrUmF0ZSBpcyBub3QgMS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSAwO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgaW5wdXQgbm9kZSBpcyB0aGUgb25lIHRoYXQgaXMgY29ubmVjdGVkIHRvIHRoZSBzb3VyY2UuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0F1ZGlvTm9kZXxudWxsfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5faW5wdXROb2RlID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgY29ubmVjdGVkIG5vZGUgaXMgdGhlIG9uZSB0aGF0IGlzIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb24gKHNwZWFrZXJzKS4gQW55XG4gICAgICAgICAgICAgKiBleHRlcm5hbCBub2RlcyB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGlzIG5vZGUuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0F1ZGlvTm9kZXxudWxsfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGZpcnN0IGV4dGVybmFsIG5vZGUgc2V0IGJ5IGEgdXNlci5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7QXVkaW9Ob2RlfG51bGx9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBsYXN0IGV4dGVybmFsIG5vZGUgc2V0IGJ5IGEgdXNlci5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7QXVkaW9Ob2RlfG51bGx9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogU2V0IHRvIHRydWUgaWYgYSBwbGF5KCkgcmVxdWVzdCB3YXMgaXNzdWVkIHdoZW4gdGhlIEF1ZGlvQ29udGV4dCB3YXMgc3RpbGwgc3VzcGVuZGVkLFxuICAgICAgICAgICAgICogYW5kIHdpbGwgdGhlcmVmb3JlIHdhaXQgdW50aWwgaXQgaXMgcmVzdW1lZCB0byBwbGF5IHRoZSBhdWRpby5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbiA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplTm9kZXMoKTtcblxuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl9lbmRlZEhhbmRsZXIgPSB0aGlzLl9vbkVuZGVkLmJpbmQodGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgICAgIHRoaXMuX2lzUmVhZHkgPSBmYWxzZTtcblxuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl9sb2FkZWRNZXRhZGF0YUhhbmRsZXIgPSB0aGlzLl9vbkxvYWRlZE1ldGFkYXRhLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgICAgIHRoaXMuX3RpbWVVcGRhdGVIYW5kbGVyID0gdGhpcy5fb25UaW1lVXBkYXRlLmJpbmQodGhpcyk7XG4gICAgICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgICAgIHRoaXMuX2VuZGVkSGFuZGxlciA9IHRoaXMuX29uRW5kZWQuYmluZCh0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBpbnN0YW5jZSBzdGFydHMgcGxheWluZyBpdHMgc291cmNlLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kSW5zdGFuY2UjcGxheVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kSW5zdGFuY2UjcGF1c2VcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluc3RhbmNlIGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRJbnN0YW5jZSNyZXN1bWVcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluc3RhbmNlIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRJbnN0YW5jZSNzdG9wXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBzb3VuZCBjdXJyZW50bHkgcGxheWVkIGJ5IHRoZSBpbnN0YW5jZSBlbmRzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kSW5zdGFuY2UjZW5kXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBHZXRzIG9yIHNldHMgdGhlIGN1cnJlbnQgdGltZSBvZiB0aGUgc291bmQgdGhhdCBpcyBwbGF5aW5nLiBJZiB0aGUgdmFsdWUgcHJvdmlkZWQgaXMgYmlnZ2VyXG4gICAgICogdGhhbiB0aGUgZHVyYXRpb24gb2YgdGhlIGluc3RhbmNlIGl0IHdpbGwgd3JhcCBmcm9tIHRoZSBiZWdpbm5pbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjdXJyZW50VGltZSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgPCAwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HKSB7XG4gICAgICAgICAgICBjb25zdCBzdXNwZW5kID0gdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzO1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gc3RvcCBmaXJzdCB3aGljaCB3aWxsIHNldCBfc3RhcnRPZmZzZXQgdG8gbnVsbFxuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG5cbiAgICAgICAgICAgIC8vIHNldCBfc3RhcnRPZmZzZXQgYW5kIHBsYXlcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cyA9IHN1c3BlbmQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBzZXQgX3N0YXJ0T2Zmc2V0IHdoaWNoIHdpbGwgYmUgdXNlZCB3aGVuIHRoZSBpbnN0YW5jZSB3aWxsIHN0YXJ0IHBsYXlpbmdcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gdmFsdWU7XG4gICAgICAgICAgICAvLyBzZXQgX2N1cnJlbnRUaW1lXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50VGltZSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGN1cnJlbnRUaW1lKCkge1xuICAgICAgICAvLyBpZiB0aGUgdXNlciBoYXMgc2V0IHRoZSBjdXJyZW50VGltZSBhbmQgd2UgaGF2ZSBub3QgdXNlZCBpdCB5ZXRcbiAgICAgICAgLy8gdGhlbiBqdXN0IHJldHVybiB0aGF0XG4gICAgICAgIGlmICh0aGlzLl9zdGFydE9mZnNldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0T2Zmc2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIHNvdW5kIGlzIHBhdXNlZCByZXR1cm4gdGhlIGN1cnJlbnRUaW1lIGNhbGN1bGF0ZWQgd2hlblxuICAgICAgICAvLyBwYXVzZSgpIHdhcyBjYWxsZWRcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9QQVVTRUQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jdXJyZW50VGltZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBzb3VuZCBpcyBzdG9wcGVkIG9yIHdlIGRvbid0IGhhdmUgYSBzb3VyY2VcbiAgICAgICAgLy8gcmV0dXJuIDBcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9TVE9QUEVEIHx8ICF0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWNhbGN1bGF0ZSBjdXJyZW50IHRpbWVcbiAgICAgICAgdGhpcy5fdXBkYXRlQ3VycmVudFRpbWUoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkdXJhdGlvbiBvZiB0aGUgc291bmQgdGhhdCB0aGUgaW5zdGFuY2Ugd2lsbCBwbGF5IHN0YXJ0aW5nIGZyb20gc3RhcnRUaW1lLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZHVyYXRpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZHVyYXRpb24gPSBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUpIHx8IDApO1xuXG4gICAgICAgIC8vIHJlc3RhcnRcbiAgICAgICAgY29uc3QgaXNQbGF5aW5nID0gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICBpZiAoaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBkdXJhdGlvbigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zb3VuZCkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gY2FwVGltZSh0aGlzLl9kdXJhdGlvbiwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3VuZC5kdXJhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGluc3RhbmNlIGlzIGN1cnJlbnRseSBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQYXVzZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUEFVU0VEO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgaW5zdGFuY2UgaXMgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNQbGF5aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBpbnN0YW5jZSBpcyBjdXJyZW50bHkgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1N0b3BwZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGluc3RhbmNlIGlzIGN1cnJlbnRseSBzdXNwZW5kZWQgYmVjYXVzZSB0aGUgd2luZG93IGlzIG5vdCBmb2N1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzU3VzcGVuZGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3VzcGVuZGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUgdGhlIGluc3RhbmNlIHdpbGwgcmVzdGFydCB3aGVuIGl0IGZpbmlzaGVzIHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbG9vcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9sb29wID0gISF2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsb29wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9vcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGl0Y2ggbW9kaWZpZXIgdG8gcGxheSB0aGUgc291bmQgd2l0aC4gTXVzdCBiZSBsYXJnZXIgdGhhbiAwLjAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcGl0Y2gocGl0Y2gpIHtcbiAgICAgICAgLy8gc2V0IG9mZnNldCB0byBjdXJyZW50IHRpbWUgc28gdGhhdFxuICAgICAgICAvLyB3ZSBjYWxjdWxhdGUgdGhlIHJlc3Qgb2YgdGhlIHRpbWUgd2l0aCB0aGUgbmV3IHBpdGNoXG4gICAgICAgIC8vIGZyb20gbm93IG9uXG4gICAgICAgIHRoaXMuX2N1cnJlbnRPZmZzZXQgPSB0aGlzLmN1cnJlbnRUaW1lO1xuICAgICAgICB0aGlzLl9zdGFydGVkQXQgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3VycmVudFRpbWU7XG5cbiAgICAgICAgdGhpcy5fcGl0Y2ggPSBNYXRoLm1heChOdW1iZXIocGl0Y2gpIHx8IDAsIDAuMDEpO1xuICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnBsYXliYWNrUmF0ZS52YWx1ZSA9IHRoaXMuX3BpdGNoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHBpdGNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGl0Y2g7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHNvdW5kIHJlc291cmNlIHRoYXQgdGhlIGluc3RhbmNlIHdpbGwgcGxheS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc291bmQuanMnKS5Tb3VuZH1cbiAgICAgKi9cbiAgICBzZXQgc291bmQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc291bmQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1NUT1BQRUQpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc291bmQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3VuZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc3RhcnQgdGltZSBmcm9tIHdoaWNoIHRoZSBzb3VuZCB3aWxsIHN0YXJ0IHBsYXlpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzdGFydFRpbWUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc3RhcnRUaW1lID0gTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlKSB8fCAwKTtcblxuICAgICAgICAvLyByZXN0YXJ0XG4gICAgICAgIGNvbnN0IGlzUGxheWluZyA9IHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HO1xuICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgaWYgKGlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3RhcnRUaW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhcnRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB2b2x1bWUgbW9kaWZpZXIgdG8gcGxheSB0aGUgc291bmQgd2l0aC4gSW4gcmFuZ2UgMC0xLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgdm9sdW1lKHZvbHVtZSkge1xuICAgICAgICB2b2x1bWUgPSBtYXRoLmNsYW1wKHZvbHVtZSwgMCwgMSk7XG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgaWYgKHRoaXMuZ2Fpbikge1xuICAgICAgICAgICAgdGhpcy5nYWluLmdhaW4udmFsdWUgPSB2b2x1bWUgKiB0aGlzLl9tYW5hZ2VyLnZvbHVtZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB2b2x1bWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92b2x1bWU7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uUGxheSgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdwbGF5Jyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uUGxheUNhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25QbGF5Q2FsbGJhY2sodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uUGF1c2UoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncGF1c2UnKTtcblxuICAgICAgICBpZiAodGhpcy5fb25QYXVzZUNhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25QYXVzZUNhbGxiYWNrKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblJlc3VtZSgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdyZXN1bWUnKTtcblxuICAgICAgICBpZiAodGhpcy5fb25SZXN1bWVDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uUmVzdW1lQ2FsbGJhY2sodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uU3RvcCgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdzdG9wJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uU3RvcENhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25TdG9wQ2FsbGJhY2sodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uRW5kZWQoKSB7XG4gICAgICAgIC8vIHRoZSBjYWxsYmFjayBpcyBub3QgZmlyZWQgc3luY2hyb25vdXNseVxuICAgICAgICAvLyBzbyBvbmx5IGRlY3JlbWVudCBfc3VzcGVuZEVuZEV2ZW50IHdoZW4gdGhlXG4gICAgICAgIC8vIGNhbGxiYWNrIGlzIGZpcmVkXG4gICAgICAgIGlmICh0aGlzLl9zdXNwZW5kRW5kRXZlbnQgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kRW5kRXZlbnQtLTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnZW5kJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uRW5kQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9vbkVuZENhbGxiYWNrKHRoaXMpO1xuXG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmRsZSB0aGUgbWFuYWdlcidzICd2b2x1bWVjaGFuZ2UnIGV2ZW50LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYW5hZ2VyVm9sdW1lQ2hhbmdlKCkge1xuICAgICAgICB0aGlzLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAnc3VzcGVuZCcgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hbmFnZXJTdXNwZW5kKCkge1xuICAgICAgICBpZiAodGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkcgJiYgIXRoaXMuX3N1c3BlbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMucGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmRsZSB0aGUgbWFuYWdlcidzICdyZXN1bWUnIGV2ZW50LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYW5hZ2VyUmVzdW1lKCkge1xuICAgICAgICBpZiAodGhpcy5fc3VzcGVuZGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMucmVzdW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGludGVybmFsIGF1ZGlvIG5vZGVzIGFuZCBjb25uZWN0cyB0aGVtLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW5pdGlhbGl6ZU5vZGVzKCkge1xuICAgICAgICAvLyBjcmVhdGUgZ2FpbiBub2RlIGZvciB2b2x1bWUgY29udHJvbFxuICAgICAgICB0aGlzLmdhaW4gPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgICAgICB0aGlzLl9pbnB1dE5vZGUgPSB0aGlzLmdhaW47XG4gICAgICAgIC8vIHRoZSBnYWluIG5vZGUgaXMgYWxzbyB0aGUgY29ubmVjdG9yIG5vZGUgZm9yIDJEIHNvdW5kIGluc3RhbmNlc1xuICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlID0gdGhpcy5nYWluO1xuICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmNvbm5lY3QodGhpcy5fbWFuYWdlci5jb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0IHRvIGJlZ2luIHBsYXliYWNrIHRoZSBzb3VuZC5cbiAgICAgKiBJZiB0aGUgQXVkaW9Db250ZXh0IGlzIHN1c3BlbmRlZCwgdGhlIGF1ZGlvIHdpbGwgb25seSBzdGFydCBvbmNlIGl0J3MgcmVzdW1lZC5cbiAgICAgKiBJZiB0aGUgc291bmQgaXMgYWxyZWFkeSBwbGF5aW5nLCB0aGlzIHdpbGwgcmVzdGFydCB0aGUgc291bmQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc291bmQgd2FzIHN0YXJ0ZWQgaW1tZWRpYXRlbHkuXG4gICAgICovXG4gICAgcGxheSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9TVE9QUEVEKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgc3RhdGUgdG8gcGxheWluZ1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgIC8vIG5vIG5lZWQgZm9yIHRoaXMgYW55bW9yZVxuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHBsYXkoKSB3YXMgYWxyZWFkeSBpc3N1ZWQgYnV0IGhhc24ndCBhY3R1YWxseSBzdGFydGVkIHlldFxuICAgICAgICBpZiAodGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYW5hZ2VyIGlzIHN1c3BlbmRlZCBzbyBhdWRpbyBjYW5ub3Qgc3RhcnQgbm93IC0gd2FpdCBmb3IgbWFuYWdlciB0byByZXN1bWVcbiAgICAgICAgaWYgKHRoaXMuX21hbmFnZXIuc3VzcGVuZGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uY2UoJ3Jlc3VtZScsIHRoaXMuX3BsYXlBdWRpb0ltbWVkaWF0ZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24gPSB0cnVlO1xuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wbGF5QXVkaW9JbW1lZGlhdGUoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbW1lZGlhdGVseSBwbGF5IHRoZSBzb3VuZC5cbiAgICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoZSBBdWRpb0NvbnRleHQgaXMgcmVhZHkgKG5vdCBzdXNwZW5kZWQgb3IgbG9ja2VkKS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BsYXlBdWRpb0ltbWVkaWF0ZSgpIHtcbiAgICAgICAgdGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYmV0d2VlbiBwbGF5KCkgYW5kIHRoZSBtYW5hZ2VyIGJlaW5nIHJlYWR5IHRvIHBsYXksIGEgc3RvcCgpIG9yIHBhdXNlKCkgY2FsbCB3YXMgbWFkZVxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdXJjZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIHN0YXJ0IG9mZnNldFxuICAgICAgICBsZXQgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydE9mZnNldCwgdGhpcy5kdXJhdGlvbik7XG4gICAgICAgIG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgb2Zmc2V0LCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG4gICAgICAgIC8vIHJlc2V0IHN0YXJ0IG9mZnNldCBub3cgdGhhdCB3ZSBzdGFydGVkIHRoZSBzb3VuZFxuICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgLy8gc3RhcnQgc291cmNlIHdpdGggc3BlY2lmaWVkIG9mZnNldCBhbmQgZHVyYXRpb25cbiAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwLCBvZmZzZXQsIHRoaXMuX2R1cmF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXNldCB0aW1lc1xuICAgICAgICB0aGlzLl9zdGFydGVkQXQgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IG9mZnNldDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHZvbHVtZSBhbmQgbG9vcCAtIG5vdGUgbW92ZWQgdG8gYmUgYWZ0ZXIgc3RhcnQoKSBiZWNhdXNlIG9mIENocm9tZSBidWdcbiAgICAgICAgdGhpcy52b2x1bWUgPSB0aGlzLl92b2x1bWU7XG4gICAgICAgIHRoaXMubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIHRoaXMucGl0Y2ggPSB0aGlzLl9waXRjaDtcblxuICAgICAgICAvLyBoYW5kbGUgc3VzcGVuZCBldmVudHMgLyB2b2x1bWVjaGFuZ2UgZXZlbnRzXG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3ZvbHVtZWNoYW5nZScsIHRoaXMuX29uTWFuYWdlclZvbHVtZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3N1c3BlbmQnLCB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vbigncmVzdW1lJywgdGhpcy5fb25NYW5hZ2VyUmVzdW1lLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vbignZGVzdHJveScsIHRoaXMuX29uTWFuYWdlckRlc3Ryb3ksIHRoaXMpO1xuXG4gICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKSB7XG4gICAgICAgICAgICB0aGlzLl9vblBsYXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyBwbGF5YmFjayBvZiBzb3VuZC4gQ2FsbCByZXN1bWUoKSB0byByZXN1bWUgcGxheWJhY2sgZnJvbSB0aGUgc2FtZSBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHNvdW5kIHdhcyBwYXVzZWQuXG4gICAgICovXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIC8vIG5vIG5lZWQgZm9yIHRoaXMgYW55bW9yZVxuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfUExBWUlORylcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBzZXQgc3RhdGUgdG8gcGF1c2VkXG4gICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUEFVU0VEO1xuXG4gICAgICAgIC8vIHBsYXkoKSB3YXMgaXNzdWVkIGJ1dCBoYXNuJ3QgYWN0dWFsbHkgc3RhcnRlZCB5ZXQuXG4gICAgICAgIGlmICh0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcmUgY3VycmVudCB0aW1lXG4gICAgICAgIHRoaXMuX3VwZGF0ZUN1cnJlbnRUaW1lKCk7XG5cbiAgICAgICAgLy8gU3RvcCB0aGUgc291cmNlIGFuZCByZS1jcmVhdGUgaXQgYmVjYXVzZSB3ZSBjYW5ub3QgcmV1c2UgdGhlIHNhbWUgc291cmNlLlxuICAgICAgICAvLyBTdXNwZW5kIHRoZSBlbmQgZXZlbnQgYXMgd2UgYXJlIG1hbnVhbGx5IHN0b3BwaW5nIHRoZSBzb3VyY2VcbiAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50Kys7XG4gICAgICAgIHRoaXMuc291cmNlLnN0b3AoMCk7XG4gICAgICAgIHRoaXMuc291cmNlID0gbnVsbDtcblxuICAgICAgICAvLyByZXNldCB1c2VyLXNldCBzdGFydCBvZmZzZXRcbiAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgdGhpcy5fb25QYXVzZSgpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgcGxheWJhY2sgb2YgdGhlIHNvdW5kLiBQbGF5YmFjayByZXN1bWVzIGF0IHRoZSBwb2ludCB0aGF0IHRoZSBhdWRpbyB3YXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgc291bmQgd2FzIHJlc3VtZWQuXG4gICAgICovXG4gICAgcmVzdW1lKCkge1xuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1BBVVNFRCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHN0YXRlIGJhY2sgdG8gcGxheWluZ1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BMQVlJTkc7XG5cbiAgICAgICAgLy8gcGxheSgpIHdhcyBpc3N1ZWQgYnV0IGhhc24ndCBhY3R1YWxseSBzdGFydGVkIHlldFxuICAgICAgICBpZiAodGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdXJjZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RhcnQgYXQgcG9pbnQgd2hlcmUgc291bmQgd2FzIHBhdXNlZFxuICAgICAgICBsZXQgb2Zmc2V0ID0gdGhpcy5jdXJyZW50VGltZTtcblxuICAgICAgICAvLyBpZiB0aGUgdXNlciBzZXQgdGhlICdjdXJyZW50VGltZScgcHJvcGVydHkgd2hpbGUgdGhlIHNvdW5kXG4gICAgICAgIC8vIHdhcyBwYXVzZWQgdGhlbiB1c2UgdGhhdCBhcyB0aGUgb2Zmc2V0IGluc3RlYWRcbiAgICAgICAgaWYgKHRoaXMuX3N0YXJ0T2Zmc2V0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0T2Zmc2V0LCB0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgb2Zmc2V0LCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG5cbiAgICAgICAgICAgIC8vIHJlc2V0IG9mZnNldFxuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RhcnQgc291cmNlXG4gICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgb2Zmc2V0LCB0aGlzLl9kdXJhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwLCBvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gb2Zmc2V0O1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgcGFyYW1ldGVyc1xuICAgICAgICB0aGlzLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgdGhpcy5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgdGhpcy5waXRjaCA9IHRoaXMuX3BpdGNoO1xuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgdGhpcy5fb25SZXN1bWUoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyBwbGF5YmFjayBvZiBzb3VuZC4gQ2FsbGluZyBwbGF5KCkgYWdhaW4gd2lsbCByZXN0YXJ0IHBsYXliYWNrIGZyb20gdGhlIGJlZ2lubmluZyBvZlxuICAgICAqIHRoZSBzb3VuZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHNvdW5kIHdhcyBzdG9wcGVkLlxuICAgICAqL1xuICAgIHN0b3AoKSB7XG4gICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9TVE9QUEVEKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIHNldCBzdGF0ZSB0byBzdG9wcGVkXG4gICAgICAgIGNvbnN0IHdhc1BsYXlpbmcgPSB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORztcbiAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9TVE9QUEVEO1xuXG4gICAgICAgIC8vIHBsYXkoKSB3YXMgaXNzdWVkIGJ1dCBoYXNuJ3QgYWN0dWFsbHkgc3RhcnRlZCB5ZXRcbiAgICAgICAgaWYgKHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIG1hbmFnZXIgZXZlbnRzXG4gICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZignc3VzcGVuZCcsIHRoaXMuX29uTWFuYWdlclN1c3BlbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZigncmVzdW1lJywgdGhpcy5fb25NYW5hZ2VyUmVzdW1lLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ2Rlc3Ryb3knLCB0aGlzLl9vbk1hbmFnZXJEZXN0cm95LCB0aGlzKTtcblxuICAgICAgICAvLyByZXNldCBzdG9yZWQgdGltZXNcbiAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gMDtcbiAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gMDtcblxuICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50Kys7XG4gICAgICAgIGlmICh3YXNQbGF5aW5nICYmIHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdG9wKDApO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc291cmNlID0gbnVsbDtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgIHRoaXMuX29uU3RvcCgpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3RzIGV4dGVybmFsIFdlYiBBdWRpbyBBUEkgbm9kZXMuIFlvdSBuZWVkIHRvIHBhc3MgdGhlIGZpcnN0IG5vZGUgb2YgdGhlIG5vZGUgZ3JhcGhcbiAgICAgKiB0aGF0IHlvdSBjcmVhdGVkIGV4dGVybmFsbHkgYW5kIHRoZSBsYXN0IG5vZGUgb2YgdGhhdCBncmFwaC4gVGhlIGZpcnN0IG5vZGUgd2lsbCBiZVxuICAgICAqIGNvbm5lY3RlZCB0byB0aGUgYXVkaW8gc291cmNlIGFuZCB0aGUgbGFzdCBub2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvbiBvZiB0aGVcbiAgICAgKiBBdWRpb0NvbnRleHQgKGUuZy4gc3BlYWtlcnMpLiBSZXF1aXJlcyBXZWIgQXVkaW8gQVBJIHN1cHBvcnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0F1ZGlvTm9kZX0gZmlyc3ROb2RlIC0gVGhlIGZpcnN0IG5vZGUgdGhhdCB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgYXVkaW8gc291cmNlIG9mIHNvdW5kIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge0F1ZGlvTm9kZX0gW2xhc3ROb2RlXSAtIFRoZSBsYXN0IG5vZGUgdGhhdCB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb24gb2YgdGhlIEF1ZGlvQ29udGV4dC5cbiAgICAgKiBJZiB1bnNwZWNpZmllZCB0aGVuIHRoZSBmaXJzdE5vZGUgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIGluc3RlYWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgY29udGV4dCA9IGFwcC5zeXN0ZW1zLnNvdW5kLmNvbnRleHQ7XG4gICAgICogdmFyIGFuYWx5emVyID0gY29udGV4dC5jcmVhdGVBbmFseXplcigpO1xuICAgICAqIHZhciBkaXN0b3J0aW9uID0gY29udGV4dC5jcmVhdGVXYXZlU2hhcGVyKCk7XG4gICAgICogdmFyIGZpbHRlciA9IGNvbnRleHQuY3JlYXRlQmlxdWFkRmlsdGVyKCk7XG4gICAgICogYW5hbHl6ZXIuY29ubmVjdChkaXN0b3J0aW9uKTtcbiAgICAgKiBkaXN0b3J0aW9uLmNvbm5lY3QoZmlsdGVyKTtcbiAgICAgKiBpbnN0YW5jZS5zZXRFeHRlcm5hbE5vZGVzKGFuYWx5emVyLCBmaWx0ZXIpO1xuICAgICAqL1xuICAgIHNldEV4dGVybmFsTm9kZXMoZmlyc3ROb2RlLCBsYXN0Tm9kZSkge1xuICAgICAgICBpZiAoIWZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVGhlIGZpcnN0Tm9kZSBtdXN0IGJlIGEgdmFsaWQgQXVkaW8gTm9kZScpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFsYXN0Tm9kZSkge1xuICAgICAgICAgICAgbGFzdE5vZGUgPSBmaXJzdE5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb25uZWN0aW9ucyBhcmU6XG4gICAgICAgIC8vIHNvdXJjZSAtPiBpbnB1dE5vZGUgLT4gY29ubmVjdG9yTm9kZSAtPiBbZmlyc3ROb2RlIC0+IC4uLiAtPiBsYXN0Tm9kZV0gLT4gc3BlYWtlcnNcblxuICAgICAgICBjb25zdCBzcGVha2VycyA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5kZXN0aW5hdGlvbjtcblxuICAgICAgICBpZiAodGhpcy5fZmlyc3ROb2RlICE9PSBmaXJzdE5vZGUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9maXJzdE5vZGUpIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBmaXJzdE5vZGUgYWxyZWFkeSBleGlzdHMgbWVhbnMgdGhlIGNvbm5lY3RvciBub2RlXG4gICAgICAgICAgICAgICAgLy8gaXMgY29ubmVjdGVkIHRvIGl0IHNvIGRpc2Nvbm5lY3QgaXRcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmRpc2Nvbm5lY3QodGhpcy5fZmlyc3ROb2RlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgZmlyc3ROb2RlIGRvZXMgbm90IGV4aXN0IG1lYW5zIHRoYXQgaXRzIGNvbm5lY3RlZFxuICAgICAgICAgICAgICAgIC8vIHRvIHRoZSBzcGVha2VycyBzbyBkaXNjb25uZWN0IGl0XG4gICAgICAgICAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5kaXNjb25uZWN0KHNwZWFrZXJzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGZpcnN0IG5vZGUgYW5kIGNvbm5lY3Qgd2l0aCBjb25uZWN0b3Igbm9kZVxuICAgICAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gZmlyc3ROb2RlO1xuICAgICAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5jb25uZWN0KGZpcnN0Tm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbGFzdE5vZGUgIT09IGxhc3ROb2RlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbGFzdE5vZGUpIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBsYXN0IG5vZGUgZXhpc3RzIG1lYW5zIGl0J3MgY29ubmVjdGVkIHRvIHRoZSBzcGVha2VycyBzbyBkaXNjb25uZWN0IGl0XG4gICAgICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUuZGlzY29ubmVjdChzcGVha2Vycyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBsYXN0IG5vZGUgYW5kIGNvbm5lY3Qgd2l0aCBzcGVha2Vyc1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBsYXN0Tm9kZTtcbiAgICAgICAgICAgIHRoaXMuX2xhc3ROb2RlLmNvbm5lY3Qoc3BlYWtlcnMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIGFueSBleHRlcm5hbCBub2RlcyBzZXQgYnkge0BsaW5rIFNvdW5kSW5zdGFuY2Ujc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICovXG4gICAgY2xlYXJFeHRlcm5hbE5vZGVzKCkge1xuICAgICAgICBjb25zdCBzcGVha2VycyA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5kZXN0aW5hdGlvbjtcblxuICAgICAgICAvLyBicmVhayBleGlzdGluZyBjb25uZWN0aW9uc1xuICAgICAgICBpZiAodGhpcy5fZmlyc3ROb2RlKSB7XG4gICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmRpc2Nvbm5lY3QodGhpcy5fZmlyc3ROb2RlKTtcbiAgICAgICAgICAgIHRoaXMuX2ZpcnN0Tm9kZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbGFzdE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2xhc3ROb2RlLmRpc2Nvbm5lY3Qoc3BlYWtlcnMpO1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzZXQgY29ubmVjdCB0byBzcGVha2Vyc1xuICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmNvbm5lY3Qoc3BlYWtlcnMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgYW55IGV4dGVybmFsIG5vZGVzIHNldCBieSB7QGxpbmsgU291bmRJbnN0YW5jZSNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBdWRpb05vZGVbXX0gUmV0dXJucyBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB0d28gbm9kZXMgc2V0IGJ5XG4gICAgICoge0BsaW5rIFNvdW5kSW5zdGFuY2Ujc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICovXG4gICAgZ2V0RXh0ZXJuYWxOb2RlcygpIHtcbiAgICAgICAgcmV0dXJuIFt0aGlzLl9maXJzdE5vZGUsIHRoaXMuX2xhc3ROb2RlXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBzb3VyY2UgZm9yIHRoZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBdWRpb0J1ZmZlclNvdXJjZU5vZGV8bnVsbH0gUmV0dXJucyB0aGUgY3JlYXRlZCBzb3VyY2Ugb3IgbnVsbCBpZiB0aGUgc291bmRcbiAgICAgKiBpbnN0YW5jZSBoYXMgbm8ge0BsaW5rIFNvdW5kfSBhc3NvY2lhdGVkIHdpdGggaXQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY3JlYXRlU291cmNlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3NvdW5kKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX3NvdW5kLmJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSBjb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UuYnVmZmVyID0gdGhpcy5fc291bmQuYnVmZmVyO1xuXG4gICAgICAgICAgICAvLyBDb25uZWN0IHVwIHRoZSBub2Rlc1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UuY29ubmVjdCh0aGlzLl9pbnB1dE5vZGUpO1xuXG4gICAgICAgICAgICAvLyBzZXQgZXZlbnRzXG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5vbmVuZGVkID0gdGhpcy5fZW5kZWRIYW5kbGVyO1xuXG4gICAgICAgICAgICAvLyBzZXQgbG9vcFN0YXJ0IGFuZCBsb29wRW5kIHNvIHRoYXQgdGhlIHNvdXJjZSBzdGFydHMgYW5kIGVuZHMgYXQgdGhlIGNvcnJlY3QgdXNlci1zZXQgdGltZXNcbiAgICAgICAgICAgIHRoaXMuc291cmNlLmxvb3BTdGFydCA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lLCB0aGlzLnNvdXJjZS5idWZmZXIuZHVyYXRpb24pO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UubG9vcEVuZCA9IE1hdGgubWF4KHRoaXMuc291cmNlLmxvb3BTdGFydCwgY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyB0aGlzLl9kdXJhdGlvbiwgdGhpcy5zb3VyY2UuYnVmZmVyLmR1cmF0aW9uKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3VycmVudCB0aW1lIHRha2luZyBpbnRvIGFjY291bnQgdGhlIHRpbWUgdGhlIGluc3RhbmNlIHN0YXJ0ZWQgcGxheWluZywgdGhlIGN1cnJlbnRcbiAgICAgKiBwaXRjaCBhbmQgdGhlIGN1cnJlbnQgdGltZSBvZmZzZXQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF91cGRhdGVDdXJyZW50VGltZSgpIHtcbiAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSBjYXBUaW1lKCh0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3VycmVudFRpbWUgLSB0aGlzLl9zdGFydGVkQXQpICogdGhpcy5fcGl0Y2ggKyB0aGlzLl9jdXJyZW50T2Zmc2V0LCB0aGlzLmR1cmF0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAnZGVzdHJveScgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hbmFnZXJEZXN0cm95KCkge1xuICAgICAgICBpZiAodGhpcy5zb3VyY2UgJiYgdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0b3AoMCk7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmlmICghaGFzQXVkaW9Db250ZXh0KCkpIHtcbiAgICBPYmplY3QuYXNzaWduKFNvdW5kSW5zdGFuY2UucHJvdG90eXBlLCB7XG4gICAgICAgIHBsYXk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfU1RPUFBFRCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9jcmVhdGVTb3VyY2UoKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgICAgIHRoaXMucGl0Y2ggPSB0aGlzLl9waXRjaDtcbiAgICAgICAgICAgIHRoaXMubG9vcCA9IHRoaXMuX2xvb3A7XG5cbiAgICAgICAgICAgIHRoaXMuc291cmNlLnBsYXkoKTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUExBWUlORztcbiAgICAgICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3ZvbHVtZWNoYW5nZScsIHRoaXMuX29uTWFuYWdlclZvbHVtZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdzdXNwZW5kJywgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdyZXN1bWUnLCB0aGlzLl9vbk1hbmFnZXJSZXN1bWUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbignZGVzdHJveScsIHRoaXMuX29uTWFuYWdlckRlc3Ryb3ksIHRoaXMpO1xuXG4gICAgICAgICAgICAvLyBzdXNwZW5kIGltbWVkaWF0ZWx5IGlmIG1hbmFnZXIgaXMgc3VzcGVuZGVkXG4gICAgICAgICAgICBpZiAodGhpcy5fbWFuYWdlci5zdXNwZW5kZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCgpO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLl9vblBsYXkoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgfSxcblxuICAgICAgICBwYXVzZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSB8fCB0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfUExBWUlORylcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCsrO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTtcbiAgICAgICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BBVVNFRDtcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5fb25QYXVzZSgpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICByZXN1bWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zb3VyY2UgfHwgdGhpcy5fc3RhdGUgIT09IFNUQVRFX1BBVVNFRClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUExBWUlORztcbiAgICAgICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UucGF1c2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheSgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uUmVzdW1lKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zb3VyY2UgfHwgdGhpcy5fc3RhdGUgPT09IFNUQVRFX1NUT1BQRUQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZigndm9sdW1lY2hhbmdlJywgdGhpcy5fb25NYW5hZ2VyVm9sdW1lQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdzdXNwZW5kJywgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZigncmVzdW1lJywgdGhpcy5fb25NYW5hZ2VyUmVzdW1lLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdkZXN0cm95JywgdGhpcy5fb25NYW5hZ2VyRGVzdHJveSwgdGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCsrO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTtcbiAgICAgICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1NUT1BQRUQ7XG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgICAgIHRoaXMuX29uU3RvcCgpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXRFeHRlcm5hbE5vZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBub3Qgc3VwcG9ydGVkXG4gICAgICAgIH0sXG5cbiAgICAgICAgY2xlYXJFeHRlcm5hbE5vZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBub3Qgc3VwcG9ydGVkXG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0RXh0ZXJuYWxOb2RlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBidXQgcmV0dXJuIHNhbWUgdHlwZSBvZiByZXN1bHRcbiAgICAgICAgICAgIHJldHVybiBbbnVsbCwgbnVsbF07XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gU2V0cyBzdGFydCB0aW1lIGFmdGVyIGxvYWRlZG1ldGFkYXRhIGlzIGZpcmVkIHdoaWNoIGlzIHJlcXVpcmVkIGJ5IG1vc3QgYnJvd3NlcnNcbiAgICAgICAgX29uTG9hZGVkTWV0YWRhdGE6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy5fbG9hZGVkTWV0YWRhdGFIYW5kbGVyKTtcblxuICAgICAgICAgICAgdGhpcy5faXNSZWFkeSA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBzdGFydCB0aW1lIGZvciBzb3VyY2VcbiAgICAgICAgICAgIGxldCBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0T2Zmc2V0LCB0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgb2Zmc2V0LCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG4gICAgICAgICAgICAvLyByZXNldCBjdXJyZW50VGltZVxuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBzZXQgb2Zmc2V0IG9uIHNvdXJjZVxuICAgICAgICAgICAgdGhpcy5zb3VyY2UuY3VycmVudFRpbWUgPSBvZmZzZXQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgX2NyZWF0ZVNvdXJjZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdW5kICYmIHRoaXMuX3NvdW5kLmF1ZGlvKSB7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9pc1JlYWR5ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSB0aGlzLl9zb3VuZC5hdWRpby5jbG9uZU5vZGUodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgZXZlbnRzXG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLl9sb2FkZWRNZXRhZGF0YUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB0aGlzLl90aW1lVXBkYXRlSGFuZGxlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2Uub25lbmRlZCA9IHRoaXMuX2VuZGVkSGFuZGxlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIGNhbGxlZCBldmVyeSB0aW1lIHRoZSAnY3VycmVudFRpbWUnIGlzIGNoYW5nZWRcbiAgICAgICAgX29uVGltZVVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9kdXJhdGlvbilcbiAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBjdXJyZW50VGltZSBwYXNzZXMgdGhlIGVuZCB0aGVuIGlmIGxvb3BpbmcgZ28gYmFjayB0byB0aGUgYmVnaW5uaW5nXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgbWFudWFsbHkgc3RvcFxuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlLmN1cnJlbnRUaW1lID4gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyB0aGlzLl9kdXJhdGlvbiwgdGhpcy5zb3VyY2UuZHVyYXRpb24pKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubG9vcCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5jdXJyZW50VGltZSA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lLCB0aGlzLnNvdXJjZS5kdXJhdGlvbik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGxpc3RlbmVyIHRvIHByZXZlbnQgbXVsdGlwbGUgY2FsbHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHRoaXMuX3RpbWVVcGRhdGVIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjYWxsIHRoaXMgbWFudWFsbHkgYmVjYXVzZSBpdCBkb2Vzbid0IHdvcmsgaW4gYWxsIGJyb3dzZXJzIGluIHRoaXMgY2FzZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkVuZGVkKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIF9vbk1hbmFnZXJEZXN0cm95OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5wYXVzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291bmRJbnN0YW5jZS5wcm90b3R5cGUsICd2b2x1bWUnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2b2x1bWUpIHtcbiAgICAgICAgICAgIHZvbHVtZSA9IG1hdGguY2xhbXAodm9sdW1lLCAwLCAxKTtcbiAgICAgICAgICAgIHRoaXMuX3ZvbHVtZSA9IHZvbHVtZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnZvbHVtZSA9IHZvbHVtZSAqIHRoaXMuX21hbmFnZXIudm9sdW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291bmRJbnN0YW5jZS5wcm90b3R5cGUsICdwaXRjaCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcGl0Y2g7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocGl0Y2gpIHtcbiAgICAgICAgICAgIHRoaXMuX3BpdGNoID0gTWF0aC5tYXgoTnVtYmVyKHBpdGNoKSB8fCAwLCAwLjAxKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnBsYXliYWNrUmF0ZSA9IHRoaXMuX3BpdGNoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291bmRJbnN0YW5jZS5wcm90b3R5cGUsICdzb3VuZCcsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc291bmQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICAgICAgdGhpcy5fc291bmQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU291bmRJbnN0YW5jZS5wcm90b3R5cGUsICdjdXJyZW50VGltZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3RhcnRPZmZzZXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc3RhcnRPZmZzZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRCB8fCAhdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlLmN1cnJlbnRUaW1lIC0gdGhpcy5fc3RhcnRUaW1lO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPCAwKSByZXR1cm47XG5cbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gdmFsdWU7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UgJiYgdGhpcy5faXNSZWFkeSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLmN1cnJlbnRUaW1lID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyBjYXBUaW1lKHZhbHVlLCB0aGlzLmR1cmF0aW9uKSwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5leHBvcnQgeyBTb3VuZEluc3RhbmNlIH07XG4iXSwibmFtZXMiOlsiU1RBVEVfUExBWUlORyIsIlNUQVRFX1BBVVNFRCIsIlNUQVRFX1NUT1BQRUQiLCJjYXBUaW1lIiwidGltZSIsImR1cmF0aW9uIiwiU291bmRJbnN0YW5jZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsInNvdW5kIiwib3B0aW9ucyIsInNvdXJjZSIsIl9tYW5hZ2VyIiwiX3ZvbHVtZSIsInZvbHVtZSIsInVuZGVmaW5lZCIsIm1hdGgiLCJjbGFtcCIsIk51bWJlciIsIl9waXRjaCIsInBpdGNoIiwiTWF0aCIsIm1heCIsIl9sb29wIiwibG9vcCIsIl9zb3VuZCIsIl9zdGF0ZSIsIl9zdXNwZW5kZWQiLCJfc3VzcGVuZEVuZEV2ZW50IiwiX3N1c3BlbmRJbnN0YW5jZUV2ZW50cyIsIl9wbGF5V2hlbkxvYWRlZCIsIl9zdGFydFRpbWUiLCJzdGFydFRpbWUiLCJfZHVyYXRpb24iLCJfc3RhcnRPZmZzZXQiLCJfb25QbGF5Q2FsbGJhY2siLCJvblBsYXkiLCJfb25QYXVzZUNhbGxiYWNrIiwib25QYXVzZSIsIl9vblJlc3VtZUNhbGxiYWNrIiwib25SZXN1bWUiLCJfb25TdG9wQ2FsbGJhY2siLCJvblN0b3AiLCJfb25FbmRDYWxsYmFjayIsIm9uRW5kIiwiaGFzQXVkaW9Db250ZXh0IiwiX3N0YXJ0ZWRBdCIsIl9jdXJyZW50VGltZSIsIl9jdXJyZW50T2Zmc2V0IiwiX2lucHV0Tm9kZSIsIl9jb25uZWN0b3JOb2RlIiwiX2ZpcnN0Tm9kZSIsIl9sYXN0Tm9kZSIsIl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24iLCJfaW5pdGlhbGl6ZU5vZGVzIiwiX2VuZGVkSGFuZGxlciIsIl9vbkVuZGVkIiwiYmluZCIsIl9pc1JlYWR5IiwiX2xvYWRlZE1ldGFkYXRhSGFuZGxlciIsIl9vbkxvYWRlZE1ldGFkYXRhIiwiX3RpbWVVcGRhdGVIYW5kbGVyIiwiX29uVGltZVVwZGF0ZSIsIl9jcmVhdGVTb3VyY2UiLCJjdXJyZW50VGltZSIsInZhbHVlIiwic3VzcGVuZCIsInN0b3AiLCJwbGF5IiwiX3VwZGF0ZUN1cnJlbnRUaW1lIiwiaXNQbGF5aW5nIiwiaXNQYXVzZWQiLCJpc1N0b3BwZWQiLCJpc1N1c3BlbmRlZCIsImNvbnRleHQiLCJwbGF5YmFja1JhdGUiLCJnYWluIiwiX29uUGxheSIsImZpcmUiLCJfb25QYXVzZSIsIl9vblJlc3VtZSIsIl9vblN0b3AiLCJfb25NYW5hZ2VyVm9sdW1lQ2hhbmdlIiwiX29uTWFuYWdlclN1c3BlbmQiLCJwYXVzZSIsIl9vbk1hbmFnZXJSZXN1bWUiLCJyZXN1bWUiLCJjcmVhdGVHYWluIiwiY29ubmVjdCIsImRlc3RpbmF0aW9uIiwic3VzcGVuZGVkIiwib25jZSIsIl9wbGF5QXVkaW9JbW1lZGlhdGUiLCJvZmZzZXQiLCJzdGFydCIsIm9uIiwiX29uTWFuYWdlckRlc3Ryb3kiLCJ3YXNQbGF5aW5nIiwib2ZmIiwic2V0RXh0ZXJuYWxOb2RlcyIsImZpcnN0Tm9kZSIsImxhc3ROb2RlIiwiY29uc29sZSIsImVycm9yIiwic3BlYWtlcnMiLCJkaXNjb25uZWN0IiwiY2xlYXJFeHRlcm5hbE5vZGVzIiwiZ2V0RXh0ZXJuYWxOb2RlcyIsImJ1ZmZlciIsImNyZWF0ZUJ1ZmZlclNvdXJjZSIsIm9uZW5kZWQiLCJsb29wU3RhcnQiLCJsb29wRW5kIiwiT2JqZWN0IiwiYXNzaWduIiwicHJvdG90eXBlIiwicGF1c2VkIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImF1ZGlvIiwiY2xvbmVOb2RlIiwiYWRkRXZlbnRMaXN0ZW5lciIsImRlZmluZVByb3BlcnR5IiwiZ2V0Iiwic2V0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFNQSxNQUFNQSxhQUFhLEdBQUcsQ0FBQyxDQUFBO0FBQ3ZCLE1BQU1DLFlBQVksR0FBRyxDQUFDLENBQUE7QUFDdEIsTUFBTUMsYUFBYSxHQUFHLENBQUMsQ0FBQTs7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
