import { EventHandler } from '../../../core/event-handler.js';
import '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Asset } from '../../asset/asset.js';
import { SoundInstance } from '../../../platform/sound/instance.js';
import { SoundInstance3d } from '../../../platform/sound/instance3d.js';

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
class SoundSlot extends EventHandler {
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
	play() {
		if (!this.overlap) {
			this.stop();
		}
		if (!this.isLoaded && !this._hasAsset()) {
			return undefined;
		}
		const instance = this._createInstance();
		this.instances.push(instance);
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
	resume() {
		let resumed = false;
		const instances = this.instances;
		for (let i = 0, len = instances.length; i < len; i++) {
			if (instances[i].resume()) resumed = true;
		}
		return resumed;
	}
	stop() {
		let stopped = false;
		const instances = this.instances;
		let i = instances.length;
		while (i--) {
			instances[i].stop();
			stopped = true;
		}
		instances.length = 0;
		return stopped;
	}
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
		if (!this._overlap) {
			const instances = this.instances;
			for (let i = 0, len = instances.length; i < len; i++) {
				instances[i].setExternalNodes(firstNode, lastNode);
			}
		}
	}
	clearExternalNodes() {
		this._firstNode = null;
		this._lastNode = null;
		if (!this._overlap) {
			const instances = this.instances;
			for (let i = 0, len = instances.length; i < len; i++) {
				instances[i].clearExternalNodes();
			}
		}
	}
	getExternalNodes() {
		return [this._firstNode, this._lastNode];
	}
	_hasAsset() {
		return this._asset != null;
	}
	_createInstance() {
		let instance = null;
		const component = this._component;
		let sound = null;
		if (this._hasAsset()) {
			const asset = this._assets.get(this._asset);
			if (asset) {
				sound = asset.resource;
			}
		}
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
		if (this._firstNode) {
			instance.setExternalNodes(this._firstNode, this._lastNode);
		}
		return instance;
	}
	_onInstancePlay(instance) {
		this.fire('play', instance);
		this._component.fire('play', this, instance);
	}
	_onInstancePause(instance) {
		this.fire('pause', instance);
		this._component.fire('pause', this, instance);
	}
	_onInstanceResume(instance) {
		this.fire('resume', instance);
		this._component.fire('resume', this, instance);
	}
	_onInstanceStop(instance) {
		const idx = this.instances.indexOf(instance);
		if (idx !== -1) {
			this.instances.splice(idx, 1);
		}
		this.fire('stop', instance);
		this._component.fire('stop', this, instance);
	}
	_onInstanceEnd(instance) {
		const idx = this.instances.indexOf(instance);
		if (idx !== -1) {
			this.instances.splice(idx, 1);
		}
		this.fire('end', instance);
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
		if (this._hasAsset() && this._component.enabled && this._component.entity.enabled) {
			this.load();
		}
	}
	get asset() {
		return this._asset;
	}
	set autoPlay(value) {
		this._autoPlay = !!value;
	}
	get autoPlay() {
		return this._autoPlay;
	}
	set duration(value) {
		this._duration = Math.max(0, Number(value) || 0) || null;
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
		if (this._duration != null) {
			return this._duration % (assetDuration || 1);
		}
		return assetDuration;
	}
	get isLoaded() {
		if (this._hasAsset()) {
			const asset = this._assets.get(this._asset);
			if (asset) {
				return !!asset.resource;
			}
		}
		return false;
	}
	get isPaused() {
		const instances = this.instances;
		const len = instances.length;
		if (len === 0) return false;
		for (let i = 0; i < len; i++) {
			if (!instances[i].isPaused) return false;
		}
		return true;
	}
	get isPlaying() {
		const instances = this.instances;
		for (let i = 0, len = instances.length; i < len; i++) {
			if (instances[i].isPlaying) return true;
		}
		return false;
	}
	get isStopped() {
		const instances = this.instances;
		for (let i = 0, len = instances.length; i < len; i++) {
			if (!instances[i].isStopped) return false;
		}
		return true;
	}
	set loop(value) {
		this._loop = !!value;
		const instances = this.instances;
		for (let i = 0, len = instances.length; i < len; i++) {
			instances[i].loop = this._loop;
		}
	}
	get loop() {
		return this._loop;
	}
	set overlap(value) {
		this._overlap = !!value;
	}
	get overlap() {
		return this._overlap;
	}
	set pitch(value) {
		this._pitch = Math.max(Number(value) || 0, 0.01);
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
	set startTime(value) {
		this._startTime = Math.max(0, Number(value) || 0);
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
	set volume(value) {
		this._volume = math.clamp(Number(value) || 0, 0, 1);
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
