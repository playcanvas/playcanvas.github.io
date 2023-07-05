import '../../../core/debug.js';
import { DISTANCE_LINEAR } from '../../../platform/audio/constants.js';
import { Component } from '../component.js';
import { SoundSlot } from './slot.js';

class SoundComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._volume = 1;
		this._pitch = 1;
		this._positional = true;
		this._refDistance = 1;
		this._maxDistance = 10000;
		this._rollOffFactor = 1;
		this._distanceModel = DISTANCE_LINEAR;
		this._slots = {};
		this._playingBeforeDisable = {};
	}
	_updateSoundInstances(property, value, isFactor) {
		const slots = this._slots;
		for (const key in slots) {
			const slot = slots[key];
			if (!slot.overlap) {
				const instances = slot.instances;
				for (let i = 0, len = instances.length; i < len; i++) {
					instances[i][property] = isFactor ? slot[property] * value : value;
				}
			}
		}
	}
	set distanceModel(value) {
		this._distanceModel = value;
		this._updateSoundInstances('distanceModel', value, false);
	}
	get distanceModel() {
		return this._distanceModel;
	}
	set maxDistance(value) {
		this._maxDistance = value;
		this._updateSoundInstances('maxDistance', value, false);
	}
	get maxDistance() {
		return this._maxDistance;
	}
	set refDistance(value) {
		this._refDistance = value;
		this._updateSoundInstances('refDistance', value, false);
	}
	get refDistance() {
		return this._refDistance;
	}
	set rollOffFactor(value) {
		this._rollOffFactor = value;
		this._updateSoundInstances('rollOffFactor', value, false);
	}
	get rollOffFactor() {
		return this._rollOffFactor;
	}
	set pitch(value) {
		this._pitch = value;
		this._updateSoundInstances('pitch', value, true);
	}
	get pitch() {
		return this._pitch;
	}
	set volume(value) {
		this._volume = value;
		this._updateSoundInstances('volume', value, true);
	}
	get volume() {
		return this._volume;
	}
	set positional(newValue) {
		this._positional = newValue;
		const slots = this._slots;
		for (const key in slots) {
			const slot = slots[key];
			if (!slot.overlap) {
				const instances = slot.instances;
				const oldLength = instances.length;
				for (let i = oldLength - 1; i >= 0; i--) {
					const isPlaying = instances[i].isPlaying || instances[i].isSuspended;
					const currentTime = instances[i].currentTime;
					if (isPlaying) instances[i].stop();
					const instance = slot._createInstance();
					if (isPlaying) {
						instance.play();
						instance.currentTime = currentTime;
					}
					instances.push(instance);
				}
			}
		}
	}
	get positional() {
		return this._positional;
	}
	set slots(newValue) {
		const oldValue = this._slots;
		if (oldValue) {
			for (const key in oldValue) {
				oldValue[key].stop();
			}
		}
		const slots = {};
		for (const key in newValue) {
			if (!(newValue[key] instanceof SoundSlot)) {
				if (newValue[key].name) {
					slots[newValue[key].name] = new SoundSlot(this, newValue[key].name, newValue[key]);
				}
			} else {
				slots[newValue[key].name] = newValue[key];
			}
		}
		this._slots = slots;
		if (this.enabled && this.entity.enabled) this.onEnable();
	}
	get slots() {
		return this._slots;
	}
	onEnable() {
		if (this.system._inTools) {
			return;
		}
		const slots = this._slots;
		const playingBeforeDisable = this._playingBeforeDisable;
		for (const key in slots) {
			const slot = slots[key];
			if (slot.autoPlay && slot.isStopped) {
				slot.play();
			} else if (playingBeforeDisable[key]) {
				slot.resume();
			} else if (!slot.isLoaded) {
				slot.load();
			}
		}
	}
	onDisable() {
		const slots = this._slots;
		const playingBeforeDisable = {};
		for (const key in slots) {
			if (!slots[key].overlap) {
				if (slots[key].isPlaying) {
					slots[key].pause();
					playingBeforeDisable[key] = true;
				}
			}
		}
		this._playingBeforeDisable = playingBeforeDisable;
	}
	onRemove() {
		this.off();
	}
	addSlot(name, options) {
		const slots = this._slots;
		if (slots[name]) {
			return null;
		}
		const slot = new SoundSlot(this, name, options);
		slots[name] = slot;
		if (slot.autoPlay && this.enabled && this.entity.enabled) {
			slot.play();
		}
		return slot;
	}
	removeSlot(name) {
		const slots = this._slots;
		if (slots[name]) {
			slots[name].stop();
			delete slots[name];
		}
	}
	slot(name) {
		return this._slots[name];
	}
	_getSlotProperty(name, property) {
		if (!this.enabled || !this.entity.enabled) {
			return undefined;
		}
		const slot = this._slots[name];
		if (!slot) {
			return undefined;
		}
		return slot[property];
	}
	isPlaying(name) {
		return this._getSlotProperty(name, 'isPlaying') || false;
	}
	isLoaded(name) {
		return this._getSlotProperty(name, 'isLoaded') || false;
	}
	isPaused(name) {
		return this._getSlotProperty(name, 'isPaused') || false;
	}
	isStopped(name) {
		return this._getSlotProperty(name, 'isStopped') || false;
	}
	play(name) {
		if (!this.enabled || !this.entity.enabled) {
			return null;
		}
		const slot = this._slots[name];
		if (!slot) {
			return null;
		}
		return slot.play();
	}
	pause(name) {
		const slots = this._slots;
		if (name) {
			const slot = slots[name];
			if (!slot) {
				return;
			}
			slot.pause();
		} else {
			for (const key in slots) {
				slots[key].pause();
			}
		}
	}
	resume(name) {
		const slots = this._slots;
		if (name) {
			const slot = slots[name];
			if (!slot) {
				return;
			}
			if (slot.isPaused) {
				slot.resume();
			}
		} else {
			for (const key in slots) {
				slots[key].resume();
			}
		}
	}
	stop(name) {
		const slots = this._slots;
		if (name) {
			const slot = slots[name];
			if (!slot) {
				return;
			}
			slot.stop();
		} else {
			for (const key in slots) {
				slots[key].stop();
			}
		}
	}
}

export { SoundComponent };
