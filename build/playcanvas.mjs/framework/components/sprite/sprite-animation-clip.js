import { EventHandler } from '../../../core/event-handler.js';
import { math } from '../../../core/math/math.js';
import { Asset } from '../../asset/asset.js';
import { SPRITE_RENDERMODE_SIMPLE } from '../../../scene/constants.js';

class SpriteAnimationClip extends EventHandler {
	constructor(component, data) {
		super();
		this._component = component;
		this._frame = 0;
		this._sprite = null;
		this._spriteAsset = null;
		this.spriteAsset = data.spriteAsset;
		this.name = data.name;
		this.fps = data.fps || 0;
		this.loop = data.loop || false;
		this._playing = false;
		this._paused = false;
		this._time = 0;
	}
	get duration() {
		if (this._sprite) {
			const fps = this.fps || Number.MIN_VALUE;
			return this._sprite.frameKeys.length / Math.abs(fps);
		}
		return 0;
	}
	set frame(value) {
		this._setFrame(value);
		const fps = this.fps || Number.MIN_VALUE;
		this._setTime(this._frame / fps);
	}
	get frame() {
		return this._frame;
	}
	get isPaused() {
		return this._paused;
	}
	get isPlaying() {
		return this._playing;
	}
	set sprite(value) {
		if (this._sprite) {
			this._sprite.off('set:meshes', this._onSpriteMeshesChange, this);
			this._sprite.off('set:pixelsPerUnit', this._onSpritePpuChanged, this);
			this._sprite.off('set:atlas', this._onSpriteMeshesChange, this);
			if (this._sprite.atlas) {
				this._sprite.atlas.off('set:texture', this._onSpriteMeshesChange, this);
			}
		}
		this._sprite = value;
		if (this._sprite) {
			this._sprite.on('set:meshes', this._onSpriteMeshesChange, this);
			this._sprite.on('set:pixelsPerUnit', this._onSpritePpuChanged, this);
			this._sprite.on('set:atlas', this._onSpriteMeshesChange, this);
			if (this._sprite.atlas) {
				this._sprite.atlas.on('set:texture', this._onSpriteMeshesChange, this);
			}
		}
		if (this._component.currentClip === this) {
			let mi;
			if (!value || !value.atlas) {
				mi = this._component._meshInstance;
				if (mi) {
					mi.deleteParameter('texture_emissiveMap');
					mi.deleteParameter('texture_opacityMap');
				}
				this._component._hideModel();
			} else {
				if (value.atlas.texture) {
					mi = this._component._meshInstance;
					if (mi) {
						mi.setParameter('texture_emissiveMap', value.atlas.texture);
						mi.setParameter('texture_opacityMap', value.atlas.texture);
					}
					if (this._component.enabled && this._component.entity.enabled) {
						this._component._showModel();
					}
				}
				if (this.time && this.fps) {
					this.time = this.time;
				} else {
					this.frame = this.frame;
				}
			}
		}
	}
	get sprite() {
		return this._sprite;
	}
	set spriteAsset(value) {
		const assets = this._component.system.app.assets;
		let id = value;
		if (value instanceof Asset) {
			id = value.id;
		}
		if (this._spriteAsset !== id) {
			if (this._spriteAsset) {
				const prev = assets.get(this._spriteAsset);
				if (prev) {
					this._unbindSpriteAsset(prev);
				}
			}
			this._spriteAsset = id;
			if (this._spriteAsset) {
				const asset = assets.get(this._spriteAsset);
				if (!asset) {
					this.sprite = null;
					assets.on('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
				} else {
					this._bindSpriteAsset(asset);
				}
			} else {
				this.sprite = null;
			}
		}
	}
	get spriteAsset() {
		return this._spriteAsset;
	}
	set time(value) {
		this._setTime(value);
		if (this._sprite) {
			this.frame = Math.min(this._sprite.frameKeys.length - 1, Math.floor(this._time * Math.abs(this.fps)));
		} else {
			this.frame = 0;
		}
	}
	get time() {
		return this._time;
	}
	_onSpriteAssetAdded(asset) {
		this._component.system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
		if (this._spriteAsset === asset.id) {
			this._bindSpriteAsset(asset);
		}
	}
	_bindSpriteAsset(asset) {
		asset.on('load', this._onSpriteAssetLoad, this);
		asset.on('remove', this._onSpriteAssetRemove, this);
		if (asset.resource) {
			this._onSpriteAssetLoad(asset);
		} else {
			this._component.system.app.assets.load(asset);
		}
	}
	_unbindSpriteAsset(asset) {
		if (!asset) {
			return;
		}
		asset.off('load', this._onSpriteAssetLoad, this);
		asset.off('remove', this._onSpriteAssetRemove, this);
		if (asset.resource && !asset.resource.atlas) {
			this._component.system.app.assets.off('load:' + asset.data.textureAtlasAsset, this._onTextureAtlasLoad, this);
		}
	}
	_onSpriteAssetLoad(asset) {
		if (!asset.resource) {
			this.sprite = null;
		} else {
			if (!asset.resource.atlas) {
				const atlasAssetId = asset.data.textureAtlasAsset;
				const assets = this._component.system.app.assets;
				assets.off('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
				assets.once('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
			} else {
				this.sprite = asset.resource;
			}
		}
	}
	_onTextureAtlasLoad(atlasAsset) {
		const spriteAsset = this._spriteAsset;
		if (spriteAsset instanceof Asset) {
			this._onSpriteAssetLoad(spriteAsset);
		} else {
			this._onSpriteAssetLoad(this._component.system.app.assets.get(spriteAsset));
		}
	}
	_onSpriteAssetRemove(asset) {
		this.sprite = null;
	}
	_onSpriteMeshesChange() {
		if (this._component.currentClip === this) {
			this._component._showFrame(this.frame);
		}
	}
	_onSpritePpuChanged() {
		if (this._component.currentClip === this) {
			if (this.sprite.renderMode !== SPRITE_RENDERMODE_SIMPLE) {
				this._component._showFrame(this.frame);
			}
		}
	}
	_update(dt) {
		if (this.fps === 0) return;
		if (!this._playing || this._paused || !this._sprite) return;
		const dir = this.fps < 0 ? -1 : 1;
		const time = this._time + dt * this._component.speed * dir;
		const duration = this.duration;
		const end = time > duration || time < 0;
		this._setTime(time);
		let frame = this.frame;
		if (this._sprite) {
			frame = Math.floor(this._sprite.frameKeys.length * this._time / duration);
		} else {
			frame = 0;
		}
		if (frame !== this._frame) {
			this._setFrame(frame);
		}
		if (end) {
			if (this.loop) {
				this.fire('loop');
				this._component.fire('loop', this);
			} else {
				this._playing = false;
				this._paused = false;
				this.fire('end');
				this._component.fire('end', this);
			}
		}
	}
	_setTime(value) {
		this._time = value;
		const duration = this.duration;
		if (this._time < 0) {
			if (this.loop) {
				this._time = this._time % duration + duration;
			} else {
				this._time = 0;
			}
		} else if (this._time > duration) {
			if (this.loop) {
				this._time %= duration;
			} else {
				this._time = duration;
			}
		}
	}
	_setFrame(value) {
		if (this._sprite) {
			this._frame = math.clamp(value, 0, this._sprite.frameKeys.length - 1);
		} else {
			this._frame = value;
		}
		if (this._component.currentClip === this) {
			this._component._showFrame(this._frame);
		}
	}
	_destroy() {
		if (this._spriteAsset) {
			const assets = this._component.system.app.assets;
			this._unbindSpriteAsset(assets.get(this._spriteAsset));
		}
		if (this._sprite) {
			this.sprite = null;
		}
		if (this._spriteAsset) {
			this.spriteAsset = null;
		}
	}
	play() {
		if (this._playing) return;
		this._playing = true;
		this._paused = false;
		this.frame = 0;
		this.fire('play');
		this._component.fire('play', this);
	}
	pause() {
		if (!this._playing || this._paused) return;
		this._paused = true;
		this.fire('pause');
		this._component.fire('pause', this);
	}
	resume() {
		if (!this._paused) return;
		this._paused = false;
		this.fire('resume');
		this._component.fire('resume', this);
	}
	stop() {
		if (!this._playing) return;
		this._playing = false;
		this._paused = false;
		this._time = 0;
		this.frame = 0;
		this.fire('stop');
		this._component.fire('stop', this);
	}
}

export { SpriteAnimationClip };
