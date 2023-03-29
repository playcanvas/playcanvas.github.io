/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../core/event-handler.js';
import { math } from '../math/math.js';
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
    setExternalNodes: function () {},
    clearExternalNodes: function () {},
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zdGFuY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zb3VuZC9pbnN0YW5jZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vbWF0aC9tYXRoLmpzJztcblxuaW1wb3J0IHsgaGFzQXVkaW9Db250ZXh0IH0gZnJvbSAnLi4vYXVkaW8vY2FwYWJpbGl0aWVzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc291bmQuanMnKS5Tb3VuZH0gU291bmQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL21hbmFnZXIuanMnKS5Tb3VuZE1hbmFnZXJ9IFNvdW5kTWFuYWdlciAqL1xuXG5jb25zdCBTVEFURV9QTEFZSU5HID0gMDtcbmNvbnN0IFNUQVRFX1BBVVNFRCA9IDE7XG5jb25zdCBTVEFURV9TVE9QUEVEID0gMjtcblxuLyoqXG4gKiBSZXR1cm4gdGltZSAlIGR1cmF0aW9uIGJ1dCBhbHdheXMgcmV0dXJuIGEgbnVtYmVyIGluc3RlYWQgb2YgTmFOIHdoZW4gZHVyYXRpb24gaXMgMC5cbiAqXG4gKiBAcGFyYW0ge251bWJlcn0gdGltZSAtIFRoZSB0aW1lLlxuICogQHBhcmFtIHtudW1iZXJ9IGR1cmF0aW9uIC0gVGhlIGR1cmF0aW9uLlxuICogQHJldHVybnMge251bWJlcn0gVGhlIHRpbWUgJSBkdXJhdGlvbi5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gY2FwVGltZSh0aW1lLCBkdXJhdGlvbikge1xuICAgIHJldHVybiAodGltZSAlIGR1cmF0aW9uKSB8fCAwO1xufVxuXG4vKipcbiAqIEEgU291bmRJbnN0YW5jZSBwbGF5cyBhIHtAbGluayBTb3VuZH0uXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBTb3VuZEluc3RhbmNlIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBzb3VyY2UgdGhhdCBwbGF5cyB0aGUgc291bmQgcmVzb3VyY2UuIElmIHRoZSBXZWIgQXVkaW8gQVBJIGlzIG5vdCBzdXBwb3J0ZWQgdGhlXG4gICAgICogdHlwZSBvZiBzb3VyY2UgaXMgW0F1ZGlvXShodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9IVE1ML0VsZW1lbnQvYXVkaW8pLlxuICAgICAqIFNvdXJjZSBpcyBvbmx5IGF2YWlsYWJsZSBhZnRlciBjYWxsaW5nIHBsYXkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXVkaW9CdWZmZXJTb3VyY2VOb2RlfVxuICAgICAqL1xuICAgIHNvdXJjZSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU291bmRJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U291bmRNYW5hZ2VyfSBtYW5hZ2VyIC0gVGhlIHNvdW5kIG1hbmFnZXIuXG4gICAgICogQHBhcmFtIHtTb3VuZH0gc291bmQgLSBUaGUgc291bmQgdG8gcGxheS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIE9wdGlvbnMgZm9yIHRoZSBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMudm9sdW1lPTFdIC0gVGhlIHBsYXliYWNrIHZvbHVtZSwgYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5waXRjaD0xXSAtIFRoZSByZWxhdGl2ZSBwaXRjaCwgZGVmYXVsdCBvZiAxLCBwbGF5cyBhdCBub3JtYWwgcGl0Y2guXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5sb29wPWZhbHNlXSAtIFdoZXRoZXIgdGhlIHNvdW5kIHNob3VsZCBsb29wIHdoZW4gaXQgcmVhY2hlcyB0aGVcbiAgICAgKiBlbmQgb3Igbm90LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdGFydFRpbWU9MF0gLSBUaGUgdGltZSBmcm9tIHdoaWNoIHRoZSBwbGF5YmFjayB3aWxsIHN0YXJ0IGluXG4gICAgICogc2Vjb25kcy4gRGVmYXVsdCBpcyAwIHRvIHN0YXJ0IGF0IHRoZSBiZWdpbm5pbmcuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmR1cmF0aW9uPTBdIC0gVGhlIHRvdGFsIHRpbWUgYWZ0ZXIgdGhlIHN0YXJ0VGltZSBpbiBzZWNvbmRzIHdoZW5cbiAgICAgKiBwbGF5YmFjayB3aWxsIHN0b3Agb3IgcmVzdGFydCBpZiBsb29wIGlzIHRydWUuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25QbGF5PW51bGxdIC0gRnVuY3Rpb24gY2FsbGVkIHdoZW4gdGhlIGluc3RhbmNlIHN0YXJ0cyBwbGF5aW5nLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLm9uUGF1c2U9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgcGF1c2VkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLm9uUmVzdW1lPW51bGxdIC0gRnVuY3Rpb24gY2FsbGVkIHdoZW4gdGhlIGluc3RhbmNlIGlzIHJlc3VtZWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25TdG9wPW51bGxdIC0gRnVuY3Rpb24gY2FsbGVkIHdoZW4gdGhlIGluc3RhbmNlIGlzIHN0b3BwZWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25FbmQ9bnVsbF0gLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgaW5zdGFuY2UgZW5kcy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyLCBzb3VuZCwgb3B0aW9ucykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7U291bmRNYW5hZ2VyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbWFuYWdlciA9IG1hbmFnZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl92b2x1bWUgPSBvcHRpb25zLnZvbHVtZSAhPT0gdW5kZWZpbmVkID8gbWF0aC5jbGFtcChOdW1iZXIob3B0aW9ucy52b2x1bWUpIHx8IDAsIDAsIDEpIDogMTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3BpdGNoID0gb3B0aW9ucy5waXRjaCAhPT0gdW5kZWZpbmVkID8gTWF0aC5tYXgoMC4wMSwgTnVtYmVyKG9wdGlvbnMucGl0Y2gpIHx8IDApIDogMTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9sb29wID0gISEob3B0aW9ucy5sb29wICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmxvb3AgOiBmYWxzZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtTb3VuZH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NvdW5kID0gc291bmQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0YXJ0IGF0ICdzdG9wcGVkJy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfU1RPUFBFRDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1ZSBpZiB0aGUgbWFuYWdlciB3YXMgc3VzcGVuZGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3N1c3BlbmRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHcmVhdGVyIHRoYW4gMCBpZiB3ZSB3YW50IHRvIHN1c3BlbmQgdGhlIGV2ZW50IGhhbmRsZWQgdG8gdGhlICdvbmVuZGVkJyBldmVudC5cbiAgICAgICAgICogV2hlbiBhbiAnb25lbmRlZCcgZXZlbnQgaXMgc3VzcGVuZGVkLCB0aGlzIGNvdW50ZXIgaXMgZGVjcmVtZW50ZWQgYnkgMS5cbiAgICAgICAgICogV2hlbiBhIGZ1dHVyZSAnb25lbmRlZCcgZXZlbnQgaXMgdG8gYmUgc3VzcGVuZGVkLCB0aGlzIGNvdW50ZXIgaXMgaW5jcmVtZW50ZWQgYnkgMS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudCA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRydWUgaWYgd2Ugd2FudCB0byBzdXNwZW5kIGZpcmluZyBpbnN0YW5jZSBldmVudHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIHRydWUgdGhlbiB0aGUgaW5zdGFuY2Ugd2lsbCBzdGFydCBwbGF5aW5nIGl0cyBzb3VyY2Ugd2hlbiBpdHMgY3JlYXRlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9wbGF5V2hlbkxvYWRlZCA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zdGFydFRpbWUgPSBNYXRoLm1heCgwLCBOdW1iZXIob3B0aW9ucy5zdGFydFRpbWUpIHx8IDApO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZHVyYXRpb24gPSBNYXRoLm1heCgwLCBOdW1iZXIob3B0aW9ucy5kdXJhdGlvbikgfHwgMCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICAvLyBleHRlcm5hbCBldmVudCBoYW5kbGVyc1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fb25QbGF5Q2FsbGJhY2sgPSBvcHRpb25zLm9uUGxheTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX29uUGF1c2VDYWxsYmFjayA9IG9wdGlvbnMub25QYXVzZTtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX29uUmVzdW1lQ2FsbGJhY2sgPSBvcHRpb25zLm9uUmVzdW1lO1xuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fb25TdG9wQ2FsbGJhY2sgPSBvcHRpb25zLm9uU3RvcDtcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX29uRW5kQ2FsbGJhY2sgPSBvcHRpb25zLm9uRW5kO1xuXG4gICAgICAgIGlmIChoYXNBdWRpb0NvbnRleHQoKSkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fc3RhcnRlZEF0ID0gMDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBNYW51YWxseSBrZWVwIHRyYWNrIG9mIHRoZSBwbGF5YmFjayBwb3NpdGlvbiBiZWNhdXNlIHRoZSBXZWIgQXVkaW8gQVBJIGRvZXMgbm90XG4gICAgICAgICAgICAgKiBwcm92aWRlIGEgd2F5IHRvIGRvIHRoaXMgYWNjdXJhdGVseSBpZiB0aGUgcGxheWJhY2tSYXRlIGlzIG5vdCAxLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50VGltZSA9IDA7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRPZmZzZXQgPSAwO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBpbnB1dCBub2RlIGlzIHRoZSBvbmUgdGhhdCBpcyBjb25uZWN0ZWQgdG8gdGhlIHNvdXJjZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7QXVkaW9Ob2RlfG51bGx9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9pbnB1dE5vZGUgPSBudWxsO1xuXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBjb25uZWN0ZWQgbm9kZSBpcyB0aGUgb25lIHRoYXQgaXMgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvbiAoc3BlYWtlcnMpLiBBbnlcbiAgICAgICAgICAgICAqIGV4dGVybmFsIG5vZGVzIHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoaXMgbm9kZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7QXVkaW9Ob2RlfG51bGx9XG4gICAgICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgZmlyc3QgZXh0ZXJuYWwgbm9kZSBzZXQgYnkgYSB1c2VyLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtBdWRpb05vZGV8bnVsbH1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2ZpcnN0Tm9kZSA9IG51bGw7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGxhc3QgZXh0ZXJuYWwgbm9kZSBzZXQgYnkgYSB1c2VyLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtBdWRpb05vZGV8bnVsbH1cbiAgICAgICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuX2xhc3ROb2RlID0gbnVsbDtcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBTZXQgdG8gdHJ1ZSBpZiBhIHBsYXkoKSByZXF1ZXN0IHdhcyBpc3N1ZWQgd2hlbiB0aGUgQXVkaW9Db250ZXh0IHdhcyBzdGlsbCBzdXNwZW5kZWQsXG4gICAgICAgICAgICAgKiBhbmQgd2lsbCB0aGVyZWZvcmUgd2FpdCB1bnRpbCBpdCBpcyByZXN1bWVkIHRvIHBsYXkgdGhlIGF1ZGlvLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX2luaXRpYWxpemVOb2RlcygpO1xuXG4gICAgICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgICAgIHRoaXMuX2VuZGVkSGFuZGxlciA9IHRoaXMuX29uRW5kZWQuYmluZCh0aGlzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICAgICAgdGhpcy5faXNSZWFkeSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgICAgIHRoaXMuX2xvYWRlZE1ldGFkYXRhSGFuZGxlciA9IHRoaXMuX29uTG9hZGVkTWV0YWRhdGEuYmluZCh0aGlzKTtcbiAgICAgICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICAgICAgdGhpcy5fdGltZVVwZGF0ZUhhbmRsZXIgPSB0aGlzLl9vblRpbWVVcGRhdGUuYmluZCh0aGlzKTtcbiAgICAgICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICAgICAgdGhpcy5fZW5kZWRIYW5kbGVyID0gdGhpcy5fb25FbmRlZC5iaW5kKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVTb3VyY2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGluc3RhbmNlIHN0YXJ0cyBwbGF5aW5nIGl0cyBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRJbnN0YW5jZSNwbGF5XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBpbnN0YW5jZSBpcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRJbnN0YW5jZSNwYXVzZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgcmVzdW1lZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZEluc3RhbmNlI3Jlc3VtZVxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgaW5zdGFuY2UgaXMgc3RvcHBlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTb3VuZEluc3RhbmNlI3N0b3BcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIHNvdW5kIGN1cnJlbnRseSBwbGF5ZWQgYnkgdGhlIGluc3RhbmNlIGVuZHMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU291bmRJbnN0YW5jZSNlbmRcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEdldHMgb3Igc2V0cyB0aGUgY3VycmVudCB0aW1lIG9mIHRoZSBzb3VuZCB0aGF0IGlzIHBsYXlpbmcuIElmIHRoZSB2YWx1ZSBwcm92aWRlZCBpcyBiaWdnZXJcbiAgICAgKiB0aGFuIHRoZSBkdXJhdGlvbiBvZiB0aGUgaW5zdGFuY2UgaXQgd2lsbCB3cmFwIGZyb20gdGhlIGJlZ2lubmluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGN1cnJlbnRUaW1lKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA8IDApIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkcpIHtcbiAgICAgICAgICAgIGNvbnN0IHN1c3BlbmQgPSB0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHM7XG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBzdG9wIGZpcnN0IHdoaWNoIHdpbGwgc2V0IF9zdGFydE9mZnNldCB0byBudWxsXG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcblxuICAgICAgICAgICAgLy8gc2V0IF9zdGFydE9mZnNldCBhbmQgcGxheVxuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucGxheSgpO1xuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzID0gc3VzcGVuZDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNldCBfc3RhcnRPZmZzZXQgd2hpY2ggd2lsbCBiZSB1c2VkIHdoZW4gdGhlIGluc3RhbmNlIHdpbGwgc3RhcnQgcGxheWluZ1xuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIC8vIHNldCBfY3VycmVudFRpbWVcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRUaW1lID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY3VycmVudFRpbWUoKSB7XG4gICAgICAgIC8vIGlmIHRoZSB1c2VyIGhhcyBzZXQgdGhlIGN1cnJlbnRUaW1lIGFuZCB3ZSBoYXZlIG5vdCB1c2VkIGl0IHlldFxuICAgICAgICAvLyB0aGVuIGp1c3QgcmV0dXJuIHRoYXRcbiAgICAgICAgaWYgKHRoaXMuX3N0YXJ0T2Zmc2V0ICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc3RhcnRPZmZzZXQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgc291bmQgaXMgcGF1c2VkIHJldHVybiB0aGUgY3VycmVudFRpbWUgY2FsY3VsYXRlZCB3aGVuXG4gICAgICAgIC8vIHBhdXNlKCkgd2FzIGNhbGxlZFxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgPT09IFNUQVRFX1BBVVNFRCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRUaW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIHNvdW5kIGlzIHN0b3BwZWQgb3Igd2UgZG9uJ3QgaGF2ZSBhIHNvdXJjZVxuICAgICAgICAvLyByZXR1cm4gMFxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgPT09IFNUQVRFX1NUT1BQRUQgfHwgIXRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlY2FsY3VsYXRlIGN1cnJlbnQgdGltZVxuICAgICAgICB0aGlzLl91cGRhdGVDdXJyZW50VGltZSgpO1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudFRpbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGR1cmF0aW9uIG9mIHRoZSBzb3VuZCB0aGF0IHRoZSBpbnN0YW5jZSB3aWxsIHBsYXkgc3RhcnRpbmcgZnJvbSBzdGFydFRpbWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBkdXJhdGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kdXJhdGlvbiA9IE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZSkgfHwgMCk7XG5cbiAgICAgICAgLy8gcmVzdGFydFxuICAgICAgICBjb25zdCBpc1BsYXlpbmcgPSB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORztcbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIGlmIChpc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMucGxheSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGR1cmF0aW9uKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3NvdW5kKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBjYXBUaW1lKHRoaXMuX2R1cmF0aW9uLCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3NvdW5kLmR1cmF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgaW5zdGFuY2UgaXMgY3VycmVudGx5IHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1BhdXNlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXRlID09PSBTVEFURV9QQVVTRUQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBpbnN0YW5jZSBpcyBjdXJyZW50bHkgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBpc1BsYXlpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGluc3RhbmNlIGlzIGN1cnJlbnRseSBzdG9wcGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGlzU3RvcHBlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N0YXRlID09PSBTVEFURV9TVE9QUEVEO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgaW5zdGFuY2UgaXMgY3VycmVudGx5IHN1c3BlbmRlZCBiZWNhdXNlIHRoZSB3aW5kb3cgaXMgbm90IGZvY3VzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgaXNTdXNwZW5kZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdXNwZW5kZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgaW5zdGFuY2Ugd2lsbCByZXN0YXJ0IHdoZW4gaXQgZmluaXNoZXMgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsb29wKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xvb3AgPSAhIXZhbHVlO1xuICAgICAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLmxvb3AgPSB0aGlzLl9sb29wO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxvb3AoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb29wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwaXRjaCBtb2RpZmllciB0byBwbGF5IHRoZSBzb3VuZCB3aXRoLiBNdXN0IGJlIGxhcmdlciB0aGFuIDAuMDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBwaXRjaChwaXRjaCkge1xuICAgICAgICAvLyBzZXQgb2Zmc2V0IHRvIGN1cnJlbnQgdGltZSBzbyB0aGF0XG4gICAgICAgIC8vIHdlIGNhbGN1bGF0ZSB0aGUgcmVzdCBvZiB0aGUgdGltZSB3aXRoIHRoZSBuZXcgcGl0Y2hcbiAgICAgICAgLy8gZnJvbSBub3cgb25cbiAgICAgICAgdGhpcy5fY3VycmVudE9mZnNldCA9IHRoaXMuY3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuX3N0YXJ0ZWRBdCA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5jdXJyZW50VGltZTtcblxuICAgICAgICB0aGlzLl9waXRjaCA9IE1hdGgubWF4KE51bWJlcihwaXRjaCkgfHwgMCwgMC4wMSk7XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheWJhY2tSYXRlLnZhbHVlID0gdGhpcy5fcGl0Y2g7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcGl0Y2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXRjaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc291bmQgcmVzb3VyY2UgdGhhdCB0aGUgaW5zdGFuY2Ugd2lsbCBwbGF5LlxuICAgICAqXG4gICAgICogQHR5cGUge1NvdW5kfVxuICAgICAqL1xuICAgIHNldCBzb3VuZCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zb3VuZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfU1RPUFBFRCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jcmVhdGVTb3VyY2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzb3VuZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NvdW5kO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBzdGFydCB0aW1lIGZyb20gd2hpY2ggdGhlIHNvdW5kIHdpbGwgc3RhcnQgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHN0YXJ0VGltZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zdGFydFRpbWUgPSBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUpIHx8IDApO1xuXG4gICAgICAgIC8vIHJlc3RhcnRcbiAgICAgICAgY29uc3QgaXNQbGF5aW5nID0gdGhpcy5fc3RhdGUgPT09IFNUQVRFX1BMQVlJTkc7XG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICBpZiAoaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLnBsYXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzdGFydFRpbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdGFydFRpbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHZvbHVtZSBtb2RpZmllciB0byBwbGF5IHRoZSBzb3VuZCB3aXRoLiBJbiByYW5nZSAwLTEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCB2b2x1bWUodm9sdW1lKSB7XG4gICAgICAgIHZvbHVtZSA9IG1hdGguY2xhbXAodm9sdW1lLCAwLCAxKTtcbiAgICAgICAgdGhpcy5fdm9sdW1lID0gdm9sdW1lO1xuICAgICAgICBpZiAodGhpcy5nYWluKSB7XG4gICAgICAgICAgICB0aGlzLmdhaW4uZ2Fpbi52YWx1ZSA9IHZvbHVtZSAqIHRoaXMuX21hbmFnZXIudm9sdW1lO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHZvbHVtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25QbGF5KCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3BsYXknKTtcblxuICAgICAgICBpZiAodGhpcy5fb25QbGF5Q2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9vblBsYXlDYWxsYmFjayh0aGlzKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25QYXVzZSgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdwYXVzZScpO1xuXG4gICAgICAgIGlmICh0aGlzLl9vblBhdXNlQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9vblBhdXNlQ2FsbGJhY2sodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uUmVzdW1lKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3Jlc3VtZScpO1xuXG4gICAgICAgIGlmICh0aGlzLl9vblJlc3VtZUNhbGxiYWNrKVxuICAgICAgICAgICAgdGhpcy5fb25SZXN1bWVDYWxsYmFjayh0aGlzKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25TdG9wKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3N0b3AnKTtcblxuICAgICAgICBpZiAodGhpcy5fb25TdG9wQ2FsbGJhY2spXG4gICAgICAgICAgICB0aGlzLl9vblN0b3BDYWxsYmFjayh0aGlzKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfb25FbmRlZCgpIHtcbiAgICAgICAgLy8gdGhlIGNhbGxiYWNrIGlzIG5vdCBmaXJlZCBzeW5jaHJvbm91c2x5XG4gICAgICAgIC8vIHNvIG9ubHkgZGVjcmVtZW50IF9zdXNwZW5kRW5kRXZlbnQgd2hlbiB0aGVcbiAgICAgICAgLy8gY2FsbGJhY2sgaXMgZmlyZWRcbiAgICAgICAgaWYgKHRoaXMuX3N1c3BlbmRFbmRFdmVudCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRFbmRFdmVudC0tO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCdlbmQnKTtcblxuICAgICAgICBpZiAodGhpcy5fb25FbmRDYWxsYmFjaylcbiAgICAgICAgICAgIHRoaXMuX29uRW5kQ2FsbGJhY2sodGhpcyk7XG5cbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIHRoZSBtYW5hZ2VyJ3MgJ3ZvbHVtZWNoYW5nZScgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMudm9sdW1lID0gdGhpcy5fdm9sdW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmRsZSB0aGUgbWFuYWdlcidzICdzdXNwZW5kJyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWFuYWdlclN1c3BlbmQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORyAmJiAhdGhpcy5fc3VzcGVuZGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zdXNwZW5kZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlIHRoZSBtYW5hZ2VyJ3MgJ3Jlc3VtZScgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hbmFnZXJSZXN1bWUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zdXNwZW5kZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3N1c3BlbmRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5yZXN1bWUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgaW50ZXJuYWwgYXVkaW8gbm9kZXMgYW5kIGNvbm5lY3RzIHRoZW0uXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbml0aWFsaXplTm9kZXMoKSB7XG4gICAgICAgIC8vIGNyZWF0ZSBnYWluIG5vZGUgZm9yIHZvbHVtZSBjb250cm9sXG4gICAgICAgIHRoaXMuZ2FpbiA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5jcmVhdGVHYWluKCk7XG4gICAgICAgIHRoaXMuX2lucHV0Tm9kZSA9IHRoaXMuZ2FpbjtcbiAgICAgICAgLy8gdGhlIGdhaW4gbm9kZSBpcyBhbHNvIHRoZSBjb25uZWN0b3Igbm9kZSBmb3IgMkQgc291bmQgaW5zdGFuY2VzXG4gICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUgPSB0aGlzLmdhaW47XG4gICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuY29ubmVjdCh0aGlzLl9tYW5hZ2VyLmNvbnRleHQuZGVzdGluYXRpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGVtcHQgdG8gYmVnaW4gcGxheWJhY2sgdGhlIHNvdW5kLlxuICAgICAqIElmIHRoZSBBdWRpb0NvbnRleHQgaXMgc3VzcGVuZGVkLCB0aGUgYXVkaW8gd2lsbCBvbmx5IHN0YXJ0IG9uY2UgaXQncyByZXN1bWVkLlxuICAgICAqIElmIHRoZSBzb3VuZCBpcyBhbHJlYWR5IHBsYXlpbmcsIHRoaXMgd2lsbCByZXN0YXJ0IHRoZSBzb3VuZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzb3VuZCB3YXMgc3RhcnRlZCBpbW1lZGlhdGVseS5cbiAgICAgKi9cbiAgICBwbGF5KCkge1xuICAgICAgICBpZiAodGhpcy5fc3RhdGUgIT09IFNUQVRFX1NUT1BQRUQpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHNldCBzdGF0ZSB0byBwbGF5aW5nXG4gICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUExBWUlORztcbiAgICAgICAgLy8gbm8gbmVlZCBmb3IgdGhpcyBhbnltb3JlXG4gICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gcGxheSgpIHdhcyBhbHJlYWR5IGlzc3VlZCBidXQgaGFzbid0IGFjdHVhbGx5IHN0YXJ0ZWQgeWV0XG4gICAgICAgIGlmICh0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1hbmFnZXIgaXMgc3VzcGVuZGVkIHNvIGF1ZGlvIGNhbm5vdCBzdGFydCBub3cgLSB3YWl0IGZvciBtYW5hZ2VyIHRvIHJlc3VtZVxuICAgICAgICBpZiAodGhpcy5fbWFuYWdlci5zdXNwZW5kZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub25jZSgncmVzdW1lJywgdGhpcy5fcGxheUF1ZGlvSW1tZWRpYXRlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbiA9IHRydWU7XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3BsYXlBdWRpb0ltbWVkaWF0ZSgpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEltbWVkaWF0ZWx5IHBsYXkgdGhlIHNvdW5kLlxuICAgICAqIFRoaXMgbWV0aG9kIGFzc3VtZXMgdGhlIEF1ZGlvQ29udGV4dCBpcyByZWFkeSAobm90IHN1c3BlbmRlZCBvciBsb2NrZWQpLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGxheUF1ZGlvSW1tZWRpYXRlKCkge1xuICAgICAgICB0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24gPSBmYWxzZTtcblxuICAgICAgICAvLyBiZXR3ZWVuIHBsYXkoKSBhbmQgdGhlIG1hbmFnZXIgYmVpbmcgcmVhZHkgdG8gcGxheSwgYSBzdG9wKCkgb3IgcGF1c2UoKSBjYWxsIHdhcyBtYWRlXG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfUExBWUlORykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjYWxjdWxhdGUgc3RhcnQgb2Zmc2V0XG4gICAgICAgIGxldCBvZmZzZXQgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0T2Zmc2V0LCB0aGlzLmR1cmF0aW9uKTtcbiAgICAgICAgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyBvZmZzZXQsIHRoaXMuX3NvdW5kLmR1cmF0aW9uKTtcbiAgICAgICAgLy8gcmVzZXQgc3RhcnQgb2Zmc2V0IG5vdyB0aGF0IHdlIHN0YXJ0ZWQgdGhlIHNvdW5kXG4gICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICAvLyBzdGFydCBzb3VyY2Ugd2l0aCBzcGVjaWZpZWQgb2Zmc2V0IGFuZCBkdXJhdGlvblxuICAgICAgICBpZiAodGhpcy5fZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIG9mZnNldCwgdGhpcy5fZHVyYXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgb2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlc2V0IHRpbWVzXG4gICAgICAgIHRoaXMuX3N0YXJ0ZWRBdCA9IHRoaXMuX21hbmFnZXIuY29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgICAgdGhpcy5fY3VycmVudFRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9jdXJyZW50T2Zmc2V0ID0gb2Zmc2V0O1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgdm9sdW1lIGFuZCBsb29wIC0gbm90ZSBtb3ZlZCB0byBiZSBhZnRlciBzdGFydCgpIGJlY2F1c2Ugb2YgQ2hyb21lIGJ1Z1xuICAgICAgICB0aGlzLnZvbHVtZSA9IHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgdGhpcy5sb29wID0gdGhpcy5fbG9vcDtcbiAgICAgICAgdGhpcy5waXRjaCA9IHRoaXMuX3BpdGNoO1xuXG4gICAgICAgIC8vIGhhbmRsZSBzdXNwZW5kIGV2ZW50cyAvIHZvbHVtZWNoYW5nZSBldmVudHNcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vbigndm9sdW1lY2hhbmdlJywgdGhpcy5fb25NYW5hZ2VyVm9sdW1lQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vbignc3VzcGVuZCcsIHRoaXMuX29uTWFuYWdlclN1c3BlbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdyZXN1bWUnLCB0aGlzLl9vbk1hbmFnZXJSZXN1bWUsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdkZXN0cm95JywgdGhpcy5fb25NYW5hZ2VyRGVzdHJveSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUGxheSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGF1c2VzIHBsYXliYWNrIG9mIHNvdW5kLiBDYWxsIHJlc3VtZSgpIHRvIHJlc3VtZSBwbGF5YmFjayBmcm9tIHRoZSBzYW1lIHBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgc291bmQgd2FzIHBhdXNlZC5cbiAgICAgKi9cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgLy8gbm8gbmVlZCBmb3IgdGhpcyBhbnltb3JlXG4gICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9QTEFZSU5HKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIC8vIHNldCBzdGF0ZSB0byBwYXVzZWRcbiAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QQVVTRUQ7XG5cbiAgICAgICAgLy8gcGxheSgpIHdhcyBpc3N1ZWQgYnV0IGhhc24ndCBhY3R1YWxseSBzdGFydGVkIHlldC5cbiAgICAgICAgaWYgKHRoaXMuX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdG9yZSBjdXJyZW50IHRpbWVcbiAgICAgICAgdGhpcy5fdXBkYXRlQ3VycmVudFRpbWUoKTtcblxuICAgICAgICAvLyBTdG9wIHRoZSBzb3VyY2UgYW5kIHJlLWNyZWF0ZSBpdCBiZWNhdXNlIHdlIGNhbm5vdCByZXVzZSB0aGUgc2FtZSBzb3VyY2UuXG4gICAgICAgIC8vIFN1c3BlbmQgdGhlIGVuZCBldmVudCBhcyB3ZSBhcmUgbWFudWFsbHkgc3RvcHBpbmcgdGhlIHNvdXJjZVxuICAgICAgICB0aGlzLl9zdXNwZW5kRW5kRXZlbnQrKztcbiAgICAgICAgdGhpcy5zb3VyY2Uuc3RvcCgwKTtcbiAgICAgICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuXG4gICAgICAgIC8vIHJlc2V0IHVzZXItc2V0IHN0YXJ0IG9mZnNldFxuICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICB0aGlzLl9vblBhdXNlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyBwbGF5YmFjayBvZiB0aGUgc291bmQuIFBsYXliYWNrIHJlc3VtZXMgYXQgdGhlIHBvaW50IHRoYXQgdGhlIGF1ZGlvIHdhcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIHRoZSBzb3VuZCB3YXMgcmVzdW1lZC5cbiAgICAgKi9cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfUEFVU0VEKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgc3RhdGUgYmFjayB0byBwbGF5aW5nXG4gICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUExBWUlORztcblxuICAgICAgICAvLyBwbGF5KCkgd2FzIGlzc3VlZCBidXQgaGFzbid0IGFjdHVhbGx5IHN0YXJ0ZWQgeWV0XG4gICAgICAgIGlmICh0aGlzLl93YWl0aW5nQ29udGV4dFN1c3BlbnNpb24pIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fY3JlYXRlU291cmNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdGFydCBhdCBwb2ludCB3aGVyZSBzb3VuZCB3YXMgcGF1c2VkXG4gICAgICAgIGxldCBvZmZzZXQgPSB0aGlzLmN1cnJlbnRUaW1lO1xuXG4gICAgICAgIC8vIGlmIHRoZSB1c2VyIHNldCB0aGUgJ2N1cnJlbnRUaW1lJyBwcm9wZXJ0eSB3aGlsZSB0aGUgc291bmRcbiAgICAgICAgLy8gd2FzIHBhdXNlZCB0aGVuIHVzZSB0aGF0IGFzIHRoZSBvZmZzZXQgaW5zdGVhZFxuICAgICAgICBpZiAodGhpcy5fc3RhcnRPZmZzZXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRPZmZzZXQsIHRoaXMuZHVyYXRpb24pO1xuICAgICAgICAgICAgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyBvZmZzZXQsIHRoaXMuX3NvdW5kLmR1cmF0aW9uKTtcblxuICAgICAgICAgICAgLy8gcmVzZXQgb2Zmc2V0XG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdGFydCBzb3VyY2VcbiAgICAgICAgaWYgKHRoaXMuX2R1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5zdGFydCgwLCBvZmZzZXQsIHRoaXMuX2R1cmF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIG9mZnNldCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zdGFydGVkQXQgPSB0aGlzLl9tYW5hZ2VyLmNvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRPZmZzZXQgPSBvZmZzZXQ7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBwYXJhbWV0ZXJzXG4gICAgICAgIHRoaXMudm9sdW1lID0gdGhpcy5fdm9sdW1lO1xuICAgICAgICB0aGlzLmxvb3AgPSB0aGlzLl9sb29wO1xuICAgICAgICB0aGlzLnBpdGNoID0gdGhpcy5fcGl0Y2g7XG4gICAgICAgIHRoaXMuX3BsYXlXaGVuTG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICB0aGlzLl9vblJlc3VtZSgpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3BzIHBsYXliYWNrIG9mIHNvdW5kLiBDYWxsaW5nIHBsYXkoKSBhZ2FpbiB3aWxsIHJlc3RhcnQgcGxheWJhY2sgZnJvbSB0aGUgYmVnaW5uaW5nIG9mXG4gICAgICogdGhlIHNvdW5kLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiB0aGUgc291bmQgd2FzIHN0b3BwZWQuXG4gICAgICovXG4gICAgc3RvcCgpIHtcbiAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAodGhpcy5fc3RhdGUgPT09IFNUQVRFX1NUT1BQRUQpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgLy8gc2V0IHN0YXRlIHRvIHN0b3BwZWRcbiAgICAgICAgY29uc3Qgd2FzUGxheWluZyA9IHRoaXMuX3N0YXRlID09PSBTVEFURV9QTEFZSU5HO1xuICAgICAgICB0aGlzLl9zdGF0ZSA9IFNUQVRFX1NUT1BQRUQ7XG5cbiAgICAgICAgLy8gcGxheSgpIHdhcyBpc3N1ZWQgYnV0IGhhc24ndCBhY3R1YWxseSBzdGFydGVkIHlldFxuICAgICAgICBpZiAodGhpcy5fd2FpdGluZ0NvbnRleHRTdXNwZW5zaW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVuc3Vic2NyaWJlIGZyb20gbWFuYWdlciBldmVudHNcbiAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3ZvbHVtZWNoYW5nZScsIHRoaXMuX29uTWFuYWdlclZvbHVtZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdzdXNwZW5kJywgdGhpcy5fb25NYW5hZ2VyU3VzcGVuZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdyZXN1bWUnLCB0aGlzLl9vbk1hbmFnZXJSZXN1bWUsIHRoaXMpO1xuICAgICAgICB0aGlzLl9tYW5hZ2VyLm9mZignZGVzdHJveScsIHRoaXMuX29uTWFuYWdlckRlc3Ryb3ksIHRoaXMpO1xuXG4gICAgICAgIC8vIHJlc2V0IHN0b3JlZCB0aW1lc1xuICAgICAgICB0aGlzLl9zdGFydGVkQXQgPSAwO1xuICAgICAgICB0aGlzLl9jdXJyZW50VGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRPZmZzZXQgPSAwO1xuXG4gICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9zdXNwZW5kRW5kRXZlbnQrKztcbiAgICAgICAgaWYgKHdhc1BsYXlpbmcgJiYgdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc291cmNlLnN0b3AoMCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zb3VyY2UgPSBudWxsO1xuXG4gICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgdGhpcy5fb25TdG9wKCk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29ubmVjdHMgZXh0ZXJuYWwgV2ViIEF1ZGlvIEFQSSBub2Rlcy4gWW91IG5lZWQgdG8gcGFzcyB0aGUgZmlyc3Qgbm9kZSBvZiB0aGUgbm9kZSBncmFwaFxuICAgICAqIHRoYXQgeW91IGNyZWF0ZWQgZXh0ZXJuYWxseSBhbmQgdGhlIGxhc3Qgbm9kZSBvZiB0aGF0IGdyYXBoLiBUaGUgZmlyc3Qgbm9kZSB3aWxsIGJlXG4gICAgICogY29ubmVjdGVkIHRvIHRoZSBhdWRpbyBzb3VyY2UgYW5kIHRoZSBsYXN0IG5vZGUgd2lsbCBiZSBjb25uZWN0ZWQgdG8gdGhlIGRlc3RpbmF0aW9uIG9mIHRoZVxuICAgICAqIEF1ZGlvQ29udGV4dCAoZS5nLiBzcGVha2VycykuIFJlcXVpcmVzIFdlYiBBdWRpbyBBUEkgc3VwcG9ydC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXVkaW9Ob2RlfSBmaXJzdE5vZGUgLSBUaGUgZmlyc3Qgbm9kZSB0aGF0IHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBhdWRpbyBzb3VyY2Ugb2Ygc291bmQgaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSB7QXVkaW9Ob2RlfSBbbGFzdE5vZGVdIC0gVGhlIGxhc3Qgbm9kZSB0aGF0IHdpbGwgYmUgY29ubmVjdGVkIHRvIHRoZSBkZXN0aW5hdGlvbiBvZiB0aGUgQXVkaW9Db250ZXh0LlxuICAgICAqIElmIHVuc3BlY2lmaWVkIHRoZW4gdGhlIGZpcnN0Tm9kZSB3aWxsIGJlIGNvbm5lY3RlZCB0byB0aGUgZGVzdGluYXRpb24gaW5zdGVhZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBjb250ZXh0ID0gYXBwLnN5c3RlbXMuc291bmQuY29udGV4dDtcbiAgICAgKiB2YXIgYW5hbHl6ZXIgPSBjb250ZXh0LmNyZWF0ZUFuYWx5emVyKCk7XG4gICAgICogdmFyIGRpc3RvcnRpb24gPSBjb250ZXh0LmNyZWF0ZVdhdmVTaGFwZXIoKTtcbiAgICAgKiB2YXIgZmlsdGVyID0gY29udGV4dC5jcmVhdGVCaXF1YWRGaWx0ZXIoKTtcbiAgICAgKiBhbmFseXplci5jb25uZWN0KGRpc3RvcnRpb24pO1xuICAgICAqIGRpc3RvcnRpb24uY29ubmVjdChmaWx0ZXIpO1xuICAgICAqIGluc3RhbmNlLnNldEV4dGVybmFsTm9kZXMoYW5hbHl6ZXIsIGZpbHRlcik7XG4gICAgICovXG4gICAgc2V0RXh0ZXJuYWxOb2RlcyhmaXJzdE5vZGUsIGxhc3ROb2RlKSB7XG4gICAgICAgIGlmICghZmlyc3ROb2RlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUaGUgZmlyc3ROb2RlIG11c3QgYmUgYSB2YWxpZCBBdWRpbyBOb2RlJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWxhc3ROb2RlKSB7XG4gICAgICAgICAgICBsYXN0Tm9kZSA9IGZpcnN0Tm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvbm5lY3Rpb25zIGFyZTpcbiAgICAgICAgLy8gc291cmNlIC0+IGlucHV0Tm9kZSAtPiBjb25uZWN0b3JOb2RlIC0+IFtmaXJzdE5vZGUgLT4gLi4uIC0+IGxhc3ROb2RlXSAtPiBzcGVha2Vyc1xuXG4gICAgICAgIGNvbnN0IHNwZWFrZXJzID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmRlc3RpbmF0aW9uO1xuXG4gICAgICAgIGlmICh0aGlzLl9maXJzdE5vZGUgIT09IGZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2ZpcnN0Tm9kZSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIGZpcnN0Tm9kZSBhbHJlYWR5IGV4aXN0cyBtZWFucyB0aGUgY29ubmVjdG9yIG5vZGVcbiAgICAgICAgICAgICAgICAvLyBpcyBjb25uZWN0ZWQgdG8gaXQgc28gZGlzY29ubmVjdCBpdFxuICAgICAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuZGlzY29ubmVjdCh0aGlzLl9maXJzdE5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBmaXJzdE5vZGUgZG9lcyBub3QgZXhpc3QgbWVhbnMgdGhhdCBpdHMgY29ubmVjdGVkXG4gICAgICAgICAgICAgICAgLy8gdG8gdGhlIHNwZWFrZXJzIHNvIGRpc2Nvbm5lY3QgaXRcbiAgICAgICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmRpc2Nvbm5lY3Qoc3BlYWtlcnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgZmlyc3Qgbm9kZSBhbmQgY29ubmVjdCB3aXRoIGNvbm5lY3RvciBub2RlXG4gICAgICAgICAgICB0aGlzLl9maXJzdE5vZGUgPSBmaXJzdE5vZGU7XG4gICAgICAgICAgICB0aGlzLl9jb25uZWN0b3JOb2RlLmNvbm5lY3QoZmlyc3ROb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9sYXN0Tm9kZSAhPT0gbGFzdE5vZGUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9sYXN0Tm9kZSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIGxhc3Qgbm9kZSBleGlzdHMgbWVhbnMgaXQncyBjb25uZWN0ZWQgdG8gdGhlIHNwZWFrZXJzIHNvIGRpc2Nvbm5lY3QgaXRcbiAgICAgICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZS5kaXNjb25uZWN0KHNwZWFrZXJzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGxhc3Qgbm9kZSBhbmQgY29ubmVjdCB3aXRoIHNwZWFrZXJzXG4gICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IGxhc3ROb2RlO1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUuY29ubmVjdChzcGVha2Vycyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgYW55IGV4dGVybmFsIG5vZGVzIHNldCBieSB7QGxpbmsgU291bmRJbnN0YW5jZSNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKi9cbiAgICBjbGVhckV4dGVybmFsTm9kZXMoKSB7XG4gICAgICAgIGNvbnN0IHNwZWFrZXJzID0gdGhpcy5fbWFuYWdlci5jb250ZXh0LmRlc3RpbmF0aW9uO1xuXG4gICAgICAgIC8vIGJyZWFrIGV4aXN0aW5nIGNvbm5lY3Rpb25zXG4gICAgICAgIGlmICh0aGlzLl9maXJzdE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuZGlzY29ubmVjdCh0aGlzLl9maXJzdE5vZGUpO1xuICAgICAgICAgICAgdGhpcy5fZmlyc3ROb2RlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9sYXN0Tm9kZSkge1xuICAgICAgICAgICAgdGhpcy5fbGFzdE5vZGUuZGlzY29ubmVjdChzcGVha2Vycyk7XG4gICAgICAgICAgICB0aGlzLl9sYXN0Tm9kZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXNldCBjb25uZWN0IHRvIHNwZWFrZXJzXG4gICAgICAgIHRoaXMuX2Nvbm5lY3Rvck5vZGUuY29ubmVjdChzcGVha2Vycyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBhbnkgZXh0ZXJuYWwgbm9kZXMgc2V0IGJ5IHtAbGluayBTb3VuZEluc3RhbmNlI3NldEV4dGVybmFsTm9kZXN9LlxuICAgICAqXG4gICAgICogQHJldHVybnMge0F1ZGlvTm9kZVtdfSBSZXR1cm5zIGFuIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHR3byBub2RlcyBzZXQgYnlcbiAgICAgKiB7QGxpbmsgU291bmRJbnN0YW5jZSNzZXRFeHRlcm5hbE5vZGVzfS5cbiAgICAgKi9cbiAgICBnZXRFeHRlcm5hbE5vZGVzKCkge1xuICAgICAgICByZXR1cm4gW3RoaXMuX2ZpcnN0Tm9kZSwgdGhpcy5fbGFzdE5vZGVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgdGhlIHNvdXJjZSBmb3IgdGhlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge0F1ZGlvQnVmZmVyU291cmNlTm9kZXxudWxsfSBSZXR1cm5zIHRoZSBjcmVhdGVkIHNvdXJjZSBvciBudWxsIGlmIHRoZSBzb3VuZFxuICAgICAqIGluc3RhbmNlIGhhcyBubyB7QGxpbmsgU291bmR9IGFzc29jaWF0ZWQgd2l0aCBpdC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jcmVhdGVTb3VyY2UoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc291bmQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29udGV4dCA9IHRoaXMuX21hbmFnZXIuY29udGV4dDtcblxuICAgICAgICBpZiAodGhpcy5fc291bmQuYnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZSA9IGNvbnRleHQuY3JlYXRlQnVmZmVyU291cmNlKCk7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5idWZmZXIgPSB0aGlzLl9zb3VuZC5idWZmZXI7XG5cbiAgICAgICAgICAgIC8vIENvbm5lY3QgdXAgdGhlIG5vZGVzXG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5jb25uZWN0KHRoaXMuX2lucHV0Tm9kZSk7XG5cbiAgICAgICAgICAgIC8vIHNldCBldmVudHNcbiAgICAgICAgICAgIHRoaXMuc291cmNlLm9uZW5kZWQgPSB0aGlzLl9lbmRlZEhhbmRsZXI7XG5cbiAgICAgICAgICAgIC8vIHNldCBsb29wU3RhcnQgYW5kIGxvb3BFbmQgc28gdGhhdCB0aGUgc291cmNlIHN0YXJ0cyBhbmQgZW5kcyBhdCB0aGUgY29ycmVjdCB1c2VyLXNldCB0aW1lc1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UubG9vcFN0YXJ0ID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUsIHRoaXMuc291cmNlLmJ1ZmZlci5kdXJhdGlvbik7XG4gICAgICAgICAgICBpZiAodGhpcy5fZHVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5sb29wRW5kID0gTWF0aC5tYXgodGhpcy5zb3VyY2UubG9vcFN0YXJ0LCBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIHRoaXMuX2R1cmF0aW9uLCB0aGlzLnNvdXJjZS5idWZmZXIuZHVyYXRpb24pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLnNvdXJjZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjdXJyZW50IHRpbWUgdGFraW5nIGludG8gYWNjb3VudCB0aGUgdGltZSB0aGUgaW5zdGFuY2Ugc3RhcnRlZCBwbGF5aW5nLCB0aGUgY3VycmVudFxuICAgICAqIHBpdGNoIGFuZCB0aGUgY3VycmVudCB0aW1lIG9mZnNldC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3VwZGF0ZUN1cnJlbnRUaW1lKCkge1xuICAgICAgICB0aGlzLl9jdXJyZW50VGltZSA9IGNhcFRpbWUoKHRoaXMuX21hbmFnZXIuY29udGV4dC5jdXJyZW50VGltZSAtIHRoaXMuX3N0YXJ0ZWRBdCkgKiB0aGlzLl9waXRjaCArIHRoaXMuX2N1cnJlbnRPZmZzZXQsIHRoaXMuZHVyYXRpb24pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhhbmRsZSB0aGUgbWFuYWdlcidzICdkZXN0cm95JyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWFuYWdlckRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLnNvdXJjZSAmJiB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfUExBWUlORykge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2Uuc3RvcCgwKTtcbiAgICAgICAgICAgIHRoaXMuc291cmNlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuaWYgKCFoYXNBdWRpb0NvbnRleHQoKSkge1xuICAgIE9iamVjdC5hc3NpZ24oU291bmRJbnN0YW5jZS5wcm90b3R5cGUsIHtcbiAgICAgICAgcGxheTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3N0YXRlICE9PSBTVEFURV9TVE9QUEVEKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NyZWF0ZVNvdXJjZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudm9sdW1lID0gdGhpcy5fdm9sdW1lO1xuICAgICAgICAgICAgdGhpcy5waXRjaCA9IHRoaXMuX3BpdGNoO1xuICAgICAgICAgICAgdGhpcy5sb29wID0gdGhpcy5fbG9vcDtcblxuICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheSgpO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QTEFZSU5HO1xuICAgICAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vbigndm9sdW1lY2hhbmdlJywgdGhpcy5fb25NYW5hZ2VyVm9sdW1lQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3N1c3BlbmQnLCB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub24oJ3Jlc3VtZScsIHRoaXMuX29uTWFuYWdlclJlc3VtZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLl9tYW5hZ2VyLm9uKCdkZXN0cm95JywgdGhpcy5fb25NYW5hZ2VyRGVzdHJveSwgdGhpcyk7XG5cbiAgICAgICAgICAgIC8vIHN1c3BlbmQgaW1tZWRpYXRlbHkgaWYgbWFuYWdlciBpcyBzdXNwZW5kZWRcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYW5hZ2VyLnN1c3BlbmRlZClcbiAgICAgICAgICAgICAgICB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kKCk7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fc3VzcGVuZEluc3RhbmNlRXZlbnRzKVxuICAgICAgICAgICAgICAgIHRoaXMuX29uUGxheSgpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcblxuICAgICAgICB9LFxuXG4gICAgICAgIHBhdXNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc291cmNlIHx8IHRoaXMuX3N0YXRlICE9PSBTVEFURV9QTEFZSU5HKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50Kys7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5wYXVzZSgpO1xuICAgICAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfUEFVU0VEO1xuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLl9vblBhdXNlKCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlc3VtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSB8fCB0aGlzLl9zdGF0ZSAhPT0gU1RBVEVfUEFVU0VEKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5fc3RhdGUgPSBTVEFURV9QTEFZSU5HO1xuICAgICAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZS5wYXVzZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5wbGF5KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX3N1c3BlbmRJbnN0YW5jZUV2ZW50cylcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb25SZXN1bWUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLnNvdXJjZSB8fCB0aGlzLl9zdGF0ZSA9PT0gU1RBVEVfU1RPUFBFRClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCd2b2x1bWVjaGFuZ2UnLCB0aGlzLl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ3N1c3BlbmQnLCB0aGlzLl9vbk1hbmFnZXJTdXNwZW5kLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuX21hbmFnZXIub2ZmKCdyZXN1bWUnLCB0aGlzLl9vbk1hbmFnZXJSZXN1bWUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5fbWFuYWdlci5vZmYoJ2Rlc3Ryb3knLCB0aGlzLl9vbk1hbmFnZXJEZXN0cm95LCB0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy5fc3VzcGVuZEVuZEV2ZW50Kys7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5wYXVzZSgpO1xuICAgICAgICAgICAgdGhpcy5fcGxheVdoZW5Mb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX3N0YXRlID0gU1RBVEVfU1RPUFBFRDtcbiAgICAgICAgICAgIHRoaXMuX3N0YXJ0T2Zmc2V0ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9zdXNwZW5kSW5zdGFuY2VFdmVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5fb25TdG9wKCk7XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldEV4dGVybmFsTm9kZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgfSxcblxuICAgICAgICBjbGVhckV4dGVybmFsTm9kZXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgfSxcblxuICAgICAgICBnZXRFeHRlcm5hbE5vZGVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGJ1dCByZXR1cm4gc2FtZSB0eXBlIG9mIHJlc3VsdFxuICAgICAgICAgICAgcmV0dXJuIFtudWxsLCBudWxsXTtcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBTZXRzIHN0YXJ0IHRpbWUgYWZ0ZXIgbG9hZGVkbWV0YWRhdGEgaXMgZmlyZWQgd2hpY2ggaXMgcmVxdWlyZWQgYnkgbW9zdCBicm93c2Vyc1xuICAgICAgICBfb25Mb2FkZWRNZXRhZGF0YTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignbG9hZGVkbWV0YWRhdGEnLCB0aGlzLl9sb2FkZWRNZXRhZGF0YUhhbmRsZXIpO1xuXG4gICAgICAgICAgICB0aGlzLl9pc1JlYWR5ID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIHN0YXJ0IHRpbWUgZm9yIHNvdXJjZVxuICAgICAgICAgICAgbGV0IG9mZnNldCA9IGNhcFRpbWUodGhpcy5fc3RhcnRPZmZzZXQsIHRoaXMuZHVyYXRpb24pO1xuICAgICAgICAgICAgb2Zmc2V0ID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUgKyBvZmZzZXQsIHRoaXMuX3NvdW5kLmR1cmF0aW9uKTtcbiAgICAgICAgICAgIC8vIHJlc2V0IGN1cnJlbnRUaW1lXG4gICAgICAgICAgICB0aGlzLl9zdGFydE9mZnNldCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIHNldCBvZmZzZXQgb24gc291cmNlXG4gICAgICAgICAgICB0aGlzLnNvdXJjZS5jdXJyZW50VGltZSA9IG9mZnNldDtcbiAgICAgICAgfSxcblxuICAgICAgICBfY3JlYXRlU291cmNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc291bmQgJiYgdGhpcy5fc291bmQuYXVkaW8pIHtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2lzUmVhZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZSA9IHRoaXMuX3NvdW5kLmF1ZGlvLmNsb25lTm9kZSh0cnVlKTtcblxuICAgICAgICAgICAgICAgIC8vIHNldCBldmVudHNcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5hZGRFdmVudExpc3RlbmVyKCdsb2FkZWRtZXRhZGF0YScsIHRoaXMuX2xvYWRlZE1ldGFkYXRhSGFuZGxlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UuYWRkRXZlbnRMaXN0ZW5lcigndGltZXVwZGF0ZScsIHRoaXMuX3RpbWVVcGRhdGVIYW5kbGVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5vbmVuZGVkID0gdGhpcy5fZW5kZWRIYW5kbGVyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gY2FsbGVkIGV2ZXJ5IHRpbWUgdGhlICdjdXJyZW50VGltZScgaXMgY2hhbmdlZFxuICAgICAgICBfb25UaW1lVXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2R1cmF0aW9uKVxuICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIGN1cnJlbnRUaW1lIHBhc3NlcyB0aGUgZW5kIHRoZW4gaWYgbG9vcGluZyBnbyBiYWNrIHRvIHRoZSBiZWdpbm5pbmdcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSBtYW51YWxseSBzdG9wXG4gICAgICAgICAgICBpZiAodGhpcy5zb3VyY2UuY3VycmVudFRpbWUgPiBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIHRoaXMuX2R1cmF0aW9uLCB0aGlzLnNvdXJjZS5kdXJhdGlvbikpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5sb29wKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLmN1cnJlbnRUaW1lID0gY2FwVGltZSh0aGlzLl9zdGFydFRpbWUsIHRoaXMuc291cmNlLmR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgbGlzdGVuZXIgdG8gcHJldmVudCBtdWx0aXBsZSBjYWxsc1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5yZW1vdmVFdmVudExpc3RlbmVyKCd0aW1ldXBkYXRlJywgdGhpcy5fdGltZVVwZGF0ZUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNvdXJjZS5wYXVzZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbGwgdGhpcyBtYW51YWxseSBiZWNhdXNlIGl0IGRvZXNuJ3Qgd29yayBpbiBhbGwgYnJvd3NlcnMgaW4gdGhpcyBjYXNlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uRW5kZWQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgX29uTWFuYWdlckRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc291cmNlLnBhdXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwgJ3ZvbHVtZScsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZvbHVtZSkge1xuICAgICAgICAgICAgdm9sdW1lID0gbWF0aC5jbGFtcCh2b2x1bWUsIDAsIDEpO1xuICAgICAgICAgICAgdGhpcy5fdm9sdW1lID0gdm9sdW1lO1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2Uudm9sdW1lID0gdm9sdW1lICogdGhpcy5fbWFuYWdlci52b2x1bWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwgJ3BpdGNoJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9waXRjaDtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChwaXRjaCkge1xuICAgICAgICAgICAgdGhpcy5fcGl0Y2ggPSBNYXRoLm1heChOdW1iZXIocGl0Y2gpIHx8IDAsIDAuMDEpO1xuICAgICAgICAgICAgaWYgKHRoaXMuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UucGxheWJhY2tSYXRlID0gdGhpcy5fcGl0Y2g7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwgJ3NvdW5kJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zb3VuZDtcbiAgICAgICAgfSxcblxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9zb3VuZCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTb3VuZEluc3RhbmNlLnByb3RvdHlwZSwgJ2N1cnJlbnRUaW1lJywge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zdGFydE9mZnNldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zdGFydE9mZnNldDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX3N0YXRlID09PSBTVEFURV9TVE9QUEVEIHx8ICF0aGlzLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zb3VyY2UuY3VycmVudFRpbWUgLSB0aGlzLl9zdGFydFRpbWU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA8IDApIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnNvdXJjZSAmJiB0aGlzLl9pc1JlYWR5KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zb3VyY2UuY3VycmVudFRpbWUgPSBjYXBUaW1lKHRoaXMuX3N0YXJ0VGltZSArIGNhcFRpbWUodmFsdWUsIHRoaXMuZHVyYXRpb24pLCB0aGlzLl9zb3VuZC5kdXJhdGlvbik7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3RhcnRPZmZzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmV4cG9ydCB7IFNvdW5kSW5zdGFuY2UgfTtcbiJdLCJuYW1lcyI6WyJTVEFURV9QTEFZSU5HIiwiU1RBVEVfUEFVU0VEIiwiU1RBVEVfU1RPUFBFRCIsImNhcFRpbWUiLCJ0aW1lIiwiZHVyYXRpb24iLCJTb3VuZEluc3RhbmNlIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJtYW5hZ2VyIiwic291bmQiLCJvcHRpb25zIiwic291cmNlIiwiX21hbmFnZXIiLCJfdm9sdW1lIiwidm9sdW1lIiwidW5kZWZpbmVkIiwibWF0aCIsImNsYW1wIiwiTnVtYmVyIiwiX3BpdGNoIiwicGl0Y2giLCJNYXRoIiwibWF4IiwiX2xvb3AiLCJsb29wIiwiX3NvdW5kIiwiX3N0YXRlIiwiX3N1c3BlbmRlZCIsIl9zdXNwZW5kRW5kRXZlbnQiLCJfc3VzcGVuZEluc3RhbmNlRXZlbnRzIiwiX3BsYXlXaGVuTG9hZGVkIiwiX3N0YXJ0VGltZSIsInN0YXJ0VGltZSIsIl9kdXJhdGlvbiIsIl9zdGFydE9mZnNldCIsIl9vblBsYXlDYWxsYmFjayIsIm9uUGxheSIsIl9vblBhdXNlQ2FsbGJhY2siLCJvblBhdXNlIiwiX29uUmVzdW1lQ2FsbGJhY2siLCJvblJlc3VtZSIsIl9vblN0b3BDYWxsYmFjayIsIm9uU3RvcCIsIl9vbkVuZENhbGxiYWNrIiwib25FbmQiLCJoYXNBdWRpb0NvbnRleHQiLCJfc3RhcnRlZEF0IiwiX2N1cnJlbnRUaW1lIiwiX2N1cnJlbnRPZmZzZXQiLCJfaW5wdXROb2RlIiwiX2Nvbm5lY3Rvck5vZGUiLCJfZmlyc3ROb2RlIiwiX2xhc3ROb2RlIiwiX3dhaXRpbmdDb250ZXh0U3VzcGVuc2lvbiIsIl9pbml0aWFsaXplTm9kZXMiLCJfZW5kZWRIYW5kbGVyIiwiX29uRW5kZWQiLCJiaW5kIiwiX2lzUmVhZHkiLCJfbG9hZGVkTWV0YWRhdGFIYW5kbGVyIiwiX29uTG9hZGVkTWV0YWRhdGEiLCJfdGltZVVwZGF0ZUhhbmRsZXIiLCJfb25UaW1lVXBkYXRlIiwiX2NyZWF0ZVNvdXJjZSIsImN1cnJlbnRUaW1lIiwidmFsdWUiLCJzdXNwZW5kIiwic3RvcCIsInBsYXkiLCJfdXBkYXRlQ3VycmVudFRpbWUiLCJpc1BsYXlpbmciLCJpc1BhdXNlZCIsImlzU3RvcHBlZCIsImlzU3VzcGVuZGVkIiwiY29udGV4dCIsInBsYXliYWNrUmF0ZSIsImdhaW4iLCJfb25QbGF5IiwiZmlyZSIsIl9vblBhdXNlIiwiX29uUmVzdW1lIiwiX29uU3RvcCIsIl9vbk1hbmFnZXJWb2x1bWVDaGFuZ2UiLCJfb25NYW5hZ2VyU3VzcGVuZCIsInBhdXNlIiwiX29uTWFuYWdlclJlc3VtZSIsInJlc3VtZSIsImNyZWF0ZUdhaW4iLCJjb25uZWN0IiwiZGVzdGluYXRpb24iLCJzdXNwZW5kZWQiLCJvbmNlIiwiX3BsYXlBdWRpb0ltbWVkaWF0ZSIsIm9mZnNldCIsInN0YXJ0Iiwib24iLCJfb25NYW5hZ2VyRGVzdHJveSIsIndhc1BsYXlpbmciLCJvZmYiLCJzZXRFeHRlcm5hbE5vZGVzIiwiZmlyc3ROb2RlIiwibGFzdE5vZGUiLCJjb25zb2xlIiwiZXJyb3IiLCJzcGVha2VycyIsImRpc2Nvbm5lY3QiLCJjbGVhckV4dGVybmFsTm9kZXMiLCJnZXRFeHRlcm5hbE5vZGVzIiwiYnVmZmVyIiwiY3JlYXRlQnVmZmVyU291cmNlIiwib25lbmRlZCIsImxvb3BTdGFydCIsImxvb3BFbmQiLCJPYmplY3QiLCJhc3NpZ24iLCJwcm90b3R5cGUiLCJwYXVzZWQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiYXVkaW8iLCJjbG9uZU5vZGUiLCJhZGRFdmVudExpc3RlbmVyIiwiZGVmaW5lUHJvcGVydHkiLCJnZXQiLCJzZXQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQVNBLE1BQU1BLGFBQWEsR0FBRyxDQUF0QixDQUFBO0FBQ0EsTUFBTUMsWUFBWSxHQUFHLENBQXJCLENBQUE7QUFDQSxNQUFNQyxhQUFhLEdBQUcsQ0FBdEIsQ0FBQTs7QUFVQSxTQUFT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
