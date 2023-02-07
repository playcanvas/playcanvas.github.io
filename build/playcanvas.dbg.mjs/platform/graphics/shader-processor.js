/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { uniformTypeToName, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, BINDGROUP_MESH, semanticToLocation, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_2D_ARRAY, SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH } from './constants.js';
import { UniformFormat, UniformBufferFormat } from './uniform-buffer-format.js';
import { BindBufferFormat, BindTextureFormat, BindGroupFormat } from './bind-group-format.js';

// accepted keywords
// TODO: 'out' keyword is not in the list, as handling it is more complicated due
// to 'out' keyword also being used to mark output only function parameters.
const KEYWORD = /[ \t]*(\battribute\b|\bvarying\b|\buniform\b)/g;

// match 'attribute' and anything else till ';'
const KEYWORD_LINE = /(\battribute\b|\bvarying\b|\bout\b|\buniform\b)[ \t]*([^;]+)([;]+)/g;

// marker for a place in the source code to be replaced by code
const MARKER = '@@@';

// an array identifier, for example 'data[4]' - group 1 is 'data', group 2 is everything in brackets: '4'
const ARRAY_IDENTIFIER = /([\w-]+)\[(.*?)\]/;
const precisionQualifiers = new Set(['highp', 'mediump', 'lowp']);
const shadowSamplers = new Set(['sampler2DShadow', 'samplerCubeShadow']);
const textureDimensions = {
  sampler2D: TEXTUREDIMENSION_2D,
  sampler3D: TEXTUREDIMENSION_3D,
  samplerCube: TEXTUREDIMENSION_CUBE,
  samplerCubeShadow: TEXTUREDIMENSION_CUBE,
  sampler2DShadow: TEXTUREDIMENSION_2D,
  sampler2DArray: TEXTUREDIMENSION_2D_ARRAY,
  sampler2DArrayShadow: TEXTUREDIMENSION_2D_ARRAY
};
class UniformLine {
  constructor(line, shader) {
    // example: `lowp vec4 tints[2 * 4]`
    this.line = line;

    // split to words handling any number of spaces
    const words = line.trim().split(/\s+/);

    // optional precision
    if (precisionQualifiers.has(words[0])) {
      this.precision = words.shift();
    }

    // type
    this.type = words.shift();
    if (line.includes(',')) {
      Debug.error(`A comma on a uniform line is not supported, split it into multiple uniforms: ${line}`, shader);
    }

    // array of uniforms
    if (line.includes('[')) {
      const rest = words.join(' ');
      const match = ARRAY_IDENTIFIER.exec(rest);
      Debug.assert(match);
      this.name = match[1];
      this.arraySize = Number(match[2]);
      if (isNaN(this.arraySize)) {
        shader.failed = true;
        Debug.error(`Only numerically specified uniform array sizes are supported, this uniform is not supported: '${line}'`, shader);
      }
    } else {
      // simple uniform
      this.name = words.shift();
      this.arraySize = 1;
    }
    this.isSampler = this.type.indexOf('sampler') !== -1;
  }
}

/**
 * Pure static class implementing processing of GLSL shaders. It allocates fixed locations for
 * attributes, and handles conversion of uniforms to uniform buffers.
 *
 * @ignore
 */
class ShaderProcessor {
  /**
   * Process the shader.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {object} shaderDefinition - The shader definition.
   * @param {import('./shader.js').Shader} shader - The shader definition.
   * @returns {object} - The processed shader data.
   */
  static run(device, shaderDefinition, shader) {
    /** @type {Map<string, number>} */
    const varyingMap = new Map();

    // extract lines of interests from both shaders
    const vertexExtracted = ShaderProcessor.extract(shaderDefinition.vshader);
    const fragmentExtracted = ShaderProcessor.extract(shaderDefinition.fshader);

    // VS - convert a list of attributes to a shader block with fixed locations
    const attributesBlock = ShaderProcessor.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes);

    // VS - convert a list of varyings to a shader block
    const vertexVaryingsBlock = ShaderProcessor.processVaryings(vertexExtracted.varyings, varyingMap, true);

    // FS - convert a list of varyings to a shader block
    const fragmentVaryingsBlock = ShaderProcessor.processVaryings(fragmentExtracted.varyings, varyingMap, false);

    // FS - convert a list of outputs to a shader block
    const outBlock = ShaderProcessor.processOuts(fragmentExtracted.outs);

    // uniforms - merge vertex and fragment uniforms, and create shared uniform buffers
    // Note that as both vertex and fragment can declare the same uniform, we need to remove duplicates
    const concatUniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
    const uniforms = Array.from(new Set(concatUniforms));

    // parse uniform lines
    const parsedUniforms = uniforms.map(line => new UniformLine(line, shader));

    // validation - as uniforms go to a shared uniform buffer, vertex and fragment versions need to match
    Debug.call(() => {
      const map = new Map();
      parsedUniforms.forEach(uni => {
        const existing = map.get(uni.name);
        Debug.assert(!existing, `Vertex and fragment shaders cannot use the same uniform name with different types: '${existing}' and '${uni.line}'`, shader);
        map.set(uni.name, uni.line);
      });
    });
    const uniformsData = ShaderProcessor.processUniforms(device, parsedUniforms, shaderDefinition.processingOptions, shader);

    // VS - insert the blocks to the source
    const vBlock = attributesBlock + '\n' + vertexVaryingsBlock + '\n' + uniformsData.code;
    const vshader = vertexExtracted.src.replace(MARKER, vBlock);

