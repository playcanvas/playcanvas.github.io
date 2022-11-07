/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../../core/math/vec3.js';
import { ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_NEAREST, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
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
LightsBuffer.shaderDefines = '';

export { LightsBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRzLWJ1ZmZlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBBRERSRVNTX0NMQU1QX1RPX0VER0UsIFRFWFRVUkVUWVBFX0RFRkFVTFQsIEZJTFRFUl9ORUFSRVNUIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEZsb2F0UGFja2luZyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9mbG9hdC1wYWNraW5nLmpzJztcbmltcG9ydCB7IExJR0hUU0hBUEVfUFVOQ1RVQUwsIExJR0hUVFlQRV9TUE9ULCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCwgTUFTS19BRkZFQ1RfRFlOQU1JQyB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBMaWdodENhbWVyYSB9IGZyb20gJy4uL3JlbmRlcmVyL2xpZ2h0LWNhbWVyYS5qcyc7XG5cbmNvbnN0IGVwc2lsb24gPSAwLjAwMDAwMTtcblxuY29uc3QgdGVtcFZlYzMgPSBuZXcgVmVjMygpO1xuY29uc3QgdGVtcEFyZWFMaWdodFNpemVzID0gbmV3IEZsb2F0MzJBcnJheSg2KTtcbmNvbnN0IGFyZWFIYWxmQXhpc1dpZHRoID0gbmV3IFZlYzMoLTAuNSwgMCwgMCk7XG5jb25zdCBhcmVhSGFsZkF4aXNIZWlnaHQgPSBuZXcgVmVjMygwLCAwLCAwLjUpO1xuXG4vLyBmb3JtYXQgb2YgYSByb3cgaW4gOCBiaXQgdGV4dHVyZSB1c2VkIHRvIGVuY29kZSBsaWdodCBkYXRhXG4vLyB0aGlzIGlzIHVzZWQgdG8gc3RvcmUgZGF0YSBpbiB0aGUgdGV4dHVyZSBjb3JyZWN0bHksIGFuZCBhbHNvIHVzZSB0byBnZW5lcmF0ZSBkZWZpbmVzIGZvciB0aGUgc2hhZGVyXG5jb25zdCBUZXh0dXJlSW5kZXg4ID0ge1xuXG4gICAgLy8gYWx3YXlzIDhiaXQgdGV4dHVyZSBkYXRhLCByZWdhcmRsZXNzIG9mIGZsb2F0IHRleHR1cmUgc3VwcG9ydFxuICAgIEZMQUdTOiAwLCAgICAgICAgICAgICAgICAgICAvLyBsaWdodFR5cGUsIGxpZ2h0U2hhcGUsIGZhbGxvZk1vZGUsIGNhc3RTaGFkb3dzXG4gICAgQ09MT1JfQTogMSwgICAgICAgICAgICAgICAgIC8vIGNvbG9yLnIsIGNvbG9yLnIsIGNvbG9yLmcsIGNvbG9yLmcgICAgLy8gSERSIGNvbG9yIGlzIHN0b3JlZCB1c2luZyAyIGJ5dGVzIHBlciBjaGFubmVsXG4gICAgQ09MT1JfQjogMiwgICAgICAgICAgICAgICAgIC8vIGNvbG9yLmIsIGNvbG9yLmIsIHVzZUNvb2tpZSwgbGlnaHRNYXNrXG4gICAgU1BPVF9BTkdMRVM6IDMsICAgICAgICAgICAgIC8vIHNwb3RJbm5lciwgc3BvdElubmVyLCBzcG90T3V0ZXIsIHNwb3RPdXRlclxuICAgIFNIQURPV19CSUFTOiA0LCAgICAgICAgICAgICAvLyBiaWFzLCBiaWFzLCBub3JtYWxCaWFzLCBub3JtYWxCaWFzXG4gICAgQ09PS0lFX0E6IDUsICAgICAgICAgICAgICAgIC8vIGNvb2tpZUludGVuc2l0eSwgY29va2llSXNSZ2IsIC0sIC1cbiAgICBDT09LSUVfQjogNiwgICAgICAgICAgICAgICAgLy8gY29va2llQ2hhbm5lbE1hc2sueHl6d1xuXG4gICAgLy8gbGVhdmUgaW4tYmV0d2VlblxuICAgIENPVU5UX0FMV0FZUzogNyxcblxuICAgIC8vIDhiaXQgdGV4dHVyZSBkYXRhIHVzZWQgd2hlbiBmbG9hdCB0ZXh0dXJlIGlzIG5vdCBzdXBwb3J0ZWRcbiAgICBQT1NJVElPTl9YOiA3LCAgICAgICAgICAgICAgLy8gcG9zaXRpb24ueFxuICAgIFBPU0lUSU9OX1k6IDgsICAgICAgICAgICAgICAvLyBwb3NpdGlvbi55XG4gICAgUE9TSVRJT05fWjogOSwgICAgICAgICAgICAgIC8vIHBvc2l0aW9uLnpcbiAgICBSQU5HRTogMTAsICAgICAgICAgICAgICAgICAgLy8gcmFuZ2VcbiAgICBTUE9UX0RJUkVDVElPTl9YOiAxMSwgICAgICAgLy8gc3BvdCBkaXJlY3Rpb24geFxuICAgIFNQT1RfRElSRUNUSU9OX1k6IDEyLCAgICAgICAvLyBzcG90IGRpcmVjdGlvbiB5XG4gICAgU1BPVF9ESVJFQ1RJT05fWjogMTMsICAgICAgIC8vIHNwb3QgZGlyZWN0aW9uIHpcblxuICAgIFBST0pfTUFUXzAwOiAxNCwgICAgICAgICAgICAvLyBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeCwgbWF0NCwgMTYgZmxvYXRzXG4gICAgQVRMQVNfVklFV1BPUlRfQTogMTQsICAgICAgIC8vIHZpZXdwb3J0LngsIHZpZXdwb3J0LngsIHZpZXdwb3J0LnksIHZpZXdwb3J0LnlcblxuICAgIFBST0pfTUFUXzAxOiAxNSxcbiAgICBBVExBU19WSUVXUE9SVF9COiAxNSwgICAgICAgLy8gdmlld3BvcnQueiwgdmlld3BvcnQueiwgLSwgLVxuXG4gICAgUFJPSl9NQVRfMDI6IDE2LFxuICAgIFBST0pfTUFUXzAzOiAxNyxcbiAgICBQUk9KX01BVF8xMDogMTgsXG4gICAgUFJPSl9NQVRfMTE6IDE5LFxuICAgIFBST0pfTUFUXzEyOiAyMCxcbiAgICBQUk9KX01BVF8xMzogMjEsXG4gICAgUFJPSl9NQVRfMjA6IDIyLFxuICAgIFBST0pfTUFUXzIxOiAyMyxcbiAgICBQUk9KX01BVF8yMjogMjQsXG4gICAgUFJPSl9NQVRfMjM6IDI1LFxuICAgIFBST0pfTUFUXzMwOiAyNixcbiAgICBQUk9KX01BVF8zMTogMjcsXG4gICAgUFJPSl9NQVRfMzI6IDI4LFxuICAgIFBST0pfTUFUXzMzOiAyOSxcblxuICAgIEFSRUFfREFUQV9XSURUSF9YOiAzMCxcbiAgICBBUkVBX0RBVEFfV0lEVEhfWTogMzEsXG4gICAgQVJFQV9EQVRBX1dJRFRIX1o6IDMyLFxuICAgIEFSRUFfREFUQV9IRUlHSFRfWDogMzMsXG4gICAgQVJFQV9EQVRBX0hFSUdIVF9ZOiAzNCxcbiAgICBBUkVBX0RBVEFfSEVJR0hUX1o6IDM1LFxuXG4gICAgLy8gbGVhdmUgbGFzdFxuICAgIENPVU5UOiAzNlxufTtcblxuLy8gZm9ybWF0IG9mIHRoZSBmbG9hdCB0ZXh0dXJlXG5jb25zdCBUZXh0dXJlSW5kZXhGbG9hdCA9IHtcbiAgICBQT1NJVElPTl9SQU5HRTogMCwgICAgICAgICAgICAgIC8vIHBvc2l0aW9ucy54eXosIHJhbmdlXG4gICAgU1BPVF9ESVJFQ1RJT046IDEsICAgICAgICAgICAgICAvLyBzcG90IGRpcmVjdGlvbi54eXosIC1cblxuICAgIFBST0pfTUFUXzA6IDIsICAgICAgICAgICAgICAgICAgLy8gcHJvamVjdGlvbiBtYXRyaXggcm93IDAgKHNwb3QgbGlnaHQpXG4gICAgQVRMQVNfVklFV1BPUlQ6IDIsICAgICAgICAgICAgICAvLyBhdGxhcyB2aWV3cG9ydCBkYXRhIChvbW5pIGxpZ2h0KVxuXG4gICAgUFJPSl9NQVRfMTogMywgICAgICAgICAgICAgICAgICAvLyBwcm9qZWN0aW9uIG1hdHJpeCByb3cgMSAoc3BvdCBsaWdodClcbiAgICBQUk9KX01BVF8yOiA0LCAgICAgICAgICAgICAgICAgIC8vIHByb2plY3Rpb24gbWF0cml4IHJvdyAyIChzcG90IGxpZ2h0KVxuICAgIFBST0pfTUFUXzM6IDUsICAgICAgICAgICAgICAgICAgLy8gcHJvamVjdGlvbiBtYXRyaXggcm93IDMgKHNwb3QgbGlnaHQpXG5cbiAgICBBUkVBX0RBVEFfV0lEVEg6IDYsICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgaGFsZi13aWR0aC54eXosIC1cbiAgICBBUkVBX0RBVEFfSEVJR0hUOiA3LCAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgaGFsZi1oZWlnaHQueHl6LCAtXG5cbiAgICAvLyBsZWF2ZSBsYXN0XG4gICAgQ09VTlQ6IDhcbn07XG5cbi8vIEEgY2xhc3MgdXNlZCBieSBjbHVzdGVyZWQgbGlnaHRpbmcsIHJlc3BvbnNpYmxlIGZvciBlbmNvZGluZyBsaWdodCBwcm9wZXJ0aWVzIGludG8gdGV4dHVyZXMgZm9yIHRoZSB1c2Ugb24gdGhlIEdQVVxuY2xhc3MgTGlnaHRzQnVmZmVyIHtcbiAgICAvLyBmb3JtYXQgZm9yIGhpZ2ggcHJlY2lzaW9uIGxpZ2h0IHRleHR1cmUgLSBmbG9hdFxuICAgIHN0YXRpYyBGT1JNQVRfRkxPQVQgPSAwO1xuXG4gICAgLy8gZm9ybWF0IGZvciBoaWdoIHByZWNpc2lvbiBsaWdodCB0ZXh0dXJlIC0gOGJpdFxuICAgIHN0YXRpYyBGT1JNQVRfOEJJVCA9IDE7XG5cbiAgICAvLyBhY3RpdmUgbGlnaHQgdGV4dHVyZSBmb3JtYXQsIGluaXRpYWxpemVkIGF0IGFwcCBzdGFydFxuICAgIHN0YXRpYyBsaWdodFRleHR1cmVGb3JtYXQgPSBMaWdodHNCdWZmZXIuRk9STUFUXzhCSVQ7XG5cbiAgICAvLyBkZWZpbmVzIHVzZWQgZm9yIHVucGFja2luZyBvZiBsaWdodCB0ZXh0dXJlcyB0byBhbGxvdyBDUFUgcGFja2luZyB0byBtYXRjaCB0aGUgR1BVIHVucGFja2luZ1xuICAgIHN0YXRpYyBzaGFkZXJEZWZpbmVzID0gJyc7XG5cbiAgICAvLyBjcmVhdGVzIGxpc3Qgb2YgZGVmaW5lcyBzcGVjaWZ5aW5nIHRleHR1cmUgY29vcmRpbmF0ZXMgZm9yIGRlY29kaW5nIGxpZ2h0c1xuICAgIHN0YXRpYyBpbml0U2hhZGVyRGVmaW5lcygpIHtcbiAgICAgICAgY29uc3QgY2x1c3RlclRleHR1cmVGb3JtYXQgPSBMaWdodHNCdWZmZXIubGlnaHRUZXh0dXJlRm9ybWF0ID09PSBMaWdodHNCdWZmZXIuRk9STUFUX0ZMT0FUID8gJ0ZMT0FUJyA6ICc4QklUJztcbiAgICAgICAgTGlnaHRzQnVmZmVyLnNoYWRlckRlZmluZXMgPSBgXG4gICAgICAgICAgICBcXG4jZGVmaW5lIENMVVNURVJfVEVYVFVSRV8ke2NsdXN0ZXJUZXh0dXJlRm9ybWF0fVxuICAgICAgICAgICAgJHtMaWdodHNCdWZmZXIuYnVpbGRTaGFkZXJEZWZpbmVzKFRleHR1cmVJbmRleDgsICdDTFVTVEVSX1RFWFRVUkVfOF8nKX1cbiAgICAgICAgICAgICR7TGlnaHRzQnVmZmVyLmJ1aWxkU2hhZGVyRGVmaW5lcyhUZXh0dXJlSW5kZXhGbG9hdCwgJ0NMVVNURVJfVEVYVFVSRV9GXycpfVxuICAgICAgICBgO1xuICAgIH1cblxuICAgIC8vIGNvbnZlcnRzIG9iamVjdCB3aXRoIHByb3BlcnRpZXMgdG8gYSBsaXN0IG9mIHRoZXNlIGFzIGFuIGV4YW1wbGU6IFwiI2RlZmluZSBDTFVTVEVSX1RFWFRVUkVfOF9CTEFIIDEuNVwiXG4gICAgc3RhdGljIGJ1aWxkU2hhZGVyRGVmaW5lcyhvYmplY3QsIHByZWZpeCkge1xuICAgICAgICBsZXQgc3RyID0gJyc7XG4gICAgICAgIE9iamVjdC5rZXlzKG9iamVjdCkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgICAgICBzdHIgKz0gYFxcbiNkZWZpbmUgJHtwcmVmaXh9JHtrZXl9ICR7b2JqZWN0W2tleV19LjVgO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cbiAgICAvLyBleGVjdXRlcyB3aGVuIHRoZSBhcHAgc3RhcnRzXG4gICAgc3RhdGljIGluaXQoZGV2aWNlKSB7XG5cbiAgICAgICAgLy8gcHJlY2lzaW9uIGZvciB0ZXh0dXJlIHN0b3JhZ2VcbiAgICAgICAgLy8gZG9uJ3QgdXNlIGZsb2F0IHRleHR1cmUgb24gZGV2aWNlcyB3aXRoIHNtYWxsIG51bWJlciBvZiB0ZXh0dXJlIHVuaXRzIChhcyBpdCB1c2VzIGJvdGggZmxvYXQgYW5kIDhiaXQgdGV4dHVyZXMgYXQgdGhlIHNhbWUgdGltZSlcbiAgICAgICAgTGlnaHRzQnVmZmVyLmxpZ2h0VGV4dHVyZUZvcm1hdCA9IChkZXZpY2UuZXh0VGV4dHVyZUZsb2F0ICYmIGRldmljZS5tYXhUZXh0dXJlcyA+IDgpID8gTGlnaHRzQnVmZmVyLkZPUk1BVF9GTE9BVCA6IExpZ2h0c0J1ZmZlci5GT1JNQVRfOEJJVDtcblxuICAgICAgICBMaWdodHNCdWZmZXIuaW5pdFNoYWRlckRlZmluZXMoKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgY3JlYXRlVGV4dHVyZShkZXZpY2UsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgbmFtZSkge1xuICAgICAgICBjb25zdCB0ZXggPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIHR5cGU6IFRFWFRVUkVUWVBFX0RFRkFVTFQsXG4gICAgICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIGFuaXNvdHJvcHk6IDFcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRleDtcbiAgICB9XG5cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UpIHtcblxuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcblxuICAgICAgICAvLyBmZWF0dXJlc1xuICAgICAgICB0aGlzLmNvb2tpZXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuc2hhZG93c0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5hcmVhTGlnaHRzRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHVzaW5nIDggYml0IGluZGV4IHNvIHRoaXMgaXMgbWF4aW11bSBzdXBwb3J0ZWQgbnVtYmVyIG9mIGxpZ2h0c1xuICAgICAgICB0aGlzLm1heExpZ2h0cyA9IDI1NTtcblxuICAgICAgICAvLyBzaGFyZWQgOGJpdCB0ZXh0dXJlIHBpeGVsczpcbiAgICAgICAgbGV0IHBpeGVsc1BlckxpZ2h0OCA9IFRleHR1cmVJbmRleDguQ09VTlRfQUxXQVlTO1xuICAgICAgICBsZXQgcGl4ZWxzUGVyTGlnaHRGbG9hdCA9IDA7XG5cbiAgICAgICAgLy8gZmxvYXQgdGV4dHVyZSBmb3JtYXRcbiAgICAgICAgaWYgKExpZ2h0c0J1ZmZlci5saWdodFRleHR1cmVGb3JtYXQgPT09IExpZ2h0c0J1ZmZlci5GT1JNQVRfRkxPQVQpIHtcbiAgICAgICAgICAgIHBpeGVsc1BlckxpZ2h0RmxvYXQgPSBUZXh0dXJlSW5kZXhGbG9hdC5DT1VOVDtcbiAgICAgICAgfSBlbHNlIHsgLy8gOGJpdCB0ZXh0dXJlXG4gICAgICAgICAgICBwaXhlbHNQZXJMaWdodDggPSBUZXh0dXJlSW5kZXg4LkNPVU5UO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gOGJpdCB0ZXh0dXJlIC0gdG8gc3RvcmUgZGF0YSB0aGF0IGNhbiBmaXQgaW50byA4Yml0cyB0byBsb3dlciB0aGUgYmFuZHdpZHRoIHJlcXVpcmVtZW50c1xuICAgICAgICB0aGlzLmxpZ2h0czggPSBuZXcgVWludDhDbGFtcGVkQXJyYXkoNCAqIHBpeGVsc1BlckxpZ2h0OCAqIHRoaXMubWF4TGlnaHRzKTtcbiAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOCA9IExpZ2h0c0J1ZmZlci5jcmVhdGVUZXh0dXJlKHRoaXMuZGV2aWNlLCBwaXhlbHNQZXJMaWdodDgsIHRoaXMubWF4TGlnaHRzLCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgJ0xpZ2h0c1RleHR1cmU4Jyk7XG4gICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmU4SWQgPSB0aGlzLmRldmljZS5zY29wZS5yZXNvbHZlKCdsaWdodHNUZXh0dXJlOCcpO1xuXG4gICAgICAgIC8vIGZsb2F0IHRleHR1cmVcbiAgICAgICAgaWYgKHBpeGVsc1BlckxpZ2h0RmxvYXQpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzRmxvYXQgPSBuZXcgRmxvYXQzMkFycmF5KDQgKiBwaXhlbHNQZXJMaWdodEZsb2F0ICogdGhpcy5tYXhMaWdodHMpO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlRmxvYXQgPSBMaWdodHNCdWZmZXIuY3JlYXRlVGV4dHVyZSh0aGlzLmRldmljZSwgcGl4ZWxzUGVyTGlnaHRGbG9hdCwgdGhpcy5tYXhMaWdodHMsIFBJWEVMRk9STUFUX1JHQkEzMkYsICdMaWdodHNUZXh0dXJlRmxvYXQnKTtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVGbG9hdElkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnbGlnaHRzVGV4dHVyZUZsb2F0Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c0Zsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVGbG9hdElkID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW52ZXJzZSBzaXplcyBmb3IgYm90aCB0ZXh0dXJlc1xuICAgICAgICB0aGlzLl9saWdodHNUZXh0dXJlSW52U2l6ZUlkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnbGlnaHRzVGV4dHVyZUludlNpemUnKTtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhWzBdID0gcGl4ZWxzUGVyTGlnaHRGbG9hdCA/IDEuMCAvIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0LndpZHRoIDogMDtcbiAgICAgICAgdGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhWzFdID0gcGl4ZWxzUGVyTGlnaHRGbG9hdCA/IDEuMCAvIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0LmhlaWdodCA6IDA7XG4gICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVJbnZTaXplRGF0YVsyXSA9IDEuMCAvIHRoaXMubGlnaHRzVGV4dHVyZTgud2lkdGg7XG4gICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVJbnZTaXplRGF0YVszXSA9IDEuMCAvIHRoaXMubGlnaHRzVGV4dHVyZTguaGVpZ2h0O1xuXG4gICAgICAgIC8vIGNvbXByZXNzaW9uIHJhbmdlc1xuICAgICAgICB0aGlzLmludk1heENvbG9yVmFsdWUgPSAwO1xuICAgICAgICB0aGlzLmludk1heEF0dGVudWF0aW9uID0gMDtcbiAgICAgICAgdGhpcy5ib3VuZHNNaW4gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLmJvdW5kc0RlbHRhID0gbmV3IFZlYzMoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIC8vIHJlbGVhc2UgdGV4dHVyZXNcbiAgICAgICAgaWYgKHRoaXMubGlnaHRzVGV4dHVyZTgpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZTguZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5saWdodHNUZXh0dXJlOCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5saWdodHNUZXh0dXJlRmxvYXQpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldENvbXByZXNzaW9uUmFuZ2VzKG1heEF0dGVudWF0aW9uLCBtYXhDb2xvclZhbHVlKSB7XG4gICAgICAgIHRoaXMuaW52TWF4Q29sb3JWYWx1ZSA9IDEgLyBtYXhDb2xvclZhbHVlO1xuICAgICAgICB0aGlzLmludk1heEF0dGVudWF0aW9uID0gMSAvIG1heEF0dGVudWF0aW9uO1xuICAgIH1cblxuICAgIHNldEJvdW5kcyhtaW4sIGRlbHRhKSB7XG4gICAgICAgIHRoaXMuYm91bmRzTWluLmNvcHkobWluKTtcbiAgICAgICAgdGhpcy5ib3VuZHNEZWx0YS5jb3B5KGRlbHRhKTtcbiAgICB9XG5cbiAgICB1cGxvYWRUZXh0dXJlcygpIHtcblxuICAgICAgICBpZiAodGhpcy5saWdodHNUZXh0dXJlRmxvYXQpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0LmxvY2soKS5zZXQodGhpcy5saWdodHNGbG9hdCk7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdC51bmxvY2soKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubGlnaHRzVGV4dHVyZTgubG9jaygpLnNldCh0aGlzLmxpZ2h0czgpO1xuICAgICAgICB0aGlzLmxpZ2h0c1RleHR1cmU4LnVubG9jaygpO1xuICAgIH1cblxuICAgIHVwZGF0ZVVuaWZvcm1zKCkge1xuXG4gICAgICAgIC8vIHRleHR1cmVzXG4gICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmU4SWQuc2V0VmFsdWUodGhpcy5saWdodHNUZXh0dXJlOCk7XG5cbiAgICAgICAgaWYgKExpZ2h0c0J1ZmZlci5saWdodFRleHR1cmVGb3JtYXQgPT09IExpZ2h0c0J1ZmZlci5GT1JNQVRfRkxPQVQpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVGbG9hdElkLnNldFZhbHVlKHRoaXMubGlnaHRzVGV4dHVyZUZsb2F0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xpZ2h0c1RleHR1cmVJbnZTaXplSWQuc2V0VmFsdWUodGhpcy5fbGlnaHRzVGV4dHVyZUludlNpemVEYXRhKTtcbiAgICB9XG5cbiAgICBnZXRTcG90RGlyZWN0aW9uKGRpcmVjdGlvbiwgc3BvdCkge1xuXG4gICAgICAgIC8vIFNwb3RzIHNoaW5lIGRvd24gdGhlIG5lZ2F0aXZlIFkgYXhpc1xuICAgICAgICBjb25zdCBtYXQgPSBzcG90Ll9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgIG1hdC5nZXRZKGRpcmVjdGlvbikubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgZGlyZWN0aW9uLm5vcm1hbGl6ZSgpO1xuICAgIH1cblxuICAgIC8vIGhhbGYgc2l6ZXMgb2YgYXJlYSBsaWdodCBpbiB3b3JsZCBzcGFjZSwgcmV0dXJuZWQgYXMgYW4gYXJyYXkgb2YgNiBmbG9hdHNcbiAgICBnZXRMaWdodEFyZWFTaXplcyhsaWdodCkge1xuXG4gICAgICAgIGNvbnN0IG1hdCA9IGxpZ2h0Ll9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG5cbiAgICAgICAgbWF0LnRyYW5zZm9ybVZlY3RvcihhcmVhSGFsZkF4aXNXaWR0aCwgdGVtcFZlYzMpO1xuICAgICAgICB0ZW1wQXJlYUxpZ2h0U2l6ZXNbMF0gPSB0ZW1wVmVjMy54O1xuICAgICAgICB0ZW1wQXJlYUxpZ2h0U2l6ZXNbMV0gPSB0ZW1wVmVjMy55O1xuICAgICAgICB0ZW1wQXJlYUxpZ2h0U2l6ZXNbMl0gPSB0ZW1wVmVjMy56O1xuXG4gICAgICAgIG1hdC50cmFuc2Zvcm1WZWN0b3IoYXJlYUhhbGZBeGlzSGVpZ2h0LCB0ZW1wVmVjMyk7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1szXSA9IHRlbXBWZWMzLng7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1s0XSA9IHRlbXBWZWMzLnk7XG4gICAgICAgIHRlbXBBcmVhTGlnaHRTaXplc1s1XSA9IHRlbXBWZWMzLno7XG5cbiAgICAgICAgcmV0dXJuIHRlbXBBcmVhTGlnaHRTaXplcztcbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFGbGFncyhkYXRhOCwgaW5kZXgsIGxpZ2h0LCBpc1Nwb3QsIGNhc3RTaGFkb3dzLCBzaGFkb3dJbnRlbnNpdHkpIHtcbiAgICAgICAgZGF0YThbaW5kZXggKyAwXSA9IGlzU3BvdCA/IDI1NSA6IDA7XG4gICAgICAgIGRhdGE4W2luZGV4ICsgMV0gPSBsaWdodC5fc2hhcGUgKiA2NDsgICAgICAgICAgIC8vIHZhbHVlIDAuLjNcbiAgICAgICAgZGF0YThbaW5kZXggKyAyXSA9IGxpZ2h0Ll9mYWxsb2ZmTW9kZSAqIDI1NTsgICAgLy8gdmFsdWUgMC4uMVxuICAgICAgICBkYXRhOFtpbmRleCArIDNdID0gY2FzdFNoYWRvd3MgPyBzaGFkb3dJbnRlbnNpdHkgKiAyNTUgOiAwO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YUNvbG9yKGRhdGE4LCBpbmRleCwgbGlnaHQsIGdhbW1hQ29ycmVjdGlvbiwgaXNDb29raWUpIHtcbiAgICAgICAgY29uc3QgaW52TWF4Q29sb3JWYWx1ZSA9IHRoaXMuaW52TWF4Q29sb3JWYWx1ZTtcbiAgICAgICAgY29uc3QgY29sb3IgPSBnYW1tYUNvcnJlY3Rpb24gPyBsaWdodC5fbGluZWFyRmluYWxDb2xvciA6IGxpZ2h0Ll9maW5hbENvbG9yO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoY29sb3JbMF0gKiBpbnZNYXhDb2xvclZhbHVlLCBkYXRhOCwgaW5kZXggKyAwLCAyKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGNvbG9yWzFdICogaW52TWF4Q29sb3JWYWx1ZSwgZGF0YTgsIGluZGV4ICsgMiwgMik7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhjb2xvclsyXSAqIGludk1heENvbG9yVmFsdWUsIGRhdGE4LCBpbmRleCArIDQsIDIpO1xuXG4gICAgICAgIC8vIGNvb2tpZVxuICAgICAgICBkYXRhOFtpbmRleCArIDZdID0gaXNDb29raWUgPyAyNTUgOiAwO1xuXG4gICAgICAgIC8vIGxpZ2h0TWFza1xuICAgICAgICAvLyAwOiBNQVNLX0FGRkVDVF9EWU5BTUlDXG4gICAgICAgIC8vIDEyNzogTUFTS19BRkZFQ1RfRFlOQU1JQyAmJiBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRFxuICAgICAgICAvLyAyNTU6IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEXG4gICAgICAgIGNvbnN0IGlzRHluYW1pYyA9ICEhKGxpZ2h0Lm1hc2sgJiBNQVNLX0FGRkVDVF9EWU5BTUlDKTtcbiAgICAgICAgY29uc3QgaXNMaWdodG1hcHBlZCA9ICEhKGxpZ2h0Lm1hc2sgJiBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCk7XG4gICAgICAgIGRhdGE4W2luZGV4ICsgN10gPSAoaXNEeW5hbWljICYmIGlzTGlnaHRtYXBwZWQpID8gMTI3IDogKGlzTGlnaHRtYXBwZWQgPyAyNTUgOiAwKTtcbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFTcG90QW5nbGVzKGRhdGE4LCBpbmRleCwgbGlnaHQpIHtcbiAgICAgICAgLy8gMiBieXRlcyBlYWNoXG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhsaWdodC5faW5uZXJDb25lQW5nbGVDb3MgKiAoMC41IC0gZXBzaWxvbikgKyAwLjUsIGRhdGE4LCBpbmRleCArIDAsIDIpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMobGlnaHQuX291dGVyQ29uZUFuZ2xlQ29zICogKDAuNSAtIGVwc2lsb24pICsgMC41LCBkYXRhOCwgaW5kZXggKyAyLCAyKTtcbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFTaGFkb3dCaWFzKGRhdGE4LCBpbmRleCwgbGlnaHQpIHtcbiAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YShudWxsLCAwKTtcbiAgICAgICAgY29uc3QgYmlhc2VzID0gbGlnaHQuX2dldFVuaWZvcm1CaWFzVmFsdWVzKGxpZ2h0UmVuZGVyRGF0YSk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlc1JhbmdlKGJpYXNlcy5iaWFzLCBkYXRhOCwgaW5kZXgsIC0xLCAyMCwgMik7ICAvLyBiaWFzOiAtMSB0byAyMCByYW5nZVxuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoYmlhc2VzLm5vcm1hbEJpYXMsIGRhdGE4LCBpbmRleCArIDIsIDIpOyAgICAgLy8gbm9ybWFsQmlhczogMCB0byAxIHJhbmdlXG4gICAgfVxuXG4gICAgYWRkTGlnaHREYXRhUG9zaXRpb25SYW5nZShkYXRhOCwgaW5kZXgsIGxpZ2h0LCBwb3MpIHtcbiAgICAgICAgLy8gcG9zaXRpb24gYW5kIHJhbmdlIHNjYWxlZCB0byAwLi4xIHJhbmdlXG4gICAgICAgIGNvbnN0IG5vcm1Qb3MgPSB0ZW1wVmVjMy5zdWIyKHBvcywgdGhpcy5ib3VuZHNNaW4pLmRpdih0aGlzLmJvdW5kc0RlbHRhKTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKG5vcm1Qb3MueCwgZGF0YTgsIGluZGV4ICsgMCwgNCk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhub3JtUG9zLnksIGRhdGE4LCBpbmRleCArIDQsIDQpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMobm9ybVBvcy56LCBkYXRhOCwgaW5kZXggKyA4LCA0KTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGxpZ2h0LmF0dGVudWF0aW9uRW5kICogdGhpcy5pbnZNYXhBdHRlbnVhdGlvbiwgZGF0YTgsIGluZGV4ICsgMTIsIDQpO1xuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YVNwb3REaXJlY3Rpb24oZGF0YTgsIGluZGV4LCBsaWdodCkge1xuICAgICAgICB0aGlzLmdldFNwb3REaXJlY3Rpb24odGVtcFZlYzMsIGxpZ2h0KTtcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKHRlbXBWZWMzLnggKiAoMC41IC0gZXBzaWxvbikgKyAwLjUsIGRhdGE4LCBpbmRleCArIDAsIDQpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXModGVtcFZlYzMueSAqICgwLjUgLSBlcHNpbG9uKSArIDAuNSwgZGF0YTgsIGluZGV4ICsgNCwgNCk7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyh0ZW1wVmVjMy56ICogKDAuNSAtIGVwc2lsb24pICsgMC41LCBkYXRhOCwgaW5kZXggKyA4LCA0KTtcbiAgICB9XG5cbiAgICBhZGRMaWdodERhdGFMaWdodFByb2pNYXRyaXgoZGF0YTgsIGluZGV4LCBsaWdodFByb2plY3Rpb25NYXRyaXgpIHtcbiAgICAgICAgY29uc3QgbWF0RGF0YSA9IGxpZ2h0UHJvamVjdGlvbk1hdHJpeC5kYXRhO1xuICAgICAgICBmb3IgKGxldCBtID0gMDsgbSA8IDEyOyBtKyspICAgIC8vIHRoZXNlIGFyZSBpbiAtMi4uMiByYW5nZVxuICAgICAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzUmFuZ2UobWF0RGF0YVttXSwgZGF0YTgsIGluZGV4ICsgNCAqIG0sIC0yLCAyLCA0KTtcbiAgICAgICAgZm9yIChsZXQgbSA9IDEyOyBtIDwgMTY7IG0rKykgeyAgLy8gdGhlc2UgYXJlIGZ1bGwgZmxvYXQgcmFuZ2VcbiAgICAgICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJNYW50aXNzYUV4cG9uZW50KG1hdERhdGFbbV0sIGRhdGE4LCBpbmRleCArIDQgKiBtLCA0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZExpZ2h0RGF0YUNvb2tpZXMoZGF0YTgsIGluZGV4LCBsaWdodCkge1xuICAgICAgICBjb25zdCBpc1JnYiA9IGxpZ2h0Ll9jb29raWVDaGFubmVsID09PSAncmdiJztcbiAgICAgICAgZGF0YThbaW5kZXggKyAwXSA9IE1hdGguZmxvb3IobGlnaHQuY29va2llSW50ZW5zaXR5ICogMjU1KTtcbiAgICAgICAgZGF0YThbaW5kZXggKyAxXSA9IGlzUmdiID8gMjU1IDogMDtcbiAgICAgICAgLy8gd2UgaGF2ZSB0d28gdW51c2VkIGJ5dGVzIGhlcmVcblxuICAgICAgICBpZiAoIWlzUmdiKSB7XG4gICAgICAgICAgICBjb25zdCBjaGFubmVsID0gbGlnaHQuX2Nvb2tpZUNoYW5uZWw7XG4gICAgICAgICAgICBkYXRhOFtpbmRleCArIDRdID0gY2hhbm5lbCA9PT0gJ3JycicgPyAyNTUgOiAwO1xuICAgICAgICAgICAgZGF0YThbaW5kZXggKyA1XSA9IGNoYW5uZWwgPT09ICdnZ2cnID8gMjU1IDogMDtcbiAgICAgICAgICAgIGRhdGE4W2luZGV4ICsgNl0gPSBjaGFubmVsID09PSAnYmJiJyA/IDI1NSA6IDA7XG4gICAgICAgICAgICBkYXRhOFtpbmRleCArIDddID0gY2hhbm5lbCA9PT0gJ2FhYScgPyAyNTUgOiAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkTGlnaHRBdGxhc1ZpZXdwb3J0KGRhdGE4LCBpbmRleCwgYXRsYXNWaWV3cG9ydCkge1xuICAgICAgICAvLyBhbGwgdGhlc2UgYXJlIGluIDAuLjEgcmFuZ2VcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzKGF0bGFzVmlld3BvcnQueCwgZGF0YTgsIGluZGV4ICsgMCwgMik7XG4gICAgICAgIEZsb2F0UGFja2luZy5mbG9hdDJCeXRlcyhhdGxhc1ZpZXdwb3J0LnksIGRhdGE4LCBpbmRleCArIDIsIDIpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXMoYXRsYXNWaWV3cG9ydC56IC8gMywgZGF0YTgsIGluZGV4ICsgNCwgMik7XG4gICAgICAgIC8vIHdlIGhhdmUgdHdvIHVudXNlZCBieXRlcyBoZXJlXG4gICAgfVxuXG4gICAgYWRkTGlnaHRBcmVhU2l6ZXMoZGF0YTgsIGluZGV4LCBsaWdodCkge1xuICAgICAgICBjb25zdCBhcmVhU2l6ZXMgPSB0aGlzLmdldExpZ2h0QXJlYVNpemVzKGxpZ2h0KTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHsgIC8vIHRoZXNlIGFyZSBmdWxsIGZsb2F0IHJhbmdlXG4gICAgICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyTWFudGlzc2FFeHBvbmVudChhcmVhU2l6ZXNbaV0sIGRhdGE4LCBpbmRleCArIDQgKiBpLCA0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZpbGwgdXAgYm90aCBmbG9hdCBhbmQgOGJpdCB0ZXh0dXJlIGRhdGEgd2l0aCBsaWdodCBwcm9wZXJ0aWVzXG4gICAgYWRkTGlnaHREYXRhKGxpZ2h0LCBsaWdodEluZGV4LCBnYW1tYUNvcnJlY3Rpb24pIHtcblxuICAgICAgICBjb25zdCBpc1Nwb3QgPSBsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1Q7XG4gICAgICAgIGNvbnN0IGhhc0F0bGFzVmlld3BvcnQgPSBsaWdodC5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkOyAvLyBpZiB0aGUgbGlnaHQgZG9lcyBub3QgaGF2ZSB2aWV3cG9ydCwgaXQgZG9lcyBub3QgZml0IHRvIHRoZSBhdGxhc1xuICAgICAgICBjb25zdCBpc0Nvb2tpZSA9IHRoaXMuY29va2llc0VuYWJsZWQgJiYgISFsaWdodC5fY29va2llICYmIGhhc0F0bGFzVmlld3BvcnQ7XG4gICAgICAgIGNvbnN0IGlzQXJlYSA9IHRoaXMuYXJlYUxpZ2h0c0VuYWJsZWQgJiYgbGlnaHQuc2hhcGUgIT09IExJR0hUU0hBUEVfUFVOQ1RVQUw7XG4gICAgICAgIGNvbnN0IGNhc3RTaGFkb3dzID0gdGhpcy5zaGFkb3dzRW5hYmxlZCAmJiBsaWdodC5jYXN0U2hhZG93cyAmJiBoYXNBdGxhc1ZpZXdwb3J0O1xuICAgICAgICBjb25zdCBwb3MgPSBsaWdodC5fbm9kZS5nZXRQb3NpdGlvbigpO1xuXG4gICAgICAgIGxldCBsaWdodFByb2plY3Rpb25NYXRyaXggPSBudWxsOyAgIC8vIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4IC0gdXNlZCBmb3Igc2hhZG93IG1hcCBhbmQgY29va2llIG9mIHNwb3QgbGlnaHRcbiAgICAgICAgbGV0IGF0bGFzVmlld3BvcnQgPSBudWxsOyAgIC8vIGF0bGFzIHZpZXdwb3J0IGluZm8gLSB1c2VkIGZvciBzaGFkb3cgbWFwIGFuZCBjb29raWUgb2Ygb21uaSBsaWdodFxuICAgICAgICBpZiAoaXNTcG90KSB7XG4gICAgICAgICAgICBpZiAoY2FzdFNoYWRvd3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodFJlbmRlckRhdGEgPSBsaWdodC5nZXRSZW5kZXJEYXRhKG51bGwsIDApO1xuICAgICAgICAgICAgICAgIGxpZ2h0UHJvamVjdGlvbk1hdHJpeCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dNYXRyaXg7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzQ29va2llKSB7XG4gICAgICAgICAgICAgICAgbGlnaHRQcm9qZWN0aW9uTWF0cml4ID0gTGlnaHRDYW1lcmEuZXZhbFNwb3RDb29raWVNYXRyaXgobGlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGNhc3RTaGFkb3dzIHx8IGlzQ29va2llKSB7XG4gICAgICAgICAgICAgICAgYXRsYXNWaWV3cG9ydCA9IGxpZ2h0LmF0bGFzVmlld3BvcnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkYXRhIGFsd2F5cyBzdG9yZWQgaW4gOGJpdCB0ZXh0dXJlXG4gICAgICAgIGNvbnN0IGRhdGE4ID0gdGhpcy5saWdodHM4O1xuICAgICAgICBjb25zdCBkYXRhOFN0YXJ0ID0gbGlnaHRJbmRleCAqIHRoaXMubGlnaHRzVGV4dHVyZTgud2lkdGggKiA0O1xuXG4gICAgICAgIC8vIGZsYWdzXG4gICAgICAgIHRoaXMuYWRkTGlnaHREYXRhRmxhZ3MoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5GTEFHUywgbGlnaHQsIGlzU3BvdCwgY2FzdFNoYWRvd3MsIGxpZ2h0LnNoYWRvd0ludGVuc2l0eSk7XG5cbiAgICAgICAgLy8gbGlnaHQgY29sb3JcbiAgICAgICAgdGhpcy5hZGRMaWdodERhdGFDb2xvcihkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LkNPTE9SX0EsIGxpZ2h0LCBnYW1tYUNvcnJlY3Rpb24sIGlzQ29va2llKTtcblxuICAgICAgICAvLyBzcG90IGxpZ2h0IGFuZ2xlc1xuICAgICAgICBpZiAoaXNTcG90KSB7XG4gICAgICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YVNwb3RBbmdsZXMoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5TUE9UX0FOR0xFUywgbGlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2hhZG93IGJpYXNlc1xuICAgICAgICBpZiAobGlnaHQuY2FzdFNoYWRvd3MpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhU2hhZG93QmlhcyhkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LlNIQURPV19CSUFTLCBsaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb29raWUgcHJvcGVydGllc1xuICAgICAgICBpZiAoaXNDb29raWUpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTGlnaHREYXRhQ29va2llcyhkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LkNPT0tJRV9BLCBsaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoaWdoIHByZWNpc2lvbiBkYXRhIHN0b3JlZCB1c2luZyBmbG9hdCB0ZXh0dXJlXG4gICAgICAgIGlmIChMaWdodHNCdWZmZXIubGlnaHRUZXh0dXJlRm9ybWF0ID09PSBMaWdodHNCdWZmZXIuRk9STUFUX0ZMT0FUKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IGRhdGFGbG9hdCA9IHRoaXMubGlnaHRzRmxvYXQ7XG4gICAgICAgICAgICBjb25zdCBkYXRhRmxvYXRTdGFydCA9IGxpZ2h0SW5kZXggKiB0aGlzLmxpZ2h0c1RleHR1cmVGbG9hdC53aWR0aCAqIDQ7XG5cbiAgICAgICAgICAgIC8vIHBvcyBhbmQgcmFuZ2VcbiAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5QT1NJVElPTl9SQU5HRSArIDBdID0gcG9zLng7XG4gICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuUE9TSVRJT05fUkFOR0UgKyAxXSA9IHBvcy55O1xuICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlBPU0lUSU9OX1JBTkdFICsgMl0gPSBwb3MuejtcbiAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5QT1NJVElPTl9SQU5HRSArIDNdID0gbGlnaHQuYXR0ZW51YXRpb25FbmQ7XG5cbiAgICAgICAgICAgIC8vIHNwb3QgZGlyZWN0aW9uXG4gICAgICAgICAgICBpZiAoaXNTcG90KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5nZXRTcG90RGlyZWN0aW9uKHRlbXBWZWMzLCBsaWdodCk7XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LlNQT1RfRElSRUNUSU9OICsgMF0gPSB0ZW1wVmVjMy54O1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5TUE9UX0RJUkVDVElPTiArIDFdID0gdGVtcFZlYzMueTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuU1BPVF9ESVJFQ1RJT04gKyAyXSA9IHRlbXBWZWMzLno7XG4gICAgICAgICAgICAgICAgLy8gaGVyZSB3ZSBoYXZlIHVudXNlZCBmbG9hdFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBsaWdodCBwcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICAgICAgaWYgKGxpZ2h0UHJvamVjdGlvbk1hdHJpeCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdERhdGEgPSBsaWdodFByb2plY3Rpb25NYXRyaXguZGF0YTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBtID0gMDsgbSA8IDE2OyBtKyspXG4gICAgICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5QUk9KX01BVF8wICsgbV0gPSBtYXREYXRhW21dO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXRsYXNWaWV3cG9ydCkge1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BVExBU19WSUVXUE9SVCArIDBdID0gYXRsYXNWaWV3cG9ydC54O1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BVExBU19WSUVXUE9SVCArIDFdID0gYXRsYXNWaWV3cG9ydC55O1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BVExBU19WSUVXUE9SVCArIDJdID0gYXRsYXNWaWV3cG9ydC56IC8gMzsgLy8gc2l6ZSBvZiBhIGZhY2Ugc2xvdCAoM3gzIGdyaWQpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgc2l6ZXNcbiAgICAgICAgICAgIGlmIChpc0FyZWEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhcmVhU2l6ZXMgPSB0aGlzLmdldExpZ2h0QXJlYVNpemVzKGxpZ2h0KTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVJFQV9EQVRBX1dJRFRIICsgMF0gPSBhcmVhU2l6ZXNbMF07XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFSRUFfREFUQV9XSURUSCArIDFdID0gYXJlYVNpemVzWzFdO1xuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BUkVBX0RBVEFfV0lEVEggKyAyXSA9IGFyZWFTaXplc1syXTtcblxuICAgICAgICAgICAgICAgIGRhdGFGbG9hdFtkYXRhRmxvYXRTdGFydCArIDQgKiBUZXh0dXJlSW5kZXhGbG9hdC5BUkVBX0RBVEFfSEVJR0hUICsgMF0gPSBhcmVhU2l6ZXNbM107XG4gICAgICAgICAgICAgICAgZGF0YUZsb2F0W2RhdGFGbG9hdFN0YXJ0ICsgNCAqIFRleHR1cmVJbmRleEZsb2F0LkFSRUFfREFUQV9IRUlHSFQgKyAxXSA9IGFyZWFTaXplc1s0XTtcbiAgICAgICAgICAgICAgICBkYXRhRmxvYXRbZGF0YUZsb2F0U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4RmxvYXQuQVJFQV9EQVRBX0hFSUdIVCArIDJdID0gYXJlYVNpemVzWzVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7ICAgIC8vIGhpZ2ggcHJlY2lzaW9uIGRhdGEgc3RvcmVkIHVzaW5nIDhiaXQgdGV4dHVyZVxuXG4gICAgICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YVBvc2l0aW9uUmFuZ2UoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5QT1NJVElPTl9YLCBsaWdodCwgcG9zKTtcblxuICAgICAgICAgICAgLy8gc3BvdCBkaXJlY3Rpb25cbiAgICAgICAgICAgIGlmIChpc1Nwb3QpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExpZ2h0RGF0YVNwb3REaXJlY3Rpb24oZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5TUE9UX0RJUkVDVElPTl9YLCBsaWdodCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0IHByb2plY3Rpb24gbWF0cml4XG4gICAgICAgICAgICBpZiAobGlnaHRQcm9qZWN0aW9uTWF0cml4KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRMaWdodERhdGFMaWdodFByb2pNYXRyaXgoZGF0YTgsIGRhdGE4U3RhcnQgKyA0ICogVGV4dHVyZUluZGV4OC5QUk9KX01BVF8wMCwgbGlnaHRQcm9qZWN0aW9uTWF0cml4KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGF0bGFzVmlld3BvcnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExpZ2h0QXRsYXNWaWV3cG9ydChkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LkFUTEFTX1ZJRVdQT1JUX0EsIGF0bGFzVmlld3BvcnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhcmVhIGxpZ2h0IHNpemVzXG4gICAgICAgICAgICBpZiAoaXNBcmVhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRMaWdodEFyZWFTaXplcyhkYXRhOCwgZGF0YThTdGFydCArIDQgKiBUZXh0dXJlSW5kZXg4LkFSRUFfREFUQV9XSURUSF9YLCBsaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IExpZ2h0c0J1ZmZlciB9O1xuIl0sIm5hbWVzIjpbImVwc2lsb24iLCJ0ZW1wVmVjMyIsIlZlYzMiLCJ0ZW1wQXJlYUxpZ2h0U2l6ZXMiLCJGbG9hdDMyQXJyYXkiLCJhcmVhSGFsZkF4aXNXaWR0aCIsImFyZWFIYWxmQXhpc0hlaWdodCIsIlRleHR1cmVJbmRleDgiLCJGTEFHUyIsIkNPTE9SX0EiLCJDT0xPUl9CIiwiU1BPVF9BTkdMRVMiLCJTSEFET1dfQklBUyIsIkNPT0tJRV9BIiwiQ09PS0lFX0IiLCJDT1VOVF9BTFdBWVMiLCJQT1NJVElPTl9YIiwiUE9TSVRJT05fWSIsIlBPU0lUSU9OX1oiLCJSQU5HRSIsIlNQT1RfRElSRUNUSU9OX1giLCJTUE9UX0RJUkVDVElPTl9ZIiwiU1BPVF9ESVJFQ1RJT05fWiIsIlBST0pfTUFUXzAwIiwiQVRMQVNfVklFV1BPUlRfQSIsIlBST0pfTUFUXzAxIiwiQVRMQVNfVklFV1BPUlRfQiIsIlBST0pfTUFUXzAyIiwiUFJPSl9NQVRfMDMiLCJQUk9KX01BVF8xMCIsIlBST0pfTUFUXzExIiwiUFJPSl9NQVRfMTIiLCJQUk9KX01BVF8xMyIsIlBST0pfTUFUXzIwIiwiUFJPSl9NQVRfMjEiLCJQUk9KX01BVF8yMiIsIlBST0pfTUFUXzIzIiwiUFJPSl9NQVRfMzAiLCJQUk9KX01BVF8zMSIsIlBST0pfTUFUXzMyIiwiUFJPSl9NQVRfMzMiLCJBUkVBX0RBVEFfV0lEVEhfWCIsIkFSRUFfREFUQV9XSURUSF9ZIiwiQVJFQV9EQVRBX1dJRFRIX1oiLCJBUkVBX0RBVEFfSEVJR0hUX1giLCJBUkVBX0RBVEFfSEVJR0hUX1kiLCJBUkVBX0RBVEFfSEVJR0hUX1oiLCJDT1VOVCIsIlRleHR1cmVJbmRleEZsb2F0IiwiUE9TSVRJT05fUkFOR0UiLCJTUE9UX0RJUkVDVElPTiIsIlBST0pfTUFUXzAiLCJBVExBU19WSUVXUE9SVCIsIlBST0pfTUFUXzEiLCJQUk9KX01BVF8yIiwiUFJPSl9NQVRfMyIsIkFSRUFfREFUQV9XSURUSCIsIkFSRUFfREFUQV9IRUlHSFQiLCJMaWdodHNCdWZmZXIiLCJpbml0U2hhZGVyRGVmaW5lcyIsImNsdXN0ZXJUZXh0dXJlRm9ybWF0IiwibGlnaHRUZXh0dXJlRm9ybWF0IiwiRk9STUFUX0ZMT0FUIiwic2hhZGVyRGVmaW5lcyIsImJ1aWxkU2hhZGVyRGVmaW5lcyIsIm9iamVjdCIsInByZWZpeCIsInN0ciIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwia2V5IiwiaW5pdCIsImRldmljZSIsImV4dFRleHR1cmVGbG9hdCIsIm1heFRleHR1cmVzIiwiRk9STUFUXzhCSVQiLCJjcmVhdGVUZXh0dXJlIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJuYW1lIiwidGV4IiwiVGV4dHVyZSIsIm1pcG1hcHMiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwidHlwZSIsIlRFWFRVUkVUWVBFX0RFRkFVTFQiLCJtYWdGaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1pbkZpbHRlciIsImFuaXNvdHJvcHkiLCJjb25zdHJ1Y3RvciIsImNvb2tpZXNFbmFibGVkIiwic2hhZG93c0VuYWJsZWQiLCJhcmVhTGlnaHRzRW5hYmxlZCIsIm1heExpZ2h0cyIsInBpeGVsc1BlckxpZ2h0OCIsInBpeGVsc1BlckxpZ2h0RmxvYXQiLCJsaWdodHM4IiwiVWludDhDbGFtcGVkQXJyYXkiLCJsaWdodHNUZXh0dXJlOCIsIlBJWEVMRk9STUFUX1I4X0c4X0I4X0E4IiwiX2xpZ2h0c1RleHR1cmU4SWQiLCJzY29wZSIsInJlc29sdmUiLCJsaWdodHNGbG9hdCIsImxpZ2h0c1RleHR1cmVGbG9hdCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJfbGlnaHRzVGV4dHVyZUZsb2F0SWQiLCJ1bmRlZmluZWQiLCJfbGlnaHRzVGV4dHVyZUludlNpemVJZCIsIl9saWdodHNUZXh0dXJlSW52U2l6ZURhdGEiLCJpbnZNYXhDb2xvclZhbHVlIiwiaW52TWF4QXR0ZW51YXRpb24iLCJib3VuZHNNaW4iLCJib3VuZHNEZWx0YSIsImRlc3Ryb3kiLCJzZXRDb21wcmVzc2lvblJhbmdlcyIsIm1heEF0dGVudWF0aW9uIiwibWF4Q29sb3JWYWx1ZSIsInNldEJvdW5kcyIsIm1pbiIsImRlbHRhIiwiY29weSIsInVwbG9hZFRleHR1cmVzIiwibG9jayIsInNldCIsInVubG9jayIsInVwZGF0ZVVuaWZvcm1zIiwic2V0VmFsdWUiLCJnZXRTcG90RGlyZWN0aW9uIiwiZGlyZWN0aW9uIiwic3BvdCIsIm1hdCIsIl9ub2RlIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJnZXRZIiwibXVsU2NhbGFyIiwibm9ybWFsaXplIiwiZ2V0TGlnaHRBcmVhU2l6ZXMiLCJsaWdodCIsInRyYW5zZm9ybVZlY3RvciIsIngiLCJ5IiwieiIsImFkZExpZ2h0RGF0YUZsYWdzIiwiZGF0YTgiLCJpbmRleCIsImlzU3BvdCIsImNhc3RTaGFkb3dzIiwic2hhZG93SW50ZW5zaXR5IiwiX3NoYXBlIiwiX2ZhbGxvZmZNb2RlIiwiYWRkTGlnaHREYXRhQ29sb3IiLCJnYW1tYUNvcnJlY3Rpb24iLCJpc0Nvb2tpZSIsImNvbG9yIiwiX2xpbmVhckZpbmFsQ29sb3IiLCJfZmluYWxDb2xvciIsIkZsb2F0UGFja2luZyIsImZsb2F0MkJ5dGVzIiwiaXNEeW5hbWljIiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJpc0xpZ2h0bWFwcGVkIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJhZGRMaWdodERhdGFTcG90QW5nbGVzIiwiX2lubmVyQ29uZUFuZ2xlQ29zIiwiX291dGVyQ29uZUFuZ2xlQ29zIiwiYWRkTGlnaHREYXRhU2hhZG93QmlhcyIsImxpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJiaWFzZXMiLCJfZ2V0VW5pZm9ybUJpYXNWYWx1ZXMiLCJmbG9hdDJCeXRlc1JhbmdlIiwiYmlhcyIsIm5vcm1hbEJpYXMiLCJhZGRMaWdodERhdGFQb3NpdGlvblJhbmdlIiwicG9zIiwibm9ybVBvcyIsInN1YjIiLCJkaXYiLCJhdHRlbnVhdGlvbkVuZCIsImFkZExpZ2h0RGF0YVNwb3REaXJlY3Rpb24iLCJhZGRMaWdodERhdGFMaWdodFByb2pNYXRyaXgiLCJsaWdodFByb2plY3Rpb25NYXRyaXgiLCJtYXREYXRhIiwiZGF0YSIsIm0iLCJmbG9hdDJNYW50aXNzYUV4cG9uZW50IiwiYWRkTGlnaHREYXRhQ29va2llcyIsImlzUmdiIiwiX2Nvb2tpZUNoYW5uZWwiLCJNYXRoIiwiZmxvb3IiLCJjb29raWVJbnRlbnNpdHkiLCJjaGFubmVsIiwiYWRkTGlnaHRBdGxhc1ZpZXdwb3J0IiwiYXRsYXNWaWV3cG9ydCIsImFkZExpZ2h0QXJlYVNpemVzIiwiYXJlYVNpemVzIiwiaSIsImFkZExpZ2h0RGF0YSIsImxpZ2h0SW5kZXgiLCJfdHlwZSIsIkxJR0hUVFlQRV9TUE9UIiwiaGFzQXRsYXNWaWV3cG9ydCIsImF0bGFzVmlld3BvcnRBbGxvY2F0ZWQiLCJfY29va2llIiwiaXNBcmVhIiwic2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiZ2V0UG9zaXRpb24iLCJzaGFkb3dNYXRyaXgiLCJMaWdodENhbWVyYSIsImV2YWxTcG90Q29va2llTWF0cml4IiwiZGF0YThTdGFydCIsImRhdGFGbG9hdCIsImRhdGFGbG9hdFN0YXJ0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFPQSxNQUFNQSxPQUFPLEdBQUcsUUFBUSxDQUFBO0FBRXhCLE1BQU1DLFFBQVEsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUMzQixNQUFNQyxrQkFBa0IsR0FBRyxJQUFJQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDOUMsTUFBTUMsaUJBQWlCLEdBQUcsSUFBSUgsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUM5QyxNQUFNSSxrQkFBa0IsR0FBRyxJQUFJSixJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQTs7QUFJOUMsTUFBTUssYUFBYSxHQUFHO0FBR2xCQyxFQUFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSQyxFQUFBQSxPQUFPLEVBQUUsQ0FBQztBQUNWQyxFQUFBQSxPQUFPLEVBQUUsQ0FBQztBQUNWQyxFQUFBQSxXQUFXLEVBQUUsQ0FBQztBQUNkQyxFQUFBQSxXQUFXLEVBQUUsQ0FBQztBQUNkQyxFQUFBQSxRQUFRLEVBQUUsQ0FBQztBQUNYQyxFQUFBQSxRQUFRLEVBQUUsQ0FBQzs7QUFHWEMsRUFBQUEsWUFBWSxFQUFFLENBQUM7QUFHZkMsRUFBQUEsVUFBVSxFQUFFLENBQUM7QUFDYkMsRUFBQUEsVUFBVSxFQUFFLENBQUM7QUFDYkMsRUFBQUEsVUFBVSxFQUFFLENBQUM7QUFDYkMsRUFBQUEsS0FBSyxFQUFFLEVBQUU7QUFDVEMsRUFBQUEsZ0JBQWdCLEVBQUUsRUFBRTtBQUNwQkMsRUFBQUEsZ0JBQWdCLEVBQUUsRUFBRTtBQUNwQkMsRUFBQUEsZ0JBQWdCLEVBQUUsRUFBRTs7QUFFcEJDLEVBQUFBLFdBQVcs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
