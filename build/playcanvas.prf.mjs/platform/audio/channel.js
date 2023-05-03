import { math } from '../../core/math/math.js';
import { hasAudioContext } from './capabilities.js';

class Channel {
	constructor(manager, sound, options = {}) {
		var _options$volume, _options$loop, _options$pitch;
		this.volume = (_options$volume = options.volume) != null ? _options$volume : 1;
		this.loop = (_options$loop = options.loop) != null ? _options$loop : false;
		this.pitch = (_options$pitch = options.pitch) != null ? _options$pitch : 1;
		this.sound = sound;
		this.paused = false;
		this.suspended = false;
		this.manager = manager;
		this.source = null;
		if (hasAudioContext()) {
			this.startTime = 0;
			this.startOffset = 0;
			const context = manager.context;
			this.gain = context.createGain();
		} else if (sound.audio) {
			this.source = sound.audio.cloneNode(false);
			this.source.pause();
		}
	}
	getVolume() {
		return this.volume;
	}
	getLoop() {
		return this.loop;
	}
	setLoop(loop) {
		this.loop = loop;
		if (this.source) {
			this.source.loop = loop;
		}
	}
	getPitch() {
		return this.pitch;
	}
	onManagerVolumeChange() {
		this.setVolume(this.getVolume());
	}
	onManagerSuspend() {
		if (this.isPlaying() && !this.suspended) {
			this.suspended = true;
			this.pause();
		}
	}
	onManagerResume() {
		if (this.suspended) {
			this.suspended = false;
			this.unpause();
		}
	}
	play() {
		if (this.source) {
			throw new Error('Call stop() before calling play()');
		}
		this._createSource();
		if (!this.source) {
			return;
		}
		this.startTime = this.manager.context.currentTime;
		this.source.start(0, this.startOffset % this.source.buffer.duration);
		this.setVolume(this.volume);
		this.setLoop(this.loop);
		this.setPitch(this.pitch);
		this.manager.on('volumechange', this.onManagerVolumeChange, this);
		this.manager.on('suspend', this.onManagerSuspend, this);
		this.manager.on('resume', this.onManagerResume, this);
		if (this.manager.suspended) this.onManagerSuspend();
	}
	pause() {
		if (this.source) {
			this.paused = true;
			this.startOffset += this.manager.context.currentTime - this.startTime;
			this.source.stop(0);
			this.source = null;
		}
	}
	unpause() {
		if (this.source || !this.paused) {
			console.warn('Call pause() before unpausing.');
			return;
		}
		this._createSource();
		if (!this.source) {
			return;
		}
		this.startTime = this.manager.context.currentTime;
		this.source.start(0, this.startOffset % this.source.buffer.duration);
		this.setVolume(this.volume);
		this.setLoop(this.loop);
		this.setPitch(this.pitch);
		this.paused = false;
	}
	stop() {
		if (this.source) {
			this.source.stop(0);
			this.source = null;
		}
		this.manager.off('volumechange', this.onManagerVolumeChange, this);
		this.manager.off('suspend', this.onManagerSuspend, this);
		this.manager.off('resume', this.onManagerResume, this);
	}
	setVolume(volume) {
		volume = math.clamp(volume, 0, 1);
		this.volume = volume;
		if (this.gain) {
			this.gain.gain.value = volume * this.manager.volume;
		}
	}
	setPitch(pitch) {
		this.pitch = pitch;
		if (this.source) {
			this.source.playbackRate.value = pitch;
		}
	}
	isPlaying() {
		return !this.paused && this.source.playbackState === this.source.PLAYING_STATE;
	}
	getDuration() {
		return this.source ? this.source.buffer.duration : 0;
	}
	_createSource() {
		const context = this.manager.context;
		if (this.sound.buffer) {
			this.source = context.createBufferSource();
			this.source.buffer = this.sound.buffer;
			this.source.connect(this.gain);
			this.gain.connect(context.destination);
			if (!this.loop) {
				this.source.onended = this.pause.bind(this);
			}
		}
	}
}
if (!hasAudioContext()) {
	Object.assign(Channel.prototype, {
		play: function () {
			if (this.source) {
				this.paused = false;
				this.setVolume(this.volume);
				this.setLoop(this.loop);
				this.setPitch(this.pitch);
				this.source.play();
			}
			this.manager.on('volumechange', this.onManagerVolumeChange, this);
			this.manager.on('suspend', this.onManagerSuspend, this);
			this.manager.on('resume', this.onManagerResume, this);
			if (this.manager.suspended) this.onManagerSuspend();
		},
		pause: function () {
			if (this.source) {
				this.paused = true;
				this.source.pause();
			}
		},
		unpause: function () {
			if (this.source) {
				this.paused = false;
				this.source.play();
			}
		},
		stop: function () {
			if (this.source) {
				this.source.pause();
			}
			this.manager.off('volumechange', this.onManagerVolumeChange, this);
			this.manager.off('suspend', this.onManagerSuspend, this);
			this.manager.off('resume', this.onManagerResume, this);
		},
		setVolume: function (volume) {
			volume = math.clamp(volume, 0, 1);
			this.volume = volume;
			if (this.source) {
				this.source.volume = volume * this.manager.volume;
			}
		},
		setPitch: function (pitch) {
			this.pitch = pitch;
			if (this.source) {
				this.source.playbackRate = pitch;
			}
		},
		getDuration: function () {
			return this.source && !isNaN(this.source.duration) ? this.source.duration : 0;
		},
		isPlaying: function () {
			return !this.source.paused;
		}
	});
}

export { Channel };