    // FS - insert the blocks to the source
    const fBlock = fragmentVaryingsBlock + '\n' + outBlock + '\n' + uniformsData.code;
    const fshader = fragmentExtracted.src.replace(MARKER, fBlock);
    return {
      vshader: vshader,
      fshader: fshader,
      meshUniformBufferFormat: uniformsData.meshUniformBufferFormat,
      meshBindGroupFormat: uniformsData.meshBindGroupFormat
    };
  }

  // Extract required information from the shader source code.
  static extract(src) {
    // collected data
    const attributes = [];
    const varyings = [];
    const outs = [];
    const uniforms = [];

    // replacement marker - mark a first replacement place, this is where code
    // blocks are injected later
    let replacement = `${MARKER}\n`;

    // extract relevant parts of the shader
    let match;
    while ((match = KEYWORD.exec(src)) !== null) {
      const keyword = match[1];
      switch (keyword) {
        case 'attribute':
        case 'varying':
        case 'uniform':
        case 'out':
          {
            // read the line
            KEYWORD_LINE.lastIndex = match.index;
            const lineMatch = KEYWORD_LINE.exec(src);
            if (keyword === 'attribute') {
              attributes.push(lineMatch[2]);
            } else if (keyword === 'varying') {
              varyings.push(lineMatch[2]);
            } else if (keyword === 'out') {
              outs.push(lineMatch[2]);
            } else if (keyword === 'uniform') {
              uniforms.push(lineMatch[2]);
            }

            // cut it out
            src = ShaderProcessor.cutOut(src, match.index, KEYWORD_LINE.lastIndex, replacement);
            KEYWORD.lastIndex = match.index + replacement.length;

            // only place a single replacement marker
            replacement = '';
            break;
          }
      }
    }
    return {
      src,
      attributes,
      varyings,
      outs,
      uniforms
    };
  }

  /**
   * Process the lines with uniforms. The function receives the lines containing all uniforms,
   * both numerical as well as textures/samplers. The function also receives the format of uniform
   * buffers (numerical) and bind groups (textures) for view and material level. All uniforms that
   * match any of those are ignored, as those would be supplied by view / material level buffers.
   * All leftover uniforms create uniform buffer and bind group for the mesh itself, containing
   * uniforms that change on the level of the mesh.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {Array<UniformLine>} uniforms - Lines containing uniforms.
   * @param {import('./shader-processor-options.js').ShaderProcessorOptions} processingOptions -
   * Uniform formats.
   * @param {import('./shader.js').Shader} shader - The shader definition.
   * @returns {object} - The uniform data. Returns a shader code block containing uniforms, to be
   * inserted into the shader, as well as generated uniform format structures for the mesh level.
   */
  static processUniforms(device, uniforms, processingOptions, shader) {
    // split uniform lines into samplers and the rest
    /** @type {Array<UniformLine>} */
    const uniformLinesSamplers = [];
    /** @type {Array<UniformLine>} */
    const uniformLinesNonSamplers = [];
    uniforms.forEach(uniform => {
      if (uniform.isSampler) {
        uniformLinesSamplers.push(uniform);
      } else {
        uniformLinesNonSamplers.push(uniform);
      }
    });

    // build mesh uniform buffer format
    const meshUniforms = [];
    uniformLinesNonSamplers.forEach(uniform => {
      // uniforms not already in supplied uniform buffers go to the mesh buffer
      if (!processingOptions.hasUniform(uniform.name)) {
        const uniformType = uniformTypeToName.indexOf(uniform.type);
        Debug.assert(uniformType >= 0, `Uniform type ${uniform.type} is not recognized on line [${uniform.line}]`);
        const uniformFormat = new UniformFormat(uniform.name, uniformType, uniform.arraySize);
        Debug.assert(!uniformFormat.invalid, `Invalid uniform line: ${uniform.line}`, shader);
        meshUniforms.push(uniformFormat);
      }

      // validate types in else
    });

    const meshUniformBufferFormat = meshUniforms.length ? new UniformBufferFormat(device, meshUniforms) : null;

    // build mesh bind group format - start with uniform buffer
    const bufferFormats = [];
    if (meshUniformBufferFormat) {
      // TODO: we could optimize visibility to only stages that use any of the data
      bufferFormats.push(new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT));
    }

    // add textures uniforms
    const textureFormats = [];
    uniformLinesSamplers.forEach(uniform => {
      // unmatched texture uniforms go to mesh block
      if (!processingOptions.hasTexture(uniform.name)) {
        // sample type
        // WebGpu does not currently support filtered float format textures, and so we map them to unfilterable type
        // as we sample them without filtering anyways
        let sampleType = SAMPLETYPE_FLOAT;
        if (uniform.precision === 'highp') sampleType = SAMPLETYPE_UNFILTERABLE_FLOAT;
        if (shadowSamplers.has(uniform.type)) sampleType = SAMPLETYPE_DEPTH;

        // dimension
        const dimension = textureDimensions[uniform.type];

        // TODO: we could optimize visibility to only stages that use any of the data
        textureFormats.push(new BindTextureFormat(uniform.name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT, dimension, sampleType));
      }

      // validate types in else
    });

    const meshBindGroupFormat = new BindGroupFormat(device, bufferFormats, textureFormats);

    // generate code for uniform buffers
    let code = '';
    processingOptions.uniformFormats.forEach((format, bindGroupIndex) => {
      if (format) {
        code += format.getShaderDeclaration(bindGroupIndex, 0);
      }
    });

    // and also for generated mesh format, which is at the slot 0 of the bind group
    if (meshUniformBufferFormat) {
      code += meshUniformBufferFormat.getShaderDeclaration(BINDGROUP_MESH, 0);
    }

    // generate code for textures
    processingOptions.bindGroupFormats.forEach((format, bindGroupIndex) => {
      if (format) {
        code += format.getShaderDeclarationTextures(bindGroupIndex);
      }
    });

    // and also for generated mesh format
    code += meshBindGroupFormat.getShaderDeclarationTextures(BINDGROUP_MESH);
    return {
      code,
      meshUniformBufferFormat,
      meshBindGroupFormat
    };
  }
  static processVaryings(varyingLines, varyingMap, isVertex) {
    let block = '';
    const op = isVertex ? 'out' : 'in';
    varyingLines.forEach((line, index) => {
      const words = ShaderProcessor.splitToWords(line);
      const type = words[0];
      const name = words[1];
      if (isVertex) {
        // store it in the map
        varyingMap.set(name, index);
      } else {
        Debug.assert(varyingMap.has(name), `Fragment shader requires varying [${name}] but vertex shader does not generate it.`);
        index = varyingMap.get(name);
      }

      // generates: 'layout(location = 0) in vec4 position;'
      block += `layout(location = ${index}) ${op} ${type} ${name};\n`;
    });
    return block;
  }
  static processOuts(outsLines) {
    let block = '';
    outsLines.forEach((line, index) => {
      // generates: 'layout(location = 0) out vec4 gl_FragColor;'
      block += `layout(location = ${index}) out ${line};\n`;
    });
    return block;
  }
  static processAttributes(attributeLines, shaderDefinitionAttributes) {
    let block = '';
    const usedLocations = {};
    attributeLines.forEach(line => {
      const words = ShaderProcessor.splitToWords(line);
      const type = words[0];
      const name = words[1];
      if (shaderDefinitionAttributes.hasOwnProperty(name)) {
        const semantic = shaderDefinitionAttributes[name];
        const location = semanticToLocation[semantic];
        Debug.assert(!usedLocations.hasOwnProperty(location), `WARNING: Two vertex attributes are mapped to the same location in a shader: ${usedLocations[location]} and ${semantic}`);
        usedLocations[location] = semantic;

        // generates: 'layout(location = 0) in vec4 position;'
        block += `layout(location = ${location}) in ${type} ${name};\n`;
      }
    });
    return block;
  }
  static splitToWords(line) {
    // remove any double spaces
    line = line.replace(/\s+/g, ' ').trim();
    return line.split(' ');
  }
  static cutOut(src, start, end, replacement) {
    return src.substring(0, start) + replacement + src.substring(end);
  }
}

