/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { random } from '../../core/math/random.js';
import { Vec3 } from '../../core/math/vec3.js';
import { TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_CUBE, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from '../../platform/graphics/simple-post-effect.js';
import { Texture } from '../../platform/graphics/texture.js';
import { ChunkUtils } from '../shader-lib/chunk-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { createShaderFromCode } from '../shader-lib/utils.js';

const getProjectionName = projection => {
  switch (projection) {
    case TEXTUREPROJECTION_CUBE:
      return "Cubemap";
    case TEXTUREPROJECTION_OCTAHEDRAL:
      return "Octahedral";
    default:
      return "Equirect";
  }
};

const packFloat32ToRGBA8 = (value, array, offset) => {
  if (value <= 0) {
    array[offset + 0] = 0;
    array[offset + 1] = 0;
    array[offset + 2] = 0;
    array[offset + 3] = 0;
  } else if (value >= 1.0) {
    array[offset + 0] = 255;
    array[offset + 1] = 0;
    array[offset + 2] = 0;
    array[offset + 3] = 0;
  } else {
    let encX = 1 * value % 1;
    let encY = 255 * value % 1;
    let encZ = 65025 * value % 1;
    const encW = 16581375.0 * value % 1;
    encX -= encY / 255;
    encY -= encZ / 255;
    encZ -= encW / 255;
    array[offset + 0] = Math.min(255, Math.floor(encX * 256));
    array[offset + 1] = Math.min(255, Math.floor(encY * 256));
    array[offset + 2] = Math.min(255, Math.floor(encZ * 256));
    array[offset + 3] = Math.min(255, Math.floor(encW * 256));
  }
};

const packSamples = samples => {
  const numSamples = samples.length;
  const w = Math.min(numSamples, 512);
  const h = Math.ceil(numSamples / w);
  const data = new Uint8Array(w * h * 4);

  let off = 0;
  for (let i = 0; i < numSamples; i += 4) {
    packFloat32ToRGBA8(samples[i + 0] * 0.5 + 0.5, data, off + 0);
    packFloat32ToRGBA8(samples[i + 1] * 0.5 + 0.5, data, off + 4);
    packFloat32ToRGBA8(samples[i + 2] * 0.5 + 0.5, data, off + 8);
    packFloat32ToRGBA8(samples[i + 3] / 8, data, off + 12);
    off += 16;
  }
  return {
    width: w,
    height: h,
    data: data
  };
};

const hemisphereSamplePhong = (dstVec, x, y, specularPower) => {
  const phi = y * 2 * Math.PI;
  const cosTheta = Math.pow(1 - x, 1 / (specularPower + 1));
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

const hemisphereSampleLambert = (dstVec, x, y) => {
  const phi = y * 2 * Math.PI;
  const cosTheta = Math.sqrt(1 - x);
  const sinTheta = Math.sqrt(x);
  dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

const hemisphereSampleGGX = (dstVec, x, y, a) => {
  const phi = y * 2 * Math.PI;
  const cosTheta = Math.sqrt((1 - x) / (1 + (a * a - 1) * x));
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};
const D_GGX = (NoH, linearRoughness) => {
  const a = NoH * linearRoughness;
  const k = linearRoughness / (1.0 - NoH * NoH + a * a);
  return k * k * (1 / Math.PI);
};

const generatePhongSamples = (numSamples, specularPower) => {
  const H = new Vec3();
  const result = [];
  for (let i = 0; i < numSamples; ++i) {
    hemisphereSamplePhong(H, i / numSamples, random.radicalInverse(i), specularPower);
    result.push(H.x, H.y, H.z, 0);
  }
  return result;
};

const generateLambertSamples = (numSamples, sourceTotalPixels) => {
  const pixelsPerSample = sourceTotalPixels / numSamples;
  const H = new Vec3();
  const result = [];
  for (let i = 0; i < numSamples; ++i) {
    hemisphereSampleLambert(H, i / numSamples, random.radicalInverse(i));
    const pdf = H.z / Math.PI;
    const mipLevel = 0.5 * Math.log2(pixelsPerSample / pdf);
    result.push(H.x, H.y, H.z, mipLevel);
  }
  return result;
};

const requiredSamplesGGX = {
  "16": {
    "2": 26,
    "8": 20,
    "32": 17,
    "128": 16,
    "512": 16
  },
  "32": {
    "2": 53,
    "8": 40,
    "32": 34,
    "128": 32,
    "512": 32
  },
  "128": {
    "2": 214,
    "8": 163,
    "32": 139,
    "128": 130,
    "512": 128
  },
  "1024": {
    "2": 1722,
    "8": 1310,
    "32": 1114,
    "128": 1041,
    "512": 1025
  }
};

const getRequiredSamplesGGX = (numSamples, specularPower) => {
  const table = requiredSamplesGGX[numSamples];
  return table && table[specularPower] || numSamples;
};

const generateGGXSamples = (numSamples, specularPower, sourceTotalPixels) => {
  const pixelsPerSample = sourceTotalPixels / numSamples;
  const roughness = 1 - Math.log2(specularPower) / 11.0;
  const a = roughness * roughness;
  const H = new Vec3();
  const L = new Vec3();
  const N = new Vec3(0, 0, 1);
  const result = [];
  const requiredSamples = getRequiredSamplesGGX(numSamples, specularPower);
  for (let i = 0; i < requiredSamples; ++i) {
    hemisphereSampleGGX(H, i / requiredSamples, random.radicalInverse(i), a);
    const NoH = H.z;
    L.set(H.x, H.y, H.z).mulScalar(2 * NoH).sub(N);
    if (L.z > 0) {
      const pdf = D_GGX(Math.min(1, NoH), a) / 4 + 0.001;
      const mipLevel = 0.5 * Math.log2(pixelsPerSample / pdf);
      result.push(L.x, L.y, L.z, mipLevel);
    }
  }
  while (result.length < numSamples * 4) {
    result.push(0, 0, 0, 0);
  }
  return result;
};

const createSamplesTex = (device, name, samples) => {
  const packedSamples = packSamples(samples);
  return new Texture(device, {
    name: name,
    width: packedSamples.width,
    height: packedSamples.height,
    mipmaps: false,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST,
    levels: [packedSamples.data]
  });
};

class SimpleCache {
  constructor(destroyContent = true) {
    this.map = new Map();
    this.destroyContent = destroyContent;
  }
  destroy() {
    if (this.destroyContent) {
      this.map.forEach((value, key) => {
        value.destroy();
      });
    }
  }
  get(key, missFunc) {
    if (!this.map.has(key)) {
      const result = missFunc();
      this.map.set(key, result);
      return result;
    }
    return this.map.get(key);
  }
}

const samplesCache = new SimpleCache(false);

const deviceCache = new DeviceCache();
const getCachedTexture = (device, key, getSamplesFnc) => {
  const cache = deviceCache.get(device, () => {
    return new SimpleCache();
  });
  return cache.get(key, () => {
    return createSamplesTex(device, key, samplesCache.get(key, getSamplesFnc));
  });
};
const generateLambertSamplesTex = (device, numSamples, sourceTotalPixels) => {
  const key = `lambert-samples-${numSamples}-${sourceTotalPixels}`;
  return getCachedTexture(device, key, () => {
    return generateLambertSamples(numSamples, sourceTotalPixels);
  });
};
const generatePhongSamplesTex = (device, numSamples, specularPower) => {
  const key = `phong-samples-${numSamples}-${specularPower}`;
  return getCachedTexture(device, key, () => {
    return generatePhongSamples(numSamples, specularPower);
  });
};
const generateGGXSamplesTex = (device, numSamples, specularPower, sourceTotalPixels) => {
  const key = `ggx-samples-${numSamples}-${specularPower}-${sourceTotalPixels}`;
  return getCachedTexture(device, key, () => {
    return generateGGXSamples(numSamples, specularPower, sourceTotalPixels);
  });
};
const vsCode = `
attribute vec2 vertex_position;

uniform vec4 uvMod;

varying vec2 vUv0;

void main(void) {
    gl_Position = vec4(vertex_position, 0.5, 1.0);
    vUv0 = (vertex_position.xy * 0.5 + 0.5) * uvMod.xy + uvMod.zw;
}
`;

function reprojectTexture(source, target, options = {}) {
  var _options;
  if (source instanceof GraphicsDevice) {
    source = arguments[1];
    target = arguments[2];
    options = {};
    if (arguments[3] !== undefined) {
      options.specularPower = arguments[3];
    }
    if (arguments[4] !== undefined) {
      options.numSamples = arguments[4];
    }
    Debug.deprecated('please use the updated pc.reprojectTexture API.');
  }

  const funcNames = {
    'none': 'reproject',
    'lambert': 'prefilterSamplesUnweighted',
    'phong': 'prefilterSamplesUnweighted',
    'ggx': 'prefilterSamples'
  };

  const specularPower = options.hasOwnProperty('specularPower') ? options.specularPower : 1;
  const face = options.hasOwnProperty('face') ? options.face : null;
  const distribution = options.hasOwnProperty('distribution') ? options.distribution : specularPower === 1 ? 'none' : 'phong';
  const processFunc = funcNames[distribution] || 'reproject';
  const decodeFunc = ChunkUtils.decodeFunc(source.encoding);
  const encodeFunc = ChunkUtils.encodeFunc(target.encoding);
  const sourceFunc = `sample${getProjectionName(source.projection)}`;
  const targetFunc = `getDirection${getProjectionName(target.projection)}`;
  const numSamples = options.hasOwnProperty('numSamples') ? options.numSamples : 1024;

  const shaderKey = `${processFunc}_${decodeFunc}_${encodeFunc}_${sourceFunc}_${targetFunc}_${numSamples}`;
  const device = source.device;
  let shader = getProgramLibrary(device).getCachedShader(shaderKey);
  if (!shader) {
    const defines = `#define PROCESS_FUNC ${processFunc}\n` + `#define DECODE_FUNC ${decodeFunc}\n` + `#define ENCODE_FUNC ${encodeFunc}\n` + `#define SOURCE_FUNC ${sourceFunc}\n` + `#define TARGET_FUNC ${targetFunc}\n` + `#define NUM_SAMPLES ${numSamples}\n` + `#define NUM_SAMPLES_SQRT ${Math.round(Math.sqrt(numSamples)).toFixed(1)}\n` + (device.extTextureLod ? `#define SUPPORTS_TEXLOD\n` : '');
    let extensions = '';
    if (!device.webgl2) {
      extensions = '#extension GL_OES_standard_derivatives: enable\n';
      if (device.extTextureLod) {
        extensions += '#extension GL_EXT_shader_texture_lod: enable\n\n';
      }
    }
    shader = createShaderFromCode(device, vsCode, `${defines}\n${shaderChunks.reprojectPS}`, shaderKey, false, extensions);
  }
  DebugGraphics.pushGpuMarker(device, "ReprojectTexture");
  const constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
  constantSource.setValue(source);
  const constantParams = device.scope.resolve("params");
  const constantParams2 = device.scope.resolve("params2");
  const uvModParam = device.scope.resolve("uvMod");
  if ((_options = options) != null && _options.seamPixels) {
    const p = options.seamPixels;
    const w = options.rect ? options.rect.z : target.width;
    const h = options.rect ? options.rect.w : target.height;
    const innerWidth = w - p * 2;
    const innerHeight = h - p * 2;
    uvModParam.setValue([(innerWidth + p * 2) / innerWidth, (innerHeight + p * 2) / innerHeight, -p / innerWidth, -p / innerHeight]);
  } else {
    uvModParam.setValue([1, 1, 0, 0]);
  }
  const params = [0, specularPower, source.fixCubemapSeams ? 1.0 / source.width : 0.0,
  target.fixCubemapSeams ? 1.0 / target.width : 0.0];

  const params2 = [target.width * target.height * (target.cubemap ? 6 : 1), source.width * source.height * (source.cubemap ? 6 : 1)];
  if (processFunc.startsWith('prefilterSamples')) {
    const sourceTotalPixels = source.width * source.height * (source.cubemap ? 6 : 1);
    const samplesTex = distribution === 'ggx' ? generateGGXSamplesTex(device, numSamples, specularPower, sourceTotalPixels) : distribution === 'lambert' ? generateLambertSamplesTex(device, numSamples, sourceTotalPixels) : generatePhongSamplesTex(device, numSamples, specularPower);
    device.scope.resolve("samplesTex").setValue(samplesTex);
    device.scope.resolve("samplesTexInverseSize").setValue([1.0 / samplesTex.width, 1.0 / samplesTex.height]);
  }
  for (let f = 0; f < (target.cubemap ? 6 : 1); f++) {
    if (face === null || f === face) {
      var _options2;
      const renderTarget = new RenderTarget({
        colorBuffer: target,
        face: f,
        depth: false
      });
      params[0] = f;
      constantParams.setValue(params);
      constantParams2.setValue(params2);
      drawQuadWithShader(device, renderTarget, shader, (_options2 = options) == null ? void 0 : _options2.rect);
      renderTarget.destroy();
    }
  }
  DebugGraphics.popGpuMarker(device);
}

export { reprojectTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9yZXByb2plY3QtdGV4dHVyZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3JhbmRvbS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQge1xuICAgIEZJTFRFUl9ORUFSRVNULFxuICAgIFRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUwsIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkVcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBEZXZpY2VDYWNoZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RldmljZS1jYWNoZS5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NpbXBsZS1wb3N0LWVmZmVjdC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9zaGFkZXItbGliL2NodW5rLXV0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBnZXRQcm9ncmFtTGlicmFyeSB9IGZyb20gJy4uL3NoYWRlci1saWIvZ2V0LXByb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaGFkZXJGcm9tQ29kZSB9IGZyb20gJy4uL3NoYWRlci1saWIvdXRpbHMuanMnO1xuXG5jb25zdCBnZXRQcm9qZWN0aW9uTmFtZSA9IChwcm9qZWN0aW9uKSA9PiB7XG4gICAgc3dpdGNoIChwcm9qZWN0aW9uKSB7XG4gICAgICAgIGNhc2UgVEVYVFVSRVBST0pFQ1RJT05fQ1VCRTpcbiAgICAgICAgICAgIHJldHVybiBcIkN1YmVtYXBcIjtcbiAgICAgICAgY2FzZSBURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMOlxuICAgICAgICAgICAgcmV0dXJuIFwiT2N0YWhlZHJhbFwiO1xuICAgICAgICBkZWZhdWx0OiAvLyBmb3IgYW55dGhpbmcgZWxzZSwgYXNzdW1lIGVxdWlyZWN0XG4gICAgICAgICAgICByZXR1cm4gXCJFcXVpcmVjdFwiO1xuICAgIH1cbn07XG5cbi8vIHBhY2sgYSAzMmJpdCBmbG9hdGluZyBwb2ludCB2YWx1ZSBpbnRvIFJHQkE4XG5jb25zdCBwYWNrRmxvYXQzMlRvUkdCQTggPSAodmFsdWUsIGFycmF5LCBvZmZzZXQpID0+IHtcbiAgICBpZiAodmFsdWUgPD0gMCkge1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAwXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDFdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMl0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAzXSA9IDA7XG4gICAgfSBlbHNlIGlmICh2YWx1ZSA+PSAxLjApIHtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMF0gPSAyNTU7XG4gICAgICAgIGFycmF5W29mZnNldCArIDFdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMl0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAzXSA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGVuY1ggPSAoMSAqIHZhbHVlKSAlIDE7XG4gICAgICAgIGxldCBlbmNZID0gKDI1NSAqIHZhbHVlKSAlIDE7XG4gICAgICAgIGxldCBlbmNaID0gKDY1MDI1ICogdmFsdWUpICUgMTtcbiAgICAgICAgY29uc3QgZW5jVyA9ICgxNjU4MTM3NS4wICogdmFsdWUpICUgMTtcblxuICAgICAgICBlbmNYIC09IGVuY1kgLyAyNTU7XG4gICAgICAgIGVuY1kgLT0gZW5jWiAvIDI1NTtcbiAgICAgICAgZW5jWiAtPSBlbmNXIC8gMjU1O1xuXG4gICAgICAgIGFycmF5W29mZnNldCArIDBdID0gTWF0aC5taW4oMjU1LCBNYXRoLmZsb29yKGVuY1ggKiAyNTYpKTtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMV0gPSBNYXRoLm1pbigyNTUsIE1hdGguZmxvb3IoZW5jWSAqIDI1NikpO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAyXSA9IE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcihlbmNaICogMjU2KSk7XG4gICAgICAgIGFycmF5W29mZnNldCArIDNdID0gTWF0aC5taW4oMjU1LCBNYXRoLmZsb29yKGVuY1cgKiAyNTYpKTtcbiAgICB9XG59O1xuXG4vLyBwYWNrIHNhbXBsZXMgaW50byB0ZXh0dXJlLXJlYWR5IGZvcm1hdFxuY29uc3QgcGFja1NhbXBsZXMgPSAoc2FtcGxlcykgPT4ge1xuICAgIGNvbnN0IG51bVNhbXBsZXMgPSBzYW1wbGVzLmxlbmd0aDtcblxuICAgIGNvbnN0IHcgPSBNYXRoLm1pbihudW1TYW1wbGVzLCA1MTIpO1xuICAgIGNvbnN0IGggPSBNYXRoLmNlaWwobnVtU2FtcGxlcyAvIHcpO1xuICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheSh3ICogaCAqIDQpO1xuXG4gICAgLy8gbm9ybWFsaXplIGZsb2F0IGRhdGEgYW5kIHBhY2sgaW50byByZ2JhOFxuICAgIGxldCBvZmYgPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgaSArPSA0KSB7XG4gICAgICAgIHBhY2tGbG9hdDMyVG9SR0JBOChzYW1wbGVzW2kgKyAwXSAqIDAuNSArIDAuNSwgZGF0YSwgb2ZmICsgMCk7XG4gICAgICAgIHBhY2tGbG9hdDMyVG9SR0JBOChzYW1wbGVzW2kgKyAxXSAqIDAuNSArIDAuNSwgZGF0YSwgb2ZmICsgNCk7XG4gICAgICAgIHBhY2tGbG9hdDMyVG9SR0JBOChzYW1wbGVzW2kgKyAyXSAqIDAuNSArIDAuNSwgZGF0YSwgb2ZmICsgOCk7XG4gICAgICAgIHBhY2tGbG9hdDMyVG9SR0JBOChzYW1wbGVzW2kgKyAzXSAvIDgsIGRhdGEsIG9mZiArIDEyKTtcbiAgICAgICAgb2ZmICs9IDE2O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIHdpZHRoOiB3LFxuICAgICAgICBoZWlnaHQ6IGgsXG4gICAgICAgIGRhdGE6IGRhdGFcbiAgICB9O1xufTtcblxuLy8gZ2VuZXJhdGUgYSB2ZWN0b3Igb24gdGhlIGhlbWlzcGhlcmUgd2l0aCBjb25zdGFudCBkaXN0cmlidXRpb24uXG4vLyBmdW5jdGlvbiBrZXB0IGJlY2F1c2UgaXQncyB1c2VmdWwgZm9yIGRlYnVnZ2luZ1xuLy8gdmVjMyBoZW1pc3BoZXJlU2FtcGxlVW5pZm9ybSh2ZWMyIHV2KSB7XG4vLyAgICAgZmxvYXQgcGhpID0gdXYueSAqIDIuMCAqIFBJO1xuLy8gICAgIGZsb2F0IGNvc1RoZXRhID0gMS4wIC0gdXYueDtcbi8vICAgICBmbG9hdCBzaW5UaGV0YSA9IHNxcnQoMS4wIC0gY29zVGhldGEgKiBjb3NUaGV0YSk7XG4vLyAgICAgcmV0dXJuIHZlYzMoY29zKHBoaSkgKiBzaW5UaGV0YSwgc2luKHBoaSkgKiBzaW5UaGV0YSwgY29zVGhldGEpO1xuLy8gfVxuXG4vLyBnZW5lcmF0ZSBhIHZlY3RvciBvbiB0aGUgaGVtaXNwaGVyZSB3aXRoIHBob25nIHJlZmxlY3Rpb24gZGlzdHJpYnV0aW9uXG5jb25zdCBoZW1pc3BoZXJlU2FtcGxlUGhvbmcgPSAoZHN0VmVjLCB4LCB5LCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgY29uc3QgcGhpID0geSAqIDIgKiBNYXRoLlBJO1xuICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5wb3coMSAtIHgsIDEgLyAoc3BlY3VsYXJQb3dlciArIDEpKTtcbiAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc3FydCgxIC0gY29zVGhldGEgKiBjb3NUaGV0YSk7XG4gICAgZHN0VmVjLnNldChNYXRoLmNvcyhwaGkpICogc2luVGhldGEsIE1hdGguc2luKHBoaSkgKiBzaW5UaGV0YSwgY29zVGhldGEpLm5vcm1hbGl6ZSgpO1xufTtcblxuLy8gZ2VuZXJhdGUgYSB2ZWN0b3Igb24gdGhlIGhlbWlzcGhlcmUgd2l0aCBsYW1iZXJ0IGRpc3RyaWJ1dGlvblxuY29uc3QgaGVtaXNwaGVyZVNhbXBsZUxhbWJlcnQgPSAoZHN0VmVjLCB4LCB5KSA9PiB7XG4gICAgY29uc3QgcGhpID0geSAqIDIgKiBNYXRoLlBJO1xuICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5zcXJ0KDEgLSB4KTtcbiAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc3FydCh4KTtcbiAgICBkc3RWZWMuc2V0KE1hdGguY29zKHBoaSkgKiBzaW5UaGV0YSwgTWF0aC5zaW4ocGhpKSAqIHNpblRoZXRhLCBjb3NUaGV0YSkubm9ybWFsaXplKCk7XG59O1xuXG4vLyBnZW5lcmF0ZSBhIHZlY3RvciBvbiB0aGUgaGVtaXNwaGVyZSB3aXRoIEdHWCBkaXN0cmlidXRpb24uXG4vLyBhIGlzIGxpbmVhciByb3VnaG5lc3NeMlxuY29uc3QgaGVtaXNwaGVyZVNhbXBsZUdHWCA9IChkc3RWZWMsIHgsIHksIGEpID0+IHtcbiAgICBjb25zdCBwaGkgPSB5ICogMiAqIE1hdGguUEk7XG4gICAgY29uc3QgY29zVGhldGEgPSBNYXRoLnNxcnQoKDEgLSB4KSAvICgxICsgKGEgKiBhIC0gMSkgKiB4KSk7XG4gICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNxcnQoMSAtIGNvc1RoZXRhICogY29zVGhldGEpO1xuICAgIGRzdFZlYy5zZXQoTWF0aC5jb3MocGhpKSAqIHNpblRoZXRhLCBNYXRoLnNpbihwaGkpICogc2luVGhldGEsIGNvc1RoZXRhKS5ub3JtYWxpemUoKTtcbn07XG5cbmNvbnN0IERfR0dYID0gKE5vSCwgbGluZWFyUm91Z2huZXNzKSA9PiB7XG4gICAgY29uc3QgYSA9IE5vSCAqIGxpbmVhclJvdWdobmVzcztcbiAgICBjb25zdCBrID0gbGluZWFyUm91Z2huZXNzIC8gKDEuMCAtIE5vSCAqIE5vSCArIGEgKiBhKTtcbiAgICByZXR1cm4gayAqIGsgKiAoMSAvIE1hdGguUEkpO1xufTtcblxuLy8gZ2VuZXJhdGUgcHJlY29tcHV0ZWQgc2FtcGxlcyBmb3IgcGhvbmcgcmVmbGVjdGlvbnMgb2YgdGhlIGdpdmVuIHBvd2VyXG5jb25zdCBnZW5lcmF0ZVBob25nU2FtcGxlcyA9IChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgY29uc3QgSCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICBoZW1pc3BoZXJlU2FtcGxlUGhvbmcoSCwgaSAvIG51bVNhbXBsZXMsIHJhbmRvbS5yYWRpY2FsSW52ZXJzZShpKSwgc3BlY3VsYXJQb3dlcik7XG4gICAgICAgIHJlc3VsdC5wdXNoKEgueCwgSC55LCBILnosIDApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnZW5lcmF0ZSBwcmVjb21wdXRlZCBzYW1wbGVzIGZvciBsYW1iZXJ0IGNvbnZvbHV0aW9uXG5jb25zdCBnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzID0gKG51bVNhbXBsZXMsIHNvdXJjZVRvdGFsUGl4ZWxzKSA9PiB7XG4gICAgY29uc3QgcGl4ZWxzUGVyU2FtcGxlID0gc291cmNlVG90YWxQaXhlbHMgLyBudW1TYW1wbGVzO1xuXG4gICAgY29uc3QgSCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICBoZW1pc3BoZXJlU2FtcGxlTGFtYmVydChILCBpIC8gbnVtU2FtcGxlcywgcmFuZG9tLnJhZGljYWxJbnZlcnNlKGkpKTtcbiAgICAgICAgY29uc3QgcGRmID0gSC56IC8gTWF0aC5QSTtcbiAgICAgICAgY29uc3QgbWlwTGV2ZWwgPSAwLjUgKiBNYXRoLmxvZzIocGl4ZWxzUGVyU2FtcGxlIC8gcGRmKTtcbiAgICAgICAgcmVzdWx0LnB1c2goSC54LCBILnksIEgueiwgbWlwTGV2ZWwpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnZW5lcmF0ZSBhIHRhYmxlIHN0b3JpbmcgdGhlIG51bWJlciBvZiBzYW1wbGVzIHJlcXVpcmVkIHRvIGdldCAnbnVtU2FtcGxlcydcbi8vIHZhbGlkIHNhbXBsZXMgZm9yIHRoZSBnaXZlbiBzcGVjdWxhclBvd2VyLlxuLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMgKi9cbmNvbnN0IGNhbGN1bGF0ZVJlcXVpcmVkU2FtcGxlc0dHWCA9ICgpID0+IHtcbiAgICBjb25zdCBjb3VudFZhbGlkU2FtcGxlc0dHWCA9IChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdWdobmVzcyA9IDEgLSBNYXRoLmxvZzIoc3BlY3VsYXJQb3dlcikgLyAxMS4wO1xuICAgICAgICBjb25zdCBhID0gcm91Z2huZXNzICogcm91Z2huZXNzO1xuICAgICAgICBjb25zdCBIID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgTCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IE4gPSBuZXcgVmVjMygwLCAwLCAxKTtcblxuICAgICAgICBsZXQgdmFsaWRTYW1wbGVzID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyArK2kpIHtcbiAgICAgICAgICAgIGhlbWlzcGhlcmVTYW1wbGVHR1goSCwgaSAvIG51bVNhbXBsZXMsIHJhbmRvbS5yYWRpY2FsSW52ZXJzZShpKSwgYSk7XG5cbiAgICAgICAgICAgIGNvbnN0IE5vSCA9IEguejsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaW5jZSBOIGlzICgwLCAwLCAxKVxuICAgICAgICAgICAgTC5zZXQoSC54LCBILnksIEgueikubXVsU2NhbGFyKDIgKiBOb0gpLnN1YihOKTtcblxuICAgICAgICAgICAgdmFsaWRTYW1wbGVzICs9IEwueiA+IDAgPyAxIDogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YWxpZFNhbXBsZXM7XG4gICAgfTtcblxuICAgIGNvbnN0IG51bVNhbXBsZXMgPSBbMTAyNCwgMTI4LCAzMiwgMTZdO1xuICAgIGNvbnN0IHNwZWN1bGFyUG93ZXJzID0gWzUxMiwgMTI4LCAzMiwgOCwgMl07XG5cbiAgICBjb25zdCByZXF1aXJlZFRhYmxlID0ge307XG4gICAgbnVtU2FtcGxlcy5mb3JFYWNoKChudW1TYW1wbGVzKSA9PiB7XG4gICAgICAgIGNvbnN0IHRhYmxlID0geyB9O1xuICAgICAgICBzcGVjdWxhclBvd2Vycy5mb3JFYWNoKChzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgICAgICAgICBsZXQgcmVxdWlyZWRTYW1wbGVzID0gbnVtU2FtcGxlcztcbiAgICAgICAgICAgIHdoaWxlIChjb3VudFZhbGlkU2FtcGxlc0dHWChyZXF1aXJlZFNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpIDwgbnVtU2FtcGxlcykge1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkU2FtcGxlcysrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGFibGVbc3BlY3VsYXJQb3dlcl0gPSByZXF1aXJlZFNhbXBsZXM7XG4gICAgICAgIH0pO1xuICAgICAgICByZXF1aXJlZFRhYmxlW251bVNhbXBsZXNdID0gdGFibGU7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVxdWlyZWRUYWJsZTtcbn07XG5cbi8vIHByaW50IHRvIHRoZSBjb25zb2xlIHRoZSByZXF1aXJlZCBzYW1wbGVzIHRhYmxlIGZvciBHR1ggcmVmbGVjdGlvbiBjb252b2x1dGlvblxuLy8gY29uc29sZS5sb2coY2FsY3VsYXRlUmVxdWlyZWRTYW1wbGVzR0dYKCkpO1xuXG4vLyB0aGlzIGlzIGEgdGFibGUgd2l0aCBwcmUtY2FsY3VsYXRlZCBudW1iZXIgb2Ygc2FtcGxlcyByZXF1aXJlZCBmb3IgR0dYLlxuLy8gdGhlIHRhYmxlIGlzIGdlbmVyYXRlZCBieSBjYWxjdWxhdGVSZXF1aXJlZFNhbXBsZXNHR1goKVxuLy8gdGhlIHRhYmxlIGlzIG9yZ2FuaXplZCBieSBbbnVtU2FtcGxlc11bc3BlY3VsYXJQb3dlcl1cbi8vXG4vLyB3ZSB1c2UgYSByZXBlYXRhYmxlIHBzZXVkby1yYW5kb20gc2VxdWVuY2Ugb2YgbnVtYmVycyB3aGVuIGdlbmVyYXRpbmcgc2FtcGxlc1xuLy8gZm9yIHVzZSBpbiBwcmVmaWx0ZXJpbmcgR0dYIHJlZmxlY3Rpb25zLiBob3dldmVyIG5vdCBhbGwgdGhlIHJhbmRvbSBzYW1wbGVzXG4vLyB3aWxsIGJlIHZhbGlkLiB0aGlzIGlzIGJlY2F1c2Ugc29tZSByZXN1bHRpbmcgcmVmbGVjdGlvbiB2ZWN0b3JzIHdpbGwgYmUgYmVsb3dcbi8vIHRoZSBoZW1pc3BoZXJlLiB0aGlzIGlzIGVzcGVjaWFsbHkgYXBwYXJlbnQgd2hlbiBjYWxjdWxhdGluZyB2ZWN0b3JzIGZvciB0aGVcbi8vIGhpZ2hlciByb3VnaG5lc3Nlcy4gKHNpbmNlIHZlY3RvcnMgYXJlIG1vcmUgd2lsZCwgbW9yZSBvZiB0aGVtIGFyZSBpbnZhbGlkKS5cbi8vIGZvciBleGFtcGxlLCBzcGVjdWxhclBvd2VyIDIgcmVzdWx0cyBpbiBoYWxmIHRoZSBnZW5lcmF0ZWQgdmVjdG9ycyBiZWluZ1xuLy8gaW52YWxpZC4gKG1lYW5pbmcgdGhlIEdQVSB3b3VsZCBzcGVuZCBoYWxmIHRoZSB0aW1lIG9uIHZlY3RvcnMgdGhhdCBkb24ndFxuLy8gY29udHJpYnV0ZSB0byB0aGUgZmluYWwgcmVzdWx0KS5cbi8vXG4vLyBjYWxjdWxhdGluZyBob3cgbWFueSBzYW1wbGVzIGFyZSByZXF1aXJlZCB0byBnZW5lcmF0ZSAnbicgdmFsaWQgc2FtcGxlcyBpcyBhXG4vLyBzbG93IG9wZXJhdGlvbiwgc28gdGhpcyB0YWJsZSBzdG9yZXMgdGhlIHByZS1jYWxjdWxhdGVkIG51bWJlcnMgb2Ygc2FtcGxlc1xuLy8gcmVxdWlyZWQgZm9yIHRoZSBzZXRzIG9mIChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VycykgcGFpcnMgd2UgZXhwZWN0IHRvXG4vLyBlbmNvdW50ZXIgYXQgcnVudGltZS5cbmNvbnN0IHJlcXVpcmVkU2FtcGxlc0dHWCA9IHtcbiAgICBcIjE2XCI6IHtcbiAgICAgICAgXCIyXCI6IDI2LFxuICAgICAgICBcIjhcIjogMjAsXG4gICAgICAgIFwiMzJcIjogMTcsXG4gICAgICAgIFwiMTI4XCI6IDE2LFxuICAgICAgICBcIjUxMlwiOiAxNlxuICAgIH0sXG4gICAgXCIzMlwiOiB7XG4gICAgICAgIFwiMlwiOiA1MyxcbiAgICAgICAgXCI4XCI6IDQwLFxuICAgICAgICBcIjMyXCI6IDM0LFxuICAgICAgICBcIjEyOFwiOiAzMixcbiAgICAgICAgXCI1MTJcIjogMzJcbiAgICB9LFxuICAgIFwiMTI4XCI6IHtcbiAgICAgICAgXCIyXCI6IDIxNCxcbiAgICAgICAgXCI4XCI6IDE2MyxcbiAgICAgICAgXCIzMlwiOiAxMzksXG4gICAgICAgIFwiMTI4XCI6IDEzMCxcbiAgICAgICAgXCI1MTJcIjogMTI4XG4gICAgfSxcbiAgICBcIjEwMjRcIjoge1xuICAgICAgICBcIjJcIjogMTcyMixcbiAgICAgICAgXCI4XCI6IDEzMTAsXG4gICAgICAgIFwiMzJcIjogMTExNCxcbiAgICAgICAgXCIxMjhcIjogMTA0MSxcbiAgICAgICAgXCI1MTJcIjogMTAyNVxuICAgIH1cbn07XG5cbi8vIGdldCB0aGUgbnVtYmVyIG9mIHJhbmRvbSBzYW1wbGVzIHJlcXVpcmVkIHRvIGdlbmVyYXRlIG51bVNhbXBsZXMgdmFsaWQgc2FtcGxlcy5cbmNvbnN0IGdldFJlcXVpcmVkU2FtcGxlc0dHWCA9IChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgY29uc3QgdGFibGUgPSByZXF1aXJlZFNhbXBsZXNHR1hbbnVtU2FtcGxlc107XG4gICAgcmV0dXJuICh0YWJsZSAmJiB0YWJsZVtzcGVjdWxhclBvd2VyXSkgfHwgbnVtU2FtcGxlcztcbn07XG5cbi8vIGdlbmVyYXRlIHByZWNvbXB1dGVkIEdHWCBzYW1wbGVzXG5jb25zdCBnZW5lcmF0ZUdHWFNhbXBsZXMgPSAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlciwgc291cmNlVG90YWxQaXhlbHMpID0+IHtcbiAgICBjb25zdCBwaXhlbHNQZXJTYW1wbGUgPSBzb3VyY2VUb3RhbFBpeGVscyAvIG51bVNhbXBsZXM7XG4gICAgY29uc3Qgcm91Z2huZXNzID0gMSAtIE1hdGgubG9nMihzcGVjdWxhclBvd2VyKSAvIDExLjA7XG4gICAgY29uc3QgYSA9IHJvdWdobmVzcyAqIHJvdWdobmVzcztcbiAgICBjb25zdCBIID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBMID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBOID0gbmV3IFZlYzMoMCwgMCwgMSk7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBjb25zdCByZXF1aXJlZFNhbXBsZXMgPSBnZXRSZXF1aXJlZFNhbXBsZXNHR1gobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcik7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlcXVpcmVkU2FtcGxlczsgKytpKSB7XG4gICAgICAgIGhlbWlzcGhlcmVTYW1wbGVHR1goSCwgaSAvIHJlcXVpcmVkU2FtcGxlcywgcmFuZG9tLnJhZGljYWxJbnZlcnNlKGkpLCBhKTtcblxuICAgICAgICBjb25zdCBOb0ggPSBILno7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2luY2UgTiBpcyAoMCwgMCwgMSlcbiAgICAgICAgTC5zZXQoSC54LCBILnksIEgueikubXVsU2NhbGFyKDIgKiBOb0gpLnN1YihOKTtcblxuICAgICAgICBpZiAoTC56ID4gMCkge1xuICAgICAgICAgICAgY29uc3QgcGRmID0gRF9HR1goTWF0aC5taW4oMSwgTm9IKSwgYSkgLyA0ICsgMC4wMDE7XG4gICAgICAgICAgICBjb25zdCBtaXBMZXZlbCA9IDAuNSAqIE1hdGgubG9nMihwaXhlbHNQZXJTYW1wbGUgLyBwZGYpO1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goTC54LCBMLnksIEwueiwgbWlwTGV2ZWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKHJlc3VsdC5sZW5ndGggPCBudW1TYW1wbGVzICogNCkge1xuICAgICAgICByZXN1bHQucHVzaCgwLCAwLCAwLCAwKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gcGFjayBmbG9hdCBzYW1wbGVzIGRhdGEgaW50byBhbiByZ2JhOCB0ZXh0dXJlXG5jb25zdCBjcmVhdGVTYW1wbGVzVGV4ID0gKGRldmljZSwgbmFtZSwgc2FtcGxlcykgPT4ge1xuICAgIGNvbnN0IHBhY2tlZFNhbXBsZXMgPSBwYWNrU2FtcGxlcyhzYW1wbGVzKTtcbiAgICByZXR1cm4gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHdpZHRoOiBwYWNrZWRTYW1wbGVzLndpZHRoLFxuICAgICAgICBoZWlnaHQ6IHBhY2tlZFNhbXBsZXMuaGVpZ2h0LFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbGV2ZWxzOiBbcGFja2VkU2FtcGxlcy5kYXRhXVxuICAgIH0pO1xufTtcblxuLy8gc2ltcGxlIGNhY2hlIHN0b3Jpbmcga2V5LT52YWx1ZVxuLy8gbWlzc0Z1bmMgaXMgY2FsbGVkIGlmIHRoZSBrZXkgaXMgbm90IHByZXNlbnRcbmNsYXNzIFNpbXBsZUNhY2hlIHtcbiAgICBjb25zdHJ1Y3RvcihkZXN0cm95Q29udGVudCA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5kZXN0cm95Q29udGVudCA9IGRlc3Ryb3lDb250ZW50O1xuICAgIH1cblxuICAgIG1hcCA9IG5ldyBNYXAoKTtcblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLmRlc3Ryb3lDb250ZW50KSB7XG4gICAgICAgICAgICB0aGlzLm1hcC5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgdmFsdWUuZGVzdHJveSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQoa2V5LCBtaXNzRnVuYykge1xuICAgICAgICBpZiAoIXRoaXMubWFwLmhhcyhrZXkpKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBtaXNzRnVuYygpO1xuICAgICAgICAgICAgdGhpcy5tYXAuc2V0KGtleSwgcmVzdWx0KTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubWFwLmdldChrZXkpO1xuICAgIH1cbn1cblxuLy8gY2FjaGUsIHVzZWQgdG8gc3RvcmUgc2FtcGxlcy4gd2Ugc3RvcmUgdGhlc2Ugc2VwYXJhdGVseSBmcm9tIHRleHR1cmVzIHNpbmNlIG11bHRpcGxlXG4vLyBkZXZpY2VzIGNhbiB1c2UgdGhlIHNhbWUgc2V0IG9mIHNhbXBsZXMuXG5jb25zdCBzYW1wbGVzQ2FjaGUgPSBuZXcgU2ltcGxlQ2FjaGUoZmFsc2UpO1xuXG4vLyBjYWNoZSwgc3RvcmluZyBzYW1wbGVzIHN0b3JlZCBpbiB0ZXh0dXJlcywgdGhvc2UgYXJlIHBlciBkZXZpY2VcbmNvbnN0IGRldmljZUNhY2hlID0gbmV3IERldmljZUNhY2hlKCk7XG5cbmNvbnN0IGdldENhY2hlZFRleHR1cmUgPSAoZGV2aWNlLCBrZXksIGdldFNhbXBsZXNGbmMpID0+IHtcbiAgICBjb25zdCBjYWNoZSA9IGRldmljZUNhY2hlLmdldChkZXZpY2UsICgpID0+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBTaW1wbGVDYWNoZSgpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGNhY2hlLmdldChrZXksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNhbXBsZXNUZXgoZGV2aWNlLCBrZXksIHNhbXBsZXNDYWNoZS5nZXQoa2V5LCBnZXRTYW1wbGVzRm5jKSk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzVGV4ID0gKGRldmljZSwgbnVtU2FtcGxlcywgc291cmNlVG90YWxQaXhlbHMpID0+IHtcbiAgICBjb25zdCBrZXkgPSBgbGFtYmVydC1zYW1wbGVzLSR7bnVtU2FtcGxlc30tJHtzb3VyY2VUb3RhbFBpeGVsc31gO1xuICAgIHJldHVybiBnZXRDYWNoZWRUZXh0dXJlKGRldmljZSwga2V5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzKG51bVNhbXBsZXMsIHNvdXJjZVRvdGFsUGl4ZWxzKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlUGhvbmdTYW1wbGVzVGV4ID0gKGRldmljZSwgbnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgIGNvbnN0IGtleSA9IGBwaG9uZy1zYW1wbGVzLSR7bnVtU2FtcGxlc30tJHtzcGVjdWxhclBvd2VyfWA7XG4gICAgcmV0dXJuIGdldENhY2hlZFRleHR1cmUoZGV2aWNlLCBrZXksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlUGhvbmdTYW1wbGVzKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpO1xuICAgIH0pO1xufTtcblxuY29uc3QgZ2VuZXJhdGVHR1hTYW1wbGVzVGV4ID0gKGRldmljZSwgbnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlciwgc291cmNlVG90YWxQaXhlbHMpID0+IHtcbiAgICBjb25zdCBrZXkgPSBgZ2d4LXNhbXBsZXMtJHtudW1TYW1wbGVzfS0ke3NwZWN1bGFyUG93ZXJ9LSR7c291cmNlVG90YWxQaXhlbHN9YDtcbiAgICByZXR1cm4gZ2V0Q2FjaGVkVGV4dHVyZShkZXZpY2UsIGtleSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGVHR1hTYW1wbGVzKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIsIHNvdXJjZVRvdGFsUGl4ZWxzKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IHZzQ29kZSA9IGBcbmF0dHJpYnV0ZSB2ZWMyIHZlcnRleF9wb3NpdGlvbjtcblxudW5pZm9ybSB2ZWM0IHV2TW9kO1xuXG52YXJ5aW5nIHZlYzIgdlV2MDtcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICBnbF9Qb3NpdGlvbiA9IHZlYzQodmVydGV4X3Bvc2l0aW9uLCAwLjUsIDEuMCk7XG4gICAgdlV2MCA9ICh2ZXJ0ZXhfcG9zaXRpb24ueHkgKiAwLjUgKyAwLjUpICogdXZNb2QueHkgKyB1dk1vZC56dztcbn1cbmA7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiByZXByb2plY3RzIHRleHR1cmVzIGJldHdlZW4gY3ViZW1hcCwgZXF1aXJlY3Rhbmd1bGFyIGFuZCBvY3RhaGVkcmFsIGZvcm1hdHMuIFRoZVxuICogZnVuY3Rpb24gY2FuIHJlYWQgYW5kIHdyaXRlIHRleHR1cmVzIHdpdGggcGl4ZWwgZGF0YSBpbiBSR0JFLCBSR0JNLCBsaW5lYXIgYW5kIHNSR0IgZm9ybWF0cy5cbiAqIFdoZW4gc3BlY3VsYXJQb3dlciBpcyBzcGVjaWZpZWQgaXQgd2lsbCBwZXJmb3JtIGEgcGhvbmctd2VpZ2h0ZWQgY29udm9sdXRpb24gb2YgdGhlIHNvdXJjZSAoZm9yXG4gKiBnZW5lcmF0aW5nIGEgZ2xvc3MgbWFwcykuXG4gKlxuICogQHBhcmFtIHtUZXh0dXJlfSBzb3VyY2UgLSBUaGUgc291cmNlIHRleHR1cmUuXG4gKiBAcGFyYW0ge1RleHR1cmV9IHRhcmdldCAtIFRoZSB0YXJnZXQgdGV4dHVyZS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgb3B0aW9ucyBvYmplY3QuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3BlY3VsYXJQb3dlcl0gLSBPcHRpb25hbCBzcGVjdWxhciBwb3dlci4gV2hlbiBzcGVjdWxhciBwb3dlciBpc1xuICogc3BlY2lmaWVkLCB0aGUgc291cmNlIGlzIGNvbnZvbHZlZCBieSBhIHBob25nLXdlaWdodGVkIGtlcm5lbCByYWlzZWQgdG8gdGhlIHNwZWNpZmllZCBwb3dlci5cbiAqIE90aGVyd2lzZSB0aGUgZnVuY3Rpb24gcGVyZm9ybXMgYSBzdGFuZGFyZCByZXNhbXBsZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5udW1TYW1wbGVzXSAtIE9wdGlvbmFsIG51bWJlciBvZiBzYW1wbGVzIChkZWZhdWx0IGlzIDEwMjQpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZhY2VdIC0gT3B0aW9uYWwgY3ViZW1hcCBmYWNlIHRvIHVwZGF0ZSAoZGVmYXVsdCBpcyB1cGRhdGUgYWxsIGZhY2VzKS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kaXN0cmlidXRpb25dIC0gU3BlY2lmeSBjb252b2x1dGlvbiBkaXN0cmlidXRpb24gLSAnbm9uZScsICdsYW1iZXJ0JyxcbiAqICdwaG9uZycsICdnZ3gnLiBEZWZhdWx0IGRlcGVuZHMgb24gc3BlY3VsYXJQb3dlci5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcycpLlZlYzR9IFtvcHRpb25zLnJlY3RdIC0gT3B0aW9uYWwgdmlld3BvcnQgcmVjdGFuZ2xlLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnNlYW1QaXhlbHNdIC0gT3B0aW9uYWwgbnVtYmVyIG9mIHNlYW0gcGl4ZWxzIHRvIHJlbmRlclxuICovXG5mdW5jdGlvbiByZXByb2plY3RUZXh0dXJlKHNvdXJjZSwgdGFyZ2V0LCBvcHRpb25zID0ge30pIHtcbiAgICAvLyBtYWludGFpbiBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIHByZXZpb3VzIGZ1bmN0aW9uIHNpZ25hdHVyZVxuICAgIC8vIHJlcHJvamVjdFRleHR1cmUoZGV2aWNlLCBzb3VyY2UsIHRhcmdldCwgc3BlY3VsYXJQb3dlciA9IDEsIG51bVNhbXBsZXMgPSAxMDI0KVxuICAgIGlmIChzb3VyY2UgaW5zdGFuY2VvZiBHcmFwaGljc0RldmljZSkge1xuICAgICAgICBzb3VyY2UgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgb3B0aW9ucyA9IHsgfTtcbiAgICAgICAgaWYgKGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLnNwZWN1bGFyUG93ZXIgPSBhcmd1bWVudHNbM107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFyZ3VtZW50c1s0XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLm51bVNhbXBsZXMgPSBhcmd1bWVudHNbNF07XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwbGVhc2UgdXNlIHRoZSB1cGRhdGVkIHBjLnJlcHJvamVjdFRleHR1cmUgQVBJLicpO1xuICAgIH1cblxuICAgIC8vIHRhYmxlIG9mIGRpc3RyaWJ1dGlvbiAtPiBmdW5jdGlvbiBuYW1lXG4gICAgY29uc3QgZnVuY05hbWVzID0ge1xuICAgICAgICAnbm9uZSc6ICdyZXByb2plY3QnLFxuICAgICAgICAnbGFtYmVydCc6ICdwcmVmaWx0ZXJTYW1wbGVzVW53ZWlnaHRlZCcsXG4gICAgICAgICdwaG9uZyc6ICdwcmVmaWx0ZXJTYW1wbGVzVW53ZWlnaHRlZCcsXG4gICAgICAgICdnZ3gnOiAncHJlZmlsdGVyU2FtcGxlcydcbiAgICB9O1xuXG4gICAgLy8gZXh0cmFjdCBvcHRpb25zXG4gICAgY29uc3Qgc3BlY3VsYXJQb3dlciA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyUG93ZXInKSA/IG9wdGlvbnMuc3BlY3VsYXJQb3dlciA6IDE7XG4gICAgY29uc3QgZmFjZSA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2ZhY2UnKSA/IG9wdGlvbnMuZmFjZSA6IG51bGw7XG4gICAgY29uc3QgZGlzdHJpYnV0aW9uID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnZGlzdHJpYnV0aW9uJykgPyBvcHRpb25zLmRpc3RyaWJ1dGlvbiA6IChzcGVjdWxhclBvd2VyID09PSAxKSA/ICdub25lJyA6ICdwaG9uZyc7XG5cbiAgICBjb25zdCBwcm9jZXNzRnVuYyA9IGZ1bmNOYW1lc1tkaXN0cmlidXRpb25dIHx8ICdyZXByb2plY3QnO1xuICAgIGNvbnN0IGRlY29kZUZ1bmMgPSBDaHVua1V0aWxzLmRlY29kZUZ1bmMoc291cmNlLmVuY29kaW5nKTtcbiAgICBjb25zdCBlbmNvZGVGdW5jID0gQ2h1bmtVdGlscy5lbmNvZGVGdW5jKHRhcmdldC5lbmNvZGluZyk7XG4gICAgY29uc3Qgc291cmNlRnVuYyA9IGBzYW1wbGUke2dldFByb2plY3Rpb25OYW1lKHNvdXJjZS5wcm9qZWN0aW9uKX1gO1xuICAgIGNvbnN0IHRhcmdldEZ1bmMgPSBgZ2V0RGlyZWN0aW9uJHtnZXRQcm9qZWN0aW9uTmFtZSh0YXJnZXQucHJvamVjdGlvbil9YDtcbiAgICBjb25zdCBudW1TYW1wbGVzID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnbnVtU2FtcGxlcycpID8gb3B0aW9ucy5udW1TYW1wbGVzIDogMTAyNDtcblxuICAgIC8vIGdlbmVyYXRlIHVuaXF1ZSBzaGFkZXIga2V5XG4gICAgY29uc3Qgc2hhZGVyS2V5ID0gYCR7cHJvY2Vzc0Z1bmN9XyR7ZGVjb2RlRnVuY31fJHtlbmNvZGVGdW5jfV8ke3NvdXJjZUZ1bmN9XyR7dGFyZ2V0RnVuY31fJHtudW1TYW1wbGVzfWA7XG5cbiAgICBjb25zdCBkZXZpY2UgPSBzb3VyY2UuZGV2aWNlO1xuXG4gICAgbGV0IHNoYWRlciA9IGdldFByb2dyYW1MaWJyYXJ5KGRldmljZSkuZ2V0Q2FjaGVkU2hhZGVyKHNoYWRlcktleSk7XG4gICAgaWYgKCFzaGFkZXIpIHtcbiAgICAgICAgY29uc3QgZGVmaW5lcyA9XG4gICAgICAgICAgICBgI2RlZmluZSBQUk9DRVNTX0ZVTkMgJHtwcm9jZXNzRnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIERFQ09ERV9GVU5DICR7ZGVjb2RlRnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIEVOQ09ERV9GVU5DICR7ZW5jb2RlRnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIFNPVVJDRV9GVU5DICR7c291cmNlRnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIFRBUkdFVF9GVU5DICR7dGFyZ2V0RnVuY31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIE5VTV9TQU1QTEVTICR7bnVtU2FtcGxlc31cXG5gICtcbiAgICAgICAgICAgIGAjZGVmaW5lIE5VTV9TQU1QTEVTX1NRUlQgJHtNYXRoLnJvdW5kKE1hdGguc3FydChudW1TYW1wbGVzKSkudG9GaXhlZCgxKX1cXG5gICtcbiAgICAgICAgICAgIChkZXZpY2UuZXh0VGV4dHVyZUxvZCA/IGAjZGVmaW5lIFNVUFBPUlRTX1RFWExPRFxcbmAgOiAnJyk7XG5cbiAgICAgICAgbGV0IGV4dGVuc2lvbnMgPSAnJztcbiAgICAgICAgaWYgKCFkZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICBleHRlbnNpb25zID0gJyNleHRlbnNpb24gR0xfT0VTX3N0YW5kYXJkX2Rlcml2YXRpdmVzOiBlbmFibGVcXG4nO1xuICAgICAgICAgICAgaWYgKGRldmljZS5leHRUZXh0dXJlTG9kKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5zaW9ucyArPSAnI2V4dGVuc2lvbiBHTF9FWFRfc2hhZGVyX3RleHR1cmVfbG9kOiBlbmFibGVcXG5cXG4nO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgc2hhZGVyID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoXG4gICAgICAgICAgICBkZXZpY2UsXG4gICAgICAgICAgICB2c0NvZGUsXG4gICAgICAgICAgICBgJHtkZWZpbmVzfVxcbiR7c2hhZGVyQ2h1bmtzLnJlcHJvamVjdFBTfWAsXG4gICAgICAgICAgICBzaGFkZXJLZXksXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgIGV4dGVuc2lvbnNcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBcIlJlcHJvamVjdFRleHR1cmVcIik7XG5cbiAgICBjb25zdCBjb25zdGFudFNvdXJjZSA9IGRldmljZS5zY29wZS5yZXNvbHZlKHNvdXJjZS5jdWJlbWFwID8gXCJzb3VyY2VDdWJlXCIgOiBcInNvdXJjZVRleFwiKTtcbiAgICBjb25zdGFudFNvdXJjZS5zZXRWYWx1ZShzb3VyY2UpO1xuXG4gICAgY29uc3QgY29uc3RhbnRQYXJhbXMgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShcInBhcmFtc1wiKTtcbiAgICBjb25zdCBjb25zdGFudFBhcmFtczIgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShcInBhcmFtczJcIik7XG5cbiAgICBjb25zdCB1dk1vZFBhcmFtID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJ1dk1vZFwiKTtcbiAgICBpZiAob3B0aW9ucz8uc2VhbVBpeGVscykge1xuICAgICAgICBjb25zdCBwID0gb3B0aW9ucy5zZWFtUGl4ZWxzO1xuICAgICAgICBjb25zdCB3ID0gb3B0aW9ucy5yZWN0ID8gb3B0aW9ucy5yZWN0LnogOiB0YXJnZXQud2lkdGg7XG4gICAgICAgIGNvbnN0IGggPSBvcHRpb25zLnJlY3QgPyBvcHRpb25zLnJlY3QudyA6IHRhcmdldC5oZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgaW5uZXJXaWR0aCA9IHcgLSBwICogMjtcbiAgICAgICAgY29uc3QgaW5uZXJIZWlnaHQgPSBoIC0gcCAqIDI7XG5cbiAgICAgICAgdXZNb2RQYXJhbS5zZXRWYWx1ZShbXG4gICAgICAgICAgICAoaW5uZXJXaWR0aCArIHAgKiAyKSAvIGlubmVyV2lkdGgsXG4gICAgICAgICAgICAoaW5uZXJIZWlnaHQgKyBwICogMikgLyBpbm5lckhlaWdodCxcbiAgICAgICAgICAgIC1wIC8gaW5uZXJXaWR0aCxcbiAgICAgICAgICAgIC1wIC8gaW5uZXJIZWlnaHRcbiAgICAgICAgXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdXZNb2RQYXJhbS5zZXRWYWx1ZShbMSwgMSwgMCwgMF0pO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmFtcyA9IFtcbiAgICAgICAgMCxcbiAgICAgICAgc3BlY3VsYXJQb3dlcixcbiAgICAgICAgc291cmNlLmZpeEN1YmVtYXBTZWFtcyA/IDEuMCAvIHNvdXJjZS53aWR0aCA6IDAuMCwgICAgICAgICAgLy8gc291cmNlIHNlYW0gc2NhbGVcbiAgICAgICAgdGFyZ2V0LmZpeEN1YmVtYXBTZWFtcyA/IDEuMCAvIHRhcmdldC53aWR0aCA6IDAuMCAgICAgICAgICAgLy8gdGFyZ2V0IHNlYW0gc2NhbGVcbiAgICBdO1xuXG4gICAgY29uc3QgcGFyYW1zMiA9IFtcbiAgICAgICAgdGFyZ2V0LndpZHRoICogdGFyZ2V0LmhlaWdodCAqICh0YXJnZXQuY3ViZW1hcCA/IDYgOiAxKSxcbiAgICAgICAgc291cmNlLndpZHRoICogc291cmNlLmhlaWdodCAqIChzb3VyY2UuY3ViZW1hcCA/IDYgOiAxKVxuICAgIF07XG5cbiAgICBpZiAocHJvY2Vzc0Z1bmMuc3RhcnRzV2l0aCgncHJlZmlsdGVyU2FtcGxlcycpKSB7XG4gICAgICAgIC8vIHNldCBvciBnZW5lcmF0ZSB0aGUgcHJlLWNhbGN1bGF0ZWQgc2FtcGxlcyBkYXRhXG4gICAgICAgIGNvbnN0IHNvdXJjZVRvdGFsUGl4ZWxzID0gc291cmNlLndpZHRoICogc291cmNlLmhlaWdodCAqIChzb3VyY2UuY3ViZW1hcCA/IDYgOiAxKTtcbiAgICAgICAgY29uc3Qgc2FtcGxlc1RleCA9XG4gICAgICAgICAgICAoZGlzdHJpYnV0aW9uID09PSAnZ2d4JykgPyBnZW5lcmF0ZUdHWFNhbXBsZXNUZXgoZGV2aWNlLCBudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyLCBzb3VyY2VUb3RhbFBpeGVscykgOlxuICAgICAgICAgICAgICAgICgoZGlzdHJpYnV0aW9uID09PSAnbGFtYmVydCcpID8gZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlc1RleChkZXZpY2UsIG51bVNhbXBsZXMsIHNvdXJjZVRvdGFsUGl4ZWxzKSA6XG4gICAgICAgICAgICAgICAgICAgIGdlbmVyYXRlUGhvbmdTYW1wbGVzVGV4KGRldmljZSwgbnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikpO1xuICAgICAgICBkZXZpY2Uuc2NvcGUucmVzb2x2ZShcInNhbXBsZXNUZXhcIikuc2V0VmFsdWUoc2FtcGxlc1RleCk7XG4gICAgICAgIGRldmljZS5zY29wZS5yZXNvbHZlKFwic2FtcGxlc1RleEludmVyc2VTaXplXCIpLnNldFZhbHVlKFsxLjAgLyBzYW1wbGVzVGV4LndpZHRoLCAxLjAgLyBzYW1wbGVzVGV4LmhlaWdodF0pO1xuICAgIH1cblxuICAgIGZvciAobGV0IGYgPSAwOyBmIDwgKHRhcmdldC5jdWJlbWFwID8gNiA6IDEpOyBmKyspIHtcbiAgICAgICAgaWYgKGZhY2UgPT09IG51bGwgfHwgZiA9PT0gZmFjZSkge1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyVGFyZ2V0ID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgY29sb3JCdWZmZXI6IHRhcmdldCxcbiAgICAgICAgICAgICAgICBmYWNlOiBmLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBmO1xuICAgICAgICAgICAgY29uc3RhbnRQYXJhbXMuc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIGNvbnN0YW50UGFyYW1zMi5zZXRWYWx1ZShwYXJhbXMyKTtcblxuICAgICAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgcmVuZGVyVGFyZ2V0LCBzaGFkZXIsIG9wdGlvbnM/LnJlY3QpO1xuXG4gICAgICAgICAgICByZW5kZXJUYXJnZXQuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbn1cblxuZXhwb3J0IHsgcmVwcm9qZWN0VGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbImdldFByb2plY3Rpb25OYW1lIiwicHJvamVjdGlvbiIsIlRFWFRVUkVQUk9KRUNUSU9OX0NVQkUiLCJURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMIiwicGFja0Zsb2F0MzJUb1JHQkE4IiwidmFsdWUiLCJhcnJheSIsIm9mZnNldCIsImVuY1giLCJlbmNZIiwiZW5jWiIsImVuY1ciLCJNYXRoIiwibWluIiwiZmxvb3IiLCJwYWNrU2FtcGxlcyIsInNhbXBsZXMiLCJudW1TYW1wbGVzIiwibGVuZ3RoIiwidyIsImgiLCJjZWlsIiwiZGF0YSIsIlVpbnQ4QXJyYXkiLCJvZmYiLCJpIiwid2lkdGgiLCJoZWlnaHQiLCJoZW1pc3BoZXJlU2FtcGxlUGhvbmciLCJkc3RWZWMiLCJ4IiwieSIsInNwZWN1bGFyUG93ZXIiLCJwaGkiLCJQSSIsImNvc1RoZXRhIiwicG93Iiwic2luVGhldGEiLCJzcXJ0Iiwic2V0IiwiY29zIiwic2luIiwibm9ybWFsaXplIiwiaGVtaXNwaGVyZVNhbXBsZUxhbWJlcnQiLCJoZW1pc3BoZXJlU2FtcGxlR0dYIiwiYSIsIkRfR0dYIiwiTm9IIiwibGluZWFyUm91Z2huZXNzIiwiayIsImdlbmVyYXRlUGhvbmdTYW1wbGVzIiwiSCIsIlZlYzMiLCJyZXN1bHQiLCJyYW5kb20iLCJyYWRpY2FsSW52ZXJzZSIsInB1c2giLCJ6IiwiZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlcyIsInNvdXJjZVRvdGFsUGl4ZWxzIiwicGl4ZWxzUGVyU2FtcGxlIiwicGRmIiwibWlwTGV2ZWwiLCJsb2cyIiwicmVxdWlyZWRTYW1wbGVzR0dYIiwiZ2V0UmVxdWlyZWRTYW1wbGVzR0dYIiwidGFibGUiLCJnZW5lcmF0ZUdHWFNhbXBsZXMiLCJyb3VnaG5lc3MiLCJMIiwiTiIsInJlcXVpcmVkU2FtcGxlcyIsIm11bFNjYWxhciIsInN1YiIsImNyZWF0ZVNhbXBsZXNUZXgiLCJkZXZpY2UiLCJuYW1lIiwicGFja2VkU2FtcGxlcyIsIlRleHR1cmUiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJsZXZlbHMiLCJTaW1wbGVDYWNoZSIsImNvbnN0cnVjdG9yIiwiZGVzdHJveUNvbnRlbnQiLCJtYXAiLCJNYXAiLCJkZXN0cm95IiwiZm9yRWFjaCIsImtleSIsImdldCIsIm1pc3NGdW5jIiwiaGFzIiwic2FtcGxlc0NhY2hlIiwiZGV2aWNlQ2FjaGUiLCJEZXZpY2VDYWNoZSIsImdldENhY2hlZFRleHR1cmUiLCJnZXRTYW1wbGVzRm5jIiwiY2FjaGUiLCJnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzVGV4IiwiZ2VuZXJhdGVQaG9uZ1NhbXBsZXNUZXgiLCJnZW5lcmF0ZUdHWFNhbXBsZXNUZXgiLCJ2c0NvZGUiLCJyZXByb2plY3RUZXh0dXJlIiwic291cmNlIiwidGFyZ2V0Iiwib3B0aW9ucyIsIkdyYXBoaWNzRGV2aWNlIiwiYXJndW1lbnRzIiwidW5kZWZpbmVkIiwiRGVidWciLCJkZXByZWNhdGVkIiwiZnVuY05hbWVzIiwiaGFzT3duUHJvcGVydHkiLCJmYWNlIiwiZGlzdHJpYnV0aW9uIiwicHJvY2Vzc0Z1bmMiLCJkZWNvZGVGdW5jIiwiQ2h1bmtVdGlscyIsImVuY29kaW5nIiwiZW5jb2RlRnVuYyIsInNvdXJjZUZ1bmMiLCJ0YXJnZXRGdW5jIiwic2hhZGVyS2V5Iiwic2hhZGVyIiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJnZXRDYWNoZWRTaGFkZXIiLCJkZWZpbmVzIiwicm91bmQiLCJ0b0ZpeGVkIiwiZXh0VGV4dHVyZUxvZCIsImV4dGVuc2lvbnMiLCJ3ZWJnbDIiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsInNoYWRlckNodW5rcyIsInJlcHJvamVjdFBTIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJjb25zdGFudFNvdXJjZSIsInNjb3BlIiwicmVzb2x2ZSIsImN1YmVtYXAiLCJzZXRWYWx1ZSIsImNvbnN0YW50UGFyYW1zIiwiY29uc3RhbnRQYXJhbXMyIiwidXZNb2RQYXJhbSIsInNlYW1QaXhlbHMiLCJwIiwicmVjdCIsImlubmVyV2lkdGgiLCJpbm5lckhlaWdodCIsInBhcmFtcyIsImZpeEN1YmVtYXBTZWFtcyIsInBhcmFtczIiLCJzdGFydHNXaXRoIiwic2FtcGxlc1RleCIsImYiLCJyZW5kZXJUYXJnZXQiLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsImRlcHRoIiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwicG9wR3B1TWFya2VyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9CQSxNQUFNQSxpQkFBaUIsR0FBSUMsVUFBVSxJQUFLO0FBQ3RDLEVBQUEsUUFBUUEsVUFBVTtBQUNkLElBQUEsS0FBS0Msc0JBQXNCO0FBQ3ZCLE1BQUEsT0FBTyxTQUFTLENBQUE7QUFDcEIsSUFBQSxLQUFLQyw0QkFBNEI7QUFDN0IsTUFBQSxPQUFPLFlBQVksQ0FBQTtBQUN2QixJQUFBO0FBQ0ksTUFBQSxPQUFPLFVBQVUsQ0FBQTtBQUFDLEdBQUE7QUFFOUIsQ0FBQyxDQUFBOztBQUdELE1BQU1DLGtCQUFrQixHQUFHLENBQUNDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEtBQUs7RUFDakQsSUFBSUYsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUNaQyxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDckJELElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNyQkQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDekIsR0FBQyxNQUFNLElBQUlGLEtBQUssSUFBSSxHQUFHLEVBQUU7QUFDckJDLElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQTtBQUN2QkQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDckJELElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUN6QixHQUFDLE1BQU07QUFDSCxJQUFBLElBQUlDLElBQUksR0FBSSxDQUFDLEdBQUdILEtBQUssR0FBSSxDQUFDLENBQUE7QUFDMUIsSUFBQSxJQUFJSSxJQUFJLEdBQUksR0FBRyxHQUFHSixLQUFLLEdBQUksQ0FBQyxDQUFBO0FBQzVCLElBQUEsSUFBSUssSUFBSSxHQUFJLEtBQUssR0FBR0wsS0FBSyxHQUFJLENBQUMsQ0FBQTtBQUM5QixJQUFBLE1BQU1NLElBQUksR0FBSSxVQUFVLEdBQUdOLEtBQUssR0FBSSxDQUFDLENBQUE7SUFFckNHLElBQUksSUFBSUMsSUFBSSxHQUFHLEdBQUcsQ0FBQTtJQUNsQkEsSUFBSSxJQUFJQyxJQUFJLEdBQUcsR0FBRyxDQUFBO0lBQ2xCQSxJQUFJLElBQUlDLElBQUksR0FBRyxHQUFHLENBQUE7SUFFbEJMLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHSyxJQUFJLENB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
