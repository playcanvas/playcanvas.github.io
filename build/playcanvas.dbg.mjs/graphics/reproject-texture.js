/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_CUBE, FILTER_NEAREST } from './constants.js';
import { Vec3 } from '../math/vec3.js';
import { random } from '../math/random.js';
import { createShaderFromCode } from './program-lib/utils.js';
import { drawQuadWithShader } from './simple-post-effect.js';
import { ChunkUtils } from './program-lib/chunk-utils.js';
import { shaderChunks } from './program-lib/chunks/chunks.js';
import { RenderTarget } from './render-target.js';
import { GraphicsDevice } from './graphics-device.js';
import { getProgramLibrary } from './program-library.js';
import { Texture } from './texture.js';
import { DebugGraphics } from './debug-graphics.js';
import { DeviceCache } from './device-cache.js';

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

  for (let i = 0; i < numSamples; ++i) {
    packFloat32ToRGBA8(samples[i * 4 + 0] * 0.5 + 0.5, data, off + 0);
    packFloat32ToRGBA8(samples[i * 4 + 1] * 0.5 + 0.5, data, off + 4);
    packFloat32ToRGBA8(samples[i * 4 + 2] * 0.5 + 0.5, data, off + 8);
    packFloat32ToRGBA8(samples[i * 4 + 3] / 8, data, off + 12);
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

  let shader = getProgramLibrary(device)._cache[shaderKey];

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

  const params = [0, specularPower, source.fixCubemapSeams ? 1.0 / source.width : 0.0, target.fixCubemapSeams ? 1.0 / target.width : 0.0];
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9ncmFwaGljcy9yZXByb2plY3QtdGV4dHVyZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHtcbiAgICBGSUxURVJfTkVBUkVTVCxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSAnLi4vbWF0aC9yYW5kb20uanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuL3Byb2dyYW0tbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4vc2ltcGxlLXBvc3QtZWZmZWN0LmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuL3Byb2dyYW0tbGliL2NodW5rLXV0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4vcHJvZ3JhbS1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBnZXRQcm9ncmFtTGlicmFyeSB9IGZyb20gJy4vcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4vZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgRGV2aWNlQ2FjaGUgfSBmcm9tICcuL2RldmljZS1jYWNoZS5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9tYXRoL3ZlYzQuanMnKS5WZWM0fSBWZWM0ICovXG5cbmNvbnN0IGdldFByb2plY3Rpb25OYW1lID0gKHByb2plY3Rpb24pID0+IHtcbiAgICBzd2l0Y2ggKHByb2plY3Rpb24pIHtcbiAgICAgICAgY2FzZSBURVhUVVJFUFJPSkVDVElPTl9DVUJFOlxuICAgICAgICAgICAgcmV0dXJuIFwiQ3ViZW1hcFwiO1xuICAgICAgICBjYXNlIFRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUw6XG4gICAgICAgICAgICByZXR1cm4gXCJPY3RhaGVkcmFsXCI7XG4gICAgICAgIGRlZmF1bHQ6IC8vIGZvciBhbnl0aGluZyBlbHNlLCBhc3N1bWUgZXF1aXJlY3RcbiAgICAgICAgICAgIHJldHVybiBcIkVxdWlyZWN0XCI7XG4gICAgfVxufTtcblxuLy8gcGFjayBhIDMyYml0IGZsb2F0aW5nIHBvaW50IHZhbHVlIGludG8gUkdCQThcbmNvbnN0IHBhY2tGbG9hdDMyVG9SR0JBOCA9ICh2YWx1ZSwgYXJyYXksIG9mZnNldCkgPT4ge1xuICAgIGlmICh2YWx1ZSA8PSAwKSB7XG4gICAgICAgIGFycmF5W29mZnNldCArIDBdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMV0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAyXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDNdID0gMDtcbiAgICB9IGVsc2UgaWYgKHZhbHVlID49IDEuMCkge1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAwXSA9IDI1NTtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMV0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAyXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDNdID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgZW5jWCA9ICgxICogdmFsdWUpICUgMTtcbiAgICAgICAgbGV0IGVuY1kgPSAoMjU1ICogdmFsdWUpICUgMTtcbiAgICAgICAgbGV0IGVuY1ogPSAoNjUwMjUgKiB2YWx1ZSkgJSAxO1xuICAgICAgICBjb25zdCBlbmNXID0gKDE2NTgxMzc1LjAgKiB2YWx1ZSkgJSAxO1xuXG4gICAgICAgIGVuY1ggLT0gZW5jWSAvIDI1NTtcbiAgICAgICAgZW5jWSAtPSBlbmNaIC8gMjU1O1xuICAgICAgICBlbmNaIC09IGVuY1cgLyAyNTU7XG5cbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMF0gPSBNYXRoLm1pbigyNTUsIE1hdGguZmxvb3IoZW5jWCAqIDI1NikpO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAxXSA9IE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcihlbmNZICogMjU2KSk7XG4gICAgICAgIGFycmF5W29mZnNldCArIDJdID0gTWF0aC5taW4oMjU1LCBNYXRoLmZsb29yKGVuY1ogKiAyNTYpKTtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgM10gPSBNYXRoLm1pbigyNTUsIE1hdGguZmxvb3IoZW5jVyAqIDI1NikpO1xuICAgIH1cbn07XG5cbi8vIHBhY2sgc2FtcGxlcyBpbnRvIHRleHR1cmUtcmVhZHkgZm9ybWF0XG5jb25zdCBwYWNrU2FtcGxlcyA9IChzYW1wbGVzKSA9PiB7XG4gICAgY29uc3QgbnVtU2FtcGxlcyA9IHNhbXBsZXMubGVuZ3RoO1xuXG4gICAgY29uc3QgdyA9IE1hdGgubWluKG51bVNhbXBsZXMsIDUxMik7XG4gICAgY29uc3QgaCA9IE1hdGguY2VpbChudW1TYW1wbGVzIC8gdyk7XG4gICAgY29uc3QgZGF0YSA9IG5ldyBVaW50OEFycmF5KHcgKiBoICogNCk7XG5cbiAgICAvLyBub3JtYWxpemUgZmxvYXQgZGF0YSBhbmQgcGFjayBpbnRvIHJnYmE4XG4gICAgbGV0IG9mZiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyArK2kpIHtcbiAgICAgICAgcGFja0Zsb2F0MzJUb1JHQkE4KHNhbXBsZXNbaSAqIDQgKyAwXSAqIDAuNSArIDAuNSwgZGF0YSwgb2ZmICsgMCk7XG4gICAgICAgIHBhY2tGbG9hdDMyVG9SR0JBOChzYW1wbGVzW2kgKiA0ICsgMV0gKiAwLjUgKyAwLjUsIGRhdGEsIG9mZiArIDQpO1xuICAgICAgICBwYWNrRmxvYXQzMlRvUkdCQTgoc2FtcGxlc1tpICogNCArIDJdICogMC41ICsgMC41LCBkYXRhLCBvZmYgKyA4KTtcbiAgICAgICAgcGFja0Zsb2F0MzJUb1JHQkE4KHNhbXBsZXNbaSAqIDQgKyAzXSAvIDgsIGRhdGEsIG9mZiArIDEyKTtcbiAgICAgICAgb2ZmICs9IDE2O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIHdpZHRoOiB3LFxuICAgICAgICBoZWlnaHQ6IGgsXG4gICAgICAgIGRhdGE6IGRhdGFcbiAgICB9O1xufTtcblxuLy8gZ2VuZXJhdGUgYSB2ZWN0b3Igb24gdGhlIGhlbWlzcGhlcmUgd2l0aCBjb25zdGFudCBkaXN0cmlidXRpb24uXG4vLyBmdW5jdGlvbiBrZXB0IGJlY2F1c2UgaXQncyB1c2VmdWwgZm9yIGRlYnVnZ2luZ1xuLy8gdmVjMyBoZW1pc3BoZXJlU2FtcGxlVW5pZm9ybSh2ZWMyIHV2KSB7XG4vLyAgICAgZmxvYXQgcGhpID0gdXYueSAqIDIuMCAqIFBJO1xuLy8gICAgIGZsb2F0IGNvc1RoZXRhID0gMS4wIC0gdXYueDtcbi8vICAgICBmbG9hdCBzaW5UaGV0YSA9IHNxcnQoMS4wIC0gY29zVGhldGEgKiBjb3NUaGV0YSk7XG4vLyAgICAgcmV0dXJuIHZlYzMoY29zKHBoaSkgKiBzaW5UaGV0YSwgc2luKHBoaSkgKiBzaW5UaGV0YSwgY29zVGhldGEpO1xuLy8gfVxuXG4vLyBnZW5lcmF0ZSBhIHZlY3RvciBvbiB0aGUgaGVtaXNwaGVyZSB3aXRoIHBob25nIHJlZmxlY3Rpb24gZGlzdHJpYnV0aW9uXG5jb25zdCBoZW1pc3BoZXJlU2FtcGxlUGhvbmcgPSAoZHN0VmVjLCB4LCB5LCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgY29uc3QgcGhpID0geSAqIDIgKiBNYXRoLlBJO1xuICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5wb3coMSAtIHgsIDEgLyAoc3BlY3VsYXJQb3dlciArIDEpKTtcbiAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc3FydCgxIC0gY29zVGhldGEgKiBjb3NUaGV0YSk7XG4gICAgZHN0VmVjLnNldChNYXRoLmNvcyhwaGkpICogc2luVGhldGEsIE1hdGguc2luKHBoaSkgKiBzaW5UaGV0YSwgY29zVGhldGEpLm5vcm1hbGl6ZSgpO1xufTtcblxuLy8gZ2VuZXJhdGUgYSB2ZWN0b3Igb24gdGhlIGhlbWlzcGhlcmUgd2l0aCBsYW1iZXJ0IGRpc3RyaWJ1dGlvblxuY29uc3QgaGVtaXNwaGVyZVNhbXBsZUxhbWJlcnQgPSAoZHN0VmVjLCB4LCB5KSA9PiB7XG4gICAgY29uc3QgcGhpID0geSAqIDIgKiBNYXRoLlBJO1xuICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5zcXJ0KDEgLSB4KTtcbiAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc3FydCh4KTtcbiAgICBkc3RWZWMuc2V0KE1hdGguY29zKHBoaSkgKiBzaW5UaGV0YSwgTWF0aC5zaW4ocGhpKSAqIHNpblRoZXRhLCBjb3NUaGV0YSkubm9ybWFsaXplKCk7XG59O1xuXG4vLyBnZW5lcmF0ZSBhIHZlY3RvciBvbiB0aGUgaGVtaXNwaGVyZSB3aXRoIEdHWCBkaXN0cmlidXRpb24uXG4vLyBhIGlzIGxpbmVhciByb3VnaG5lc3NeMlxuY29uc3QgaGVtaXNwaGVyZVNhbXBsZUdHWCA9IChkc3RWZWMsIHgsIHksIGEpID0+IHtcbiAgICBjb25zdCBwaGkgPSB5ICogMiAqIE1hdGguUEk7XG4gICAgY29uc3QgY29zVGhldGEgPSBNYXRoLnNxcnQoKDEgLSB4KSAvICgxICsgKGEgKiBhIC0gMSkgKiB4KSk7XG4gICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNxcnQoMSAtIGNvc1RoZXRhICogY29zVGhldGEpO1xuICAgIGRzdFZlYy5zZXQoTWF0aC5jb3MocGhpKSAqIHNpblRoZXRhLCBNYXRoLnNpbihwaGkpICogc2luVGhldGEsIGNvc1RoZXRhKS5ub3JtYWxpemUoKTtcbn07XG5cbmNvbnN0IERfR0dYID0gKE5vSCwgbGluZWFyUm91Z2huZXNzKSA9PiB7XG4gICAgY29uc3QgYSA9IE5vSCAqIGxpbmVhclJvdWdobmVzcztcbiAgICBjb25zdCBrID0gbGluZWFyUm91Z2huZXNzIC8gKDEuMCAtIE5vSCAqIE5vSCArIGEgKiBhKTtcbiAgICByZXR1cm4gayAqIGsgKiAoMSAvIE1hdGguUEkpO1xufTtcblxuLy8gZ2VuZXJhdGUgcHJlY29tcHV0ZWQgc2FtcGxlcyBmb3IgcGhvbmcgcmVmbGVjdGlvbnMgb2YgdGhlIGdpdmVuIHBvd2VyXG5jb25zdCBnZW5lcmF0ZVBob25nU2FtcGxlcyA9IChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgY29uc3QgSCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICBoZW1pc3BoZXJlU2FtcGxlUGhvbmcoSCwgaSAvIG51bVNhbXBsZXMsIHJhbmRvbS5yYWRpY2FsSW52ZXJzZShpKSwgc3BlY3VsYXJQb3dlcik7XG4gICAgICAgIHJlc3VsdC5wdXNoKEgueCwgSC55LCBILnosIDApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnZW5lcmF0ZSBwcmVjb21wdXRlZCBzYW1wbGVzIGZvciBsYW1iZXJ0IGNvbnZvbHV0aW9uXG5jb25zdCBnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzID0gKG51bVNhbXBsZXMsIHNvdXJjZVRvdGFsUGl4ZWxzKSA9PiB7XG4gICAgY29uc3QgcGl4ZWxzUGVyU2FtcGxlID0gc291cmNlVG90YWxQaXhlbHMgLyBudW1TYW1wbGVzO1xuXG4gICAgY29uc3QgSCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICBoZW1pc3BoZXJlU2FtcGxlTGFtYmVydChILCBpIC8gbnVtU2FtcGxlcywgcmFuZG9tLnJhZGljYWxJbnZlcnNlKGkpKTtcbiAgICAgICAgY29uc3QgcGRmID0gSC56IC8gTWF0aC5QSTtcbiAgICAgICAgY29uc3QgbWlwTGV2ZWwgPSAwLjUgKiBNYXRoLmxvZzIocGl4ZWxzUGVyU2FtcGxlIC8gcGRmKTtcbiAgICAgICAgcmVzdWx0LnB1c2goSC54LCBILnksIEgueiwgbWlwTGV2ZWwpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnZW5lcmF0ZSBhIHRhYmxlIHN0b3JpbmcgdGhlIG51bWJlciBvZiBzYW1wbGVzIHJlcXVpcmVkIHRvIGdldCAnbnVtU2FtcGxlcydcbi8vIHZhbGlkIHNhbXBsZXMgZm9yIHRoZSBnaXZlbiBzcGVjdWxhclBvd2VyLlxuLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMgKi9cbmNvbnN0IGNhbGN1bGF0ZVJlcXVpcmVkU2FtcGxlc0dHWCA9ICgpID0+IHtcbiAgICBjb25zdCBjb3VudFZhbGlkU2FtcGxlc0dHWCA9IChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgICAgIGNvbnN0IHJvdWdobmVzcyA9IDEgLSBNYXRoLmxvZzIoc3BlY3VsYXJQb3dlcikgLyAxMS4wO1xuICAgICAgICBjb25zdCBhID0gcm91Z2huZXNzICogcm91Z2huZXNzO1xuICAgICAgICBjb25zdCBIID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgTCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IE4gPSBuZXcgVmVjMygwLCAwLCAxKTtcblxuICAgICAgICBsZXQgdmFsaWRTYW1wbGVzID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyArK2kpIHtcbiAgICAgICAgICAgIGhlbWlzcGhlcmVTYW1wbGVHR1goSCwgaSAvIG51bVNhbXBsZXMsIHJhbmRvbS5yYWRpY2FsSW52ZXJzZShpKSwgYSk7XG5cbiAgICAgICAgICAgIGNvbnN0IE5vSCA9IEguejsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaW5jZSBOIGlzICgwLCAwLCAxKVxuICAgICAgICAgICAgTC5zZXQoSC54LCBILnksIEgueikubXVsU2NhbGFyKDIgKiBOb0gpLnN1YihOKTtcblxuICAgICAgICAgICAgdmFsaWRTYW1wbGVzICs9IEwueiA+IDAgPyAxIDogMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YWxpZFNhbXBsZXM7XG4gICAgfTtcblxuICAgIGNvbnN0IG51bVNhbXBsZXMgPSBbMTAyNCwgMTI4LCAzMiwgMTZdO1xuICAgIGNvbnN0IHNwZWN1bGFyUG93ZXJzID0gWzUxMiwgMTI4LCAzMiwgOCwgMl07XG5cbiAgICBjb25zdCByZXF1aXJlZFRhYmxlID0ge307XG4gICAgbnVtU2FtcGxlcy5mb3JFYWNoKChudW1TYW1wbGVzKSA9PiB7XG4gICAgICAgIGNvbnN0IHRhYmxlID0geyB9O1xuICAgICAgICBzcGVjdWxhclBvd2Vycy5mb3JFYWNoKChzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgICAgICAgICBsZXQgcmVxdWlyZWRTYW1wbGVzID0gbnVtU2FtcGxlcztcbiAgICAgICAgICAgIHdoaWxlIChjb3VudFZhbGlkU2FtcGxlc0dHWChyZXF1aXJlZFNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpIDwgbnVtU2FtcGxlcykge1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkU2FtcGxlcysrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGFibGVbc3BlY3VsYXJQb3dlcl0gPSByZXF1aXJlZFNhbXBsZXM7XG4gICAgICAgIH0pO1xuICAgICAgICByZXF1aXJlZFRhYmxlW251bVNhbXBsZXNdID0gdGFibGU7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVxdWlyZWRUYWJsZTtcbn07XG5cbi8vIHByaW50IHRvIHRoZSBjb25zb2xlIHRoZSByZXF1aXJlZCBzYW1wbGVzIHRhYmxlIGZvciBHR1ggcmVmbGVjdGlvbiBjb252b2x1dGlvblxuLy8gY29uc29sZS5sb2coY2FsY3VsYXRlUmVxdWlyZWRTYW1wbGVzR0dYKCkpO1xuXG4vLyB0aGlzIGlzIGEgdGFibGUgd2l0aCBwcmUtY2FsY3VsYXRlZCBudW1iZXIgb2Ygc2FtcGxlcyByZXF1aXJlZCBmb3IgR0dYLlxuLy8gdGhlIHRhYmxlIGlzIGdlbmVyYXRlZCBieSBjYWxjdWxhdGVSZXF1aXJlZFNhbXBsZXNHR1goKVxuLy8gdGhlIHRhYmxlIGlzIG9yZ2FuaXplZCBieSBbbnVtU2FtcGxlc11bc3BlY3VsYXJQb3dlcl1cbi8vXG4vLyB3ZSB1c2UgYSByZXBlYXRhYmxlIHBzZXVkby1yYW5kb20gc2VxdWVuY2Ugb2YgbnVtYmVycyB3aGVuIGdlbmVyYXRpbmcgc2FtcGxlc1xuLy8gZm9yIHVzZSBpbiBwcmVmaWx0ZXJpbmcgR0dYIHJlZmxlY3Rpb25zLiBob3dldmVyIG5vdCBhbGwgdGhlIHJhbmRvbSBzYW1wbGVzXG4vLyB3aWxsIGJlIHZhbGlkLiB0aGlzIGlzIGJlY2F1c2Ugc29tZSByZXN1bHRpbmcgcmVmbGVjdGlvbiB2ZWN0b3JzIHdpbGwgYmUgYmVsb3dcbi8vIHRoZSBoZW1pc3BoZXJlLiB0aGlzIGlzIGVzcGVjaWFsbHkgYXBwYXJlbnQgd2hlbiBjYWxjdWxhdGluZyB2ZWN0b3JzIGZvciB0aGVcbi8vIGhpZ2hlciByb3VnaG5lc3Nlcy4gKHNpbmNlIHZlY3RvcnMgYXJlIG1vcmUgd2lsZCwgbW9yZSBvZiB0aGVtIGFyZSBpbnZhbGlkKS5cbi8vIGZvciBleGFtcGxlLCBzcGVjdWxhclBvd2VyIDIgcmVzdWx0cyBpbiBoYWxmIHRoZSBnZW5lcmF0ZWQgdmVjdG9ycyBiZWluZ1xuLy8gaW52YWxpZC4gKG1lYW5pbmcgdGhlIEdQVSB3b3VsZCBzcGVuZCBoYWxmIHRoZSB0aW1lIG9uIHZlY3RvcnMgdGhhdCBkb24ndFxuLy8gY29udHJpYnV0ZSB0byB0aGUgZmluYWwgcmVzdWx0KS5cbi8vXG4vLyBjYWxjdWxhdGluZyBob3cgbWFueSBzYW1wbGVzIGFyZSByZXF1aXJlZCB0byBnZW5lcmF0ZSAnbicgdmFsaWQgc2FtcGxlcyBpcyBhXG4vLyBzbG93IG9wZXJhdGlvbiwgc28gdGhpcyB0YWJsZSBzdG9yZXMgdGhlIHByZS1jYWxjdWxhdGVkIG51bWJlcnMgb2Ygc2FtcGxlc1xuLy8gcmVxdWlyZWQgZm9yIHRoZSBzZXRzIG9mIChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VycykgcGFpcnMgd2UgZXhwZWN0IHRvXG4vLyBlbmNvdW50ZXIgYXQgcnVudGltZS5cbmNvbnN0IHJlcXVpcmVkU2FtcGxlc0dHWCA9IHtcbiAgICBcIjE2XCI6IHtcbiAgICAgICAgXCIyXCI6IDI2LFxuICAgICAgICBcIjhcIjogMjAsXG4gICAgICAgIFwiMzJcIjogMTcsXG4gICAgICAgIFwiMTI4XCI6IDE2LFxuICAgICAgICBcIjUxMlwiOiAxNlxuICAgIH0sXG4gICAgXCIzMlwiOiB7XG4gICAgICAgIFwiMlwiOiA1MyxcbiAgICAgICAgXCI4XCI6IDQwLFxuICAgICAgICBcIjMyXCI6IDM0LFxuICAgICAgICBcIjEyOFwiOiAzMixcbiAgICAgICAgXCI1MTJcIjogMzJcbiAgICB9LFxuICAgIFwiMTI4XCI6IHtcbiAgICAgICAgXCIyXCI6IDIxNCxcbiAgICAgICAgXCI4XCI6IDE2MyxcbiAgICAgICAgXCIzMlwiOiAxMzksXG4gICAgICAgIFwiMTI4XCI6IDEzMCxcbiAgICAgICAgXCI1MTJcIjogMTI4XG4gICAgfSxcbiAgICBcIjEwMjRcIjoge1xuICAgICAgICBcIjJcIjogMTcyMixcbiAgICAgICAgXCI4XCI6IDEzMTAsXG4gICAgICAgIFwiMzJcIjogMTExNCxcbiAgICAgICAgXCIxMjhcIjogMTA0MSxcbiAgICAgICAgXCI1MTJcIjogMTAyNVxuICAgIH1cbn07XG5cbi8vIGdldCB0aGUgbnVtYmVyIG9mIHJhbmRvbSBzYW1wbGVzIHJlcXVpcmVkIHRvIGdlbmVyYXRlIG51bVNhbXBsZXMgdmFsaWQgc2FtcGxlcy5cbmNvbnN0IGdldFJlcXVpcmVkU2FtcGxlc0dHWCA9IChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgY29uc3QgdGFibGUgPSByZXF1aXJlZFNhbXBsZXNHR1hbbnVtU2FtcGxlc107XG4gICAgcmV0dXJuICh0YWJsZSAmJiB0YWJsZVtzcGVjdWxhclBvd2VyXSkgfHwgbnVtU2FtcGxlcztcbn07XG5cbi8vIGdlbmVyYXRlIHByZWNvbXB1dGVkIEdHWCBzYW1wbGVzXG5jb25zdCBnZW5lcmF0ZUdHWFNhbXBsZXMgPSAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlciwgc291cmNlVG90YWxQaXhlbHMpID0+IHtcbiAgICBjb25zdCBwaXhlbHNQZXJTYW1wbGUgPSBzb3VyY2VUb3RhbFBpeGVscyAvIG51bVNhbXBsZXM7XG4gICAgY29uc3Qgcm91Z2huZXNzID0gMSAtIE1hdGgubG9nMihzcGVjdWxhclBvd2VyKSAvIDExLjA7XG4gICAgY29uc3QgYSA9IHJvdWdobmVzcyAqIHJvdWdobmVzcztcbiAgICBjb25zdCBIID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBMID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCBOID0gbmV3IFZlYzMoMCwgMCwgMSk7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBjb25zdCByZXF1aXJlZFNhbXBsZXMgPSBnZXRSZXF1aXJlZFNhbXBsZXNHR1gobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcik7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlcXVpcmVkU2FtcGxlczsgKytpKSB7XG4gICAgICAgIGhlbWlzcGhlcmVTYW1wbGVHR1goSCwgaSAvIHJlcXVpcmVkU2FtcGxlcywgcmFuZG9tLnJhZGljYWxJbnZlcnNlKGkpLCBhKTtcblxuICAgICAgICBjb25zdCBOb0ggPSBILno7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2luY2UgTiBpcyAoMCwgMCwgMSlcbiAgICAgICAgTC5zZXQoSC54LCBILnksIEgueikubXVsU2NhbGFyKDIgKiBOb0gpLnN1YihOKTtcblxuICAgICAgICBpZiAoTC56ID4gMCkge1xuICAgICAgICAgICAgY29uc3QgcGRmID0gRF9HR1goTWF0aC5taW4oMSwgTm9IKSwgYSkgLyA0ICsgMC4wMDE7XG4gICAgICAgICAgICBjb25zdCBtaXBMZXZlbCA9IDAuNSAqIE1hdGgubG9nMihwaXhlbHNQZXJTYW1wbGUgLyBwZGYpO1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goTC54LCBMLnksIEwueiwgbWlwTGV2ZWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKHJlc3VsdC5sZW5ndGggPCBudW1TYW1wbGVzICogNCkge1xuICAgICAgICByZXN1bHQucHVzaCgwLCAwLCAwLCAwKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gcGFjayBmbG9hdCBzYW1wbGVzIGRhdGEgaW50byBhbiByZ2JhOCB0ZXh0dXJlXG5jb25zdCBjcmVhdGVTYW1wbGVzVGV4ID0gKGRldmljZSwgbmFtZSwgc2FtcGxlcykgPT4ge1xuICAgIGNvbnN0IHBhY2tlZFNhbXBsZXMgPSBwYWNrU2FtcGxlcyhzYW1wbGVzKTtcbiAgICByZXR1cm4gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgIHdpZHRoOiBwYWNrZWRTYW1wbGVzLndpZHRoLFxuICAgICAgICBoZWlnaHQ6IHBhY2tlZFNhbXBsZXMuaGVpZ2h0LFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbGV2ZWxzOiBbcGFja2VkU2FtcGxlcy5kYXRhXVxuICAgIH0pO1xufTtcblxuLy8gc2ltcGxlIGNhY2hlIHN0b3Jpbmcga2V5LT52YWx1ZVxuLy8gbWlzc0Z1bmMgaXMgY2FsbGVkIGlmIHRoZSBrZXkgaXMgbm90IHByZXNlbnRcbmNsYXNzIFNpbXBsZUNhY2hlIHtcbiAgICBjb25zdHJ1Y3RvcihkZXN0cm95Q29udGVudCA9IHRydWUpIHtcbiAgICAgICAgdGhpcy5kZXN0cm95Q29udGVudCA9IGRlc3Ryb3lDb250ZW50O1xuICAgIH1cblxuICAgIG1hcCA9IG5ldyBNYXAoKTtcblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLmRlc3Ryb3lDb250ZW50KSB7XG4gICAgICAgICAgICB0aGlzLm1hcC5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgdmFsdWUuZGVzdHJveSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQoa2V5LCBtaXNzRnVuYykge1xuICAgICAgICBpZiAoIXRoaXMubWFwLmhhcyhrZXkpKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBtaXNzRnVuYygpO1xuICAgICAgICAgICAgdGhpcy5tYXAuc2V0KGtleSwgcmVzdWx0KTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMubWFwLmdldChrZXkpO1xuICAgIH1cbn1cblxuLy8gY2FjaGUsIHVzZWQgdG8gc3RvcmUgc2FtcGxlcy4gd2Ugc3RvcmUgdGhlc2Ugc2VwYXJhdGVseSBmcm9tIHRleHR1cmVzIHNpbmNlIG11bHRpcGxlXG4vLyBkZXZpY2VzIGNhbiB1c2UgdGhlIHNhbWUgc2V0IG9mIHNhbXBsZXMuXG5jb25zdCBzYW1wbGVzQ2FjaGUgPSBuZXcgU2ltcGxlQ2FjaGUoZmFsc2UpO1xuXG4vLyBjYWNoZSwgc3RvcmluZyBzYW1wbGVzIHN0b3JlZCBpbiB0ZXh0dXJlcywgdGhvc2UgYXJlIHBlciBkZXZpY2VcbmNvbnN0IGRldmljZUNhY2hlID0gbmV3IERldmljZUNhY2hlKCk7XG5cbmNvbnN0IGdldENhY2hlZFRleHR1cmUgPSAoZGV2aWNlLCBrZXksIGdldFNhbXBsZXNGbmMpID0+IHtcbiAgICBjb25zdCBjYWNoZSA9IGRldmljZUNhY2hlLmdldChkZXZpY2UsICgpID0+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBTaW1wbGVDYWNoZSgpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGNhY2hlLmdldChrZXksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNhbXBsZXNUZXgoZGV2aWNlLCBrZXksIHNhbXBsZXNDYWNoZS5nZXQoa2V5LCBnZXRTYW1wbGVzRm5jKSk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzVGV4ID0gKGRldmljZSwgbnVtU2FtcGxlcywgc291cmNlVG90YWxQaXhlbHMpID0+IHtcbiAgICBjb25zdCBrZXkgPSBgbGFtYmVydC1zYW1wbGVzLSR7bnVtU2FtcGxlc30tJHtzb3VyY2VUb3RhbFBpeGVsc31gO1xuICAgIHJldHVybiBnZXRDYWNoZWRUZXh0dXJlKGRldmljZSwga2V5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzKG51bVNhbXBsZXMsIHNvdXJjZVRvdGFsUGl4ZWxzKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlUGhvbmdTYW1wbGVzVGV4ID0gKGRldmljZSwgbnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgIGNvbnN0IGtleSA9IGBwaG9uZy1zYW1wbGVzLSR7bnVtU2FtcGxlc30tJHtzcGVjdWxhclBvd2VyfWA7XG4gICAgcmV0dXJuIGdldENhY2hlZFRleHR1cmUoZGV2aWNlLCBrZXksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlUGhvbmdTYW1wbGVzKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpO1xuICAgIH0pO1xufTtcblxuY29uc3QgZ2VuZXJhdGVHR1hTYW1wbGVzVGV4ID0gKGRldmljZSwgbnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlciwgc291cmNlVG90YWxQaXhlbHMpID0+IHtcbiAgICBjb25zdCBrZXkgPSBgZ2d4LXNhbXBsZXMtJHtudW1TYW1wbGVzfS0ke3NwZWN1bGFyUG93ZXJ9LSR7c291cmNlVG90YWxQaXhlbHN9YDtcbiAgICByZXR1cm4gZ2V0Q2FjaGVkVGV4dHVyZShkZXZpY2UsIGtleSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGVHR1hTYW1wbGVzKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIsIHNvdXJjZVRvdGFsUGl4ZWxzKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IHZzQ29kZSA9IGBcbmF0dHJpYnV0ZSB2ZWMyIHZlcnRleF9wb3NpdGlvbjtcblxudW5pZm9ybSB2ZWM0IHV2TW9kO1xuXG52YXJ5aW5nIHZlYzIgdlV2MDtcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICBnbF9Qb3NpdGlvbiA9IHZlYzQodmVydGV4X3Bvc2l0aW9uLCAwLjUsIDEuMCk7XG4gICAgdlV2MCA9ICh2ZXJ0ZXhfcG9zaXRpb24ueHkgKiAwLjUgKyAwLjUpICogdXZNb2QueHkgKyB1dk1vZC56dztcbn1cbmA7XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiByZXByb2plY3RzIHRleHR1cmVzIGJldHdlZW4gY3ViZW1hcCwgZXF1aXJlY3Rhbmd1bGFyIGFuZCBvY3RhaGVkcmFsIGZvcm1hdHMuIFRoZVxuICogZnVuY3Rpb24gY2FuIHJlYWQgYW5kIHdyaXRlIHRleHR1cmVzIHdpdGggcGl4ZWwgZGF0YSBpbiBSR0JFLCBSR0JNLCBsaW5lYXIgYW5kIHNSR0IgZm9ybWF0cy5cbiAqIFdoZW4gc3BlY3VsYXJQb3dlciBpcyBzcGVjaWZpZWQgaXQgd2lsbCBwZXJmb3JtIGEgcGhvbmctd2VpZ2h0ZWQgY29udm9sdXRpb24gb2YgdGhlIHNvdXJjZSAoZm9yXG4gKiBnZW5lcmF0aW5nIGEgZ2xvc3MgbWFwcykuXG4gKlxuICogQHBhcmFtIHtUZXh0dXJlfSBzb3VyY2UgLSBUaGUgc291cmNlIHRleHR1cmUuXG4gKiBAcGFyYW0ge1RleHR1cmV9IHRhcmdldCAtIFRoZSB0YXJnZXQgdGV4dHVyZS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgb3B0aW9ucyBvYmplY3QuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3BlY3VsYXJQb3dlcl0gLSBPcHRpb25hbCBzcGVjdWxhciBwb3dlci4gV2hlbiBzcGVjdWxhciBwb3dlciBpc1xuICogc3BlY2lmaWVkLCB0aGUgc291cmNlIGlzIGNvbnZvbHZlZCBieSBhIHBob25nLXdlaWdodGVkIGtlcm5lbCByYWlzZWQgdG8gdGhlIHNwZWNpZmllZCBwb3dlci5cbiAqIE90aGVyd2lzZSB0aGUgZnVuY3Rpb24gcGVyZm9ybXMgYSBzdGFuZGFyZCByZXNhbXBsZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5udW1TYW1wbGVzXSAtIE9wdGlvbmFsIG51bWJlciBvZiBzYW1wbGVzIChkZWZhdWx0IGlzIDEwMjQpLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZhY2VdIC0gT3B0aW9uYWwgY3ViZW1hcCBmYWNlIHRvIHVwZGF0ZSAoZGVmYXVsdCBpcyB1cGRhdGUgYWxsIGZhY2VzKS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5kaXN0cmlidXRpb25dIC0gU3BlY2lmeSBjb252b2x1dGlvbiBkaXN0cmlidXRpb24gLSAnbm9uZScsICdsYW1iZXJ0JyxcbiAqICdwaG9uZycsICdnZ3gnLiBEZWZhdWx0IGRlcGVuZHMgb24gc3BlY3VsYXJQb3dlci5cbiAqIEBwYXJhbSB7VmVjNH0gW29wdGlvbnMucmVjdF0gLSBPcHRpb25hbCB2aWV3cG9ydCByZWN0YW5nbGUuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc2VhbVBpeGVsc10gLSBPcHRpb25hbCBudW1iZXIgb2Ygc2VhbSBwaXhlbHMgdG8gcmVuZGVyXG4gKi9cbmZ1bmN0aW9uIHJlcHJvamVjdFRleHR1cmUoc291cmNlLCB0YXJnZXQsIG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIG1haW50YWluIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGggcHJldmlvdXMgZnVuY3Rpb24gc2lnbmF0dXJlXG4gICAgLy8gcmVwcm9qZWN0VGV4dHVyZShkZXZpY2UsIHNvdXJjZSwgdGFyZ2V0LCBzcGVjdWxhclBvd2VyID0gMSwgbnVtU2FtcGxlcyA9IDEwMjQpXG4gICAgaWYgKHNvdXJjZSBpbnN0YW5jZW9mIEdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgIHNvdXJjZSA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgdGFyZ2V0ID0gYXJndW1lbnRzWzJdO1xuICAgICAgICBvcHRpb25zID0geyB9O1xuICAgICAgICBpZiAoYXJndW1lbnRzWzNdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuc3BlY3VsYXJQb3dlciA9IGFyZ3VtZW50c1szXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXJndW1lbnRzWzRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMubnVtU2FtcGxlcyA9IGFyZ3VtZW50c1s0XTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BsZWFzZSB1c2UgdGhlIHVwZGF0ZWQgcGMucmVwcm9qZWN0VGV4dHVyZSBBUEkuJyk7XG4gICAgfVxuXG4gICAgLy8gdGFibGUgb2YgZGlzdHJpYnV0aW9uIC0+IGZ1bmN0aW9uIG5hbWVcbiAgICBjb25zdCBmdW5jTmFtZXMgPSB7XG4gICAgICAgICdub25lJzogJ3JlcHJvamVjdCcsXG4gICAgICAgICdsYW1iZXJ0JzogJ3ByZWZpbHRlclNhbXBsZXNVbndlaWdodGVkJyxcbiAgICAgICAgJ3Bob25nJzogJ3ByZWZpbHRlclNhbXBsZXNVbndlaWdodGVkJyxcbiAgICAgICAgJ2dneCc6ICdwcmVmaWx0ZXJTYW1wbGVzJ1xuICAgIH07XG5cbiAgICAvLyBleHRyYWN0IG9wdGlvbnNcbiAgICBjb25zdCBzcGVjdWxhclBvd2VyID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJQb3dlcicpID8gb3B0aW9ucy5zcGVjdWxhclBvd2VyIDogMTtcbiAgICBjb25zdCBmYWNlID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnZmFjZScpID8gb3B0aW9ucy5mYWNlIDogbnVsbDtcbiAgICBjb25zdCBkaXN0cmlidXRpb24gPSBvcHRpb25zLmhhc093blByb3BlcnR5KCdkaXN0cmlidXRpb24nKSA/IG9wdGlvbnMuZGlzdHJpYnV0aW9uIDogKHNwZWN1bGFyUG93ZXIgPT09IDEpID8gJ25vbmUnIDogJ3Bob25nJztcblxuICAgIGNvbnN0IHByb2Nlc3NGdW5jID0gZnVuY05hbWVzW2Rpc3RyaWJ1dGlvbl0gfHwgJ3JlcHJvamVjdCc7XG4gICAgY29uc3QgZGVjb2RlRnVuYyA9IENodW5rVXRpbHMuZGVjb2RlRnVuYyhzb3VyY2UuZW5jb2RpbmcpO1xuICAgIGNvbnN0IGVuY29kZUZ1bmMgPSBDaHVua1V0aWxzLmVuY29kZUZ1bmModGFyZ2V0LmVuY29kaW5nKTtcbiAgICBjb25zdCBzb3VyY2VGdW5jID0gYHNhbXBsZSR7Z2V0UHJvamVjdGlvbk5hbWUoc291cmNlLnByb2plY3Rpb24pfWA7XG4gICAgY29uc3QgdGFyZ2V0RnVuYyA9IGBnZXREaXJlY3Rpb24ke2dldFByb2plY3Rpb25OYW1lKHRhcmdldC5wcm9qZWN0aW9uKX1gO1xuICAgIGNvbnN0IG51bVNhbXBsZXMgPSBvcHRpb25zLmhhc093blByb3BlcnR5KCdudW1TYW1wbGVzJykgPyBvcHRpb25zLm51bVNhbXBsZXMgOiAxMDI0O1xuXG4gICAgLy8gZ2VuZXJhdGUgdW5pcXVlIHNoYWRlciBrZXlcbiAgICBjb25zdCBzaGFkZXJLZXkgPSBgJHtwcm9jZXNzRnVuY31fJHtkZWNvZGVGdW5jfV8ke2VuY29kZUZ1bmN9XyR7c291cmNlRnVuY31fJHt0YXJnZXRGdW5jfV8ke251bVNhbXBsZXN9YDtcblxuICAgIGNvbnN0IGRldmljZSA9IHNvdXJjZS5kZXZpY2U7XG5cbiAgICBsZXQgc2hhZGVyID0gZ2V0UHJvZ3JhbUxpYnJhcnkoZGV2aWNlKS5fY2FjaGVbc2hhZGVyS2V5XTtcbiAgICBpZiAoIXNoYWRlcikge1xuICAgICAgICBjb25zdCBkZWZpbmVzID1cbiAgICAgICAgICAgIGAjZGVmaW5lIFBST0NFU1NfRlVOQyAke3Byb2Nlc3NGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgREVDT0RFX0ZVTkMgJHtkZWNvZGVGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgRU5DT0RFX0ZVTkMgJHtlbmNvZGVGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgU09VUkNFX0ZVTkMgJHtzb3VyY2VGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgVEFSR0VUX0ZVTkMgJHt0YXJnZXRGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgTlVNX1NBTVBMRVMgJHtudW1TYW1wbGVzfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgTlVNX1NBTVBMRVNfU1FSVCAke01hdGgucm91bmQoTWF0aC5zcXJ0KG51bVNhbXBsZXMpKS50b0ZpeGVkKDEpfVxcbmAgK1xuICAgICAgICAgICAgKGRldmljZS5leHRUZXh0dXJlTG9kID8gYCNkZWZpbmUgU1VQUE9SVFNfVEVYTE9EXFxuYCA6ICcnKTtcblxuICAgICAgICBsZXQgZXh0ZW5zaW9ucyA9ICcnO1xuICAgICAgICBpZiAoIWRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgIGV4dGVuc2lvbnMgPSAnI2V4dGVuc2lvbiBHTF9PRVNfc3RhbmRhcmRfZGVyaXZhdGl2ZXM6IGVuYWJsZVxcbic7XG4gICAgICAgICAgICBpZiAoZGV2aWNlLmV4dFRleHR1cmVMb2QpIHtcbiAgICAgICAgICAgICAgICBleHRlbnNpb25zICs9ICcjZXh0ZW5zaW9uIEdMX0VYVF9zaGFkZXJfdGV4dHVyZV9sb2Q6IGVuYWJsZVxcblxcbic7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBzaGFkZXIgPSBjcmVhdGVTaGFkZXJGcm9tQ29kZShcbiAgICAgICAgICAgIGRldmljZSxcbiAgICAgICAgICAgIHZzQ29kZSxcbiAgICAgICAgICAgIGAke2RlZmluZXN9XFxuJHtzaGFkZXJDaHVua3MucmVwcm9qZWN0UFN9YCxcbiAgICAgICAgICAgIHNoYWRlcktleSxcbiAgICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgICAgZXh0ZW5zaW9uc1xuICAgICAgICApO1xuICAgIH1cblxuICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIFwiUmVwcm9qZWN0VGV4dHVyZVwiKTtcblxuICAgIGNvbnN0IGNvbnN0YW50U291cmNlID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoc291cmNlLmN1YmVtYXAgPyBcInNvdXJjZUN1YmVcIiA6IFwic291cmNlVGV4XCIpO1xuICAgIGNvbnN0YW50U291cmNlLnNldFZhbHVlKHNvdXJjZSk7XG5cbiAgICBjb25zdCBjb25zdGFudFBhcmFtcyA9IGRldmljZS5zY29wZS5yZXNvbHZlKFwicGFyYW1zXCIpO1xuICAgIGNvbnN0IGNvbnN0YW50UGFyYW1zMiA9IGRldmljZS5zY29wZS5yZXNvbHZlKFwicGFyYW1zMlwiKTtcblxuICAgIGNvbnN0IHV2TW9kUGFyYW0gPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShcInV2TW9kXCIpO1xuICAgIGlmIChvcHRpb25zPy5zZWFtUGl4ZWxzKSB7XG4gICAgICAgIGNvbnN0IHAgPSBvcHRpb25zLnNlYW1QaXhlbHM7XG4gICAgICAgIGNvbnN0IHcgPSBvcHRpb25zLnJlY3QgPyBvcHRpb25zLnJlY3QueiA6IHRhcmdldC53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IG9wdGlvbnMucmVjdCA/IG9wdGlvbnMucmVjdC53IDogdGFyZ2V0LmhlaWdodDtcblxuICAgICAgICBjb25zdCBpbm5lcldpZHRoID0gdyAtIHAgKiAyO1xuICAgICAgICBjb25zdCBpbm5lckhlaWdodCA9IGggLSBwICogMjtcblxuICAgICAgICB1dk1vZFBhcmFtLnNldFZhbHVlKFtcbiAgICAgICAgICAgIChpbm5lcldpZHRoICsgcCAqIDIpIC8gaW5uZXJXaWR0aCxcbiAgICAgICAgICAgIChpbm5lckhlaWdodCArIHAgKiAyKSAvIGlubmVySGVpZ2h0LFxuICAgICAgICAgICAgLXAgLyBpbm5lcldpZHRoLFxuICAgICAgICAgICAgLXAgLyBpbm5lckhlaWdodFxuICAgICAgICBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1dk1vZFBhcmFtLnNldFZhbHVlKFsxLCAxLCAwLCAwXSk7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0gW1xuICAgICAgICAwLFxuICAgICAgICBzcGVjdWxhclBvd2VyLFxuICAgICAgICBzb3VyY2UuZml4Q3ViZW1hcFNlYW1zID8gMS4wIC8gc291cmNlLndpZHRoIDogMC4wLCAgICAgICAgICAvLyBzb3VyY2Ugc2VhbSBzY2FsZVxuICAgICAgICB0YXJnZXQuZml4Q3ViZW1hcFNlYW1zID8gMS4wIC8gdGFyZ2V0LndpZHRoIDogMC4wICAgICAgICAgICAvLyB0YXJnZXQgc2VhbSBzY2FsZVxuICAgIF07XG5cbiAgICBjb25zdCBwYXJhbXMyID0gW1xuICAgICAgICB0YXJnZXQud2lkdGggKiB0YXJnZXQuaGVpZ2h0ICogKHRhcmdldC5jdWJlbWFwID8gNiA6IDEpLFxuICAgICAgICBzb3VyY2Uud2lkdGggKiBzb3VyY2UuaGVpZ2h0ICogKHNvdXJjZS5jdWJlbWFwID8gNiA6IDEpXG4gICAgXTtcblxuICAgIGlmIChwcm9jZXNzRnVuYy5zdGFydHNXaXRoKCdwcmVmaWx0ZXJTYW1wbGVzJykpIHtcbiAgICAgICAgLy8gc2V0IG9yIGdlbmVyYXRlIHRoZSBwcmUtY2FsY3VsYXRlZCBzYW1wbGVzIGRhdGFcbiAgICAgICAgY29uc3Qgc291cmNlVG90YWxQaXhlbHMgPSBzb3VyY2Uud2lkdGggKiBzb3VyY2UuaGVpZ2h0ICogKHNvdXJjZS5jdWJlbWFwID8gNiA6IDEpO1xuICAgICAgICBjb25zdCBzYW1wbGVzVGV4ID1cbiAgICAgICAgICAgIChkaXN0cmlidXRpb24gPT09ICdnZ3gnKSA/IGdlbmVyYXRlR0dYU2FtcGxlc1RleChkZXZpY2UsIG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIsIHNvdXJjZVRvdGFsUGl4ZWxzKSA6XG4gICAgICAgICAgICAgICAgKChkaXN0cmlidXRpb24gPT09ICdsYW1iZXJ0JykgPyBnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzVGV4KGRldmljZSwgbnVtU2FtcGxlcywgc291cmNlVG90YWxQaXhlbHMpIDpcbiAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVQaG9uZ1NhbXBsZXNUZXgoZGV2aWNlLCBudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSk7XG4gICAgICAgIGRldmljZS5zY29wZS5yZXNvbHZlKFwic2FtcGxlc1RleFwiKS5zZXRWYWx1ZShzYW1wbGVzVGV4KTtcbiAgICAgICAgZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJzYW1wbGVzVGV4SW52ZXJzZVNpemVcIikuc2V0VmFsdWUoWzEuMCAvIHNhbXBsZXNUZXgud2lkdGgsIDEuMCAvIHNhbXBsZXNUZXguaGVpZ2h0XSk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgZiA9IDA7IGYgPCAodGFyZ2V0LmN1YmVtYXAgPyA2IDogMSk7IGYrKykge1xuICAgICAgICBpZiAoZmFjZSA9PT0gbnVsbCB8fCBmID09PSBmYWNlKSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXJUYXJnZXQgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlcjogdGFyZ2V0LFxuICAgICAgICAgICAgICAgIGZhY2U6IGYsXG4gICAgICAgICAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHBhcmFtc1swXSA9IGY7XG4gICAgICAgICAgICBjb25zdGFudFBhcmFtcy5zZXRWYWx1ZShwYXJhbXMpO1xuICAgICAgICAgICAgY29uc3RhbnRQYXJhbXMyLnNldFZhbHVlKHBhcmFtczIpO1xuXG4gICAgICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCByZW5kZXJUYXJnZXQsIHNoYWRlciwgb3B0aW9ucz8ucmVjdCk7XG5cbiAgICAgICAgICAgIHJlbmRlclRhcmdldC5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xufVxuXG5leHBvcnQgeyByZXByb2plY3RUZXh0dXJlIH07XG4iXSwibmFtZXMiOlsiZ2V0UHJvamVjdGlvbk5hbWUiLCJwcm9qZWN0aW9uIiwiVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSIsIlRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUwiLCJwYWNrRmxvYXQzMlRvUkdCQTgiLCJ2YWx1ZSIsImFycmF5Iiwib2Zmc2V0IiwiZW5jWCIsImVuY1kiLCJlbmNaIiwiZW5jVyIsIk1hdGgiLCJtaW4iLCJmbG9vciIsInBhY2tTYW1wbGVzIiwic2FtcGxlcyIsIm51bVNhbXBsZXMiLCJsZW5ndGgiLCJ3IiwiaCIsImNlaWwiLCJkYXRhIiwiVWludDhBcnJheSIsIm9mZiIsImkiLCJ3aWR0aCIsImhlaWdodCIsImhlbWlzcGhlcmVTYW1wbGVQaG9uZyIsImRzdFZlYyIsIngiLCJ5Iiwic3BlY3VsYXJQb3dlciIsInBoaSIsIlBJIiwiY29zVGhldGEiLCJwb3ciLCJzaW5UaGV0YSIsInNxcnQiLCJzZXQiLCJjb3MiLCJzaW4iLCJub3JtYWxpemUiLCJoZW1pc3BoZXJlU2FtcGxlTGFtYmVydCIsImhlbWlzcGhlcmVTYW1wbGVHR1giLCJhIiwiRF9HR1giLCJOb0giLCJsaW5lYXJSb3VnaG5lc3MiLCJrIiwiZ2VuZXJhdGVQaG9uZ1NhbXBsZXMiLCJIIiwiVmVjMyIsInJlc3VsdCIsInJhbmRvbSIsInJhZGljYWxJbnZlcnNlIiwicHVzaCIsInoiLCJnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzIiwic291cmNlVG90YWxQaXhlbHMiLCJwaXhlbHNQZXJTYW1wbGUiLCJwZGYiLCJtaXBMZXZlbCIsImxvZzIiLCJyZXF1aXJlZFNhbXBsZXNHR1giLCJnZXRSZXF1aXJlZFNhbXBsZXNHR1giLCJ0YWJsZSIsImdlbmVyYXRlR0dYU2FtcGxlcyIsInJvdWdobmVzcyIsIkwiLCJOIiwicmVxdWlyZWRTYW1wbGVzIiwibXVsU2NhbGFyIiwic3ViIiwiY3JlYXRlU2FtcGxlc1RleCIsImRldmljZSIsIm5hbWUiLCJwYWNrZWRTYW1wbGVzIiwiVGV4dHVyZSIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1hZ0ZpbHRlciIsImxldmVscyIsIlNpbXBsZUNhY2hlIiwiY29uc3RydWN0b3IiLCJkZXN0cm95Q29udGVudCIsIm1hcCIsIk1hcCIsImRlc3Ryb3kiLCJmb3JFYWNoIiwia2V5IiwiZ2V0IiwibWlzc0Z1bmMiLCJoYXMiLCJzYW1wbGVzQ2FjaGUiLCJkZXZpY2VDYWNoZSIsIkRldmljZUNhY2hlIiwiZ2V0Q2FjaGVkVGV4dHVyZSIsImdldFNhbXBsZXNGbmMiLCJjYWNoZSIsImdlbmVyYXRlTGFtYmVydFNhbXBsZXNUZXgiLCJnZW5lcmF0ZVBob25nU2FtcGxlc1RleCIsImdlbmVyYXRlR0dYU2FtcGxlc1RleCIsInZzQ29kZSIsInJlcHJvamVjdFRleHR1cmUiLCJzb3VyY2UiLCJ0YXJnZXQiLCJvcHRpb25zIiwiR3JhcGhpY3NEZXZpY2UiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJmdW5jTmFtZXMiLCJoYXNPd25Qcm9wZXJ0eSIsImZhY2UiLCJkaXN0cmlidXRpb24iLCJwcm9jZXNzRnVuYyIsImRlY29kZUZ1bmMiLCJDaHVua1V0aWxzIiwiZW5jb2RpbmciLCJlbmNvZGVGdW5jIiwic291cmNlRnVuYyIsInRhcmdldEZ1bmMiLCJzaGFkZXJLZXkiLCJzaGFkZXIiLCJnZXRQcm9ncmFtTGlicmFyeSIsIl9jYWNoZSIsImRlZmluZXMiLCJyb3VuZCIsInRvRml4ZWQiLCJleHRUZXh0dXJlTG9kIiwiZXh0ZW5zaW9ucyIsIndlYmdsMiIsImNyZWF0ZVNoYWRlckZyb21Db2RlIiwic2hhZGVyQ2h1bmtzIiwicmVwcm9qZWN0UFMiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsImNvbnN0YW50U291cmNlIiwic2NvcGUiLCJyZXNvbHZlIiwiY3ViZW1hcCIsInNldFZhbHVlIiwiY29uc3RhbnRQYXJhbXMiLCJjb25zdGFudFBhcmFtczIiLCJ1dk1vZFBhcmFtIiwic2VhbVBpeGVscyIsInAiLCJyZWN0IiwiaW5uZXJXaWR0aCIsImlubmVySGVpZ2h0IiwicGFyYW1zIiwiZml4Q3ViZW1hcFNlYW1zIiwicGFyYW1zMiIsInN0YXJ0c1dpdGgiLCJzYW1wbGVzVGV4IiwiZiIsInJlbmRlclRhcmdldCIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJwb3BHcHVNYXJrZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0JBLE1BQU1BLGlCQUFpQixHQUFJQyxVQUFELElBQWdCO0FBQ3RDLEVBQUEsUUFBUUEsVUFBUjtBQUNJLElBQUEsS0FBS0Msc0JBQUw7QUFDSSxNQUFBLE9BQU8sU0FBUCxDQUFBOztBQUNKLElBQUEsS0FBS0MsNEJBQUw7QUFDSSxNQUFBLE9BQU8sWUFBUCxDQUFBOztBQUNKLElBQUE7QUFDSSxNQUFBLE9BQU8sVUFBUCxDQUFBO0FBTlIsR0FBQTtBQVFILENBVEQsQ0FBQTs7QUFZQSxNQUFNQyxrQkFBa0IsR0FBRyxDQUFDQyxLQUFELEVBQVFDLEtBQVIsRUFBZUMsTUFBZixLQUEwQjtFQUNqRCxJQUFJRixLQUFLLElBQUksQ0FBYixFQUFnQjtBQUNaQyxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFWLENBQUwsR0FBb0IsQ0FBcEIsQ0FBQTtBQUNBRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFWLENBQUwsR0FBb0IsQ0FBcEIsQ0FBQTtBQUNBRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFWLENBQUwsR0FBb0IsQ0FBcEIsQ0FBQTtBQUNBRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FB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
