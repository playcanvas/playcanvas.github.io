import { PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_DEPTH, PIXELFORMAT_RGBA8, FILTER_NEAREST, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, FUNC_LESS } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { SHADOW_VSM32, SHADOW_VSM16, SHADOW_PCF5, SHADOW_PCF3, LIGHTTYPE_OMNI } from '../constants.js';

class ShadowMap {
	constructor(texture, targets) {
		this.texture = texture;
		this.cached = false;
		this.renderTargets = targets;
	}
	destroy() {
		if (this.texture) {
			this.texture.destroy();
			this.texture = null;
		}
		const targets = this.renderTargets;
		for (let i = 0; i < targets.length; i++) {
			targets[i].destroy();
		}
		this.renderTargets.length = 0;
	}
	static getShadowFormat(device, shadowType) {
		if (shadowType === SHADOW_VSM32) {
			return PIXELFORMAT_RGBA32F;
		} else if (shadowType === SHADOW_VSM16) {
			return PIXELFORMAT_RGBA16F;
		} else if (shadowType === SHADOW_PCF5) {
			return PIXELFORMAT_DEPTH;
		} else if (shadowType === SHADOW_PCF3 && device.supportsDepthShadow) {
			return PIXELFORMAT_DEPTH;
		}
		return PIXELFORMAT_RGBA8;
	}
	static getShadowFiltering(device, shadowType) {
		if (shadowType === SHADOW_PCF3 && !device.supportsDepthShadow) {
			return FILTER_NEAREST;
		} else if (shadowType === SHADOW_VSM32) {
			return device.extTextureFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
		} else if (shadowType === SHADOW_VSM16) {
			return device.extTextureHalfFloatLinear ? FILTER_LINEAR : FILTER_NEAREST;
		}
		return FILTER_LINEAR;
	}
	static create(device, light) {
		let shadowMap = null;
		if (light._type === LIGHTTYPE_OMNI) {
			shadowMap = this.createCubemap(device, light._shadowResolution);
		} else {
			shadowMap = this.create2dMap(device, light._shadowResolution, light._shadowType);
		}
		return shadowMap;
	}
	static createAtlas(device, resolution, shadowType) {
		const shadowMap = this.create2dMap(device, resolution, shadowType);
		const targets = shadowMap.renderTargets;
		const rt = targets[0];
		for (let i = 0; i < 5; i++) {
			targets.push(rt);
		}
		return shadowMap;
	}
	static create2dMap(device, size, shadowType) {
		const format = this.getShadowFormat(device, shadowType);
		const filter = this.getShadowFiltering(device, shadowType);
		const texture = new Texture(device, {
			format: format,
			width: size,
			height: size,
			mipmaps: false,
			minFilter: filter,
			magFilter: filter,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE,
			name: 'ShadowMap2D'
		});
		let target = null;
		if (shadowType === SHADOW_PCF5 || shadowType === SHADOW_PCF3 && device.supportsDepthShadow) {
			texture.compareOnRead = true;
			texture.compareFunc = FUNC_LESS;
			target = new RenderTarget({
				depthBuffer: texture
			});
		} else {
			target = new RenderTarget({
				colorBuffer: texture,
				depth: true
			});
		}
		if (device.isWebGPU) {
			target.flipY = true;
		}
		return new ShadowMap(texture, [target]);
	}
	static createCubemap(device, size) {
		const cubemap = new Texture(device, {
			format: PIXELFORMAT_RGBA8,
			width: size,
			height: size,
			cubemap: true,
			mipmaps: false,
			minFilter: FILTER_NEAREST,
			magFilter: FILTER_NEAREST,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE,
			name: 'ShadowMapCube'
		});
		const targets = [];
		for (let i = 0; i < 6; i++) {
			const target = new RenderTarget({
				colorBuffer: cubemap,
				face: i,
				depth: true
			});
			targets.push(target);
		}
		return new ShadowMap(cubemap, targets);
	}
}

export { ShadowMap };
