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
		let offset = this.currentTime;
		this._state = STATE_PLAYING;
		if (this._waitingContextSuspension) {
			return true;
		}
		if (!this.source) {
			this._createSource();
		}
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
