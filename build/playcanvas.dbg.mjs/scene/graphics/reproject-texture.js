/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { TEXTUREPROJECTION_OCTAHEDRAL, TEXTUREPROJECTION_CUBE, FILTER_NEAREST } from '../../platform/graphics/constants.js';
import { Vec3 } from '../../core/math/vec3.js';
import { random } from '../../core/math/random.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { drawQuadWithShader } from '../../platform/graphics/simple-post-effect.js';
import { ChunkUtils } from '../shader-lib/chunk-utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { GraphicsDevice } from '../../platform/graphics/graphics-device.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { Texture } from '../../platform/graphics/texture.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { DeviceCache } from '../../platform/graphics/device-cache.js';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9yZXByb2plY3QtdGV4dHVyZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHtcbiAgICBGSUxURVJfTkVBUkVTVCxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3JhbmRvbS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaGFkZXJGcm9tQ29kZSB9IGZyb20gJy4uL3NoYWRlci1saWIvdXRpbHMuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2ltcGxlLXBvc3QtZWZmZWN0LmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuLi9zaGFkZXItbGliL2NodW5rLXV0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IGdldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBEZXZpY2VDYWNoZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RldmljZS1jYWNoZS5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcycpLlZlYzR9IFZlYzQgKi9cblxuY29uc3QgZ2V0UHJvamVjdGlvbk5hbWUgPSAocHJvamVjdGlvbikgPT4ge1xuICAgIHN3aXRjaCAocHJvamVjdGlvbikge1xuICAgICAgICBjYXNlIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkU6XG4gICAgICAgICAgICByZXR1cm4gXCJDdWJlbWFwXCI7XG4gICAgICAgIGNhc2UgVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTDpcbiAgICAgICAgICAgIHJldHVybiBcIk9jdGFoZWRyYWxcIjtcbiAgICAgICAgZGVmYXVsdDogLy8gZm9yIGFueXRoaW5nIGVsc2UsIGFzc3VtZSBlcXVpcmVjdFxuICAgICAgICAgICAgcmV0dXJuIFwiRXF1aXJlY3RcIjtcbiAgICB9XG59O1xuXG4vLyBwYWNrIGEgMzJiaXQgZmxvYXRpbmcgcG9pbnQgdmFsdWUgaW50byBSR0JBOFxuY29uc3QgcGFja0Zsb2F0MzJUb1JHQkE4ID0gKHZhbHVlLCBhcnJheSwgb2Zmc2V0KSA9PiB7XG4gICAgaWYgKHZhbHVlIDw9IDApIHtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMF0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAxXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDJdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgM10gPSAwO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgPj0gMS4wKSB7XG4gICAgICAgIGFycmF5W29mZnNldCArIDBdID0gMjU1O1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAxXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDJdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgM10gPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBlbmNYID0gKDEgKiB2YWx1ZSkgJSAxO1xuICAgICAgICBsZXQgZW5jWSA9ICgyNTUgKiB2YWx1ZSkgJSAxO1xuICAgICAgICBsZXQgZW5jWiA9ICg2NTAyNSAqIHZhbHVlKSAlIDE7XG4gICAgICAgIGNvbnN0IGVuY1cgPSAoMTY1ODEzNzUuMCAqIHZhbHVlKSAlIDE7XG5cbiAgICAgICAgZW5jWCAtPSBlbmNZIC8gMjU1O1xuICAgICAgICBlbmNZIC09IGVuY1ogLyAyNTU7XG4gICAgICAgIGVuY1ogLT0gZW5jVyAvIDI1NTtcblxuICAgICAgICBhcnJheVtvZmZzZXQgKyAwXSA9IE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcihlbmNYICogMjU2KSk7XG4gICAgICAgIGFycmF5W29mZnNldCArIDFdID0gTWF0aC5taW4oMjU1LCBNYXRoLmZsb29yKGVuY1kgKiAyNTYpKTtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMl0gPSBNYXRoLm1pbigyNTUsIE1hdGguZmxvb3IoZW5jWiAqIDI1NikpO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAzXSA9IE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcihlbmNXICogMjU2KSk7XG4gICAgfVxufTtcblxuLy8gcGFjayBzYW1wbGVzIGludG8gdGV4dHVyZS1yZWFkeSBmb3JtYXRcbmNvbnN0IHBhY2tTYW1wbGVzID0gKHNhbXBsZXMpID0+IHtcbiAgICBjb25zdCBudW1TYW1wbGVzID0gc2FtcGxlcy5sZW5ndGg7XG5cbiAgICBjb25zdCB3ID0gTWF0aC5taW4obnVtU2FtcGxlcywgNTEyKTtcbiAgICBjb25zdCBoID0gTWF0aC5jZWlsKG51bVNhbXBsZXMgLyB3KTtcbiAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQ4QXJyYXkodyAqIGggKiA0KTtcblxuICAgIC8vIG5vcm1hbGl6ZSBmbG9hdCBkYXRhIGFuZCBwYWNrIGludG8gcmdiYThcbiAgICBsZXQgb2ZmID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICBwYWNrRmxvYXQzMlRvUkdCQTgoc2FtcGxlc1tpICogNCArIDBdICogMC41ICsgMC41LCBkYXRhLCBvZmYgKyAwKTtcbiAgICAgICAgcGFja0Zsb2F0MzJUb1JHQkE4KHNhbXBsZXNbaSAqIDQgKyAxXSAqIDAuNSArIDAuNSwgZGF0YSwgb2ZmICsgNCk7XG4gICAgICAgIHBhY2tGbG9hdDMyVG9SR0JBOChzYW1wbGVzW2kgKiA0ICsgMl0gKiAwLjUgKyAwLjUsIGRhdGEsIG9mZiArIDgpO1xuICAgICAgICBwYWNrRmxvYXQzMlRvUkdCQTgoc2FtcGxlc1tpICogNCArIDNdIC8gOCwgZGF0YSwgb2ZmICsgMTIpO1xuICAgICAgICBvZmYgKz0gMTY7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgd2lkdGg6IHcsXG4gICAgICAgIGhlaWdodDogaCxcbiAgICAgICAgZGF0YTogZGF0YVxuICAgIH07XG59O1xuXG4vLyBnZW5lcmF0ZSBhIHZlY3RvciBvbiB0aGUgaGVtaXNwaGVyZSB3aXRoIGNvbnN0YW50IGRpc3RyaWJ1dGlvbi5cbi8vIGZ1bmN0aW9uIGtlcHQgYmVjYXVzZSBpdCdzIHVzZWZ1bCBmb3IgZGVidWdnaW5nXG4vLyB2ZWMzIGhlbWlzcGhlcmVTYW1wbGVVbmlmb3JtKHZlYzIgdXYpIHtcbi8vICAgICBmbG9hdCBwaGkgPSB1di55ICogMi4wICogUEk7XG4vLyAgICAgZmxvYXQgY29zVGhldGEgPSAxLjAgLSB1di54O1xuLy8gICAgIGZsb2F0IHNpblRoZXRhID0gc3FydCgxLjAgLSBjb3NUaGV0YSAqIGNvc1RoZXRhKTtcbi8vICAgICByZXR1cm4gdmVjMyhjb3MocGhpKSAqIHNpblRoZXRhLCBzaW4ocGhpKSAqIHNpblRoZXRhLCBjb3NUaGV0YSk7XG4vLyB9XG5cbi8vIGdlbmVyYXRlIGEgdmVjdG9yIG9uIHRoZSBoZW1pc3BoZXJlIHdpdGggcGhvbmcgcmVmbGVjdGlvbiBkaXN0cmlidXRpb25cbmNvbnN0IGhlbWlzcGhlcmVTYW1wbGVQaG9uZyA9IChkc3RWZWMsIHgsIHksIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICBjb25zdCBwaGkgPSB5ICogMiAqIE1hdGguUEk7XG4gICAgY29uc3QgY29zVGhldGEgPSBNYXRoLnBvdygxIC0geCwgMSAvIChzcGVjdWxhclBvd2VyICsgMSkpO1xuICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zcXJ0KDEgLSBjb3NUaGV0YSAqIGNvc1RoZXRhKTtcbiAgICBkc3RWZWMuc2V0KE1hdGguY29zKHBoaSkgKiBzaW5UaGV0YSwgTWF0aC5zaW4ocGhpKSAqIHNpblRoZXRhLCBjb3NUaGV0YSkubm9ybWFsaXplKCk7XG59O1xuXG4vLyBnZW5lcmF0ZSBhIHZlY3RvciBvbiB0aGUgaGVtaXNwaGVyZSB3aXRoIGxhbWJlcnQgZGlzdHJpYnV0aW9uXG5jb25zdCBoZW1pc3BoZXJlU2FtcGxlTGFtYmVydCA9IChkc3RWZWMsIHgsIHkpID0+IHtcbiAgICBjb25zdCBwaGkgPSB5ICogMiAqIE1hdGguUEk7XG4gICAgY29uc3QgY29zVGhldGEgPSBNYXRoLnNxcnQoMSAtIHgpO1xuICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zcXJ0KHgpO1xuICAgIGRzdFZlYy5zZXQoTWF0aC5jb3MocGhpKSAqIHNpblRoZXRhLCBNYXRoLnNpbihwaGkpICogc2luVGhldGEsIGNvc1RoZXRhKS5ub3JtYWxpemUoKTtcbn07XG5cbi8vIGdlbmVyYXRlIGEgdmVjdG9yIG9uIHRoZSBoZW1pc3BoZXJlIHdpdGggR0dYIGRpc3RyaWJ1dGlvbi5cbi8vIGEgaXMgbGluZWFyIHJvdWdobmVzc14yXG5jb25zdCBoZW1pc3BoZXJlU2FtcGxlR0dYID0gKGRzdFZlYywgeCwgeSwgYSkgPT4ge1xuICAgIGNvbnN0IHBoaSA9IHkgKiAyICogTWF0aC5QSTtcbiAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguc3FydCgoMSAtIHgpIC8gKDEgKyAoYSAqIGEgLSAxKSAqIHgpKTtcbiAgICBjb25zdCBzaW5UaGV0YSA9IE1hdGguc3FydCgxIC0gY29zVGhldGEgKiBjb3NUaGV0YSk7XG4gICAgZHN0VmVjLnNldChNYXRoLmNvcyhwaGkpICogc2luVGhldGEsIE1hdGguc2luKHBoaSkgKiBzaW5UaGV0YSwgY29zVGhldGEpLm5vcm1hbGl6ZSgpO1xufTtcblxuY29uc3QgRF9HR1ggPSAoTm9ILCBsaW5lYXJSb3VnaG5lc3MpID0+IHtcbiAgICBjb25zdCBhID0gTm9IICogbGluZWFyUm91Z2huZXNzO1xuICAgIGNvbnN0IGsgPSBsaW5lYXJSb3VnaG5lc3MgLyAoMS4wIC0gTm9IICogTm9IICsgYSAqIGEpO1xuICAgIHJldHVybiBrICogayAqICgxIC8gTWF0aC5QSSk7XG59O1xuXG4vLyBnZW5lcmF0ZSBwcmVjb21wdXRlZCBzYW1wbGVzIGZvciBwaG9uZyByZWZsZWN0aW9ucyBvZiB0aGUgZ2l2ZW4gcG93ZXJcbmNvbnN0IGdlbmVyYXRlUGhvbmdTYW1wbGVzID0gKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICBjb25zdCBIID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgKytpKSB7XG4gICAgICAgIGhlbWlzcGhlcmVTYW1wbGVQaG9uZyhILCBpIC8gbnVtU2FtcGxlcywgcmFuZG9tLnJhZGljYWxJbnZlcnNlKGkpLCBzcGVjdWxhclBvd2VyKTtcbiAgICAgICAgcmVzdWx0LnB1c2goSC54LCBILnksIEgueiwgMCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdlbmVyYXRlIHByZWNvbXB1dGVkIHNhbXBsZXMgZm9yIGxhbWJlcnQgY29udm9sdXRpb25cbmNvbnN0IGdlbmVyYXRlTGFtYmVydFNhbXBsZXMgPSAobnVtU2FtcGxlcywgc291cmNlVG90YWxQaXhlbHMpID0+IHtcbiAgICBjb25zdCBwaXhlbHNQZXJTYW1wbGUgPSBzb3VyY2VUb3RhbFBpeGVscyAvIG51bVNhbXBsZXM7XG5cbiAgICBjb25zdCBIID0gbmV3IFZlYzMoKTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgKytpKSB7XG4gICAgICAgIGhlbWlzcGhlcmVTYW1wbGVMYW1iZXJ0KEgsIGkgLyBudW1TYW1wbGVzLCByYW5kb20ucmFkaWNhbEludmVyc2UoaSkpO1xuICAgICAgICBjb25zdCBwZGYgPSBILnogLyBNYXRoLlBJO1xuICAgICAgICBjb25zdCBtaXBMZXZlbCA9IDAuNSAqIE1hdGgubG9nMihwaXhlbHNQZXJTYW1wbGUgLyBwZGYpO1xuICAgICAgICByZXN1bHQucHVzaChILngsIEgueSwgSC56LCBtaXBMZXZlbCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdlbmVyYXRlIGEgdGFibGUgc3RvcmluZyB0aGUgbnVtYmVyIG9mIHNhbXBsZXMgcmVxdWlyZWQgdG8gZ2V0ICdudW1TYW1wbGVzJ1xuLy8gdmFsaWQgc2FtcGxlcyBmb3IgdGhlIGdpdmVuIHNwZWN1bGFyUG93ZXIuXG4vKiBlc2xpbnQtZGlzYWJsZSBuby11bnVzZWQtdmFycyAqL1xuY29uc3QgY2FsY3VsYXRlUmVxdWlyZWRTYW1wbGVzR0dYID0gKCkgPT4ge1xuICAgIGNvbnN0IGNvdW50VmFsaWRTYW1wbGVzR0dYID0gKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICAgICAgY29uc3Qgcm91Z2huZXNzID0gMSAtIE1hdGgubG9nMihzcGVjdWxhclBvd2VyKSAvIDExLjA7XG4gICAgICAgIGNvbnN0IGEgPSByb3VnaG5lc3MgKiByb3VnaG5lc3M7XG4gICAgICAgIGNvbnN0IEggPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBMID0gbmV3IFZlYzMoKTtcbiAgICAgICAgY29uc3QgTiA9IG5ldyBWZWMzKDAsIDAsIDEpO1xuXG4gICAgICAgIGxldCB2YWxpZFNhbXBsZXMgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVNhbXBsZXM7ICsraSkge1xuICAgICAgICAgICAgaGVtaXNwaGVyZVNhbXBsZUdHWChILCBpIC8gbnVtU2FtcGxlcywgcmFuZG9tLnJhZGljYWxJbnZlcnNlKGkpLCBhKTtcblxuICAgICAgICAgICAgY29uc3QgTm9IID0gSC56OyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNpbmNlIE4gaXMgKDAsIDAsIDEpXG4gICAgICAgICAgICBMLnNldChILngsIEgueSwgSC56KS5tdWxTY2FsYXIoMiAqIE5vSCkuc3ViKE4pO1xuXG4gICAgICAgICAgICB2YWxpZFNhbXBsZXMgKz0gTC56ID4gMCA/IDEgOiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbGlkU2FtcGxlcztcbiAgICB9O1xuXG4gICAgY29uc3QgbnVtU2FtcGxlcyA9IFsxMDI0LCAxMjgsIDMyLCAxNl07XG4gICAgY29uc3Qgc3BlY3VsYXJQb3dlcnMgPSBbNTEyLCAxMjgsIDMyLCA4LCAyXTtcblxuICAgIGNvbnN0IHJlcXVpcmVkVGFibGUgPSB7fTtcbiAgICBudW1TYW1wbGVzLmZvckVhY2goKG51bVNhbXBsZXMpID0+IHtcbiAgICAgICAgY29uc3QgdGFibGUgPSB7IH07XG4gICAgICAgIHNwZWN1bGFyUG93ZXJzLmZvckVhY2goKHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICAgICAgICAgIGxldCByZXF1aXJlZFNhbXBsZXMgPSBudW1TYW1wbGVzO1xuICAgICAgICAgICAgd2hpbGUgKGNvdW50VmFsaWRTYW1wbGVzR0dYKHJlcXVpcmVkU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPCBudW1TYW1wbGVzKSB7XG4gICAgICAgICAgICAgICAgcmVxdWlyZWRTYW1wbGVzKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0YWJsZVtzcGVjdWxhclBvd2VyXSA9IHJlcXVpcmVkU2FtcGxlcztcbiAgICAgICAgfSk7XG4gICAgICAgIHJlcXVpcmVkVGFibGVbbnVtU2FtcGxlc10gPSB0YWJsZTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXF1aXJlZFRhYmxlO1xufTtcblxuLy8gcHJpbnQgdG8gdGhlIGNvbnNvbGUgdGhlIHJlcXVpcmVkIHNhbXBsZXMgdGFibGUgZm9yIEdHWCByZWZsZWN0aW9uIGNvbnZvbHV0aW9uXG4vLyBjb25zb2xlLmxvZyhjYWxjdWxhdGVSZXF1aXJlZFNhbXBsZXNHR1goKSk7XG5cbi8vIHRoaXMgaXMgYSB0YWJsZSB3aXRoIHByZS1jYWxjdWxhdGVkIG51bWJlciBvZiBzYW1wbGVzIHJlcXVpcmVkIGZvciBHR1guXG4vLyB0aGUgdGFibGUgaXMgZ2VuZXJhdGVkIGJ5IGNhbGN1bGF0ZVJlcXVpcmVkU2FtcGxlc0dHWCgpXG4vLyB0aGUgdGFibGUgaXMgb3JnYW5pemVkIGJ5IFtudW1TYW1wbGVzXVtzcGVjdWxhclBvd2VyXVxuLy9cbi8vIHdlIHVzZSBhIHJlcGVhdGFibGUgcHNldWRvLXJhbmRvbSBzZXF1ZW5jZSBvZiBudW1iZXJzIHdoZW4gZ2VuZXJhdGluZyBzYW1wbGVzXG4vLyBmb3IgdXNlIGluIHByZWZpbHRlcmluZyBHR1ggcmVmbGVjdGlvbnMuIGhvd2V2ZXIgbm90IGFsbCB0aGUgcmFuZG9tIHNhbXBsZXNcbi8vIHdpbGwgYmUgdmFsaWQuIHRoaXMgaXMgYmVjYXVzZSBzb21lIHJlc3VsdGluZyByZWZsZWN0aW9uIHZlY3RvcnMgd2lsbCBiZSBiZWxvd1xuLy8gdGhlIGhlbWlzcGhlcmUuIHRoaXMgaXMgZXNwZWNpYWxseSBhcHBhcmVudCB3aGVuIGNhbGN1bGF0aW5nIHZlY3RvcnMgZm9yIHRoZVxuLy8gaGlnaGVyIHJvdWdobmVzc2VzLiAoc2luY2UgdmVjdG9ycyBhcmUgbW9yZSB3aWxkLCBtb3JlIG9mIHRoZW0gYXJlIGludmFsaWQpLlxuLy8gZm9yIGV4YW1wbGUsIHNwZWN1bGFyUG93ZXIgMiByZXN1bHRzIGluIGhhbGYgdGhlIGdlbmVyYXRlZCB2ZWN0b3JzIGJlaW5nXG4vLyBpbnZhbGlkLiAobWVhbmluZyB0aGUgR1BVIHdvdWxkIHNwZW5kIGhhbGYgdGhlIHRpbWUgb24gdmVjdG9ycyB0aGF0IGRvbid0XG4vLyBjb250cmlidXRlIHRvIHRoZSBmaW5hbCByZXN1bHQpLlxuLy9cbi8vIGNhbGN1bGF0aW5nIGhvdyBtYW55IHNhbXBsZXMgYXJlIHJlcXVpcmVkIHRvIGdlbmVyYXRlICduJyB2YWxpZCBzYW1wbGVzIGlzIGFcbi8vIHNsb3cgb3BlcmF0aW9uLCBzbyB0aGlzIHRhYmxlIHN0b3JlcyB0aGUgcHJlLWNhbGN1bGF0ZWQgbnVtYmVycyBvZiBzYW1wbGVzXG4vLyByZXF1aXJlZCBmb3IgdGhlIHNldHMgb2YgKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXJzKSBwYWlycyB3ZSBleHBlY3QgdG9cbi8vIGVuY291bnRlciBhdCBydW50aW1lLlxuY29uc3QgcmVxdWlyZWRTYW1wbGVzR0dYID0ge1xuICAgIFwiMTZcIjoge1xuICAgICAgICBcIjJcIjogMjYsXG4gICAgICAgIFwiOFwiOiAyMCxcbiAgICAgICAgXCIzMlwiOiAxNyxcbiAgICAgICAgXCIxMjhcIjogMTYsXG4gICAgICAgIFwiNTEyXCI6IDE2XG4gICAgfSxcbiAgICBcIjMyXCI6IHtcbiAgICAgICAgXCIyXCI6IDUzLFxuICAgICAgICBcIjhcIjogNDAsXG4gICAgICAgIFwiMzJcIjogMzQsXG4gICAgICAgIFwiMTI4XCI6IDMyLFxuICAgICAgICBcIjUxMlwiOiAzMlxuICAgIH0sXG4gICAgXCIxMjhcIjoge1xuICAgICAgICBcIjJcIjogMjE0LFxuICAgICAgICBcIjhcIjogMTYzLFxuICAgICAgICBcIjMyXCI6IDEzOSxcbiAgICAgICAgXCIxMjhcIjogMTMwLFxuICAgICAgICBcIjUxMlwiOiAxMjhcbiAgICB9LFxuICAgIFwiMTAyNFwiOiB7XG4gICAgICAgIFwiMlwiOiAxNzIyLFxuICAgICAgICBcIjhcIjogMTMxMCxcbiAgICAgICAgXCIzMlwiOiAxMTE0LFxuICAgICAgICBcIjEyOFwiOiAxMDQxLFxuICAgICAgICBcIjUxMlwiOiAxMDI1XG4gICAgfVxufTtcblxuLy8gZ2V0IHRoZSBudW1iZXIgb2YgcmFuZG9tIHNhbXBsZXMgcmVxdWlyZWQgdG8gZ2VuZXJhdGUgbnVtU2FtcGxlcyB2YWxpZCBzYW1wbGVzLlxuY29uc3QgZ2V0UmVxdWlyZWRTYW1wbGVzR0dYID0gKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICBjb25zdCB0YWJsZSA9IHJlcXVpcmVkU2FtcGxlc0dHWFtudW1TYW1wbGVzXTtcbiAgICByZXR1cm4gKHRhYmxlICYmIHRhYmxlW3NwZWN1bGFyUG93ZXJdKSB8fCBudW1TYW1wbGVzO1xufTtcblxuLy8gZ2VuZXJhdGUgcHJlY29tcHV0ZWQgR0dYIHNhbXBsZXNcbmNvbnN0IGdlbmVyYXRlR0dYU2FtcGxlcyA9IChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyLCBzb3VyY2VUb3RhbFBpeGVscykgPT4ge1xuICAgIGNvbnN0IHBpeGVsc1BlclNhbXBsZSA9IHNvdXJjZVRvdGFsUGl4ZWxzIC8gbnVtU2FtcGxlcztcbiAgICBjb25zdCByb3VnaG5lc3MgPSAxIC0gTWF0aC5sb2cyKHNwZWN1bGFyUG93ZXIpIC8gMTEuMDtcbiAgICBjb25zdCBhID0gcm91Z2huZXNzICogcm91Z2huZXNzO1xuICAgIGNvbnN0IEggPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IEwgPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IE4gPSBuZXcgVmVjMygwLCAwLCAxKTtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGNvbnN0IHJlcXVpcmVkU2FtcGxlcyA9IGdldFJlcXVpcmVkU2FtcGxlc0dHWChudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVxdWlyZWRTYW1wbGVzOyArK2kpIHtcbiAgICAgICAgaGVtaXNwaGVyZVNhbXBsZUdHWChILCBpIC8gcmVxdWlyZWRTYW1wbGVzLCByYW5kb20ucmFkaWNhbEludmVyc2UoaSksIGEpO1xuXG4gICAgICAgIGNvbnN0IE5vSCA9IEguejsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzaW5jZSBOIGlzICgwLCAwLCAxKVxuICAgICAgICBMLnNldChILngsIEgueSwgSC56KS5tdWxTY2FsYXIoMiAqIE5vSCkuc3ViKE4pO1xuXG4gICAgICAgIGlmIChMLnogPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBwZGYgPSBEX0dHWChNYXRoLm1pbigxLCBOb0gpLCBhKSAvIDQgKyAwLjAwMTtcbiAgICAgICAgICAgIGNvbnN0IG1pcExldmVsID0gMC41ICogTWF0aC5sb2cyKHBpeGVsc1BlclNhbXBsZSAvIHBkZik7XG4gICAgICAgICAgICByZXN1bHQucHVzaChMLngsIEwueSwgTC56LCBtaXBMZXZlbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB3aGlsZSAocmVzdWx0Lmxlbmd0aCA8IG51bVNhbXBsZXMgKiA0KSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKDAsIDAsIDAsIDApO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBwYWNrIGZsb2F0IHNhbXBsZXMgZGF0YSBpbnRvIGFuIHJnYmE4IHRleHR1cmVcbmNvbnN0IGNyZWF0ZVNhbXBsZXNUZXggPSAoZGV2aWNlLCBuYW1lLCBzYW1wbGVzKSA9PiB7XG4gICAgY29uc3QgcGFja2VkU2FtcGxlcyA9IHBhY2tTYW1wbGVzKHNhbXBsZXMpO1xuICAgIHJldHVybiBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgd2lkdGg6IHBhY2tlZFNhbXBsZXMud2lkdGgsXG4gICAgICAgIGhlaWdodDogcGFja2VkU2FtcGxlcy5oZWlnaHQsXG4gICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICBsZXZlbHM6IFtwYWNrZWRTYW1wbGVzLmRhdGFdXG4gICAgfSk7XG59O1xuXG4vLyBzaW1wbGUgY2FjaGUgc3RvcmluZyBrZXktPnZhbHVlXG4vLyBtaXNzRnVuYyBpcyBjYWxsZWQgaWYgdGhlIGtleSBpcyBub3QgcHJlc2VudFxuY2xhc3MgU2ltcGxlQ2FjaGUge1xuICAgIGNvbnN0cnVjdG9yKGRlc3Ryb3lDb250ZW50ID0gdHJ1ZSkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lDb250ZW50ID0gZGVzdHJveUNvbnRlbnQ7XG4gICAgfVxuXG4gICAgbWFwID0gbmV3IE1hcCgpO1xuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVzdHJveUNvbnRlbnQpIHtcbiAgICAgICAgICAgIHRoaXMubWFwLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICB2YWx1ZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldChrZXksIG1pc3NGdW5jKSB7XG4gICAgICAgIGlmICghdGhpcy5tYXAuaGFzKGtleSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IG1pc3NGdW5jKCk7XG4gICAgICAgICAgICB0aGlzLm1hcC5zZXQoa2V5LCByZXN1bHQpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KGtleSk7XG4gICAgfVxufVxuXG4vLyBjYWNoZSwgdXNlZCB0byBzdG9yZSBzYW1wbGVzLiB3ZSBzdG9yZSB0aGVzZSBzZXBhcmF0ZWx5IGZyb20gdGV4dHVyZXMgc2luY2UgbXVsdGlwbGVcbi8vIGRldmljZXMgY2FuIHVzZSB0aGUgc2FtZSBzZXQgb2Ygc2FtcGxlcy5cbmNvbnN0IHNhbXBsZXNDYWNoZSA9IG5ldyBTaW1wbGVDYWNoZShmYWxzZSk7XG5cbi8vIGNhY2hlLCBzdG9yaW5nIHNhbXBsZXMgc3RvcmVkIGluIHRleHR1cmVzLCB0aG9zZSBhcmUgcGVyIGRldmljZVxuY29uc3QgZGV2aWNlQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuY29uc3QgZ2V0Q2FjaGVkVGV4dHVyZSA9IChkZXZpY2UsIGtleSwgZ2V0U2FtcGxlc0ZuYykgPT4ge1xuICAgIGNvbnN0IGNhY2hlID0gZGV2aWNlQ2FjaGUuZ2V0KGRldmljZSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFNpbXBsZUNhY2hlKCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY2FjaGUuZ2V0KGtleSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gY3JlYXRlU2FtcGxlc1RleChkZXZpY2UsIGtleSwgc2FtcGxlc0NhY2hlLmdldChrZXksIGdldFNhbXBsZXNGbmMpKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlTGFtYmVydFNhbXBsZXNUZXggPSAoZGV2aWNlLCBudW1TYW1wbGVzLCBzb3VyY2VUb3RhbFBpeGVscykgPT4ge1xuICAgIGNvbnN0IGtleSA9IGBsYW1iZXJ0LXNhbXBsZXMtJHtudW1TYW1wbGVzfS0ke3NvdXJjZVRvdGFsUGl4ZWxzfWA7XG4gICAgcmV0dXJuIGdldENhY2hlZFRleHR1cmUoZGV2aWNlLCBrZXksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlTGFtYmVydFNhbXBsZXMobnVtU2FtcGxlcywgc291cmNlVG90YWxQaXhlbHMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgZ2VuZXJhdGVQaG9uZ1NhbXBsZXNUZXggPSAoZGV2aWNlLCBudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA9PiB7XG4gICAgY29uc3Qga2V5ID0gYHBob25nLXNhbXBsZXMtJHtudW1TYW1wbGVzfS0ke3NwZWN1bGFyUG93ZXJ9YDtcbiAgICByZXR1cm4gZ2V0Q2FjaGVkVGV4dHVyZShkZXZpY2UsIGtleSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGVQaG9uZ1NhbXBsZXMobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcik7XG4gICAgfSk7XG59O1xuXG5jb25zdCBnZW5lcmF0ZUdHWFNhbXBsZXNUZXggPSAoZGV2aWNlLCBudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyLCBzb3VyY2VUb3RhbFBpeGVscykgPT4ge1xuICAgIGNvbnN0IGtleSA9IGBnZ3gtc2FtcGxlcy0ke251bVNhbXBsZXN9LSR7c3BlY3VsYXJQb3dlcn0tJHtzb3VyY2VUb3RhbFBpeGVsc31gO1xuICAgIHJldHVybiBnZXRDYWNoZWRUZXh0dXJlKGRldmljZSwga2V5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZUdHWFNhbXBsZXMobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlciwgc291cmNlVG90YWxQaXhlbHMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgdnNDb2RlID0gYFxuYXR0cmlidXRlIHZlYzIgdmVydGV4X3Bvc2l0aW9uO1xuXG51bmlmb3JtIHZlYzQgdXZNb2Q7XG5cbnZhcnlpbmcgdmVjMiB2VXYwO1xuXG52b2lkIG1haW4odm9pZCkge1xuICAgIGdsX1Bvc2l0aW9uID0gdmVjNCh2ZXJ0ZXhfcG9zaXRpb24sIDAuNSwgMS4wKTtcbiAgICB2VXYwID0gKHZlcnRleF9wb3NpdGlvbi54eSAqIDAuNSArIDAuNSkgKiB1dk1vZC54eSArIHV2TW9kLnp3O1xufVxuYDtcblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHJlcHJvamVjdHMgdGV4dHVyZXMgYmV0d2VlbiBjdWJlbWFwLCBlcXVpcmVjdGFuZ3VsYXIgYW5kIG9jdGFoZWRyYWwgZm9ybWF0cy4gVGhlXG4gKiBmdW5jdGlvbiBjYW4gcmVhZCBhbmQgd3JpdGUgdGV4dHVyZXMgd2l0aCBwaXhlbCBkYXRhIGluIFJHQkUsIFJHQk0sIGxpbmVhciBhbmQgc1JHQiBmb3JtYXRzLlxuICogV2hlbiBzcGVjdWxhclBvd2VyIGlzIHNwZWNpZmllZCBpdCB3aWxsIHBlcmZvcm0gYSBwaG9uZy13ZWlnaHRlZCBjb252b2x1dGlvbiBvZiB0aGUgc291cmNlIChmb3JcbiAqIGdlbmVyYXRpbmcgYSBnbG9zcyBtYXBzKS5cbiAqXG4gKiBAcGFyYW0ge1RleHR1cmV9IHNvdXJjZSAtIFRoZSBzb3VyY2UgdGV4dHVyZS5cbiAqIEBwYXJhbSB7VGV4dHVyZX0gdGFyZ2V0IC0gVGhlIHRhcmdldCB0ZXh0dXJlLlxuICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIFRoZSBvcHRpb25zIG9iamVjdC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zcGVjdWxhclBvd2VyXSAtIE9wdGlvbmFsIHNwZWN1bGFyIHBvd2VyLiBXaGVuIHNwZWN1bGFyIHBvd2VyIGlzXG4gKiBzcGVjaWZpZWQsIHRoZSBzb3VyY2UgaXMgY29udm9sdmVkIGJ5IGEgcGhvbmctd2VpZ2h0ZWQga2VybmVsIHJhaXNlZCB0byB0aGUgc3BlY2lmaWVkIHBvd2VyLlxuICogT3RoZXJ3aXNlIHRoZSBmdW5jdGlvbiBwZXJmb3JtcyBhIHN0YW5kYXJkIHJlc2FtcGxlLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm51bVNhbXBsZXNdIC0gT3B0aW9uYWwgbnVtYmVyIG9mIHNhbXBsZXMgKGRlZmF1bHQgaXMgMTAyNCkuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmFjZV0gLSBPcHRpb25hbCBjdWJlbWFwIGZhY2UgdG8gdXBkYXRlIChkZWZhdWx0IGlzIHVwZGF0ZSBhbGwgZmFjZXMpLlxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRpc3RyaWJ1dGlvbl0gLSBTcGVjaWZ5IGNvbnZvbHV0aW9uIGRpc3RyaWJ1dGlvbiAtICdub25lJywgJ2xhbWJlcnQnLFxuICogJ3Bob25nJywgJ2dneCcuIERlZmF1bHQgZGVwZW5kcyBvbiBzcGVjdWxhclBvd2VyLlxuICogQHBhcmFtIHtWZWM0fSBbb3B0aW9ucy5yZWN0XSAtIE9wdGlvbmFsIHZpZXdwb3J0IHJlY3RhbmdsZS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zZWFtUGl4ZWxzXSAtIE9wdGlvbmFsIG51bWJlciBvZiBzZWFtIHBpeGVscyB0byByZW5kZXJcbiAqL1xuZnVuY3Rpb24gcmVwcm9qZWN0VGV4dHVyZShzb3VyY2UsIHRhcmdldCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gbWFpbnRhaW4gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBwcmV2aW91cyBmdW5jdGlvbiBzaWduYXR1cmVcbiAgICAvLyByZXByb2plY3RUZXh0dXJlKGRldmljZSwgc291cmNlLCB0YXJnZXQsIHNwZWN1bGFyUG93ZXIgPSAxLCBudW1TYW1wbGVzID0gMTAyNClcbiAgICBpZiAoc291cmNlIGluc3RhbmNlb2YgR3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgc291cmNlID0gYXJndW1lbnRzWzFdO1xuICAgICAgICB0YXJnZXQgPSBhcmd1bWVudHNbMl07XG4gICAgICAgIG9wdGlvbnMgPSB7IH07XG4gICAgICAgIGlmIChhcmd1bWVudHNbM10gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5zcGVjdWxhclBvd2VyID0gYXJndW1lbnRzWzNdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhcmd1bWVudHNbNF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5udW1TYW1wbGVzID0gYXJndW1lbnRzWzRdO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGxlYXNlIHVzZSB0aGUgdXBkYXRlZCBwYy5yZXByb2plY3RUZXh0dXJlIEFQSS4nKTtcbiAgICB9XG5cbiAgICAvLyB0YWJsZSBvZiBkaXN0cmlidXRpb24gLT4gZnVuY3Rpb24gbmFtZVxuICAgIGNvbnN0IGZ1bmNOYW1lcyA9IHtcbiAgICAgICAgJ25vbmUnOiAncmVwcm9qZWN0JyxcbiAgICAgICAgJ2xhbWJlcnQnOiAncHJlZmlsdGVyU2FtcGxlc1Vud2VpZ2h0ZWQnLFxuICAgICAgICAncGhvbmcnOiAncHJlZmlsdGVyU2FtcGxlc1Vud2VpZ2h0ZWQnLFxuICAgICAgICAnZ2d4JzogJ3ByZWZpbHRlclNhbXBsZXMnXG4gICAgfTtcblxuICAgIC8vIGV4dHJhY3Qgb3B0aW9uc1xuICAgIGNvbnN0IHNwZWN1bGFyUG93ZXIgPSBvcHRpb25zLmhhc093blByb3BlcnR5KCdzcGVjdWxhclBvd2VyJykgPyBvcHRpb25zLnNwZWN1bGFyUG93ZXIgOiAxO1xuICAgIGNvbnN0IGZhY2UgPSBvcHRpb25zLmhhc093blByb3BlcnR5KCdmYWNlJykgPyBvcHRpb25zLmZhY2UgOiBudWxsO1xuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2Rpc3RyaWJ1dGlvbicpID8gb3B0aW9ucy5kaXN0cmlidXRpb24gOiAoc3BlY3VsYXJQb3dlciA9PT0gMSkgPyAnbm9uZScgOiAncGhvbmcnO1xuXG4gICAgY29uc3QgcHJvY2Vzc0Z1bmMgPSBmdW5jTmFtZXNbZGlzdHJpYnV0aW9uXSB8fCAncmVwcm9qZWN0JztcbiAgICBjb25zdCBkZWNvZGVGdW5jID0gQ2h1bmtVdGlscy5kZWNvZGVGdW5jKHNvdXJjZS5lbmNvZGluZyk7XG4gICAgY29uc3QgZW5jb2RlRnVuYyA9IENodW5rVXRpbHMuZW5jb2RlRnVuYyh0YXJnZXQuZW5jb2RpbmcpO1xuICAgIGNvbnN0IHNvdXJjZUZ1bmMgPSBgc2FtcGxlJHtnZXRQcm9qZWN0aW9uTmFtZShzb3VyY2UucHJvamVjdGlvbil9YDtcbiAgICBjb25zdCB0YXJnZXRGdW5jID0gYGdldERpcmVjdGlvbiR7Z2V0UHJvamVjdGlvbk5hbWUodGFyZ2V0LnByb2plY3Rpb24pfWA7XG4gICAgY29uc3QgbnVtU2FtcGxlcyA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ251bVNhbXBsZXMnKSA/IG9wdGlvbnMubnVtU2FtcGxlcyA6IDEwMjQ7XG5cbiAgICAvLyBnZW5lcmF0ZSB1bmlxdWUgc2hhZGVyIGtleVxuICAgIGNvbnN0IHNoYWRlcktleSA9IGAke3Byb2Nlc3NGdW5jfV8ke2RlY29kZUZ1bmN9XyR7ZW5jb2RlRnVuY31fJHtzb3VyY2VGdW5jfV8ke3RhcmdldEZ1bmN9XyR7bnVtU2FtcGxlc31gO1xuXG4gICAgY29uc3QgZGV2aWNlID0gc291cmNlLmRldmljZTtcblxuICAgIGxldCBzaGFkZXIgPSBnZXRQcm9ncmFtTGlicmFyeShkZXZpY2UpLmdldENhY2hlZFNoYWRlcihzaGFkZXJLZXkpO1xuICAgIGlmICghc2hhZGVyKSB7XG4gICAgICAgIGNvbnN0IGRlZmluZXMgPVxuICAgICAgICAgICAgYCNkZWZpbmUgUFJPQ0VTU19GVU5DICR7cHJvY2Vzc0Z1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBERUNPREVfRlVOQyAke2RlY29kZUZ1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBFTkNPREVfRlVOQyAke2VuY29kZUZ1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBTT1VSQ0VfRlVOQyAke3NvdXJjZUZ1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBUQVJHRVRfRlVOQyAke3RhcmdldEZ1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBOVU1fU0FNUExFUyAke251bVNhbXBsZXN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBOVU1fU0FNUExFU19TUVJUICR7TWF0aC5yb3VuZChNYXRoLnNxcnQobnVtU2FtcGxlcykpLnRvRml4ZWQoMSl9XFxuYCArXG4gICAgICAgICAgICAoZGV2aWNlLmV4dFRleHR1cmVMb2QgPyBgI2RlZmluZSBTVVBQT1JUU19URVhMT0RcXG5gIDogJycpO1xuXG4gICAgICAgIGxldCBleHRlbnNpb25zID0gJyc7XG4gICAgICAgIGlmICghZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgZXh0ZW5zaW9ucyA9ICcjZXh0ZW5zaW9uIEdMX09FU19zdGFuZGFyZF9kZXJpdmF0aXZlczogZW5hYmxlXFxuJztcbiAgICAgICAgICAgIGlmIChkZXZpY2UuZXh0VGV4dHVyZUxvZCkge1xuICAgICAgICAgICAgICAgIGV4dGVuc2lvbnMgKz0gJyNleHRlbnNpb24gR0xfRVhUX3NoYWRlcl90ZXh0dXJlX2xvZDogZW5hYmxlXFxuXFxuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKFxuICAgICAgICAgICAgZGV2aWNlLFxuICAgICAgICAgICAgdnNDb2RlLFxuICAgICAgICAgICAgYCR7ZGVmaW5lc31cXG4ke3NoYWRlckNodW5rcy5yZXByb2plY3RQU31gLFxuICAgICAgICAgICAgc2hhZGVyS2V5LFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICBleHRlbnNpb25zXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgXCJSZXByb2plY3RUZXh0dXJlXCIpO1xuXG4gICAgY29uc3QgY29uc3RhbnRTb3VyY2UgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShzb3VyY2UuY3ViZW1hcCA/IFwic291cmNlQ3ViZVwiIDogXCJzb3VyY2VUZXhcIik7XG4gICAgY29uc3RhbnRTb3VyY2Uuc2V0VmFsdWUoc291cmNlKTtcblxuICAgIGNvbnN0IGNvbnN0YW50UGFyYW1zID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJwYXJhbXNcIik7XG4gICAgY29uc3QgY29uc3RhbnRQYXJhbXMyID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJwYXJhbXMyXCIpO1xuXG4gICAgY29uc3QgdXZNb2RQYXJhbSA9IGRldmljZS5zY29wZS5yZXNvbHZlKFwidXZNb2RcIik7XG4gICAgaWYgKG9wdGlvbnM/LnNlYW1QaXhlbHMpIHtcbiAgICAgICAgY29uc3QgcCA9IG9wdGlvbnMuc2VhbVBpeGVscztcbiAgICAgICAgY29uc3QgdyA9IG9wdGlvbnMucmVjdCA/IG9wdGlvbnMucmVjdC56IDogdGFyZ2V0LndpZHRoO1xuICAgICAgICBjb25zdCBoID0gb3B0aW9ucy5yZWN0ID8gb3B0aW9ucy5yZWN0LncgOiB0YXJnZXQuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IGlubmVyV2lkdGggPSB3IC0gcCAqIDI7XG4gICAgICAgIGNvbnN0IGlubmVySGVpZ2h0ID0gaCAtIHAgKiAyO1xuXG4gICAgICAgIHV2TW9kUGFyYW0uc2V0VmFsdWUoW1xuICAgICAgICAgICAgKGlubmVyV2lkdGggKyBwICogMikgLyBpbm5lcldpZHRoLFxuICAgICAgICAgICAgKGlubmVySGVpZ2h0ICsgcCAqIDIpIC8gaW5uZXJIZWlnaHQsXG4gICAgICAgICAgICAtcCAvIGlubmVyV2lkdGgsXG4gICAgICAgICAgICAtcCAvIGlubmVySGVpZ2h0XG4gICAgICAgIF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHV2TW9kUGFyYW0uc2V0VmFsdWUoWzEsIDEsIDAsIDBdKTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSBbXG4gICAgICAgIDAsXG4gICAgICAgIHNwZWN1bGFyUG93ZXIsXG4gICAgICAgIHNvdXJjZS5maXhDdWJlbWFwU2VhbXMgPyAxLjAgLyBzb3VyY2Uud2lkdGggOiAwLjAsICAgICAgICAgIC8vIHNvdXJjZSBzZWFtIHNjYWxlXG4gICAgICAgIHRhcmdldC5maXhDdWJlbWFwU2VhbXMgPyAxLjAgLyB0YXJnZXQud2lkdGggOiAwLjAgICAgICAgICAgIC8vIHRhcmdldCBzZWFtIHNjYWxlXG4gICAgXTtcblxuICAgIGNvbnN0IHBhcmFtczIgPSBbXG4gICAgICAgIHRhcmdldC53aWR0aCAqIHRhcmdldC5oZWlnaHQgKiAodGFyZ2V0LmN1YmVtYXAgPyA2IDogMSksXG4gICAgICAgIHNvdXJjZS53aWR0aCAqIHNvdXJjZS5oZWlnaHQgKiAoc291cmNlLmN1YmVtYXAgPyA2IDogMSlcbiAgICBdO1xuXG4gICAgaWYgKHByb2Nlc3NGdW5jLnN0YXJ0c1dpdGgoJ3ByZWZpbHRlclNhbXBsZXMnKSkge1xuICAgICAgICAvLyBzZXQgb3IgZ2VuZXJhdGUgdGhlIHByZS1jYWxjdWxhdGVkIHNhbXBsZXMgZGF0YVxuICAgICAgICBjb25zdCBzb3VyY2VUb3RhbFBpeGVscyA9IHNvdXJjZS53aWR0aCAqIHNvdXJjZS5oZWlnaHQgKiAoc291cmNlLmN1YmVtYXAgPyA2IDogMSk7XG4gICAgICAgIGNvbnN0IHNhbXBsZXNUZXggPVxuICAgICAgICAgICAgKGRpc3RyaWJ1dGlvbiA9PT0gJ2dneCcpID8gZ2VuZXJhdGVHR1hTYW1wbGVzVGV4KGRldmljZSwgbnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlciwgc291cmNlVG90YWxQaXhlbHMpIDpcbiAgICAgICAgICAgICAgICAoKGRpc3RyaWJ1dGlvbiA9PT0gJ2xhbWJlcnQnKSA/IGdlbmVyYXRlTGFtYmVydFNhbXBsZXNUZXgoZGV2aWNlLCBudW1TYW1wbGVzLCBzb3VyY2VUb3RhbFBpeGVscykgOlxuICAgICAgICAgICAgICAgICAgICBnZW5lcmF0ZVBob25nU2FtcGxlc1RleChkZXZpY2UsIG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpKTtcbiAgICAgICAgZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJzYW1wbGVzVGV4XCIpLnNldFZhbHVlKHNhbXBsZXNUZXgpO1xuICAgICAgICBkZXZpY2Uuc2NvcGUucmVzb2x2ZShcInNhbXBsZXNUZXhJbnZlcnNlU2l6ZVwiKS5zZXRWYWx1ZShbMS4wIC8gc2FtcGxlc1RleC53aWR0aCwgMS4wIC8gc2FtcGxlc1RleC5oZWlnaHRdKTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBmID0gMDsgZiA8ICh0YXJnZXQuY3ViZW1hcCA/IDYgOiAxKTsgZisrKSB7XG4gICAgICAgIGlmIChmYWNlID09PSBudWxsIHx8IGYgPT09IGZhY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0YXJnZXQsXG4gICAgICAgICAgICAgICAgZmFjZTogZixcbiAgICAgICAgICAgICAgICBkZXB0aDogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gZjtcbiAgICAgICAgICAgIGNvbnN0YW50UGFyYW1zLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICBjb25zdGFudFBhcmFtczIuc2V0VmFsdWUocGFyYW1zMik7XG5cbiAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHJlbmRlclRhcmdldCwgc2hhZGVyLCBvcHRpb25zPy5yZWN0KTtcblxuICAgICAgICAgICAgcmVuZGVyVGFyZ2V0LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG59XG5cbmV4cG9ydCB7IHJlcHJvamVjdFRleHR1cmUgfTtcbiJdLCJuYW1lcyI6WyJnZXRQcm9qZWN0aW9uTmFtZSIsInByb2plY3Rpb24iLCJURVhUVVJFUFJPSkVDVElPTl9DVUJFIiwiVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTCIsInBhY2tGbG9hdDMyVG9SR0JBOCIsInZhbHVlIiwiYXJyYXkiLCJvZmZzZXQiLCJlbmNYIiwiZW5jWSIsImVuY1oiLCJlbmNXIiwiTWF0aCIsIm1pbiIsImZsb29yIiwicGFja1NhbXBsZXMiLCJzYW1wbGVzIiwibnVtU2FtcGxlcyIsImxlbmd0aCIsInciLCJoIiwiY2VpbCIsImRhdGEiLCJVaW50OEFycmF5Iiwib2ZmIiwiaSIsIndpZHRoIiwiaGVpZ2h0IiwiaGVtaXNwaGVyZVNhbXBsZVBob25nIiwiZHN0VmVjIiwieCIsInkiLCJzcGVjdWxhclBvd2VyIiwicGhpIiwiUEkiLCJjb3NUaGV0YSIsInBvdyIsInNpblRoZXRhIiwic3FydCIsInNldCIsImNvcyIsInNpbiIsIm5vcm1hbGl6ZSIsImhlbWlzcGhlcmVTYW1wbGVMYW1iZXJ0IiwiaGVtaXNwaGVyZVNhbXBsZUdHWCIsImEiLCJEX0dHWCIsIk5vSCIsImxpbmVhclJvdWdobmVzcyIsImsiLCJnZW5lcmF0ZVBob25nU2FtcGxlcyIsIkgiLCJWZWMzIiwicmVzdWx0IiwicmFuZG9tIiwicmFkaWNhbEludmVyc2UiLCJwdXNoIiwieiIsImdlbmVyYXRlTGFtYmVydFNhbXBsZXMiLCJzb3VyY2VUb3RhbFBpeGVscyIsInBpeGVsc1BlclNhbXBsZSIsInBkZiIsIm1pcExldmVsIiwibG9nMiIsInJlcXVpcmVkU2FtcGxlc0dHWCIsImdldFJlcXVpcmVkU2FtcGxlc0dHWCIsInRhYmxlIiwiZ2VuZXJhdGVHR1hTYW1wbGVzIiwicm91Z2huZXNzIiwiTCIsIk4iLCJyZXF1aXJlZFNhbXBsZXMiLCJtdWxTY2FsYXIiLCJzdWIiLCJjcmVhdGVTYW1wbGVzVGV4IiwiZGV2aWNlIiwibmFtZSIsInBhY2tlZFNhbXBsZXMiLCJUZXh0dXJlIiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwibGV2ZWxzIiwiU2ltcGxlQ2FjaGUiLCJjb25zdHJ1Y3RvciIsImRlc3Ryb3lDb250ZW50IiwibWFwIiwiTWFwIiwiZGVzdHJveSIsImZvckVhY2giLCJrZXkiLCJnZXQiLCJtaXNzRnVuYyIsImhhcyIsInNhbXBsZXNDYWNoZSIsImRldmljZUNhY2hlIiwiRGV2aWNlQ2FjaGUiLCJnZXRDYWNoZWRUZXh0dXJlIiwiZ2V0U2FtcGxlc0ZuYyIsImNhY2hlIiwiZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlc1RleCIsImdlbmVyYXRlUGhvbmdTYW1wbGVzVGV4IiwiZ2VuZXJhdGVHR1hTYW1wbGVzVGV4IiwidnNDb2RlIiwicmVwcm9qZWN0VGV4dHVyZSIsInNvdXJjZSIsInRhcmdldCIsIm9wdGlvbnMiLCJHcmFwaGljc0RldmljZSIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsImZ1bmNOYW1lcyIsImhhc093blByb3BlcnR5IiwiZmFjZSIsImRpc3RyaWJ1dGlvbiIsInByb2Nlc3NGdW5jIiwiZGVjb2RlRnVuYyIsIkNodW5rVXRpbHMiLCJlbmNvZGluZyIsImVuY29kZUZ1bmMiLCJzb3VyY2VGdW5jIiwidGFyZ2V0RnVuYyIsInNoYWRlcktleSIsInNoYWRlciIsImdldFByb2dyYW1MaWJyYXJ5IiwiZ2V0Q2FjaGVkU2hhZGVyIiwiZGVmaW5lcyIsInJvdW5kIiwidG9GaXhlZCIsImV4dFRleHR1cmVMb2QiLCJleHRlbnNpb25zIiwid2ViZ2wyIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJzaGFkZXJDaHVua3MiLCJyZXByb2plY3RQUyIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwiY29uc3RhbnRTb3VyY2UiLCJzY29wZSIsInJlc29sdmUiLCJjdWJlbWFwIiwic2V0VmFsdWUiLCJjb25zdGFudFBhcmFtcyIsImNvbnN0YW50UGFyYW1zMiIsInV2TW9kUGFyYW0iLCJzZWFtUGl4ZWxzIiwicCIsInJlY3QiLCJpbm5lcldpZHRoIiwiaW5uZXJIZWlnaHQiLCJwYXJhbXMiLCJmaXhDdWJlbWFwU2VhbXMiLCJwYXJhbXMyIiwic3RhcnRzV2l0aCIsInNhbXBsZXNUZXgiLCJmIiwicmVuZGVyVGFyZ2V0IiwiUmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJkZXB0aCIsImRyYXdRdWFkV2l0aFNoYWRlciIsInBvcEdwdU1hcmtlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsTUFBTUEsaUJBQWlCLEdBQUlDLFVBQVUsSUFBSztBQUN0QyxFQUFBLFFBQVFBLFVBQVU7QUFDZCxJQUFBLEtBQUtDLHNCQUFzQjtBQUN2QixNQUFBLE9BQU8sU0FBUyxDQUFBO0FBQ3BCLElBQUEsS0FBS0MsNEJBQTRCO0FBQzdCLE1BQUEsT0FBTyxZQUFZLENBQUE7QUFDdkIsSUFBQTtBQUNJLE1BQUEsT0FBTyxVQUFVLENBQUE7QUFBQyxHQUFBO0FBRTlCLENBQUMsQ0FBQTs7QUFHRCxNQUFNQyxrQkFBa0IsR0FBRyxDQUFDQyxLQUFLLEVBQUVDLEtBQUssRUFBRUMsTUFBTSxLQUFLO0VBQ2pELElBQUlGLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFDWkMsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDckJELElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNyQkQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3pCLEdBQUMsTUFBTSxJQUFJRixLQUFLLElBQUksR0FBRyxFQUFFO0FBQ3JCQyxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDdkJELElBQUFBLEtBQUssQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNyQkQsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JCRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDekIsR0FBQyxNQUFNO0FBQ0gsSUFBQSxJQUFJQyxJQUFJLEdBQUksQ0FBQyxHQUFHSCxLQUFLLEdBQUksQ0FBQyxDQUFBO0FBQzFCLElBQUEsSUFBSUksSUFBSSxHQUFJLEdBQUcsR0FBR0osS0FBSyxHQUFJLENBQUMsQ0FBQTtBQUM1QixJQUFBLElBQUlLLElBQUksR0FBSSxLQUFLLEdBQUdMLEtBQUssR0FBSSxDQUFDLENBQUE7QUFDOUIsSUFBQSxNQUFNTSxJQUFJLEdBQUksVUFBVSxHQUFHTixLQUFLLEdBQUksQ0FBQyxDQUFBO0lBRXJDRyxJQUFJLElBQUlDLElBQUksR0FBRyxHQUFHLENBQUE7SUFDbEJBLElBQUksSUFBSUMsSUFBSSxHQUFHLEdBQUcsQ0FBQTtJQUNsQkEsSUFBSSxJQUFJQyxJQUFJLEdBQUcsR0FBRyxDQUFBO0lBRWxCTCxLQUFL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
