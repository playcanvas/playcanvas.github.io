import { Asset } from '../../asset/asset.js';
import { Channel3d } from '../../../platform/audio/channel3d.js';
import { Component } from '../component.js';

class AudioSourceComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this.on('set_assets', this.onSetAssets, this);
		this.on('set_loop', this.onSetLoop, this);
		this.on('set_volume', this.onSetVolume, this);
		this.on('set_pitch', this.onSetPitch, this);
		this.on('set_minDistance', this.onSetMinDistance, this);
		this.on('set_maxDistance', this.onSetMaxDistance, this);
		this.on('set_rollOffFactor', this.onSetRollOffFactor, this);
		this.on('set_distanceModel', this.onSetDistanceModel, this);
		this.on('set_3d', this.onSet3d, this);
	}
	play(name) {
		if (!this.enabled || !this.entity.enabled) {
			return;
		}
		if (this.channel) {
			this.stop();
		}
		let channel;
		const componentData = this.data;
		if (componentData.sources[name]) {
			if (!componentData['3d']) {
				channel = this.system.manager.playSound(componentData.sources[name], componentData);
				componentData.currentSource = name;
				componentData.channel = channel;
			} else {
				const pos = this.entity.getPosition();
				channel = this.system.manager.playSound3d(componentData.sources[name], pos, componentData);
				componentData.currentSource = name;
				componentData.channel = channel;
			}
		}
	}
	pause() {
		if (this.channel) {
			this.channel.pause();
		}
	}
	unpause() {
		if (this.channel && this.channel.paused) {
			this.channel.unpause();
		}
	}
	stop() {
		if (this.channel) {
			this.channel.stop();
			this.channel = null;
		}
	}
	onSetAssets(name, oldValue, newValue) {
		const newAssets = [];
		const len = newValue.length;
		if (oldValue && oldValue.length) {
			for (let i = 0; i < oldValue.length; i++) {
				if (oldValue[i]) {
					const asset = this.system.app.assets.get(oldValue[i]);
					if (asset) {
						asset.off('change', this.onAssetChanged, this);
						asset.off('remove', this.onAssetRemoved, this);
						if (this.currentSource === asset.name) {
							this.stop();
						}
					}
				}
			}
		}
		if (len) {
			for (let i = 0; i < len; i++) {
				if (oldValue.indexOf(newValue[i]) < 0) {
					if (newValue[i] instanceof Asset) {
						newAssets.push(newValue[i].id);
					} else {
						newAssets.push(newValue[i]);
					}
				}
			}
		}
		if (!this.system._inTools && newAssets.length) {
			this.loadAudioSourceAssets(newAssets);
		}
	}
	onAssetChanged(asset, attribute, newValue, oldValue) {
		if (attribute === 'resource') {
			const sources = this.data.sources;
			if (sources) {
				this.data.sources[asset.name] = newValue;
				if (this.data.currentSource === asset.name) {
					if (this.channel) {
						if (this.channel.paused) {
							this.play(asset.name);
							this.pause();
						} else {
							this.play(asset.name);
						}
					}
				}
			}
		}
	}
	onAssetRemoved(asset) {
		asset.off('remove', this.onAssetRemoved, this);
		if (this.data.sources[asset.name]) {
			delete this.data.sources[asset.name];
			if (this.data.currentSource === asset.name) {
				this.stop();
				this.data.currentSource = null;
			}
		}
	}
	onSetLoop(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			if (this.channel) {
				this.channel.setLoop(newValue);
			}
		}
	}
	onSetVolume(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			if (this.channel) {
				this.channel.setVolume(newValue);
			}
		}
	}
	onSetPitch(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			if (this.channel) {
				this.channel.setPitch(newValue);
			}
		}
	}
	onSetMaxDistance(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			if (this.channel instanceof Channel3d) {
				this.channel.setMaxDistance(newValue);
			}
		}
	}
	onSetMinDistance(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			if (this.channel instanceof Channel3d) {
				this.channel.setMinDistance(newValue);
			}
		}
	}
	onSetRollOffFactor(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			if (this.channel instanceof Channel3d) {
				this.channel.setRollOffFactor(newValue);
			}
		}
	}
	onSetDistanceModel(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			if (this.channel instanceof Channel3d) {
				this.channel.setDistanceModel(newValue);
			}
		}
	}
	onSet3d(name, oldValue, newValue) {
		if (oldValue !== newValue) {
			if (this.system.initialized && this.currentSource) {
				let paused = false;
				let suspended = false;
				if (this.channel) {
					paused = this.channel.paused;
					suspended = this.channel.suspended;
				}
				this.play(this.currentSource);
				if (this.channel) {
					this.channel.paused = paused;
					this.channel.suspended = suspended;
				}
			}
		}
	}
	onEnable() {
		const assets = this.data.assets;
		if (assets) {
			const registry = this.system.app.assets;
			for (let i = 0, len = assets.length; i < len; i++) {
				let asset = assets[i];
				if (!(asset instanceof Asset)) asset = registry.get(asset);
				if (asset && !asset.resource) {
					registry.load(asset);
				}
			}
		}
		if (this.system.initialized) {
			if (this.data.activate && !this.channel) {
				this.play(this.currentSource);
			} else {
				this.unpause();
			}
		}
	}
	onDisable() {
		this.pause();
	}
	loadAudioSourceAssets(ids) {
		const assets = ids.map(id => {
			return this.system.app.assets.get(id);
		});
		const sources = {};
		let currentSource = null;
		let count = assets.length;
		const _error = e => {
			count--;
		};
		const _done = () => {
			this.data.sources = sources;
			this.data.currentSource = currentSource;
			if (this.enabled && this.activate && currentSource) {
				this.onEnable();
			}
		};
		assets.forEach((asset, index) => {
			if (asset) {
				currentSource = currentSource || asset.name;
				asset.off('change', this.onAssetChanged, this);
				asset.on('change', this.onAssetChanged, this);
				asset.off('remove', this.onAssetRemoved, this);
				asset.on('remove', this.onAssetRemoved, this);
				asset.off('error', _error, this);
				asset.on('error', _error, this);
				asset.ready(asset => {
					sources[asset.name] = asset.resource;
					count--;
					if (count === 0) {
						_done();
					}
				});
				if (!asset.resource && this.enabled && this.entity.enabled) this.system.app.assets.load(asset);
			} else {
				count--;
				if (count === 0) {
					_done();
				}
				this.system.app.assets.on('add:' + ids[index], asset => {
					asset.ready(asset => {
						this.data.sources[asset.name] = asset.resource;
					});
					if (!asset.resource) this.system.app.assets.load(asset);
				});
			}
		});
	}
}

export { AudioSourceComponent };
