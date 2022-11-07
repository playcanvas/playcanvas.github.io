/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFuY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9zb3VuZC9pbnN0YW5jZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQgeyBoYXNBdWRpb0NvbnRleHQgfSBmcm9tICcuLi9hdWRpby9jYXBhYmlsaXRpZXMuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9zb3VuZC5qcycpLlNvdW5kfSBTb3VuZCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn0gU291bmRNYW5hZ2VyICovXG5cbmNvbnN0IFNUQVRFX1BMQVlJTkcgPSAwO1xuY29uc3QgU1RBVEVfUEFVU0VEID0gMTtcbmNvbnN0IFNUQVRFX1NUT1BQRUQgPSAyO1xuXG4vKipcbiAqIFJldHVybiB0aW1lICUgZHVyYXRpb24gYnV0IGFsd2F5cyByZXR1cm4gYSBudW1iZXIgaW5zdGVhZCBvZiBOYU4gd2hlbiBkdXJhdGlvbiBpcyAwLlxuICpcbiAqIEBwYXJhbSB7bnVtYmVyfSB0aW1lIC0gVGhlIHRpbWUuXG4gKiBAcGFyYW0ge251bWJlcn0gZHVyYXRpb24gLSBUaGUgZHVyYXRpb24uXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgdGltZSAlIGR1cmF0aW9uLlxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBjYXBUaW1lKHRpbWUsIGR1cmF0aW9uKSB7XG4gICAgcmV0dXJuICh0aW1lICUgZHVyYXRpb24pIHx8IDA7XG59XG5cbi8qKlxuICogQSBTb3VuZEluc3RhbmNlIHBsYXlzIGEge0BsaW5rIFNvdW5kfS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFNvdW5kSW5zdGFuY2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHNvdXJjZSB0aGF0IHBsYXlzIHRoZSBzb3VuZCByZXNvdXJjZS4gSWYgdGhlIFdlYiBBdWRpbyBBUEkgaXMgbm90IHN1cHBvcnRlZCB0aGVcbiAgICAgKiB0eXBlIG9mIHNvdXJjZSBpcyBbQXVkaW9dKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0hUTUwvRWxlbWVudC9hdWRpbykuXG4gICAgICogU291cmNlIGlzIG9ubHkgYXZhaWxhYmxlIGFmdGVyIGNhbGxpbmcgcGxheS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBdWRpb0J1ZmZlclNvdXJjZU5vZGV9XG4gICAgICovXG4gICAgc291cmNlID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTb3VuZEluc3RhbmNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTb3VuZE1hbmFnZXJ9IG1hbmFnZXIgLSBUaGUgc291bmQgbWFuYWdlci5cbiAgICAgKiBAcGFyYW0ge1NvdW5kfSBzb3VuZCAtIFRoZSBzb3VuZCB0byBwbGF5LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gT3B0aW9ucyBmb3IgdGhlIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy52b2x1bWU9MV0gLSBUaGUgcGxheWJhY2sgdm9sdW1lLCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnBpdGNoPTFdIC0gVGhlIHJlbGF0aXZlIHBpdGNoLCBkZWZhdWx0IG9mIDEsIHBsYXlzIGF0IG5vcm1hbCBwaXRjaC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmxvb3A9ZmFsc2VdIC0gV2hldGhlciB0aGUgc291bmQgc2hvdWxkIGxvb3Agd2hlbiBpdCByZWFjaGVzIHRoZVxuICAgICAqIGVuZCBvciBub3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0VGltZT0wXSAtIFRoZSB0aW1lIGZyb20gd2hpY2ggdGhlIHBsYXliYWNrIHdpbGwgc3RhcnQgaW5cbiAgICAgKiBzZWNvbmRzLiBEZWZhdWx0IGlzIDAgdG8gc3RhcnQgYXQgdGhlIGJlZ2lubmluZy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZHVyYXRpb249MF0gLSBUaGUgdG90YWwgdGltZSBhZnRlciB0aGUgc3RhcnRUaW1lIGluIHNlY29uZHMgd2hlblxuICAgICAqIHBsYXliYWNrIHdpbGwgc3RvcCBvciByZXN0YXJ0IGlmIGxvb3AgaXMgdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblBsYXk9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2Ugc3RhcnRzIHBsYXlpbmcuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25QYXVzZT1udWxsXSAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyBwYXVzZWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25SZXN1bWU9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgcmVzdW1lZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblN0b3A9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgc3RvcHBlZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vbkVuZD1udWxsXSAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBpbnN0YW5jZSBlbmRzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIsIHNvdW5kLCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtTb3VuZE1hbmFnZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9tYW5hZ2VyID0gbWFuYWdlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IG9wdGlvbnMudm9sdW1lICE9PSB1bmRlZmluZWQgPyBtYXRoLmNsYW1wKE51bWJlcihvcHRpb25zLnZvbHVtZSkgfHwgMCwgMCwgMSkgOiAxO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcGl0Y2ggPSBvcHRpb25zLnBpdGNoICE9PSB1bmRlZmluZWQgPyBNYXRoLm1heCgwLjAxLCBOdW1iZXIob3B0aW9ucy5waXRjaCkgfHwgMCkgOiAxO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xvb3AgPSAhIShvcHRpb25zLmxvb3AgIT09IHVuZGVmaW5lZCA/IG9wdGlvbnMubG9vcCA6IGZhbHNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1NvdW5kfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc291bmQgPSBzb3VuZDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RhcnQgYXQgJ3N0b3BwZWQnLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9TVE9QUEVEO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBtYW5hZ2VyIHdhcyBzdXNwZW5kZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3VzcGVuZGVkID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdyZWF0ZXIgdGhhbiAwIGlmIHdlIHdhbnQgdG8gc3VzcGVuZCB0aGUgZXZlbnQgaGFuZGxlZCB0byB0aGUgJ29uZW5kZWQnIGV2ZW50LlxuICAgICAgICAgKiBXaGVuIGFuICdvbmVuZGVkJyBldmVudCBpcyBzdXNwZW5kZWQsIHRoaXMgY291bnRlciBpcyBkZWNyZW1lbnRlZCBieSAxLlxuICAgICAgICAgKiBXaGVuIGEgZnV0dXJlICdvbmVuZGVkJyBldmVudCBpcyB0byBiZSBzdXNwZW5kZWQsIHRoaXMgY291bnRlciBpcyBpbmNyZW1lbnRlZCBieSAxLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50ID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1ZSBpZiB3ZSB3YW50IHRvIHN1c3BlbmQgZmlyaW5nIGluc3RhbmNlIGV2ZW50cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgdHJ1ZSB0aGVuIHRoZSBpbnN0YW5jZSB3aWxsIHN0YXJ0IHBsYXlpbmcgaXRzIHNvdXJjZSB3aGVuIGl0cyBjcmVhdGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcihvcHRpb25zLnN0YXJ0VGltZSkgfHwgMCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IE1hdGgubWF4KDAsIE51bWJlcihvcHRpb25zLmR1cmF0aW9uKSB8fCAwKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcnxudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGV4dGVybmFsIGV2ZW50IGhhbmRsZXJzXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vblBsYXlDYWxsYmFjayA9IG9wdGlvbnMub25QbGF5O1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fb25QYXVzZUNhbGxiYWNrID0gb3B0aW9ucy5vblBhdXNlO1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fb25SZXN1bWVDYWxsYmFjayA9IG9wdGlvbnMub25SZXN1bWU7XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9vblN0b3BDYWxsYmFjayA9IG9wdGlvbnMub25TdG9wO1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fb25FbmRDYWxsYmFjayA9IG9wdGlvbnMub25FbmQ7XG5cbiAgICAgICAgaWYgKGhhc0F1ZGlvQ29udGV4dCgpKSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9zdGFydGVkQXQgPSAwO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIE1hbnVhbGx5IGtlZXAgdHJhY2sgb2YgdGhlIHBsYXliYWNrIHBvc2l0aW9uIGJlY2F1c2UgdGhlIFdlYiBBdWRpbyBBUEkgZG9lcyBub3RcbiAgICAgICAgICAgICAqIHByb3ZpZGUgYSB3YXkgdG8gZG8gdGhpcyBhY2N1cmF0ZWx5IGlmIHRoZSBwbGF5YmFja1JhdGUgaXMgbm90IDEuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRUaW1lID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IDA7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGlucHV0IG5vZGUgaXMgdGhlIG9uZSB0aGF0IGlzIGNvbm5lY3RlZCB0byB0aGUgc291cmNlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtBdWRpb05vZGV8bnVsbH1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2lucHV0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGNvbm5lY3RlZCBub2RlIGlzIHRoZSBvbmUgdGhhdCBpcyBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIChzcGVha2VycykuIEFueVxuICAgICAgICAgICAgICogZXh0ZXJuYWwgbm9kZXMgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhpcyBub2RlLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtBdWRpb05vZGV8bnVsbH1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBmaXJzdCBleHRlcm5hbCBub2RlIHNldCBieSBhIHVzZXIuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0F1ZGlvTm9kZXxudWxsfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgbGFzdCBleHRlcm5hbCBub2RlIHNldCBieSBhIHVzZXIuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0F1ZGlvTm9kZXxudWxsfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFNldCB0byB0cnVlIGlmIGEgcGxheSgpIHJlcXVlc3Qgd2FzIGlzc3VlZCB3aGVuIHRoZSBBdWRpb0NvbnRleHQgd2FzIHN0aWxsIHN1c3BlbmRlZCxcbiAgICAgICAgICAgICAqIGFuZCB3aWxsIHRoZXJlZm9yZSB3YWl0IHVudGlsIGl0IGlzIHJlc3VtZWQgdG8gcGxheSB0aGUgYXVkaW8uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24gPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5faW5pdGlhbGl6ZU5vZGVzKCk7XG5cbiAgICAgICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICAgICAgdGhpcy5fZW5kZWRIYW5kbGVyID0gdGhpcy5fb25FbmRlZC5iaW5kKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl9pc1JlYWR5ID0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICAgICAgdGhpcy5fbG9hZGVkTWV0YWRhdGFIYW5kbGVyID0gdGhpcy5fb25Mb2FkZWRNZXRhZGF0YS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl90aW1lVXBkYXRlSGFuZGxlciA9IHRoaXMuX29uVGltZVVwZGF0ZS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgICAgICB0aGlzLl9lbmRlZEhhbmRsZXIgPSB0aGlzLl9vbkVuZGVkLmJpbmQodGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdXJjZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgaW5zdGFuY2Ugc3RhcnRzIHBsYXlpbmcgaXRzIHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZEluc3RhbmNlI3BsYXlcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluc3RhbmNlIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZEluc3RhbmNlI3BhdXNlXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyByZXN1bWVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kSW5zdGFuY2UjcmVzdW1lXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyBzdG9wcGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNvdW5kSW5zdGFuY2Ujc3RvcFxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgc291bmQgY3VycmVudGx5IHBsYXllZCBieSB0aGUgaW5zdGFuY2UgZW5kcy5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZEluc3RhbmNlI2VuZFxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogR2V0cyBvciBzZXRzIHRoZSBjdXJyZW50IHRpbWUgb2YgdGhlIHNvdW5kIHRoYXQgaXMgcGxheWluZy4gSWYgdGhlIHZhbHVlIHByb3ZpZGVkIGlzIGJpZ2dlclxuICAgICAqIHRoYW4gdGhlIGR1cmF0aW9uIG9mIHRoZSBpbnN0YW5jZSBpdCB3aWxsIHdyYXAgZnJvbSB0aGUgYmVnaW5uaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY3VycmVudFRpbWUodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlIDwgMCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORykge1xuICAgICAgICAgICAgY29uc3Qgc3VzcGVuZCA9IHRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cztcbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cyA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIHN0b3AgZmlyc3Qgd2hpY2ggd2lsbCBzZXQgX3N0YXJ0T2Zmc2V0IHRvIG51bGxcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuXG4gICAgICAgICAgICAvLyBzZXQgX3N0YXJ0T2Zmc2V0IGFuZCBwbGF5XG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMgPSBzdXNwZW5kO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gc2V0IF9zdGFydE9mZnNldCB3aGljaCB3aWxsIGJlIHVzZWQgd2hlbiB0aGUgaW5zdGFuY2Ugd2lsbCBzdGFydCBwbGF5aW5nXG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IHZhbHVlO1xuICAgICAgICAgICAgLy8gc2V0IF9jdXJyZW50VGltZVxuICAgICAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXJyZW50VGltZSgpIHtcbiAgICAgICAgLy8gaWYgdGhlIHVzZXIgaGFzIHNldCB0aGUgY3VycmVudFRpbWUgYW5kIHdlIGhhdmUgbm90IHVzZWQgaXQgeWV0XG4gICAgICAgIC8vIHRoZW4ganVzdCByZXR1cm4gdGhhdFxuICAgICAgICBpZiAodGhpcy5fc3RhcnRPZmZzZXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zdGFydE9mZnNldDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBzb3VuZCBpcyBwYXVzZWQgcmV0dXJuIHRoZSBjdXJyZW50VGltZSBjYWxjdWxhdGVkIHdoZW5cbiAgICAgICAgLy8gcGF1c2UoKSB3YXMgY2FsbGVkXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUEFVU0VEKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudFRpbWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgc291bmQgaXMgc3RvcHBlZCBvciB3ZSBkb24ndCBoYXZlIGEgc291cmNlXG4gICAgICAgIC8vIHJldHVybiAwXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRCB8fCAhdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVjYWxjdWxhdGUgY3VycmVudCB0aW1lXG4gICAgICAgIHRoaXMuX3VwZGF0ZUN1cnJlbnRUaW1lKCk7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXJyZW50VGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZHVyYXRpb24gb2YgdGhlIHNvdW5kIHRoYXQgdGhlIGluc3RhbmNlIHdpbGwgcGxheSBzdGFydGluZyBmcm9tIHN0YXJ0VGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGR1cmF0aW9uKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2R1cmF0aW9uID0gTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlKSB8fCAwKTtcblxuICAgICAgICAvLyByZXN0YXJ0XG4gICAgICAgIGNvbnN0IGlzUGxheWluZyA9IHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HO1xuICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgaWYgKGlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZHVyYXRpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5fc291bmQpIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIGNhcFRpbWUodGhpcy5fZHVyYXRpb24sIHRoaXMuX3NvdW5kLmR1cmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc291bmQuZHVyYXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBpbnN0YW5jZSBpcyBjdXJyZW50bHkgcGF1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGF1c2VkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BBVVNFRDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGluc3RhbmNlIGlzIGN1cnJlbnRseSBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzUGxheWluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgaW5zdGFuY2UgaXMgY3VycmVudGx5IHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNTdG9wcGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1NUT1BQRUQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBpbnN0YW5jZSBpcyBjdXJyZW50bHkgc3VzcGVuZGVkIGJlY2F1c2UgdGhlIHdpbmRvdyBpcyBub3QgZm9jdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1N1c3BlbmRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1c3BlbmRlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBpbnN0YW5jZSB3aWxsIHJlc3RhcnQgd2hlbiBpdCBmaW5pc2hlcyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGxvb3AodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbG9vcCA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbG9vcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvb3A7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBpdGNoIG1vZGlmaWVyIHRvIHBsYXkgdGhlIHNvdW5kIHdpdGguIE11c3QgYmUgbGFyZ2VyIHRoYW4gMC4wMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHBpdGNoKHBpdGNoKSB7XG4gICAgICAgIC8vIHNldCBvZmZzZXQgdG8gY3VycmVudCB0aW1lIHNvIHRoYXRcbiAgICAgICAgLy8gd2UgY2FsY3VsYXRlIHRoZSByZXN0IG9mIHRoZSB0aW1lIHdpdGggdGhlIG5ldyBwaXRjaFxuICAgICAgICAvLyBmcm9tIG5vdyBvblxuICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gdGhpcy5jdXJyZW50VGltZTtcbiAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmN1cnJlbnRUaW1lO1xuXG4gICAgICAgIHRoaXMuX3BpdGNoID0gTWF0aC5tYXgoTnVtYmVyKHBpdGNoKSB8fCAwLCAwLjAxKTtcbiAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5wbGF5YmFja1JhdGUudmFsdWUgPSB0aGlzLl9waXRjaDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwaXRjaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BpdGNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBzb3VuZCByZXNvdXJjZSB0aGF0IHRoZSBpbnN0YW5jZSB3aWxsIHBsYXkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U291bmR9XG4gICAgICovXG4gICAgc2V0IHNvdW5kKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NvdW5kID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9TVE9QUEVEKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdXJjZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNvdW5kKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc291bmQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHN0YXJ0IHRpbWUgZnJvbSB3aGljaCB0aGUgc291bmQgd2lsbCBzdGFydCBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc3RhcnRUaW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3N0YXJ0VGltZSA9IE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZSkgfHwgMCk7XG5cbiAgICAgICAgLy8gcmVzdGFydFxuICAgICAgICBjb25zdCBpc1BsYXlpbmcgPSB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORztcbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIGlmIChpc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucGxheSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHN0YXJ0VGltZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0VGltZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdm9sdW1lIG1vZGlmaWVyIHRvIHBsYXkgdGhlIHNvdW5kIHdpdGguIEluIHJhbmdlIDAtMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHZvbHVtZSh2b2x1bWUpIHtcbiAgICAgICAgdm9sdW1lID0gbWF0aC5jbGFtcCh2b2x1bWUsIDAsIDEpO1xuICAgICAgICB0aGlzLl92b2x1bWUgPSB2b2x1bWU7XG4gICAgICAgIGlmICh0aGlzLmdhaW4pIHtcbiAgICAgICAgICAgIHRoaXMuZ2Fpbi5nYWluLnZhbHVlID0gdm9sdW1lICogdGhpcy5fbWFuYWdlci52b2x1bWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdm9sdW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblBsYXkoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncGxheScpO1xuXG4gICAgICAgIGlmICh0aGlzLl9vblBsYXlDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uUGxheUNhbGxiYWNrKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblBhdXNlKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3BhdXNlJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uUGF1c2VDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uUGF1c2VDYWxsYmFjayh0aGlzKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25SZXN1bWUoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgncmVzdW1lJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX29uUmVzdW1lQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9vblJlc3VtZUNhbGxiYWNrKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblN0b3AoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgnc3RvcCcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9vblN0b3BDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uU3RvcENhbGxiYWNrKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vbkVuZGVkKCkge1xuICAgICAgICAvLyB0aGUgY2FsbGJhY2sgaXMgbm90IGZpcmVkIHN5bmNocm9ub3VzbHlcbiAgICAgICAgLy8gc28gb25seSBkZWNyZW1lbnQgX3N1c3BlbmRFbmRFdmVudCB3aGVuIHRoZVxuICAgICAgICAvLyBjYWxsYmFjayBpcyBmaXJlZFxuICAgICAgICBpZiAodGhpcy5fc3VzcGVuZEVuZEV2ZW50ID4gMCkge1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50LS07XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ2VuZCcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9vbkVuZENhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25FbmRDYWxsYmFjayh0aGlzKTtcblxuICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAndm9sdW1lY2hhbmdlJyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWFuYWdlclZvbHVtZUNoYW5nZSgpIHtcbiAgICAgICAgdGhpcy52b2x1bWUgPSB0aGlzLl92b2x1bWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIHRoZSBtYW5hZ2VyJ3MgJ3N1c3BlbmQnIGV2ZW50LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYW5hZ2VyU3VzcGVuZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HICYmICF0aGlzLl9zdXNwZW5kZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIG1hbmFnZXIncyAncmVzdW1lJyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWFuYWdlclJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N1c3BlbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnJlc3VtZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBpbnRlcm5hbCBhdWRpbyBub2RlcyBhbmQgY29ubmVjdHMgdGhlbS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2luaXRpYWxpemVOb2RlcygpIHtcbiAgICAgICAgLy8gY3JlYXRlIGdhaW4gbm9kZSBmb3Igdm9sdW1lIGNvbnRyb2xcbiAgICAgICAgdGhpcy5nYWluID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICAgICAgdGhpcy5faW5wdXROb2RlID0gdGhpcy5nYWluO1xuICAgICAgICAvLyB0aGUgZ2FpbiBub2RlIGlzIGFsc28gdGhlIGNvbm5lY3RvciBub2RlIGZvciAyRCBzb3VuZCBpbnN0YW5jZXNcbiAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZSA9IHRoaXMuZ2FpbjtcbiAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5jb25uZWN0KHRoaXMuX21hbmFnZXIuY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0ZW1wdCB0byBiZWdpbiBwbGF5YmFjayB0aGUgc291bmQuXG4gICAgICogSWYgdGhlIEF1ZGlvQ29udGV4dCBpcyBzdXNwZW5kZWQsIHRoZSBhdWRpbyB3aWxsIG9ubHkgc3RhcnQgb25jZSBpdCdzIHJlc3VtZWQuXG4gICAgICogSWYgdGhlIHNvdW5kIGlzIGFscmVhZHkgcGxheWluZywgdGhpcyB3aWxsIHJlc3RhcnQgdGhlIHNvdW5kLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNvdW5kIHdhcyBzdGFydGVkIGltbWVkaWF0ZWx5LlxuICAgICAqL1xuICAgIHBsYXkoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfU1RPUFBFRCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IHN0YXRlIHRvIHBsYXlpbmdcbiAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QTEFZSU5HO1xuICAgICAgICAvLyBubyBuZWVkIGZvciB0aGlzIGFueW1vcmVcbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICAvLyBwbGF5KCkgd2FzIGFscmVhZHkgaXNzdWVkIGJ1dCBoYXNuJ3QgYWN0dWFsbHkgc3RhcnRlZCB5ZXRcbiAgICAgICAgaWYgKHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFuYWdlciBpcyBzdXNwZW5kZWQgc28gYXVkaW8gY2Fubm90IHN0YXJ0IG5vdyAtIHdhaXQgZm9yIG1hbmFnZXIgdG8gcmVzdW1lXG4gICAgICAgIGlmICh0aGlzLl9tYW5hZ2VyLnN1c3BlbmRlZCkge1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbmNlKCdyZXN1bWUnLCB0aGlzLl9wbGF5QXVkaW9JbW1lZGlhdGUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uID0gdHJ1ZTtcblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcGxheUF1ZGlvSW1tZWRpYXRlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW1tZWRpYXRlbHkgcGxheSB0aGUgc291bmQuXG4gICAgICogVGhpcyBtZXRob2QgYXNzdW1lcyB0aGUgQXVkaW9Db250ZXh0IGlzIHJlYWR5IChub3Qgc3VzcGVuZGVkIG9yIGxvY2tlZCkuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wbGF5QXVkaW9JbW1lZGlhdGUoKSB7XG4gICAgICAgIHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbiA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGJldHdlZW4gcGxheSgpIGFuZCB0aGUgbWFuYWdlciBiZWluZyByZWFkeSB0byBwbGF5LCBhIHN0b3AoKSBvciBwYXVzZSgpIGNhbGwgd2FzIG1hZGVcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9QTEFZSU5HKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVTb3VyY2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBzdGFydCBvZmZzZXRcbiAgICAgICAgbGV0IG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRPZmZzZXQsIHRoaXMuZHVyYXRpb24pO1xuICAgICAgICBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIG9mZnNldCwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuICAgICAgICAvLyByZXNldCBzdGFydCBvZmZzZXQgbm93IHRoYXQgd2Ugc3RhcnRlZCB0aGUgc291bmRcbiAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgIC8vIHN0YXJ0IHNvdXJjZSB3aXRoIHNwZWNpZmllZCBvZmZzZXQgYW5kIGR1cmF0aW9uXG4gICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgb2Zmc2V0LCB0aGlzLl9kdXJhdGlvbik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwLCBvZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzZXQgdGltZXNcbiAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmN1cnJlbnRUaW1lO1xuICAgICAgICB0aGlzLl9jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRPZmZzZXQgPSBvZmZzZXQ7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSB2b2x1bWUgYW5kIGxvb3AgLSBub3RlIG1vdmVkIHRvIGJlIGFmdGVyIHN0YXJ0KCkgYmVjYXVzZSBvZiBDaHJvbWUgYnVnXG4gICAgICAgIHRoaXMudm9sdW1lID0gdGhpcy5fdm9sdW1lO1xuICAgICAgICB0aGlzLmxvb3AgPSB0aGlzLl9sb29wO1xuICAgICAgICB0aGlzLnBpdGNoID0gdGhpcy5fcGl0Y2g7XG5cbiAgICAgICAgLy8gaGFuZGxlIHN1c3BlbmQgZXZlbnRzIC8gdm9sdW1lY2hhbmdlIGV2ZW50c1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdzdXNwZW5kJywgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3Jlc3VtZScsIHRoaXMuX29uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub24oJ2Rlc3Ryb3knLCB0aGlzLl9vbk1hbmFnZXJEZXN0cm95LCB0aGlzKTtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cykge1xuICAgICAgICAgICAgdGhpcy5fb25QbGF5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXVzZXMgcGxheWJhY2sgb2Ygc291bmQuIENhbGwgcmVzdW1lKCkgdG8gcmVzdW1lIHBsYXliYWNrIGZyb20gdGhlIHNhbWUgcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBzb3VuZCB3YXMgcGF1c2VkLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICAvLyBubyBuZWVkIGZvciB0aGlzIGFueW1vcmVcbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1BMQVlJTkcpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gc2V0IHN0YXRlIHRvIHBhdXNlZFxuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BBVVNFRDtcblxuICAgICAgICAvLyBwbGF5KCkgd2FzIGlzc3VlZCBidXQgaGFzbid0IGFjdHVhbGx5IHN0YXJ0ZWQgeWV0LlxuICAgICAgICBpZiAodGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0b3JlIGN1cnJlbnQgdGltZVxuICAgICAgICB0aGlzLl91cGRhdGVDdXJyZW50VGltZSgpO1xuXG4gICAgICAgIC8vIFN0b3AgdGhlIHNvdXJjZSBhbmQgcmUtY3JlYXRlIGl0IGJlY2F1c2Ugd2UgY2Fubm90IHJldXNlIHRoZSBzYW1lIHNvdXJjZS5cbiAgICAgICAgLy8gU3VzcGVuZCB0aGUgZW5kIGV2ZW50IGFzIHdlIGFyZSBtYW51YWxseSBzdG9wcGluZyB0aGUgc291cmNlXG4gICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCsrO1xuICAgICAgICB0aGlzLnNvdXJjZS5zdG9wKDApO1xuICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG5cbiAgICAgICAgLy8gcmVzZXQgdXNlci1zZXQgc3RhcnQgb2Zmc2V0XG4gICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgIHRoaXMuX29uUGF1c2UoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIHBsYXliYWNrIG9mIHRoZSBzb3VuZC4gUGxheWJhY2sgcmVzdW1lcyBhdCB0aGUgcG9pbnQgdGhhdCB0aGUgYXVkaW8gd2FzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgdGhlIHNvdW5kIHdhcyByZXN1bWVkLlxuICAgICAqL1xuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9QQVVTRUQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBzdGF0ZSBiYWNrIHRvIHBsYXlpbmdcbiAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QTEFZSU5HO1xuXG4gICAgICAgIC8vIHBsYXkoKSB3YXMgaXNzdWVkIGJ1dCBoYXNuJ3QgYWN0dWFsbHkgc3RhcnRlZCB5ZXRcbiAgICAgICAgaWYgKHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVTb3VyY2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0YXJ0IGF0IHBvaW50IHdoZXJlIHNvdW5kIHdhcyBwYXVzZWRcbiAgICAgICAgbGV0IG9mZnNldCA9IHRoaXMuY3VycmVudFRpbWU7XG5cbiAgICAgICAgLy8gaWYgdGhlIHVzZXIgc2V0IHRoZSAnY3VycmVudFRpbWUnIHByb3BlcnR5IHdoaWxlIHRoZSBzb3VuZFxuICAgICAgICAvLyB3YXMgcGF1c2VkIHRoZW4gdXNlIHRoYXQgYXMgdGhlIG9mZnNldCBpbnN0ZWFkXG4gICAgICAgIGlmICh0aGlzLl9zdGFydE9mZnNldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydE9mZnNldCwgdGhpcy5kdXJhdGlvbik7XG4gICAgICAgICAgICBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIG9mZnNldCwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuXG4gICAgICAgICAgICAvLyByZXNldCBvZmZzZXRcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0YXJ0IHNvdXJjZVxuICAgICAgICBpZiAodGhpcy5fZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIG9mZnNldCwgdGhpcy5fZHVyYXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgb2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3N0YXJ0ZWRBdCA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IG9mZnNldDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHBhcmFtZXRlcnNcbiAgICAgICAgdGhpcy52b2x1bWUgPSB0aGlzLl92b2x1bWU7XG4gICAgICAgIHRoaXMubG9vcCA9IHRoaXMuX2xvb3A7XG4gICAgICAgIHRoaXMucGl0Y2ggPSB0aGlzLl9waXRjaDtcbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgIHRoaXMuX29uUmVzdW1lKCk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgcGxheWJhY2sgb2Ygc291bmQuIENhbGxpbmcgcGxheSgpIGFnYWluIHdpbGwgcmVzdGFydCBwbGF5YmFjayBmcm9tIHRoZSBiZWdpbm5pbmcgb2ZcbiAgICAgKiB0aGUgc291bmQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBzb3VuZCB3YXMgc3RvcHBlZC5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAvLyBzZXQgc3RhdGUgdG8gc3RvcHBlZFxuICAgICAgICBjb25zdCB3YXNQbGF5aW5nID0gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfU1RPUFBFRDtcblxuICAgICAgICAvLyBwbGF5KCkgd2FzIGlzc3VlZCBidXQgaGFzbid0IGFjdHVhbGx5IHN0YXJ0ZWQgeWV0XG4gICAgICAgIGlmICh0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdW5zdWJzY3JpYmUgZnJvbSBtYW5hZ2VyIGV2ZW50c1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZigndm9sdW1lY2hhbmdlJywgdGhpcy5fb25NYW5hZ2VyVm9sdW1lQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3N1c3BlbmQnLCB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3Jlc3VtZScsIHRoaXMuX29uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdkZXN0cm95JywgdGhpcy5fb25NYW5hZ2VyRGVzdHJveSwgdGhpcyk7XG5cbiAgICAgICAgLy8gcmVzZXQgc3RvcmVkIHRpbWVzXG4gICAgICAgIHRoaXMuX3N0YXJ0ZWRBdCA9IDA7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IDA7XG5cbiAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCsrO1xuICAgICAgICBpZiAod2FzUGxheWluZyAmJiB0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RvcCgwKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNvdXJjZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICB0aGlzLl9vblN0b3AoKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25uZWN0cyBleHRlcm5hbCBXZWIgQXVkaW8gQVBJIG5vZGVzLiBZb3UgbmVlZCB0byBwYXNzIHRoZSBmaXJzdCBub2RlIG9mIHRoZSBub2RlIGdyYXBoXG4gICAgICogdGhhdCB5b3UgY3JlYXRlZCBleHRlcm5hbGx5IGFuZCB0aGUgbGFzdCBub2RlIG9mIHRoYXQgZ3JhcGguIFRoZSBmaXJzdCBub2RlIHdpbGwgYmVcbiAgICAgKiBjb25uZWN0ZWQgdG8gdGhlIGF1ZGlvIHNvdXJjZSBhbmQgdGhlIGxhc3Qgbm9kZSB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb24gb2YgdGhlXG4gICAgICogQXVkaW9Db250ZXh0IChlLmcuIHNwZWFrZXJzKS4gUmVxdWlyZXMgV2ViIEF1ZGlvIEFQSSBzdXBwb3J0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBdWRpb05vZGV9IGZpcnN0Tm9kZSAtIFRoZSBmaXJzdCBub2RlIHRoYXQgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGF1ZGlvIHNvdXJjZSBvZiBzb3VuZCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtBdWRpb05vZGV9IFtsYXN0Tm9kZV0gLSBUaGUgbGFzdCBub2RlIHRoYXQgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIG9mIHRoZSBBdWRpb0NvbnRleHQuXG4gICAgICogSWYgdW5zcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3ROb2RlIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvbiBpbnN0ZWFkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGNvbnRleHQgPSBhcHAuc3lzdGVtcy5zb3VuZC5jb250ZXh0O1xuICAgICAqIHZhciBhbmFseXplciA9IGNvbnRleHQuY3JlYXRlQW5hbHl6ZXIoKTtcbiAgICAgKiB2YXIgZGlzdG9ydGlvbiA9IGNvbnRleHQuY3JlYXRlV2F2ZVNoYXBlcigpO1xuICAgICAqIHZhciBmaWx0ZXIgPSBjb250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuICAgICAqIGFuYWx5emVyLmNvbm5lY3QoZGlzdG9ydGlvbik7XG4gICAgICogZGlzdG9ydGlvbi5jb25uZWN0KGZpbHRlcik7XG4gICAgICogaW5zdGFuY2Uuc2V0RXh0ZXJuYWxOb2RlcyhhbmFseXplciwgZmlsdGVyKTtcbiAgICAgKi9cbiAgICBzZXRFeHRlcm5hbE5vZGVzKGZpcnN0Tm9kZSwgbGFzdE5vZGUpIHtcbiAgICAgICAgaWYgKCFmaXJzdE5vZGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1RoZSBmaXJzdE5vZGUgbXVzdCBiZSBhIHZhbGlkIEF1ZGlvIE5vZGUnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbGFzdE5vZGUpIHtcbiAgICAgICAgICAgIGxhc3ROb2RlID0gZmlyc3ROb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29ubmVjdGlvbnMgYXJlOlxuICAgICAgICAvLyBzb3VyY2UgLT4gaW5wdXROb2RlIC0+IGNvbm5lY3Rvck5vZGUgLT4gW2ZpcnN0Tm9kZSAtPiAuLi4gLT4gbGFzdE5vZGVdIC0+IHNwZWFrZXJzXG5cbiAgICAgICAgY29uc3Qgc3BlYWtlcnMgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuZGVzdGluYXRpb247XG5cbiAgICAgICAgaWYgKHRoaXMuX2ZpcnN0Tm9kZSAhPT0gZmlyc3ROb2RlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fZmlyc3ROb2RlKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgZmlyc3ROb2RlIGFscmVhZHkgZXhpc3RzIG1lYW5zIHRoZSBjb25uZWN0b3Igbm9kZVxuICAgICAgICAgICAgICAgIC8vIGlzIGNvbm5lY3RlZCB0byBpdCBzbyBkaXNjb25uZWN0IGl0XG4gICAgICAgICAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5kaXNjb25uZWN0KHRoaXMuX2ZpcnN0Tm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGlmIGZpcnN0Tm9kZSBkb2VzIG5vdCBleGlzdCBtZWFucyB0aGF0IGl0cyBjb25uZWN0ZWRcbiAgICAgICAgICAgICAgICAvLyB0byB0aGUgc3BlYWtlcnMgc28gZGlzY29ubmVjdCBpdFxuICAgICAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuZGlzY29ubmVjdChzcGVha2Vycyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBmaXJzdCBub2RlIGFuZCBjb25uZWN0IHdpdGggY29ubmVjdG9yIG5vZGVcbiAgICAgICAgICAgIHRoaXMuX2ZpcnN0Tm9kZSA9IGZpcnN0Tm9kZTtcbiAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuY29ubmVjdChmaXJzdE5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2xhc3ROb2RlICE9PSBsYXN0Tm9kZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2xhc3ROb2RlKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgbGFzdCBub2RlIGV4aXN0cyBtZWFucyBpdCdzIGNvbm5lY3RlZCB0byB0aGUgc3BlYWtlcnMgc28gZGlzY29ubmVjdCBpdFxuICAgICAgICAgICAgICAgIHRoaXMuX2xhc3ROb2RlLmRpc2Nvbm5lY3Qoc3BlYWtlcnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgbGFzdCBub2RlIGFuZCBjb25uZWN0IHdpdGggc3BlYWtlcnNcbiAgICAgICAgICAgIHRoaXMuX2xhc3ROb2RlID0gbGFzdE5vZGU7XG4gICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZS5jb25uZWN0KHNwZWFrZXJzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFycyBhbnkgZXh0ZXJuYWwgbm9kZXMgc2V0IGJ5IHtAbGluayBTb3VuZEluc3RhbmNlI3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqL1xuICAgIGNsZWFyRXh0ZXJuYWxOb2RlcygpIHtcbiAgICAgICAgY29uc3Qgc3BlYWtlcnMgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuZGVzdGluYXRpb247XG5cbiAgICAgICAgLy8gYnJlYWsgZXhpc3RpbmcgY29ubmVjdGlvbnNcbiAgICAgICAgaWYgKHRoaXMuX2ZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5kaXNjb25uZWN0KHRoaXMuX2ZpcnN0Tm9kZSk7XG4gICAgICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2xhc3ROb2RlKSB7XG4gICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZS5kaXNjb25uZWN0KHNwZWFrZXJzKTtcbiAgICAgICAgICAgIHRoaXMuX2xhc3ROb2RlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlc2V0IGNvbm5lY3QgdG8gc3BlYWtlcnNcbiAgICAgICAgdGhpcy5fY29ubmVjdG9yTm9kZS5jb25uZWN0KHNwZWFrZXJzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGFueSBleHRlcm5hbCBub2RlcyBzZXQgYnkge0BsaW5rIFNvdW5kSW5zdGFuY2Ujc2V0RXh0ZXJuYWxOb2Rlc30uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7QXVkaW9Ob2RlW119IFJldHVybnMgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdHdvIG5vZGVzIHNldCBieVxuICAgICAqIHtAbGluayBTb3VuZEluc3RhbmNlI3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqL1xuICAgIGdldEV4dGVybmFsTm9kZXMoKSB7XG4gICAgICAgIHJldHVybiBbdGhpcy5fZmlyc3ROb2RlLCB0aGlzLl9sYXN0Tm9kZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyB0aGUgc291cmNlIGZvciB0aGUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7QXVkaW9CdWZmZXJTb3VyY2VOb2RlfG51bGx9IFJldHVybnMgdGhlIGNyZWF0ZWQgc291cmNlIG9yIG51bGwgaWYgdGhlIHNvdW5kXG4gICAgICogaW5zdGFuY2UgaGFzIG5vIHtAbGluayBTb3VuZH0gYXNzb2NpYXRlZCB3aXRoIGl0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZVNvdXJjZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zb3VuZCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5fbWFuYWdlci5jb250ZXh0O1xuXG4gICAgICAgIGlmICh0aGlzLl9zb3VuZC5idWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlID0gY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLmJ1ZmZlciA9IHRoaXMuX3NvdW5kLmJ1ZmZlcjtcblxuICAgICAgICAgICAgLy8gQ29ubmVjdCB1cCB0aGUgbm9kZXNcbiAgICAgICAgICAgIHRoaXMuc291cmNlLmNvbm5lY3QodGhpcy5faW5wdXROb2RlKTtcblxuICAgICAgICAgICAgLy8gc2V0IGV2ZW50c1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uub25lbmRlZCA9IHRoaXMuX2VuZGVkSGFuZGxlcjtcblxuICAgICAgICAgICAgLy8gc2V0IGxvb3BTdGFydCBhbmQgbG9vcEVuZCBzbyB0aGF0IHRoZSBzb3VyY2Ugc3RhcnRzIGFuZCBlbmRzIGF0IHRoZSBjb3JyZWN0IHVzZXItc2V0IHRpbWVzXG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5sb29wU3RhcnQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSwgdGhpcy5zb3VyY2UuYnVmZmVyLmR1cmF0aW9uKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9kdXJhdGlvbikge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLmxvb3BFbmQgPSBNYXRoLm1heCh0aGlzLnNvdXJjZS5sb29wU3RhcnQsIGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgdGhpcy5fZHVyYXRpb24sIHRoaXMuc291cmNlLmJ1ZmZlci5kdXJhdGlvbikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuc291cmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGN1cnJlbnQgdGltZSB0YWtpbmcgaW50byBhY2NvdW50IHRoZSB0aW1lIHRoZSBpbnN0YW5jZSBzdGFydGVkIHBsYXlpbmcsIHRoZSBjdXJyZW50XG4gICAgICogcGl0Y2ggYW5kIHRoZSBjdXJyZW50IHRpbWUgb2Zmc2V0LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdXBkYXRlQ3VycmVudFRpbWUoKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRUaW1lID0gY2FwVGltZSgodGhpcy5fbWFuYWdlci5jb250ZXh0LmN1cnJlbnRUaW1lIC0gdGhpcy5fc3RhcnRlZEF0KSAqIHRoaXMuX3BpdGNoICsgdGhpcy5fY3VycmVudE9mZnNldCwgdGhpcy5kdXJhdGlvbik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIHRoZSBtYW5hZ2VyJ3MgJ2Rlc3Ryb3knIGV2ZW50LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYW5hZ2VyRGVzdHJveSgpIHtcbiAgICAgICAgaWYgKHRoaXMuc291cmNlICYmIHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdG9wKDApO1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5pZiAoIWhhc0F1ZGlvQ29udGV4dCgpKSB7XG4gICAgT2JqZWN0LmFzc2lnbihTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwge1xuICAgICAgICBwbGF5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1NUT1BQRUQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY3JlYXRlU291cmNlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy52b2x1bWUgPSB0aGlzLl92b2x1bWU7XG4gICAgICAgICAgICB0aGlzLnBpdGNoID0gdGhpcy5fcGl0Y2g7XG4gICAgICAgICAgICB0aGlzLmxvb3AgPSB0aGlzLl9sb29wO1xuXG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5wbGF5KCk7XG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbignc3VzcGVuZCcsIHRoaXMuX29uTWFuYWdlclN1c3BlbmQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbigncmVzdW1lJywgdGhpcy5fb25NYW5hZ2VyUmVzdW1lLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ2Rlc3Ryb3knLCB0aGlzLl9vbk1hbmFnZXJEZXN0cm95LCB0aGlzKTtcblxuICAgICAgICAgICAgLy8gc3VzcGVuZCBpbW1lZGlhdGVseSBpZiBtYW5hZ2VyIGlzIHN1c3BlbmRlZFxuICAgICAgICAgICAgaWYgKHRoaXMuX21hbmFnZXIuc3VzcGVuZGVkKVxuICAgICAgICAgICAgICAgIHRoaXMuX29uTWFuYWdlclN1c3BlbmQoKTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5fb25QbGF5KCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuXG4gICAgICAgIH0sXG5cbiAgICAgICAgcGF1c2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zb3VyY2UgfHwgdGhpcy5fc3RhdGUgIT09IFNUQVRFX1BMQVlJTkcpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kRW5kRXZlbnQrKztcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnBhdXNlKCk7XG4gICAgICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QQVVTRUQ7XG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgICAgIHRoaXMuX29uUGF1c2UoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcmVzdW1lOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc291cmNlIHx8IHRoaXMuX3N0YXRlICE9PSBTVEFURV9QQVVTRUQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlLnBhdXNlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnBsYXkoKTtcblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vblJlc3VtZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc291cmNlIHx8IHRoaXMuX3N0YXRlID09PSBTVEFURV9TVE9QUEVEKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3ZvbHVtZWNoYW5nZScsIHRoaXMuX29uTWFuYWdlclZvbHVtZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZignc3VzcGVuZCcsIHRoaXMuX29uTWFuYWdlclN1c3BlbmQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3Jlc3VtZScsIHRoaXMuX29uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZignZGVzdHJveScsIHRoaXMuX29uTWFuYWdlckRlc3Ryb3ksIHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kRW5kRXZlbnQrKztcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnBhdXNlKCk7XG4gICAgICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9TVE9QUEVEO1xuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLl9vblN0b3AoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0RXh0ZXJuYWxOb2RlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy8gbm90IHN1cHBvcnRlZFxuICAgICAgICB9LFxuXG4gICAgICAgIGNsZWFyRXh0ZXJuYWxOb2RlczogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy8gbm90IHN1cHBvcnRlZFxuICAgICAgICB9LFxuXG4gICAgICAgIGdldEV4dGVybmFsTm9kZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgYnV0IHJldHVybiBzYW1lIHR5cGUgb2YgcmVzdWx0XG4gICAgICAgICAgICByZXR1cm4gW251bGwsIG51bGxdO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8vIFNldHMgc3RhcnQgdGltZSBhZnRlciBsb2FkZWRtZXRhZGF0YSBpcyBmaXJlZCB3aGljaCBpcyByZXF1aXJlZCBieSBtb3N0IGJyb3dzZXJzXG4gICAgICAgIF9vbkxvYWRlZE1ldGFkYXRhOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIHRoaXMuX2xvYWRlZE1ldGFkYXRhSGFuZGxlcik7XG5cbiAgICAgICAgICAgIHRoaXMuX2lzUmVhZHkgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgc3RhcnQgdGltZSBmb3Igc291cmNlXG4gICAgICAgICAgICBsZXQgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydE9mZnNldCwgdGhpcy5kdXJhdGlvbik7XG4gICAgICAgICAgICBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIG9mZnNldCwgdGhpcy5fc291bmQuZHVyYXRpb24pO1xuICAgICAgICAgICAgLy8gcmVzZXQgY3VycmVudFRpbWVcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gc2V0IG9mZnNldCBvbiBzb3VyY2VcbiAgICAgICAgICAgIHRoaXMuc291cmNlLmN1cnJlbnRUaW1lID0gb2Zmc2V0O1xuICAgICAgICB9LFxuXG4gICAgICAgIF9jcmVhdGVTb3VyY2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3VuZCAmJiB0aGlzLl9zb3VuZC5hdWRpbykge1xuXG4gICAgICAgICAgICAgICAgdGhpcy5faXNSZWFkeSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlID0gdGhpcy5fc291bmQuYXVkaW8uY2xvbmVOb2RlKHRydWUpO1xuXG4gICAgICAgICAgICAgICAgLy8gc2V0IGV2ZW50c1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlZG1ldGFkYXRhJywgdGhpcy5fbG9hZGVkTWV0YWRhdGFIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdGhpcy5fdGltZVVwZGF0ZUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLm9uZW5kZWQgPSB0aGlzLl9lbmRlZEhhbmRsZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNvdXJjZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBjYWxsZWQgZXZlcnkgdGltZSB0aGUgJ2N1cnJlbnRUaW1lJyBpcyBjaGFuZ2VkXG4gICAgICAgIF9vblRpbWVVcGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZHVyYXRpb24pXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgY3VycmVudFRpbWUgcGFzc2VzIHRoZSBlbmQgdGhlbiBpZiBsb29waW5nIGdvIGJhY2sgdG8gdGhlIGJlZ2lubmluZ1xuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIG1hbnVhbGx5IHN0b3BcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZS5jdXJyZW50VGltZSA+IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgdGhpcy5fZHVyYXRpb24sIHRoaXMuc291cmNlLmR1cmF0aW9uKSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxvb3ApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UuY3VycmVudFRpbWUgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSwgdGhpcy5zb3VyY2UuZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBsaXN0ZW5lciB0byBwcmV2ZW50IG11bHRpcGxlIGNhbGxzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RpbWV1cGRhdGUnLCB0aGlzLl90aW1lVXBkYXRlSGFuZGxlcik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnBhdXNlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY2FsbCB0aGlzIG1hbnVhbGx5IGJlY2F1c2UgaXQgZG9lc24ndCB3b3JrIGluIGFsbCBicm93c2VycyBpbiB0aGlzIGNhc2VcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb25FbmRlZCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBfb25NYW5hZ2VyRGVzdHJveTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGF1c2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNvdW5kSW5zdGFuY2UucHJvdG90eXBlLCAndm9sdW1lJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl92b2x1bWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodm9sdW1lKSB7XG4gICAgICAgICAgICB2b2x1bWUgPSBtYXRoLmNsYW1wKHZvbHVtZSwgMCwgMSk7XG4gICAgICAgICAgICB0aGlzLl92b2x1bWUgPSB2b2x1bWU7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS52b2x1bWUgPSB2b2x1bWUgKiB0aGlzLl9tYW5hZ2VyLnZvbHVtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNvdW5kSW5zdGFuY2UucHJvdG90eXBlLCAncGl0Y2gnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3BpdGNoO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHBpdGNoKSB7XG4gICAgICAgICAgICB0aGlzLl9waXRjaCA9IE1hdGgubWF4KE51bWJlcihwaXRjaCkgfHwgMCwgMC4wMSk7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5wbGF5YmFja1JhdGUgPSB0aGlzLl9waXRjaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNvdW5kSW5zdGFuY2UucHJvdG90eXBlLCAnc291bmQnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NvdW5kO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIHRoaXMuX3NvdW5kID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9KTtcblxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNvdW5kSW5zdGFuY2UucHJvdG90eXBlLCAnY3VycmVudFRpbWUnLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3N0YXJ0T2Zmc2V0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fc3RhdGUgPT09IFNUQVRFX1NUT1BQRUQgfHwgIXRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNvdXJjZS5jdXJyZW50VGltZSAtIHRoaXMuX3N0YXJ0VGltZTtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlIDwgMCkgcmV0dXJuO1xuXG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IHZhbHVlO1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlICYmIHRoaXMuX2lzUmVhZHkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5jdXJyZW50VGltZSA9IGNhcFRpbWUodGhpcy5fc3RhcnRUaW1lICsgY2FwVGltZSh2YWx1ZSwgdGhpcy5kdXJhdGlvbiksIHRoaXMuX3NvdW5kLmR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZXhwb3J0IHsgU291bmRJbnN0YW5jZSB9O1xuIl0sIm5hbWVzIjpbIlNUQVRFX1BMQVlJTkciLCJTVEFURV9QQVVTRUQiLCJTVEFURV9TVE9QUEVEIiwiY2FwVGltZSIsInRpbWUiLCJkdXJhdGlvbiIsIlNvdW5kSW5zdGFuY2UiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIm1hbmFnZXIiLCJzb3VuZCIsIm9wdGlvbnMiLCJzb3VyY2UiLCJfbWFuYWdlciIsIl92b2x1bWUiLCJ2b2x1bWUiLCJ1bmRlZmluZWQiLCJtYXRoIiwiY2xhbXAiLCJOdW1iZXIiLCJfcGl0Y2giLCJwaXRjaCIsIk1hdGgiLCJtYXgiLCJfbG9vcCIsImxvb3AiLCJfc291bmQiLCJfc3RhdGUiLCJfc3VzcGVuZGVkIiwiX3N1c3BlbmRFbmRFdmVudCIsIl9zdXNwZW5kSW5zdGFuY2VFdmVudHMiLCJfcGxheVdoZW5Mb2FkZWQiLCJfc3RhcnRUaW1lIiwic3RhcnRUaW1lIiwiX2R1cmF0aW9uIiwiX3N0YXJ0T2Zmc2V0IiwiX29uUGxheUNhbGxiYWNrIiwib25QbGF5IiwiX29uUGF1c2VDYWxsYmFjayIsIm9uUGF1c2UiLCJfb25SZXN1bWVDYWxsYmFjayIsIm9uUmVzdW1lIiwiX29uU3RvcENhbGxiYWNrIiwib25TdG9wIiwiX29uRW5kQ2FsbGJhY2siLCJvbkVuZCIsImhhc0F1ZGlvQ29udGV4dCIsIl9zdGFydGVkQXQiLCJfY3VycmVudFRpbWUiLCJfY3VycmVudE9mZnNldCIsIl9pbnB1dE5vZGUiLCJfY29ubmVjdG9yTm9kZSIsIl9maXJzdE5vZGUiLCJfbGFzdE5vZGUiLCJfd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uIiwiX2luaXRpYWxpemVOb2RlcyIsIl9lbmRlZEhhbmRsZXIiLCJfb25FbmRlZCIsImJpbmQiLCJfaXNSZWFkeSIsIl9sb2FkZWRNZXRhZGF0YUhhbmRsZXIiLCJfb25Mb2FkZWRNZXRhZGF0YSIsIl90aW1lVXBkYXRlSGFuZGxlciIsIl9vblRpbWVVcGRhdGUiLCJfY3JlYXRlU291cmNlIiwiY3VycmVudFRpbWUiLCJ2YWx1ZSIsInN1c3BlbmQiLCJzdG9wIiwicGxheSIsIl91cGRhdGVDdXJyZW50VGltZSIsImlzUGxheWluZyIsImlzUGF1c2VkIiwiaXNTdG9wcGVkIiwiaXNTdXNwZW5kZWQiLCJjb250ZXh0IiwicGxheWJhY2tSYXRlIiwiZ2FpbiIsIl9vblBsYXkiLCJmaXJlIiwiX29uUGF1c2UiLCJfb25SZXN1bWUiLCJfb25TdG9wIiwiX29uTWFuYWdlclZvbHVtZUNoYW5nZSIsIl9vbk1hbmFnZXJTdXNwZW5kIiwicGF1c2UiLCJfb25NYW5hZ2VyUmVzdW1lIiwicmVzdW1lIiwiY3JlYXRlR2FpbiIsImNvbm5lY3QiLCJkZXN0aW5hdGlvbiIsInN1c3BlbmRlZCIsIm9uY2UiLCJfcGxheUF1ZGlvSW1tZWRpYXRlIiwib2Zmc2V0Iiwic3RhcnQiLCJvbiIsIl9vbk1hbmFnZXJEZXN0cm95Iiwid2FzUGxheWluZyIsIm9mZiIsInNldEV4dGVybmFsTm9kZXMiLCJmaXJzdE5vZGUiLCJsYXN0Tm9kZSIsImNvbnNvbGUiLCJlcnJvciIsInNwZWFrZXJzIiwiZGlzY29ubmVjdCIsImNsZWFyRXh0ZXJuYWxOb2RlcyIsImdldEV4dGVybmFsTm9kZXMiLCJidWZmZXIiLCJjcmVhdGVCdWZmZXJTb3VyY2UiLCJvbmVuZGVkIiwibG9vcFN0YXJ0IiwibG9vcEVuZCIsIk9iamVjdCIsImFzc2lnbiIsInByb3RvdHlwZSIsInBhdXNlZCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJhdWRpbyIsImNsb25lTm9kZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCIsInNldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBU0EsTUFBTUEsYUFBYSxHQUFHLENBQUMsQ0FBQTtBQUN2QixNQUFNQyxZQUFZLEdBQUcsQ0FBQyxDQUFBO0FBQ3RCLE1BQU1DLGFBQWEsR0FB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
