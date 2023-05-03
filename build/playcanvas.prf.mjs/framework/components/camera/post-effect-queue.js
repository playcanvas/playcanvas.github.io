import { FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { RenderTarget } from '../../../platform/graphics/render-target.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { LAYERID_DEPTH } from '../../../scene/constants.js';

class PostEffect {
	constructor(effect, inputTarget) {
		this.effect = effect;
		this.inputTarget = inputTarget;
		this.outputTarget = null;
		this.name = effect.constructor.name;
	}
}
class PostEffectQueue {
	constructor(app, camera) {
		this.app = app;
		this.camera = camera;
		this.destinationRenderTarget = null;
		this.effects = [];
		this.enabled = false;
		this.depthTarget = null;
		camera.on('set:rect', this.onCameraRectChanged, this);
	}
	_allocateColorBuffer(format, name) {
		const rect = this.camera.rect;
		const width = Math.floor(rect.z * this.app.graphicsDevice.width);
		const height = Math.floor(rect.w * this.app.graphicsDevice.height);
		const colorBuffer = new Texture(this.app.graphicsDevice, {
			name: name,
			format: format,
			width: width,
			height: height,
			mipmaps: false,
			minFilter: FILTER_NEAREST,
			magFilter: FILTER_NEAREST,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE
		});
		return colorBuffer;
	}
	_createOffscreenTarget(useDepth, hdr) {
		const device = this.app.graphicsDevice;
		const format = hdr && device.getHdrFormat(false, true, false, false) || PIXELFORMAT_RGBA8;
		const name = this.camera.entity.name + '-posteffect-' + this.effects.length;
		const colorBuffer = this._allocateColorBuffer(format, name);
		return new RenderTarget({
			colorBuffer: colorBuffer,
			depth: useDepth,
			stencil: useDepth && this.app.graphicsDevice.supportsStencil,
			samples: useDepth ? device.samples : 1
		});
	}
	_resizeOffscreenTarget(rt) {
		const format = rt.colorBuffer.format;
		const name = rt.colorBuffer.name;
		rt.destroyFrameBuffers();
		rt.destroyTextureBuffers();
		rt._colorBuffer = this._allocateColorBuffer(format, name);
	}
	_destroyOffscreenTarget(rt) {
		rt.destroyTextureBuffers();
		rt.destroy();
	}
	addEffect(effect) {
		const effects = this.effects;
		const isFirstEffect = effects.length === 0;
		const inputTarget = this._createOffscreenTarget(isFirstEffect, effect.hdr);
		const newEntry = new PostEffect(effect, inputTarget);
		effects.push(newEntry);
		this._sourceTarget = newEntry.inputTarget;
		if (effects.length > 1) {
			effects[effects.length - 2].outputTarget = newEntry.inputTarget;
		}
		this._newPostEffect = effect;
		if (effect.needsDepthBuffer) {
			this._requestDepthMap();
		}
		this.enable();
		this._newPostEffect = undefined;
	}
	removeEffect(effect) {
		let index = -1;
		for (let i = 0, len = this.effects.length; i < len; i++) {
			if (this.effects[i].effect === effect) {
				index = i;
				break;
			}
		}
		if (index >= 0) {
			if (index > 0) {
				this.effects[index - 1].outputTarget = index + 1 < this.effects.length ? this.effects[index + 1].inputTarget : null;
			} else {
				if (this.effects.length > 1) {
					if (!this.effects[1].inputTarget._depth) {
						this._destroyOffscreenTarget(this.effects[1].inputTarget);
						this.effects[1].inputTarget = this._createOffscreenTarget(true, this.effects[1].hdr);
						this._sourceTarget = this.effects[1].inputTarget;
					}
					this.camera.renderTarget = this.effects[1].inputTarget;
				}
			}
			this._destroyOffscreenTarget(this.effects[index].inputTarget);
			this.effects.splice(index, 1);
		}
		if (this.enabled) {
			if (effect.needsDepthBuffer) {
				this._releaseDepthMap();
			}
		}
		if (this.effects.length === 0) {
			this.disable();
		}
	}
	_requestDepthMaps() {
		for (let i = 0, len = this.effects.length; i < len; i++) {
			const effect = this.effects[i].effect;
			if (this._newPostEffect === effect) continue;
			if (effect.needsDepthBuffer) {
				this._requestDepthMap();
			}
		}
	}
	_releaseDepthMaps() {
		for (let i = 0, len = this.effects.length; i < len; i++) {
			const effect = this.effects[i].effect;
			if (effect.needsDepthBuffer) {
				this._releaseDepthMap();
			}
		}
	}
	_requestDepthMap() {
		const depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
		if (depthLayer) {
			depthLayer.incrementCounter();
			this.camera.requestSceneDepthMap(true);
		}
	}
	_releaseDepthMap() {
		const depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
		if (depthLayer) {
			depthLayer.decrementCounter();
			this.camera.requestSceneDepthMap(false);
		}
	}
	destroy() {
		for (let i = 0, len = this.effects.length; i < len; i++) {
			this.effects[i].inputTarget.destroy();
		}
		this.effects.length = 0;
		this.disable();
	}
	enable() {
		if (!this.enabled && this.effects.length) {
			this.enabled = true;
			this._requestDepthMaps();
			this.app.graphicsDevice.on('resizecanvas', this._onCanvasResized, this);
			this.destinationRenderTarget = this.camera.renderTarget;
			this.camera.renderTarget = this.effects[0].inputTarget;
			this.camera.onPostprocessing = () => {
				if (this.enabled) {
					let rect = null;
					const len = this.effects.length;
					if (len) {
						for (let i = 0; i < len; i++) {
							const fx = this.effects[i];
							let destTarget = fx.outputTarget;
							if (i === len - 1) {
								rect = this.camera.rect;
								if (this.destinationRenderTarget) {
									destTarget = this.destinationRenderTarget;
								}
							}
							fx.effect.render(fx.inputTarget, destTarget, rect);
						}
					}
				}
			};
		}
	}
	disable() {
		if (this.enabled) {
			this.enabled = false;
			this.app.graphicsDevice.off('resizecanvas', this._onCanvasResized, this);
			this._releaseDepthMaps();
			this._destroyOffscreenTarget(this._sourceTarget);
			this.camera.renderTarget = null;
			this.camera.onPostprocessing = null;
		}
	}
	_onCanvasResized(width, height) {
		const rect = this.camera.rect;
		const device = this.app.graphicsDevice;
		this.camera.camera.aspectRatio = device.width * rect.z / (device.height * rect.w);
		this.resizeRenderTargets();
	}
	resizeRenderTargets() {
		const rect = this.camera.rect;
		const desiredWidth = Math.floor(rect.z * this.app.graphicsDevice.width);
		const desiredHeight = Math.floor(rect.w * this.app.graphicsDevice.height);
		const effects = this.effects;
		for (let i = 0, len = effects.length; i < len; i++) {
			const fx = effects[i];
			if (fx.inputTarget.width !== desiredWidth || fx.inputTarget.height !== desiredHeight) {
				this._resizeOffscreenTarget(fx.inputTarget);
			}
		}
	}
	onCameraRectChanged(name, oldValue, newValue) {
		if (this.enabled) {
			this.resizeRenderTargets();
		}
	}
}

export { PostEffectQueue };
