import '../../../core/debug.js';
import { AnimClip } from '../../anim/evaluator/anim-clip.js';
import { AnimEvaluator } from '../../anim/evaluator/anim-evaluator.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { DefaultAnimBinder } from '../../anim/binder/default-anim-binder.js';
import { Skeleton } from '../../../scene/animation/skeleton.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

class AnimationComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._animations = {};
		this._assets = [];
		this._loop = true;
		this.animEvaluator = null;
		this.model = null;
		this.skeleton = null;
		this.fromSkel = null;
		this.toSkel = null;
		this.animationsIndex = {};
		this.prevAnim = null;
		this.currAnim = null;
		this.blend = 0;
		this.blending = false;
		this.blendSpeed = 0;
		this.activate = true;
		this.speed = 1;
	}
	set animations(value) {
		this._animations = value;
		this.onSetAnimations();
	}
	get animations() {
		return this._animations;
	}
	set assets(value) {
		const assets = this._assets;
		if (assets && assets.length) {
			for (let i = 0; i < assets.length; i++) {
				if (assets[i]) {
					const asset = this.system.app.assets.get(assets[i]);
					if (asset) {
						asset.off('change', this.onAssetChanged, this);
						asset.off('remove', this.onAssetRemoved, this);
						const animName = this.animationsIndex[asset.id];
						if (this.currAnim === animName) this._stopCurrentAnimation();
						delete this.animations[animName];
						delete this.animationsIndex[asset.id];
					}
				}
			}
		}
		this._assets = value;
		const assetIds = value.map(value => {
			return value instanceof Asset ? value.id : value;
		});
		this.loadAnimationAssets(assetIds);
	}
	get assets() {
		return this._assets;
	}
	set currentTime(currentTime) {
		if (this.skeleton) {
			this.skeleton.currentTime = currentTime;
			this.skeleton.addTime(0);
			this.skeleton.updateGraph();
		}
		if (this.animEvaluator) {
			const clips = this.animEvaluator.clips;
			for (let i = 0; i < clips.length; ++i) {
				clips[i].time = currentTime;
			}
		}
	}
	get currentTime() {
		if (this.skeleton) {
			return this.skeleton._time;
		}
		if (this.animEvaluator) {
			const clips = this.animEvaluator.clips;
			if (clips.length > 0) {
				return clips[clips.length - 1].time;
			}
		}
		return 0;
	}
	get duration() {
		if (this.currAnim) {
			return this.animations[this.currAnim].duration;
		}
		return 0;
	}
	set loop(value) {
		this._loop = value;
		if (this.skeleton) {
			this.skeleton.looping = value;
		}
		if (this.animEvaluator) {
			for (let i = 0; i < this.animEvaluator.clips.length; ++i) {
				this.animEvaluator.clips[i].loop = value;
			}
		}
	}
	get loop() {
		return this._loop;
	}
	play(name, blendTime = 0) {
		if (!this.enabled || !this.entity.enabled) {
			return;
		}
		if (!this.animations[name]) {
			return;
		}
		this.prevAnim = this.currAnim;
		this.currAnim = name;
		if (this.model) {
			if (!this.skeleton && !this.animEvaluator) {
				this._createAnimationController();
			}
			const prevAnim = this.animations[this.prevAnim];
			const currAnim = this.animations[this.currAnim];
			this.blending = blendTime > 0 && !!this.prevAnim;
			if (this.blending) {
				this.blend = 0;
				this.blendSpeed = 1 / blendTime;
			}
			if (this.skeleton) {
				if (this.blending) {
					this.fromSkel.animation = prevAnim;
					this.fromSkel.addTime(this.skeleton._time);
					this.toSkel.animation = currAnim;
				} else {
					this.skeleton.animation = currAnim;
				}
			}
			if (this.animEvaluator) {
				const animEvaluator = this.animEvaluator;
				if (this.blending) {
					while (animEvaluator.clips.length > 1) {
						animEvaluator.removeClip(0);
					}
				} else {
					this.animEvaluator.removeClips();
				}
				const clip = new AnimClip(this.animations[this.currAnim], 0, 1.0, true, this.loop);
				clip.name = this.currAnim;
				clip.blendWeight = this.blending ? 0 : 1;
				clip.reset();
				this.animEvaluator.addClip(clip);
			}
		}
		this.playing = true;
	}
	getAnimation(name) {
		return this.animations[name];
	}
	setModel(model) {
		if (model !== this.model) {
			this._resetAnimationController();
			this.model = model;
			if (this.animations && this.currAnim && this.animations[this.currAnim]) {
				this.play(this.currAnim);
			}
		}
	}
	onSetAnimations() {
		const modelComponent = this.entity.model;
		if (modelComponent) {
			const m = modelComponent.model;
			if (m && m !== this.model) {
				this.setModel(m);
			}
		}
		if (!this.currAnim && this.activate && this.enabled && this.entity.enabled) {
			const animationNames = Object.keys(this._animations);
			if (animationNames.length > 0) {
				this.play(animationNames[0]);
			}
		}
	}
	_resetAnimationController() {
		this.skeleton = null;
		this.fromSkel = null;
		this.toSkel = null;
		this.animEvaluator = null;
	}
	_createAnimationController() {
		const model = this.model;
		const animations = this.animations;
		let hasJson = false;
		let hasGlb = false;
		for (const animation in animations) {
			if (animations.hasOwnProperty(animation)) {
				const anim = animations[animation];
				if (anim.constructor === AnimTrack) {
					hasGlb = true;
				} else {
					hasJson = true;
				}
			}
		}
		const graph = model.getGraph();
		if (hasJson) {
			this.fromSkel = new Skeleton(graph);
			this.toSkel = new Skeleton(graph);
			this.skeleton = new Skeleton(graph);
			this.skeleton.looping = this.loop;
			this.skeleton.setGraph(graph);
		} else if (hasGlb) {
			this.animEvaluator = new AnimEvaluator(new DefaultAnimBinder(this.entity));
		}
	}
	loadAnimationAssets(ids) {
		if (!ids || !ids.length) return;
		const assets = this.system.app.assets;
		const onAssetReady = asset => {
			if (asset.resources.length > 1) {
				for (let i = 0; i < asset.resources.length; i++) {
					this.animations[asset.resources[i].name] = asset.resources[i];
					this.animationsIndex[asset.id] = asset.resources[i].name;
				}
			} else {
				this.animations[asset.name] = asset.resource;
				this.animationsIndex[asset.id] = asset.name;
			}
			this.animations = this.animations;
		};
		const onAssetAdd = asset => {
			asset.off('change', this.onAssetChanged, this);
			asset.on('change', this.onAssetChanged, this);
			asset.off('remove', this.onAssetRemoved, this);
			asset.on('remove', this.onAssetRemoved, this);
			if (asset.resource) {
				onAssetReady(asset);
			} else {
				asset.once('load', onAssetReady, this);
				if (this.enabled && this.entity.enabled) assets.load(asset);
			}
		};
		for (let i = 0, l = ids.length; i < l; i++) {
			const asset = assets.get(ids[i]);
			if (asset) {
				onAssetAdd(asset);
			} else {
				assets.on('add:' + ids[i], onAssetAdd);
			}
		}
	}
	onAssetChanged(asset, attribute, newValue, oldValue) {
		if (attribute === 'resource' || attribute === 'resources') {
			if (attribute === 'resources' && newValue && newValue.length === 0) {
				newValue = null;
			}
			if (newValue) {
				let restarted = false;
				if (newValue.length > 1) {
					if (oldValue && oldValue.length > 1) {
						for (let i = 0; i < oldValue.length; i++) {
							delete this.animations[oldValue[i].name];
						}
					} else {
						delete this.animations[asset.name];
					}
					restarted = false;
					for (let i = 0; i < newValue.length; i++) {
						this.animations[newValue[i].name] = newValue[i];
						if (!restarted && this.currAnim === newValue[i].name) {
							if (this.playing && this.enabled && this.entity.enabled) {
								restarted = true;
								this.play(newValue[i].name);
							}
						}
					}
					if (!restarted) {
						this._stopCurrentAnimation();
						this.onSetAnimations();
					}
				} else {
					if (oldValue && oldValue.length > 1) {
						for (let i = 0; i < oldValue.length; i++) {
							delete this.animations[oldValue[i].name];
						}
					}
					this.animations[asset.name] = newValue[0] || newValue;
					restarted = false;
					if (this.currAnim === asset.name) {
						if (this.playing && this.enabled && this.entity.enabled) {
							restarted = true;
							this.play(asset.name);
						}
					}
					if (!restarted) {
						this._stopCurrentAnimation();
						this.onSetAnimations();
					}
				}
				this.animationsIndex[asset.id] = asset.name;
			} else {
				if (oldValue.length > 1) {
					for (let i = 0; i < oldValue.length; i++) {
						delete this.animations[oldValue[i].name];
						if (this.currAnim === oldValue[i].name) {
							this._stopCurrentAnimation();
						}
					}
				} else {
					delete this.animations[asset.name];
					if (this.currAnim === asset.name) {
						this._stopCurrentAnimation();
					}
				}
				delete this.animationsIndex[asset.id];
			}
		}
	}
	onAssetRemoved(asset) {
		asset.off('remove', this.onAssetRemoved, this);
		if (this.animations) {
			if (asset.resources.length > 1) {
				for (let i = 0; i < asset.resources.length; i++) {
					delete this.animations[asset.resources[i].name];
					if (this.currAnim === asset.resources[i].name) this._stopCurrentAnimation();
				}
			} else {
				delete this.animations[asset.name];
				if (this.currAnim === asset.name) this._stopCurrentAnimation();
			}
			delete this.animationsIndex[asset.id];
		}
	}
	_stopCurrentAnimation() {
		this.currAnim = null;
		this.playing = false;
		if (this.skeleton) {
			this.skeleton.currentTime = 0;
			this.skeleton.animation = null;
		}
		if (this.animEvaluator) {
			for (let i = 0; i < this.animEvaluator.clips.length; ++i) {
				this.animEvaluator.clips[i].stop();
			}
			this.animEvaluator.update(0);
			this.animEvaluator.removeClips();
		}
	}
	onEnable() {
		super.onEnable();
		const assets = this.assets;
		const registry = this.system.app.assets;
		if (assets) {
			for (let i = 0, len = assets.length; i < len; i++) {
				let asset = assets[i];
				if (!(asset instanceof Asset)) asset = registry.get(asset);
				if (asset && !asset.resource) registry.load(asset);
			}
		}
		if (this.activate && !this.currAnim) {
			const animationNames = Object.keys(this.animations);
			if (animationNames.length > 0) {
				this.play(animationNames[0]);
			}
		}
	}
	onBeforeRemove() {
		for (let i = 0; i < this.assets.length; i++) {
			let asset = this.assets[i];
			if (typeof asset === 'number') {
				asset = this.system.app.assets.get(asset);
			}
			if (!asset) continue;
			asset.off('change', this.onAssetChanged, this);
			asset.off('remove', this.onAssetRemoved, this);
		}
		this.skeleton = null;
		this.fromSkel = null;
		this.toSkel = null;
		this.animEvaluator = null;
	}
	update(dt) {
		if (this.blending) {
			this.blend += dt * this.blendSpeed;
			if (this.blend >= 1) {
				this.blend = 1;
			}
		}
		if (this.playing) {
			const skeleton = this.skeleton;
			if (skeleton !== null && this.model !== null) {
				if (this.blending) {
					skeleton.blend(this.fromSkel, this.toSkel, this.blend);
				} else {
					const delta = dt * this.speed;
					skeleton.addTime(delta);
					if (this.speed > 0 && skeleton._time === skeleton.animation.duration && !this.loop) {
						this.playing = false;
					} else if (this.speed < 0 && skeleton._time === 0 && !this.loop) {
						this.playing = false;
					}
				}
				if (this.blending && this.blend === 1) {
					skeleton.animation = this.toSkel.animation;
				}
				skeleton.updateGraph();
			}
		}
		const animEvaluator = this.animEvaluator;
		if (animEvaluator) {
			for (let i = 0; i < animEvaluator.clips.length; ++i) {
				const clip = animEvaluator.clips[i];
				clip.speed = this.speed;
				if (!this.playing) {
					clip.pause();
				} else {
					clip.resume();
				}
			}
			if (this.blending && animEvaluator.clips.length > 1) {
				animEvaluator.clips[1].blendWeight = this.blend;
			}
			animEvaluator.update(dt);
		}
		if (this.blending && this.blend === 1) {
			this.blending = false;
		}
	}
}

export { AnimationComponent };
