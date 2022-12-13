/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { random } from '../../core/math/random.js';
import { Vec3 } from '../../core/math/vec3.js';
import { TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_CUBE, FILTER_NEAREST } from '../../platform/graphics/constants.js';
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
}

export { reprojectTexture };
