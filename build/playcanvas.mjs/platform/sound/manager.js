import '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { math } from '../../core/math/math.js';
import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';
import { Listener } from './listener.js';

const CONTEXT_STATE_RUNNING = 'running';
const USER_INPUT_EVENTS = ['click', 'touchstart', 'mousedown'];
class SoundManager extends EventHandler {
	constructor() {
		super();
		this._context = null;
		this.AudioContext = typeof AudioContext !== 'undefined' && AudioContext || typeof webkitAudioContext !== 'undefined' && webkitAudioContext;
		if (!this.AudioContext) ;
		this._unlockHandlerFunc = this._unlockHandler.bind(this);
		this._userSuspended = false;
		this.listener = new Listener(this);
		this._volume = 1;
	}
	set volume(volume) {
		volume = math.clamp(volume, 0, 1);
		this._volume = volume;
		this.fire('volumechange', volume);
	}
	get volume() {
		return this._volume;
	}
	get suspended() {
		return this._userSuspended;
	}
	get context() {
		if (!this._context && this.AudioContext) {
			this._context = new this.AudioContext();
			if (this._context.state !== CONTEXT_STATE_RUNNING) {
				this._registerUnlockListeners();
			}
		}
		return this._context;
	}
	suspend() {
		if (!this._userSuspended) {
			this._userSuspended = true;
			if (this._context && this._context.state === CONTEXT_STATE_RUNNING) {
				this._suspend();
			}
		}
	}
	resume() {
		if (this._userSuspended) {
			this._userSuspended = false;
			if (this._context && this._context.state !== CONTEXT_STATE_RUNNING) {
				this._resume();
			}
		}
	}
	destroy() {
		this.fire('destroy');
		if (this._context) {
			var _this$_context;
			this._removeUnlockListeners();
			(_this$_context = this._context) == null ? void 0 : _this$_context.close();
			this._context = null;
		}
	}
	playSound(sound, options = {}) {
		let channel = null;
		if (Channel) {
			channel = new Channel(this, sound, options);
			channel.play();
		}
		return channel;
	}
	playSound3d(sound, position, options = {}) {
		let channel = null;
		if (Channel3d) {
			channel = new Channel3d(this, sound, options);
			channel.setPosition(position);
			if (options.volume) {
				channel.setVolume(options.volume);
			}
			if (options.loop) {
				channel.setLoop(options.loop);
			}
			if (options.maxDistance) {
				channel.setMaxDistance(options.maxDistance);
			}
			if (options.minDistance) {
				channel.setMinDistance(options.minDistance);
			}
			if (options.rollOffFactor) {
				channel.setRollOffFactor(options.rollOffFactor);
			}
			if (options.distanceModel) {
				channel.setDistanceModel(options.distanceModel);
			}
			channel.play();
		}
		return channel;
	}
	_resume() {
		this._context.resume().then(() => {
			const source = this._context.createBufferSource();
			source.buffer = this._context.createBuffer(1, 1, this._context.sampleRate);
			source.connect(this._context.destination);
			source.start(0);
			source.onended = event => {
				source.disconnect(0);
				this.fire('resume');
			};
		}, e => {}).catch(e => {});
	}
	_suspend() {
		this._context.suspend().then(() => {
			this.fire('suspend');
		}, e => {}).catch(e => {});
	}
	_unlockHandler() {
		this._removeUnlockListeners();
		if (!this._userSuspended && this._context.state !== CONTEXT_STATE_RUNNING) {
			this._resume();
		}
	}
	_registerUnlockListeners() {
		USER_INPUT_EVENTS.forEach(eventName => {
			window.addEventListener(eventName, this._unlockHandlerFunc, false);
		});
	}
	_removeUnlockListeners() {
		USER_INPUT_EVENTS.forEach(eventName => {
			window.removeEventListener(eventName, this._unlockHandlerFunc, false);
		});
	}
}

export { SoundManager };
