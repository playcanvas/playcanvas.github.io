import { Vec3 } from '../../core/math/vec3.js';
import { ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { FloatPacking } from '../../core/math/float-packing.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_SPOT, LIGHTSHAPE_PUNCTUAL } from '../constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { LightCamera } from '../renderer/light-camera.js';

const epsilon = 0.000001;
const tempVec3 = new Vec3();
const tempAreaLightSizes = new Float32Array(6);
const areaHalfAxisWidth = new Vec3(-0.5, 0, 0);
const areaHalfAxisHeight = new Vec3(0, 0, 0.5);
const TextureIndex8 = {
	FLAGS: 0,
	COLOR_A: 1,
	COLOR_B: 2,
	SPOT_ANGLES: 3,
	SHADOW_BIAS: 4,
	COOKIE_A: 5,
	COOKIE_B: 6,
	COUNT_ALWAYS: 7,
	POSITION_X: 7,
	POSITION_Y: 8,
	POSITION_Z: 9,
	RANGE: 10,
	SPOT_DIRECTION_X: 11,
	SPOT_DIRECTION_Y: 12,
	SPOT_DIRECTION_Z: 13,
	PROJ_MAT_00: 14,
	ATLAS_VIEWPORT_A: 14,
	PROJ_MAT_01: 15,
	ATLAS_VIEWPORT_B: 15,
	PROJ_MAT_02: 16,
	PROJ_MAT_03: 17,
	PROJ_MAT_10: 18,
	PROJ_MAT_11: 19,
	PROJ_MAT_12: 20,
	PROJ_MAT_13: 21,
	PROJ_MAT_20: 22,
	PROJ_MAT_21: 23,
	PROJ_MAT_22: 24,
	PROJ_MAT_23: 25,
	PROJ_MAT_30: 26,
	PROJ_MAT_31: 27,
	PROJ_MAT_32: 28,
	PROJ_MAT_33: 29,
	AREA_DATA_WIDTH_X: 30,
	AREA_DATA_WIDTH_Y: 31,
	AREA_DATA_WIDTH_Z: 32,
	AREA_DATA_HEIGHT_X: 33,
	AREA_DATA_HEIGHT_Y: 34,
	AREA_DATA_HEIGHT_Z: 35,
	COUNT: 36
};
const TextureIndexFloat = {
	POSITION_RANGE: 0,
	SPOT_DIRECTION: 1,
	PROJ_MAT_0: 2,
	ATLAS_VIEWPORT: 2,
	PROJ_MAT_1: 3,
	PROJ_MAT_2: 4,
	PROJ_MAT_3: 5,
	AREA_DATA_WIDTH: 6,
	AREA_DATA_HEIGHT: 7,
	COUNT: 8
};
class LightsBuffer {
	static initShaderDefines() {
		const clusterTextureFormat = LightsBuffer.lightTextureFormat === LightsBuffer.FORMAT_FLOAT ? 'FLOAT' : '8BIT';
		LightsBuffer.shaderDefines = `
						\n#define CLUSTER_TEXTURE_${clusterTextureFormat}
						${LightsBuffer.buildShaderDefines(TextureIndex8, 'CLUSTER_TEXTURE_8_')}
						${LightsBuffer.buildShaderDefines(TextureIndexFloat, 'CLUSTER_TEXTURE_F_')}
				`;
	}
	static buildShaderDefines(object, prefix) {
		let str = '';
		const floatOffset = LightsBuffer.useTexelFetch ? '' : '.5';
		Object.keys(object).forEach(key => {
			str += `\n#define ${prefix}${key} ${object[key]}${floatOffset}`;
		});
		return str;
	}
	static init(device) {
		LightsBuffer.lightTextureFormat = device.extTextureFloat && device.maxTextures > 8 ? LightsBuffer.FORMAT_FLOAT : LightsBuffer.FORMAT_8BIT;
		LightsBuffer.useTexelFetch = device.supportsTextureFetch;
		LightsBuffer.initShaderDefines();
	}
	static createTexture(device, width, height, format, name) {
		const tex = new Texture(device, {
			name: name,
			width: width,
			height: height,
			mipmaps: false,
			format: format,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE,
			type: TEXTURETYPE_DEFAULT,
			magFilter: FILTER_NEAREST,
			minFilter: FILTER_NEAREST,
			anisotropy: 1
		});
		return tex;
	}
	constructor(device) {
		this.device = device;
		this.cookiesEnabled = false;
		this.shadowsEnabled = false;
		this.areaLightsEnabled = false;
		this.maxLights = 255;
		let pixelsPerLight8 = TextureIndex8.COUNT_ALWAYS;
		let pixelsPerLightFloat = 0;
		if (LightsBuffer.lightTextureFormat === LightsBuffer.FORMAT_FLOAT) {
			pixelsPerLightFloat = TextureIndexFloat.COUNT;
		} else {
			pixelsPerLight8 = TextureIndex8.COUNT;
		}
		this.lights8 = new Uint8ClampedArray(4 * pixelsPerLight8 * this.maxLights);
		this.lightsTexture8 = LightsBuffer.createTexture(this.device, pixelsPerLight8, this.maxLights, PIXELFORMAT_RGBA8, 'LightsTexture8');
		this._lightsTexture8Id = this.device.scope.resolve('lightsTexture8');
		if (pixelsPerLightFloat) {
			this.lightsFloat = new Float32Array(4 * pixelsPerLightFloat * this.maxLights);
			this.lightsTextureFloat = LightsBuffer.createTexture(this.device, pixelsPerLightFloat, this.maxLights, PIXELFORMAT_RGBA32F, 'LightsTextureFloat');
			this._lightsTextureFloatId = this.device.scope.resolve('lightsTextureFloat');
		} else {
			this.lightsFloat = null;
			this.lightsTextureFloat = null;
			this._lightsTextureFloatId = undefined;
		}
		this._lightsTextureInvSizeId = this.device.scope.resolve('lightsTextureInvSize');
		this._lightsTextureInvSizeData = new Float32Array(4);
		this._lightsTextureInvSizeData[0] = pixelsPerLightFloat ? 1.0 / this.lightsTextureFloat.width : 0;
		this._lightsTextureInvSizeData[1] = pixelsPerLightFloat ? 1.0 / this.lightsTextureFloat.height : 0;
		this._lightsTextureInvSizeData[2] = 1.0 / this.lightsTexture8.width;
		this._lightsTextureInvSizeData[3] = 1.0 / this.lightsTexture8.height;
		this.invMaxColorValue = 0;
		this.invMaxAttenuation = 0;
		this.boundsMin = new Vec3();
		this.boundsDelta = new Vec3();
	}
	destroy() {
		if (this.lightsTexture8) {
			this.lightsTexture8.destroy();
			this.lightsTexture8 = null;
		}
		if (this.lightsTextureFloat) {
			this.lightsTextureFloat.destroy();
			this.lightsTextureFloat = null;
		}
	}
	setCompressionRanges(maxAttenuation, maxColorValue) {
		this.invMaxColorValue = 1 / maxColorValue;
		this.invMaxAttenuation = 1 / maxAttenuation;
	}
	setBounds(min, delta) {
		this.boundsMin.copy(min);
		this.boundsDelta.copy(delta);
	}
	uploadTextures() {
		if (this.lightsTextureFloat) {
			this.lightsTextureFloat.lock().set(this.lightsFloat);
			this.lightsTextureFloat.unlock();
		}
		this.lightsTexture8.lock().set(this.lights8);
		this.lightsTexture8.unlock();
	}
	updateUniforms() {
		this._lightsTexture8Id.setValue(this.lightsTexture8);
		if (LightsBuffer.lightTextureFormat === LightsBuffer.FORMAT_FLOAT) {
			this._lightsTextureFloatId.setValue(this.lightsTextureFloat);
		}
		this._lightsTextureInvSizeId.setValue(this._lightsTextureInvSizeData);
	}
	getSpotDirection(direction, spot) {
		const mat = spot._node.getWorldTransform();
		mat.getY(direction).mulScalar(-1);
		direction.normalize();
	}
	getLightAreaSizes(light) {
		const mat = light._node.getWorldTransform();
		mat.transformVector(areaHalfAxisWidth, tempVec3);
		tempAreaLightSizes[0] = tempVec3.x;
		tempAreaLightSizes[1] = tempVec3.y;
		tempAreaLightSizes[2] = tempVec3.z;
		mat.transformVector(areaHalfAxisHeight, tempVec3);
		tempAreaLightSizes[3] = tempVec3.x;
		tempAreaLightSizes[4] = tempVec3.y;
		tempAreaLightSizes[5] = tempVec3.z;
		return tempAreaLightSizes;
	}
	addLightDataFlags(data8, index, light, isSpot, castShadows, shadowIntensity) {
		data8[index + 0] = isSpot ? 255 : 0;
		data8[index + 1] = light._shape * 64;
		data8[index + 2] = light._falloffMode * 255;
		data8[index + 3] = castShadows ? shadowIntensity * 255 : 0;
	}
	addLightDataColor(data8, index, light, gammaCorrection, isCookie) {
		const invMaxColorValue = this.invMaxColorValue;
		const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
		FloatPacking.float2Bytes(color[0] * invMaxColorValue, data8, index + 0, 2);
		FloatPacking.float2Bytes(color[1] * invMaxColorValue, data8, index + 2, 2);
		FloatPacking.float2Bytes(color[2] * invMaxColorValue, data8, index + 4, 2);
		data8[index + 6] = isCookie ? 255 : 0;
		const isDynamic = !!(light.mask & MASK_AFFECT_DYNAMIC);
		const isLightmapped = !!(light.mask & MASK_AFFECT_LIGHTMAPPED);
		data8[index + 7] = isDynamic && isLightmapped ? 127 : isLightmapped ? 255 : 0;
	}
	addLightDataSpotAngles(data8, index, light) {
		FloatPacking.float2Bytes(light._innerConeAngleCos * (0.5 - epsilon) + 0.5, data8, index + 0, 2);
		FloatPacking.float2Bytes(light._outerConeAngleCos * (0.5 - epsilon) + 0.5, data8, index + 2, 2);
	}
	addLightDataShadowBias(data8, index, light) {
		const lightRenderData = light.getRenderData(null, 0);
		const biases = light._getUniformBiasValues(lightRenderData);
		FloatPacking.float2BytesRange(biases.bias, data8, index, -1, 20, 2);
		FloatPacking.float2Bytes(biases.normalBias, data8, index + 2, 2);
	}
	addLightDataPositionRange(data8, index, light, pos) {
		const normPos = tempVec3.sub2(pos, this.boundsMin).div(this.boundsDelta);
		FloatPacking.float2Bytes(normPos.x, data8, index + 0, 4);
		FloatPacking.float2Bytes(normPos.y, data8, index + 4, 4);
		FloatPacking.float2Bytes(normPos.z, data8, index + 8, 4);
		FloatPacking.float2Bytes(light.attenuationEnd * this.invMaxAttenuation, data8, index + 12, 4);
	}
	addLightDataSpotDirection(data8, index, light) {
		this.getSpotDirection(tempVec3, light);
		FloatPacking.float2Bytes(tempVec3.x * (0.5 - epsilon) + 0.5, data8, index + 0, 4);
		FloatPacking.float2Bytes(tempVec3.y * (0.5 - epsilon) + 0.5, data8, index + 4, 4);
		FloatPacking.float2Bytes(tempVec3.z * (0.5 - epsilon) + 0.5, data8, index + 8, 4);
	}
	addLightDataLightProjMatrix(data8, index, lightProjectionMatrix) {
		const matData = lightProjectionMatrix.data;
		for (let m = 0; m < 12; m++) FloatPacking.float2BytesRange(matData[m], data8, index + 4 * m, -2, 2, 4);
		for (let m = 12; m < 16; m++) {
			FloatPacking.float2MantissaExponent(matData[m], data8, index + 4 * m, 4);
		}
	}
	addLightDataCookies(data8, index, light) {
		const isRgb = light._cookieChannel === 'rgb';
		data8[index + 0] = Math.floor(light.cookieIntensity * 255);
		data8[index + 1] = isRgb ? 255 : 0;
		if (!isRgb) {
			const channel = light._cookieChannel;
			data8[index + 4] = channel === 'rrr' ? 255 : 0;
			data8[index + 5] = channel === 'ggg' ? 255 : 0;
			data8[index + 6] = channel === 'bbb' ? 255 : 0;
			data8[index + 7] = channel === 'aaa' ? 255 : 0;
		}
	}
	addLightAtlasViewport(data8, index, atlasViewport) {
		FloatPacking.float2Bytes(atlasViewport.x, data8, index + 0, 2);
		FloatPacking.float2Bytes(atlasViewport.y, data8, index + 2, 2);
		FloatPacking.float2Bytes(atlasViewport.z / 3, data8, index + 4, 2);
	}
	addLightAreaSizes(data8, index, light) {
		const areaSizes = this.getLightAreaSizes(light);
		for (let i = 0; i < 6; i++) {
			FloatPacking.float2MantissaExponent(areaSizes[i], data8, index + 4 * i, 4);
		}
	}
	addLightData(light, lightIndex, gammaCorrection) {
		const isSpot = light._type === LIGHTTYPE_SPOT;
		const hasAtlasViewport = light.atlasViewportAllocated;
		const isCookie = this.cookiesEnabled && !!light._cookie && hasAtlasViewport;
		const isArea = this.areaLightsEnabled && light.shape !== LIGHTSHAPE_PUNCTUAL;
		const castShadows = this.shadowsEnabled && light.castShadows && hasAtlasViewport;
		const pos = light._node.getPosition();
		let lightProjectionMatrix = null;
		let atlasViewport = null;
		if (isSpot) {
			if (castShadows) {
				const lightRenderData = light.getRenderData(null, 0);
				lightProjectionMatrix = lightRenderData.shadowMatrix;
			} else if (isCookie) {
				lightProjectionMatrix = LightCamera.evalSpotCookieMatrix(light);
			}
		} else {
			if (castShadows || isCookie) {
				atlasViewport = light.atlasViewport;
			}
		}
		const data8 = this.lights8;
		const data8Start = lightIndex * this.lightsTexture8.width * 4;
		this.addLightDataFlags(data8, data8Start + 4 * TextureIndex8.FLAGS, light, isSpot, castShadows, light.shadowIntensity);
		this.addLightDataColor(data8, data8Start + 4 * TextureIndex8.COLOR_A, light, gammaCorrection, isCookie);
		if (isSpot) {
			this.addLightDataSpotAngles(data8, data8Start + 4 * TextureIndex8.SPOT_ANGLES, light);
		}
		if (light.castShadows) {
			this.addLightDataShadowBias(data8, data8Start + 4 * TextureIndex8.SHADOW_BIAS, light);
		}
		if (isCookie) {
			this.addLightDataCookies(data8, data8Start + 4 * TextureIndex8.COOKIE_A, light);
		}
		if (LightsBuffer.lightTextureFormat === LightsBuffer.FORMAT_FLOAT) {
			const dataFloat = this.lightsFloat;
			const dataFloatStart = lightIndex * this.lightsTextureFloat.width * 4;
			dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 0] = pos.x;
			dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 1] = pos.y;
			dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 2] = pos.z;
			dataFloat[dataFloatStart + 4 * TextureIndexFloat.POSITION_RANGE + 3] = light.attenuationEnd;
			if (isSpot) {
				this.getSpotDirection(tempVec3, light);
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 0] = tempVec3.x;
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 1] = tempVec3.y;
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.SPOT_DIRECTION + 2] = tempVec3.z;
			}
			if (lightProjectionMatrix) {
				const matData = lightProjectionMatrix.data;
				for (let m = 0; m < 16; m++) dataFloat[dataFloatStart + 4 * TextureIndexFloat.PROJ_MAT_0 + m] = matData[m];
			}
			if (atlasViewport) {
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 0] = atlasViewport.x;
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 1] = atlasViewport.y;
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.ATLAS_VIEWPORT + 2] = atlasViewport.z / 3;
			}
			if (isArea) {
				const areaSizes = this.getLightAreaSizes(light);
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 0] = areaSizes[0];
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 1] = areaSizes[1];
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_WIDTH + 2] = areaSizes[2];
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 0] = areaSizes[3];
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 1] = areaSizes[4];
				dataFloat[dataFloatStart + 4 * TextureIndexFloat.AREA_DATA_HEIGHT + 2] = areaSizes[5];
			}
		} else {
			this.addLightDataPositionRange(data8, data8Start + 4 * TextureIndex8.POSITION_X, light, pos);
			if (isSpot) {
				this.addLightDataSpotDirection(data8, data8Start + 4 * TextureIndex8.SPOT_DIRECTION_X, light);
			}
			if (lightProjectionMatrix) {
				this.addLightDataLightProjMatrix(data8, data8Start + 4 * TextureIndex8.PROJ_MAT_00, lightProjectionMatrix);
			}
			if (atlasViewport) {
				this.addLightAtlasViewport(data8, data8Start + 4 * TextureIndex8.ATLAS_VIEWPORT_A, atlasViewport);
			}
			if (isArea) {
				this.addLightAreaSizes(data8, data8Start + 4 * TextureIndex8.AREA_DATA_WIDTH_X, light);
			}
		}
	}
}
LightsBuffer.FORMAT_FLOAT = 0;
LightsBuffer.FORMAT_8BIT = 1;
LightsBuffer.lightTextureFormat = LightsBuffer.FORMAT_8BIT;
LightsBuffer.useTexelFetch = false;
LightsBuffer.shaderDefines = '';

export { LightsBuffer };
