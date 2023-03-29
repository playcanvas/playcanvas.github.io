/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
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
  let shader = device.programLib._cache[shaderKey];

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwcm9qZWN0LXRleHR1cmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9ncmFwaGljcy9yZXByb2plY3QtdGV4dHVyZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHtcbiAgICBGSUxURVJfTkVBUkVTVCxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgcmFuZG9tIH0gZnJvbSAnLi4vbWF0aC9yYW5kb20uanMnO1xuaW1wb3J0IHsgY3JlYXRlU2hhZGVyRnJvbUNvZGUgfSBmcm9tICcuL3Byb2dyYW0tbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4vc2ltcGxlLXBvc3QtZWZmZWN0LmpzJztcbmltcG9ydCB7IENodW5rVXRpbHMgfSBmcm9tICcuL3Byb2dyYW0tbGliL2NodW5rLXV0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4vcHJvZ3JhbS1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi90ZXh0dXJlLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi9kZXZpY2UtY2FjaGUuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vbWF0aC92ZWM0LmpzJykuVmVjNH0gVmVjNCAqL1xuXG5jb25zdCBnZXRQcm9qZWN0aW9uTmFtZSA9IChwcm9qZWN0aW9uKSA9PiB7XG4gICAgc3dpdGNoIChwcm9qZWN0aW9uKSB7XG4gICAgICAgIGNhc2UgVEVYVFVSRVBST0pFQ1RJT05fQ1VCRTpcbiAgICAgICAgICAgIHJldHVybiBcIkN1YmVtYXBcIjtcbiAgICAgICAgY2FzZSBURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMOlxuICAgICAgICAgICAgcmV0dXJuIFwiT2N0YWhlZHJhbFwiO1xuICAgICAgICBkZWZhdWx0OiAvLyBmb3IgYW55dGhpbmcgZWxzZSwgYXNzdW1lIGVxdWlyZWN0XG4gICAgICAgICAgICByZXR1cm4gXCJFcXVpcmVjdFwiO1xuICAgIH1cbn07XG5cbi8vIHBhY2sgYSAzMmJpdCBmbG9hdGluZyBwb2ludCB2YWx1ZSBpbnRvIFJHQkE4XG5jb25zdCBwYWNrRmxvYXQzMlRvUkdCQTggPSAodmFsdWUsIGFycmF5LCBvZmZzZXQpID0+IHtcbiAgICBpZiAodmFsdWUgPD0gMCkge1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAwXSA9IDA7XG4gICAgICAgIGFycmF5W29mZnNldCArIDFdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMl0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAzXSA9IDA7XG4gICAgfSBlbHNlIGlmICh2YWx1ZSA+PSAxLjApIHtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMF0gPSAyNTU7XG4gICAgICAgIGFycmF5W29mZnNldCArIDFdID0gMDtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMl0gPSAwO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAzXSA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IGVuY1ggPSAoMSAqIHZhbHVlKSAlIDE7XG4gICAgICAgIGxldCBlbmNZID0gKDI1NSAqIHZhbHVlKSAlIDE7XG4gICAgICAgIGxldCBlbmNaID0gKDY1MDI1ICogdmFsdWUpICUgMTtcbiAgICAgICAgY29uc3QgZW5jVyA9ICgxNjU4MTM3NS4wICogdmFsdWUpICUgMTtcblxuICAgICAgICBlbmNYIC09IGVuY1kgLyAyNTU7XG4gICAgICAgIGVuY1kgLT0gZW5jWiAvIDI1NTtcbiAgICAgICAgZW5jWiAtPSBlbmNXIC8gMjU1O1xuXG4gICAgICAgIGFycmF5W29mZnNldCArIDBdID0gTWF0aC5taW4oMjU1LCBNYXRoLmZsb29yKGVuY1ggKiAyNTYpKTtcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMV0gPSBNYXRoLm1pbigyNTUsIE1hdGguZmxvb3IoZW5jWSAqIDI1NikpO1xuICAgICAgICBhcnJheVtvZmZzZXQgKyAyXSA9IE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcihlbmNaICogMjU2KSk7XG4gICAgICAgIGFycmF5W29mZnNldCArIDNdID0gTWF0aC5taW4oMjU1LCBNYXRoLmZsb29yKGVuY1cgKiAyNTYpKTtcbiAgICB9XG59O1xuXG4vLyBwYWNrIHNhbXBsZXMgaW50byB0ZXh0dXJlLXJlYWR5IGZvcm1hdFxuY29uc3QgcGFja1NhbXBsZXMgPSAoc2FtcGxlcykgPT4ge1xuICAgIGNvbnN0IG51bVNhbXBsZXMgPSBzYW1wbGVzLmxlbmd0aDtcblxuICAgIGNvbnN0IHcgPSBNYXRoLm1pbihudW1TYW1wbGVzLCA1MTIpO1xuICAgIGNvbnN0IGggPSBNYXRoLmNlaWwobnVtU2FtcGxlcyAvIHcpO1xuICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheSh3ICogaCAqIDQpO1xuXG4gICAgLy8gbm9ybWFsaXplIGZsb2F0IGRhdGEgYW5kIHBhY2sgaW50byByZ2JhOFxuICAgIGxldCBvZmYgPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgKytpKSB7XG4gICAgICAgIHBhY2tGbG9hdDMyVG9SR0JBOChzYW1wbGVzW2kgKiA0ICsgMF0gKiAwLjUgKyAwLjUsIGRhdGEsIG9mZiArIDApO1xuICAgICAgICBwYWNrRmxvYXQzMlRvUkdCQTgoc2FtcGxlc1tpICogNCArIDFdICogMC41ICsgMC41LCBkYXRhLCBvZmYgKyA0KTtcbiAgICAgICAgcGFja0Zsb2F0MzJUb1JHQkE4KHNhbXBsZXNbaSAqIDQgKyAyXSAqIDAuNSArIDAuNSwgZGF0YSwgb2ZmICsgOCk7XG4gICAgICAgIHBhY2tGbG9hdDMyVG9SR0JBOChzYW1wbGVzW2kgKiA0ICsgM10gLyA4LCBkYXRhLCBvZmYgKyAxMik7XG4gICAgICAgIG9mZiArPSAxNjtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICB3aWR0aDogdyxcbiAgICAgICAgaGVpZ2h0OiBoLFxuICAgICAgICBkYXRhOiBkYXRhXG4gICAgfTtcbn07XG5cbi8vIGdlbmVyYXRlIGEgdmVjdG9yIG9uIHRoZSBoZW1pc3BoZXJlIHdpdGggY29uc3RhbnQgZGlzdHJpYnV0aW9uLlxuLy8gZnVuY3Rpb24ga2VwdCBiZWNhdXNlIGl0J3MgdXNlZnVsIGZvciBkZWJ1Z2dpbmdcbi8vIHZlYzMgaGVtaXNwaGVyZVNhbXBsZVVuaWZvcm0odmVjMiB1dikge1xuLy8gICAgIGZsb2F0IHBoaSA9IHV2LnkgKiAyLjAgKiBQSTtcbi8vICAgICBmbG9hdCBjb3NUaGV0YSA9IDEuMCAtIHV2Lng7XG4vLyAgICAgZmxvYXQgc2luVGhldGEgPSBzcXJ0KDEuMCAtIGNvc1RoZXRhICogY29zVGhldGEpO1xuLy8gICAgIHJldHVybiB2ZWMzKGNvcyhwaGkpICogc2luVGhldGEsIHNpbihwaGkpICogc2luVGhldGEsIGNvc1RoZXRhKTtcbi8vIH1cblxuLy8gZ2VuZXJhdGUgYSB2ZWN0b3Igb24gdGhlIGhlbWlzcGhlcmUgd2l0aCBwaG9uZyByZWZsZWN0aW9uIGRpc3RyaWJ1dGlvblxuY29uc3QgaGVtaXNwaGVyZVNhbXBsZVBob25nID0gKGRzdFZlYywgeCwgeSwgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgIGNvbnN0IHBoaSA9IHkgKiAyICogTWF0aC5QSTtcbiAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGgucG93KDEgLSB4LCAxIC8gKHNwZWN1bGFyUG93ZXIgKyAxKSk7XG4gICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNxcnQoMSAtIGNvc1RoZXRhICogY29zVGhldGEpO1xuICAgIGRzdFZlYy5zZXQoTWF0aC5jb3MocGhpKSAqIHNpblRoZXRhLCBNYXRoLnNpbihwaGkpICogc2luVGhldGEsIGNvc1RoZXRhKS5ub3JtYWxpemUoKTtcbn07XG5cbi8vIGdlbmVyYXRlIGEgdmVjdG9yIG9uIHRoZSBoZW1pc3BoZXJlIHdpdGggbGFtYmVydCBkaXN0cmlidXRpb25cbmNvbnN0IGhlbWlzcGhlcmVTYW1wbGVMYW1iZXJ0ID0gKGRzdFZlYywgeCwgeSkgPT4ge1xuICAgIGNvbnN0IHBoaSA9IHkgKiAyICogTWF0aC5QSTtcbiAgICBjb25zdCBjb3NUaGV0YSA9IE1hdGguc3FydCgxIC0geCk7XG4gICAgY29uc3Qgc2luVGhldGEgPSBNYXRoLnNxcnQoeCk7XG4gICAgZHN0VmVjLnNldChNYXRoLmNvcyhwaGkpICogc2luVGhldGEsIE1hdGguc2luKHBoaSkgKiBzaW5UaGV0YSwgY29zVGhldGEpLm5vcm1hbGl6ZSgpO1xufTtcblxuLy8gZ2VuZXJhdGUgYSB2ZWN0b3Igb24gdGhlIGhlbWlzcGhlcmUgd2l0aCBHR1ggZGlzdHJpYnV0aW9uLlxuLy8gYSBpcyBsaW5lYXIgcm91Z2huZXNzXjJcbmNvbnN0IGhlbWlzcGhlcmVTYW1wbGVHR1ggPSAoZHN0VmVjLCB4LCB5LCBhKSA9PiB7XG4gICAgY29uc3QgcGhpID0geSAqIDIgKiBNYXRoLlBJO1xuICAgIGNvbnN0IGNvc1RoZXRhID0gTWF0aC5zcXJ0KCgxIC0geCkgLyAoMSArIChhICogYSAtIDEpICogeCkpO1xuICAgIGNvbnN0IHNpblRoZXRhID0gTWF0aC5zcXJ0KDEgLSBjb3NUaGV0YSAqIGNvc1RoZXRhKTtcbiAgICBkc3RWZWMuc2V0KE1hdGguY29zKHBoaSkgKiBzaW5UaGV0YSwgTWF0aC5zaW4ocGhpKSAqIHNpblRoZXRhLCBjb3NUaGV0YSkubm9ybWFsaXplKCk7XG59O1xuXG5jb25zdCBEX0dHWCA9IChOb0gsIGxpbmVhclJvdWdobmVzcykgPT4ge1xuICAgIGNvbnN0IGEgPSBOb0ggKiBsaW5lYXJSb3VnaG5lc3M7XG4gICAgY29uc3QgayA9IGxpbmVhclJvdWdobmVzcyAvICgxLjAgLSBOb0ggKiBOb0ggKyBhICogYSk7XG4gICAgcmV0dXJuIGsgKiBrICogKDEgLyBNYXRoLlBJKTtcbn07XG5cbi8vIGdlbmVyYXRlIHByZWNvbXB1dGVkIHNhbXBsZXMgZm9yIHBob25nIHJlZmxlY3Rpb25zIG9mIHRoZSBnaXZlbiBwb3dlclxuY29uc3QgZ2VuZXJhdGVQaG9uZ1NhbXBsZXMgPSAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgIGNvbnN0IEggPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyArK2kpIHtcbiAgICAgICAgaGVtaXNwaGVyZVNhbXBsZVBob25nKEgsIGkgLyBudW1TYW1wbGVzLCByYW5kb20ucmFkaWNhbEludmVyc2UoaSksIHNwZWN1bGFyUG93ZXIpO1xuICAgICAgICByZXN1bHQucHVzaChILngsIEgueSwgSC56LCAwKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gZ2VuZXJhdGUgcHJlY29tcHV0ZWQgc2FtcGxlcyBmb3IgbGFtYmVydCBjb252b2x1dGlvblxuY29uc3QgZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlcyA9IChudW1TYW1wbGVzLCBzb3VyY2VUb3RhbFBpeGVscykgPT4ge1xuICAgIGNvbnN0IHBpeGVsc1BlclNhbXBsZSA9IHNvdXJjZVRvdGFsUGl4ZWxzIC8gbnVtU2FtcGxlcztcblxuICAgIGNvbnN0IEggPSBuZXcgVmVjMygpO1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1TYW1wbGVzOyArK2kpIHtcbiAgICAgICAgaGVtaXNwaGVyZVNhbXBsZUxhbWJlcnQoSCwgaSAvIG51bVNhbXBsZXMsIHJhbmRvbS5yYWRpY2FsSW52ZXJzZShpKSk7XG4gICAgICAgIGNvbnN0IHBkZiA9IEgueiAvIE1hdGguUEk7XG4gICAgICAgIGNvbnN0IG1pcExldmVsID0gMC41ICogTWF0aC5sb2cyKHBpeGVsc1BlclNhbXBsZSAvIHBkZik7XG4gICAgICAgIHJlc3VsdC5wdXNoKEgueCwgSC55LCBILnosIG1pcExldmVsKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gZ2VuZXJhdGUgYSB0YWJsZSBzdG9yaW5nIHRoZSBudW1iZXIgb2Ygc2FtcGxlcyByZXF1aXJlZCB0byBnZXQgJ251bVNhbXBsZXMnXG4vLyB2YWxpZCBzYW1wbGVzIGZvciB0aGUgZ2l2ZW4gc3BlY3VsYXJQb3dlci5cbi8qIGVzbGludC1kaXNhYmxlIG5vLXVudXNlZC12YXJzICovXG5jb25zdCBjYWxjdWxhdGVSZXF1aXJlZFNhbXBsZXNHR1ggPSAoKSA9PiB7XG4gICAgY29uc3QgY291bnRWYWxpZFNhbXBsZXNHR1ggPSAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgICAgICBjb25zdCByb3VnaG5lc3MgPSAxIC0gTWF0aC5sb2cyKHNwZWN1bGFyUG93ZXIpIC8gMTEuMDtcbiAgICAgICAgY29uc3QgYSA9IHJvdWdobmVzcyAqIHJvdWdobmVzcztcbiAgICAgICAgY29uc3QgSCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIGNvbnN0IEwgPSBuZXcgVmVjMygpO1xuICAgICAgICBjb25zdCBOID0gbmV3IFZlYzMoMCwgMCwgMSk7XG5cbiAgICAgICAgbGV0IHZhbGlkU2FtcGxlcyA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtU2FtcGxlczsgKytpKSB7XG4gICAgICAgICAgICBoZW1pc3BoZXJlU2FtcGxlR0dYKEgsIGkgLyBudW1TYW1wbGVzLCByYW5kb20ucmFkaWNhbEludmVyc2UoaSksIGEpO1xuXG4gICAgICAgICAgICBjb25zdCBOb0ggPSBILno7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2luY2UgTiBpcyAoMCwgMCwgMSlcbiAgICAgICAgICAgIEwuc2V0KEgueCwgSC55LCBILnopLm11bFNjYWxhcigyICogTm9IKS5zdWIoTik7XG5cbiAgICAgICAgICAgIHZhbGlkU2FtcGxlcyArPSBMLnogPiAwID8gMSA6IDA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsaWRTYW1wbGVzO1xuICAgIH07XG5cbiAgICBjb25zdCBudW1TYW1wbGVzID0gWzEwMjQsIDEyOCwgMzIsIDE2XTtcbiAgICBjb25zdCBzcGVjdWxhclBvd2VycyA9IFs1MTIsIDEyOCwgMzIsIDgsIDJdO1xuXG4gICAgY29uc3QgcmVxdWlyZWRUYWJsZSA9IHt9O1xuICAgIG51bVNhbXBsZXMuZm9yRWFjaCgobnVtU2FtcGxlcykgPT4ge1xuICAgICAgICBjb25zdCB0YWJsZSA9IHsgfTtcbiAgICAgICAgc3BlY3VsYXJQb3dlcnMuZm9yRWFjaCgoc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgICAgICAgICAgbGV0IHJlcXVpcmVkU2FtcGxlcyA9IG51bVNhbXBsZXM7XG4gICAgICAgICAgICB3aGlsZSAoY291bnRWYWxpZFNhbXBsZXNHR1gocmVxdWlyZWRTYW1wbGVzLCBzcGVjdWxhclBvd2VyKSA8IG51bVNhbXBsZXMpIHtcbiAgICAgICAgICAgICAgICByZXF1aXJlZFNhbXBsZXMrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhYmxlW3NwZWN1bGFyUG93ZXJdID0gcmVxdWlyZWRTYW1wbGVzO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVxdWlyZWRUYWJsZVtudW1TYW1wbGVzXSA9IHRhYmxlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlcXVpcmVkVGFibGU7XG59O1xuXG4vLyBwcmludCB0byB0aGUgY29uc29sZSB0aGUgcmVxdWlyZWQgc2FtcGxlcyB0YWJsZSBmb3IgR0dYIHJlZmxlY3Rpb24gY29udm9sdXRpb25cbi8vIGNvbnNvbGUubG9nKGNhbGN1bGF0ZVJlcXVpcmVkU2FtcGxlc0dHWCgpKTtcblxuLy8gdGhpcyBpcyBhIHRhYmxlIHdpdGggcHJlLWNhbGN1bGF0ZWQgbnVtYmVyIG9mIHNhbXBsZXMgcmVxdWlyZWQgZm9yIEdHWC5cbi8vIHRoZSB0YWJsZSBpcyBnZW5lcmF0ZWQgYnkgY2FsY3VsYXRlUmVxdWlyZWRTYW1wbGVzR0dYKClcbi8vIHRoZSB0YWJsZSBpcyBvcmdhbml6ZWQgYnkgW251bVNhbXBsZXNdW3NwZWN1bGFyUG93ZXJdXG4vL1xuLy8gd2UgdXNlIGEgcmVwZWF0YWJsZSBwc2V1ZG8tcmFuZG9tIHNlcXVlbmNlIG9mIG51bWJlcnMgd2hlbiBnZW5lcmF0aW5nIHNhbXBsZXNcbi8vIGZvciB1c2UgaW4gcHJlZmlsdGVyaW5nIEdHWCByZWZsZWN0aW9ucy4gaG93ZXZlciBub3QgYWxsIHRoZSByYW5kb20gc2FtcGxlc1xuLy8gd2lsbCBiZSB2YWxpZC4gdGhpcyBpcyBiZWNhdXNlIHNvbWUgcmVzdWx0aW5nIHJlZmxlY3Rpb24gdmVjdG9ycyB3aWxsIGJlIGJlbG93XG4vLyB0aGUgaGVtaXNwaGVyZS4gdGhpcyBpcyBlc3BlY2lhbGx5IGFwcGFyZW50IHdoZW4gY2FsY3VsYXRpbmcgdmVjdG9ycyBmb3IgdGhlXG4vLyBoaWdoZXIgcm91Z2huZXNzZXMuIChzaW5jZSB2ZWN0b3JzIGFyZSBtb3JlIHdpbGQsIG1vcmUgb2YgdGhlbSBhcmUgaW52YWxpZCkuXG4vLyBmb3IgZXhhbXBsZSwgc3BlY3VsYXJQb3dlciAyIHJlc3VsdHMgaW4gaGFsZiB0aGUgZ2VuZXJhdGVkIHZlY3RvcnMgYmVpbmdcbi8vIGludmFsaWQuIChtZWFuaW5nIHRoZSBHUFUgd291bGQgc3BlbmQgaGFsZiB0aGUgdGltZSBvbiB2ZWN0b3JzIHRoYXQgZG9uJ3Rcbi8vIGNvbnRyaWJ1dGUgdG8gdGhlIGZpbmFsIHJlc3VsdCkuXG4vL1xuLy8gY2FsY3VsYXRpbmcgaG93IG1hbnkgc2FtcGxlcyBhcmUgcmVxdWlyZWQgdG8gZ2VuZXJhdGUgJ24nIHZhbGlkIHNhbXBsZXMgaXMgYVxuLy8gc2xvdyBvcGVyYXRpb24sIHNvIHRoaXMgdGFibGUgc3RvcmVzIHRoZSBwcmUtY2FsY3VsYXRlZCBudW1iZXJzIG9mIHNhbXBsZXNcbi8vIHJlcXVpcmVkIGZvciB0aGUgc2V0cyBvZiAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcnMpIHBhaXJzIHdlIGV4cGVjdCB0b1xuLy8gZW5jb3VudGVyIGF0IHJ1bnRpbWUuXG5jb25zdCByZXF1aXJlZFNhbXBsZXNHR1ggPSB7XG4gICAgXCIxNlwiOiB7XG4gICAgICAgIFwiMlwiOiAyNixcbiAgICAgICAgXCI4XCI6IDIwLFxuICAgICAgICBcIjMyXCI6IDE3LFxuICAgICAgICBcIjEyOFwiOiAxNixcbiAgICAgICAgXCI1MTJcIjogMTZcbiAgICB9LFxuICAgIFwiMzJcIjoge1xuICAgICAgICBcIjJcIjogNTMsXG4gICAgICAgIFwiOFwiOiA0MCxcbiAgICAgICAgXCIzMlwiOiAzNCxcbiAgICAgICAgXCIxMjhcIjogMzIsXG4gICAgICAgIFwiNTEyXCI6IDMyXG4gICAgfSxcbiAgICBcIjEyOFwiOiB7XG4gICAgICAgIFwiMlwiOiAyMTQsXG4gICAgICAgIFwiOFwiOiAxNjMsXG4gICAgICAgIFwiMzJcIjogMTM5LFxuICAgICAgICBcIjEyOFwiOiAxMzAsXG4gICAgICAgIFwiNTEyXCI6IDEyOFxuICAgIH0sXG4gICAgXCIxMDI0XCI6IHtcbiAgICAgICAgXCIyXCI6IDE3MjIsXG4gICAgICAgIFwiOFwiOiAxMzEwLFxuICAgICAgICBcIjMyXCI6IDExMTQsXG4gICAgICAgIFwiMTI4XCI6IDEwNDEsXG4gICAgICAgIFwiNTEyXCI6IDEwMjVcbiAgICB9XG59O1xuXG4vLyBnZXQgdGhlIG51bWJlciBvZiByYW5kb20gc2FtcGxlcyByZXF1aXJlZCB0byBnZW5lcmF0ZSBudW1TYW1wbGVzIHZhbGlkIHNhbXBsZXMuXG5jb25zdCBnZXRSZXF1aXJlZFNhbXBsZXNHR1ggPSAobnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlcikgPT4ge1xuICAgIGNvbnN0IHRhYmxlID0gcmVxdWlyZWRTYW1wbGVzR0dYW251bVNhbXBsZXNdO1xuICAgIHJldHVybiAodGFibGUgJiYgdGFibGVbc3BlY3VsYXJQb3dlcl0pIHx8IG51bVNhbXBsZXM7XG59O1xuXG4vLyBnZW5lcmF0ZSBwcmVjb21wdXRlZCBHR1ggc2FtcGxlc1xuY29uc3QgZ2VuZXJhdGVHR1hTYW1wbGVzID0gKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIsIHNvdXJjZVRvdGFsUGl4ZWxzKSA9PiB7XG4gICAgY29uc3QgcGl4ZWxzUGVyU2FtcGxlID0gc291cmNlVG90YWxQaXhlbHMgLyBudW1TYW1wbGVzO1xuICAgIGNvbnN0IHJvdWdobmVzcyA9IDEgLSBNYXRoLmxvZzIoc3BlY3VsYXJQb3dlcikgLyAxMS4wO1xuICAgIGNvbnN0IGEgPSByb3VnaG5lc3MgKiByb3VnaG5lc3M7XG4gICAgY29uc3QgSCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgTCA9IG5ldyBWZWMzKCk7XG4gICAgY29uc3QgTiA9IG5ldyBWZWMzKDAsIDAsIDEpO1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgY29uc3QgcmVxdWlyZWRTYW1wbGVzID0gZ2V0UmVxdWlyZWRTYW1wbGVzR0dYKG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXF1aXJlZFNhbXBsZXM7ICsraSkge1xuICAgICAgICBoZW1pc3BoZXJlU2FtcGxlR0dYKEgsIGkgLyByZXF1aXJlZFNhbXBsZXMsIHJhbmRvbS5yYWRpY2FsSW52ZXJzZShpKSwgYSk7XG5cbiAgICAgICAgY29uc3QgTm9IID0gSC56OyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNpbmNlIE4gaXMgKDAsIDAsIDEpXG4gICAgICAgIEwuc2V0KEgueCwgSC55LCBILnopLm11bFNjYWxhcigyICogTm9IKS5zdWIoTik7XG5cbiAgICAgICAgaWYgKEwueiA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHBkZiA9IERfR0dYKE1hdGgubWluKDEsIE5vSCksIGEpIC8gNCArIDAuMDAxO1xuICAgICAgICAgICAgY29uc3QgbWlwTGV2ZWwgPSAwLjUgKiBNYXRoLmxvZzIocGl4ZWxzUGVyU2FtcGxlIC8gcGRmKTtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKEwueCwgTC55LCBMLnosIG1pcExldmVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHdoaWxlIChyZXN1bHQubGVuZ3RoIDwgbnVtU2FtcGxlcyAqIDQpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goMCwgMCwgMCwgMCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIHBhY2sgZmxvYXQgc2FtcGxlcyBkYXRhIGludG8gYW4gcmdiYTggdGV4dHVyZVxuY29uc3QgY3JlYXRlU2FtcGxlc1RleCA9IChkZXZpY2UsIG5hbWUsIHNhbXBsZXMpID0+IHtcbiAgICBjb25zdCBwYWNrZWRTYW1wbGVzID0gcGFja1NhbXBsZXMoc2FtcGxlcyk7XG4gICAgcmV0dXJuIG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICB3aWR0aDogcGFja2VkU2FtcGxlcy53aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBwYWNrZWRTYW1wbGVzLmhlaWdodCxcbiAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgIG1pbkZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgIGxldmVsczogW3BhY2tlZFNhbXBsZXMuZGF0YV1cbiAgICB9KTtcbn07XG5cbi8vIHNpbXBsZSBjYWNoZSBzdG9yaW5nIGtleS0+dmFsdWVcbi8vIG1pc3NGdW5jIGlzIGNhbGxlZCBpZiB0aGUga2V5IGlzIG5vdCBwcmVzZW50XG5jbGFzcyBTaW1wbGVDYWNoZSB7XG4gICAgY29uc3RydWN0b3IoZGVzdHJveUNvbnRlbnQgPSB0cnVlKSB7XG4gICAgICAgIHRoaXMuZGVzdHJveUNvbnRlbnQgPSBkZXN0cm95Q29udGVudDtcbiAgICB9XG5cbiAgICBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBpZiAodGhpcy5kZXN0cm95Q29udGVudCkge1xuICAgICAgICAgICAgdGhpcy5tYXAuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIHZhbHVlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0KGtleSwgbWlzc0Z1bmMpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hcC5oYXMoa2V5KSkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gbWlzc0Z1bmMoKTtcbiAgICAgICAgICAgIHRoaXMubWFwLnNldChrZXksIHJlc3VsdCk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm1hcC5nZXQoa2V5KTtcbiAgICB9XG59XG5cbi8vIGNhY2hlLCB1c2VkIHRvIHN0b3JlIHNhbXBsZXMuIHdlIHN0b3JlIHRoZXNlIHNlcGFyYXRlbHkgZnJvbSB0ZXh0dXJlcyBzaW5jZSBtdWx0aXBsZVxuLy8gZGV2aWNlcyBjYW4gdXNlIHRoZSBzYW1lIHNldCBvZiBzYW1wbGVzLlxuY29uc3Qgc2FtcGxlc0NhY2hlID0gbmV3IFNpbXBsZUNhY2hlKGZhbHNlKTtcblxuLy8gY2FjaGUsIHN0b3Jpbmcgc2FtcGxlcyBzdG9yZWQgaW4gdGV4dHVyZXMsIHRob3NlIGFyZSBwZXIgZGV2aWNlXG5jb25zdCBkZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG5jb25zdCBnZXRDYWNoZWRUZXh0dXJlID0gKGRldmljZSwga2V5LCBnZXRTYW1wbGVzRm5jKSA9PiB7XG4gICAgY29uc3QgY2FjaGUgPSBkZXZpY2VDYWNoZS5nZXQoZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgU2ltcGxlQ2FjaGUoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBjYWNoZS5nZXQoa2V5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBjcmVhdGVTYW1wbGVzVGV4KGRldmljZSwga2V5LCBzYW1wbGVzQ2FjaGUuZ2V0KGtleSwgZ2V0U2FtcGxlc0ZuYykpO1xuICAgIH0pO1xufTtcblxuY29uc3QgZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlc1RleCA9IChkZXZpY2UsIG51bVNhbXBsZXMsIHNvdXJjZVRvdGFsUGl4ZWxzKSA9PiB7XG4gICAgY29uc3Qga2V5ID0gYGxhbWJlcnQtc2FtcGxlcy0ke251bVNhbXBsZXN9LSR7c291cmNlVG90YWxQaXhlbHN9YDtcbiAgICByZXR1cm4gZ2V0Q2FjaGVkVGV4dHVyZShkZXZpY2UsIGtleSwgKCkgPT4ge1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlcyhudW1TYW1wbGVzLCBzb3VyY2VUb3RhbFBpeGVscyk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBnZW5lcmF0ZVBob25nU2FtcGxlc1RleCA9IChkZXZpY2UsIG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpID0+IHtcbiAgICBjb25zdCBrZXkgPSBgcGhvbmctc2FtcGxlcy0ke251bVNhbXBsZXN9LSR7c3BlY3VsYXJQb3dlcn1gO1xuICAgIHJldHVybiBnZXRDYWNoZWRUZXh0dXJlKGRldmljZSwga2V5LCAoKSA9PiB7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZVBob25nU2FtcGxlcyhudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGdlbmVyYXRlR0dYU2FtcGxlc1RleCA9IChkZXZpY2UsIG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIsIHNvdXJjZVRvdGFsUGl4ZWxzKSA9PiB7XG4gICAgY29uc3Qga2V5ID0gYGdneC1zYW1wbGVzLSR7bnVtU2FtcGxlc30tJHtzcGVjdWxhclBvd2VyfS0ke3NvdXJjZVRvdGFsUGl4ZWxzfWA7XG4gICAgcmV0dXJuIGdldENhY2hlZFRleHR1cmUoZGV2aWNlLCBrZXksICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGdlbmVyYXRlR0dYU2FtcGxlcyhudW1TYW1wbGVzLCBzcGVjdWxhclBvd2VyLCBzb3VyY2VUb3RhbFBpeGVscyk7XG4gICAgfSk7XG59O1xuXG5jb25zdCB2c0NvZGUgPSBgXG5hdHRyaWJ1dGUgdmVjMiB2ZXJ0ZXhfcG9zaXRpb247XG5cbnVuaWZvcm0gdmVjNCB1dk1vZDtcblxudmFyeWluZyB2ZWMyIHZVdjA7XG5cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZ2xfUG9zaXRpb24gPSB2ZWM0KHZlcnRleF9wb3NpdGlvbiwgMC41LCAxLjApO1xuICAgIHZVdjAgPSAodmVydGV4X3Bvc2l0aW9uLnh5ICogMC41ICsgMC41KSAqIHV2TW9kLnh5ICsgdXZNb2Quenc7XG59XG5gO1xuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gcmVwcm9qZWN0cyB0ZXh0dXJlcyBiZXR3ZWVuIGN1YmVtYXAsIGVxdWlyZWN0YW5ndWxhciBhbmQgb2N0YWhlZHJhbCBmb3JtYXRzLiBUaGVcbiAqIGZ1bmN0aW9uIGNhbiByZWFkIGFuZCB3cml0ZSB0ZXh0dXJlcyB3aXRoIHBpeGVsIGRhdGEgaW4gUkdCRSwgUkdCTSwgbGluZWFyIGFuZCBzUkdCIGZvcm1hdHMuXG4gKiBXaGVuIHNwZWN1bGFyUG93ZXIgaXMgc3BlY2lmaWVkIGl0IHdpbGwgcGVyZm9ybSBhIHBob25nLXdlaWdodGVkIGNvbnZvbHV0aW9uIG9mIHRoZSBzb3VyY2UgKGZvclxuICogZ2VuZXJhdGluZyBhIGdsb3NzIG1hcHMpLlxuICpcbiAqIEBwYXJhbSB7VGV4dHVyZX0gc291cmNlIC0gVGhlIHNvdXJjZSB0ZXh0dXJlLlxuICogQHBhcmFtIHtUZXh0dXJlfSB0YXJnZXQgLSBUaGUgdGFyZ2V0IHRleHR1cmUuXG4gKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gVGhlIG9wdGlvbnMgb2JqZWN0LlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnNwZWN1bGFyUG93ZXJdIC0gT3B0aW9uYWwgc3BlY3VsYXIgcG93ZXIuIFdoZW4gc3BlY3VsYXIgcG93ZXIgaXNcbiAqIHNwZWNpZmllZCwgdGhlIHNvdXJjZSBpcyBjb252b2x2ZWQgYnkgYSBwaG9uZy13ZWlnaHRlZCBrZXJuZWwgcmFpc2VkIHRvIHRoZSBzcGVjaWZpZWQgcG93ZXIuXG4gKiBPdGhlcndpc2UgdGhlIGZ1bmN0aW9uIHBlcmZvcm1zIGEgc3RhbmRhcmQgcmVzYW1wbGUuXG4gKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubnVtU2FtcGxlc10gLSBPcHRpb25hbCBudW1iZXIgb2Ygc2FtcGxlcyAoZGVmYXVsdCBpcyAxMDI0KS5cbiAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mYWNlXSAtIE9wdGlvbmFsIGN1YmVtYXAgZmFjZSB0byB1cGRhdGUgKGRlZmF1bHQgaXMgdXBkYXRlIGFsbCBmYWNlcykuXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMuZGlzdHJpYnV0aW9uXSAtIFNwZWNpZnkgY29udm9sdXRpb24gZGlzdHJpYnV0aW9uIC0gJ25vbmUnLCAnbGFtYmVydCcsXG4gKiAncGhvbmcnLCAnZ2d4Jy4gRGVmYXVsdCBkZXBlbmRzIG9uIHNwZWN1bGFyUG93ZXIuXG4gKiBAcGFyYW0ge1ZlYzR9IFtvcHRpb25zLnJlY3RdIC0gT3B0aW9uYWwgdmlld3BvcnQgcmVjdGFuZ2xlLlxuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnNlYW1QaXhlbHNdIC0gT3B0aW9uYWwgbnVtYmVyIG9mIHNlYW0gcGl4ZWxzIHRvIHJlbmRlclxuICovXG5mdW5jdGlvbiByZXByb2plY3RUZXh0dXJlKHNvdXJjZSwgdGFyZ2V0LCBvcHRpb25zID0ge30pIHtcbiAgICAvLyBtYWludGFpbiBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIHByZXZpb3VzIGZ1bmN0aW9uIHNpZ25hdHVyZVxuICAgIC8vIHJlcHJvamVjdFRleHR1cmUoZGV2aWNlLCBzb3VyY2UsIHRhcmdldCwgc3BlY3VsYXJQb3dlciA9IDEsIG51bVNhbXBsZXMgPSAxMDI0KVxuICAgIGlmIChzb3VyY2UgaW5zdGFuY2VvZiBHcmFwaGljc0RldmljZSkge1xuICAgICAgICBzb3VyY2UgPSBhcmd1bWVudHNbMV07XG4gICAgICAgIHRhcmdldCA9IGFyZ3VtZW50c1syXTtcbiAgICAgICAgb3B0aW9ucyA9IHsgfTtcbiAgICAgICAgaWYgKGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLnNwZWN1bGFyUG93ZXIgPSBhcmd1bWVudHNbM107XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFyZ3VtZW50c1s0XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLm51bVNhbXBsZXMgPSBhcmd1bWVudHNbNF07XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwbGVhc2UgdXNlIHRoZSB1cGRhdGVkIHBjLnJlcHJvamVjdFRleHR1cmUgQVBJLicpO1xuICAgIH1cblxuICAgIC8vIHRhYmxlIG9mIGRpc3RyaWJ1dGlvbiAtPiBmdW5jdGlvbiBuYW1lXG4gICAgY29uc3QgZnVuY05hbWVzID0ge1xuICAgICAgICAnbm9uZSc6ICdyZXByb2plY3QnLFxuICAgICAgICAnbGFtYmVydCc6ICdwcmVmaWx0ZXJTYW1wbGVzVW53ZWlnaHRlZCcsXG4gICAgICAgICdwaG9uZyc6ICdwcmVmaWx0ZXJTYW1wbGVzVW53ZWlnaHRlZCcsXG4gICAgICAgICdnZ3gnOiAncHJlZmlsdGVyU2FtcGxlcydcbiAgICB9O1xuXG4gICAgLy8gZXh0cmFjdCBvcHRpb25zXG4gICAgY29uc3Qgc3BlY3VsYXJQb3dlciA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyUG93ZXInKSA/IG9wdGlvbnMuc3BlY3VsYXJQb3dlciA6IDE7XG4gICAgY29uc3QgZmFjZSA9IG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2ZhY2UnKSA/IG9wdGlvbnMuZmFjZSA6IG51bGw7XG4gICAgY29uc3QgZGlzdHJpYnV0aW9uID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnZGlzdHJpYnV0aW9uJykgPyBvcHRpb25zLmRpc3RyaWJ1dGlvbiA6IChzcGVjdWxhclBvd2VyID09PSAxKSA/ICdub25lJyA6ICdwaG9uZyc7XG5cbiAgICBjb25zdCBwcm9jZXNzRnVuYyA9IGZ1bmNOYW1lc1tkaXN0cmlidXRpb25dIHx8ICdyZXByb2plY3QnO1xuICAgIGNvbnN0IGRlY29kZUZ1bmMgPSBDaHVua1V0aWxzLmRlY29kZUZ1bmMoc291cmNlLmVuY29kaW5nKTtcbiAgICBjb25zdCBlbmNvZGVGdW5jID0gQ2h1bmtVdGlscy5lbmNvZGVGdW5jKHRhcmdldC5lbmNvZGluZyk7XG4gICAgY29uc3Qgc291cmNlRnVuYyA9IGBzYW1wbGUke2dldFByb2plY3Rpb25OYW1lKHNvdXJjZS5wcm9qZWN0aW9uKX1gO1xuICAgIGNvbnN0IHRhcmdldEZ1bmMgPSBgZ2V0RGlyZWN0aW9uJHtnZXRQcm9qZWN0aW9uTmFtZSh0YXJnZXQucHJvamVjdGlvbil9YDtcbiAgICBjb25zdCBudW1TYW1wbGVzID0gb3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnbnVtU2FtcGxlcycpID8gb3B0aW9ucy5udW1TYW1wbGVzIDogMTAyNDtcblxuICAgIC8vIGdlbmVyYXRlIHVuaXF1ZSBzaGFkZXIga2V5XG4gICAgY29uc3Qgc2hhZGVyS2V5ID0gYCR7cHJvY2Vzc0Z1bmN9XyR7ZGVjb2RlRnVuY31fJHtlbmNvZGVGdW5jfV8ke3NvdXJjZUZ1bmN9XyR7dGFyZ2V0RnVuY31fJHtudW1TYW1wbGVzfWA7XG5cbiAgICBjb25zdCBkZXZpY2UgPSBzb3VyY2UuZGV2aWNlO1xuXG4gICAgbGV0IHNoYWRlciA9IGRldmljZS5wcm9ncmFtTGliLl9jYWNoZVtzaGFkZXJLZXldO1xuICAgIGlmICghc2hhZGVyKSB7XG4gICAgICAgIGNvbnN0IGRlZmluZXMgPVxuICAgICAgICAgICAgYCNkZWZpbmUgUFJPQ0VTU19GVU5DICR7cHJvY2Vzc0Z1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBERUNPREVfRlVOQyAke2RlY29kZUZ1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBFTkNPREVfRlVOQyAke2VuY29kZUZ1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBTT1VSQ0VfRlVOQyAke3NvdXJjZUZ1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBUQVJHRVRfRlVOQyAke3RhcmdldEZ1bmN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBOVU1fU0FNUExFUyAke251bVNhbXBsZXN9XFxuYCArXG4gICAgICAgICAgICBgI2RlZmluZSBOVU1fU0FNUExFU19TUVJUICR7TWF0aC5yb3VuZChNYXRoLnNxcnQobnVtU2FtcGxlcykpLnRvRml4ZWQoMSl9XFxuYCArXG4gICAgICAgICAgICAoZGV2aWNlLmV4dFRleHR1cmVMb2QgPyBgI2RlZmluZSBTVVBQT1JUU19URVhMT0RcXG5gIDogJycpO1xuXG4gICAgICAgIGxldCBleHRlbnNpb25zID0gJyc7XG4gICAgICAgIGlmICghZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgZXh0ZW5zaW9ucyA9ICcjZXh0ZW5zaW9uIEdMX09FU19zdGFuZGFyZF9kZXJpdmF0aXZlczogZW5hYmxlXFxuJztcbiAgICAgICAgICAgIGlmIChkZXZpY2UuZXh0VGV4dHVyZUxvZCkge1xuICAgICAgICAgICAgICAgIGV4dGVuc2lvbnMgKz0gJyNleHRlbnNpb24gR0xfRVhUX3NoYWRlcl90ZXh0dXJlX2xvZDogZW5hYmxlXFxuXFxuJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKFxuICAgICAgICAgICAgZGV2aWNlLFxuICAgICAgICAgICAgdnNDb2RlLFxuICAgICAgICAgICAgYCR7ZGVmaW5lc31cXG4ke3NoYWRlckNodW5rcy5yZXByb2plY3RQU31gLFxuICAgICAgICAgICAgc2hhZGVyS2V5LFxuICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICBleHRlbnNpb25zXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgXCJSZXByb2plY3RUZXh0dXJlXCIpO1xuXG4gICAgY29uc3QgY29uc3RhbnRTb3VyY2UgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShzb3VyY2UuY3ViZW1hcCA/IFwic291cmNlQ3ViZVwiIDogXCJzb3VyY2VUZXhcIik7XG4gICAgY29uc3RhbnRTb3VyY2Uuc2V0VmFsdWUoc291cmNlKTtcblxuICAgIGNvbnN0IGNvbnN0YW50UGFyYW1zID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJwYXJhbXNcIik7XG4gICAgY29uc3QgY29uc3RhbnRQYXJhbXMyID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJwYXJhbXMyXCIpO1xuXG4gICAgY29uc3QgdXZNb2RQYXJhbSA9IGRldmljZS5zY29wZS5yZXNvbHZlKFwidXZNb2RcIik7XG4gICAgaWYgKG9wdGlvbnM/LnNlYW1QaXhlbHMpIHtcbiAgICAgICAgY29uc3QgcCA9IG9wdGlvbnMuc2VhbVBpeGVscztcbiAgICAgICAgY29uc3QgdyA9IG9wdGlvbnMucmVjdCA/IG9wdGlvbnMucmVjdC56IDogdGFyZ2V0LndpZHRoO1xuICAgICAgICBjb25zdCBoID0gb3B0aW9ucy5yZWN0ID8gb3B0aW9ucy5yZWN0LncgOiB0YXJnZXQuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IGlubmVyV2lkdGggPSB3IC0gcCAqIDI7XG4gICAgICAgIGNvbnN0IGlubmVySGVpZ2h0ID0gaCAtIHAgKiAyO1xuXG4gICAgICAgIHV2TW9kUGFyYW0uc2V0VmFsdWUoW1xuICAgICAgICAgICAgKGlubmVyV2lkdGggKyBwICogMikgLyBpbm5lcldpZHRoLFxuICAgICAgICAgICAgKGlubmVySGVpZ2h0ICsgcCAqIDIpIC8gaW5uZXJIZWlnaHQsXG4gICAgICAgICAgICAtcCAvIGlubmVyV2lkdGgsXG4gICAgICAgICAgICAtcCAvIGlubmVySGVpZ2h0XG4gICAgICAgIF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHV2TW9kUGFyYW0uc2V0VmFsdWUoWzEsIDEsIDAsIDBdKTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJhbXMgPSBbXG4gICAgICAgIDAsXG4gICAgICAgIHNwZWN1bGFyUG93ZXIsXG4gICAgICAgIHNvdXJjZS5maXhDdWJlbWFwU2VhbXMgPyAxLjAgLyBzb3VyY2Uud2lkdGggOiAwLjAsICAgICAgICAgIC8vIHNvdXJjZSBzZWFtIHNjYWxlXG4gICAgICAgIHRhcmdldC5maXhDdWJlbWFwU2VhbXMgPyAxLjAgLyB0YXJnZXQud2lkdGggOiAwLjAgICAgICAgICAgIC8vIHRhcmdldCBzZWFtIHNjYWxlXG4gICAgXTtcblxuICAgIGNvbnN0IHBhcmFtczIgPSBbXG4gICAgICAgIHRhcmdldC53aWR0aCAqIHRhcmdldC5oZWlnaHQgKiAodGFyZ2V0LmN1YmVtYXAgPyA2IDogMSksXG4gICAgICAgIHNvdXJjZS53aWR0aCAqIHNvdXJjZS5oZWlnaHQgKiAoc291cmNlLmN1YmVtYXAgPyA2IDogMSlcbiAgICBdO1xuXG4gICAgaWYgKHByb2Nlc3NGdW5jLnN0YXJ0c1dpdGgoJ3ByZWZpbHRlclNhbXBsZXMnKSkge1xuICAgICAgICAvLyBzZXQgb3IgZ2VuZXJhdGUgdGhlIHByZS1jYWxjdWxhdGVkIHNhbXBsZXMgZGF0YVxuICAgICAgICBjb25zdCBzb3VyY2VUb3RhbFBpeGVscyA9IHNvdXJjZS53aWR0aCAqIHNvdXJjZS5oZWlnaHQgKiAoc291cmNlLmN1YmVtYXAgPyA2IDogMSk7XG4gICAgICAgIGNvbnN0IHNhbXBsZXNUZXggPVxuICAgICAgICAgICAgKGRpc3RyaWJ1dGlvbiA9PT0gJ2dneCcpID8gZ2VuZXJhdGVHR1hTYW1wbGVzVGV4KGRldmljZSwgbnVtU2FtcGxlcywgc3BlY3VsYXJQb3dlciwgc291cmNlVG90YWxQaXhlbHMpIDpcbiAgICAgICAgICAgICAgICAoKGRpc3RyaWJ1dGlvbiA9PT0gJ2xhbWJlcnQnKSA/IGdlbmVyYXRlTGFtYmVydFNhbXBsZXNUZXgoZGV2aWNlLCBudW1TYW1wbGVzLCBzb3VyY2VUb3RhbFBpeGVscykgOlxuICAgICAgICAgICAgICAgICAgICBnZW5lcmF0ZVBob25nU2FtcGxlc1RleChkZXZpY2UsIG51bVNhbXBsZXMsIHNwZWN1bGFyUG93ZXIpKTtcbiAgICAgICAgZGV2aWNlLnNjb3BlLnJlc29sdmUoXCJzYW1wbGVzVGV4XCIpLnNldFZhbHVlKHNhbXBsZXNUZXgpO1xuICAgICAgICBkZXZpY2Uuc2NvcGUucmVzb2x2ZShcInNhbXBsZXNUZXhJbnZlcnNlU2l6ZVwiKS5zZXRWYWx1ZShbMS4wIC8gc2FtcGxlc1RleC53aWR0aCwgMS4wIC8gc2FtcGxlc1RleC5oZWlnaHRdKTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBmID0gMDsgZiA8ICh0YXJnZXQuY3ViZW1hcCA/IDYgOiAxKTsgZisrKSB7XG4gICAgICAgIGlmIChmYWNlID09PSBudWxsIHx8IGYgPT09IGZhY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0YXJnZXQsXG4gICAgICAgICAgICAgICAgZmFjZTogZixcbiAgICAgICAgICAgICAgICBkZXB0aDogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcGFyYW1zWzBdID0gZjtcbiAgICAgICAgICAgIGNvbnN0YW50UGFyYW1zLnNldFZhbHVlKHBhcmFtcyk7XG4gICAgICAgICAgICBjb25zdGFudFBhcmFtczIuc2V0VmFsdWUocGFyYW1zMik7XG5cbiAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHJlbmRlclRhcmdldCwgc2hhZGVyLCBvcHRpb25zPy5yZWN0KTtcblxuICAgICAgICAgICAgcmVuZGVyVGFyZ2V0LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG59XG5cbmV4cG9ydCB7IHJlcHJvamVjdFRleHR1cmUgfTtcbiJdLCJuYW1lcyI6WyJnZXRQcm9qZWN0aW9uTmFtZSIsInByb2plY3Rpb24iLCJURVhUVVJFUFJPSkVDVElPTl9DVUJFIiwiVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTCIsInBhY2tGbG9hdDMyVG9SR0JBOCIsInZhbHVlIiwiYXJyYXkiLCJvZmZzZXQiLCJlbmNYIiwiZW5jWSIsImVuY1oiLCJlbmNXIiwiTWF0aCIsIm1pbiIsImZsb29yIiwicGFja1NhbXBsZXMiLCJzYW1wbGVzIiwibnVtU2FtcGxlcyIsImxlbmd0aCIsInciLCJoIiwiY2VpbCIsImRhdGEiLCJVaW50OEFycmF5Iiwib2ZmIiwiaSIsIndpZHRoIiwiaGVpZ2h0IiwiaGVtaXNwaGVyZVNhbXBsZVBob25nIiwiZHN0VmVjIiwieCIsInkiLCJzcGVjdWxhclBvd2VyIiwicGhpIiwiUEkiLCJjb3NUaGV0YSIsInBvdyIsInNpblRoZXRhIiwic3FydCIsInNldCIsImNvcyIsInNpbiIsIm5vcm1hbGl6ZSIsImhlbWlzcGhlcmVTYW1wbGVMYW1iZXJ0IiwiaGVtaXNwaGVyZVNhbXBsZUdHWCIsImEiLCJEX0dHWCIsIk5vSCIsImxpbmVhclJvdWdobmVzcyIsImsiLCJnZW5lcmF0ZVBob25nU2FtcGxlcyIsIkgiLCJWZWMzIiwicmVzdWx0IiwicmFuZG9tIiwicmFkaWNhbEludmVyc2UiLCJwdXNoIiwieiIsImdlbmVyYXRlTGFtYmVydFNhbXBsZXMiLCJzb3VyY2VUb3RhbFBpeGVscyIsInBpeGVsc1BlclNhbXBsZSIsInBkZiIsIm1pcExldmVsIiwibG9nMiIsInJlcXVpcmVkU2FtcGxlc0dHWCIsImdldFJlcXVpcmVkU2FtcGxlc0dHWCIsInRhYmxlIiwiZ2VuZXJhdGVHR1hTYW1wbGVzIiwicm91Z2huZXNzIiwiTCIsIk4iLCJyZXF1aXJlZFNhbXBsZXMiLCJtdWxTY2FsYXIiLCJzdWIiLCJjcmVhdGVTYW1wbGVzVGV4IiwiZGV2aWNlIiwibmFtZSIsInBhY2tlZFNhbXBsZXMiLCJUZXh0dXJlIiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwibGV2ZWxzIiwiU2ltcGxlQ2FjaGUiLCJjb25zdHJ1Y3RvciIsImRlc3Ryb3lDb250ZW50IiwibWFwIiwiTWFwIiwiZGVzdHJveSIsImZvckVhY2giLCJrZXkiLCJnZXQiLCJtaXNzRnVuYyIsImhhcyIsInNhbXBsZXNDYWNoZSIsImRldmljZUNhY2hlIiwiRGV2aWNlQ2FjaGUiLCJnZXRDYWNoZWRUZXh0dXJlIiwiZ2V0U2FtcGxlc0ZuYyIsImNhY2hlIiwiZ2VuZXJhdGVMYW1iZXJ0U2FtcGxlc1RleCIsImdlbmVyYXRlUGhvbmdTYW1wbGVzVGV4IiwiZ2VuZXJhdGVHR1hTYW1wbGVzVGV4IiwidnNDb2RlIiwicmVwcm9qZWN0VGV4dHVyZSIsInNvdXJjZSIsInRhcmdldCIsIm9wdGlvbnMiLCJHcmFwaGljc0RldmljZSIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsImZ1bmNOYW1lcyIsImhhc093blByb3BlcnR5IiwiZmFjZSIsImRpc3RyaWJ1dGlvbiIsInByb2Nlc3NGdW5jIiwiZGVjb2RlRnVuYyIsIkNodW5rVXRpbHMiLCJlbmNvZGluZyIsImVuY29kZUZ1bmMiLCJzb3VyY2VGdW5jIiwidGFyZ2V0RnVuYyIsInNoYWRlcktleSIsInNoYWRlciIsInByb2dyYW1MaWIiLCJfY2FjaGUiLCJkZWZpbmVzIiwicm91bmQiLCJ0b0ZpeGVkIiwiZXh0VGV4dHVyZUxvZCIsImV4dGVuc2lvbnMiLCJ3ZWJnbDIiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsInNoYWRlckNodW5rcyIsInJlcHJvamVjdFBTIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJjb25zdGFudFNvdXJjZSIsInNjb3BlIiwicmVzb2x2ZSIsImN1YmVtYXAiLCJzZXRWYWx1ZSIsImNvbnN0YW50UGFyYW1zIiwiY29uc3RhbnRQYXJhbXMyIiwidXZNb2RQYXJhbSIsInNlYW1QaXhlbHMiLCJwIiwicmVjdCIsImlubmVyV2lkdGgiLCJpbm5lckhlaWdodCIsInBhcmFtcyIsImZpeEN1YmVtYXBTZWFtcyIsInBhcmFtczIiLCJzdGFydHNXaXRoIiwic2FtcGxlc1RleCIsImYiLCJyZW5kZXJUYXJnZXQiLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsImRlcHRoIiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwicG9wR3B1TWFya2VyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLE1BQU1BLGlCQUFpQixHQUFJQyxVQUFELElBQWdCO0FBQ3RDLEVBQUEsUUFBUUEsVUFBUjtBQUNJLElBQUEsS0FBS0Msc0JBQUw7QUFDSSxNQUFBLE9BQU8sU0FBUCxDQUFBOztBQUNKLElBQUEsS0FBS0MsNEJBQUw7QUFDSSxNQUFBLE9BQU8sWUFBUCxDQUFBOztBQUNKLElBQUE7QUFDSSxNQUFBLE9BQU8sVUFBUCxDQUFBO0FBTlIsR0FBQTtBQVFILENBVEQsQ0FBQTs7QUFZQSxNQUFNQyxrQkFBa0IsR0FBRyxDQUFDQyxLQUFELEVBQVFDLEtBQVIsRUFBZUMsTUFBZixLQUEwQjtFQUNqRCxJQUFJRixLQUFLLElBQUksQ0FBYixFQUFnQjtBQUNaQyxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFWLENBQUwsR0FBb0IsQ0FBcEIsQ0FBQTtBQUNBRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFWLENBQUwsR0FBb0IsQ0FBcEIsQ0FBQTtBQUNBRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFWLENBQUwsR0FBb0IsQ0FBcEIsQ0FBQTtBQUNBRCxJQUFBQSxLQUFLLENBQUNDLE1BQU0sR0FBRyxDQUFWLENBQUwsR0FBb0IsQ0FBcEIsQ0FBQTtBQUNILEdBTEQsTUFLTyxJQUFJRixLQUFLLElBQUksR0FBYixFQUFrQjtBQUNy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
