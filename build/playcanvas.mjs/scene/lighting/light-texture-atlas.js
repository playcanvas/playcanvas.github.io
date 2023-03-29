import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { SHADOW_PCF3, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { CookieRenderer } from '../renderer/cookie-renderer.js';
import { ShadowMap } from '../renderer/shadow-map.js';

const _tempArray = [];
const _tempArray2 = [];
const _viewport = new Vec4();
const _scissor = new Vec4();
class Slot {
	constructor(rect) {
		this.size = Math.floor(rect.w * 1024);
		this.used = false;
		this.lightId = -1;
		this.rect = rect;
	}
}
class LightTextureAtlas {
	constructor(device) {
		this.device = device;
		this.version = 1;
		this.shadowAtlasResolution = 2048;
		this.shadowAtlas = null;
		this.shadowEdgePixels = 3;
		this.cookieAtlasResolution = 2048;
		this.cookieAtlas = null;
		this.cookieRenderTarget = null;
		this.slots = [];
		this.atlasSplit = [];
		this.cubeSlotsOffsets = [new Vec2(0, 0), new Vec2(0, 1), new Vec2(1, 0), new Vec2(1, 1), new Vec2(2, 0), new Vec2(2, 1)];
		this.scissorVec = new Vec4();
		this.allocateShadowAtlas(1);
		this.allocateCookieAtlas(1);
		this.allocateUniforms();
	}
	destroy() {
		this.destroyShadowAtlas();
		this.destroyCookieAtlas();
	}
	destroyShadowAtlas() {
		if (this.shadowAtlas) {
			this.shadowAtlas.destroy();
			this.shadowAtlas = null;
		}
	}
	destroyCookieAtlas() {
		if (this.cookieAtlas) {
			this.cookieAtlas.destroy();
			this.cookieAtlas = null;
		}
		if (this.cookieRenderTarget) {
			this.cookieRenderTarget.destroy();
			this.cookieRenderTarget = null;
		}
	}
	allocateShadowAtlas(resolution) {
		if (!this.shadowAtlas || this.shadowAtlas.texture.width !== resolution) {
			this.version++;
			this.destroyShadowAtlas();
			this.shadowAtlas = ShadowMap.createAtlas(this.device, resolution, SHADOW_PCF3);
			this.shadowAtlas.cached = true;
			const scissorOffset = 4 / this.shadowAtlasResolution;
			this.scissorVec.set(scissorOffset, scissorOffset, -2 * scissorOffset, -2 * scissorOffset);
		}
	}
	allocateCookieAtlas(resolution) {
		if (!this.cookieAtlas || this.cookieAtlas.width !== resolution) {
			this.version++;
			this.destroyCookieAtlas();
			this.cookieAtlas = CookieRenderer.createTexture(this.device, resolution);
			this.cookieRenderTarget = new RenderTarget({
				colorBuffer: this.cookieAtlas,
				depth: false,
				flipY: true
			});
		}
	}
	allocateUniforms() {
		this._shadowAtlasTextureId = this.device.scope.resolve('shadowAtlasTexture');
		this._shadowAtlasParamsId = this.device.scope.resolve('shadowAtlasParams');
		this._shadowAtlasParams = new Float32Array(2);
		this._cookieAtlasTextureId = this.device.scope.resolve('cookieAtlasTexture');
	}
	updateUniforms() {
		const isShadowFilterPcf = true;
		const rt = this.shadowAtlas.renderTargets[0];
		const isDepthShadow = (this.device.isWebGPU || this.device.webgl2) && isShadowFilterPcf;
		const shadowBuffer = isDepthShadow ? rt.depthBuffer : rt.colorBuffer;
		this._shadowAtlasTextureId.setValue(shadowBuffer);
		this._shadowAtlasParams[0] = this.shadowAtlasResolution;
		this._shadowAtlasParams[1] = this.shadowEdgePixels;
		this._shadowAtlasParamsId.setValue(this._shadowAtlasParams);
		this._cookieAtlasTextureId.setValue(this.cookieAtlas);
	}
	subdivide(numLights, lightingParams) {
		let atlasSplit = lightingParams.atlasSplit;
		if (!atlasSplit) {
			const gridSize = Math.ceil(Math.sqrt(numLights));
			atlasSplit = _tempArray2;
			atlasSplit[0] = gridSize;
			atlasSplit.length = 1;
		}
		const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
		if (!arraysEqual(atlasSplit, this.atlasSplit)) {
			this.version++;
			this.slots.length = 0;
			this.atlasSplit.length = 0;
			this.atlasSplit.push(...atlasSplit);
			const splitCount = this.atlasSplit[0];
			if (splitCount > 1) {
				const invSize = 1 / splitCount;
				for (let i = 0; i < splitCount; i++) {
					for (let j = 0; j < splitCount; j++) {
						const rect = new Vec4(i * invSize, j * invSize, invSize, invSize);
						const nextLevelSplit = this.atlasSplit[1 + i * splitCount + j];
						if (nextLevelSplit > 1) {
							for (let x = 0; x < nextLevelSplit; x++) {
								for (let y = 0; y < nextLevelSplit; y++) {
									const invSizeNext = invSize / nextLevelSplit;
									const rectNext = new Vec4(rect.x + x * invSizeNext, rect.y + y * invSizeNext, invSizeNext, invSizeNext);
									this.slots.push(new Slot(rectNext));
								}
							}
						} else {
							this.slots.push(new Slot(rect));
						}
					}
				}
			} else {
				this.slots.push(new Slot(new Vec4(0, 0, 1, 1)));
			}
			this.slots.sort((a, b) => {
				return b.size - a.size;
			});
		}
	}
	collectLights(spotLights, omniLights, lightingParams) {
		const cookiesEnabled = lightingParams.cookiesEnabled;
		const shadowsEnabled = lightingParams.shadowsEnabled;
		let needsShadowAtlas = false;
		let needsCookieAtlas = false;
		const lights = _tempArray;
		lights.length = 0;
		const processLights = list => {
			for (let i = 0; i < list.length; i++) {
				const light = list[i];
				if (light.visibleThisFrame) {
					const lightShadow = shadowsEnabled && light.castShadows;
					const lightCookie = cookiesEnabled && !!light.cookie;
					needsShadowAtlas || (needsShadowAtlas = lightShadow);
					needsCookieAtlas || (needsCookieAtlas = lightCookie);
					if (lightShadow || lightCookie) {
						lights.push(light);
					}
				}
			}
		};
		if (cookiesEnabled || shadowsEnabled) {
			processLights(spotLights);
			processLights(omniLights);
		}
		lights.sort((a, b) => {
			return b.maxScreenSize - a.maxScreenSize;
		});
		if (needsShadowAtlas) {
			this.allocateShadowAtlas(this.shadowAtlasResolution);
		}
		if (needsCookieAtlas) {
			this.allocateCookieAtlas(this.cookieAtlasResolution);
		}
		if (needsShadowAtlas || needsCookieAtlas) {
			this.subdivide(lights.length, lightingParams);
		}
		return lights;
	}
	setupSlot(light, rect) {
		light.atlasViewport.copy(rect);
		const faceCount = light.numShadowFaces;
		for (let face = 0; face < faceCount; face++) {
			if (light.castShadows || light._cookie) {
				_viewport.copy(rect);
				_scissor.copy(rect);
				if (light._type === LIGHTTYPE_SPOT) {
					_viewport.add(this.scissorVec);
				}
				if (light._type === LIGHTTYPE_OMNI) {
					const smallSize = _viewport.z / 3;
					const offset = this.cubeSlotsOffsets[face];
					_viewport.x += smallSize * offset.x;
					_viewport.y += smallSize * offset.y;
					_viewport.z = smallSize;
					_viewport.w = smallSize;
					_scissor.copy(_viewport);
				}
				if (light.castShadows) {
					const lightRenderData = light.getRenderData(null, face);
					lightRenderData.shadowViewport.copy(_viewport);
					lightRenderData.shadowScissor.copy(_scissor);
				}
			}
		}
	}
	assignSlot(light, slotIndex, slotReassigned) {
		light.atlasViewportAllocated = true;
		const slot = this.slots[slotIndex];
		slot.lightId = light.id;
		slot.used = true;
		if (slotReassigned) {
			light.atlasSlotUpdated = true;
			light.atlasVersion = this.version;
			light.atlasSlotIndex = slotIndex;
		}
	}
	update(spotLights, omniLights, lightingParams) {
		this.shadowAtlasResolution = lightingParams.shadowAtlasResolution;
		this.cookieAtlasResolution = lightingParams.cookieAtlasResolution;
		const lights = this.collectLights(spotLights, omniLights, lightingParams);
		if (lights.length > 0) {
			const slots = this.slots;
			for (let i = 0; i < slots.length; i++) {
				slots[i].used = false;
			}
			const assignCount = Math.min(lights.length, slots.length);
			for (let i = 0; i < assignCount; i++) {
				const light = lights[i];
				if (light.castShadows) light._shadowMap = this.shadowAtlas;
				const previousSlot = slots[light.atlasSlotIndex];
				if (light.atlasVersion === this.version && light.id === (previousSlot == null ? void 0 : previousSlot.lightId)) {
					const _previousSlot = slots[light.atlasSlotIndex];
					if (_previousSlot.size === slots[i].size && !_previousSlot.used) {
						this.assignSlot(light, light.atlasSlotIndex, false);
					}
				}
			}
			let usedCount = 0;
			for (let i = 0; i < assignCount; i++) {
				while (usedCount < slots.length && slots[usedCount].used) usedCount++;
				const light = lights[i];
				if (!light.atlasViewportAllocated) {
					this.assignSlot(light, usedCount, true);
				}
				const slot = slots[light.atlasSlotIndex];
				this.setupSlot(light, slot.rect);
			}
		}
		this.updateUniforms();
	}
}

export { LightTextureAtlas };
