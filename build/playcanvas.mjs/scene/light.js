import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, LIGHTFALLOFF_LINEAR, SHADOW_PCF3, BLUR_GAUSSIAN, LIGHTSHAPE_PUNCTUAL, SHADOWUPDATE_REALTIME, LIGHTTYPE_OMNI, SHADOW_PCF5, SHADOW_VSM32, SHADOW_VSM16, SHADOW_VSM8, MASK_BAKE, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, LIGHTTYPE_SPOT } from './constants.js';
import { ShadowRenderer } from './renderer/shadow-renderer.js';

const tmpVec = new Vec3();
const tmpBiases = {
	bias: 0,
	normalBias: 0
};
const chanId = {
	r: 0,
	g: 1,
	b: 2,
	a: 3
};
const lightTypes = {
	'directional': LIGHTTYPE_DIRECTIONAL,
	'omni': LIGHTTYPE_OMNI,
	'point': LIGHTTYPE_OMNI,
	'spot': LIGHTTYPE_SPOT
};
const directionalCascades = [[new Vec4(0, 0, 1, 1)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5), new Vec4(0.5, 0.5, 0.5, 0.5)]];
let id = 0;
class LightRenderData {
	constructor(device, camera, face, light) {
		this.light = light;
		this.camera = camera;
		this.shadowCamera = ShadowRenderer.createShadowCamera(device, light._shadowType, light._type, face);
		this.shadowMatrix = new Mat4();
		this.shadowViewport = new Vec4(0, 0, 1, 1);
		this.shadowScissor = new Vec4(0, 0, 1, 1);
		this.face = face;
		this.visibleCasters = [];
		this.viewBindGroups = [];
	}
	destroy() {
		this.viewBindGroups.forEach(bg => {
			bg.defaultUniformBuffer.destroy();
			bg.destroy();
		});
		this.viewBindGroups.length = 0;
	}
	get shadowBuffer() {
		const rt = this.shadowCamera.renderTarget;
		if (rt) {
			const light = this.light;
			if (light._type === LIGHTTYPE_OMNI) {
				return rt.colorBuffer;
			}
			return light._isPcf && light.device.supportsDepthShadow ? rt.depthBuffer : rt.colorBuffer;
		}
		return null;
	}
}
class Light {
	constructor(graphicsDevice) {
		this.device = graphicsDevice;
		this.id = id++;
		this._type = LIGHTTYPE_DIRECTIONAL;
		this._color = new Color(0.8, 0.8, 0.8);
		this._intensity = 1;
		this._luminance = 0;
		this._castShadows = false;
		this._enabled = false;
		this.mask = MASK_AFFECT_DYNAMIC;
		this.isStatic = false;
		this.key = 0;
		this.bakeDir = true;
		this.bakeNumSamples = 1;
		this.bakeArea = 0;
		this.attenuationStart = 10;
		this.attenuationEnd = 10;
		this._falloffMode = LIGHTFALLOFF_LINEAR;
		this._shadowType = SHADOW_PCF3;
		this._vsmBlurSize = 11;
		this.vsmBlurMode = BLUR_GAUSSIAN;
		this.vsmBias = 0.01 * 0.25;
		this._cookie = null;
		this.cookieIntensity = 1;
		this._cookieFalloff = true;
		this._cookieChannel = 'rgb';
		this._cookieTransform = null;
		this._cookieTransformUniform = new Float32Array(4);
		this._cookieOffset = null;
		this._cookieOffsetUniform = new Float32Array(2);
		this._cookieTransformSet = false;
		this._cookieOffsetSet = false;
		this._innerConeAngle = 40;
		this._outerConeAngle = 45;
		this.cascades = null;
		this._shadowMatrixPalette = null;
		this._shadowCascadeDistances = null;
		this.numCascades = 1;
		this.cascadeDistribution = 0.5;
		this._shape = LIGHTSHAPE_PUNCTUAL;
		this._finalColor = new Float32Array([0.8, 0.8, 0.8]);
		const c = Math.pow(this._finalColor[0], 2.2);
		this._linearFinalColor = new Float32Array([c, c, c]);
		this._position = new Vec3(0, 0, 0);
		this._direction = new Vec3(0, 0, 0);
		this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
		this._updateOuterAngle(this._outerConeAngle);
		this._usePhysicalUnits = undefined;
		this._shadowMap = null;
		this._shadowRenderParams = [];
		this.shadowDistance = 40;
		this._shadowResolution = 1024;
		this.shadowBias = -0.0005;
		this.shadowIntensity = 1.0;
		this._normalOffsetBias = 0.0;
		this.shadowUpdateMode = SHADOWUPDATE_REALTIME;
		this.shadowUpdateOverrides = null;
		this._isVsm = false;
		this._isPcf = true;
		this._cookieMatrix = null;
		this._atlasViewport = null;
		this.atlasViewportAllocated = false;
		this.atlasVersion = 0;
		this.atlasSlotIndex = 0;
		this.atlasSlotUpdated = false;
		this._scene = null;
		this._node = null;
		this._renderData = [];
		this.visibleThisFrame = false;
		this.maxScreenSize = 0;
	}
	destroy() {
		this._destroyShadowMap();
		this.releaseRenderData();
		this._renderData = null;
	}
	releaseRenderData() {
		if (this._renderData) {
			for (let i = 0; i < this._renderData.length; i++) {
				this._renderData[i].destroy();
			}
			this._renderData.length = 0;
		}
	}
	set numCascades(value) {
		if (!this.cascades || this.numCascades !== value) {
			this.cascades = directionalCascades[value - 1];
			this._shadowMatrixPalette = new Float32Array(4 * 16);
			this._shadowCascadeDistances = new Float32Array(4);
			this._destroyShadowMap();
			this.updateKey();
		}
	}
	get numCascades() {
		return this.cascades.length;
	}
	set shadowMap(shadowMap) {
		if (this._shadowMap !== shadowMap) {
			this._destroyShadowMap();
			this._shadowMap = shadowMap;
		}
	}
	get shadowMap() {
		return this._shadowMap;
	}
	get numShadowFaces() {
		const type = this._type;
		if (type === LIGHTTYPE_DIRECTIONAL) {
			return this.numCascades;
		} else if (type === LIGHTTYPE_OMNI) {
			return 6;
		}
		return 1;
	}
	set type(value) {
		if (this._type === value) return;
		this._type = value;
		this._destroyShadowMap();
		this.updateKey();
		const stype = this._shadowType;
		this._shadowType = null;
		this.shadowUpdateOverrides = null;
		this.shadowType = stype;
	}
	get type() {
		return this._type;
	}
	set shape(value) {
		if (this._shape === value) return;
		this._shape = value;
		this._destroyShadowMap();
		this.updateKey();
		const stype = this._shadowType;
		this._shadowType = null;
		this.shadowType = stype;
	}
	get shape() {
		return this._shape;
	}
	set usePhysicalUnits(value) {
		if (this._usePhysicalUnits !== value) {
			this._usePhysicalUnits = value;
			this._updateFinalColor();
		}
	}
	get usePhysicalUnits() {
		return this._usePhysicalUnits;
	}
	set shadowType(value) {
		if (this._shadowType === value) return;
		const device = this.device;
		if (this._type === LIGHTTYPE_OMNI) value = SHADOW_PCF3;
		const supportsPCF5 = device.supportsDepthShadow;
		if (value === SHADOW_PCF5 && !supportsPCF5) {
			value = SHADOW_PCF3;
		}
		if (value === SHADOW_VSM32 && !device.textureFloatRenderable) value = SHADOW_VSM16;
		if (value === SHADOW_VSM16 && !device.textureHalfFloatRenderable) value = SHADOW_VSM8;
		this._isVsm = value >= SHADOW_VSM8 && value <= SHADOW_VSM32;
		this._isPcf = value === SHADOW_PCF5 || value === SHADOW_PCF3;
		this._shadowType = value;
		this._destroyShadowMap();
		this.updateKey();
	}
	get shadowType() {
		return this._shadowType;
	}
	set enabled(value) {
		if (this._enabled !== value) {
			this._enabled = value;
			this.layersDirty();
		}
	}
	get enabled() {
		return this._enabled;
	}
	set castShadows(value) {
		if (this._castShadows !== value) {
			this._castShadows = value;
			this._destroyShadowMap();
			this.layersDirty();
			this.updateKey();
		}
	}
	get castShadows() {
		return this._castShadows && this.mask !== MASK_BAKE && this.mask !== 0;
	}
	set shadowResolution(value) {
		if (this._shadowResolution !== value) {
			if (this._type === LIGHTTYPE_OMNI) {
				value = Math.min(value, this.device.maxCubeMapSize);
			} else {
				value = Math.min(value, this.device.maxTextureSize);
			}
			this._shadowResolution = value;
			this._destroyShadowMap();
		}
	}
	get shadowResolution() {
		return this._shadowResolution;
	}
	set vsmBlurSize(value) {
		if (this._vsmBlurSize === value) return;
		if (value % 2 === 0) value++;
		this._vsmBlurSize = value;
	}
	get vsmBlurSize() {
		return this._vsmBlurSize;
	}
	set normalOffsetBias(value) {
		if (this._normalOffsetBias === value) return;
		if (!this._normalOffsetBias && value || this._normalOffsetBias && !value) {
			this.updateKey();
		}
		this._normalOffsetBias = value;
	}
	get normalOffsetBias() {
		return this._normalOffsetBias;
	}
	set falloffMode(value) {
		if (this._falloffMode === value) return;
		this._falloffMode = value;
		this.updateKey();
	}
	get falloffMode() {
		return this._falloffMode;
	}
	set innerConeAngle(value) {
		if (this._innerConeAngle === value) return;
		this._innerConeAngle = value;
		this._innerConeAngleCos = Math.cos(value * Math.PI / 180);
		if (this._usePhysicalUnits) {
			this._updateFinalColor();
		}
	}
	get innerConeAngle() {
		return this._innerConeAngle;
	}
	set outerConeAngle(value) {
		if (this._outerConeAngle === value) return;
		this._outerConeAngle = value;
		this._updateOuterAngle(value);
		if (this._usePhysicalUnits) {
			this._updateFinalColor();
		}
	}
	get outerConeAngle() {
		return this._outerConeAngle;
	}
	_updateOuterAngle(angle) {
		const radAngle = angle * Math.PI / 180;
		this._outerConeAngleCos = Math.cos(radAngle);
		this._outerConeAngleSin = Math.sin(radAngle);
	}
	set intensity(value) {
		if (this._intensity !== value) {
			this._intensity = value;
			this._updateFinalColor();
		}
	}
	get intensity() {
		return this._intensity;
	}
	set luminance(value) {
		if (this._luminance !== value) {
			this._luminance = value;
			this._updateFinalColor();
		}
	}
	get luminance() {
		return this._luminance;
	}
	get cookieMatrix() {
		if (!this._cookieMatrix) {
			this._cookieMatrix = new Mat4();
		}
		return this._cookieMatrix;
	}
	get atlasViewport() {
		if (!this._atlasViewport) {
			this._atlasViewport = new Vec4(0, 0, 1, 1);
		}
		return this._atlasViewport;
	}
	set cookie(value) {
		if (this._cookie === value) return;
		this._cookie = value;
		this.updateKey();
	}
	get cookie() {
		return this._cookie;
	}
	set cookieFalloff(value) {
		if (this._cookieFalloff === value) return;
		this._cookieFalloff = value;
		this.updateKey();
	}
	get cookieFalloff() {
		return this._cookieFalloff;
	}
	set cookieChannel(value) {
		if (this._cookieChannel === value) return;
		if (value.length < 3) {
			const chr = value.charAt(value.length - 1);
			const addLen = 3 - value.length;
			for (let i = 0; i < addLen; i++) value += chr;
		}
		this._cookieChannel = value;
		this.updateKey();
	}
	get cookieChannel() {
		return this._cookieChannel;
	}
	set cookieTransform(value) {
		if (this._cookieTransform === value) return;
		this._cookieTransform = value;
		this._cookieTransformSet = !!value;
		if (value && !this._cookieOffset) {
			this.cookieOffset = new Vec2();
			this._cookieOffsetSet = false;
		}
		this.updateKey();
	}
	get cookieTransform() {
		return this._cookieTransform;
	}
	set cookieOffset(value) {
		if (this._cookieOffset === value) return;
		const xformNew = !!(this._cookieTransformSet || value);
		if (xformNew && !value && this._cookieOffset) {
			this._cookieOffset.set(0, 0);
		} else {
			this._cookieOffset = value;
		}
		this._cookieOffsetSet = !!value;
		if (value && !this._cookieTransform) {
			this.cookieTransform = new Vec4(1, 1, 0, 0);
			this._cookieTransformSet = false;
		}
		this.updateKey();
	}
	get cookieOffset() {
		return this._cookieOffset;
	}
	beginFrame() {
		this.visibleThisFrame = this._type === LIGHTTYPE_DIRECTIONAL && this._enabled;
		this.maxScreenSize = 0;
		this.atlasViewportAllocated = false;
		this.atlasSlotUpdated = false;
	}
	_destroyShadowMap() {
		this.releaseRenderData();
		if (this._shadowMap) {
			if (!this._shadowMap.cached) {
				this._shadowMap.destroy();
			}
			this._shadowMap = null;
		}
		if (this.shadowUpdateMode === SHADOWUPDATE_NONE) {
			this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
		}
		if (this.shadowUpdateOverrides) {
			for (let i = 0; i < this.shadowUpdateOverrides.length; i++) {
				if (this.shadowUpdateOverrides[i] === SHADOWUPDATE_NONE) {
					this.shadowUpdateOverrides[i] = SHADOWUPDATE_THISFRAME;
				}
			}
		}
	}
	getRenderData(camera, face) {
		for (let i = 0; i < this._renderData.length; i++) {
			const current = this._renderData[i];
			if (current.camera === camera && current.face === face) {
				return current;
			}
		}
		const rd = new LightRenderData(this.device, camera, face, this);
		this._renderData.push(rd);
		return rd;
	}
	clone() {
		const clone = new Light(this.device);
		clone.type = this._type;
		clone.setColor(this._color);
		clone.intensity = this._intensity;
		clone.luminance = this._luminance;
		clone.castShadows = this.castShadows;
		clone._enabled = this._enabled;
		clone.attenuationStart = this.attenuationStart;
		clone.attenuationEnd = this.attenuationEnd;
		clone.falloffMode = this._falloffMode;
		clone.shadowType = this._shadowType;
		clone.vsmBlurSize = this._vsmBlurSize;
		clone.vsmBlurMode = this.vsmBlurMode;
		clone.vsmBias = this.vsmBias;
		clone.shadowUpdateMode = this.shadowUpdateMode;
		clone.mask = this.mask;
		if (this.shadowUpdateOverrides) {
			clone.shadowUpdateOverrides = this.shadowUpdateOverrides.slice();
		}
		clone.innerConeAngle = this._innerConeAngle;
		clone.outerConeAngle = this._outerConeAngle;
		clone.numCascades = this.numCascades;
		clone.cascadeDistribution = this.cascadeDistribution;
		clone.shape = this._shape;
		clone.shadowBias = this.shadowBias;
		clone.normalOffsetBias = this._normalOffsetBias;
		clone.shadowResolution = this._shadowResolution;
		clone.shadowDistance = this.shadowDistance;
		clone.shadowIntensity = this.shadowIntensity;
		return clone;
	}
	static getLightUnitConversion(type, outerAngle = Math.PI / 4, innerAngle = 0) {
		switch (type) {
			case LIGHTTYPE_SPOT:
				{
					const falloffEnd = Math.cos(outerAngle);
					const falloffStart = Math.cos(innerAngle);
					return 2 * Math.PI * (1 - falloffStart + (falloffStart - falloffEnd) / 2.0);
				}
			case LIGHTTYPE_OMNI:
				return 4 * Math.PI;
			case LIGHTTYPE_DIRECTIONAL:
				return 1;
		}
	}
	_getUniformBiasValues(lightRenderData) {
		const farClip = lightRenderData.shadowCamera._farClip;
		switch (this._type) {
			case LIGHTTYPE_OMNI:
				tmpBiases.bias = this.shadowBias;
				tmpBiases.normalBias = this._normalOffsetBias;
				break;
			case LIGHTTYPE_SPOT:
				if (this._isVsm) {
					tmpBiases.bias = -0.00001 * 20;
				} else {
					tmpBiases.bias = this.shadowBias * 20;
					if (!this.device.webgl2 && this.device.extStandardDerivatives) tmpBiases.bias *= -100;
				}
				tmpBiases.normalBias = this._isVsm ? this.vsmBias / (this.attenuationEnd / 7.0) : this._normalOffsetBias;
				break;
			case LIGHTTYPE_DIRECTIONAL:
				if (this._isVsm) {
					tmpBiases.bias = -0.00001 * 20;
				} else {
					tmpBiases.bias = this.shadowBias / farClip * 100;
					if (!this.device.webgl2 && this.device.extStandardDerivatives) tmpBiases.bias *= -100;
				}
				tmpBiases.normalBias = this._isVsm ? this.vsmBias / (farClip / 7.0) : this._normalOffsetBias;
				break;
		}
		return tmpBiases;
	}
	getColor() {
		return this._color;
	}
	getBoundingSphere(sphere) {
		if (this._type === LIGHTTYPE_SPOT) {
			const size = this.attenuationEnd;
			const angle = this._outerConeAngle;
			const cosAngle = this._outerConeAngleCos;
			const node = this._node;
			tmpVec.copy(node.up);
			if (angle > 45) {
				sphere.radius = size * this._outerConeAngleSin;
				tmpVec.mulScalar(-size * cosAngle);
			} else {
				sphere.radius = size / (2 * cosAngle);
				tmpVec.mulScalar(-sphere.radius);
			}
			sphere.center.add2(node.getPosition(), tmpVec);
		} else if (this._type === LIGHTTYPE_OMNI) {
			sphere.center = this._node.getPosition();
			sphere.radius = this.attenuationEnd;
		}
	}
	getBoundingBox(box) {
		if (this._type === LIGHTTYPE_SPOT) {
			const range = this.attenuationEnd;
			const angle = this._outerConeAngle;
			const node = this._node;
			const scl = Math.abs(Math.sin(angle * math.DEG_TO_RAD) * range);
			box.center.set(0, -range * 0.5, 0);
			box.halfExtents.set(scl, range * 0.5, scl);
			box.setFromTransformedAabb(box, node.getWorldTransform(), true);
		} else if (this._type === LIGHTTYPE_OMNI) {
			box.center.copy(this._node.getPosition());
			box.halfExtents.set(this.attenuationEnd, this.attenuationEnd, this.attenuationEnd);
		}
	}
	_updateFinalColor() {
		const color = this._color;
		const r = color.r;
		const g = color.g;
		const b = color.b;
		let i = this._intensity;
		if (this._usePhysicalUnits) {
			i = this._luminance / Light.getLightUnitConversion(this._type, this._outerConeAngle * math.DEG_TO_RAD, this._innerConeAngle * math.DEG_TO_RAD);
		}
		const finalColor = this._finalColor;
		const linearFinalColor = this._linearFinalColor;
		finalColor[0] = r * i;
		finalColor[1] = g * i;
		finalColor[2] = b * i;
		if (i >= 1) {
			linearFinalColor[0] = Math.pow(r, 2.2) * i;
			linearFinalColor[1] = Math.pow(g, 2.2) * i;
			linearFinalColor[2] = Math.pow(b, 2.2) * i;
		} else {
			linearFinalColor[0] = Math.pow(finalColor[0], 2.2);
			linearFinalColor[1] = Math.pow(finalColor[1], 2.2);
			linearFinalColor[2] = Math.pow(finalColor[2], 2.2);
		}
	}
	setColor() {
		if (arguments.length === 1) {
			this._color.set(arguments[0].r, arguments[0].g, arguments[0].b);
		} else if (arguments.length === 3) {
			this._color.set(arguments[0], arguments[1], arguments[2]);
		}
		this._updateFinalColor();
	}
	layersDirty() {
		var _this$_scene;
		if ((_this$_scene = this._scene) != null && _this$_scene.layers) {
			this._scene.layers._dirtyLights = true;
		}
	}
	updateKey() {
		let key = this._type << 29 | (this._castShadows ? 1 : 0) << 28 | this._shadowType << 25 | this._falloffMode << 23 | (this._normalOffsetBias !== 0.0 ? 1 : 0) << 22 | (this._cookie ? 1 : 0) << 21 | (this._cookieFalloff ? 1 : 0) << 20 | chanId[this._cookieChannel.charAt(0)] << 18 | (this._cookieTransform ? 1 : 0) << 12 | this._shape << 10 | this.numCascades - 1 << 8;
		if (this._cookieChannel.length === 3) {
			key |= chanId[this._cookieChannel.charAt(1)] << 16;
			key |= chanId[this._cookieChannel.charAt(2)] << 14;
		}
		if (key !== this.key && this._scene !== null) {
			this.layersDirty();
		}
		this.key = key;
	}
}

export { Light, lightTypes };
