/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { random } from '../../core/math/random.js';
import { Vec3 } from '../../core/math/vec3.js';
import { TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_CUBE, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';
import { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { drawQuadWithShader } from './quad-render-utils.js';
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
      // for anything else, assume equirect
      return "Equirect";
  }
};

// pack a 32bit floating point value into RGBA8
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

// pack samples into texture-ready format
const packSamples = samples => {
  const numSamples = samples.length;
  const w = Math.min(numSamples, 512);
  const h = Math.ceil(numSamples / w);
  const data = new Uint8Array(w * h * 4);

  // normalize float data and pack into rgba8
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

// generate a vector on the hemisphere with constant distribution.
// function kept because it's useful for debugging
// vec3 hemisphereSampleUniform(vec2 uv) {
//     float phi = uv.y * 2.0 * PI;
//     float cosTheta = 1.0 - uv.x;
//     float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
//     return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
// }

// generate a vector on the hemisphere with phong reflection distribution
const hemisphereSamplePhong = (dstVec, x, y, specularPower) => {
  const phi = y * 2 * Math.PI;
  const cosTheta = Math.pow(1 - x, 1 / (specularPower + 1));
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

// generate a vector on the hemisphere with lambert distribution
const hemisphereSampleLambert = (dstVec, x, y) => {
  const phi = y * 2 * Math.PI;
  const cosTheta = Math.sqrt(1 - x);
  const sinTheta = Math.sqrt(x);
  dstVec.set(Math.cos(phi) * sinTheta, Math.sin(phi) * sinTheta, cosTheta).normalize();
};

// generate a vector on the hemisphere with GGX distribution.
// a is linear roughness^2
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

// generate precomputed samples for phong reflections of the given power
const generatePhongSamples = (numSamples, specularPower) => {
  const H = new Vec3();
  const result = [];
  for (let i = 0; i < numSamples; ++i) {
    hemisphereSamplePhong(H, i / numSamples, random.radicalInverse(i), specularPower);
    result.push(H.x, H.y, H.z, 0);
  }
  return result;
};

// generate precomputed samples for lambert convolution
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

// print to the console the required samples table for GGX reflection convolution
// console.log(calculateRequiredSamplesGGX());

// this is a table with pre-calculated number of samples required for GGX.
// the table is generated by calculateRequiredSamplesGGX()
// the table is organized by [numSamples][specularPower]
//
// we use a repeatable pseudo-random sequence of numbers when generating samples
// for use in prefiltering GGX reflections. however not all the random samples
// will be valid. this is because some resulting reflection vectors will be below
// the hemisphere. this is especially apparent when calculating vectors for the
// higher roughnesses. (since vectors are more wild, more of them are invalid).
// for example, specularPower 2 results in half the generated vectors being
// invalid. (meaning the GPU would spend half the time on vectors that don't
// contribute to the final result).
//
// calculating how many samples are required to generate 'n' valid samples is a
// slow operation, so this table stores the pre-calculated numbers of samples
// required for the sets of (numSamples, specularPowers) pairs we expect to
// encounter at runtime.
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

// get the number of random samples required to generate numSamples valid samples.
const getRequiredSamplesGGX = (numSamples, specularPower) => {
  const table = requiredSamplesGGX[numSamples];
  return table && table[specularPower] || numSamples;
};

// generate precomputed GGX samples
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
    const NoH = H.z; // since N is (0, 0, 1)
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

// pack float samples data into an rgba8 texture
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

// simple cache storing key->value
// missFunc is called if the key is not present
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

// cache, used to store samples. we store these separately from textures since multiple
// devices can use the same set of samples.
const samplesCache = new SimpleCache(false);

// cache, storing samples stored in textures, those are per device
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
    vUv0 = getImageEffectUV((vertex_position.xy * 0.5 + 0.5) * uvMod.xy + uvMod.zw);
}
`;

/**
 * This function reprojects textures between cubemap, equirectangular and octahedral formats. The
 * function can read and write textures with pixel data in RGBE, RGBM, linear and sRGB formats.
 * When specularPower is specified it will perform a phong-weighted convolution of the source (for
 * generating a gloss maps).
 *
 * @param {Texture} source - The source texture.
 * @param {Texture} target - The target texture.
 * @param {object} [options] - The options object.
 * @param {number} [options.specularPower] - Optional specular power. When specular power is
 * specified, the source is convolved by a phong-weighted kernel raised to the specified power.
 * Otherwise the function performs a standard resample.
 * @param {number} [options.numSamples] - Optional number of samples (default is 1024).
 * @param {number} [options.face] - Optional cubemap face to update (default is update all faces).
 * @param {string} [options.distribution] - Specify convolution distribution - 'none', 'lambert',
 * 'phong', 'ggx'. Default depends on specularPower.
 * @param {import('../../core/math/vec4.js').Vec4} [options.rect] - Optional viewport rectangle.
 * @param {number} [options.seamPixels] - Optional number of seam pixels to render
 */
function reprojectTexture(source, target, options = {}) {
  var _options;
  // maintain backwards compatibility with previous function signature
  // reprojectTexture(device, source, target, specularPower = 1, numSamples = 1024)
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

  // table of distribution -> function name
  const funcNames = {
    'none': 'reproject',
    'lambert': 'prefilterSamplesUnweighted',
    'phong': 'prefilterSamplesUnweighted',
    'ggx': 'prefilterSamples'
  };

  // extract options
  const specularPower = options.hasOwnProperty('specularPower') ? options.specularPower : 1;
  const face = options.hasOwnProperty('face') ? options.face : null;
  const distribution = options.hasOwnProperty('distribution') ? options.distribution : specularPower === 1 ? 'none' : 'phong';
  const processFunc = funcNames[distribution] || 'reproject';
  const prefilterSamples = processFunc.startsWith('prefilterSamples');
  const decodeFunc = ChunkUtils.decodeFunc(source.encoding);
  const encodeFunc = ChunkUtils.encodeFunc(target.encoding);
  const sourceFunc = `sample${getProjectionName(source.projection)}`;
  const targetFunc = `getDirection${getProjectionName(target.projection)}`;
  const numSamples = options.hasOwnProperty('numSamples') ? options.numSamples : 1024;

  // generate unique shader key
  const shaderKey = `${processFunc}_${decodeFunc}_${encodeFunc}_${sourceFunc}_${targetFunc}_${numSamples}`;
  const device = source.device;
  let shader = getProgramLibrary(device).getCachedShader(shaderKey);
  if (!shader) {
    const defines = `#define PROCESS_FUNC ${processFunc}\n` + (prefilterSamples ? `#define USE_SAMPLES_TEX\n` : '') + (source.cubemap ? `#define CUBEMAP_SOURCE\n` : '') + `#define DECODE_FUNC ${decodeFunc}\n` + `#define ENCODE_FUNC ${encodeFunc}\n` + `#define SOURCE_FUNC ${sourceFunc}\n` + `#define TARGET_FUNC ${targetFunc}\n` + `#define NUM_SAMPLES ${numSamples}\n` + `#define NUM_SAMPLES_SQRT ${Math.round(Math.sqrt(numSamples)).toFixed(1)}\n`;
    shader = createShaderFromCode(device, vsCode, `${defines}\n${shaderChunks.reprojectPS}`, shaderKey);
  }
  DebugGraphics.pushGpuMarker(device, "ReprojectTexture");
  const constantSource = device.scope.resolve(source.cubemap ? "sourceCube" : "sourceTex");
  Debug.assert(constantSource);
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
  // source seam scale
  target.fixCubemapSeams ? 1.0 / target.width : 0.0 // target seam scale
  ];

  const params2 = [target.width * target.height * (target.cubemap ? 6 : 1), source.width * source.height * (source.cubemap ? 6 : 1)];
  if (prefilterSamples) {
    // set or generate the pre-calculated samples data
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9yZXByb2plY3QtdGV4dHVyZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3JhbmRvbS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQge1xuICAgIEZJTFRFUl9ORUFSRVNULFxuICAgIFRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUwsIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkVcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBEZXZpY2VDYWNoZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RldmljZS1jYWNoZS5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4vcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBDaHVua1V0aWxzIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9jaHVuay11dGlscy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zaGFkZXItbGliL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuLi9zaGFkZXItbGliL3V0aWxzLmpzJztcblxuY29uc3QgZ2V0UHJvamVjdGlvbk5hbWUgPSAocHJvamVjdGlvbikgPT4ge1xuICAgIHN3aXRjaCAocHJvamVjdGlvbikge1xuICAgICAgICBjYXNlIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkU6XG4gICAgICAgICAgICByZXR1cm4gXCJDdWJlbWFwXCI7XG4gICAgICAgIGNhc2UgVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTDpcbiAgICAgICAgICAgIHJldHVybiBcIk9jdGFoZWRyYWxcIjtcbiAgICAgICAgZGVmYXVsdDogLy8gZm9yIGFueXRoaW5nIGVsc2UsIGFzc3VtZSBlcXVpcmVjdFxuICAgICAgICAgICAgcmV0dXJuIFwiRXF1aXJlY3RcIjtcbiAgICB9XG59O1xuXG4vLyBwYWNrIGEgMzJiaXQgZmxvYXRpbmcgcG9pbnQgdmFsdWUgaW50byBSR0JBOFxuY29uc3QgcGFja0Zsb2F0MzJUb1JHQkE4ID0gKHZhbHVlLCBhcnJheSwgb2Zmc2V0KSA9PiB7XG4gICAgaWYgKHZhbHVlIDw9IDApIHtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMF0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAxXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDJdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgM10gPSAwO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgPj0gMS4wKSB7XG4gICAgICAgIGFycmF5W29mZnNldCArIDBdID0gMjU1O1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAxXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDJdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgM10gPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBlbmNYID0gKDEgKiB2YWx1ZSkgJSAxO1xuICAgICAgICBsZXQgZW5jWSA9ICgyNTUgKiB2YWx1ZSkgJSAxO1xuICAgICAgICBsZXQgZW5jWiA9ICg2NTAyNSAqIHZhbHVlKSAlIDE7XG4gICAgICAgIGNvbnN0IGVuY1cgPSAoMTY1ODEzNzUuMCAqIHZhbHVlKSAlIDE7XG5cbiAgICAgICAgZW5jWCAtPSBlbmNZIC8gMjU1O1xuICAgICAgICBlbmNZIC09IGVuY1ogLyAyNTU7XG4gICAgICAgIGVuY1ogLT0gZW5jVyAvIDI1NTtcblxuICAgICAgICBhcnJheVtvZmZzZXQgKyAwXSA9IE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcihlbmNYICogMjU2KSk7XG4gICAgICAgIGFycmF5W29mZnNldCArIDFdID0gTWF0aC5taW4oMjU1LCBNYXRoLmZsb29yKGVuY1kgKiAyNTYpKTtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMl0gPSBNYXRoLm1pbigyNTUsIE1hdGguZmxvb3IoZW5jWiAqIDI1NikpO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAzXSA9IE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcihlbmNXICogMjU2KSk7XG4gICAgfVxufTtcblxuLy8gcGFjayBzYW1wbGVzIGludG8gdGV4dHVyZS1yZWFkeSBmb3JtYXRcbmNvbnN0IHBhY2tTYW1wbGVzID0gKHNhbXBsZXMpID0+IHtcbiAgICBjb25zdCBudW1TYW1wbGVzID0gc2FtcGxlcy5sZW5ndGg7XG5cbiAgICBjb25zdCB3ID0gTWF0aC5taW4obnVtU2FtcGxlcywgNTEyKTtcbiAgICBjb25zdCBoID0gTWF0aC5jZWlsKG51bVNhbXBsZXMgLyB3KTtcbiAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkodyAqIGggKiA0KTtcblxuICAgIC8vIG5vcm1hbGl6ZSBmbG9hdCBkYXRhIGFuZCBwYWNrIGludG8gcmdiYThcbiAgICBsZXQgb2ZmID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7IGkgKz0gNCkge1xuICAgICAgICBwYWNrRmxvYXQzMlRvUkdCQTgoc2FtcGxlc1tpICsgMF0gKiAwLjUgKyAwLjUsIGRhdGEsIG9mZiArIDApO1xuICAgICAgICBwYWNrRmxvYXQzMlRvUkdCQTgoc2FtcGxlc1tpICsgMV0gKiAwLjUgKyAwLjUsIGRhdGEsIG9mZiArIDQpO1xuICAgICAgICBwYWNrRmxvYXQzMlRvUkdCQTgoc2FtcGxlc1tpICsgMl0gKiAwLjUgKyAwLjUsIGRhdGEsIG9mZiArIDgpO1xuICAgICAgICBwYWNrRmxvYXQzMlRvUkdCQTgoc2FtcGxlc1tpICsgM10gLyA4LCBkYXRhLCBvZmYgKyAxMik7XG4gICAgICAgIG9mZiArPSAxNjtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICB3aWR0aDogdyxcbiAgICAgICAgaGVpZ2h0OiBoLFxuICAgICAgICBkYXRhOiBkYXRhXG4gICAgfTtcbn07XG5cbi8vIGdlbmVyYXRlIGEgdmVjdG9yIG9uIHRoZSBoZW1pc3BoZXJlIHdpdGggY29uc3RhbnQgZGlzdHJpYnV0aW9uLlxuLy8gZnVuY3Rpb24ga2VwdCBiZWNhdXNlIGl0J3MgdXNlZnVsIGZvciBkZWJ1Z2dpbmdcbi8vIHZlYzMgaGVtaXNwaGVyZVNhbXBsZVVuaWZvcm0odmVjMiB1dikge1xuLy8gICAgIGZsb2F0IHBoaSA9IHV2LnkgKiAyLjAgKiBQSTtcbi8vICAgICBmbG9hdCBjb3NUaGV0YSA9IDEuMCAtIHV2Lng7XG4vLyAgICAgZmxvYXQgc2luVGhldGEgPSBzcXJ0KDEuMCAtIGNvc1RoZXRhICogY29zVGhldGEpO1xuLy8gICAgIHJldHVybiB2ZWMzKGNvcyhwaGkpICogc2luVGhldGEsIHNpbihwaGkpICogc2luVGhldGEsIGNvc1RoZXRhKTtcbi8vIH1cblxuLy8gZ2VuZXJhdGUgYSB2ZWN0b3Igb24gdGhlIGhlbWlzcGhlcmUgd2l0aCBwaG9uZyByZWZsZWN0aW9uIGRpc3RyaWJ1dGlvblxuY29uc3QgaGVtaXNwaGVyZVNhbXBsZVBob25nID0gKGRzdFZlYywgeCwgeSwgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgIGNvbnN0IHBoaSA9IHkgKiAyICogTWF0aC5QSTtcbiAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGgucG93KDEgLSB4LCAxIC8gKHNwZWN1bGFyUG93ZXIgKyAxKSk7XG4gICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNxcnQoMSAtIGNvc1RoZXRhICogY29zVGhldGEpO1xuICAgIGRzdFZlYy5zZXQoTWF0aC5jb3MocGhpKSAqIHNpblRoZXRhLCBNYXRoLnNpbihwaGkpICogc2luVGhldGEsIGNvc1RoZXRhKS5ub3JtYWxpemUoKTtcbn07XG5cbi8vIGdlbmVyYXRlIGEgdmVjdG9yIG9uIHRoZSBoZW1pc3BoZXJlIHdpdGggbGFtYmVydCBkaXN0cmlidXRpb25cbmNvbnN0IGhlbWlzcGhlcmVTYW1wbGVMYW1iZXJ0ID0gKGRzdFZlYywgeCwgeSkgPT4ge1xuICAgIGNvbnN0IHBoaSA9IHkgKiAyICogTWF0aC5QSTtcbiAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguc3FydCgxIC0geCk7XG4gICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNxcnQoeCk7XG4gICAgZHN0VmVjLnNldChNYXRoLmNvcyhwaGkpICogc2luVGhldGEsIE1hdGguc2luKHBoaSkgKiBzaW5UaGV0YSwgY29zVGhldGEpLm5vcm1hbGl6ZSgpO1xufTtcblxuLy8gZ2VuZXJhdGUgYSB2ZWN0b3Igb24gdGhlIGhlbWlzcGhlcmUgd2l0aCBHR1ggZGlzdHJpYnV0aW9uLlxuLy8gYSBpcyBsaW5lYXIgcm91Z2huZXNzXjJcbmNvbnN0IGhlbWlzcGhlcmVTYW1wbGVHR1ggPSAoZHN0VmVjLCB4LCB5LCBhKSA9PiB7XG4gICAgY29uc3QgcGhpID0geSAqIDIgKiBNYXRoLlBJO1xuICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5zcXJ0KCgxIC0geCkgLyAoMSArIChhICogYSAtIDEpICogeCkpO1xuICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zcXJ0KDEgLSBjb3NUaGV0YSAqIGNvc1RoZXRhKTtcbiAgICBkc3RWZWMuc2V0KE1hdGguY29zKHBoaSkgKiBzaW5UaGV0YSwgTWF0aC5zaW4ocGhpKSAqIHNpblRoZXRhLCBjb3NUaGV0YSkubm9ybWFsaXplKCk7XG59O1xuXG5jb25zdCBEX0dHWCA9IChOb0gsIGxpbmVhclJvdWdobmVzcykgPT4ge1xuICAgIGNvbnN0IGEgPSBOb0ggKiBsaW5lYXJSb3VnaG5lc3M7XG4gICAgY29uc3QgayA9IGxpbmVhclJvdWdobmVzcyAvICgxLjAgLSBOb0ggKiBOb0ggKyBhICogYSk7XG4gICAgcmV0dXJuIGsgKiBrICogKDEgLyBNYXRoLlBJKTtcbn07XG5cbi8vIGdlbmVyYXRlIHByZWNvbXB1dGVkIHNhbXBsZXMgZm9yIHBob25nIHJlZmxlY3Rpb25zIG9mIHRoZSBnaXZlbiBwb3dlclxuY29uc3QgZ2VuZXJhdGVQaG9uZ1NhbXBsZXMgPSAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgIGNvbnN0IEggPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyArK2kpIHtcbiAgICAgICAgaGVtaXNwaGVyZVNhbXBsZVBob25nKEgsIGkgLyBudW1TYW1wbGVzLCByYW5kb20ucmFkaWNhbEludmVyc2UoaSksIHNwZWN1bGFyUG93ZXIpO1xuICAgICAgICByZXN1bHQucHVzaChILngsIEgueSwgSC56LCAwKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gZ2VuZXJhdGUgcHJlY29tcHV0ZWQgc2FtcGxlcyBmb3IgbGFtYmVydCBjb252b2x1dGlvblxuY29uc3QgZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlcyA9IChudW1TYW1wbGVzLCBzb3VyY2VUb3RhbFBpeGVscykgPT4ge1xuICAgIGNvbnN0IHBpeGVsc1BlclNhbXBsZSA9IHNvdXJjZVRvdGFsUGl4ZWxzIC8gbnVtU2FtcGxlcztcblxuICAgIGNvbnN0IEggPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyArK2kpIHtcbiAgICAgICAgaGVtaXNwaGVyZVNhbXBsZUxhbWJlcnQoSCwgaSAvIG51bVNhbXBsZXMsIHJhbmRvbS5yYWRpY2FsSW52ZXJzZShpKSk7XG4gICAgICAgIGNvbnN0IHBkZiA9IEgueiAvIE1hdGguUEk7XG4gICAgICAgIGNvbnN0IG1pcExldmVsID0gMC41ICogTWF0aC5sb2cyKHBpeGVsc1BlclNhbXBsZSAvIHBkZik7XG4gICAgICAgIHJlc3VsdC5wdXNoKEgueCwgSC55LCBILnosIG1pcExldmVsKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gZ2VuZXJhdGUgYSB0YWJsZSBzdG9yaW5nIHRoZSBudW1iZXIgb2Ygc2FtcGxlcyByZXF1aXJlZCB0byBnZXQgJ251bVNhbXBsZXMnXG4vLyB2YWxpZCBzYW1wbGVzIGZvciB0aGUgZ2l2ZW4gc3BlY3VsYXJQb3dlci5cbi8qIGVzbGludC1kaXNhYmxlIG5vLXVudXNlZC12YXJzICovXG5jb25zdCBjYWxjdWxhdGVSZXF1aXJlZFNhbXBsZXNHR1ggPSAoKSA9PiB7XG4gICAgY29uc3QgY291bnRWYWxpZFNhbXBsZXNHR1ggPSAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgICAgICBjb25zdCByb3VnaG5lc3MgPSAxIC0gTWF0aC5sb2cyKHNwZWN1bGFyUG93ZXIpIC8gMTEuMDtcbiAgICAgICAgY29uc3QgYSA9IHJvdWdobmVzcyAqIHJvdWdobmVzcztcbiAgICAgICAgY29uc3QgSCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IEwgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBOID0gbmV3IFZlYzMoMCwgMCwgMSk7XG5cbiAgICAgICAgbGV0IHZhbGlkU2FtcGxlcyA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgKytpKSB7XG4gICAgICAgICAgICBoZW1pc3BoZXJlU2FtcGxlR0dYKEgsIGkgLyBudW1TYW1wbGVzLCByYW5kb20ucmFkaWNhbEludmVyc2UoaSksIGEpO1xuXG4gICAgICAgICAgICBjb25zdCBOb0ggPSBILno7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2luY2UgTiBpcyAoMCwgMCwgMSlcbiAgICAgICAgICAgIEwuc2V0KEgueCwgSC55LCBILnopLm11bFNjYWxhcigyICogTm9IKS5zdWIoTik7XG5cbiAgICAgICAgICAgIHZhbGlkU2FtcGxlcyArPSBMLnogPiAwID8gMSA6IDA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsaWRTYW1wbGVzO1xuICAgIH07XG5cbiAgICBjb25zdCBudW1TYW1wbGVzID0gWzEwMjQsIDEyOCwgMzIsIDE2XTtcbiAgICBjb25zdCBzcGVjdWxhclBvd2VycyA9IFs1MTIsIDEyOCwgMzIsIDgsIDJdO1xuXG4gICAgY29uc3QgcmVxdWlyZWRUYWJsZSA9IHt9O1xuICAgIG51bVNhbXBsZXMuZm9yRWFjaCgobnVtU2FtcGxlcykgPT4ge1xuICAgICAgICBjb25zdCB0YWJsZSA9IHsgfTtcbiAgICAgICAgc3BlY3VsYXJQb3dlcnMuZm9yRWFjaCgoc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgICAgICAgICAgbGV0IHJlcXVpcmVkU2FtcGxlcyA9IG51bVNhbXBsZXM7XG4gICAgICAgICAgICB3aGlsZSAoY291bnRWYWxpZFNhbXBsZXNHR1gocmVxdWlyZWRTYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA8IG51bVNhbXBsZXMpIHtcbiAgICAgICAgICAgICAgICByZXF1aXJlZFNhbXBsZXMrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhYmxlW3NwZWN1bGFyUG93ZXJdID0gcmVxdWlyZWRTYW1wbGVzO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVxdWlyZWRUYWJsZVtudW1TYW1wbGVzXSA9IHRhYmxlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlcXVpcmVkVGFibGU7XG59O1xuXG4vLyBwcmludCB0byB0aGUgY29uc29sZSB0aGUgcmVxdWlyZWQgc2FtcGxlcyB0YWJsZSBmb3IgR0dYIHJlZmxlY3Rpb24gY29udm9sdXRpb25cbi8vIGNvbnNvbGUubG9nKGNhbGN1bGF0ZVJlcXVpcmVkU2FtcGxlc0dHWCgpKTtcblxuLy8gdGhpcyBpcyBhIHRhYmxlIHdpdGggcHJlLWNhbGN1bGF0ZWQgbnVtYmVyIG9mIHNhbXBsZXMgcmVxdWlyZWQgZm9yIEdHWC5cbi8vIHRoZSB0YWJsZSBpcyBnZW5lcmF0ZWQgYnkgY2FsY3VsYXRlUmVxdWlyZWRTYW1wbGVzR0dYKClcbi8vIHRoZSB0YWJsZSBpcyBvcmdhbml6ZWQgYnkgW251bVNhbXBsZXNdW3NwZWN1bGFyUG93ZXJdXG4vL1xuLy8gd2UgdXNlIGEgcmVwZWF0YWJsZSBwc2V1ZG8tcmFuZG9tIHNlcXVlbmNlIG9mIG51bWJlcnMgd2hlbiBnZW5lcmF0aW5nIHNhbXBsZXNcbi8vIGZvciB1c2UgaW4gcHJlZmlsdGVyaW5nIEdHWCByZWZsZWN0aW9ucy4gaG93ZXZlciBub3QgYWxsIHRoZSByYW5kb20gc2FtcGxlc1xuLy8gd2lsbCBiZSB2YWxpZC4gdGhpcyBpcyBiZWNhdXNlIHNvbWUgcmVzdWx0aW5nIHJlZmxlY3Rpb24gdmVjdG9ycyB3aWxsIGJlIGJlbG93XG4vLyB0aGUgaGVtaXNwaGVyZS4gdGhpcyBpcyBlc3BlY2lhbGx5IGFwcGFyZW50IHdoZW4gY2FsY3VsYXRpbmcgdmVjdG9ycyBmb3IgdGhlXG4vLyBoaWdoZXIgcm91Z2huZXNzZXMuIChzaW5jZSB2ZWN0b3JzIGFyZSBtb3JlIHdpbGQsIG1vcmUgb2YgdGhlbSBhcmUgaW52YWxpZCkuXG4vLyBmb3IgZXhhbXBsZSwgc3BlY3VsYXJQb3dlciAyIHJlc3VsdHMgaW4gaGFsZiB0aGUgZ2VuZXJhdGVkIHZlY3RvcnMgYmVpbmdcbi8vIGludmFsaWQuIChtZWFuaW5nIHRoZSBHUFUgd291bGQgc3BlbmQgaGFsZiB0aGUgdGltZSBvbiB2ZWN0b3JzIHRoYXQgZG9uJ3Rcbi8vIGNvbnRyaWJ1dGUgdG8gdGhlIGZpbmFsIHJlc3VsdCkuXG4vL1xuLy8gY2FsY3VsYXRpbmcgaG93IG1hbnkgc2FtcGxlcyBhcmUgcmVxdWlyZWQgdG8gZ2VuZXJhdGUgJ24nIHZhbGlkIHNhbXBsZXMgaXMgYVxuLy8gc2xvdyBvcGVyYXRpb24sIHNvIHRoaXMgdGFibGUgc3RvcmVzIHRoZSBwcmUtY2FsY3VsYXRlZCBudW1iZXJzIG9mIHNhbXBsZXNcbi8vIHJlcXVpcmVkIGZvciB0aGUgc2V0cyBvZiAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcnMpIHBhaXJzIHdlIGV4cGVjdCB0b1xuLy8gZW5jb3VudGVyIGF0IHJ1bnRpbWUuXG5jb25zdCByZXF1aXJlZFNhbXBsZXNHR1ggPSB7XG4gICAgXCIxNlwiOiB7XG4gICAgICAgIFwiMlwiOiAyNixcbiAgICAgICAgXCI4XCI6IDIwLFxuICAgICAgICBcIjMyXCI6IDE3LFxuICAgICAgICBcIjEyOFwiOiAxNixcbiAgICAgICAgXCI1MTJcIjogMTZcbiAgICB9LFxuICAgIFwiMzJcIjoge1xuICAgICAgICBcIjJcIjogNTMsXG4gICAgICAgIFwiOFwiOiA0MCxcbiAgICAgICAgXCIzMlwiOiAzNCxcbiAgICAgICAgXCIxMjhcIjogMzIsXG4gICAgICAgIFwiNTEyXCI6IDMyXG4gICAgfSxcbiAgICBcIjEyOFwiOiB7XG4gICAgICAgIFwiMlwiOiAyMTQsXG4gICAgICAgIFwiOFwiOiAxNjMsXG4gICAgICAgIFwiMzJcIjogMTM5LFxuICAgICAgICBcIjEyOFwiOiAxMzAsXG4gICAgICAgIFwiNTEyXCI6IDEyOFxuICAgIH0sXG4gICAgXCIxMDI0XCI6IHtcbiAgICAgICAgXCIyXCI6IDE3MjIsXG4gICAgICAgIFwiOFwiOiAxMzEwLFxuICAgICAgICBcIjMyXCI6IDExMTQsXG4gICAgICAgIFwiMTI4XCI6IDEwNDEsXG4gICAgICAgIFwiNTEyXCI6IDEwMjVcbiAgICB9XG59O1xuXG4vLyBnZXQgdGhlIG51bWJlciBvZiByYW5kb20gc2FtcGxlcyByZXF1aXJlZCB0byBnZW5lcmF0ZSBudW1TYW1wbGVzIHZhbGlkIHNhbXBsZXMuXG5jb25zdCBnZXRSZXF1aXJlZFNhbXBsZXNHR1ggPSAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgIGNvbnN0IHRhYmxlID0gcmVxdWlyZWRTYW1wbGVzR0dYW251bVNhbXBsZXNdO1xuICAgIHJldHVybiAodGFibGUgJiYgdGFibGVbc3BlY3VsYXJQb3dlcl0pIHx8IG51bVNhbXBsZXM7XG59O1xuXG4vLyBnZW5lcmF0ZSBwcmVjb21wdXRlZCBHR1ggc2FtcGxlc1xuY29uc3QgZ2VuZXJhdGVHR1hTYW1wbGVzID0gKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIsIHNvdXJjZVRvdGFsUGl4ZWxzKSA9PiB7XG4gICAgY29uc3QgcGl4ZWxzUGVyU2FtcGxlID0gc291cmNlVG90YWxQaXhlbHMgLyBudW1TYW1wbGVzO1xuICAgIGNvbnN0IHJvdWdobmVzcyA9IDEgLSBNYXRoLmxvZzIoc3BlY3VsYXJQb3dlcikgLyAxMS4wO1xuICAgIGNvbnN0IGEgPSByb3VnaG5lc3MgKiByb3VnaG5lc3M7XG4gICAgY29uc3QgSCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgTCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgTiA9IG5ldyBWZWMzKDAsIDAsIDEpO1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgY29uc3QgcmVxdWlyZWRTYW1wbGVzID0gZ2V0UmVxdWlyZWRTYW1wbGVzR0dYKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXF1aXJlZFNhbXBsZXM7ICsraSkge1xuICAgICAgICBoZW1pc3BoZXJlU2FtcGxlR0dYKEgsIGkgLyByZXF1aXJlZFNhbXBsZXMsIHJhbmRvbS5yYWRpY2FsSW52ZXJzZShpKSwgYSk7XG5cbiAgICAgICAgY29uc3QgTm9IID0gSC56OyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNpbmNlIE4gaXMgKDAsIDAsIDEpXG4gICAgICAgIEwuc2V0KEgueCwgSC55LCBILnopLm11bFNjYWxhcigyICogTm9IKS5zdWIoTik7XG5cbiAgICAgICAgaWYgKEwueiA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHBkZiA9IERfR0dYKE1hdGgubWluKDEsIE5vSCksIGEpIC8gNCArIDAuMDAxO1xuICAgICAgICAgICAgY29uc3QgbWlwTGV2ZWwgPSAwLjUgKiBNYXRoLmxvZzIocGl4ZWxzUGVyU2FtcGxlIC8gcGRmKTtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKEwueCwgTC55LCBMLnosIG1pcExldmVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlIChyZXN1bHQubGVuZ3RoIDwgbnVtU2FtcGxlcyAqIDQpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goMCwgMCwgMCwgMCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIHBhY2sgZmxvYXQgc2FtcGxlcyBkYXRhIGludG8gYW4gcmdiYTggdGV4dHVyZVxuY29uc3QgY3JlYXRlU2FtcGxlc1RleCA9IChkZXZpY2UsIG5hbWUsIHNhbXBsZXMpID0+IHtcbiAgICBjb25zdCBwYWNrZWRTYW1wbGVzID0gcGFja1NhbXBsZXMoc2FtcGxlcyk7XG4gICAgcmV0dXJuIG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICB3aWR0aDogcGFja2VkU2FtcGxlcy53aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBwYWNrZWRTYW1wbGVzLmhlaWdodCxcbiAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgIG1pbkZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgIGxldmVsczogW3BhY2tlZFNhbXBsZXMuZGF0YV1cbiAgICB9KTtcbn07XG5cbi8vIHNpbXBsZSBjYWNoZSBzdG9yaW5nIGtleS0+dmFsdWVcbi8vIG1pc3NGdW5jIGlzIGNhbGxlZCBpZiB0aGUga2V5IGlzIG5vdCBwcmVzZW50XG5jbGFzcyBTaW1wbGVDYWNoZSB7XG4gICAgY29uc3RydWN0b3IoZGVzdHJveUNvbnRlbnQgPSB0cnVlKSB7XG4gICAgICAgIHRoaXMuZGVzdHJveUNvbnRlbnQgPSBkZXN0cm95Q29udGVudDtcbiAgICB9XG5cbiAgICBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBpZiAodGhpcy5kZXN0cm95Q29udGVudCkge1xuICAgICAgICAgICAgdGhpcy5tYXAuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhbHVlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0KGtleSwgbWlzc0Z1bmMpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hcC5oYXMoa2V5KSkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gbWlzc0Z1bmMoKTtcbiAgICAgICAgICAgIHRoaXMubWFwLnNldChrZXksIHJlc3VsdCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm1hcC5nZXQoa2V5KTtcbiAgICB9XG59XG5cbi8vIGNhY2hlLCB1c2VkIHRvIHN0b3JlIHNhbXBsZXMuIHdlIHN0b3JlIHRoZXNlIHNlcGFyYXRlbHkgZnJvbSB0ZXh0dXJlcyBzaW5jZSBtdWx0aXBsZVxuLy8gZGV2aWNlcyBjYW4gdXNlIHRoZSBzYW1lIHNldCBvZiBzYW1wbGVzLlxuY29uc3Qgc2FtcGxlc0NhY2hlID0gbmV3IFNpbXBsZUNhY2hlKGZhbHNlKTtcblxuLy8gY2FjaGUsIHN0b3Jpbmcgc2FtcGxlcyBzdG9yZWQgaW4gdGV4dHVyZXMsIHRob3NlIGFyZSBwZXIgZGV2aWNlXG5jb25zdCBkZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG5jb25zdCBnZXRDYWNoZWRUZXh0dXJlID0gKGRldmljZSwga2V5LCBnZXRTYW1wbGVzRm5jKSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBkZXZpY2VDYWNoZS5nZXQoZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgU2ltcGxlQ2FjaGUoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBjYWNoZS5nZXQoa2V5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBjcmVhdGVTYW1wbGVzVGV4KGRldmljZSwga2V5LCBzYW1wbGVzQ2FjaGUuZ2V0KGtleSwgZ2V0U2FtcGxlc0ZuYykpO1xuICAgIH0pO1xufTtcblxuY29uc3QgZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlc1RleCA9IChkZXZpY2UsIG51bVNhbXBsZXMsIHNvdXJjZVRvdGFsUGl4ZWxzKSA9PiB7XG4gICAgY29uc3Qga2V5ID0gYGxhbWJlcnQtc2FtcGxlcy0ke251bVNhbXBsZXN9LSR7c291cmNlVG90YWxQaXhlbHN9YDtcbiAgICByZXR1cm4gZ2V0Q2FjaGVkVGV4dHVyZShkZXZpY2UsIGtleSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlcyhudW1TYW1wbGVzLCBzb3VyY2VUb3RhbFBpeGVscyk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBnZW5lcmF0ZVBob25nU2FtcGxlc1RleCA9IChkZXZpY2UsIG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICBjb25zdCBrZXkgPSBgcGhvbmctc2FtcGxlcy0ke251bVNhbXBsZXN9LSR7c3BlY3VsYXJQb3dlcn1gO1xuICAgIHJldHVybiBnZXRDYWNoZWRUZXh0dXJlKGRldmljZSwga2V5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZVBob25nU2FtcGxlcyhudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlR0dYU2FtcGxlc1RleCA9IChkZXZpY2UsIG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIsIHNvdXJjZVRvdGFsUGl4ZWxzKSA9PiB7XG4gICAgY29uc3Qga2V5ID0gYGdneC1zYW1wbGVzLSR7bnVtU2FtcGxlc30tJHtzcGVjdWxhclBvd2VyfS0ke3NvdXJjZVRvdGFsUGl4ZWxzfWA7XG4gICAgcmV0dXJuIGdldENhY2hlZFRleHR1cmUoZGV2aWNlLCBrZXksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlR0dYU2FtcGxlcyhudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyLCBzb3VyY2VUb3RhbFBpeGVscyk7XG4gICAgfSk7XG59O1xuXG5jb25zdCB2c0NvZGUgPSBgXG5hdHRyaWJ1dGUgdmVjMiB2ZXJ0ZXhfcG9zaXRpb247XG5cbnVuaWZvcm0gdmVjNCB1dk1vZDtcblxudmFyeWluZyB2ZWMyIHZVdjA7XG5cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZ2xfUG9zaXRpb24gPSB2ZWM0KHZlcnRleF9wb3NpdGlvbiwgMC41LCAxLjApO1xuICAgIHZVdjAgPSBnZXRJbWFnZUVmZmVjdFVWKCh2ZXJ0ZXhfcG9zaXRpb24ueHkgKiAwLjUgKyAwLjUpICogdXZNb2QueHkgKyB1dk1vZC56dyk7XG59XG5gO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gcmVwcm9qZWN0cyB0ZXh0dXJlcyBiZXR3ZWVuIGN1YmVtYXAsIGVxdWlyZWN0YW5ndWxhciBhbmQgb2N0YWhlZHJhbCBmb3JtYXRzLiBUaGVcbiAqIGZ1bmN0aW9uIGNhbiByZWFkIGFuZCB3cml0ZSB0ZXh0dXJlcyB3aXRoIHBpeGVsIGRhdGEgaW4gUkdCRSwgUkdCTSwgbGluZWFyIGFuZCBzUkdCIGZvcm1hdHMuXG4gKiBXaGVuIHNwZWN1bGFyUG93ZXIgaXMgc3BlY2lmaWVkIGl0IHdpbGwgcGVyZm9ybSBhIHBob25nLXdlaWdodGVkIGNvbnZvbHV0aW9uIG9mIHRoZSBzb3VyY2UgKGZvclxuICogZ2VuZXJhdGluZyBhIGdsb3NzIG1hcHMpLlxuICpcbiAqIEBwYXJhbSB7VGV4dHVyZX0gc291cmNlIC0gVGhlIHNvdXJjZSB0ZXh0dXJlLlxuICogQHBhcmFtIHtUZXh0dXJlfSB0YXJnZXQgLSBUaGUgdGFyZ2V0IHRleHR1cmUuXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gVGhlIG9wdGlvbnMgb2JqZWN0LlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnNwZWN1bGFyUG93ZXJdIC0gT3B0aW9uYWwgc3BlY3VsYXIgcG93ZXIuIFdoZW4gc3BlY3VsYXIgcG93ZXIgaXNcbiAqIHNwZWNpZmllZCwgdGhlIHNvdXJjZSBpcyBjb252b2x2ZWQgYnkgYSBwaG9uZy13ZWlnaHRlZCBrZXJuZWwgcmFpc2VkIHRvIHRoZSBzcGVjaWZpZWQgcG93ZXIuXG4gKiBPdGhlcndpc2UgdGhlIGZ1bmN0aW9uIHBlcmZvcm1zIGEgc3RhbmRhcmQgcmVzYW1wbGUuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubnVtU2FtcGxlc10gLSBPcHRpb25hbCBudW1iZXIgb2Ygc2FtcGxlcyAoZGVmYXVsdCBpcyAxMDI0KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mYWNlXSAtIE9wdGlvbmFsIGN1YmVtYXAgZmFjZSB0byB1cGRhdGUgKGRlZmF1bHQgaXMgdXBkYXRlIGFsbCBmYWNlcykuXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGlzdHJpYnV0aW9uXSAtIFNwZWNpZnkgY29udm9sdXRpb24gZGlzdHJpYnV0aW9uIC0gJ25vbmUnLCAnbGFtYmVydCcsXG4gKiAncGhvbmcnLCAnZ2d4Jy4gRGVmYXVsdCBkZXBlbmRzIG9uIHNwZWN1bGFyUG93ZXIuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnKS5WZWM0fSBbb3B0aW9ucy5yZWN0XSAtIE9wdGlvbmFsIHZpZXdwb3J0IHJlY3RhbmdsZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zZWFtUGl4ZWxzXSAtIE9wdGlvbmFsIG51bWJlciBvZiBzZWFtIHBpeGVscyB0byByZW5kZXJcbiAqL1xuZnVuY3Rpb24gcmVwcm9qZWN0VGV4dHVyZShzb3VyY2UsIHRhcmdldCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gbWFpbnRhaW4gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBwcmV2aW91cyBmdW5jdGlvbiBzaWduYXR1cmVcbiAgICAvLyByZXByb2plY3RUZXh0dXJlKGRldmljZSwgc291cmNlLCB0YXJnZXQsIHNwZWN1bGFyUG93ZXIgPSAxLCBudW1TYW1wbGVzID0gMTAyNClcbiAgICBpZiAoc291cmNlIGluc3RhbmNlb2YgR3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgc291cmNlID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMl07XG4gICAgICAgIG9wdGlvbnMgPSB7IH07XG4gICAgICAgIGlmIChhcmd1bWVudHNbM10gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5zcGVjdWxhclBvd2VyID0gYXJndW1lbnRzWzNdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhcmd1bWVudHNbNF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5udW1TYW1wbGVzID0gYXJndW1lbnRzWzRdO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGxlYXNlIHVzZSB0aGUgdXBkYXRlZCBwYy5yZXByb2plY3RUZXh0dXJlIEFQSS4nKTtcbiAgICB9XG5cbiAgICAvLyB0YWJsZSBvZiBkaXN0cmlidXRpb24gLT4gZnVuY3Rpb24gbmFtZVxuICAgIGNvbnN0IGZ1bmNOYW1lcyA9IHtcbiAgICAgICAgJ25vbmUnOiAncmVwcm9qZWN0JyxcbiAgICAgICAgJ2xhbWJlcnQnOiAncHJlZmlsdGVyU2FtcGxlc1Vud2VpZ2h0ZWQnLFxuICAgICAgICAncGhvbmcnOiAncHJlZmlsdGVyU2FtcGxlc1Vud2VpZ2h0ZWQnLFxuICAgICAgICAnZ2d4JzogJ3ByZWZpbHRlclNhbXBsZXMnXG4gICAgfTtcblxuICAgIC8vIGV4dHJhY3Qgb3B0aW9uc1xuICAgIGNvbnN0IHNwZWN1bGFyUG93ZXIgPSBvcHRpb25zLmhhc093blByb3BlcnR5KCdzcGVjdWxhclBvd2VyJykgPyBvcHRpb25zLnNwZWN1bGFyUG93ZXIgOiAxO1xuICAgIGNvbnN0IGZhY2UgPSBvcHRpb25zLmhhc093blByb3BlcnR5KCdmYWNlJykgPyBvcHRpb25zLmZhY2UgOiBudWxsO1xuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2Rpc3RyaWJ1dGlvbicpID8gb3B0aW9ucy5kaXN0cmlidXRpb24gOiAoc3BlY3VsYXJQb3dlciA9PT0gMSkgPyAnbm9uZScgOiAncGhvbmcnO1xuXG4gICAgY29uc3QgcHJvY2Vzc0Z1bmMgPSBmdW5jTmFtZXNbZGlzdHJpYnV0aW9uXSB8fCAncmVwcm9qZWN0JztcbiAgICBjb25zdCBwcmVmaWx0ZXJTYW1wbGVzID0gcHJvY2Vzc0Z1bmMuc3RhcnRzV2l0aCgncHJlZmlsdGVyU2FtcGxlcycpO1xuICAgIGNvbnN0IGRlY29kZUZ1bmMgPSBDaHVua1V0aWxzLmRlY29kZUZ1bmMoc291cmNlLmVuY29kaW5nKTtcbiAgICBjb25zdCBlbmNvZGVGdW5jID0gQ2h1bmtVdGlscy5lbmNvZGVGdW5jKHRhcmdldC5lbmNvZGluZyk7XG4gICAgY29uc3Qgc291cmNlRnVuYyA9IGBzYW1wbGUke2dldFByb2plY3Rpb25OYW1lKHNvdXJjZS5wcm9qZWN0aW9uKX1gO1xuICAgIGNvbnN0IHRhcmdldEZ1bmMgPSBgZ2V0RGlyZWN0aW9uJHtnZXRQcm9qZWN0aW9uTmFtZSh0YXJnZXQucHJvamVjdGlvbil9YDtcbiAgICBjb25zdCBudW1TYW1wbGVzID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnbnVtU2FtcGxlcycpID8gb3B0aW9ucy5udW1TYW1wbGVzIDogMTAyNDtcblxuICAgIC8vIGdlbmVyYXRlIHVuaXF1ZSBzaGFkZXIga2V5XG4gICAgY29uc3Qgc2hhZGVyS2V5ID0gYCR7cHJvY2Vzc0Z1bmN9XyR7ZGVjb2RlRnVuY31fJHtlbmNvZGVGdW5jfV8ke3NvdXJjZUZ1bmN9XyR7dGFyZ2V0RnVuY31fJHtudW1TYW1wbGVzfWA7XG5cbiAgICBjb25zdCBkZXZpY2UgPSBzb3VyY2UuZGV2aWNlO1xuXG4gICAgbGV0IHNoYWRlciA9IGdldFByb2dyYW1MaWJyYXJ5KGRldmljZSkuZ2V0Q2FjaGVkU2hhZGVyKHNoYWRlcktleSk7XG4gICAgaWYgKCFzaGFkZXIpIHtcbiAgICAgICAgY29uc3QgZGVmaW5lcyA9XG4gICAgICAgICAgICBgI2RlZmluZSBQUk9DRVNTX0ZVTkMgJHtwcm9jZXNzRnVuY31cXG5gICtcbiAgICAgICAgICAgIChwcmVmaWx0ZXJTYW1wbGVzID8gYCNkZWZpbmUgVVNFX1NBTVBMRVNfVEVYXFxuYCA6ICcnKSArXG4gICAgICAgICAgICAoc291cmNlLmN1YmVtYXAgPyBgI2RlZmluZSBDVUJFTUFQX1NPVVJDRVxcbmAgOiAnJykgK1xuICAgICAgICAgICAgYCNkZWZpbmUgREVDT0RFX0ZVTkMgJHtkZWNvZGVGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgRU5DT0RFX0ZVTkMgJHtlbmNvZGVGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgU09VUkNFX0ZVTkMgJHtzb3VyY2VGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgVEFSR0VUX0ZVTkMgJHt0YXJnZXRGdW5jfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgTlVNX1NBTVBMRVMgJHtudW1TYW1wbGVzfVxcbmAgK1xuICAgICAgICAgICAgYCNkZWZpbmUgTlVNX1NBTVBMRVNfU1FSVCAke01hdGgucm91bmQoTWF0aC5zcXJ0KG51bVNhbXBsZXMpKS50b0ZpeGVkKDEpfVxcbmA7XG5cbiAgICAgICAgc2hhZGVyID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoXG4gICAgICAgICAgICBkZXZpY2UsXG4gICAgICAgICAgICB2c0NvZGUsXG4gICAgICAgICAgICBgJHtkZWZpbmVzfVxcbiR7c2hhZGVyQ2h1bmtzLnJlcHJvamVjdFBTfWAsXG4gICAgICAgICAgICBzaGFkZXJLZXlcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBcIlJlcHJvamVjdFRleHR1cmVcIik7XG5cbiAgICBjb25zdCBjb25zdGFudFNvdXJjZSA9IGRldmljZS5zY29wZS5yZXNvbHZlKHNvdXJjZS5jdWJlbWFwID8gXCJzb3VyY2VDdWJlXCIgOiBcInNvdXJjZVRleFwiKTtcbiAgICBEZWJ1Zy5hc3NlcnQoY29uc3RhbnRTb3VyY2UpO1xuICAgIGNvbnN0YW50U291cmNlLnNldFZhbHVlKHNvdXJjZSk7XG5cbiAgICBjb25zdCBjb25zdGFudFBhcmFtcyA9IGRldmljZS5zY29wZS5yZXNvbHZlKFwicGFyYW1zXCIpO1xuICAgIGNvbnN0IGNvbnN0YW50UGFyYW1zMiA9IGRldmljZS5zY29wZS5yZXNvbHZlKFwicGFyYW1zMlwiKTtcblxuICAgIGNvbnN0IHV2TW9kUGFyYW0gPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShcInV2TW9kXCIpO1xuICAgIGlmIChvcHRpb25zPy5zZWFtUGl4ZWxzKSB7XG4gICAgICAgIGNvbnN0IHAgPSBvcHRpb25zLnNlYW1QaXhlbHM7XG4gICAgICAgIGNvbnN0IHcgPSBvcHRpb25zLnJlY3QgPyBvcHRpb25zLnJlY3QueiA6IHRhcmdldC53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IG9wdGlvbnMucmVjdCA/IG9wdGlvbnMucmVjdC53IDogdGFyZ2V0LmhlaWdodDtcblxuICAgICAgICBjb25zdCBpbm5lcldpZHRoID0gdyAtIHAgKiAyO1xuICAgICAgICBjb25zdCBpbm5lckhlaWdodCA9IGggLSBwICogMjtcblxuICAgICAgICB1dk1vZFBhcmFtLnNldFZhbHVlKFtcbiAgICAgICAgICAgIChpbm5lcldpZHRoICsgcCAqIDIpIC8gaW5uZXJXaWR0aCxcbiAgICAgICAgICAgIChpbm5lckhlaWdodCArIHAgKiAyKSAvIGlubmVySGVpZ2h0LFxuICAgICAgICAgICAgLXAgLyBpbm5lcldpZHRoLFxuICAgICAgICAgICAgLXAgLyBpbm5lckhlaWdodFxuICAgICAgICBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1dk1vZFBhcmFtLnNldFZhbHVlKFsxLCAxLCAwLCAwXSk7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0gW1xuICAgICAgICAwLFxuICAgICAgICBzcGVjdWxhclBvd2VyLFxuICAgICAgICBzb3VyY2UuZml4Q3ViZW1hcFNlYW1zID8gMS4wIC8gc291cmNlLndpZHRoIDogMC4wLCAgICAgICAgICAvLyBzb3VyY2Ugc2VhbSBzY2FsZVxuICAgICAgICB0YXJnZXQuZml4Q3ViZW1hcFNlYW1zID8gMS4wIC8gdGFyZ2V0LndpZHRoIDogMC4wICAgICAgICAgICAvLyB0YXJnZXQgc2VhbSBzY2FsZVxuICAgIF07XG5cbiAgICBjb25zdCBwYXJhbXMyID0gW1xuICAgICAgICB0YXJnZXQud2lkdGggKiB0YXJnZXQuaGVpZ2h0ICogKHRhcmdldC5jdWJlbWFwID8gNiA6IDEpLFxuICAgICAgICBzb3VyY2Uud2lkdGggKiBzb3VyY2UuaGVpZ2h0ICogKHNvdXJjZS5jdWJlbWFwID8gNiA6IDEpXG4gICAgXTtcblxuICAgIGlmIChwcmVmaWx0ZXJTYW1wbGVzKSB7XG4gICAgICAgIC8vIHNldCBvciBnZW5lcmF0ZSB0aGUgcHJlLWNhbGN1bGF0ZWQgc2FtcGxlcyBkYXRhXG4gICAgICAgIGNvbnN0IHNvdXJjZVRvdGFsUGl4ZWxzID0gc291cmNlLndpZHRoICogc291cmNlLmhlaWdodCAqIChzb3VyY2UuY3ViZW1hcCA/IDYgOiAxKTtcbiAgICAgICAgY29uc3Qgc2FtcGxlc1RleCA9XG4gICAgICAgICAgICAoZGlzdHJpYnV0aW9uID09PSAnZ2d4JykgPyBnZW5lcmF0ZUdHWFNhbXBsZXNUZXgoZGV2aWNlLCBudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyLCBzb3VyY2VUb3RhbFBpeGVscykgOlxuICAgICAgICAgICAgICAgICgoZGlzdHJpYnV0aW9uID09PSAnbGFtYmVydCcpID8gZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlc1RleChkZXZpY2UsIG51bVNhbXBsZXMsIHNvdXJjZVRvdGFsUGl4ZWxzKSA6XG4gICAgICAgICAgICAgICAgICAgIGdlbmVyYXRlUGhvbmdTYW1wbGVzVGV4KGRldmljZSwgbnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikpO1xuICAgICAgICBkZXZpY2Uuc2NvcGUucmVzb2x2ZShcInNhbXBsZXNUZXhcIikuc2V0VmFsdWUoc2FtcGxlc1RleCk7XG4gICAgICAgIGRldmljZS5zY29wZS5yZXNvbHZlKFwic2FtcGxlc1RleEludmVyc2VTaXplXCIpLnNldFZhbHVlKFsxLjAgLyBzYW1wbGVzVGV4LndpZHRoLCAxLjAgLyBzYW1wbGVzVGV4LmhlaWdodF0pO1xuICAgIH1cblxuICAgIGZvciAobGV0IGYgPSAwOyBmIDwgKHRhcmdldC5jdWJlbWFwID8gNiA6IDEpOyBmKyspIHtcbiAgICAgICAgaWYgKGZhY2UgPT09IG51bGwgfHwgZiA9PT0gZmFjZSkge1xuICAgICAgICAgICAgY29uc3QgcmVuZGVyVGFyZ2V0ID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgY29sb3JCdWZmZXI6IHRhcmdldCxcbiAgICAgICAgICAgICAgICBmYWNlOiBmLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwYXJhbXNbMF0gPSBmO1xuICAgICAgICAgICAgY29uc3RhbnRQYXJhbXMuc2V0VmFsdWUocGFyYW1zKTtcbiAgICAgICAgICAgIGNvbnN0YW50UGFyYW1zMi5zZXRWYWx1ZShwYXJhbXMyKTtcblxuICAgICAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgcmVuZGVyVGFyZ2V0LCBzaGFkZXIsIG9wdGlvbnM/LnJlY3QpO1xuXG4gICAgICAgICAgICByZW5kZXJUYXJnZXQuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcbn1cblxuZXhwb3J0IHsgcmVwcm9qZWN0VGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbImdldFByb2plY3Rpb25OYW1lIiwicHJvamVjdGlvbiIsIlRFWFRVUkVQUk9KRUNUSU9OX0NVQkUiLCJURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMIiwicGFja0Zsb2F0MzJUb1JHQkE4IiwidmFsdWUiLCJhcnJheSIsIm9mZnNldCIsImVuY1giLCJlbmNZIiwiZW5jWiIsImVuY1ciLCJNYXRoIiwibWluIiwiZmxvb3IiLCJwYWNrU2FtcGxlcyIsInNhbXBsZXMiLCJudW1TYW1wbGVzIiwibGVuZ3RoIiwidyIsImgiLCJjZWlsIiwiZGF0YSIsIlVpbnQ4QXJyYXkiLCJvZmYiLCJpIiwid2lkdGgiLCJoZWlnaHQiLCJoZW1pc3BoZXJlU2FtcGxlUGhvbmciLCJkc3RWZWMiLCJ4IiwieSIsInNwZWN1bGFyUG93ZXIiLCJwaGkiLCJQSSIsImNvc1RoZXRhIiwicG93Iiwic2luVGhldGEiLCJzcXJ0Iiwic2V0IiwiY29zIiwic2luIiwibm9ybWFsaXplIiwiaGVtaXNwaGVyZVNhbXBsZUxhbWJlcnQiLCJoZW1pc3BoZXJlU2FtcGxlR0dYIiwiYSIsIkRfR0dYIiwiTm9IIiwibGluZWFyUm91Z2huZXNzIiwiayIsImdlbmVyYXRlUGhvbmdTYW1wbGVzIiwiSCIsIlZlYzMiLCJyZXN1bHQiLCJyYW5kb20iLCJyYWRpY2FsSW52ZXJzZSIsInB1c2giLCJ6IiwiZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlcyIsInNvdXJjZVRvdGFsUGl4ZWxzIiwicGl4ZWxzUGVyU2FtcGxlIiwicGRmIiwibWlwTGV2ZWwiLCJsb2cyIiwicmVxdWlyZWRTYW1wbGVzR0dYIiwiZ2V0UmVxdWlyZWRTYW1wbGVzR0dYIiwidGFibGUiLCJnZW5lcmF0ZUdHWFNhbXBsZXMiLCJyb3VnaG5lc3MiLCJMIiwiTiIsInJlcXVpcmVkU2FtcGxlcyIsIm11bFNjYWxhciIsInN1YiIsImNyZWF0ZVNhbXBsZXNUZXgiLCJkZXZpY2UiLCJuYW1lIiwicGFja2VkU2FtcGxlcyIsIlRleHR1cmUiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJsZXZlbHMiLCJTaW1wbGVDYWNoZSIsImNvbnN0cnVjdG9yIiwiZGVzdHJveUNvbnRlbnQiLCJtYXAiLCJNYXAiLCJkZXN0cm95IiwiZm9yRWFjaCIsImtleSIsImdldCIsIm1pc3NGdW5jIiwiaGFzIiwic2FtcGxlc0NhY2hlIiwiZGV2aWNlQ2FjaGUiLCJEZXZpY2VDYWNoZSIsImdldENhY2hlZFRleHR1cmUiLCJnZXRTYW1wbGVzRm5jIiwiY2FjaGUiLCJnZW5lcmF0ZUxhbWJlcnRTYW1wbGVzVGV4IiwiZ2VuZXJhdGVQaG9uZ1NhbXBsZXNUZXgiLCJnZW5lcmF0ZUdHWFNhbXBsZXNUZXgiLCJ2c0NvZGUiLCJyZXByb2plY3RUZXh0dXJlIiwic291cmNlIiwidGFyZ2V0Iiwib3B0aW9ucyIsIkdyYXBoaWNzRGV2aWNlIiwiYXJndW1lbnRzIiwidW5kZWZpbmVkIiwiRGVidWciLCJkZXByZWNhdGVkIiwiZnVuY05hbWVzIiwiaGFzT3duUHJvcGVydHkiLCJmYWNlIiwiZGlzdHJpYnV0aW9uIiwicHJvY2Vzc0Z1bmMiLCJwcmVmaWx0ZXJTYW1wbGVzIiwic3RhcnRzV2l0aCIsImRlY29kZUZ1bmMiLCJDaHVua1V0aWxzIiwiZW5jb2RpbmciLCJlbmNvZGVGdW5jIiwic291cmNlRnVuYyIsInRhcmdldEZ1bmMiLCJzaGFkZXJLZXkiLCJzaGFkZXIiLCJnZXRQcm9ncmFtTGlicmFyeSIsImdldENhY2hlZFNoYWRlciIsImRlZmluZXMiLCJjdWJlbWFwIiwicm91bmQiLCJ0b0ZpeGVkIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJzaGFkZXJDaHVua3MiLCJyZXByb2plY3RQUyIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwiY29uc3RhbnRTb3VyY2UiLCJzY29wZSIsInJlc29sdmUiLCJhc3NlcnQiLCJzZXRWYWx1ZSIsImNvbnN0YW50UGFyYW1zIiwiY29uc3RhbnRQYXJhbXMyIiwidXZNb2RQYXJhbSIsInNlYW1QaXhlbHMiLCJwIiwicmVjdCIsImlubmVyV2lkdGgiLCJpbm5lckhlaWdodCIsInBhcmFtcyIsImZpeEN1YmVtYXBTZWFtcyIsInBhcmFtczIiLCJzYW1wbGVzVGV4IiwiZiIsInJlbmRlclRhcmdldCIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJwb3BHcHVNYXJrZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0JBLE1BQU1BLGlCQUFpQixHQUFJQyxVQUFVLElBQUs7QUFDdEMsRUFBQSxRQUFRQSxVQUFVO0FBQ2QsSUFBQSxLQUFLQyxzQkFBc0I7QUFDdkIsTUFBQSxPQUFPLFNBQVMsQ0FBQTtBQUNwQixJQUFBLEtBQUtDLDRCQUE0QjtBQUM3QixNQUFBLE9BQU8sWUFBWSxDQUFBO0FBQ3ZCLElBQUE7QUFBUztBQUNMLE1BQUEsT0FBTyxVQUFVLENBQUE7QUFBQyxHQUFBO0FBRTlCLENBQUMsQ0FBQTs7QUFFRDtBQUNBLE1BQU1DLGtCQUFrQixHQUFHLENBQUNDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEtBQUs7RUFDakQsSUFBSUYsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUNaQyxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDckJELElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNyQkQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FB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