export { ShaderProcessor };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLXByb2Nlc3Nvci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci1wcm9jZXNzb3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7XG4gICAgQklOREdST1VQX01FU0gsIHVuaWZvcm1UeXBlVG9OYW1lLCBzZW1hbnRpY1RvTG9jYXRpb24sXG4gICAgU0hBREVSU1RBR0VfVkVSVEVYLCBTSEFERVJTVEFHRV9GUkFHTUVOVCxcbiAgICBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSxcbiAgICBTQU1QTEVUWVBFX0ZMT0FULCBTQU1QTEVUWVBFX0RFUFRILCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCxcbiAgICBURVhUVVJFRElNRU5TSU9OXzJELCBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZLCBURVhUVVJFRElNRU5TSU9OX0NVQkUsIFRFWFRVUkVESU1FTlNJT05fM0Rcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUZvcm1hdCwgVW5pZm9ybUJ1ZmZlckZvcm1hdCB9IGZyb20gJy4vdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJztcbmltcG9ydCB7IEJpbmRHcm91cEZvcm1hdCwgQmluZEJ1ZmZlckZvcm1hdCwgQmluZFRleHR1cmVGb3JtYXQgfSBmcm9tICcuL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJztcblxuLy8gYWNjZXB0ZWQga2V5d29yZHNcbi8vIFRPRE86ICdvdXQnIGtleXdvcmQgaXMgbm90IGluIHRoZSBsaXN0LCBhcyBoYW5kbGluZyBpdCBpcyBtb3JlIGNvbXBsaWNhdGVkIGR1ZVxuLy8gdG8gJ291dCcga2V5d29yZCBhbHNvIGJlaW5nIHVzZWQgdG8gbWFyayBvdXRwdXQgb25seSBmdW5jdGlvbiBwYXJhbWV0ZXJzLlxuY29uc3QgS0VZV09SRCA9IC9bIFxcdF0qKFxcYmF0dHJpYnV0ZVxcYnxcXGJ2YXJ5aW5nXFxifFxcYnVuaWZvcm1cXGIpL2c7XG5cbi8vIG1hdGNoICdhdHRyaWJ1dGUnIGFuZCBhbnl0aGluZyBlbHNlIHRpbGwgJzsnXG5jb25zdCBLRVlXT1JEX0xJTkUgPSAvKFxcYmF0dHJpYnV0ZVxcYnxcXGJ2YXJ5aW5nXFxifFxcYm91dFxcYnxcXGJ1bmlmb3JtXFxiKVsgXFx0XSooW147XSspKFs7XSspL2c7XG5cbi8vIG1hcmtlciBmb3IgYSBwbGFjZSBpbiB0aGUgc291cmNlIGNvZGUgdG8gYmUgcmVwbGFjZWQgYnkgY29kZVxuY29uc3QgTUFSS0VSID0gJ0BAQCc7XG5cbi8vIGFuIGFycmF5IGlkZW50aWZpZXIsIGZvciBleGFtcGxlICdkYXRhWzRdJyAtIGdyb3VwIDEgaXMgJ2RhdGEnLCBncm91cCAyIGlzIGV2ZXJ5dGhpbmcgaW4gYnJhY2tldHM6ICc0J1xuY29uc3QgQVJSQVlfSURFTlRJRklFUiA9IC8oW1xcdy1dKylcXFsoLio/KVxcXS87XG5cbmNvbnN0IHByZWNpc2lvblF1YWxpZmllcnMgPSBuZXcgU2V0KFsnaGlnaHAnLCAnbWVkaXVtcCcsICdsb3dwJ10pO1xuY29uc3Qgc2hhZG93U2FtcGxlcnMgPSBuZXcgU2V0KFsnc2FtcGxlcjJEU2hhZG93JywgJ3NhbXBsZXJDdWJlU2hhZG93J10pO1xuY29uc3QgdGV4dHVyZURpbWVuc2lvbnMgPSB7XG4gICAgc2FtcGxlcjJEOiBURVhUVVJFRElNRU5TSU9OXzJELFxuICAgIHNhbXBsZXIzRDogVEVYVFVSRURJTUVOU0lPTl8zRCxcbiAgICBzYW1wbGVyQ3ViZTogVEVYVFVSRURJTUVOU0lPTl9DVUJFLFxuICAgIHNhbXBsZXJDdWJlU2hhZG93OiBURVhUVVJFRElNRU5TSU9OX0NVQkUsXG4gICAgc2FtcGxlcjJEU2hhZG93OiBURVhUVVJFRElNRU5TSU9OXzJELFxuICAgIHNhbXBsZXIyREFycmF5OiBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZLFxuICAgIHNhbXBsZXIyREFycmF5U2hhZG93OiBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZXG59O1xuXG5jbGFzcyBVbmlmb3JtTGluZSB7XG4gICAgY29uc3RydWN0b3IobGluZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gZXhhbXBsZTogYGxvd3AgdmVjNCB0aW50c1syICogNF1gXG4gICAgICAgIHRoaXMubGluZSA9IGxpbmU7XG5cbiAgICAgICAgLy8gc3BsaXQgdG8gd29yZHMgaGFuZGxpbmcgYW55IG51bWJlciBvZiBzcGFjZXNcbiAgICAgICAgY29uc3Qgd29yZHMgPSBsaW5lLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuXG4gICAgICAgIC8vIG9wdGlvbmFsIHByZWNpc2lvblxuICAgICAgICBpZiAocHJlY2lzaW9uUXVhbGlmaWVycy5oYXMod29yZHNbMF0pKSB7XG4gICAgICAgICAgICB0aGlzLnByZWNpc2lvbiA9IHdvcmRzLnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0eXBlXG4gICAgICAgIHRoaXMudHlwZSA9IHdvcmRzLnNoaWZ0KCk7XG5cbiAgICAgICAgaWYgKGxpbmUuaW5jbHVkZXMoJywnKSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYEEgY29tbWEgb24gYSB1bmlmb3JtIGxpbmUgaXMgbm90IHN1cHBvcnRlZCwgc3BsaXQgaXQgaW50byBtdWx0aXBsZSB1bmlmb3JtczogJHtsaW5lfWAsIHNoYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhcnJheSBvZiB1bmlmb3Jtc1xuICAgICAgICBpZiAobGluZS5pbmNsdWRlcygnWycpKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3QgPSB3b3Jkcy5qb2luKCcgJyk7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IEFSUkFZX0lERU5USUZJRVIuZXhlYyhyZXN0KTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChtYXRjaCk7XG5cbiAgICAgICAgICAgIHRoaXMubmFtZSA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgdGhpcy5hcnJheVNpemUgPSBOdW1iZXIobWF0Y2hbMl0pO1xuICAgICAgICAgICAgaWYgKGlzTmFOKHRoaXMuYXJyYXlTaXplKSkge1xuICAgICAgICAgICAgICAgIHNoYWRlci5mYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBPbmx5IG51bWVyaWNhbGx5IHNwZWNpZmllZCB1bmlmb3JtIGFycmF5IHNpemVzIGFyZSBzdXBwb3J0ZWQsIHRoaXMgdW5pZm9ybSBpcyBub3Qgc3VwcG9ydGVkOiAnJHtsaW5lfSdgLCBzaGFkZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIHNpbXBsZSB1bmlmb3JtXG4gICAgICAgICAgICB0aGlzLm5hbWUgPSB3b3Jkcy5zaGlmdCgpO1xuICAgICAgICAgICAgdGhpcy5hcnJheVNpemUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pc1NhbXBsZXIgPSB0aGlzLnR5cGUuaW5kZXhPZignc2FtcGxlcicpICE9PSAtMTtcbiAgICB9XG59XG5cbi8qKlxuICogUHVyZSBzdGF0aWMgY2xhc3MgaW1wbGVtZW50aW5nIHByb2Nlc3Npbmcgb2YgR0xTTCBzaGFkZXJzLiBJdCBhbGxvY2F0ZXMgZml4ZWQgbG9jYXRpb25zIGZvclxuICogYXR0cmlidXRlcywgYW5kIGhhbmRsZXMgY29udmVyc2lvbiBvZiB1bmlmb3JtcyB0byB1bmlmb3JtIGJ1ZmZlcnMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBTaGFkZXJQcm9jZXNzb3Ige1xuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgdGhlIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzaGFkZXJEZWZpbml0aW9uIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IC0gVGhlIHByb2Nlc3NlZCBzaGFkZXIgZGF0YS5cbiAgICAgKi9cbiAgICBzdGF0aWMgcnVuKGRldmljZSwgc2hhZGVyRGVmaW5pdGlvbiwgc2hhZGVyKSB7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtNYXA8c3RyaW5nLCBudW1iZXI+fSAqL1xuICAgICAgICBjb25zdCB2YXJ5aW5nTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIGV4dHJhY3QgbGluZXMgb2YgaW50ZXJlc3RzIGZyb20gYm90aCBzaGFkZXJzXG4gICAgICAgIGNvbnN0IHZlcnRleEV4dHJhY3RlZCA9IFNoYWRlclByb2Nlc3Nvci5leHRyYWN0KHNoYWRlckRlZmluaXRpb24udnNoYWRlcik7XG4gICAgICAgIGNvbnN0IGZyYWdtZW50RXh0cmFjdGVkID0gU2hhZGVyUHJvY2Vzc29yLmV4dHJhY3Qoc2hhZGVyRGVmaW5pdGlvbi5mc2hhZGVyKTtcblxuICAgICAgICAvLyBWUyAtIGNvbnZlcnQgYSBsaXN0IG9mIGF0dHJpYnV0ZXMgdG8gYSBzaGFkZXIgYmxvY2sgd2l0aCBmaXhlZCBsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgYXR0cmlidXRlc0Jsb2NrID0gU2hhZGVyUHJvY2Vzc29yLnByb2Nlc3NBdHRyaWJ1dGVzKHZlcnRleEV4dHJhY3RlZC5hdHRyaWJ1dGVzLCBzaGFkZXJEZWZpbml0aW9uLmF0dHJpYnV0ZXMpO1xuXG4gICAgICAgIC8vIFZTIC0gY29udmVydCBhIGxpc3Qgb2YgdmFyeWluZ3MgdG8gYSBzaGFkZXIgYmxvY2tcbiAgICAgICAgY29uc3QgdmVydGV4VmFyeWluZ3NCbG9jayA9IFNoYWRlclByb2Nlc3Nvci5wcm9jZXNzVmFyeWluZ3ModmVydGV4RXh0cmFjdGVkLnZhcnlpbmdzLCB2YXJ5aW5nTWFwLCB0cnVlKTtcblxuICAgICAgICAvLyBGUyAtIGNvbnZlcnQgYSBsaXN0IG9mIHZhcnlpbmdzIHRvIGEgc2hhZGVyIGJsb2NrXG4gICAgICAgIGNvbnN0IGZyYWdtZW50VmFyeWluZ3NCbG9jayA9IFNoYWRlclByb2Nlc3Nvci5wcm9jZXNzVmFyeWluZ3MoZnJhZ21lbnRFeHRyYWN0ZWQudmFyeWluZ3MsIHZhcnlpbmdNYXAsIGZhbHNlKTtcblxuICAgICAgICAvLyBGUyAtIGNvbnZlcnQgYSBsaXN0IG9mIG91dHB1dHMgdG8gYSBzaGFkZXIgYmxvY2tcbiAgICAgICAgY29uc3Qgb3V0QmxvY2sgPSBTaGFkZXJQcm9jZXNzb3IucHJvY2Vzc091dHMoZnJhZ21lbnRFeHRyYWN0ZWQub3V0cyk7XG5cbiAgICAgICAgLy8gdW5pZm9ybXMgLSBtZXJnZSB2ZXJ0ZXggYW5kIGZyYWdtZW50IHVuaWZvcm1zLCBhbmQgY3JlYXRlIHNoYXJlZCB1bmlmb3JtIGJ1ZmZlcnNcbiAgICAgICAgLy8gTm90ZSB0aGF0IGFzIGJvdGggdmVydGV4IGFuZCBmcmFnbWVudCBjYW4gZGVjbGFyZSB0aGUgc2FtZSB1bmlmb3JtLCB3ZSBuZWVkIHRvIHJlbW92ZSBkdXBsaWNhdGVzXG4gICAgICAgIGNvbnN0IGNvbmNhdFVuaWZvcm1zID0gdmVydGV4RXh0cmFjdGVkLnVuaWZvcm1zLmNvbmNhdChmcmFnbWVudEV4dHJhY3RlZC51bmlmb3Jtcyk7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zID0gQXJyYXkuZnJvbShuZXcgU2V0KGNvbmNhdFVuaWZvcm1zKSk7XG5cbiAgICAgICAgLy8gcGFyc2UgdW5pZm9ybSBsaW5lc1xuICAgICAgICBjb25zdCBwYXJzZWRVbmlmb3JtcyA9IHVuaWZvcm1zLm1hcChsaW5lID0+IG5ldyBVbmlmb3JtTGluZShsaW5lLCBzaGFkZXIpKTtcblxuICAgICAgICAvLyB2YWxpZGF0aW9uIC0gYXMgdW5pZm9ybXMgZ28gdG8gYSBzaGFyZWQgdW5pZm9ybSBidWZmZXIsIHZlcnRleCBhbmQgZnJhZ21lbnQgdmVyc2lvbnMgbmVlZCB0byBtYXRjaFxuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgIHBhcnNlZFVuaWZvcm1zLmZvckVhY2goKHVuaSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gbWFwLmdldCh1bmkubmFtZSk7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCFleGlzdGluZywgYFZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycyBjYW5ub3QgdXNlIHRoZSBzYW1lIHVuaWZvcm0gbmFtZSB3aXRoIGRpZmZlcmVudCB0eXBlczogJyR7ZXhpc3Rpbmd9JyBhbmQgJyR7dW5pLmxpbmV9J2AsIHNoYWRlcik7XG4gICAgICAgICAgICAgICAgbWFwLnNldCh1bmkubmFtZSwgdW5pLmxpbmUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB1bmlmb3Jtc0RhdGEgPSBTaGFkZXJQcm9jZXNzb3IucHJvY2Vzc1VuaWZvcm1zKGRldmljZSwgcGFyc2VkVW5pZm9ybXMsIHNoYWRlckRlZmluaXRpb24ucHJvY2Vzc2luZ09wdGlvbnMsIHNoYWRlcik7XG5cbiAgICAgICAgLy8gVlMgLSBpbnNlcnQgdGhlIGJsb2NrcyB0byB0aGUgc291cmNlXG4gICAgICAgIGNvbnN0IHZCbG9jayA9IGF0dHJpYnV0ZXNCbG9jayArICdcXG4nICsgdmVydGV4VmFyeWluZ3NCbG9jayArICdcXG4nICsgdW5pZm9ybXNEYXRhLmNvZGU7XG4gICAgICAgIGNvbnN0IHZzaGFkZXIgPSB2ZXJ0ZXhFeHRyYWN0ZWQuc3JjLnJlcGxhY2UoTUFSS0VSLCB2QmxvY2spO1xuXG4gICAgICAgIC8vIEZTIC0gaW5zZXJ0IHRoZSBibG9ja3MgdG8gdGhlIHNvdXJjZVxuICAgICAgICBjb25zdCBmQmxvY2sgPSBmcmFnbWVudFZhcnlpbmdzQmxvY2sgKyAnXFxuJyArIG91dEJsb2NrICsgJ1xcbicgKyB1bmlmb3Jtc0RhdGEuY29kZTtcbiAgICAgICAgY29uc3QgZnNoYWRlciA9IGZyYWdtZW50RXh0cmFjdGVkLnNyYy5yZXBsYWNlKE1BUktFUiwgZkJsb2NrKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdnNoYWRlcjogdnNoYWRlcixcbiAgICAgICAgICAgIGZzaGFkZXI6IGZzaGFkZXIsXG4gICAgICAgICAgICBtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDogdW5pZm9ybXNEYXRhLm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0LFxuICAgICAgICAgICAgbWVzaEJpbmRHcm91cEZvcm1hdDogdW5pZm9ybXNEYXRhLm1lc2hCaW5kR3JvdXBGb3JtYXRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBFeHRyYWN0IHJlcXVpcmVkIGluZm9ybWF0aW9uIGZyb20gdGhlIHNoYWRlciBzb3VyY2UgY29kZS5cbiAgICBzdGF0aWMgZXh0cmFjdChzcmMpIHtcblxuICAgICAgICAvLyBjb2xsZWN0ZWQgZGF0YVxuICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0gW107XG4gICAgICAgIGNvbnN0IHZhcnlpbmdzID0gW107XG4gICAgICAgIGNvbnN0IG91dHMgPSBbXTtcbiAgICAgICAgY29uc3QgdW5pZm9ybXMgPSBbXTtcblxuICAgICAgICAvLyByZXBsYWNlbWVudCBtYXJrZXIgLSBtYXJrIGEgZmlyc3QgcmVwbGFjZW1lbnQgcGxhY2UsIHRoaXMgaXMgd2hlcmUgY29kZVxuICAgICAgICAvLyBibG9ja3MgYXJlIGluamVjdGVkIGxhdGVyXG4gICAgICAgIGxldCByZXBsYWNlbWVudCA9IGAke01BUktFUn1cXG5gO1xuXG4gICAgICAgIC8vIGV4dHJhY3QgcmVsZXZhbnQgcGFydHMgb2YgdGhlIHNoYWRlclxuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSBLRVlXT1JELmV4ZWMoc3JjKSkgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgY29uc3Qga2V5d29yZCA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgc3dpdGNoIChrZXl3b3JkKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnYXR0cmlidXRlJzpcbiAgICAgICAgICAgICAgICBjYXNlICd2YXJ5aW5nJzpcbiAgICAgICAgICAgICAgICBjYXNlICd1bmlmb3JtJzpcbiAgICAgICAgICAgICAgICBjYXNlICdvdXQnOiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVhZCB0aGUgbGluZVxuICAgICAgICAgICAgICAgICAgICBLRVlXT1JEX0xJTkUubGFzdEluZGV4ID0gbWF0Y2guaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVNYXRjaCA9IEtFWVdPUkRfTElORS5leGVjKHNyYyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleXdvcmQgPT09ICdhdHRyaWJ1dGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2gobGluZU1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXl3b3JkID09PSAndmFyeWluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcnlpbmdzLnB1c2gobGluZU1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXl3b3JkID09PSAnb3V0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cy5wdXNoKGxpbmVNYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5d29yZCA9PT0gJ3VuaWZvcm0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlmb3Jtcy5wdXNoKGxpbmVNYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBjdXQgaXQgb3V0XG4gICAgICAgICAgICAgICAgICAgIHNyYyA9IFNoYWRlclByb2Nlc3Nvci5jdXRPdXQoc3JjLCBtYXRjaC5pbmRleCwgS0VZV09SRF9MSU5FLmxhc3RJbmRleCwgcmVwbGFjZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICBLRVlXT1JELmxhc3RJbmRleCA9IG1hdGNoLmluZGV4ICsgcmVwbGFjZW1lbnQubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgcGxhY2UgYSBzaW5nbGUgcmVwbGFjZW1lbnQgbWFya2VyXG4gICAgICAgICAgICAgICAgICAgIHJlcGxhY2VtZW50ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzcmMsXG4gICAgICAgICAgICBhdHRyaWJ1dGVzLFxuICAgICAgICAgICAgdmFyeWluZ3MsXG4gICAgICAgICAgICBvdXRzLFxuICAgICAgICAgICAgdW5pZm9ybXNcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBsaW5lcyB3aXRoIHVuaWZvcm1zLiBUaGUgZnVuY3Rpb24gcmVjZWl2ZXMgdGhlIGxpbmVzIGNvbnRhaW5pbmcgYWxsIHVuaWZvcm1zLFxuICAgICAqIGJvdGggbnVtZXJpY2FsIGFzIHdlbGwgYXMgdGV4dHVyZXMvc2FtcGxlcnMuIFRoZSBmdW5jdGlvbiBhbHNvIHJlY2VpdmVzIHRoZSBmb3JtYXQgb2YgdW5pZm9ybVxuICAgICAqIGJ1ZmZlcnMgKG51bWVyaWNhbCkgYW5kIGJpbmQgZ3JvdXBzICh0ZXh0dXJlcykgZm9yIHZpZXcgYW5kIG1hdGVyaWFsIGxldmVsLiBBbGwgdW5pZm9ybXMgdGhhdFxuICAgICAqIG1hdGNoIGFueSBvZiB0aG9zZSBhcmUgaWdub3JlZCwgYXMgdGhvc2Ugd291bGQgYmUgc3VwcGxpZWQgYnkgdmlldyAvIG1hdGVyaWFsIGxldmVsIGJ1ZmZlcnMuXG4gICAgICogQWxsIGxlZnRvdmVyIHVuaWZvcm1zIGNyZWF0ZSB1bmlmb3JtIGJ1ZmZlciBhbmQgYmluZCBncm91cCBmb3IgdGhlIG1lc2ggaXRzZWxmLCBjb250YWluaW5nXG4gICAgICogdW5pZm9ybXMgdGhhdCBjaGFuZ2Ugb24gdGhlIGxldmVsIG9mIHRoZSBtZXNoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtBcnJheTxVbmlmb3JtTGluZT59IHVuaWZvcm1zIC0gTGluZXMgY29udGFpbmluZyB1bmlmb3Jtcy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zaGFkZXItcHJvY2Vzc29yLW9wdGlvbnMuanMnKS5TaGFkZXJQcm9jZXNzb3JPcHRpb25zfSBwcm9jZXNzaW5nT3B0aW9ucyAtXG4gICAgICogVW5pZm9ybSBmb3JtYXRzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IC0gVGhlIHVuaWZvcm0gZGF0YS4gUmV0dXJucyBhIHNoYWRlciBjb2RlIGJsb2NrIGNvbnRhaW5pbmcgdW5pZm9ybXMsIHRvIGJlXG4gICAgICogaW5zZXJ0ZWQgaW50byB0aGUgc2hhZGVyLCBhcyB3ZWxsIGFzIGdlbmVyYXRlZCB1bmlmb3JtIGZvcm1hdCBzdHJ1Y3R1cmVzIGZvciB0aGUgbWVzaCBsZXZlbC5cbiAgICAgKi9cbiAgICBzdGF0aWMgcHJvY2Vzc1VuaWZvcm1zKGRldmljZSwgdW5pZm9ybXMsIHByb2Nlc3NpbmdPcHRpb25zLCBzaGFkZXIpIHtcblxuICAgICAgICAvLyBzcGxpdCB1bmlmb3JtIGxpbmVzIGludG8gc2FtcGxlcnMgYW5kIHRoZSByZXN0XG4gICAgICAgIC8qKiBAdHlwZSB7QXJyYXk8VW5pZm9ybUxpbmU+fSAqL1xuICAgICAgICBjb25zdCB1bmlmb3JtTGluZXNTYW1wbGVycyA9IFtdO1xuICAgICAgICAvKiogQHR5cGUge0FycmF5PFVuaWZvcm1MaW5lPn0gKi9cbiAgICAgICAgY29uc3QgdW5pZm9ybUxpbmVzTm9uU2FtcGxlcnMgPSBbXTtcbiAgICAgICAgdW5pZm9ybXMuZm9yRWFjaCgodW5pZm9ybSkgPT4ge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0uaXNTYW1wbGVyKSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybUxpbmVzU2FtcGxlcnMucHVzaCh1bmlmb3JtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybUxpbmVzTm9uU2FtcGxlcnMucHVzaCh1bmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gYnVpbGQgbWVzaCB1bmlmb3JtIGJ1ZmZlciBmb3JtYXRcbiAgICAgICAgY29uc3QgbWVzaFVuaWZvcm1zID0gW107XG4gICAgICAgIHVuaWZvcm1MaW5lc05vblNhbXBsZXJzLmZvckVhY2goKHVuaWZvcm0pID0+IHtcbiAgICAgICAgICAgIC8vIHVuaWZvcm1zIG5vdCBhbHJlYWR5IGluIHN1cHBsaWVkIHVuaWZvcm0gYnVmZmVycyBnbyB0byB0aGUgbWVzaCBidWZmZXJcbiAgICAgICAgICAgIGlmICghcHJvY2Vzc2luZ09wdGlvbnMuaGFzVW5pZm9ybSh1bmlmb3JtLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5pZm9ybVR5cGUgPSB1bmlmb3JtVHlwZVRvTmFtZS5pbmRleE9mKHVuaWZvcm0udHlwZSk7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHVuaWZvcm1UeXBlID49IDAsIGBVbmlmb3JtIHR5cGUgJHt1bmlmb3JtLnR5cGV9IGlzIG5vdCByZWNvZ25pemVkIG9uIGxpbmUgWyR7dW5pZm9ybS5saW5lfV1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmlmb3JtRm9ybWF0ID0gbmV3IFVuaWZvcm1Gb3JtYXQodW5pZm9ybS5uYW1lLCB1bmlmb3JtVHlwZSwgdW5pZm9ybS5hcnJheVNpemUpO1xuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCghdW5pZm9ybUZvcm1hdC5pbnZhbGlkLCBgSW52YWxpZCB1bmlmb3JtIGxpbmU6ICR7dW5pZm9ybS5saW5lfWAsIHNoYWRlcik7XG4gICAgICAgICAgICAgICAgbWVzaFVuaWZvcm1zLnB1c2godW5pZm9ybUZvcm1hdCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHZhbGlkYXRlIHR5cGVzIGluIGVsc2VcblxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQgPSBtZXNoVW5pZm9ybXMubGVuZ3RoID8gbmV3IFVuaWZvcm1CdWZmZXJGb3JtYXQoZGV2aWNlLCBtZXNoVW5pZm9ybXMpIDogbnVsbDtcblxuICAgICAgICAvLyBidWlsZCBtZXNoIGJpbmQgZ3JvdXAgZm9ybWF0IC0gc3RhcnQgd2l0aCB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICBjb25zdCBidWZmZXJGb3JtYXRzID0gW107XG4gICAgICAgIGlmIChtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCkge1xuICAgICAgICAgICAgLy8gVE9ETzogd2UgY291bGQgb3B0aW1pemUgdmlzaWJpbGl0eSB0byBvbmx5IHN0YWdlcyB0aGF0IHVzZSBhbnkgb2YgdGhlIGRhdGFcbiAgICAgICAgICAgIGJ1ZmZlckZvcm1hdHMucHVzaChuZXcgQmluZEJ1ZmZlckZvcm1hdChVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSwgU0hBREVSU1RBR0VfVkVSVEVYIHwgU0hBREVSU1RBR0VfRlJBR01FTlQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZCB0ZXh0dXJlcyB1bmlmb3Jtc1xuICAgICAgICBjb25zdCB0ZXh0dXJlRm9ybWF0cyA9IFtdO1xuICAgICAgICB1bmlmb3JtTGluZXNTYW1wbGVycy5mb3JFYWNoKCh1bmlmb3JtKSA9PiB7XG4gICAgICAgICAgICAvLyB1bm1hdGNoZWQgdGV4dHVyZSB1bmlmb3JtcyBnbyB0byBtZXNoIGJsb2NrXG4gICAgICAgICAgICBpZiAoIXByb2Nlc3NpbmdPcHRpb25zLmhhc1RleHR1cmUodW5pZm9ybS5uYW1lKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gc2FtcGxlIHR5cGVcbiAgICAgICAgICAgICAgICAvLyBXZWJHcHUgZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgZmlsdGVyZWQgZmxvYXQgZm9ybWF0IHRleHR1cmVzLCBhbmQgc28gd2UgbWFwIHRoZW0gdG8gdW5maWx0ZXJhYmxlIHR5cGVcbiAgICAgICAgICAgICAgICAvLyBhcyB3ZSBzYW1wbGUgdGhlbSB3aXRob3V0IGZpbHRlcmluZyBhbnl3YXlzXG4gICAgICAgICAgICAgICAgbGV0IHNhbXBsZVR5cGUgPSBTQU1QTEVUWVBFX0ZMT0FUO1xuICAgICAgICAgICAgICAgIGlmICh1bmlmb3JtLnByZWNpc2lvbiA9PT0gJ2hpZ2hwJylcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUO1xuICAgICAgICAgICAgICAgIGlmIChzaGFkb3dTYW1wbGVycy5oYXModW5pZm9ybS50eXBlKSlcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfREVQVEg7XG5cbiAgICAgICAgICAgICAgICAvLyBkaW1lbnNpb25cbiAgICAgICAgICAgICAgICBjb25zdCBkaW1lbnNpb24gPSB0ZXh0dXJlRGltZW5zaW9uc1t1bmlmb3JtLnR5cGVdO1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogd2UgY291bGQgb3B0aW1pemUgdmlzaWJpbGl0eSB0byBvbmx5IHN0YWdlcyB0aGF0IHVzZSBhbnkgb2YgdGhlIGRhdGFcbiAgICAgICAgICAgICAgICB0ZXh0dXJlRm9ybWF0cy5wdXNoKG5ldyBCaW5kVGV4dHVyZUZvcm1hdCh1bmlmb3JtLm5hbWUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5ULCBkaW1lbnNpb24sIHNhbXBsZVR5cGUpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdmFsaWRhdGUgdHlwZXMgaW4gZWxzZVxuXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBtZXNoQmluZEdyb3VwRm9ybWF0ID0gbmV3IEJpbmRHcm91cEZvcm1hdChkZXZpY2UsIGJ1ZmZlckZvcm1hdHMsIHRleHR1cmVGb3JtYXRzKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSBjb2RlIGZvciB1bmlmb3JtIGJ1ZmZlcnNcbiAgICAgICAgbGV0IGNvZGUgPSAnJztcbiAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnMudW5pZm9ybUZvcm1hdHMuZm9yRWFjaCgoZm9ybWF0LCBiaW5kR3JvdXBJbmRleCkgPT4ge1xuICAgICAgICAgICAgaWYgKGZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gZm9ybWF0LmdldFNoYWRlckRlY2xhcmF0aW9uKGJpbmRHcm91cEluZGV4LCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gYW5kIGFsc28gZm9yIGdlbmVyYXRlZCBtZXNoIGZvcm1hdCwgd2hpY2ggaXMgYXQgdGhlIHNsb3QgMCBvZiB0aGUgYmluZCBncm91cFxuICAgICAgICBpZiAobWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQuZ2V0U2hhZGVyRGVjbGFyYXRpb24oQklOREdST1VQX01FU0gsIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgY29kZSBmb3IgdGV4dHVyZXNcbiAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnMuYmluZEdyb3VwRm9ybWF0cy5mb3JFYWNoKChmb3JtYXQsIGJpbmRHcm91cEluZGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBmb3JtYXQuZ2V0U2hhZGVyRGVjbGFyYXRpb25UZXh0dXJlcyhiaW5kR3JvdXBJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGFuZCBhbHNvIGZvciBnZW5lcmF0ZWQgbWVzaCBmb3JtYXRcbiAgICAgICAgY29kZSArPSBtZXNoQmluZEdyb3VwRm9ybWF0LmdldFNoYWRlckRlY2xhcmF0aW9uVGV4dHVyZXMoQklOREdST1VQX01FU0gpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQsXG4gICAgICAgICAgICBtZXNoQmluZEdyb3VwRm9ybWF0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgc3RhdGljIHByb2Nlc3NWYXJ5aW5ncyh2YXJ5aW5nTGluZXMsIHZhcnlpbmdNYXAsIGlzVmVydGV4KSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBjb25zdCBvcCA9IGlzVmVydGV4ID8gJ291dCcgOiAnaW4nO1xuICAgICAgICB2YXJ5aW5nTGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmRzID0gU2hhZGVyUHJvY2Vzc29yLnNwbGl0VG9Xb3JkcyhsaW5lKTtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSB3b3Jkc1swXTtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSB3b3Jkc1sxXTtcblxuICAgICAgICAgICAgaWYgKGlzVmVydGV4KSB7XG4gICAgICAgICAgICAgICAgLy8gc3RvcmUgaXQgaW4gdGhlIG1hcFxuICAgICAgICAgICAgICAgIHZhcnlpbmdNYXAuc2V0KG5hbWUsIGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZhcnlpbmdNYXAuaGFzKG5hbWUpLCBgRnJhZ21lbnQgc2hhZGVyIHJlcXVpcmVzIHZhcnlpbmcgWyR7bmFtZX1dIGJ1dCB2ZXJ0ZXggc2hhZGVyIGRvZXMgbm90IGdlbmVyYXRlIGl0LmApO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gdmFyeWluZ01hcC5nZXQobmFtZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIGluIHZlYzQgcG9zaXRpb247J1xuICAgICAgICAgICAgYmxvY2sgKz0gYGxheW91dChsb2NhdGlvbiA9ICR7aW5kZXh9KSAke29wfSAke3R5cGV9ICR7bmFtZX07XFxuYDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBibG9jaztcbiAgICB9XG5cbiAgICBzdGF0aWMgcHJvY2Vzc091dHMob3V0c0xpbmVzKSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBvdXRzTGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIG91dCB2ZWM0IGdsX0ZyYWdDb2xvcjsnXG4gICAgICAgICAgICBibG9jayArPSBgbGF5b3V0KGxvY2F0aW9uID0gJHtpbmRleH0pIG91dCAke2xpbmV9O1xcbmA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgfVxuXG4gICAgc3RhdGljIHByb2Nlc3NBdHRyaWJ1dGVzKGF0dHJpYnV0ZUxpbmVzLCBzaGFkZXJEZWZpbml0aW9uQXR0cmlidXRlcykge1xuICAgICAgICBsZXQgYmxvY2sgPSAnJztcbiAgICAgICAgY29uc3QgdXNlZExvY2F0aW9ucyA9IHt9O1xuICAgICAgICBhdHRyaWJ1dGVMaW5lcy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgICAgICAgICBjb25zdCB3b3JkcyA9IFNoYWRlclByb2Nlc3Nvci5zcGxpdFRvV29yZHMobGluZSk7XG4gICAgICAgICAgICBjb25zdCB0eXBlID0gd29yZHNbMF07XG4gICAgICAgICAgICBjb25zdCBuYW1lID0gd29yZHNbMV07XG5cbiAgICAgICAgICAgIGlmIChzaGFkZXJEZWZpbml0aW9uQXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlbWFudGljID0gc2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXNbbmFtZV07XG4gICAgICAgICAgICAgICAgY29uc3QgbG9jYXRpb24gPSBzZW1hbnRpY1RvTG9jYXRpb25bc2VtYW50aWNdO1xuXG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCF1c2VkTG9jYXRpb25zLmhhc093blByb3BlcnR5KGxvY2F0aW9uKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYFdBUk5JTkc6IFR3byB2ZXJ0ZXggYXR0cmlidXRlcyBhcmUgbWFwcGVkIHRvIHRoZSBzYW1lIGxvY2F0aW9uIGluIGEgc2hhZGVyOiAke3VzZWRMb2NhdGlvbnNbbG9jYXRpb25dfSBhbmQgJHtzZW1hbnRpY31gKTtcbiAgICAgICAgICAgICAgICB1c2VkTG9jYXRpb25zW2xvY2F0aW9uXSA9IHNlbWFudGljO1xuXG4gICAgICAgICAgICAgICAgLy8gZ2VuZXJhdGVzOiAnbGF5b3V0KGxvY2F0aW9uID0gMCkgaW4gdmVjNCBwb3NpdGlvbjsnXG4gICAgICAgICAgICAgICAgYmxvY2sgKz0gYGxheW91dChsb2NhdGlvbiA9ICR7bG9jYXRpb259KSBpbiAke3R5cGV9ICR7bmFtZX07XFxuYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBibG9jaztcbiAgICB9XG5cbiAgICBzdGF0aWMgc3BsaXRUb1dvcmRzKGxpbmUpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFueSBkb3VibGUgc3BhY2VzXG4gICAgICAgIGxpbmUgPSBsaW5lLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCk7XG4gICAgICAgIHJldHVybiBsaW5lLnNwbGl0KCcgJyk7XG4gICAgfVxuXG4gICAgc3RhdGljIGN1dE91dChzcmMsIHN0YXJ0LCBlbmQsIHJlcGxhY2VtZW50KSB7XG4gICAgICAgIHJldHVybiBzcmMuc3Vic3RyaW5nKDAsIHN0YXJ0KSArIHJlcGxhY2VtZW50ICsgc3JjLnN1YnN0cmluZyhlbmQpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2hhZGVyUHJvY2Vzc29yIH07XG4iXSwibmFtZXMiOlsiS0VZV09SRCIsIktFWVdPUkRfTElORSIsIk1BUktFUiIsIkFSUkFZX0lERU5USUZJRVIiLCJwcmVjaXNpb25RdWFsaWZpZXJzIiwiU2V0Iiwic2hhZG93U2FtcGxlcnMiLCJ0ZXh0dXJlRGltZW5zaW9ucyIsInNhbXBsZXIyRCIsIlRFWFRVUkVESU1FTlNJT05fMkQiLCJzYW1wbGVyM0QiLCJURVhUVVJFRElNRU5TSU9OXzNEIiwic2FtcGxlckN1YmUiLCJURVhUVVJFRElNRU5TSU9OX0NVQkUiLCJzYW1wbGVyQ3ViZVNoYWRvdyIsInNhbXBsZXIyRFNoYWRvdyIsInNhbXBsZXIyREFycmF5IiwiVEVYVFVSRURJTUVOU0lPTl8yRF9BUlJBWSIsInNhbXBsZXIyREFycmF5U2hhZG93IiwiVW5pZm9ybUxpbmUiLCJjb25zdHJ1Y3RvciIsImxpbmUiLCJzaGFkZXIiLCJ3b3JkcyIsInRyaW0iLCJzcGxpdCIsImhhcyIsInByZWNpc2lvbiIsInNoaWZ0IiwidHlwZSIsImluY2x1ZGVzIiwiRGVidWciLCJlcnJvciIsInJlc3QiLCJqb2luIiwibWF0Y2giLCJleGVjIiwiYXNzZXJ0IiwibmFtZSIsImFycmF5U2l6ZSIsIk51bWJlciIsImlzTmFOIiwiZmFpbGVkIiwiaXNTYW1wbGVyIiwiaW5kZXhPZiIsIlNoYWRlclByb2Nlc3NvciIsInJ1biIsImRldmljZSIsInNoYWRlckRlZmluaXRpb24iLCJ2YXJ5aW5nTWFwIiwiTWFwIiwidmVydGV4RXh0cmFjdGVkIiwiZXh0cmFjdCIsInZzaGFkZXIiLCJmcmFnbWVudEV4dHJhY3RlZCIsImZzaGFkZXIiLCJhdHRyaWJ1dGVzQmxvY2siLCJwcm9jZXNzQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJ2ZXJ0ZXhWYXJ5aW5nc0Jsb2NrIiwicHJvY2Vzc1ZhcnlpbmdzIiwidmFyeWluZ3MiLCJmcmFnbWVudFZhcnlpbmdzQmxvY2siLCJvdXRCbG9jayIsInByb2Nlc3NPdXRzIiwib3V0cyIsImNvbmNhdFVuaWZvcm1zIiwidW5pZm9ybXMiLCJjb25jYXQiLCJBcnJheSIsImZyb20iLCJwYXJzZWRVbmlmb3JtcyIsIm1hcCIsImNhbGwiLCJmb3JFYWNoIiwidW5pIiwiZXhpc3RpbmciLCJnZXQiLCJzZXQiLCJ1bmlmb3Jtc0RhdGEiLCJwcm9jZXNzVW5pZm9ybXMiLCJwcm9jZXNzaW5nT3B0aW9ucyIsInZCbG9jayIsImNvZGUiLCJzcmMiLCJyZXBsYWNlIiwiZkJsb2NrIiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwicmVwbGFjZW1lbnQiLCJrZXl3b3JkIiwibGFzdEluZGV4IiwiaW5kZXgiLCJsaW5lTWF0Y2giLCJwdXNoIiwiY3V0T3V0IiwibGVuZ3RoIiwidW5pZm9ybUxpbmVzU2FtcGxlcnMiLCJ1bmlmb3JtTGluZXNOb25TYW1wbGVycyIsInVuaWZvcm0iLCJtZXNoVW5pZm9ybXMiLCJoYXNVbmlmb3JtIiwidW5pZm9ybVR5cGUiLCJ1bmlmb3JtVHlwZVRvTmFtZSIsInVuaWZvcm1Gb3JtYXQiLCJVbmlmb3JtRm9ybWF0IiwiaW52YWxpZCIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJidWZmZXJGb3JtYXRzIiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJ0ZXh0dXJlRm9ybWF0cyIsImhhc1RleHR1cmUiLCJzYW1wbGVUeXBlIiwiU0FNUExFVFlQRV9GTE9BVCIsIlNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUIiwiU0FNUExFVFlQRV9ERVBUSCIsImRpbWVuc2lvbiIsIkJpbmRUZXh0dXJlRm9ybWF0IiwiQmluZEdyb3VwRm9ybWF0IiwidW5pZm9ybUZvcm1hdHMiLCJmb3JtYXQiLCJiaW5kR3JvdXBJbmRleCIsImdldFNoYWRlckRlY2xhcmF0aW9uIiwiQklOREdST1VQX01FU0giLCJiaW5kR3JvdXBGb3JtYXRzIiwiZ2V0U2hhZGVyRGVjbGFyYXRpb25UZXh0dXJlcyIsInZhcnlpbmdMaW5lcyIsImlzVmVydGV4IiwiYmxvY2siLCJvcCIsInNwbGl0VG9Xb3JkcyIsIm91dHNMaW5lcyIsImF0dHJpYnV0ZUxpbmVzIiwic2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMiLCJ1c2VkTG9jYXRpb25zIiwiaGFzT3duUHJvcGVydHkiLCJzZW1hbnRpYyIsImxvY2F0aW9uIiwic2VtYW50aWNUb0xvY2F0aW9uIiwic3RhcnQiLCJlbmQiLCJzdWJzdHJpbmciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFXQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxPQUFPLEdBQUcsZ0RBQWdELENBQUE7O0FBRWhFO0FBQ0EsTUFBTUMsWUFBWSxHQUFHLHFFQUFxRSxDQUFBOztBQUUxRjtBQUNBLE1BQU1DLE1BQU0sR0FBRyxLQUFLLENBQUE7O0FBRXBCO0FBQ0EsTUFBTUMsZ0JBQWdCLEdBQUcsbUJBQW1CLENBQUE7QUFFNUMsTUFBTUMsbUJBQW1CLEdBQUcsSUFBSUMsR0FBRyxDQUFDLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFBO0FBQ2pFLE1BQU1DLGNBQWMsR0FBRyxJQUFJRCxHQUFHLENBQUMsQ0FBQyxpQkFBaUIsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDLENBQUE7QUFDeEUsTUFBTUUsaUJBQWlCLEdBQUc7QUFDdEJDLEVBQUFBLFNBQVMsRUFBRUMsbUJBQW1CO0FBQzlCQyxFQUFBQSxTQUFTLEVBQUVDLG1CQUFtQjtBQUM5QkMsRUFBQUEsV0FBVyxFQUFFQyxxQkFBcUI7QUFDbENDLEVBQUFBLGlCQUFpQixFQUFFRCxxQkFBcUI7QUFDeENFLEVBQUFBLGVBQWUsRUFBRU4s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
