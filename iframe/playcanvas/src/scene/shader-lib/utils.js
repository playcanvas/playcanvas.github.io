import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { Shader } from '../../platform/graphics/shader.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from './chunks/chunks.js';
import { getProgramLibrary } from './get-program-library.js';
import { ShaderGenerator } from './programs/shader-generator.js';
import { SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';

function createShader(device, vsName, fsName, useTransformFeedback = false, shaderDefinitionOptions = {}) {
  if (typeof useTransformFeedback === 'boolean') {
    shaderDefinitionOptions.useTransformFeedback = useTransformFeedback;
  } else if (typeof useTransformFeedback === 'object') {
    shaderDefinitionOptions = _extends({}, shaderDefinitionOptions, useTransformFeedback);
  }
  return new Shader(device, ShaderUtils.createDefinition(device, _extends({}, shaderDefinitionOptions, {
    name: `${vsName}_${fsName}`,
    vertexCode: shaderChunks[vsName],
    fragmentCode: shaderChunks[fsName]
  })));
}
function createShaderFromCode(device, vsCode, fsCode, uniqueName, attributes, useTransformFeedback = false, shaderDefinitionOptions = {}) {
  if (typeof useTransformFeedback === 'boolean') {
    shaderDefinitionOptions.useTransformFeedback = useTransformFeedback;
  } else if (typeof useTransformFeedback === 'object') {
    shaderDefinitionOptions = _extends({}, shaderDefinitionOptions, useTransformFeedback);
  }
  const programLibrary = getProgramLibrary(device);
  let shader = programLibrary.getCachedShader(uniqueName);
  if (!shader) {
    shader = new Shader(device, ShaderUtils.createDefinition(device, _extends({}, shaderDefinitionOptions, {
      name: uniqueName,
      vertexCode: vsCode,
      fragmentCode: fsCode,
      attributes: attributes
    })));
    programLibrary.setCachedShader(uniqueName, shader);
  }
  return shader;
}
class ShaderGeneratorPassThrough extends ShaderGenerator {
  constructor(key, shaderDefinition) {
    super();
    this.key = key;
    this.shaderDefinition = shaderDefinition;
  }
  generateKey(options) {
    return this.key;
  }
  createShaderDefinition(device, options) {
    return this.shaderDefinition;
  }
}
function processShader(shader, processingOptions) {
  var _shaderDefinition$nam;
  const shaderDefinition = shader.definition;
  const name = (_shaderDefinition$nam = shaderDefinition.name) != null ? _shaderDefinition$nam : 'shader';
  const key = `${name}-id-${shader.id}`;
  const materialGenerator = new ShaderGeneratorPassThrough(key, shaderDefinition);
  const libraryModuleName = 'shader';
  const library = getProgramLibrary(shader.device);
  library.register(libraryModuleName, materialGenerator);
  const variant = library.getProgram(libraryModuleName, {}, processingOptions);
  if (shader.definition.shaderLanguage === SHADERLANGUAGE_WGSL) {
    variant.meshUniformBufferFormat = shaderDefinition.meshUniformBufferFormat;
    variant.meshBindGroupFormat = shaderDefinition.meshBindGroupFormat;
  }
  library.unregister(libraryModuleName);
  return variant;
}
shaderChunks.createShader = createShader;
shaderChunks.createShaderFromCode = createShaderFromCode;

export { createShader, createShaderFromCode, processShader };
