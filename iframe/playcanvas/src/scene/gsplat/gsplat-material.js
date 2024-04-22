import { CULLFACE_BACK, CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { DITHER_NONE, BLEND_NONE, BLEND_NORMAL, SHADER_FORWARDHDR, GAMMA_SRGBHDR, GAMMA_NONE, TONEMAP_LINEAR } from '../constants.js';
import { Material } from '../materials/material.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { gsplat } from './shader-generator-gsplat.js';

const splatMainVS = `
    void main(void)
    {
        vec3 centerLocal = evalCenter();
        vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);

        gl_Position = evalSplat(centerWorld);
    }
`;
const splatMainFS = `
    void main(void)
    {
        gl_FragColor = evalSplat();
    }
`;
const createGSplatMaterial = (options = {}) => {
  var _options$dither;
  const {
    debugRender
  } = options;
  const ditherEnum = (_options$dither = options.dither) != null ? _options$dither : DITHER_NONE;
  const dither = ditherEnum !== DITHER_NONE;
  const material = new Material();
  material.name = 'splatMaterial';
  material.cull = debugRender ? CULLFACE_BACK : CULLFACE_NONE;
  material.blendType = dither ? BLEND_NONE : BLEND_NORMAL;
  material.depthWrite = dither;
  material.getShaderVariant = function (device, scene, defs, unused, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {
    var _options$vertex, _options$fragment;
    const programOptions = {
      pass: pass,
      gamma: pass === SHADER_FORWARDHDR ? scene.gammaCorrection ? GAMMA_SRGBHDR : GAMMA_NONE : scene.gammaCorrection,
      toneMapping: pass === SHADER_FORWARDHDR ? TONEMAP_LINEAR : scene.toneMapping,
      vertex: (_options$vertex = options.vertex) != null ? _options$vertex : splatMainVS,
      fragment: (_options$fragment = options.fragment) != null ? _options$fragment : splatMainFS,
      debugRender: debugRender,
      dither: ditherEnum
    };
    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);
    const library = getProgramLibrary(device);
    library.register('splat', gsplat);
    return library.getProgram('splat', programOptions, processingOptions);
  };
  material.update();
  return material;
};

export { createGSplatMaterial };
