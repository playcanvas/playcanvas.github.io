/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
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
    for (let m = 0; m < 12; m++)
    FloatPacking.float2BytesRange(matData[m], data8, index + 4 * m, -2, 2, 4);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRzLWJ1ZmZlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFBJWEVMRk9STUFUX1JHQkE4LCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBBRERSRVNTX0NMQU1QX1RPX0VER0UsIFRFWFRVUkVUWVBFX0RFRkFVTFQsIEZJTFRFUl9ORUFSRVNUIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEZsb2F0UGFja2luZyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9mbG9hdC1wYWNraW5nLmpzJztcbmltcG9ydCB7IExJR0hUU0hBUEVfUFVOQ1RVQUwsIExJR0hUVFlQRV9TUE9ULCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCwgTUFTS19BRkZFQ1RfRFlOQU1JQyB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBMaWdodENhbWVyYSB9IGZyb20gJy4uL3JlbmRlcmVyL2xpZ2h0LWNhbWVyYS5qcyc7XG5cbmNvbnN0IGVwc2lsb24gPSAwLjAwMDAwMTtcblxuY29uc3QgdGVtcFZlYzMgPSBuZXcgVmVjMygpO1xuY29uc3QgdGVtcEFyZWFMaWdodFNpemVzID0gbmV3IEZsb2F0MzJBcnJheSg2KTtcbmNvbnN0IGFyZWFIYWxmQXhpc1dpZHRoID0gbmV3IFZlYzMoLTAuNSwgMCwgMCk7XG5jb25zdCBhcmVhSGFsZkF4aXNIZWlnaHQgPSBuZXcgVmVjMygwLCAwLCAwLjUpO1xuXG4vLyBmb3JtYXQgb2YgYSByb3cgaW4gOCBiaXQgdGV4dHVyZSB1c2VkIHRvIGVuY29kZSBsaWdodCBkYXRhXG4vLyB0aGlzIGlzIHVzZWQgdG8gc3RvcmUgZGF0YSBpbiB0aGUgdGV4dHVyZSBjb3JyZWN0bHksIGFuZCBhbHNvIHVzZSB0byBnZW5lcmF0ZSBkZWZpbmVzIGZvciB0aGUgc2hhZGVyXG5jb25zdCBUZXh0dXJlSW5kZXg4ID0ge1xuXG4gICAgLy8gYWx3YXlzIDhiaXQgdGV4dHVyZSBkYXRhLCByZWdhcmRsZXNzIG9mIGZsb2F0IHRleHR1cmUgc3VwcG9ydFxuICAgIEZMQUdTOiAwLCAgICAgICAgICAgICAgICAgICAvLyBsaWdodFR5cGUsIGxpZ2h0U2hhcGUsIGZhbGxvZk1vZGUsIGNhc3RTaGFkb3dzXG4gICAgQ09MT1JfQTogMSwgICAgICAgICAgICAgICAgIC8vIGNvbG9yLnIsIGNvbG9yLnIsIGNvbG9yLmcsIGNvbG9yLmcgICAgLy8gSERSIGNvbG9yIGlzIHN0b3JlZCB1c2luZyAyIGJ5dGVzIHBlciBjaGFubmVsXG4gICAgQ09MT1JfQjogMiwgICAgICAgICAgICAgICAgIC8vIGNvbG9yLmIsIGNvbG9yLmIsIHVzZUNvb2tpZSwgbGlnaHRNYXNrXG4gICAgU1BPVF9BTkdMRVM6IDMsICAgICAgICAgICAgIC8vIHNwb3RJbm5lciwgc3BvdElubmVyLCBzcG90T3V0ZXIsIHNwb3RPdXRlclxuICAgIFNIQURPV19CSUFTOiA0LCAgICAgICAgICAgICAvLyBiaWFzLCBiaWFzLCBub3JtYWxCaWFzLCBub3JtYWxCaWFzXG4gICAgQ09PS0lFX0E6IDUsICAgICAgICAgICAgICAgIC8vIGNvb2tpZUludGVuc2l0eSwgY29va2llSXNSZ2IsIC0sIC1cbiAgICBDT09LSUVfQjogNiwgICAgICAgICAgICAgICAgLy8gY29va2llQ2hhbm5lbE1hc2sueHl6d1xuXG4gICAgLy8gbGVhdmUgaW4tYmV0d2VlblxuICAgIENPVU5UX0FMV0FZUzogNyxcblxuICAgIC8vIDhiaXQgdGV4dHVyZSBkYXRhIHVzZWQgd2hlbiBmbG9hdCB0ZXh0dXJlIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICBQT1NJVElPTl9YOiA3LCAgICAgICAgICAgICAgLy8gcG9zaXRpb24ueFxuICAgIFBPU0lUSU9OX1k6IDgsICAgICAgICAgICAgICAvLyBwb3NpdGlvbi55XG4gICAgUE9TSVRJT05fWjogOSwgICAgICAgICAgICAgIC8vIHBvc2l0aW9uLnpcbiAgICBSQU5HRTogMTAsICAgICAgICAgICAgICAgICAgLy8gcmFuZ2VcbiAgICBTUE9UX0RJUkVDVElPTl9YOiAxMSwgICAgICAgLy8gc3BvdCBkaXJlY3Rpb24geFxuICAgIFNQT1RfRElSRUNUSU9OX1k6IDEyLCAgICAgICAvLyBzcG90IGRpcmVjdGlvbiB5XG4gICAgU1BPVF9ESVJFQ1RJT05fWjogMTMsICAgICAgIC8vIHNwb3QgZGlyZWN0aW9uIHpcblxuICAgIFBST0pfTUFUXzAwOiAxNCwgICAgICAgICAgICAvLyBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeCwgbWF0NCwgMTYgZmxvYXRzXG4gICAgQVRMQVNfVklFV1BPUlRfQTogMTQsICAgICAgIC8vIHZpZXdwb3J0LngsIHZpZXdwb3J0LngsIHZpZXdwb3J0LnksIHZpZXdwb3J0LnlcblxuICAgIFBST0pfTUFUXzAxOiAxNSxcbiAgICBBVExBU19WSUVXUE9SVF9COiAxNSwgICAgICAgLy8gdmlld3BvcnQueiwgdmlld3BvcnQueiwgLSwgLVxuXG4gICAgUFJPSl9NQVRfMDI6IDE2LFxuICAgIFBST0pfTUFUXzAzOiAxNyxcbiAgICBQUk9KX01BVF8xMDogMTgsXG4gICAgUFJPSl9NQVRfMTE6IDE5LFxuICAgIFBST0pfTUFUXzEyOiAyMCxcbiAgICBQUk9KX01BVF8xMzogMjEsXG4gICAgUFJPSl9NQVRfMjA6IDIyLFxuICAgIFBST0pfTUFUXzIxOiAyMyxcbiAgICBQUk9KX01BVF8yMjogMjQsXG4gICAgUFJPSl9NQVRfMjM6IDI1LFxuICAgIFBST0pfTUFUXzMwOiAyNixcbiAgICBQUk9KX01BVF8zMTogMjcsXG4gICAgUFJPSl9NQVRfMzI6IDI4LFxuICAgIFBST0pfTUFUXzMzOiAyOSxcblxuICAgIEFSRUFfREFUQV9XSURUSF9YOiAzMCxcbiAgICBBUkVBX0RBVEFfV0lEVEhfWTogMzEsXG4gICAgQVJFQV9EQVRBX1dJRFRIX1o6IDMyLFxuICAgIEFSRUFfREFUQV9IRUlHSFRfWDogMzMsXG4gICAgQVJFQV9EQVRBX0hFSUdIVF9ZOiAzNCxcbiAgICBBUkVBX0RBVEFfSEVJR0hUX1o6IDM1LFxuXG4gICAgLy8gbGVhdmUgbGFzdFxuICAgIENPVU5UOiAzNlxufTtcblxuLy8gZm9ybWF0IG9mIHRoZSBmbG9hdCB0ZXh0dXJlXG5jb25zdCBUZXh0dXJlSW5kZXhGbG9hdCA9IHtcbiAgICBQT1NJVElPTl9SQU5HRTogMCwgICAgICAgICAgICAgIC8vIHBvc2l0aW9ucy54eXosIHJhbmdlXG4gICAgU1BPVF9ESVJFQ1RJT046IDEsICAgICAgICAgICAgICAvLyBzcG90IGRpcmVjdGlvbi54eXosIC1cblxuICAgIFBST0pfTUFUXzA6IDIsICAgICAgICAgICAgICAgICAgLy8gcHJvamVjdGlvbiBtYXRyaXggcm93IDAgKHNwb3QgbGlnaHQpXG4gICAgQVRMQVNfVklFV1BPUlQ6IDIsICAgICAgICAgICAgICAvLyBhdGxhcyB2aWV3cG9ydCBkYXRhIChvbW5pIGxpZ2h0KVxuXG4gICAgUFJPSl9NQVRfMTogMywgICAgICAgICAgICAgICAgICAvLyBwcm9qZWN0aW9uIG1hdHJpeCByb3cgMSAoc3BvdCBsaWdodClcbiAgICBQUk9KX01BVF8yOiA0LCAgICAgICAgICAgICAgICAgIC8vIHByb2plY3Rpb24gbWF0cml4IHJvdyAyIChzcG90IGxpZ2h0KVxuICAgIFBST0pfTUFUXzM6IDUsICAgICAgICAgICAgICAgICAgLy8gcHJvamVjdGlvbiBtYXRyaXggcm93IDMgKHNwb3QgbGlnaHQpXG5cbiAgICBBUkVBX0RBVEFfV0lEVEg6IDYsICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgaGFsZi13aWR0aC54eXosIC1cbiAgICBBUkVBX0RBVEFfSEVJR0hUOiA3LCAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgaGFsZi1oZWlnaHQueHl6LCAtXG5cbiAgICAvLyBsZWF2ZSBsYXN0XG4gICAgQ09VTlQ6IDhcbn07XG5cbi8vIEEgY2xhc3MgdXNlZCBieSBjbHVzdGVyZWQgbGlnaHRpbmcsIHJlc3BvbnNpYmxlIGZvciBlbmNvZGluZyBsaWdodCBwcm9wZXJ0aWVzIGludG8gdGV4dHVyZXMgZm9yIHRoZSB1c2Ugb24gdGhlIEdQVVxuY2xhc3MgTGlnaHRzQnVmZmVyIHtcbiAgICAvLyBmb3JtYXQgZm9yIGhpZ2ggcHJlY2lzaW9uIGxpZ2h0IHRleHR1cmUgLSBmbG9hdFxuICAgIHN0YXRpYyBGT1JNQVRfRkxPQVQgPSAwO1xuXG4gICAgLy8gZm9ybWF0IGZvciBoaWdoIHByZWNpc2lvbiBsaWdodCB0ZXh0dXJlIC0gOGJpdFxuICAgIHN0YXRpYyBGT1JNQVRfOEJJVCA9IDE7XG5cbiAgICAvLyBhY3RpdmUgbGlnaHQgdGV4dHVyZSBmb3JtYXQsIGluaXRpYWxpemVkIGF0IGFwcCBzdGFydFxuICAgIHN0YXRpYyBsaWdodFRleHR1cmVGb3JtYXQgPSBMaWdodHNCdWZmZXIuRk9STUFUXzhCSVQ7XG5cbiAgICAvLyBvbiB3ZWJnbDIgd2UgdXNlIHRleGVsRmV0Y2ggaW5zdHJ1Y3Rpb24gdG8gcmVhZCBkYXRhIHRleHR1cmVzXG4gICAgc3RhdGljIHVzZVRleGVsRmV0Y2ggPSBmYWxzZTtcblxuICAgIC8vIGRlZmluZXMgdXNlZCBmb3IgdW5wYWNraW5nIG9mIGxpZ2h0IHRleHR1cmVzIHRvIGFsbG93IENQVSBwYWNraW5nIHRvIG1hdGNoIHRoZSBHUFUgdW5wYWNraW5nXG4gICAgc3RhdGljIHNoYWRlckRlZmluZXMgPSAnJztcblxuICAgIC8vIGNyZWF0ZXMgbGlzdCBvZiBkZWZpbmVzIHNwZWNpZnlpbmcgdGV4dHVyZSBjb29yZGluYXRlcyBmb3IgZGVjb2RpbmcgbGlnaHRzXG4gICAgc3RhdGljIGluaXRTaGFkZXJEZWZpbmVzKCkge1xuICAgICAgICBjb25zdCBjbHVzdGVyVGV4dHVyZUZvcm1hdCA9IExpZ2h0c0J1ZmZlci5saWdodFRleHR1cmVGb3JtYXQgPT09IExpZ2h0c0J1ZmZlci5GT1JNQVRfRkxPQVQgPyAnRkxPQVQnIDogJzhCSVQnO1xuICAgICAgICBMaWdodHNCdWZmZXIuc2hhZGVyRGVmaW5lcyA9IGBcbiAgICAgICAgICAgIFxcbiNkZWZpbmUgQ0xVU1RFUl9URVhUVVJFXyR7Y2x1c3RlclRleHR1cmVGb3JtYXR9XG4gICAgICAgICAgICAke0xpZ2h0c0J1ZmZlci5idWlsZFNoYWRlckRlZmluZXMoVGV4dHVyZUluZGV4OCwgJ0NMVVNURVJfVEVYVFVSRV84XycpfVxuICAgICAgICAgICAgJHtMaWdodHNCdWZmZXIuYnVpbGRTaGFkZXJEZWZpbmVzKFRleHR1cmVJbmRleEZsb2F0LCAnQ0xVU1RFUl9URVhUVVJFX0ZfJyl9XG4gICAgICAgIGA7XG4gICAgfVxuXG4gICAgLy8gY29udmVydHMgb2JqZWN0IHdpdGggcHJvcGVydGllcyB0byBhIGxpc3Qgb2YgdGhlc2UgYXMgYW4gZXhhbXBsZTogXCIjZGVmaW5lIENMVVNURVJfVEVYVFVSRV84X0JMQUggMS41XCJcbiAgICBzdGF0aWMgYnVpbGRTaGFkZXJEZWZpbmVzKG9iamVjdCwgcHJlZml4KSB7XG4gICAgICAgIGxldCBzdHIgPSAnJztcbiAgICAgICAgY29uc3QgZmxvYXRPZmZzZXQgPSBMaWdodHNCdWZmZXIudXNlVGV4ZWxGZXRjaCA/ICcnIDogJy41JztcbiAgICAgICAgT2JqZWN0LmtleXMob2JqZWN0KS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgIHN0ciArPSBgXFxuI2RlZmluZSAke3ByZWZpeH0ke2tleX0gJHtvYmplY3Rba2V5XX0ke2Zsb2F0T2Zmc2V0fWA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIC8vIGV4ZWN1dGVzIHdoZW4gdGhlIGFwcCBzdGFydHNcbiAgICBzdGF0aWMgaW5pdChkZXZpY2UpIHtcblxuICAgICAgICAvLyBwcmVjaXNpb24gZm9yIHRleHR1cmUgc3RvcmFnZVxuICAgICAgICAvLyBkb24ndCB1c2UgZmxvYXQgdGV4dHVyZSBvbiBkZXZpY2VzIHdpdGggc21hbGwgbnVtYmVyIG9mIHRleHR1cmUgdW5pdHMgKGFzIGl0IHVzZXMgYm90aCBmbG9hdCBhbmQgOGJpdCB0ZXh0dXJlcyBhdCB0aGUgc2FtZSB0aW1lKVxuICAgICAgICBMaWdodHNCdWZmZXIubGlnaHRUZXh0dXJlRm9ybWF0ID0gKGRldmljZS5leHRUZXh0dXJlRmxvYXQgJiYgZGV2aWNlLm1heFRleHR1cmVzID4gOCkgPyBMaWdodHNCdWZmZXIuRk9STUFUX0ZMT0FUIDogTGlnaHRzQnVmZmVyLkZPUk1BVF84QklUO1xuXG4gICAgICAgIExpZ2h0c0J1ZmZlci51c2VUZXhlbEZldGNoID0gZGV2aWNlLnN1cHBvcnRzVGV4dHVyZUZldGNoO1xuXG4gICAgICAgIExpZ2h0c0J1ZmZlci5pbml0U2hhZGVyRGVmaW5lcygpO1xuICAgIH1cblxuICAgIHN0YXRpYyBjcmVhdGVUZXh0dXJlKGRldmljZSwgd2lkdGgsIGhlaWdodCwgZm9ybWF0LCBuYW1lKSB7XG4gICAgICAgIGNvbnN0IHRleCA9IG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICBmb3JtYXQ6IGZvcm1hdCxcbiAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBhZGRyZXNzVjogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgdHlwZTogVEVYVFVSRVRZUEVfREVGQVVMVCxcbiAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgYW5pc290cm9weTogMVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGV4O1xuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuXG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuXG4gICAgICAgIC8vIGZlYXR1cmVzXG4gICAgICAgIHRoaXMuY29va2llc0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5zaGFkb3dzRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmFyZWFMaWdodHNFbmFibGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gdXNpbmcgOCBiaXQgaW5kZXggc28gdGhpcyBpcyBtYXhpbXVtIHN1cHBvcnRlZCBudW1iZXIgb2YgbGlnaHRzXG4gICAgICAgIHRoaXMubWF4TGlnaHRzID0gMjU1O1xuXG4gICAgICAgIC8vIHNoYXJlZCA4Yml0IHRleHR1cmUgcGl4ZWxzOlxuICAgICAgICBsZXQgcGl4ZWxzUGVyTGlnaHQ4ID0gVGV4dHVyZUluZGV4OC5DT1VOVF9BTFdBWVM7XG4gICAgICAgIGxldCBwaXhlbHNQZXJMaWdodEZsb2F0ID0gMDtcblxuICAgICAgICAvLyBmbG9hdCB0ZXh0dXJlIGZvcm1hdFxuICAgICAgICBpZiAoTGlnaHRzQnVmZmVyLmxpZ2h0VGV4dHVyZUZvcm1hdCA9PT0gTGlnaHRzQnVmZmVyLkZPUk1BVF9GTE9BVCkge1xuICAgICAgICAgICAgcGl4ZWxzUGVyTGlnaHRGbG9hdCA9IFRleHR1cmVJbmRleEZsb2F0LkNPVU5UO1xuICAgICAgICB9IGVsc2UgeyAvLyA4Yml0IHRleHR1cmVcbiAgICAgICAgICAgIHBpeGVsc1BlckxpZ2h0OCA9IFRleHR1cmVJbmRleDguQ09VTlQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyA4Yml0IHRleHR1cmUgLSB0byBzdG9yZSBkYXRhIHRoYXQgY2FuIGZpdCBpbnRvIDhiaXRzIHRvIGxvd2VyIHRoZSBiYW5kd2lkdGggcmVxdWlyZW1lbnRzXG4gICAgICAgIHRoaXMubGlnaHRzOCA9IG5ldyBVaW50OENsYW1wZWRBcnJheSg0ICogcGl4ZWxzUGVyTGlnaHQ4ICogdGhpcy5tYXhMaWdodHMpO1xuICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmU4ID0gTGlnaHRzQnVmZmVyLmNyZWF0ZVRleHR1cmUodGhpcy5kZXZpY2UsIHBpeGVsc1BlckxpZ2h0OCwgdGhpcy5tYXhMaWdodHMsIFBJWEVMRk9STUFUX1JHQkE4LCAnTGlnaHRzVGV4dHVyZTgnKTtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZThJZCA9IHRoaXMuZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2xpZ2h0c1RleHR1cmU4Jyk7XG5cbiAgICAgICAgLy8gZmxvYXQgdGV4dHVyZVxuICAgICAgICBpZiAocGl4ZWxzUGVyTGlnaHRGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNGbG9hdCA9IG5ldyBGbG9hdDMyQXJyYXkoNCAqIHBpeGVsc1BlckxpZ2h0RmxvYXQgKiB0aGlzLm1heExpZ2h0cyk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdCA9IExpZ2h0c0J1ZmZlci5jcmVhdGVUZXh0dXJlKHRoaXMuZGV2aWNlLCBwaXhlbHNQZXJMaWdodEZsb2F0LCB0aGlzLm1heExpZ2h0cywgUElYRUxGT1JNQVRfUkdCQTMyRiwgJ0xpZ2h0c1RleHR1cmVGbG9hdCcpO1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUZsb2F0SWQgPSB0aGlzLmRldmljZS5zY29wZS5yZXNvbHZlKCdsaWdodHNUZXh0dXJlRmxvYXQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzRmxvYXQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUZsb2F0SWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbnZlcnNlIHNpemVzIGZvciBib3RoIHRleHR1cmVzXG4gICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVJbnZTaXplSWQgPSB0aGlzLmRldmljZS5zY29wZS5yZXNvbHZlKCdsaWdodHNUZXh0dXJlSW52U2l6ZScpO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGFbMF0gPSBwaXhlbHNQZXJMaWdodEZsb2F0ID8gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlRmxvYXQud2lkdGggOiAwO1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGFbMV0gPSBwaXhlbHNQZXJMaWdodEZsb2F0ID8gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlRmxvYXQuaGVpZ2h0IDogMDtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhWzJdID0gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlOC53aWR0aDtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhWzNdID0gMS4wIC8gdGhpcy5saWdodHNUZXh0dXJlOC5oZWlnaHQ7XG5cbiAgICAgICAgLy8gY29tcHJlc3Npb24gcmFuZ2VzXG4gICAgICAgIHRoaXMuaW52TWF4Q29sb3JWYWx1ZSA9IDA7XG4gICAgICAgIHRoaXMuaW52TWF4QXR0ZW51YXRpb24gPSAwO1xuICAgICAgICB0aGlzLmJvdW5kc01pbiA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMuYm91bmRzRGVsdGEgPSBuZXcgVmVjMygpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgLy8gcmVsZWFzZSB0ZXh0dXJlc1xuICAgICAgICBpZiAodGhpcy5saWdodHNUZXh0dXJlOCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmU4ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0Q29tcHJlc3Npb25SYW5nZXMobWF4QXR0ZW51YXRpb24sIG1heENvbG9yVmFsdWUpIHtcbiAgICAgICAgdGhpcy5pbnZNYXhDb2xvclZhbHVlID0gMSAvIG1heENvbG9yVmFsdWU7XG4gICAgICAgIHRoaXMuaW52TWF4QXR0ZW51YXRpb24gPSAxIC8gbWF4QXR0ZW51YXRpb247XG4gICAgfVxuXG4gICAgc2V0Qm91bmRzKG1pbiwgZGVsdGEpIHtcbiAgICAgICAgdGhpcy5ib3VuZHNNaW4uY29weShtaW4pO1xuICAgICAgICB0aGlzLmJvdW5kc0RlbHRhLmNvcHkoZGVsdGEpO1xuICAgIH1cblxuICAgIHVwbG9hZFRleHR1cmVzKCkge1xuXG4gICAgICAgIGlmICh0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQubG9jaygpLnNldCh0aGlzLmxpZ2h0c0Zsb2F0KTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0LnVubG9jaygpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOC5sb2NrKCkuc2V0KHRoaXMubGlnaHRzOCk7XG4gICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZTgudW5sb2NrKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlVW5pZm9ybXMoKSB7XG5cbiAgICAgICAgLy8gdGV4dHVyZXNcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZThJZC5zZXRWYWx1ZSh0aGlzLmxpZ2h0c1RleHR1cmU4KTtcblxuICAgICAgICBpZiAoTGlnaHRzQnVmZmVyLmxpZ2h0VGV4dHVyZUZvcm1hdCA9PT0gTGlnaHRzQnVmZmVyLkZPUk1BVF9GTE9BVCkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUZsb2F0SWQuc2V0VmFsdWUodGhpcy5saWdodHNUZXh0dXJlRmxvYXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVJZC5zZXRWYWx1ZSh0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGEpO1xuICAgIH1cblxuICAgIGdldFNwb3REaXJlY3Rpb24oZGlyZWN0aW9uLCBzcG90KSB7XG5cbiAgICAgICAgLy8gU3BvdHMgc2hpbmUgZG93biB0aGUgbmVnYXRpdmUgWSBheGlzXG4gICAgICAgIGNvbnN0IG1hdCA9IHNwb3QuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcbiAgICAgICAgbWF0LmdldFkoZGlyZWN0aW9uKS5tdWxTY2FsYXIoLTEpO1xuICAgICAgICBkaXJlY3Rpb24ubm9ybWFsaXplKCk7XG4gICAgfVxuXG4gICAgLy8gaGFsZiBzaXplcyBvZiBhcmVhIGxpZ2h0IGluIHdvcmxkIHNwYWNlLCByZXR1cm5lZCBhcyBhbiBhcnJheSBvZiA2IGZsb2F0c1xuICAgIGdldExpZ2h0QXJlYVNpemVzKGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbWF0ID0gbGlnaHQuX25vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKTtcblxuICAgICAgICBtYXQudHJhbnNmb3JtVmVjdG9yKGFyZWFIYWxmQXhpc1dpZHRoLCB0ZW1wVmVjMyk7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1swXSA9IHRlbXBWZWMzLng7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1sxXSA9IHRlbXBWZWMzLnk7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1syXSA9IHRlbXBWZWMzLno7XG5cbiAgICAgICAgbWF0LnRyYW5zZm9ybVZlY3RvcihhcmVhSGFsZkF4aXNIZWlnaHQsIHRlbXBWZWMzKTtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzNdID0gdGVtcFZlYzMueDtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzRdID0gdGVtcFZlYzMueTtcbiAgICAgICAgdGVtcEFyZWFMaWdodFNpemVzWzVdID0gdGVtcFZlYzMuejtcblxuICAgICAgICByZXR1cm4gdGVtcEFyZWFMaWdodFNpemVzO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YUZsYWdzKGRhdGE4LCBpbmRleCwgbGlnaHQsIGlzU3BvdCwgY2FzdFNoYWRvd3MsIHNoYWRvd0ludGVuc2l0eSkge1xuICAgICAgICBkYXRhOFtpbmRleCArIDBdID0gaXNTcG90ID8gMjU1IDogMDtcbiAgICAgICAgZGF0YThbaW5kZXggKyAxXSA9IGxpZ2h0Ll9zaGFwZSAqIDY0OyAgICAgICAgICAgLy8gdmFsdWUgMC4uM1xuICAgICAgICBkYXRhOFtpbmRleCArIDJdID0gbGlnaHQuX2ZhbGxvZmZNb2RlICogMjU1OyAgICAvLyB2YWx1ZSAwLi4xXG4gICAgICAgIGRhdGE4W2luZGV4ICsgM10gPSBjYXN0U2hhZG93cyA/IHNoYWRvd0ludGVuc2l0eSAqIDI1NSA6IDA7XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhQ29sb3IoZGF0YTgsIGluZGV4LCBsaWdodCwgZ2FtbWFDb3JyZWN0aW9uLCBpc0Nvb2tpZSkge1xuICAgICAgICBjb25zdCBpbnZNYXhDb2xvclZhbHVlID0gdGhpcy5pbnZNYXhDb2xvclZhbHVlO1xuICAgICAgICBjb25zdCBjb2xvciA9IGdhbW1hQ29ycmVjdGlvbiA/IGxpZ2h0Ll9saW5lYXJGaW5hbENvbG9yIDogbGlnaHQuX2ZpbmFsQ29sb3I7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhjb2xvclswXSAqIGludk1heENvbG9yVmFsdWUsIGRhdGE4LCBpbmRleCArIDAsIDIpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoY29sb3JbMV0gKiBpbnZNYXhDb2xvclZhbHVlLCBkYXRhOCwgaW5kZXggKyAyLCAyKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGNvbG9yWzJdICogaW52TWF4Q29sb3JWYWx1ZSwgZGF0YTgsIGluZGV4ICsgNCwgMik7XG5cbiAgICAgICAgLy8gY29va2llXG4gICAgICAgIGRhdGE4W2luZGV4ICsgNl0gPSBpc0Nvb2tpZSA/IDI1NSA6IDA7XG5cbiAgICAgICAgLy8gbGlnaHRNYXNrXG4gICAgICAgIC8vIDA6IE1BU0tfQUZGRUNUX0RZTkFNSUNcbiAgICAgICAgLy8gMTI3OiBNQVNLX0FGRkVDVF9EWU5BTUlDICYmIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEXG4gICAgICAgIC8vIDI1NTogTUFTS19BRkZFQ1RfTElHSFRNQVBQRURcbiAgICAgICAgY29uc3QgaXNEeW5hbWljID0gISEobGlnaHQubWFzayAmIE1BU0tfQUZGRUNUX0RZTkFNSUMpO1xuICAgICAgICBjb25zdCBpc0xpZ2h0bWFwcGVkID0gISEobGlnaHQubWFzayAmIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKTtcbiAgICAgICAgZGF0YThbaW5kZXggKyA3XSA9IChpc0R5bmFtaWMgJiYgaXNMaWdodG1hcHBlZCkgPyAxMjcgOiAoaXNMaWdodG1hcHBlZCA/IDI1NSA6IDApO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YVNwb3RBbmdsZXMoZGF0YTgsIGluZGV4LCBsaWdodCkge1xuICAgICAgICAvLyAyIGJ5dGVzIGVhY2hcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGxpZ2h0Ll9pbm5lckNvbmVBbmdsZUNvcyAqICgwLjUgLSBlcHNpbG9uKSArIDAuNSwgZGF0YTgsIGluZGV4ICsgMCwgMik7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhsaWdodC5fb3V0ZXJDb25lQW5nbGVDb3MgKiAoMC41IC0gZXBzaWxvbikgKyAwLjUsIGRhdGE4LCBpbmRleCArIDIsIDIpO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YVNoYWRvd0JpYXMoZGF0YTgsIGluZGV4LCBsaWdodCkge1xuICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKG51bGwsIDApO1xuICAgICAgICBjb25zdCBiaWFzZXMgPSBsaWdodC5fZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzUmFuZ2UoYmlhc2VzLmJpYXMsIGRhdGE4LCBpbmRleCwgLTEsIDIwLCAyKTsgIC8vIGJpYXM6IC0xIHRvIDIwIHJhbmdlXG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhiaWFzZXMubm9ybWFsQmlhcywgZGF0YTgsIGluZGV4ICsgMiwgMik7ICAgICAvLyBub3JtYWxCaWFzOiAwIHRvIDEgcmFuZ2VcbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFQb3NpdGlvblJhbmdlKGRhdGE4LCBpbmRleCwgbGlnaHQsIHBvcykge1xuICAgICAgICAvLyBwb3NpdGlvbiBhbmQgcmFuZ2Ugc2NhbGVkIHRvIDAuLjEgcmFuZ2VcbiAgICAgICAgY29uc3Qgbm9ybVBvcyA9IHRlbXBWZWMzLnN1YjIocG9zLCB0aGlzLmJvdW5kc01pbikuZGl2KHRoaXMuYm91bmRzRGVsdGEpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMobm9ybVBvcy54LCBkYXRhOCwgaW5kZXggKyAwLCA0KTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKG5vcm1Qb3MueSwgZGF0YTgsIGluZGV4ICsgNCwgNCk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhub3JtUG9zLnosIGRhdGE4LCBpbmRleCArIDgsIDQpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMobGlnaHQuYXR0ZW51YXRpb25FbmQgKiB0aGlzLmludk1heEF0dGVudWF0aW9uLCBkYXRhOCwgaW5kZXggKyAxMiwgNCk7XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhU3BvdERpcmVjdGlvbihkYXRhOCwgaW5kZXgsIGxpZ2h0KSB7XG4gICAgICAgIHRoaXMuZ2V0U3BvdERpcmVjdGlvbih0ZW1wVmVjMywgbGlnaHQpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXModGVtcFZlYzMueCAqICgwLjUgLSBlcHNpbG9uKSArIDAuNSwgZGF0YTgsIGluZGV4ICsgMCwgNCk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyh0ZW1wVmVjMy55ICogKDAuNSAtIGVwc2lsb24pICsgMC41LCBkYXRhOCwgaW5kZXggKyA0LCA0KTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKHRlbXBWZWMzLnogKiAoMC41IC0gZXBzaWxvbikgKyAwLjUsIGRhdGE4LCBpbmRleCArIDgsIDQpO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YUxpZ2h0UHJvak1hdHJpeChkYXRhOCwgaW5kZXgsIGxpZ2h0UHJvamVjdGlvbk1hdHJpeCkge1xuICAgICAgICBjb25zdCBtYXREYXRhID0gbGlnaHRQcm9qZWN0aW9uTWF0cml4LmRhdGE7XG4gICAgICAgIGZvciAobGV0IG0gPSAwOyBtIDwgMTI7IG0rKykgICAgLy8gdGhlc2UgYXJlIGluIC0yLi4yIHJhbmdlXG4gICAgICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXNSYW5nZShtYXREYXRhW21dLCBkYXRhOCwgaW5kZXggKyA0ICogbSwgLTIsIDIsIDQpO1xuICAgICAgICBmb3IgKGxldCBtID0gMTI7IG0gPCAxNjsgbSsrKSB7ICAvLyB0aGVzZSBhcmUgZnVsbCBmbG9hdCByYW5nZVxuICAgICAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0Mk1hbnRpc3NhRXhwb25lbnQobWF0RGF0YVttXSwgZGF0YTgsIGluZGV4ICsgNCAqIG0sIDQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhQ29va2llcyhkYXRhOCwgaW5kZXgsIGxpZ2h0KSB7XG4gICAgICAgIGNvbnN0IGlzUmdiID0gbGlnaHQuX2Nvb2tpZUNoYW5uZWwgPT09ICdyZ2InO1xuICAgICAgICBkYXRhOFtpbmRleCArIDBdID0gTWF0aC5mbG9vcihsaWdodC5jb29raWVJbnRlbnNpdHkgKiAyNTUpO1xuICAgICAgICBkYXRhOFtpbmRleCArIDFdID0gaXNSZ2IgPyAyNTUgOiAwO1xuICAgICAgICAvLyB3ZSBoYXZlIHR3byB1bnVzZWQgYnl0ZXMgaGVyZVxuXG4gICAgICAgIGlmICghaXNSZ2IpIHtcbiAgICAgICAgICAgIGNvbnN0IGNoYW5uZWwgPSBsaWdodC5fY29va2llQ2hhbm5lbDtcbiAgICAgICAgICAgIGRhdGE4W2luZGV4ICsgNF0gPSBjaGFubmVsID09PSAncnJyJyA/IDI1NSA6IDA7XG4gICAgICAgICAgICBkYXRhOFtpbmRleCArIDVdID0gY2hhbm5lbCA9PT0gJ2dnZycgPyAyNTUgOiAwO1xuICAgICAgICAgICAgZGF0YThbaW5kZXggKyA2XSA9IGNoYW5uZWwgPT09ICdiYmInID8gMjU1IDogMDtcbiAgICAgICAgICAgIGRhdGE4W2luZGV4ICsgN10gPSBjaGFubmVsID09PSAnYWFhJyA/IDI1NSA6IDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRMaWdodEF0bGFzVmlld3BvcnQoZGF0YTgsIGluZGV4LCBhdGxhc1ZpZXdwb3J0KSB7XG4gICAgICAgIC8vIGFsbCB0aGVzZSBhcmUgaW4gMC4uMSByYW5nZVxuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoYXRsYXNWaWV3cG9ydC54LCBkYXRhOCwgaW5kZXggKyAwLCAyKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGF0bGFzVmlld3BvcnQueSwgZGF0YTgsIGluZGV4ICsgMiwgMik7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhhdGxhc1ZpZXdwb3J0LnogLyAzLCBkYXRhOCwgaW5kZXggKyA0LCAyKTtcbiAgICAgICAgLy8gd2UgaGF2ZSB0d28gdW51c2VkIGJ5dGVzIGhlcmVcbiAgICB9XG5cbiAgICBhZGRMaWdodEFyZWFTaXplcyhkYXRhOCwgaW5kZXgsIGxpZ2h0KSB7XG4gICAgICAgIGNvbnN0IGFyZWFTaXplcyA9IHRoaXMuZ2V0TGlnaHRBcmVhU2l6ZXMobGlnaHQpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykgeyAgLy8gdGhlc2UgYXJlIGZ1bGwgZmxvYXQgcmFuZ2VcbiAgICAgICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJNYW50aXNzYUV4cG9uZW50KGFyZWFTaXplc1tpXSwgZGF0YTgsIGluZGV4ICsgNCAqIGksIDQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZmlsbCB1cCBib3RoIGZsb2F0IGFuZCA4Yml0IHRleHR1cmUgZGF0YSB3aXRoIGxpZ2h0IHByb3BlcnRpZXNcbiAgICBhZGRMaWdodERhdGEobGlnaHQsIGxpZ2h0SW5kZXgsIGdhbW1hQ29ycmVjdGlvbikge1xuXG4gICAgICAgIGNvbnN0IGlzU3BvdCA9IGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVDtcbiAgICAgICAgY29uc3QgaGFzQXRsYXNWaWV3cG9ydCA9IGxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQ7IC8vIGlmIHRoZSBsaWdodCBkb2VzIG5vdCBoYXZlIHZpZXdwb3J0LCBpdCBkb2VzIG5vdCBmaXQgdG8gdGhlIGF0bGFzXG4gICAgICAgIGNvbnN0IGlzQ29va2llID0gdGhpcy5jb29raWVzRW5hYmxlZCAmJiAhIWxpZ2h0Ll9jb29raWUgJiYgaGFzQXRsYXNWaWV3cG9ydDtcbiAgICAgICAgY29uc3QgaXNBcmVhID0gdGhpcy5hcmVhTGlnaHRzRW5hYmxlZCAmJiBsaWdodC5zaGFwZSAhPT0gTElHSFRTSEFQRV9QVU5DVFVBTDtcbiAgICAgICAgY29uc3QgY2FzdFNoYWRvd3MgPSB0aGlzLnNoYWRvd3NFbmFibGVkICYmIGxpZ2h0LmNhc3RTaGFkb3dzICYmIGhhc0F0bGFzVmlld3BvcnQ7XG4gICAgICAgIGNvbnN0IHBvcyA9IGxpZ2h0Ll9ub2RlLmdldFBvc2l0aW9uKCk7XG5cbiAgICAgICAgbGV0IGxpZ2h0UHJvamVjdGlvbk1hdHJpeCA9IG51bGw7ICAgLy8gbGlnaHQgcHJvamVjdGlvbiBtYXRyaXggLSB1c2VkIGZvciBzaGFkb3cgbWFwIGFuZCBjb29raWUgb2Ygc3BvdCBsaWdodFxuICAgICAgICBsZXQgYXRsYXNWaWV3cG9ydCA9IG51bGw7ICAgLy8gYXRsYXMgdmlld3BvcnQgaW5mbyAtIHVzZWQgZm9yIHNoYWRvdyBtYXAgYW5kIGNvb2tpZSBvZiBvbW5pIGxpZ2h0XG4gICAgICAgIGlmIChpc1Nwb3QpIHtcbiAgICAgICAgICAgIGlmIChjYXN0U2hhZG93cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobnVsbCwgMCk7XG4gICAgICAgICAgICAgICAgbGlnaHRQcm9qZWN0aW9uTWF0cml4ID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd01hdHJpeDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNDb29raWUpIHtcbiAgICAgICAgICAgICAgICBsaWdodFByb2plY3Rpb25NYXRyaXggPSBMaWdodENhbWVyYS5ldmFsU3BvdENvb2tpZU1hdHJpeChsaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoY2FzdFNoYWRvd3MgfHwgaXNDb29raWUpIHtcbiAgICAgICAgICAgICAgICBhdGxhc1ZpZXdwb3J0ID0gbGlnaHQuYXRsYXNWaWV3cG9ydDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRhdGEgYWx3YXlzIHN0b3JlZCBpbiA4Yml0IHRleHR1cmVcbiAgICAgICAgY29uc3QgZGF0YTggPSB0aGlzLmxpZ2h0czg7XG4gICAgICAgIGNvbnN0IGRhdGE4U3RhcnQgPSBsaWdodEluZGV4ICogdGhpcy5saWdodHNUZXh0dXJlOC53aWR0aCAqIDQ7XG5cbiAgICAgICAgLy8gZmxhZ3NcbiAgICAgICAgdGhpcy5hZGRMaWdodERhdGFGbGFncyhkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LkZMQUdTLCBsaWdodCwgaXNTcG90LCBjYXN0U2hhZG93cywgbGlnaHQuc2hhZG93SW50ZW5zaXR5KTtcblxuICAgICAgICAvLyBsaWdodCBjb2xvclxuICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YUNvbG9yKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguQ09MT1JfQSwgbGlnaHQsIGdhbW1hQ29ycmVjdGlvbiwgaXNDb29raWUpO1xuXG4gICAgICAgIC8vIHNwb3QgbGlnaHQgYW5nbGVzXG4gICAgICAgIGlmIChpc1Nwb3QpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhU3BvdEFuZ2xlcyhkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlNQT1RfQU5HTEVTLCBsaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzaGFkb3cgYmlhc2VzXG4gICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cykge1xuICAgICAgICAgICAgdGhpcy5hZGRMaWdodERhdGFTaGFkb3dCaWFzKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguU0hBRE9XX0JJQVMsIGxpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvb2tpZSBwcm9wZXJ0aWVzXG4gICAgICAgIGlmIChpc0Nvb2tpZSkge1xuICAgICAgICAgICAgdGhpcy5hZGRMaWdodERhdGFDb29raWVzKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguQ09PS0lFX0EsIGxpZ2h0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhpZ2ggcHJlY2lzaW9uIGRhdGEgc3RvcmVkIHVzaW5nIGZsb2F0IHRleHR1cmVcbiAgICAgICAgaWYgKExpZ2h0c0J1ZmZlci5saWdodFRleHR1cmVGb3JtYXQgPT09IExpZ2h0c0J1ZmZlci5GT1JNQVRfRkxPQVQpIHtcblxuICAgICAgICAgICAgY29uc3QgZGF0YUZsb2F0ID0gdGhpcy5saWdodHNGbG9hdDtcbiAgICAgICAgICAgIGNvbnN0IGRhdGFGbG9hdFN0YXJ0ID0gbGlnaHRJbmRleCAqIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0LndpZHRoICogNDtcblxuICAgICAgICAgICAgLy8gcG9zIGFuZCByYW5nZVxuICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlBPU0lUSU9OX1JBTkdFICsgMF0gPSBwb3MueDtcbiAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5QT1NJVElPTl9SQU5HRSArIDFdID0gcG9zLnk7XG4gICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuUE9TSVRJT05fUkFOR0UgKyAyXSA9IHBvcy56O1xuICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlBPU0lUSU9OX1JBTkdFICsgM10gPSBsaWdodC5hdHRlbnVhdGlvbkVuZDtcblxuICAgICAgICAgICAgLy8gc3BvdCBkaXJlY3Rpb25cbiAgICAgICAgICAgIGlmIChpc1Nwb3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNwb3REaXJlY3Rpb24odGVtcFZlYzMsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuU1BPVF9ESVJFQ1RJT04gKyAwXSA9IHRlbXBWZWMzLng7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlNQT1RfRElSRUNUSU9OICsgMV0gPSB0ZW1wVmVjMy55O1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5TUE9UX0RJUkVDVElPTiArIDJdID0gdGVtcFZlYzMuejtcbiAgICAgICAgICAgICAgICAvLyBoZXJlIHdlIGhhdmUgdW51c2VkIGZsb2F0XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4XG4gICAgICAgICAgICBpZiAobGlnaHRQcm9qZWN0aW9uTWF0cml4KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0RGF0YSA9IGxpZ2h0UHJvamVjdGlvbk1hdHJpeC5kYXRhO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IG0gPSAwOyBtIDwgMTY7IG0rKylcbiAgICAgICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlBST0pfTUFUXzAgKyBtXSA9IG1hdERhdGFbbV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhdGxhc1ZpZXdwb3J0KSB7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFUTEFTX1ZJRVdQT1JUICsgMF0gPSBhdGxhc1ZpZXdwb3J0Lng7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFUTEFTX1ZJRVdQT1JUICsgMV0gPSBhdGxhc1ZpZXdwb3J0Lnk7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFUTEFTX1ZJRVdQT1JUICsgMl0gPSBhdGxhc1ZpZXdwb3J0LnogLyAzOyAvLyBzaXplIG9mIGEgZmFjZSBzbG90ICgzeDMgZ3JpZClcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXJlYSBsaWdodCBzaXplc1xuICAgICAgICAgICAgaWYgKGlzQXJlYSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFyZWFTaXplcyA9IHRoaXMuZ2V0TGlnaHRBcmVhU2l6ZXMobGlnaHQpO1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BUkVBX0RBVEFfV0lEVEggKyAwXSA9IGFyZWFTaXplc1swXTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVJFQV9EQVRBX1dJRFRIICsgMV0gPSBhcmVhU2l6ZXNbMV07XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFSRUFfREFUQV9XSURUSCArIDJdID0gYXJlYVNpemVzWzJdO1xuXG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFSRUFfREFUQV9IRUlHSFQgKyAwXSA9IGFyZWFTaXplc1szXTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVJFQV9EQVRBX0hFSUdIVCArIDFdID0gYXJlYVNpemVzWzRdO1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BUkVBX0RBVEFfSEVJR0hUICsgMl0gPSBhcmVhU2l6ZXNbNV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHsgICAgLy8gaGlnaCBwcmVjaXNpb24gZGF0YSBzdG9yZWQgdXNpbmcgOGJpdCB0ZXh0dXJlXG5cbiAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhUG9zaXRpb25SYW5nZShkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlBPU0lUSU9OX1gsIGxpZ2h0LCBwb3MpO1xuXG4gICAgICAgICAgICAvLyBzcG90IGRpcmVjdGlvblxuICAgICAgICAgICAgaWYgKGlzU3BvdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhU3BvdERpcmVjdGlvbihkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlNQT1RfRElSRUNUSU9OX1gsIGxpZ2h0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbGlnaHQgcHJvamVjdGlvbiBtYXRyaXhcbiAgICAgICAgICAgIGlmIChsaWdodFByb2plY3Rpb25NYXRyaXgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YUxpZ2h0UHJvak1hdHJpeChkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlBST0pfTUFUXzAwLCBsaWdodFByb2plY3Rpb25NYXRyaXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXRsYXNWaWV3cG9ydCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTGlnaHRBdGxhc1ZpZXdwb3J0KGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguQVRMQVNfVklFV1BPUlRfQSwgYXRsYXNWaWV3cG9ydCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgc2l6ZXNcbiAgICAgICAgICAgIGlmIChpc0FyZWEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExpZ2h0QXJlYVNpemVzKGRhdGE4LCBkYXRhOFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleDguQVJFQV9EQVRBX1dJRFRIX1gsIGxpZ2h0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHRzQnVmZmVyIH07XG4iXSwibmFtZXMiOlsiZXBzaWxvbiIsInRlbXBWZWMzIiwiVmVjMyIsInRlbXBBcmVhTGlnaHRTaXplcyIsIkZsb2F0MzJBcnJheSIsImFyZWFIYWxmQXhpc1dpZHRoIiwiYXJlYUhhbGZBeGlzSGVpZ2h0IiwiVGV4dHVyZUluZGV4OCIsIkZMQUdTIiwiQ09MT1JfQSIsIkNPTE9SX0IiLCJTUE9UX0FOR0xFUyIsIlNIQURPV19CSUFTIiwiQ09PS0lFX0EiLCJDT09LSUVfQiIsIkNPVU5UX0FMV0FZUyIsIlBPU0lUSU9OX1giLCJQT1NJVElPTl9ZIiwiUE9TSVRJT05fWiIsIlJBTkdFIiwiU1BPVF9ESVJFQ1RJT05fWCIsIlNQT1RfRElSRUNUSU9OX1kiLCJTUE9UX0RJUkVDVElPTl9aIiwiUFJPSl9NQVRfMDAiLCJBVExBU19WSUVXUE9SVF9BIiwiUFJPSl9NQVRfMDEiLCJBVExBU19WSUVXUE9SVF9CIiwiUFJPSl9NQVRfMDIiLCJQUk9KX01BVF8wMyIsIlBST0pfTUFUXzEwIiwiUFJPSl9NQVRfMTEiLCJQUk9KX01BVF8xMiIsIlBST0pfTUFUXzEzIiwiUFJPSl9NQVRfMjAiLCJQUk9KX01BVF8yMSIsIlBST0pfTUFUXzIyIiwiUFJPSl9NQVRfMjMiLCJQUk9KX01BVF8zMCIsIlBST0pfTUFUXzMxIiwiUFJPSl9NQVRfMzIiLCJQUk9KX01BVF8zMyIsIkFSRUFfREFUQV9XSURUSF9YIiwiQVJFQV9EQVRBX1dJRFRIX1kiLCJBUkVBX0RBVEFfV0lEVEhfWiIsIkFSRUFfREFUQV9IRUlHSFRfWCIsIkFSRUFfREFUQV9IRUlHSFRfWSIsIkFSRUFfREFUQV9IRUlHSFRfWiIsIkNPVU5UIiwiVGV4dHVyZUluZGV4RmxvYXQiLCJQT1NJVElPTl9SQU5HRSIsIlNQT1RfRElSRUNUSU9OIiwiUFJPSl9NQVRfMCIsIkFUTEFTX1ZJRVdQT1JUIiwiUFJPSl9NQVRfMSIsIlBST0pfTUFUXzIiLCJQUk9KX01BVF8zIiwiQVJFQV9EQVRBX1dJRFRIIiwiQVJFQV9EQVRBX0hFSUdIVCIsIkxpZ2h0c0J1ZmZlciIsImluaXRTaGFkZXJEZWZpbmVzIiwiY2x1c3RlclRleHR1cmVGb3JtYXQiLCJsaWdodFRleHR1cmVGb3JtYXQiLCJGT1JNQVRfRkxPQVQiLCJzaGFkZXJEZWZpbmVzIiwiYnVpbGRTaGFkZXJEZWZpbmVzIiwib2JqZWN0IiwicHJlZml4Iiwic3RyIiwiZmxvYXRPZmZzZXQiLCJ1c2VUZXhlbEZldGNoIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJrZXkiLCJpbml0IiwiZGV2aWNlIiwiZXh0VGV4dHVyZUZsb2F0IiwibWF4VGV4dHVyZXMiLCJGT1JNQVRfOEJJVCIsInN1cHBvcnRzVGV4dHVyZUZldGNoIiwiY3JlYXRlVGV4dHVyZSIsIndpZHRoIiwiaGVpZ2h0IiwiZm9ybWF0IiwibmFtZSIsInRleCIsIlRleHR1cmUiLCJtaXBtYXBzIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsInR5cGUiLCJURVhUVVJFVFlQRV9ERUZBVUxUIiwibWFnRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtaW5GaWx0ZXIiLCJhbmlzb3Ryb3B5IiwiY29uc3RydWN0b3IiLCJjb29raWVzRW5hYmxlZCIsInNoYWRvd3NFbmFibGVkIiwiYXJlYUxpZ2h0c0VuYWJsZWQiLCJtYXhMaWdodHMiLCJwaXhlbHNQZXJMaWdodDgiLCJwaXhlbHNQZXJMaWdodEZsb2F0IiwibGlnaHRzOCIsIlVpbnQ4Q2xhbXBlZEFycmF5IiwibGlnaHRzVGV4dHVyZTgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIl9saWdodHNUZXh0dXJlOElkIiwic2NvcGUiLCJyZXNvbHZlIiwibGlnaHRzRmxvYXQiLCJsaWdodHNUZXh0dXJlRmxvYXQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiX2xpZ2h0c1RleHR1cmVGbG9hdElkIiwidW5kZWZpbmVkIiwiX2xpZ2h0c1RleHR1cmVJbnZTaXplSWQiLCJfbGlnaHRzVGV4dHVyZUludlNpemVEYXRhIiwiaW52TWF4Q29sb3JWYWx1ZSIsImludk1heEF0dGVudWF0aW9uIiwiYm91bmRzTWluIiwiYm91bmRzRGVsdGEiLCJkZXN0cm95Iiwic2V0Q29tcHJlc3Npb25SYW5nZXMiLCJtYXhBdHRlbnVhdGlvbiIsIm1heENvbG9yVmFsdWUiLCJzZXRCb3VuZHMiLCJtaW4iLCJkZWx0YSIsImNvcHkiLCJ1cGxvYWRUZXh0dXJlcyIsImxvY2siLCJzZXQiLCJ1bmxvY2siLCJ1cGRhdGVVbmlmb3JtcyIsInNldFZhbHVlIiwiZ2V0U3BvdERpcmVjdGlvbiIsImRpcmVjdGlvbiIsInNwb3QiLCJtYXQiLCJfbm9kZSIsImdldFdvcmxkVHJhbnNmb3JtIiwiZ2V0WSIsIm11bFNjYWxhciIsIm5vcm1hbGl6ZSIsImdldExpZ2h0QXJlYVNpemVzIiwibGlnaHQiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJ4IiwieSIsInoiLCJhZGRMaWdodERhdGFGbGFncyIsImRhdGE4IiwiaW5kZXgiLCJpc1Nwb3QiLCJjYXN0U2hhZG93cyIsInNoYWRvd0ludGVuc2l0eSIsIl9zaGFwZSIsIl9mYWxsb2ZmTW9kZSIsImFkZExpZ2h0RGF0YUNvbG9yIiwiZ2FtbWFDb3JyZWN0aW9uIiwiaXNDb29raWUiLCJjb2xvciIsIl9saW5lYXJGaW5hbENvbG9yIiwiX2ZpbmFsQ29sb3IiLCJGbG9hdFBhY2tpbmciLCJmbG9hdDJCeXRlcyIsImlzRHluYW1pYyIsIm1hc2siLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiaXNMaWdodG1hcHBlZCIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiYWRkTGlnaHREYXRhU3BvdEFuZ2xlcyIsIl9pbm5lckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZUNvcyIsImFkZExpZ2h0RGF0YVNoYWRvd0JpYXMiLCJsaWdodFJlbmRlckRhdGEiLCJnZXRSZW5kZXJEYXRhIiwiYmlhc2VzIiwiX2dldFVuaWZvcm1CaWFzVmFsdWVzIiwiZmxvYXQyQnl0ZXNSYW5nZSIsImJpYXMiLCJub3JtYWxCaWFzIiwiYWRkTGlnaHREYXRhUG9zaXRpb25SYW5nZSIsInBvcyIsIm5vcm1Qb3MiLCJzdWIyIiwiZGl2IiwiYXR0ZW51YXRpb25FbmQiLCJhZGRMaWdodERhdGFTcG90RGlyZWN0aW9uIiwiYWRkTGlnaHREYXRhTGlnaHRQcm9qTWF0cml4IiwibGlnaHRQcm9qZWN0aW9uTWF0cml4IiwibWF0RGF0YSIsImRhdGEiLCJtIiwiZmxvYXQyTWFudGlzc2FFeHBvbmVudCIsImFkZExpZ2h0RGF0YUNvb2tpZXMiLCJpc1JnYiIsIl9jb29raWVDaGFubmVsIiwiTWF0aCIsImZsb29yIiwiY29va2llSW50ZW5zaXR5IiwiY2hhbm5lbCIsImFkZExpZ2h0QXRsYXNWaWV3cG9ydCIsImF0bGFzVmlld3BvcnQiLCJhZGRMaWdodEFyZWFTaXplcyIsImFyZWFTaXplcyIsImkiLCJhZGRMaWdodERhdGEiLCJsaWdodEluZGV4IiwiX3R5cGUiLCJMSUdIVFRZUEVfU1BPVCIsImhhc0F0bGFzVmlld3BvcnQiLCJhdGxhc1ZpZXdwb3J0QWxsb2NhdGVkIiwiX2Nvb2tpZSIsImlzQXJlYSIsInNoYXBlIiwiTElHSFRTSEFQRV9QVU5DVFVBTCIsImdldFBvc2l0aW9uIiwic2hhZG93TWF0cml4IiwiTGlnaHRDYW1lcmEiLCJldmFsU3BvdENvb2tpZU1hdHJpeCIsImRhdGE4U3RhcnQiLCJkYXRhRmxvYXQiLCJkYXRhRmxvYXRTdGFydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBT0EsTUFBTUEsT0FBTyxHQUFHLFFBQVEsQ0FBQTtBQUV4QixNQUFNQyxRQUFRLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDM0IsTUFBTUMsa0JBQWtCLEdBQUcsSUFBSUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzlDLE1BQU1DLGlCQUFpQixHQUFHLElBQUlILElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDOUMsTUFBTUksa0JBQWtCLEdBQUcsSUFBSUosSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBSTlDLE1BQU1LLGFBQWEsR0FBRztBQUdsQkMsRUFBQUEsS0FBSyxFQUFFLENBQUM7QUFDUkMsRUFBQUEsT0FBTyxFQUFFLENBQUM7QUFDVkMsRUFBQUEsT0FBTyxFQUFFLENBQUM7QUFDVkMsRUFBQUEsV0FBVyxFQUFFLENBQUM7QUFDZEMsRUFBQUEsV0FBVyxFQUFFLENBQUM7QUFDZEMs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
