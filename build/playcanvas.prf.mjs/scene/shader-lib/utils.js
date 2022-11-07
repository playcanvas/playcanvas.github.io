/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Shader } from '../../platform/graphics/shader.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from './chunks/chunks.js';
import { getProgramLibrary } from './get-program-library.js';

function createShader(device, vsName, fsName, useTransformFeedback = false) {
  return new Shader(device, ShaderUtils.createDefinition(device, {
    name: `${vsName}_${fsName}`,
    vertexCode: shaderChunks[vsName],
    fragmentCode: shaderChunks[fsName],
    useTransformFeedback: useTransformFeedback
  }));
}

function createShaderFromCode(device, vsCode, fsCode, uniqueName, useTransformFeedback = false, fragmentPreamble = '') {
  const programLibrary = getProgramLibrary(device);
  let shader = programLibrary.getCachedShader(uniqueName);
  if (!shader) {
    shader = new Shader(device, ShaderUtils.createDefinition(device, {
      name: uniqueName,
      vertexCode: vsCode,
      fragmentCode: fsCode,
      fragmentPreamble: fragmentPreamble,
      useTransformFeedback: useTransformFeedback
    }));
    programLibrary.setCachedShader(uniqueName, shader);
  }
  return shader;
}
shaderChunks.createShader = createShader;
shaderChunks.createShaderFromCode = createShaderFromCode;

export { createShader, createShaderFromCode };
