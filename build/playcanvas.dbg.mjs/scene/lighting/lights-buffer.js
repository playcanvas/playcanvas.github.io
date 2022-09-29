/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../../math/vec3.js';
import { ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F } from '../../graphics/constants.js';
import { FloatPacking } from '../../math/float-packing.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_SPOT, LIGHTSHAPE_PUNCTUAL } from '../constants.js';
import { Texture } from '../../graphics/texture.js';
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
    Object.keys(object).forEach(key => {
      str += `\n#define ${prefix}${key} ${object[key]}.5`;
    });
    return str;
  }

  static init(device) {
    LightsBuffer.lightTextureFormat = device.extTextureFloat && device.maxTextures > 8 ? LightsBuffer.FORMAT_FLOAT : LightsBuffer.FORMAT_8BIT;
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
    this.lightsTexture8 = LightsBuffer.createTexture(this.device, pixelsPerLight8, this.maxLights, PIXELFORMAT_R8_G8_B8_A8, 'LightsTexture8');
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
LightsBuffer.shaderDefines = '';

export { LightsBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRzLWJ1ZmZlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgUElYRUxGT1JNQVRfUkdCQTMyRiwgQUREUkVTU19DTEFNUF9UT19FREdFLCBURVhUVVJFVFlQRV9ERUZBVUxULCBGSUxURVJfTkVBUkVTVCB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBGbG9hdFBhY2tpbmcgfSBmcm9tICcuLi8uLi9tYXRoL2Zsb2F0LXBhY2tpbmcuanMnO1xuaW1wb3J0IHsgTElHSFRTSEFQRV9QVU5DVFVBTCwgTElHSFRUWVBFX1NQT1QsIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELCBNQVNLX0FGRkVDVF9EWU5BTUlDIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IExpZ2h0Q2FtZXJhIH0gZnJvbSAnLi4vcmVuZGVyZXIvbGlnaHQtY2FtZXJhLmpzJztcblxuY29uc3QgZXBzaWxvbiA9IDAuMDAwMDAxO1xuXG5jb25zdCB0ZW1wVmVjMyA9IG5ldyBWZWMzKCk7XG5jb25zdCB0ZW1wQXJlYUxpZ2h0U2l6ZXMgPSBuZXcgRmxvYXQzMkFycmF5KDYpO1xuY29uc3QgYXJlYUhhbGZBeGlzV2lkdGggPSBuZXcgVmVjMygtMC41LCAwLCAwKTtcbmNvbnN0IGFyZWFIYWxmQXhpc0hlaWdodCA9IG5ldyBWZWMzKDAsIDAsIDAuNSk7XG5cbi8vIGZvcm1hdCBvZiBhIHJvdyBpbiA4IGJpdCB0ZXh0dXJlIHVzZWQgdG8gZW5jb2RlIGxpZ2h0IGRhdGFcbi8vIHRoaXMgaXMgdXNlZCB0byBzdG9yZSBkYXRhIGluIHRoZSB0ZXh0dXJlIGNvcnJlY3RseSwgYW5kIGFsc28gdXNlIHRvIGdlbmVyYXRlIGRlZmluZXMgZm9yIHRoZSBzaGFkZXJcbmNvbnN0IFRleHR1cmVJbmRleDggPSB7XG5cbiAgICAvLyBhbHdheXMgOGJpdCB0ZXh0dXJlIGRhdGEsIHJlZ2FyZGxlc3Mgb2YgZmxvYXQgdGV4dHVyZSBzdXBwb3J0XG4gICAgRkxBR1M6IDAsICAgICAgICAgICAgICAgICAgIC8vIGxpZ2h0VHlwZSwgbGlnaHRTaGFwZSwgZmFsbG9mTW9kZSwgY2FzdFNoYWRvd3NcbiAgICBDT0xPUl9BOiAxLCAgICAgICAgICAgICAgICAgLy8gY29sb3IuciwgY29sb3IuciwgY29sb3IuZywgY29sb3IuZyAgICAvLyBIRFIgY29sb3IgaXMgc3RvcmVkIHVzaW5nIDIgYnl0ZXMgcGVyIGNoYW5uZWxcbiAgICBDT0xPUl9COiAyLCAgICAgICAgICAgICAgICAgLy8gY29sb3IuYiwgY29sb3IuYiwgdXNlQ29va2llLCBsaWdodE1hc2tcbiAgICBTUE9UX0FOR0xFUzogMywgICAgICAgICAgICAgLy8gc3BvdElubmVyLCBzcG90SW5uZXIsIHNwb3RPdXRlciwgc3BvdE91dGVyXG4gICAgU0hBRE9XX0JJQVM6IDQsICAgICAgICAgICAgIC8vIGJpYXMsIGJpYXMsIG5vcm1hbEJpYXMsIG5vcm1hbEJpYXNcbiAgICBDT09LSUVfQTogNSwgICAgICAgICAgICAgICAgLy8gY29va2llSW50ZW5zaXR5LCBjb29raWVJc1JnYiwgLSwgLVxuICAgIENPT0tJRV9COiA2LCAgICAgICAgICAgICAgICAvLyBjb29raWVDaGFubmVsTWFzay54eXp3XG5cbiAgICAvLyBsZWF2ZSBpbi1iZXR3ZWVuXG4gICAgQ09VTlRfQUxXQVlTOiA3LFxuXG4gICAgLy8gOGJpdCB0ZXh0dXJlIGRhdGEgdXNlZCB3aGVuIGZsb2F0IHRleHR1cmUgaXMgbm90IHN1cHBvcnRlZFxuICAgIFBPU0lUSU9OX1g6IDcsICAgICAgICAgICAgICAvLyBwb3NpdGlvbi54XG4gICAgUE9TSVRJT05fWTogOCwgICAgICAgICAgICAgIC8vIHBvc2l0aW9uLnlcbiAgICBQT1NJVElPTl9aOiA5LCAgICAgICAgICAgICAgLy8gcG9zaXRpb24uelxuICAgIFJBTkdFOiAxMCwgICAgICAgICAgICAgICAgICAvLyByYW5nZVxuICAgIFNQT1RfRElSRUNUSU9OX1g6IDExLCAgICAgICAvLyBzcG90IGRpcmVjdGlvbiB4XG4gICAgU1BPVF9ESVJFQ1RJT05fWTogMTIsICAgICAgIC8vIHNwb3QgZGlyZWN0aW9uIHlcbiAgICBTUE9UX0RJUkVDVElPTl9aOiAxMywgICAgICAgLy8gc3BvdCBkaXJlY3Rpb24gelxuXG4gICAgUFJPSl9NQVRfMDA6IDE0LCAgICAgICAgICAgIC8vIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4LCBtYXQ0LCAxNiBmbG9hdHNcbiAgICBBVExBU19WSUVXUE9SVF9BOiAxNCwgICAgICAgLy8gdmlld3BvcnQueCwgdmlld3BvcnQueCwgdmlld3BvcnQueSwgdmlld3BvcnQueVxuXG4gICAgUFJPSl9NQVRfMDE6IDE1LFxuICAgIEFUTEFTX1ZJRVdQT1JUX0I6IDE1LCAgICAgICAvLyB2aWV3cG9ydC56LCB2aWV3cG9ydC56LCAtLCAtXG5cbiAgICBQUk9KX01BVF8wMjogMTYsXG4gICAgUFJPSl9NQVRfMDM6IDE3LFxuICAgIFBST0pfTUFUXzEwOiAxOCxcbiAgICBQUk9KX01BVF8xMTogMTksXG4gICAgUFJPSl9NQVRfMTI6IDIwLFxuICAgIFBST0pfTUFUXzEzOiAyMSxcbiAgICBQUk9KX01BVF8yMDogMjIsXG4gICAgUFJPSl9NQVRfMjE6IDIzLFxuICAgIFBST0pfTUFUXzIyOiAyNCxcbiAgICBQUk9KX01BVF8yMzogMjUsXG4gICAgUFJPSl9NQVRfMzA6IDI2LFxuICAgIFBST0pfTUFUXzMxOiAyNyxcbiAgICBQUk9KX01BVF8zMjogMjgsXG4gICAgUFJPSl9NQVRfMzM6IDI5LFxuXG4gICAgQVJFQV9EQVRBX1dJRFRIX1g6IDMwLFxuICAgIEFSRUFfREFUQV9XSURUSF9ZOiAzMSxcbiAgICBBUkVBX0RBVEFfV0lEVEhfWjogMzIsXG4gICAgQVJFQV9EQVRBX0hFSUdIVF9YOiAzMyxcbiAgICBBUkVBX0RBVEFfSEVJR0hUX1k6IDM0LFxuICAgIEFSRUFfREFUQV9IRUlHSFRfWjogMzUsXG5cbiAgICAvLyBsZWF2ZSBsYXN0XG4gICAgQ09VTlQ6IDM2XG59O1xuXG4vLyBmb3JtYXQgb2YgdGhlIGZsb2F0IHRleHR1cmVcbmNvbnN0IFRleHR1cmVJbmRleEZsb2F0ID0ge1xuICAgIFBPU0lUSU9OX1JBTkdFOiAwLCAgICAgICAgICAgICAgLy8gcG9zaXRpb25zLnh5eiwgcmFuZ2VcbiAgICBTUE9UX0RJUkVDVElPTjogMSwgICAgICAgICAgICAgIC8vIHNwb3QgZGlyZWN0aW9uLnh5eiwgLVxuXG4gICAgUFJPSl9NQVRfMDogMiwgICAgICAgICAgICAgICAgICAvLyBwcm9qZWN0aW9uIG1hdHJpeCByb3cgMCAoc3BvdCBsaWdodClcbiAgICBBVExBU19WSUVXUE9SVDogMiwgICAgICAgICAgICAgIC8vIGF0bGFzIHZpZXdwb3J0IGRhdGEgKG9tbmkgbGlnaHQpXG5cbiAgICBQUk9KX01BVF8xOiAzLCAgICAgICAgICAgICAgICAgIC8vIHByb2plY3Rpb24gbWF0cml4IHJvdyAxIChzcG90IGxpZ2h0KVxuICAgIFBST0pfTUFUXzI6IDQsICAgICAgICAgICAgICAgICAgLy8gcHJvamVjdGlvbiBtYXRyaXggcm93IDIgKHNwb3QgbGlnaHQpXG4gICAgUFJPSl9NQVRfMzogNSwgICAgICAgICAgICAgICAgICAvLyBwcm9qZWN0aW9uIG1hdHJpeCByb3cgMyAoc3BvdCBsaWdodClcblxuICAgIEFSRUFfREFUQV9XSURUSDogNiwgICAgICAgICAgICAgLy8gYXJlYSBsaWdodCBoYWxmLXdpZHRoLnh5eiwgLVxuICAgIEFSRUFfREFUQV9IRUlHSFQ6IDcsICAgICAgICAgICAgLy8gYXJlYSBsaWdodCBoYWxmLWhlaWdodC54eXosIC1cblxuICAgIC8vIGxlYXZlIGxhc3RcbiAgICBDT1VOVDogOFxufTtcblxuLy8gQSBjbGFzcyB1c2VkIGJ5IGNsdXN0ZXJlZCBsaWdodGluZywgcmVzcG9uc2libGUgZm9yIGVuY29kaW5nIGxpZ2h0IHByb3BlcnRpZXMgaW50byB0ZXh0dXJlcyBmb3IgdGhlIHVzZSBvbiB0aGUgR1BVXG5jbGFzcyBMaWdodHNCdWZmZXIge1xuICAgIC8vIGZvcm1hdCBmb3IgaGlnaCBwcmVjaXNpb24gbGlnaHQgdGV4dHVyZSAtIGZsb2F0XG4gICAgc3RhdGljIEZPUk1BVF9GTE9BVCA9IDA7XG5cbiAgICAvLyBmb3JtYXQgZm9yIGhpZ2ggcHJlY2lzaW9uIGxpZ2h0IHRleHR1cmUgLSA4Yml0XG4gICAgc3RhdGljIEZPUk1BVF84QklUID0gMTtcblxuICAgIC8vIGFjdGl2ZSBsaWdodCB0ZXh0dXJlIGZvcm1hdCwgaW5pdGlhbGl6ZWQgYXQgYXBwIHN0YXJ0XG4gICAgc3RhdGljIGxpZ2h0VGV4dHVyZUZvcm1hdCA9IExpZ2h0c0J1ZmZlci5GT1JNQVRfOEJJVDtcblxuICAgIC8vIGRlZmluZXMgdXNlZCBmb3IgdW5wYWNraW5nIG9mIGxpZ2h0IHRleHR1cmVzIHRvIGFsbG93IENQVSBwYWNraW5nIHRvIG1hdGNoIHRoZSBHUFUgdW5wYWNraW5nXG4gICAgc3RhdGljIHNoYWRlckRlZmluZXMgPSAnJztcblxuICAgIC8vIGNyZWF0ZXMgbGlzdCBvZiBkZWZpbmVzIHNwZWNpZnlpbmcgdGV4dHVyZSBjb29yZGluYXRlcyBmb3IgZGVjb2RpbmcgbGlnaHRzXG4gICAgc3RhdGljIGluaXRTaGFkZXJEZWZpbmVzKCkge1xuICAgICAgICBjb25zdCBjbHVzdGVyVGV4dHVyZUZvcm1hdCA9IExpZ2h0c0J1ZmZlci5saWdodFRleHR1cmVGb3JtYXQgPT09IExpZ2h0c0J1ZmZlci5GT1JNQVRfRkxPQVQgPyAnRkxPQVQnIDogJzhCSVQnO1xuICAgICAgICBMaWdodHNCdWZmZXIuc2hhZGVyRGVmaW5lcyA9IGBcbiAgICAgICAgICAgIFxcbiNkZWZpbmUgQ0xVU1RFUl9URVhUVVJFXyR7Y2x1c3RlclRleHR1cmVGb3JtYXR9XG4gICAgICAgICAgICAke0xpZ2h0c0J1ZmZlci5idWlsZFNoYWRlckRlZmluZXMoVGV4dHVyZUluZGV4OCwgJ0NMVVNURVJfVEVYVFVSRV84XycpfVxuICAgICAgICAgICAgJHtMaWdodHNCdWZmZXIuYnVpbGRTaGFkZXJEZWZpbmVzKFRleHR1cmVJbmRleEZsb2F0LCAnQ0xVU1RFUl9URVhUVVJFX0ZfJyl9XG4gICAgICAgIGA7XG4gICAgfVxuXG4gICAgLy8gY29udmVydHMgb2JqZWN0IHdpdGggcHJvcGVydGllcyB0byBhIGxpc3Qgb2YgdGhlc2UgYXMgYW4gZXhhbXBsZTogXCIjZGVmaW5lIENMVVNURVJfVEVYVFVSRV84X0JMQUggMS41XCJcbiAgICBzdGF0aWMgYnVpbGRTaGFkZXJEZWZpbmVzKG9iamVjdCwgcHJlZml4KSB7XG4gICAgICAgIGxldCBzdHIgPSAnJztcbiAgICAgICAgT2JqZWN0LmtleXMob2JqZWN0KS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgIHN0ciArPSBgXFxuI2RlZmluZSAke3ByZWZpeH0ke2tleX0gJHtvYmplY3Rba2V5XX0uNWA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIC8vIGV4ZWN1dGVzIHdoZW4gdGhlIGFwcCBzdGFydHNcbiAgICBzdGF0aWMgaW5pdChkZXZpY2UpIHtcblxuICAgICAgICAvLyBwcmVjaXNpb24gZm9yIHRleHR1cmUgc3RvcmFnZVxuICAgICAgICAvLyBkb24ndCB1c2UgZmxvYXQgdGV4dHVyZSBvbiBkZXZpY2VzIHdpdGggc21hbGwgbnVtYmVyIG9mIHRleHR1cmUgdW5pdHMgKGFzIGl0IHVzZXMgYm90aCBmbG9hdCBhbmQgOGJpdCB0ZXh0dXJlcyBhdCB0aGUgc2FtZSB0aW1lKVxuICAgICAgICBMaWdodHNCdWZmZXIubGlnaHRUZXh0dXJlRm9ybWF0ID0gKGRldmljZS5leHRUZXh0dXJlRmxvYXQgJiYgZGV2aWNlLm1heFRleHR1cmVzID4gOCkgPyBMaWdodHNCdWZmZXIuRk9STUFUX0ZMT0FUIDogTGlnaHRzQnVmZmVyLkZPUk1BVF84QklUO1xuXG4gICAgICAgIExpZ2h0c0J1ZmZlci5pbml0U2hhZGVyRGVmaW5lcygpO1xuICAgIH1cblxuICAgIHN0YXRpYyBjcmVhdGVUZXh0dXJlKGRldmljZSwgd2lkdGgsIGhlaWdodCwgZm9ybWF0LCBuYW1lKSB7XG4gICAgICAgIGNvbnN0IHRleCA9IG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICBmb3JtYXQ6IGZvcm1hdCxcbiAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgdHlwZTogVEVYVFVSRVRZUEVfREVGQVVMVCxcbiAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgYW5pc290cm9weTogMVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGV4O1xuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuXG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuXG4gICAgICAgIC8vIGZlYXR1cmVzXG4gICAgICAgIHRoaXMuY29va2llc0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5zaGFkb3dzRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmFyZWFMaWdodHNFbmFibGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gdXNpbmcgOCBiaXQgaW5kZXggc28gdGhpcyBpcyBtYXhpbXVtIHN1cHBvcnRlZCBudW1iZXIgb2YgbGlnaHRzXG4gICAgICAgIHRoaXMubWF4TGlnaHRzID0gMjU1O1xuXG4gICAgICAgIC8vIHNoYXJlZCA4Yml0IHRleHR1cmUgcGl4ZWxzOlxuICAgICAgICBsZXQgcGl4ZWxzUGVyTGlnaHQ4ID0gVGV4dHVyZUluZGV4OC5DT1VOVF9BTFdBWVM7XG4gICAgICAgIGxldCBwaXhlbHNQZXJMaWdodEZsb2F0ID0gMDtcblxuICAgICAgICAvLyBmbG9hdCB0ZXh0dXJlIGZvcm1hdFxuICAgICAgICBpZiAoTGlnaHRzQnVmZmVyLmxpZ2h0VGV4dHVyZUZvcm1hdCA9PT0gTGlnaHRzQnVmZmVyLkZPUk1BVF9GTE9BVCkge1xuICAgICAgICAgICAgcGl4ZWxzUGVyTGlnaHRGbG9hdCA9IFRleHR1cmVJbmRleEZsb2F0LkNPVU5UO1xuICAgICAgICB9IGVsc2UgeyAvLyA4Yml0IHRleHR1cmVcbiAgICAgICAgICAgIHBpeGVsc1BlckxpZ2h0OCA9IFRleHR1cmVJbmRleDguQ09VTlQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyA4Yml0IHRleHR1cmUgLSB0byBzdG9yZSBkYXRhIHRoYXQgY2FuIGZpdCBpbnRvIDhiaXRzIHRvIGxvd2VyIHRoZSBiYW5kd2lkdGggcmVxdWlyZW1lbnRzXG4gICAgICAgIHRoaXMubGlnaHRzOCA9IG5ldyBVaW50OENsYW1wZWRBcnJheSg0ICogcGl4ZWxzUGVyTGlnaHQ4ICogdGhpcy5tYXhMaWdodHMpO1xuICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmU4ID0gTGlnaHRzQnVmZmVyLmNyZWF0ZVRleHR1cmUodGhpcy5kZXZpY2UsIHBpeGVsc1BlckxpZ2h0OCwgdGhpcy5tYXhMaWdodHMsIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCAnTGlnaHRzVGV4dHVyZTgnKTtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZThJZCA9IHRoaXMuZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2xpZ2h0c1RleHR1cmU4Jyk7XG5cbiAgICAgICAgLy8gZmxvYXQgdGV4dHVyZVxuICAgICAgICBpZiAocGl4ZWxzUGVyTGlnaHRGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNGbG9hdCA9IG5ldyBGbG9hdDMyQXJyYXkoNCAqIHBpeGVsc1BlckxpZ2h0RmxvYXQgKiB0aGlzLm1heExpZ2h0cyk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdCA9IExpZ2h0c0J1ZmZlci5jcmVhdGVUZXh0dXJlKHRoaXMuZGV2aWNlLCBwaXhlbHNQZXJMaWdodEZsb2F0LCB0aGlzLm1heExpZ2h0cywgUElYRUxGT1JNQVRfUkdCQTMyRiwgJ0xpZ2h0c1RleHR1cmVGbG9hdCcpO1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUZsb2F0SWQgPSB0aGlzLmRldmljZS5zY29wZS5yZXNvbHZlKCdsaWdodHNUZXh0dXJlRmxvYXQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzRmxvYXQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUZsb2F0SWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnZlcnNlIHNpemVzIGZvciBib3RoIHRleHR1cmVzXG4gICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVJbnZTaXplSWQgPSB0aGlzLmRldmljZS5zY29wZS5yZXNvbHZlKCdsaWdodHNUZXh0dXJlSW52U2l6ZScpO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGFbMF0gPSBwaXhlbHNQZXJMaWdodEZsb2F0ID8gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlRmxvYXQud2lkdGggOiAwO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGFbMV0gPSBwaXhlbHNQZXJMaWdodEZsb2F0ID8gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlRmxvYXQuaGVpZ2h0IDogMDtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhWzJdID0gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlOC53aWR0aDtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhWzNdID0gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlOC5oZWlnaHQ7XG5cbiAgICAgICAgLy8gY29tcHJlc3Npb24gcmFuZ2VzXG4gICAgICAgIHRoaXMuaW52TWF4Q29sb3JWYWx1ZSA9IDA7XG4gICAgICAgIHRoaXMuaW52TWF4QXR0ZW51YXRpb24gPSAwO1xuICAgICAgICB0aGlzLmJvdW5kc01pbiA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMuYm91bmRzRGVsdGEgPSBuZXcgVmVjMygpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgLy8gcmVsZWFzZSB0ZXh0dXJlc1xuICAgICAgICBpZiAodGhpcy5saWdodHNUZXh0dXJlOCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmU4ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0Q29tcHJlc3Npb25SYW5nZXMobWF4QXR0ZW51YXRpb24sIG1heENvbG9yVmFsdWUpIHtcbiAgICAgICAgdGhpcy5pbnZNYXhDb2xvclZhbHVlID0gMSAvIG1heENvbG9yVmFsdWU7XG4gICAgICAgIHRoaXMuaW52TWF4QXR0ZW51YXRpb24gPSAxIC8gbWF4QXR0ZW51YXRpb247XG4gICAgfVxuXG4gICAgc2V0Qm91bmRzKG1pbiwgZGVsdGEpIHtcbiAgICAgICAgdGhpcy5ib3VuZHNNaW4uY29weShtaW4pO1xuICAgICAgICB0aGlzLmJvdW5kc0RlbHRhLmNvcHkoZGVsdGEpO1xuICAgIH1cblxuICAgIHVwbG9hZFRleHR1cmVzKCkge1xuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQubG9jaygpLnNldCh0aGlzLmxpZ2h0c0Zsb2F0KTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0LnVubG9jaygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOC5sb2NrKCkuc2V0KHRoaXMubGlnaHRzOCk7XG4gICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZTgudW5sb2NrKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlVW5pZm9ybXMoKSB7XG5cbiAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZThJZC5zZXRWYWx1ZSh0aGlzLmxpZ2h0c1RleHR1cmU4KTtcblxuICAgICAgICBpZiAoTGlnaHRzQnVmZmVyLmxpZ2h0VGV4dHVyZUZvcm1hdCA9PT0gTGlnaHRzQnVmZmVyLkZPUk1BVF9GTE9BVCkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUZsb2F0SWQuc2V0VmFsdWUodGhpcy5saWdodHNUZXh0dXJlRmxvYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVJZC5zZXRWYWx1ZSh0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGEpO1xuICAgIH1cblxuICAgIGdldFNwb3REaXJlY3Rpb24oZGlyZWN0aW9uLCBzcG90KSB7XG5cbiAgICAgICAgLy8gU3BvdHMgc2hpbmUgZG93biB0aGUgbmVnYXRpdmUgWSBheGlzXG4gICAgICAgIGNvbnN0IG1hdCA9IHNwb3QuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgbWF0LmdldFkoZGlyZWN0aW9uKS5tdWxTY2FsYXIoLTEpO1xuICAgICAgICBkaXJlY3Rpb24ubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLy8gaGFsZiBzaXplcyBvZiBhcmVhIGxpZ2h0IGluIHdvcmxkIHNwYWNlLCByZXR1cm5lZCBhcyBhbiBhcnJheSBvZiA2IGZsb2F0c1xuICAgIGdldExpZ2h0QXJlYVNpemVzKGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbWF0ID0gbGlnaHQuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBtYXQudHJhbnNmb3JtVmVjdG9yKGFyZWFIYWxmQXhpc1dpZHRoLCB0ZW1wVmVjMyk7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1swXSA9IHRlbXBWZWMzLng7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1sxXSA9IHRlbXBWZWMzLnk7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1syXSA9IHRlbXBWZWMzLno7XG5cbiAgICAgICAgbWF0LnRyYW5zZm9ybVZlY3RvcihhcmVhSGFsZkF4aXNIZWlnaHQsIHRlbXBWZWMzKTtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzNdID0gdGVtcFZlYzMueDtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzRdID0gdGVtcFZlYzMueTtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzVdID0gdGVtcFZlYzMuejtcblxuICAgICAgICByZXR1cm4gdGVtcEFyZWFMaWdodFNpemVzO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YUZsYWdzKGRhdGE4LCBpbmRleCwgbGlnaHQsIGlzU3BvdCwgY2FzdFNoYWRvd3MsIHNoYWRvd0ludGVuc2l0eSkge1xuICAgICAgICBkYXRhOFtpbmRleCArIDBdID0gaXNTcG90ID8gMjU1IDogMDtcbiAgICAgICAgZGF0YThbaW5kZXggKyAxXSA9IGxpZ2h0Ll9zaGFwZSAqIDY0OyAgICAgICAgICAgLy8gdmFsdWUgMC4uM1xuICAgICAgICBkYXRhOFtpbmRleCArIDJdID0gbGlnaHQuX2ZhbGxvZmZNb2RlICogMjU1OyAgICAvLyB2YWx1ZSAwLi4xXG4gICAgICAgIGRhdGE4W2luZGV4ICsgM10gPSBjYXN0U2hhZG93cyA/IHNoYWRvd0ludGVuc2l0eSAqIDI1NSA6IDA7XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhQ29sb3IoZGF0YTgsIGluZGV4LCBsaWdodCwgZ2FtbWFDb3JyZWN0aW9uLCBpc0Nvb2tpZSkge1xuICAgICAgICBjb25zdCBpbnZNYXhDb2xvclZhbHVlID0gdGhpcy5pbnZNYXhDb2xvclZhbHVlO1xuICAgICAgICBjb25zdCBjb2xvciA9IGdhbW1hQ29ycmVjdGlvbiA/IGxpZ2h0Ll9saW5lYXJGaW5hbENvbG9yIDogbGlnaHQuX2ZpbmFsQ29sb3I7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhjb2xvclswXSAqIGludk1heENvbG9yVmFsdWUsIGRhdGE4LCBpbmRleCArIDAsIDIpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoY29sb3JbMV0gKiBpbnZNYXhDb2xvclZhbHVlLCBkYXRhOCwgaW5kZXggKyAyLCAyKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGNvbG9yWzJdICogaW52TWF4Q29sb3JWYWx1ZSwgZGF0YTgsIGluZGV4ICsgNCwgMik7XG5cbiAgICAgICAgLy8gY29va2llXG4gICAgICAgIGRhdGE4W2luZGV4ICsgNl0gPSBpc0Nvb2tpZSA/IDI1NSA6IDA7XG5cbiAgICAgICAgLy8gbGlnaHRNYXNrXG4gICAgICAgIC8vIDA6IE1BU0tfQUZGRUNUX0RZTkFNSUNcbiAgICAgICAgLy8gMTI3OiBNQVNLX0FGRkVDVF9EWU5BTUlDICYmIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEXG4gICAgICAgIC8vIDI1NTogTUFTS19BRkZFQ1RfTElHSFRNQVBQRURcbiAgICAgICAgY29uc3QgaXNEeW5hbWljID0gISEobGlnaHQubWFzayAmIE1BU0tfQUZGRUNUX0RZTkFNSUMpO1xuICAgICAgICBjb25zdCBpc0xpZ2h0bWFwcGVkID0gISEobGlnaHQubWFzayAmIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKTtcbiAgICAgICAgZGF0YThbaW5kZXggKyA3XSA9IChpc0R5bmFtaWMgJiYgaXNMaWdodG1hcHBlZCkgPyAxMjcgOiAoaXNMaWdodG1hcHBlZCA/IDI1NSA6IDApO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YVNwb3RBbmdsZXMoZGF0YTgsIGluZGV4LCBsaWdodCkge1xuICAgICAgICAvLyAyIGJ5dGVzIGVhY2hcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGxpZ2h0Ll9pbm5lckNvbmVBbmdsZUNvcyAqICgwLjUgLSBlcHNpbG9uKSArIDAuNSwgZGF0YTgsIGluZGV4ICsgMCwgMik7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhsaWdodC5fb3V0ZXJDb25lQW5nbGVDb3MgKiAoMC41IC0gZXBzaWxvbikgKyAwLjUsIGRhdGE4LCBpbmRleCArIDIsIDIpO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YVNoYWRvd0JpYXMoZGF0YTgsIGluZGV4LCBsaWdodCkge1xuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKG51bGwsIDApO1xuICAgICAgICBjb25zdCBiaWFzZXMgPSBsaWdodC5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzUmFuZ2UoYmlhc2VzLmJpYXMsIGRhdGE4LCBpbmRleCwgLTEsIDIwLCAyKTsgIC8vIGJpYXM6IC0xIHRvIDIwIHJhbmdlXG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhiaWFzZXMubm9ybWFsQmlhcywgZGF0YTgsIGluZGV4ICsgMiwgMik7ICAgICAvLyBub3JtYWxCaWFzOiAwIHRvIDEgcmFuZ2VcbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFQb3NpdGlvblJhbmdlKGRhdGE4LCBpbmRleCwgbGlnaHQsIHBvcykge1xuICAgICAgICAvLyBwb3NpdGlvbiBhbmQgcmFuZ2Ugc2NhbGVkIHRvIDAuLjEgcmFuZ2VcbiAgICAgICAgY29uc3Qgbm9ybVBvcyA9IHRlbXBWZWMzLnN1YjIocG9zLCB0aGlzLmJvdW5kc01pbikuZGl2KHRoaXMuYm91bmRzRGVsdGEpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMobm9ybVBvcy54LCBkYXRhOCwgaW5kZXggKyAwLCA0KTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKG5vcm1Qb3MueSwgZGF0YTgsIGluZGV4ICsgNCwgNCk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhub3JtUG9zLnosIGRhdGE4LCBpbmRleCArIDgsIDQpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMobGlnaHQuYXR0ZW51YXRpb25FbmQgKiB0aGlzLmludk1heEF0dGVudWF0aW9uLCBkYXRhOCwgaW5kZXggKyAxMiwgNCk7XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhU3BvdERpcmVjdGlvbihkYXRhOCwgaW5kZXgsIGxpZ2h0KSB7XG4gICAgICAgIHRoaXMuZ2V0U3BvdERpcmVjdGlvbih0ZW1wVmVjMywgbGlnaHQpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXModGVtcFZlYzMueCAqICgwLjUgLSBlcHNpbG9uKSArIDAuNSwgZGF0YTgsIGluZGV4ICsgMCwgNCk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyh0ZW1wVmVjMy55ICogKDAuNSAtIGVwc2lsb24pICsgMC41LCBkYXRhOCwgaW5kZXggKyA0LCA0KTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKHRlbXBWZWMzLnogKiAoMC41IC0gZXBzaWxvbikgKyAwLjUsIGRhdGE4LCBpbmRleCArIDgsIDQpO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YUxpZ2h0UHJvak1hdHJpeChkYXRhOCwgaW5kZXgsIGxpZ2h0UHJvamVjdGlvbk1hdHJpeCkge1xuICAgICAgICBjb25zdCBtYXREYXRhID0gbGlnaHRQcm9qZWN0aW9uTWF0cml4LmRhdGE7XG4gICAgICAgIGZvciAobGV0IG0gPSAwOyBtIDwgMTI7IG0rKykgICAgLy8gdGhlc2UgYXJlIGluIC0yLi4yIHJhbmdlXG4gICAgICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXNSYW5nZShtYXREYXRhW21dLCBkYXRhOCwgaW5kZXggKyA0ICogbSwgLTIsIDIsIDQpO1xuICAgICAgICBmb3IgKGxldCBtID0gMTI7IG0gPCAxNjsgbSsrKSB7ICAvLyB0aGVzZSBhcmUgZnVsbCBmbG9hdCByYW5nZVxuICAgICAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0Mk1hbnRpc3NhRXhwb25lbnQobWF0RGF0YVttXSwgZGF0YTgsIGluZGV4ICsgNCAqIG0sIDQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhQ29va2llcyhkYXRhOCwgaW5kZXgsIGxpZ2h0KSB7XG4gICAgICAgIGNvbnN0IGlzUmdiID0gbGlnaHQuX2Nvb2tpZUNoYW5uZWwgPT09ICdyZ2InO1xuICAgICAgICBkYXRhOFtpbmRleCArIDBdID0gTWF0aC5mbG9vcihsaWdodC5jb29raWVJbnRlbnNpdHkgKiAyNTUpO1xuICAgICAgICBkYXRhOFtpbmRleCArIDFdID0gaXNSZ2IgPyAyNTUgOiAwO1xuICAgICAgICAvLyB3ZSBoYXZlIHR3byB1bnVzZWQgYnl0ZXMgaGVyZVxuXG4gICAgICAgIGlmICghaXNSZ2IpIHtcbiAgICAgICAgICAgIGNvbnN0IGNoYW5uZWwgPSBsaWdodC5fY29va2llQ2hhbm5lbDtcbiAgICAgICAgICAgIGRhdGE4W2luZGV4ICsgNF0gPSBjaGFubmVsID09PSAncnJyJyA/IDI1NSA6IDA7XG4gICAgICAgICAgICBkYXRhOFtpbmRleCArIDVdID0gY2hhbm5lbCA9PT0gJ2dnZycgPyAyNTUgOiAwO1xuICAgICAgICAgICAgZGF0YThbaW5kZXggKyA2XSA9IGNoYW5uZWwgPT09ICdiYmInID8gMjU1IDogMDtcbiAgICAgICAgICAgIGRhdGE4W2luZGV4ICsgN10gPSBjaGFubmVsID09PSAnYWFhJyA/IDI1NSA6IDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRMaWdodEF0bGFzVmlld3BvcnQoZGF0YTgsIGluZGV4LCBhdGxhc1ZpZXdwb3J0KSB7XG4gICAgICAgIC8vIGFsbCB0aGVzZSBhcmUgaW4gMC4uMSByYW5nZVxuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoYXRsYXNWaWV3cG9ydC54LCBkYXRhOCwgaW5kZXggKyAwLCAyKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGF0bGFzVmlld3BvcnQueSwgZGF0YTgsIGluZGV4ICsgMiwgMik7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhhdGxhc1ZpZXdwb3J0LnogLyAzLCBkYXRhOCwgaW5kZXggKyA0LCAyKTtcbiAgICAgICAgLy8gd2UgaGF2ZSB0d28gdW51c2VkIGJ5dGVzIGhlcmVcbiAgICB9XG5cbiAgICBhZGRMaWdodEFyZWFTaXplcyhkYXRhOCwgaW5kZXgsIGxpZ2h0KSB7XG4gICAgICAgIGNvbnN0IGFyZWFTaXplcyA9IHRoaXMuZ2V0TGlnaHRBcmVhU2l6ZXMobGlnaHQpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykgeyAgLy8gdGhlc2UgYXJlIGZ1bGwgZmxvYXQgcmFuZ2VcbiAgICAgICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJNYW50aXNzYUV4cG9uZW50KGFyZWFTaXplc1tpXSwgZGF0YTgsIGluZGV4ICsgNCAqIGksIDQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZmlsbCB1cCBib3RoIGZsb2F0IGFuZCA4Yml0IHRleHR1cmUgZGF0YSB3aXRoIGxpZ2h0IHByb3BlcnRpZXNcbiAgICBhZGRMaWdodERhdGEobGlnaHQsIGxpZ2h0SW5kZXgsIGdhbW1hQ29ycmVjdGlvbikge1xuXG4gICAgICAgIGNvbnN0IGlzU3BvdCA9IGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVDtcbiAgICAgICAgY29uc3QgaGFzQXRsYXNWaWV3cG9ydCA9IGxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQ7IC8vIGlmIHRoZSBsaWdodCBkb2VzIG5vdCBoYXZlIHZpZXdwb3J0LCBpdCBkb2VzIG5vdCBmaXQgdG8gdGhlIGF0bGFzXG4gICAgICAgIGNvbnN0IGlzQ29va2llID0gdGhpcy5jb29raWVzRW5hYmxlZCAmJiAhIWxpZ2h0Ll9jb29raWUgJiYgaGFzQXRsYXNWaWV3cG9ydDtcbiAgICAgICAgY29uc3QgaXNBcmVhID0gdGhpcy5hcmVhTGlnaHRzRW5hYmxlZCAmJiBsaWdodC5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTDtcbiAgICAgICAgY29uc3QgY2FzdFNoYWRvd3MgPSB0aGlzLnNoYWRvd3NFbmFibGVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGhhc0F0bGFzVmlld3BvcnQ7XG4gICAgICAgIGNvbnN0IHBvcyA9IGxpZ2h0Ll9ub2RlLmdldFBvc2l0aW9uKCk7XG5cbiAgICAgICAgbGV0IGxpZ2h0UHJvamVjdGlvbk1hdHJpeCA9IG51bGw7ICAgLy8gbGlnaHQgcHJvamVjdGlvbiBtYXRyaXggLSB1c2VkIGZvciBzaGFkb3cgbWFwIGFuZCBjb29raWUgb2Ygc3BvdCBsaWdodFxuICAgICAgICBsZXQgYXRsYXNWaWV3cG9ydCA9IG51bGw7ICAgLy8gYXRsYXMgdmlld3BvcnQgaW5mbyAtIHVzZWQgZm9yIHNoYWRvdyBtYXAgYW5kIGNvb2tpZSBvZiBvbW5pIGxpZ2h0XG4gICAgICAgIGlmIChpc1Nwb3QpIHtcbiAgICAgICAgICAgIGlmIChjYXN0U2hhZG93cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICAgICAgbGlnaHRQcm9qZWN0aW9uTWF0cml4ID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNDb29raWUpIHtcbiAgICAgICAgICAgICAgICBsaWdodFByb2plY3Rpb25NYXRyaXggPSBMaWdodENhbWVyYS5ldmFsU3BvdENvb2tpZU1hdHJpeChsaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoY2FzdFNoYWRvd3MgfHwgaXNDb29raWUpIHtcbiAgICAgICAgICAgICAgICBhdGxhc1ZpZXdwb3J0ID0gbGlnaHQuYXRsYXNWaWV3cG9ydDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRhdGEgYWx3YXlzIHN0b3JlZCBpbiA4Yml0IHRleHR1cmVcbiAgICAgICAgY29uc3QgZGF0YTggPSB0aGlzLmxpZ2h0czg7XG4gICAgICAgIGNvbnN0IGRhdGE4U3RhcnQgPSBsaWdodEluZGV4ICogdGhpcy5saWdodHNUZXh0dXJlOC53aWR0aCAqIDQ7XG5cbiAgICAgICAgLy8gZmxhZ3NcbiAgICAgICAgdGhpcy5hZGRMaWdodERhdGFGbGFncyhkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LkZMQUdTLCBsaWdodCwgaXNTcG90LCBjYXN0U2hhZG93cywgbGlnaHQuc2hhZG93SW50ZW5zaXR5KTtcblxuICAgICAgICAvLyBsaWdodCBjb2xvclxuICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YUNvbG9yKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguQ09MT1JfQSwgbGlnaHQsIGdhbW1hQ29ycmVjdGlvbiwgaXNDb29raWUpO1xuXG4gICAgICAgIC8vIHNwb3QgbGlnaHQgYW5nbGVzXG4gICAgICAgIGlmIChpc1Nwb3QpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhU3BvdEFuZ2xlcyhkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlNQT1RfQU5HTEVTLCBsaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzaGFkb3cgYmlhc2VzXG4gICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cykge1xuICAgICAgICAgICAgdGhpcy5hZGRMaWdodERhdGFTaGFkb3dCaWFzKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguU0hBRE9XX0JJQVMsIGxpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvb2tpZSBwcm9wZXJ0aWVzXG4gICAgICAgIGlmIChpc0Nvb2tpZSkge1xuICAgICAgICAgICAgdGhpcy5hZGRMaWdodERhdGFDb29raWVzKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguQ09PS0lFX0EsIGxpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhpZ2ggcHJlY2lzaW9uIGRhdGEgc3RvcmVkIHVzaW5nIGZsb2F0IHRleHR1cmVcbiAgICAgICAgaWYgKExpZ2h0c0J1ZmZlci5saWdodFRleHR1cmVGb3JtYXQgPT09IExpZ2h0c0J1ZmZlci5GT1JNQVRfRkxPQVQpIHtcblxuICAgICAgICAgICAgY29uc3QgZGF0YUZsb2F0ID0gdGhpcy5saWdodHNGbG9hdDtcbiAgICAgICAgICAgIGNvbnN0IGRhdGFGbG9hdFN0YXJ0ID0gbGlnaHRJbmRleCAqIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0LndpZHRoICogNDtcblxuICAgICAgICAgICAgLy8gcG9zIGFuZCByYW5nZVxuICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlBPU0lUSU9OX1JBTkdFICsgMF0gPSBwb3MueDtcbiAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5QT1NJVElPTl9SQU5HRSArIDFdID0gcG9zLnk7XG4gICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuUE9TSVRJT05fUkFOR0UgKyAyXSA9IHBvcy56O1xuICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlBPU0lUSU9OX1JBTkdFICsgM10gPSBsaWdodC5hdHRlbnVhdGlvbkVuZDtcblxuICAgICAgICAgICAgLy8gc3BvdCBkaXJlY3Rpb25cbiAgICAgICAgICAgIGlmIChpc1Nwb3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNwb3REaXJlY3Rpb24odGVtcFZlYzMsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuU1BPVF9ESVJFQ1RJT04gKyAwXSA9IHRlbXBWZWMzLng7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlNQT1RfRElSRUNUSU9OICsgMV0gPSB0ZW1wVmVjMy55O1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5TUE9UX0RJUkVDVElPTiArIDJdID0gdGVtcFZlYzMuejtcbiAgICAgICAgICAgICAgICAvLyBoZXJlIHdlIGhhdmUgdW51c2VkIGZsb2F0XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4XG4gICAgICAgICAgICBpZiAobGlnaHRQcm9qZWN0aW9uTWF0cml4KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0RGF0YSA9IGxpZ2h0UHJvamVjdGlvbk1hdHJpeC5kYXRhO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IG0gPSAwOyBtIDwgMTY7IG0rKylcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlBST0pfTUFUXzAgKyBtXSA9IG1hdERhdGFbbV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhdGxhc1ZpZXdwb3J0KSB7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFUTEFTX1ZJRVdQT1JUICsgMF0gPSBhdGxhc1ZpZXdwb3J0Lng7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFUTEFTX1ZJRVdQT1JUICsgMV0gPSBhdGxhc1ZpZXdwb3J0Lnk7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFUTEFTX1ZJRVdQT1JUICsgMl0gPSBhdGxhc1ZpZXdwb3J0LnogLyAzOyAvLyBzaXplIG9mIGEgZmFjZSBzbG90ICgzeDMgZ3JpZClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXJlYSBsaWdodCBzaXplc1xuICAgICAgICAgICAgaWYgKGlzQXJlYSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFyZWFTaXplcyA9IHRoaXMuZ2V0TGlnaHRBcmVhU2l6ZXMobGlnaHQpO1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BUkVBX0RBVEFfV0lEVEggKyAwXSA9IGFyZWFTaXplc1swXTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVJFQV9EQVRBX1dJRFRIICsgMV0gPSBhcmVhU2l6ZXNbMV07XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFSRUFfREFUQV9XSURUSCArIDJdID0gYXJlYVNpemVzWzJdO1xuXG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFSRUFfREFUQV9IRUlHSFQgKyAwXSA9IGFyZWFTaXplc1szXTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVJFQV9EQVRBX0hFSUdIVCArIDFdID0gYXJlYVNpemVzWzRdO1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BUkVBX0RBVEFfSEVJR0hUICsgMl0gPSBhcmVhU2l6ZXNbNV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHsgICAgLy8gaGlnaCBwcmVjaXNpb24gZGF0YSBzdG9yZWQgdXNpbmcgOGJpdCB0ZXh0dXJlXG5cbiAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhUG9zaXRpb25SYW5nZShkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlBPU0lUSU9OX1gsIGxpZ2h0LCBwb3MpO1xuXG4gICAgICAgICAgICAvLyBzcG90IGRpcmVjdGlvblxuICAgICAgICAgICAgaWYgKGlzU3BvdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhU3BvdERpcmVjdGlvbihkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlNQT1RfRElSRUNUSU9OX1gsIGxpZ2h0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbGlnaHQgcHJvamVjdGlvbiBtYXRyaXhcbiAgICAgICAgICAgIGlmIChsaWdodFByb2plY3Rpb25NYXRyaXgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YUxpZ2h0UHJvak1hdHJpeChkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlBST0pfTUFUXzAwLCBsaWdodFByb2plY3Rpb25NYXRyaXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXRsYXNWaWV3cG9ydCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTGlnaHRBdGxhc1ZpZXdwb3J0KGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguQVRMQVNfVklFV1BPUlRfQSwgYXRsYXNWaWV3cG9ydCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgc2l6ZXNcbiAgICAgICAgICAgIGlmIChpc0FyZWEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExpZ2h0QXJlYVNpemVzKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguQVJFQV9EQVRBX1dJRFRIX1gsIGxpZ2h0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHRzQnVmZmVyIH07XG4iXSwibmFtZXMiOlsiZXBzaWxvbiIsInRlbXBWZWMzIiwiVmVjMyIsInRlbXBBcmVhTGlnaHRTaXplcyIsIkZsb2F0MzJBcnJheSIsImFyZWFIYWxmQXhpc1dpZHRoIiwiYXJlYUhhbGZBeGlzSGVpZ2h0IiwiVGV4dHVyZUluZGV4OCIsIkZMQUdTIiwiQ09MT1JfQSIsIkNPTE9SX0IiLCJTUE9UX0FOR0xFUyIsIlNIQURPV19CSUFTIiwiQ09PS0lFX0EiLCJDT09LSUVfQiIsIkNPVU5UX0FMV0FZUyIsIlBPU0lUSU9OX1giLCJQT1NJVElPTl9ZIiwiUE9TSVRJT05fWiIsIlJBTkdFIiwiU1BPVF9ESVJFQ1RJT05fWCIsIlNQT1RfRElSRUNUSU9OX1kiLCJTUE9UX0RJUkVDVElPTl9aIiwiUFJPSl9NQVRfMDAiLCJBVExBU19WSUVXUE9SVF9BIiwiUFJPSl9NQVRfMDEiLCJBVExBU19WSUVXUE9SVF9CIiwiUFJPSl9NQVRfMDIiLCJQUk9KX01BVF8wMyIsIlBST0pfTUFUXzEwIiwiUFJPSl9NQVRfMTEiLCJQUk9KX01BVF8xMiIsIlBST0pfTUFUXzEzIiwiUFJPSl9NQVRfMjAiLCJQUk9KX01BVF8yMSIsIlBST0pfTUFUXzIyIiwiUFJPSl9NQVRfMjMiLCJQUk9KX01BVF8zMCIsIlBST0pfTUFUXzMxIiwiUFJPSl9NQVRfMzIiLCJQUk9KX01BVF8zMyIsIkFSRUFfREFUQV9XSURUSF9YIiwiQVJFQV9EQVRBX1dJRFRIX1kiLCJBUkVBX0RBVEFfV0lEVEhfWiIsIkFSRUFfREFUQV9IRUlHSFRfWCIsIkFSRUFfREFUQV9IRUlHSFRfWSIsIkFSRUFfREFUQV9IRUlHSFRfWiIsIkNPVU5UIiwiVGV4dHVyZUluZGV4RmxvYXQiLCJQT1NJVElPTl9SQU5HRSIsIlNQT1RfRElSRUNUSU9OIiwiUFJPSl9NQVRfMCIsIkFUTEFTX1ZJRVdQT1JUIiwiUFJPSl9NQVRfMSIsIlBST0pfTUFUXzIiLCJQUk9KX01BVF8zIiwiQVJFQV9EQVRBX1dJRFRIIiwiQVJFQV9EQVRBX0hFSUdIVCIsIkxpZ2h0c0J1ZmZlciIsImluaXRTaGFkZXJEZWZpbmVzIiwiY2x1c3RlclRleHR1cmVGb3JtYXQiLCJsaWdodFRleHR1cmVGb3JtYXQiLCJGT1JNQVRfRkxPQVQiLCJzaGFkZXJEZWZpbmVzIiwiYnVpbGRTaGFkZXJEZWZpbmVzIiwib2JqZWN0IiwicHJlZml4Iiwic3RyIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJrZXkiLCJpbml0IiwiZGV2aWNlIiwiZXh0VGV4dHVyZUZsb2F0IiwibWF4VGV4dHVyZXMiLCJGT1JNQVRfOEJJVCIsImNyZWF0ZVRleHR1cmUiLCJ3aWR0aCIsImhlaWdodCIsImZvcm1hdCIsIm5hbWUiLCJ0ZXgiLCJUZXh0dXJlIiwibWlwbWFwcyIsImFkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiYWRkcmVzc1YiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsIm1hZ0ZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWluRmlsdGVyIiwiYW5pc290cm9weSIsImNvbnN0cnVjdG9yIiwiY29va2llc0VuYWJsZWQiLCJzaGFkb3dzRW5hYmxlZCIsImFyZWFMaWdodHNFbmFibGVkIiwibWF4TGlnaHRzIiwicGl4ZWxzUGVyTGlnaHQ4IiwicGl4ZWxzUGVyTGlnaHRGbG9hdCIsImxpZ2h0czgiLCJVaW50OENsYW1wZWRBcnJheSIsImxpZ2h0c1RleHR1cmU4IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJfbGlnaHRzVGV4dHVyZThJZCIsInNjb3BlIiwicmVzb2x2ZSIsImxpZ2h0c0Zsb2F0IiwibGlnaHRzVGV4dHVyZUZsb2F0IiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIl9saWdodHNUZXh0dXJlRmxvYXRJZCIsInVuZGVmaW5lZCIsIl9saWdodHNUZXh0dXJlSW52U2l6ZUlkIiwiX2xpZ2h0c1RleHR1cmVJbnZTaXplRGF0YSIsImludk1heENvbG9yVmFsdWUiLCJpbnZNYXhBdHRlbnVhdGlvbiIsImJvdW5kc01pbiIsImJvdW5kc0RlbHRhIiwiZGVzdHJveSIsInNldENvbXByZXNzaW9uUmFuZ2VzIiwibWF4QXR0ZW51YXRpb24iLCJtYXhDb2xvclZhbHVlIiwic2V0Qm91bmRzIiwibWluIiwiZGVsdGEiLCJjb3B5IiwidXBsb2FkVGV4dHVyZXMiLCJsb2NrIiwic2V0IiwidW5sb2NrIiwidXBkYXRlVW5pZm9ybXMiLCJzZXRWYWx1ZSIsImdldFNwb3REaXJlY3Rpb24iLCJkaXJlY3Rpb24iLCJzcG90IiwibWF0IiwiX25vZGUiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImdldFkiLCJtdWxTY2FsYXIiLCJub3JtYWxpemUiLCJnZXRMaWdodEFyZWFTaXplcyIsImxpZ2h0IiwidHJhbnNmb3JtVmVjdG9yIiwieCIsInkiLCJ6IiwiYWRkTGlnaHREYXRhRmxhZ3MiLCJkYXRhOCIsImluZGV4IiwiaXNTcG90IiwiY2FzdFNoYWRvd3MiLCJzaGFkb3dJbnRlbnNpdHkiLCJfc2hhcGUiLCJfZmFsbG9mZk1vZGUiLCJhZGRMaWdodERhdGFDb2xvciIsImdhbW1hQ29ycmVjdGlvbiIsImlzQ29va2llIiwiY29sb3IiLCJfbGluZWFyRmluYWxDb2xvciIsIl9maW5hbENvbG9yIiwiRmxvYXRQYWNraW5nIiwiZmxvYXQyQnl0ZXMiLCJpc0R5bmFtaWMiLCJtYXNrIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsImlzTGlnaHRtYXBwZWQiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsImFkZExpZ2h0RGF0YVNwb3RBbmdsZXMiLCJfaW5uZXJDb25lQW5nbGVDb3MiLCJfb3V0ZXJDb25lQW5nbGVDb3MiLCJhZGRMaWdodERhdGFTaGFkb3dCaWFzIiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsImJpYXNlcyIsIl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyIsImZsb2F0MkJ5dGVzUmFuZ2UiLCJiaWFzIiwibm9ybWFsQmlhcyIsImFkZExpZ2h0RGF0YVBvc2l0aW9uUmFuZ2UiLCJwb3MiLCJub3JtUG9zIiwic3ViMiIsImRpdiIsImF0dGVudWF0aW9uRW5kIiwiYWRkTGlnaHREYXRhU3BvdERpcmVjdGlvbiIsImFkZExpZ2h0RGF0YUxpZ2h0UHJvak1hdHJpeCIsImxpZ2h0UHJvamVjdGlvbk1hdHJpeCIsIm1hdERhdGEiLCJkYXRhIiwibSIsImZsb2F0Mk1hbnRpc3NhRXhwb25lbnQiLCJhZGRMaWdodERhdGFDb29raWVzIiwiaXNSZ2IiLCJfY29va2llQ2hhbm5lbCIsIk1hdGgiLCJmbG9vciIsImNvb2tpZUludGVuc2l0eSIsImNoYW5uZWwiLCJhZGRMaWdodEF0bGFzVmlld3BvcnQiLCJhdGxhc1ZpZXdwb3J0IiwiYWRkTGlnaHRBcmVhU2l6ZXMiLCJhcmVhU2l6ZXMiLCJpIiwiYWRkTGlnaHREYXRhIiwibGlnaHRJbmRleCIsIl90eXBlIiwiTElHSFRUWVBFX1NQT1QiLCJoYXNBdGxhc1ZpZXdwb3J0IiwiYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCIsIl9jb29raWUiLCJpc0FyZWEiLCJzaGFwZSIsIkxJR0hUU0hBUEVfUFVOQ1RVQUwiLCJnZXRQb3NpdGlvbiIsInNoYWRvd01hdHJpeCIsIkxpZ2h0Q2FtZXJhIiwiZXZhbFNwb3RDb29raWVNYXRyaXgiLCJkYXRhOFN0YXJ0IiwiZGF0YUZsb2F0IiwiZGF0YUZsb2F0U3RhcnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQU9BLE1BQU1BLE9BQU8sR0FBRyxRQUFoQixDQUFBO0FBRUEsTUFBTUMsUUFBUSxHQUFHLElBQUlDLElBQUosRUFBakIsQ0FBQTtBQUNBLE1BQU1DLGtCQUFrQixHQUFHLElBQUlDLFlBQUosQ0FBaUIsQ0FBakIsQ0FBM0IsQ0FBQTtBQUNBLE1BQU1DLGlCQUFpQixHQUFHLElBQUlILElBQUosQ0FBUyxDQUFDLEdBQVYsRUFBZSxDQUFmLEVBQWtCLENBQWxCLENBQTFCLENBQUE7QUFDQSxNQUFNSSxrQkFBa0IsR0FBRyxJQUFJSixJQUFKLENBQVMsQ0FBVCxFQUFZLENBQVosRUFBZSxHQUFmLENBQTNCLENBQUE7QUFJQSxNQUFNSyxhQUFhLEdBQUc7QUFHbEJDLEVBQUFBLEtBQUssRUFBRSxDQUhXO0FBSWxCQyxFQUFBQSxPQUFPLEVBQUUsQ0FKUztBQUtsQkMsRUFBQUEsT0FBTyxFQUFFLENBTFM7QUFNbEJDLEVBQUFBLFdBQVcsRUFBRSxDQU5LO0FBT2xCQyxFQUFBQSxXQUFXLEVBQUUsQ0FQSztBQVFsQkMsRUFBQUEsUUFBUSxFQUFFLENBUlE7QUFTbEJDLEVBQUFBLFFBQVEsRUFBRSxDQVRRO0FBWWxCQyxFQUFBQSxZQUFZLEVBQUUsQ0FaSTtBQWVsQkMsRUFBQUEsVUFBVSxFQUFFLENBZk07QUFnQmxCQyxFQUFBQSxVQUFVLEVBQUUsQ0FoQk07QUFpQmxCQyxFQUFBQSxVQUFVLEVBQUUsQ0FqQk07QUFrQmxCQyxFQUFBQSxLQUFLLEVBQUUsRUFsQlc7QUFtQmxCQyxFQUFBQSxnQkFBZ0IsRUFBRSxFQW5CQTtBQW9CbEJDLEVBQUFBLGdCQUFnQixFQUFFLEVBcEJBO0FBcUJsQkMsRUFBQUEsZ0JBQWdCLEVBQUUsRUFyQkE7QUF1QmxCQyxFQUFBQSxXQUFXLEVB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
