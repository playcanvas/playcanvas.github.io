/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { uniformTypeToName, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, BINDGROUP_MESH, semanticToLocation, TYPE_FLOAT32, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_2D_ARRAY, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, TYPE_INT8, TYPE_INT16, TYPE_INT32 } from './constants.js';
import { UniformFormat, UniformBufferFormat } from './uniform-buffer-format.js';
import { BindTextureFormat, BindGroupFormat, BindBufferFormat } from './bind-group-format.js';

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
      this.arraySize = 0;
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
    const attributesBlock = ShaderProcessor.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes, shaderDefinition.processingOptions);

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

  // extract count from type ('vec3' => 3, 'float' => 1)
  static getTypeCount(type) {
    const lastChar = type.substring(type.length - 1);
    const num = parseInt(lastChar, 10);
    return isNaN(num) ? 1 : num;
  }
  static processAttributes(attributeLines, shaderDefinitionAttributes, processingOptions) {
    let block = '';
    const usedLocations = {};
    attributeLines.forEach(line => {
      const words = ShaderProcessor.splitToWords(line);
      let type = words[0];
      let name = words[1];
      if (shaderDefinitionAttributes.hasOwnProperty(name)) {
        const semantic = shaderDefinitionAttributes[name];
        const location = semanticToLocation[semantic];
        Debug.assert(!usedLocations.hasOwnProperty(location), `WARNING: Two vertex attributes are mapped to the same location in a shader: ${usedLocations[location]} and ${semantic}`);
        usedLocations[location] = semantic;

        // if vertex format for this attribute is not of a float type, we need to adjust the attribute format, for example we convert
        //      attribute vec4 vertex_position;
        // to
        //      attribute ivec4 _private_vertex_position;
        //      vec4 vertex_position = vec4(_private_vertex_position);
        let copyCode;
        const element = processingOptions.getVertexElement(semantic);
        if (element) {
          const dataType = element.dataType;
          if (dataType !== TYPE_FLOAT32) {
            const attribNumElements = ShaderProcessor.getTypeCount(type);
            const newName = `_private_${name}`;

            // second line of new code, copy private (u)int type into vec type
            copyCode = `vec${attribNumElements} ${name} = vec${attribNumElements}(${newName});\n`;
            name = newName;

            // new attribute type, based on the vertex format element type, example: vec3 -> ivec3
            const isSignedType = dataType === TYPE_INT8 || dataType === TYPE_INT16 || dataType === TYPE_INT32;
            if (attribNumElements === 1) {
              type = isSignedType ? 'int' : 'uint';
            } else {
              type = isSignedType ? `ivec${attribNumElements}` : `uvec${attribNumElements}`;
            }
          }
        }

        // generates: 'layout(location = 0) in vec4 position;'
        block += `layout(location = ${location}) in ${type} ${name};\n`;
        if (copyCode) {
          block += copyCode;
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLXByb2Nlc3Nvci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci1wcm9jZXNzb3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7XG4gICAgQklOREdST1VQX01FU0gsIHVuaWZvcm1UeXBlVG9OYW1lLCBzZW1hbnRpY1RvTG9jYXRpb24sXG4gICAgU0hBREVSU1RBR0VfVkVSVEVYLCBTSEFERVJTVEFHRV9GUkFHTUVOVCxcbiAgICBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSxcbiAgICBTQU1QTEVUWVBFX0ZMT0FULCBTQU1QTEVUWVBFX0RFUFRILCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCxcbiAgICBURVhUVVJFRElNRU5TSU9OXzJELCBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZLCBURVhUVVJFRElNRU5TSU9OX0NVQkUsIFRFWFRVUkVESU1FTlNJT05fM0QsXG4gICAgVFlQRV9GTE9BVDMyLCBUWVBFX0lOVDgsIFRZUEVfSU5UMTYsIFRZUEVfSU5UMzJcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUZvcm1hdCwgVW5pZm9ybUJ1ZmZlckZvcm1hdCB9IGZyb20gJy4vdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJztcbmltcG9ydCB7IEJpbmRHcm91cEZvcm1hdCwgQmluZEJ1ZmZlckZvcm1hdCwgQmluZFRleHR1cmVGb3JtYXQgfSBmcm9tICcuL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJztcblxuLy8gYWNjZXB0ZWQga2V5d29yZHNcbi8vIFRPRE86ICdvdXQnIGtleXdvcmQgaXMgbm90IGluIHRoZSBsaXN0LCBhcyBoYW5kbGluZyBpdCBpcyBtb3JlIGNvbXBsaWNhdGVkIGR1ZVxuLy8gdG8gJ291dCcga2V5d29yZCBhbHNvIGJlaW5nIHVzZWQgdG8gbWFyayBvdXRwdXQgb25seSBmdW5jdGlvbiBwYXJhbWV0ZXJzLlxuY29uc3QgS0VZV09SRCA9IC9bIFxcdF0qKFxcYmF0dHJpYnV0ZVxcYnxcXGJ2YXJ5aW5nXFxifFxcYnVuaWZvcm1cXGIpL2c7XG5cbi8vIG1hdGNoICdhdHRyaWJ1dGUnIGFuZCBhbnl0aGluZyBlbHNlIHRpbGwgJzsnXG5jb25zdCBLRVlXT1JEX0xJTkUgPSAvKFxcYmF0dHJpYnV0ZVxcYnxcXGJ2YXJ5aW5nXFxifFxcYm91dFxcYnxcXGJ1bmlmb3JtXFxiKVsgXFx0XSooW147XSspKFs7XSspL2c7XG5cbi8vIG1hcmtlciBmb3IgYSBwbGFjZSBpbiB0aGUgc291cmNlIGNvZGUgdG8gYmUgcmVwbGFjZWQgYnkgY29kZVxuY29uc3QgTUFSS0VSID0gJ0BAQCc7XG5cbi8vIGFuIGFycmF5IGlkZW50aWZpZXIsIGZvciBleGFtcGxlICdkYXRhWzRdJyAtIGdyb3VwIDEgaXMgJ2RhdGEnLCBncm91cCAyIGlzIGV2ZXJ5dGhpbmcgaW4gYnJhY2tldHM6ICc0J1xuY29uc3QgQVJSQVlfSURFTlRJRklFUiA9IC8oW1xcdy1dKylcXFsoLio/KVxcXS87XG5cbmNvbnN0IHByZWNpc2lvblF1YWxpZmllcnMgPSBuZXcgU2V0KFsnaGlnaHAnLCAnbWVkaXVtcCcsICdsb3dwJ10pO1xuY29uc3Qgc2hhZG93U2FtcGxlcnMgPSBuZXcgU2V0KFsnc2FtcGxlcjJEU2hhZG93JywgJ3NhbXBsZXJDdWJlU2hhZG93J10pO1xuY29uc3QgdGV4dHVyZURpbWVuc2lvbnMgPSB7XG4gICAgc2FtcGxlcjJEOiBURVhUVVJFRElNRU5TSU9OXzJELFxuICAgIHNhbXBsZXIzRDogVEVYVFVSRURJTUVOU0lPTl8zRCxcbiAgICBzYW1wbGVyQ3ViZTogVEVYVFVSRURJTUVOU0lPTl9DVUJFLFxuICAgIHNhbXBsZXJDdWJlU2hhZG93OiBURVhUVVJFRElNRU5TSU9OX0NVQkUsXG4gICAgc2FtcGxlcjJEU2hhZG93OiBURVhUVVJFRElNRU5TSU9OXzJELFxuICAgIHNhbXBsZXIyREFycmF5OiBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZLFxuICAgIHNhbXBsZXIyREFycmF5U2hhZG93OiBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZXG59O1xuXG5jbGFzcyBVbmlmb3JtTGluZSB7XG4gICAgY29uc3RydWN0b3IobGluZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gZXhhbXBsZTogYGxvd3AgdmVjNCB0aW50c1syICogNF1gXG4gICAgICAgIHRoaXMubGluZSA9IGxpbmU7XG5cbiAgICAgICAgLy8gc3BsaXQgdG8gd29yZHMgaGFuZGxpbmcgYW55IG51bWJlciBvZiBzcGFjZXNcbiAgICAgICAgY29uc3Qgd29yZHMgPSBsaW5lLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuXG4gICAgICAgIC8vIG9wdGlvbmFsIHByZWNpc2lvblxuICAgICAgICBpZiAocHJlY2lzaW9uUXVhbGlmaWVycy5oYXMod29yZHNbMF0pKSB7XG4gICAgICAgICAgICB0aGlzLnByZWNpc2lvbiA9IHdvcmRzLnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0eXBlXG4gICAgICAgIHRoaXMudHlwZSA9IHdvcmRzLnNoaWZ0KCk7XG5cbiAgICAgICAgaWYgKGxpbmUuaW5jbHVkZXMoJywnKSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYEEgY29tbWEgb24gYSB1bmlmb3JtIGxpbmUgaXMgbm90IHN1cHBvcnRlZCwgc3BsaXQgaXQgaW50byBtdWx0aXBsZSB1bmlmb3JtczogJHtsaW5lfWAsIHNoYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhcnJheSBvZiB1bmlmb3Jtc1xuICAgICAgICBpZiAobGluZS5pbmNsdWRlcygnWycpKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3QgPSB3b3Jkcy5qb2luKCcgJyk7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IEFSUkFZX0lERU5USUZJRVIuZXhlYyhyZXN0KTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChtYXRjaCk7XG5cbiAgICAgICAgICAgIHRoaXMubmFtZSA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgdGhpcy5hcnJheVNpemUgPSBOdW1iZXIobWF0Y2hbMl0pO1xuICAgICAgICAgICAgaWYgKGlzTmFOKHRoaXMuYXJyYXlTaXplKSkge1xuICAgICAgICAgICAgICAgIHNoYWRlci5mYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBPbmx5IG51bWVyaWNhbGx5IHNwZWNpZmllZCB1bmlmb3JtIGFycmF5IHNpemVzIGFyZSBzdXBwb3J0ZWQsIHRoaXMgdW5pZm9ybSBpcyBub3Qgc3VwcG9ydGVkOiAnJHtsaW5lfSdgLCBzaGFkZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIHNpbXBsZSB1bmlmb3JtXG4gICAgICAgICAgICB0aGlzLm5hbWUgPSB3b3Jkcy5zaGlmdCgpO1xuICAgICAgICAgICAgdGhpcy5hcnJheVNpemUgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pc1NhbXBsZXIgPSB0aGlzLnR5cGUuaW5kZXhPZignc2FtcGxlcicpICE9PSAtMTtcbiAgICB9XG59XG5cbi8qKlxuICogUHVyZSBzdGF0aWMgY2xhc3MgaW1wbGVtZW50aW5nIHByb2Nlc3Npbmcgb2YgR0xTTCBzaGFkZXJzLiBJdCBhbGxvY2F0ZXMgZml4ZWQgbG9jYXRpb25zIGZvclxuICogYXR0cmlidXRlcywgYW5kIGhhbmRsZXMgY29udmVyc2lvbiBvZiB1bmlmb3JtcyB0byB1bmlmb3JtIGJ1ZmZlcnMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBTaGFkZXJQcm9jZXNzb3Ige1xuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgdGhlIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzaGFkZXJEZWZpbml0aW9uIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IC0gVGhlIHByb2Nlc3NlZCBzaGFkZXIgZGF0YS5cbiAgICAgKi9cbiAgICBzdGF0aWMgcnVuKGRldmljZSwgc2hhZGVyRGVmaW5pdGlvbiwgc2hhZGVyKSB7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtNYXA8c3RyaW5nLCBudW1iZXI+fSAqL1xuICAgICAgICBjb25zdCB2YXJ5aW5nTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIGV4dHJhY3QgbGluZXMgb2YgaW50ZXJlc3RzIGZyb20gYm90aCBzaGFkZXJzXG4gICAgICAgIGNvbnN0IHZlcnRleEV4dHJhY3RlZCA9IFNoYWRlclByb2Nlc3Nvci5leHRyYWN0KHNoYWRlckRlZmluaXRpb24udnNoYWRlcik7XG4gICAgICAgIGNvbnN0IGZyYWdtZW50RXh0cmFjdGVkID0gU2hhZGVyUHJvY2Vzc29yLmV4dHJhY3Qoc2hhZGVyRGVmaW5pdGlvbi5mc2hhZGVyKTtcblxuICAgICAgICAvLyBWUyAtIGNvbnZlcnQgYSBsaXN0IG9mIGF0dHJpYnV0ZXMgdG8gYSBzaGFkZXIgYmxvY2sgd2l0aCBmaXhlZCBsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgYXR0cmlidXRlc0Jsb2NrID0gU2hhZGVyUHJvY2Vzc29yLnByb2Nlc3NBdHRyaWJ1dGVzKHZlcnRleEV4dHJhY3RlZC5hdHRyaWJ1dGVzLCBzaGFkZXJEZWZpbml0aW9uLmF0dHJpYnV0ZXMsIHNoYWRlckRlZmluaXRpb24ucHJvY2Vzc2luZ09wdGlvbnMpO1xuXG4gICAgICAgIC8vIFZTIC0gY29udmVydCBhIGxpc3Qgb2YgdmFyeWluZ3MgdG8gYSBzaGFkZXIgYmxvY2tcbiAgICAgICAgY29uc3QgdmVydGV4VmFyeWluZ3NCbG9jayA9IFNoYWRlclByb2Nlc3Nvci5wcm9jZXNzVmFyeWluZ3ModmVydGV4RXh0cmFjdGVkLnZhcnlpbmdzLCB2YXJ5aW5nTWFwLCB0cnVlKTtcblxuICAgICAgICAvLyBGUyAtIGNvbnZlcnQgYSBsaXN0IG9mIHZhcnlpbmdzIHRvIGEgc2hhZGVyIGJsb2NrXG4gICAgICAgIGNvbnN0IGZyYWdtZW50VmFyeWluZ3NCbG9jayA9IFNoYWRlclByb2Nlc3Nvci5wcm9jZXNzVmFyeWluZ3MoZnJhZ21lbnRFeHRyYWN0ZWQudmFyeWluZ3MsIHZhcnlpbmdNYXAsIGZhbHNlKTtcblxuICAgICAgICAvLyBGUyAtIGNvbnZlcnQgYSBsaXN0IG9mIG91dHB1dHMgdG8gYSBzaGFkZXIgYmxvY2tcbiAgICAgICAgY29uc3Qgb3V0QmxvY2sgPSBTaGFkZXJQcm9jZXNzb3IucHJvY2Vzc091dHMoZnJhZ21lbnRFeHRyYWN0ZWQub3V0cyk7XG5cbiAgICAgICAgLy8gdW5pZm9ybXMgLSBtZXJnZSB2ZXJ0ZXggYW5kIGZyYWdtZW50IHVuaWZvcm1zLCBhbmQgY3JlYXRlIHNoYXJlZCB1bmlmb3JtIGJ1ZmZlcnNcbiAgICAgICAgLy8gTm90ZSB0aGF0IGFzIGJvdGggdmVydGV4IGFuZCBmcmFnbWVudCBjYW4gZGVjbGFyZSB0aGUgc2FtZSB1bmlmb3JtLCB3ZSBuZWVkIHRvIHJlbW92ZSBkdXBsaWNhdGVzXG4gICAgICAgIGNvbnN0IGNvbmNhdFVuaWZvcm1zID0gdmVydGV4RXh0cmFjdGVkLnVuaWZvcm1zLmNvbmNhdChmcmFnbWVudEV4dHJhY3RlZC51bmlmb3Jtcyk7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zID0gQXJyYXkuZnJvbShuZXcgU2V0KGNvbmNhdFVuaWZvcm1zKSk7XG5cbiAgICAgICAgLy8gcGFyc2UgdW5pZm9ybSBsaW5lc1xuICAgICAgICBjb25zdCBwYXJzZWRVbmlmb3JtcyA9IHVuaWZvcm1zLm1hcChsaW5lID0+IG5ldyBVbmlmb3JtTGluZShsaW5lLCBzaGFkZXIpKTtcblxuICAgICAgICAvLyB2YWxpZGF0aW9uIC0gYXMgdW5pZm9ybXMgZ28gdG8gYSBzaGFyZWQgdW5pZm9ybSBidWZmZXIsIHZlcnRleCBhbmQgZnJhZ21lbnQgdmVyc2lvbnMgbmVlZCB0byBtYXRjaFxuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgIHBhcnNlZFVuaWZvcm1zLmZvckVhY2goKHVuaSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gbWFwLmdldCh1bmkubmFtZSk7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCFleGlzdGluZywgYFZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycyBjYW5ub3QgdXNlIHRoZSBzYW1lIHVuaWZvcm0gbmFtZSB3aXRoIGRpZmZlcmVudCB0eXBlczogJyR7ZXhpc3Rpbmd9JyBhbmQgJyR7dW5pLmxpbmV9J2AsIHNoYWRlcik7XG4gICAgICAgICAgICAgICAgbWFwLnNldCh1bmkubmFtZSwgdW5pLmxpbmUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB1bmlmb3Jtc0RhdGEgPSBTaGFkZXJQcm9jZXNzb3IucHJvY2Vzc1VuaWZvcm1zKGRldmljZSwgcGFyc2VkVW5pZm9ybXMsIHNoYWRlckRlZmluaXRpb24ucHJvY2Vzc2luZ09wdGlvbnMsIHNoYWRlcik7XG5cbiAgICAgICAgLy8gVlMgLSBpbnNlcnQgdGhlIGJsb2NrcyB0byB0aGUgc291cmNlXG4gICAgICAgIGNvbnN0IHZCbG9jayA9IGF0dHJpYnV0ZXNCbG9jayArICdcXG4nICsgdmVydGV4VmFyeWluZ3NCbG9jayArICdcXG4nICsgdW5pZm9ybXNEYXRhLmNvZGU7XG4gICAgICAgIGNvbnN0IHZzaGFkZXIgPSB2ZXJ0ZXhFeHRyYWN0ZWQuc3JjLnJlcGxhY2UoTUFSS0VSLCB2QmxvY2spO1xuXG4gICAgICAgIC8vIEZTIC0gaW5zZXJ0IHRoZSBibG9ja3MgdG8gdGhlIHNvdXJjZVxuICAgICAgICBjb25zdCBmQmxvY2sgPSBmcmFnbWVudFZhcnlpbmdzQmxvY2sgKyAnXFxuJyArIG91dEJsb2NrICsgJ1xcbicgKyB1bmlmb3Jtc0RhdGEuY29kZTtcbiAgICAgICAgY29uc3QgZnNoYWRlciA9IGZyYWdtZW50RXh0cmFjdGVkLnNyYy5yZXBsYWNlKE1BUktFUiwgZkJsb2NrKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdnNoYWRlcjogdnNoYWRlcixcbiAgICAgICAgICAgIGZzaGFkZXI6IGZzaGFkZXIsXG4gICAgICAgICAgICBtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDogdW5pZm9ybXNEYXRhLm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0LFxuICAgICAgICAgICAgbWVzaEJpbmRHcm91cEZvcm1hdDogdW5pZm9ybXNEYXRhLm1lc2hCaW5kR3JvdXBGb3JtYXRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBFeHRyYWN0IHJlcXVpcmVkIGluZm9ybWF0aW9uIGZyb20gdGhlIHNoYWRlciBzb3VyY2UgY29kZS5cbiAgICBzdGF0aWMgZXh0cmFjdChzcmMpIHtcblxuICAgICAgICAvLyBjb2xsZWN0ZWQgZGF0YVxuICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0gW107XG4gICAgICAgIGNvbnN0IHZhcnlpbmdzID0gW107XG4gICAgICAgIGNvbnN0IG91dHMgPSBbXTtcbiAgICAgICAgY29uc3QgdW5pZm9ybXMgPSBbXTtcblxuICAgICAgICAvLyByZXBsYWNlbWVudCBtYXJrZXIgLSBtYXJrIGEgZmlyc3QgcmVwbGFjZW1lbnQgcGxhY2UsIHRoaXMgaXMgd2hlcmUgY29kZVxuICAgICAgICAvLyBibG9ja3MgYXJlIGluamVjdGVkIGxhdGVyXG4gICAgICAgIGxldCByZXBsYWNlbWVudCA9IGAke01BUktFUn1cXG5gO1xuXG4gICAgICAgIC8vIGV4dHJhY3QgcmVsZXZhbnQgcGFydHMgb2YgdGhlIHNoYWRlclxuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSBLRVlXT1JELmV4ZWMoc3JjKSkgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgY29uc3Qga2V5d29yZCA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgc3dpdGNoIChrZXl3b3JkKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnYXR0cmlidXRlJzpcbiAgICAgICAgICAgICAgICBjYXNlICd2YXJ5aW5nJzpcbiAgICAgICAgICAgICAgICBjYXNlICd1bmlmb3JtJzpcbiAgICAgICAgICAgICAgICBjYXNlICdvdXQnOiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVhZCB0aGUgbGluZVxuICAgICAgICAgICAgICAgICAgICBLRVlXT1JEX0xJTkUubGFzdEluZGV4ID0gbWF0Y2guaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVNYXRjaCA9IEtFWVdPUkRfTElORS5leGVjKHNyYyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleXdvcmQgPT09ICdhdHRyaWJ1dGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2gobGluZU1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXl3b3JkID09PSAndmFyeWluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcnlpbmdzLnB1c2gobGluZU1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXl3b3JkID09PSAnb3V0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cy5wdXNoKGxpbmVNYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5d29yZCA9PT0gJ3VuaWZvcm0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlmb3Jtcy5wdXNoKGxpbmVNYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBjdXQgaXQgb3V0XG4gICAgICAgICAgICAgICAgICAgIHNyYyA9IFNoYWRlclByb2Nlc3Nvci5jdXRPdXQoc3JjLCBtYXRjaC5pbmRleCwgS0VZV09SRF9MSU5FLmxhc3RJbmRleCwgcmVwbGFjZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICBLRVlXT1JELmxhc3RJbmRleCA9IG1hdGNoLmluZGV4ICsgcmVwbGFjZW1lbnQubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgcGxhY2UgYSBzaW5nbGUgcmVwbGFjZW1lbnQgbWFya2VyXG4gICAgICAgICAgICAgICAgICAgIHJlcGxhY2VtZW50ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzcmMsXG4gICAgICAgICAgICBhdHRyaWJ1dGVzLFxuICAgICAgICAgICAgdmFyeWluZ3MsXG4gICAgICAgICAgICBvdXRzLFxuICAgICAgICAgICAgdW5pZm9ybXNcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBsaW5lcyB3aXRoIHVuaWZvcm1zLiBUaGUgZnVuY3Rpb24gcmVjZWl2ZXMgdGhlIGxpbmVzIGNvbnRhaW5pbmcgYWxsIHVuaWZvcm1zLFxuICAgICAqIGJvdGggbnVtZXJpY2FsIGFzIHdlbGwgYXMgdGV4dHVyZXMvc2FtcGxlcnMuIFRoZSBmdW5jdGlvbiBhbHNvIHJlY2VpdmVzIHRoZSBmb3JtYXQgb2YgdW5pZm9ybVxuICAgICAqIGJ1ZmZlcnMgKG51bWVyaWNhbCkgYW5kIGJpbmQgZ3JvdXBzICh0ZXh0dXJlcykgZm9yIHZpZXcgYW5kIG1hdGVyaWFsIGxldmVsLiBBbGwgdW5pZm9ybXMgdGhhdFxuICAgICAqIG1hdGNoIGFueSBvZiB0aG9zZSBhcmUgaWdub3JlZCwgYXMgdGhvc2Ugd291bGQgYmUgc3VwcGxpZWQgYnkgdmlldyAvIG1hdGVyaWFsIGxldmVsIGJ1ZmZlcnMuXG4gICAgICogQWxsIGxlZnRvdmVyIHVuaWZvcm1zIGNyZWF0ZSB1bmlmb3JtIGJ1ZmZlciBhbmQgYmluZCBncm91cCBmb3IgdGhlIG1lc2ggaXRzZWxmLCBjb250YWluaW5nXG4gICAgICogdW5pZm9ybXMgdGhhdCBjaGFuZ2Ugb24gdGhlIGxldmVsIG9mIHRoZSBtZXNoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtBcnJheTxVbmlmb3JtTGluZT59IHVuaWZvcm1zIC0gTGluZXMgY29udGFpbmluZyB1bmlmb3Jtcy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zaGFkZXItcHJvY2Vzc29yLW9wdGlvbnMuanMnKS5TaGFkZXJQcm9jZXNzb3JPcHRpb25zfSBwcm9jZXNzaW5nT3B0aW9ucyAtXG4gICAgICogVW5pZm9ybSBmb3JtYXRzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IC0gVGhlIHVuaWZvcm0gZGF0YS4gUmV0dXJucyBhIHNoYWRlciBjb2RlIGJsb2NrIGNvbnRhaW5pbmcgdW5pZm9ybXMsIHRvIGJlXG4gICAgICogaW5zZXJ0ZWQgaW50byB0aGUgc2hhZGVyLCBhcyB3ZWxsIGFzIGdlbmVyYXRlZCB1bmlmb3JtIGZvcm1hdCBzdHJ1Y3R1cmVzIGZvciB0aGUgbWVzaCBsZXZlbC5cbiAgICAgKi9cbiAgICBzdGF0aWMgcHJvY2Vzc1VuaWZvcm1zKGRldmljZSwgdW5pZm9ybXMsIHByb2Nlc3NpbmdPcHRpb25zLCBzaGFkZXIpIHtcblxuICAgICAgICAvLyBzcGxpdCB1bmlmb3JtIGxpbmVzIGludG8gc2FtcGxlcnMgYW5kIHRoZSByZXN0XG4gICAgICAgIC8qKiBAdHlwZSB7QXJyYXk8VW5pZm9ybUxpbmU+fSAqL1xuICAgICAgICBjb25zdCB1bmlmb3JtTGluZXNTYW1wbGVycyA9IFtdO1xuICAgICAgICAvKiogQHR5cGUge0FycmF5PFVuaWZvcm1MaW5lPn0gKi9cbiAgICAgICAgY29uc3QgdW5pZm9ybUxpbmVzTm9uU2FtcGxlcnMgPSBbXTtcbiAgICAgICAgdW5pZm9ybXMuZm9yRWFjaCgodW5pZm9ybSkgPT4ge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0uaXNTYW1wbGVyKSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybUxpbmVzU2FtcGxlcnMucHVzaCh1bmlmb3JtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybUxpbmVzTm9uU2FtcGxlcnMucHVzaCh1bmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gYnVpbGQgbWVzaCB1bmlmb3JtIGJ1ZmZlciBmb3JtYXRcbiAgICAgICAgY29uc3QgbWVzaFVuaWZvcm1zID0gW107XG4gICAgICAgIHVuaWZvcm1MaW5lc05vblNhbXBsZXJzLmZvckVhY2goKHVuaWZvcm0pID0+IHtcbiAgICAgICAgICAgIC8vIHVuaWZvcm1zIG5vdCBhbHJlYWR5IGluIHN1cHBsaWVkIHVuaWZvcm0gYnVmZmVycyBnbyB0byB0aGUgbWVzaCBidWZmZXJcbiAgICAgICAgICAgIGlmICghcHJvY2Vzc2luZ09wdGlvbnMuaGFzVW5pZm9ybSh1bmlmb3JtLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5pZm9ybVR5cGUgPSB1bmlmb3JtVHlwZVRvTmFtZS5pbmRleE9mKHVuaWZvcm0udHlwZSk7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHVuaWZvcm1UeXBlID49IDAsIGBVbmlmb3JtIHR5cGUgJHt1bmlmb3JtLnR5cGV9IGlzIG5vdCByZWNvZ25pemVkIG9uIGxpbmUgWyR7dW5pZm9ybS5saW5lfV1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmlmb3JtRm9ybWF0ID0gbmV3IFVuaWZvcm1Gb3JtYXQodW5pZm9ybS5uYW1lLCB1bmlmb3JtVHlwZSwgdW5pZm9ybS5hcnJheVNpemUpO1xuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCghdW5pZm9ybUZvcm1hdC5pbnZhbGlkLCBgSW52YWxpZCB1bmlmb3JtIGxpbmU6ICR7dW5pZm9ybS5saW5lfWAsIHNoYWRlcik7XG4gICAgICAgICAgICAgICAgbWVzaFVuaWZvcm1zLnB1c2godW5pZm9ybUZvcm1hdCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHZhbGlkYXRlIHR5cGVzIGluIGVsc2VcblxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQgPSBtZXNoVW5pZm9ybXMubGVuZ3RoID8gbmV3IFVuaWZvcm1CdWZmZXJGb3JtYXQoZGV2aWNlLCBtZXNoVW5pZm9ybXMpIDogbnVsbDtcblxuICAgICAgICAvLyBidWlsZCBtZXNoIGJpbmQgZ3JvdXAgZm9ybWF0IC0gc3RhcnQgd2l0aCB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICBjb25zdCBidWZmZXJGb3JtYXRzID0gW107XG4gICAgICAgIGlmIChtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCkge1xuICAgICAgICAgICAgLy8gVE9ETzogd2UgY291bGQgb3B0aW1pemUgdmlzaWJpbGl0eSB0byBvbmx5IHN0YWdlcyB0aGF0IHVzZSBhbnkgb2YgdGhlIGRhdGFcbiAgICAgICAgICAgIGJ1ZmZlckZvcm1hdHMucHVzaChuZXcgQmluZEJ1ZmZlckZvcm1hdChVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSwgU0hBREVSU1RBR0VfVkVSVEVYIHwgU0hBREVSU1RBR0VfRlJBR01FTlQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZCB0ZXh0dXJlcyB1bmlmb3Jtc1xuICAgICAgICBjb25zdCB0ZXh0dXJlRm9ybWF0cyA9IFtdO1xuICAgICAgICB1bmlmb3JtTGluZXNTYW1wbGVycy5mb3JFYWNoKCh1bmlmb3JtKSA9PiB7XG4gICAgICAgICAgICAvLyB1bm1hdGNoZWQgdGV4dHVyZSB1bmlmb3JtcyBnbyB0byBtZXNoIGJsb2NrXG4gICAgICAgICAgICBpZiAoIXByb2Nlc3NpbmdPcHRpb25zLmhhc1RleHR1cmUodW5pZm9ybS5uYW1lKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gc2FtcGxlIHR5cGVcbiAgICAgICAgICAgICAgICAvLyBXZWJHcHUgZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgZmlsdGVyZWQgZmxvYXQgZm9ybWF0IHRleHR1cmVzLCBhbmQgc28gd2UgbWFwIHRoZW0gdG8gdW5maWx0ZXJhYmxlIHR5cGVcbiAgICAgICAgICAgICAgICAvLyBhcyB3ZSBzYW1wbGUgdGhlbSB3aXRob3V0IGZpbHRlcmluZyBhbnl3YXlzXG4gICAgICAgICAgICAgICAgbGV0IHNhbXBsZVR5cGUgPSBTQU1QTEVUWVBFX0ZMT0FUO1xuICAgICAgICAgICAgICAgIGlmICh1bmlmb3JtLnByZWNpc2lvbiA9PT0gJ2hpZ2hwJylcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUO1xuICAgICAgICAgICAgICAgIGlmIChzaGFkb3dTYW1wbGVycy5oYXModW5pZm9ybS50eXBlKSlcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfREVQVEg7XG5cbiAgICAgICAgICAgICAgICAvLyBkaW1lbnNpb25cbiAgICAgICAgICAgICAgICBjb25zdCBkaW1lbnNpb24gPSB0ZXh0dXJlRGltZW5zaW9uc1t1bmlmb3JtLnR5cGVdO1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogd2UgY291bGQgb3B0aW1pemUgdmlzaWJpbGl0eSB0byBvbmx5IHN0YWdlcyB0aGF0IHVzZSBhbnkgb2YgdGhlIGRhdGFcbiAgICAgICAgICAgICAgICB0ZXh0dXJlRm9ybWF0cy5wdXNoKG5ldyBCaW5kVGV4dHVyZUZvcm1hdCh1bmlmb3JtLm5hbWUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5ULCBkaW1lbnNpb24sIHNhbXBsZVR5cGUpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdmFsaWRhdGUgdHlwZXMgaW4gZWxzZVxuXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBtZXNoQmluZEdyb3VwRm9ybWF0ID0gbmV3IEJpbmRHcm91cEZvcm1hdChkZXZpY2UsIGJ1ZmZlckZvcm1hdHMsIHRleHR1cmVGb3JtYXRzKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSBjb2RlIGZvciB1bmlmb3JtIGJ1ZmZlcnNcbiAgICAgICAgbGV0IGNvZGUgPSAnJztcbiAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnMudW5pZm9ybUZvcm1hdHMuZm9yRWFjaCgoZm9ybWF0LCBiaW5kR3JvdXBJbmRleCkgPT4ge1xuICAgICAgICAgICAgaWYgKGZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gZm9ybWF0LmdldFNoYWRlckRlY2xhcmF0aW9uKGJpbmRHcm91cEluZGV4LCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gYW5kIGFsc28gZm9yIGdlbmVyYXRlZCBtZXNoIGZvcm1hdCwgd2hpY2ggaXMgYXQgdGhlIHNsb3QgMCBvZiB0aGUgYmluZCBncm91cFxuICAgICAgICBpZiAobWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQuZ2V0U2hhZGVyRGVjbGFyYXRpb24oQklOREdST1VQX01FU0gsIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgY29kZSBmb3IgdGV4dHVyZXNcbiAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnMuYmluZEdyb3VwRm9ybWF0cy5mb3JFYWNoKChmb3JtYXQsIGJpbmRHcm91cEluZGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBmb3JtYXQuZ2V0U2hhZGVyRGVjbGFyYXRpb25UZXh0dXJlcyhiaW5kR3JvdXBJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGFuZCBhbHNvIGZvciBnZW5lcmF0ZWQgbWVzaCBmb3JtYXRcbiAgICAgICAgY29kZSArPSBtZXNoQmluZEdyb3VwRm9ybWF0LmdldFNoYWRlckRlY2xhcmF0aW9uVGV4dHVyZXMoQklOREdST1VQX01FU0gpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQsXG4gICAgICAgICAgICBtZXNoQmluZEdyb3VwRm9ybWF0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgc3RhdGljIHByb2Nlc3NWYXJ5aW5ncyh2YXJ5aW5nTGluZXMsIHZhcnlpbmdNYXAsIGlzVmVydGV4KSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBjb25zdCBvcCA9IGlzVmVydGV4ID8gJ291dCcgOiAnaW4nO1xuICAgICAgICB2YXJ5aW5nTGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmRzID0gU2hhZGVyUHJvY2Vzc29yLnNwbGl0VG9Xb3JkcyhsaW5lKTtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSB3b3Jkc1swXTtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSB3b3Jkc1sxXTtcblxuICAgICAgICAgICAgaWYgKGlzVmVydGV4KSB7XG4gICAgICAgICAgICAgICAgLy8gc3RvcmUgaXQgaW4gdGhlIG1hcFxuICAgICAgICAgICAgICAgIHZhcnlpbmdNYXAuc2V0KG5hbWUsIGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZhcnlpbmdNYXAuaGFzKG5hbWUpLCBgRnJhZ21lbnQgc2hhZGVyIHJlcXVpcmVzIHZhcnlpbmcgWyR7bmFtZX1dIGJ1dCB2ZXJ0ZXggc2hhZGVyIGRvZXMgbm90IGdlbmVyYXRlIGl0LmApO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gdmFyeWluZ01hcC5nZXQobmFtZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIGluIHZlYzQgcG9zaXRpb247J1xuICAgICAgICAgICAgYmxvY2sgKz0gYGxheW91dChsb2NhdGlvbiA9ICR7aW5kZXh9KSAke29wfSAke3R5cGV9ICR7bmFtZX07XFxuYDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBibG9jaztcbiAgICB9XG5cbiAgICBzdGF0aWMgcHJvY2Vzc091dHMob3V0c0xpbmVzKSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBvdXRzTGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIG91dCB2ZWM0IGdsX0ZyYWdDb2xvcjsnXG4gICAgICAgICAgICBibG9jayArPSBgbGF5b3V0KGxvY2F0aW9uID0gJHtpbmRleH0pIG91dCAke2xpbmV9O1xcbmA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgfVxuXG4gICAgLy8gZXh0cmFjdCBjb3VudCBmcm9tIHR5cGUgKCd2ZWMzJyA9PiAzLCAnZmxvYXQnID0+IDEpXG4gICAgc3RhdGljIGdldFR5cGVDb3VudCh0eXBlKSB7XG4gICAgICAgIGNvbnN0IGxhc3RDaGFyID0gdHlwZS5zdWJzdHJpbmcodHlwZS5sZW5ndGggLSAxKTtcbiAgICAgICAgY29uc3QgbnVtID0gcGFyc2VJbnQobGFzdENoYXIsIDEwKTtcbiAgICAgICAgcmV0dXJuIGlzTmFOKG51bSkgPyAxIDogbnVtO1xuICAgIH1cblxuICAgIHN0YXRpYyBwcm9jZXNzQXR0cmlidXRlcyhhdHRyaWJ1dGVMaW5lcywgc2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMsIHByb2Nlc3NpbmdPcHRpb25zKSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBjb25zdCB1c2VkTG9jYXRpb25zID0ge307XG4gICAgICAgIGF0dHJpYnV0ZUxpbmVzLmZvckVhY2goKGxpbmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmRzID0gU2hhZGVyUHJvY2Vzc29yLnNwbGl0VG9Xb3JkcyhsaW5lKTtcbiAgICAgICAgICAgIGxldCB0eXBlID0gd29yZHNbMF07XG4gICAgICAgICAgICBsZXQgbmFtZSA9IHdvcmRzWzFdO1xuXG4gICAgICAgICAgICBpZiAoc2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IHNoYWRlckRlZmluaXRpb25BdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gc2VtYW50aWNUb0xvY2F0aW9uW3NlbWFudGljXTtcblxuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCghdXNlZExvY2F0aW9ucy5oYXNPd25Qcm9wZXJ0eShsb2NhdGlvbiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBXQVJOSU5HOiBUd28gdmVydGV4IGF0dHJpYnV0ZXMgYXJlIG1hcHBlZCB0byB0aGUgc2FtZSBsb2NhdGlvbiBpbiBhIHNoYWRlcjogJHt1c2VkTG9jYXRpb25zW2xvY2F0aW9uXX0gYW5kICR7c2VtYW50aWN9YCk7XG4gICAgICAgICAgICAgICAgdXNlZExvY2F0aW9uc1tsb2NhdGlvbl0gPSBzZW1hbnRpYztcblxuICAgICAgICAgICAgICAgIC8vIGlmIHZlcnRleCBmb3JtYXQgZm9yIHRoaXMgYXR0cmlidXRlIGlzIG5vdCBvZiBhIGZsb2F0IHR5cGUsIHdlIG5lZWQgdG8gYWRqdXN0IHRoZSBhdHRyaWJ1dGUgZm9ybWF0LCBmb3IgZXhhbXBsZSB3ZSBjb252ZXJ0XG4gICAgICAgICAgICAgICAgLy8gICAgICBhdHRyaWJ1dGUgdmVjNCB2ZXJ0ZXhfcG9zaXRpb247XG4gICAgICAgICAgICAgICAgLy8gdG9cbiAgICAgICAgICAgICAgICAvLyAgICAgIGF0dHJpYnV0ZSBpdmVjNCBfcHJpdmF0ZV92ZXJ0ZXhfcG9zaXRpb247XG4gICAgICAgICAgICAgICAgLy8gICAgICB2ZWM0IHZlcnRleF9wb3NpdGlvbiA9IHZlYzQoX3ByaXZhdGVfdmVydGV4X3Bvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICBsZXQgY29weUNvZGU7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHByb2Nlc3NpbmdPcHRpb25zLmdldFZlcnRleEVsZW1lbnQoc2VtYW50aWMpO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFUeXBlID0gZWxlbWVudC5kYXRhVHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFUeXBlICE9PSBUWVBFX0ZMT0FUMzIpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXR0cmliTnVtRWxlbWVudHMgPSBTaGFkZXJQcm9jZXNzb3IuZ2V0VHlwZUNvdW50KHR5cGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3TmFtZSA9IGBfcHJpdmF0ZV8ke25hbWV9YDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2Vjb25kIGxpbmUgb2YgbmV3IGNvZGUsIGNvcHkgcHJpdmF0ZSAodSlpbnQgdHlwZSBpbnRvIHZlYyB0eXBlXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3B5Q29kZSA9IGB2ZWMke2F0dHJpYk51bUVsZW1lbnRzfSAke25hbWV9ID0gdmVjJHthdHRyaWJOdW1FbGVtZW50c30oJHtuZXdOYW1lfSk7XFxuYDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSA9IG5ld05hbWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5ldyBhdHRyaWJ1dGUgdHlwZSwgYmFzZWQgb24gdGhlIHZlcnRleCBmb3JtYXQgZWxlbWVudCB0eXBlLCBleGFtcGxlOiB2ZWMzIC0+IGl2ZWMzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1NpZ25lZFR5cGUgPSBkYXRhVHlwZSA9PT0gVFlQRV9JTlQ4IHx8IGRhdGFUeXBlID09PSBUWVBFX0lOVDE2IHx8IGRhdGFUeXBlID09PSBUWVBFX0lOVDMyO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJpYk51bUVsZW1lbnRzID09PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9IGlzU2lnbmVkVHlwZSA/ICdpbnQnIDogJ3VpbnQnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlID0gaXNTaWduZWRUeXBlID8gYGl2ZWMke2F0dHJpYk51bUVsZW1lbnRzfWAgOiBgdXZlYyR7YXR0cmliTnVtRWxlbWVudHN9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIGluIHZlYzQgcG9zaXRpb247J1xuICAgICAgICAgICAgICAgIGJsb2NrICs9IGBsYXlvdXQobG9jYXRpb24gPSAke2xvY2F0aW9ufSkgaW4gJHt0eXBlfSAke25hbWV9O1xcbmA7XG5cbiAgICAgICAgICAgICAgICBpZiAoY29weUNvZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2sgKz0gY29weUNvZGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGJsb2NrO1xuICAgIH1cblxuICAgIHN0YXRpYyBzcGxpdFRvV29yZHMobGluZSkge1xuICAgICAgICAvLyByZW1vdmUgYW55IGRvdWJsZSBzcGFjZXNcbiAgICAgICAgbGluZSA9IGxpbmUucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIGxpbmUuc3BsaXQoJyAnKTtcbiAgICB9XG5cbiAgICBzdGF0aWMgY3V0T3V0KHNyYywgc3RhcnQsIGVuZCwgcmVwbGFjZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIHNyYy5zdWJzdHJpbmcoMCwgc3RhcnQpICsgcmVwbGFjZW1lbnQgKyBzcmMuc3Vic3RyaW5nKGVuZCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTaGFkZXJQcm9jZXNzb3IgfTtcbiJdLCJuYW1lcyI6WyJLRVlXT1JEIiwiS0VZV09SRF9MSU5FIiwiTUFSS0VSIiwiQVJSQVlfSURFTlRJRklFUiIsInByZWNpc2lvblF1YWxpZmllcnMiLCJTZXQiLCJzaGFkb3dTYW1wbGVycyIsInRleHR1cmVEaW1lbnNpb25zIiwic2FtcGxlcjJEIiwiVEVYVFVSRURJTUVOU0lPTl8yRCIsInNhbXBsZXIzRCIsIlRFWFRVUkVESU1FTlNJT05fM0QiLCJzYW1wbGVyQ3ViZSIsIlRFWFRVUkVESU1FTlNJT05fQ1VCRSIsInNhbXBsZXJDdWJlU2hhZG93Iiwic2FtcGxlcjJEU2hhZG93Iiwic2FtcGxlcjJEQXJyYXkiLCJURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZIiwic2FtcGxlcjJEQXJyYXlTaGFkb3ciLCJVbmlmb3JtTGluZSIsImNvbnN0cnVjdG9yIiwibGluZSIsInNoYWRlciIsIndvcmRzIiwidHJpbSIsInNwbGl0IiwiaGFzIiwicHJlY2lzaW9uIiwic2hpZnQiLCJ0eXBlIiwiaW5jbHVkZXMiLCJEZWJ1ZyIsImVycm9yIiwicmVzdCIsImpvaW4iLCJtYXRjaCIsImV4ZWMiLCJhc3NlcnQiLCJuYW1lIiwiYXJyYXlTaXplIiwiTnVtYmVyIiwiaXNOYU4iLCJmYWlsZWQiLCJpc1NhbXBsZXIiLCJpbmRleE9mIiwiU2hhZGVyUHJvY2Vzc29yIiwicnVuIiwiZGV2aWNlIiwic2hhZGVyRGVmaW5pdGlvbiIsInZhcnlpbmdNYXAiLCJNYXAiLCJ2ZXJ0ZXhFeHRyYWN0ZWQiLCJleHRyYWN0IiwidnNoYWRlciIsImZyYWdtZW50RXh0cmFjdGVkIiwiZnNoYWRlciIsImF0dHJpYnV0ZXNCbG9jayIsInByb2Nlc3NBdHRyaWJ1dGVzIiwiYXR0cmlidXRlcyIsInByb2Nlc3NpbmdPcHRpb25zIiwidmVydGV4VmFyeWluZ3NCbG9jayIsInByb2Nlc3NWYXJ5aW5ncyIsInZhcnlpbmdzIiwiZnJhZ21lbnRWYXJ5aW5nc0Jsb2NrIiwib3V0QmxvY2siLCJwcm9jZXNzT3V0cyIsIm91dHMiLCJjb25jYXRVbmlmb3JtcyIsInVuaWZvcm1zIiwiY29uY2F0IiwiQXJyYXkiLCJmcm9tIiwicGFyc2VkVW5pZm9ybXMiLCJtYXAiLCJjYWxsIiwiZm9yRWFjaCIsInVuaSIsImV4aXN0aW5nIiwiZ2V0Iiwic2V0IiwidW5pZm9ybXNEYXRhIiwicHJvY2Vzc1VuaWZvcm1zIiwidkJsb2NrIiwiY29kZSIsInNyYyIsInJlcGxhY2UiLCJmQmxvY2siLCJtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIm1lc2hCaW5kR3JvdXBGb3JtYXQiLCJyZXBsYWNlbWVudCIsImtleXdvcmQiLCJsYXN0SW5kZXgiLCJpbmRleCIsImxpbmVNYXRjaCIsInB1c2giLCJjdXRPdXQiLCJsZW5ndGgiLCJ1bmlmb3JtTGluZXNTYW1wbGVycyIsInVuaWZvcm1MaW5lc05vblNhbXBsZXJzIiwidW5pZm9ybSIsIm1lc2hVbmlmb3JtcyIsImhhc1VuaWZvcm0iLCJ1bmlmb3JtVHlwZSIsInVuaWZvcm1UeXBlVG9OYW1lIiwidW5pZm9ybUZvcm1hdCIsIlVuaWZvcm1Gb3JtYXQiLCJpbnZhbGlkIiwiVW5pZm9ybUJ1ZmZlckZvcm1hdCIsImJ1ZmZlckZvcm1hdHMiLCJCaW5kQnVmZmVyRm9ybWF0IiwiVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUiLCJTSEFERVJTVEFHRV9WRVJURVgiLCJTSEFERVJTVEFHRV9GUkFHTUVOVCIsInRleHR1cmVGb3JtYXRzIiwiaGFzVGV4dHVyZSIsInNhbXBsZVR5cGUiLCJTQU1QTEVUWVBFX0ZMT0FUIiwiU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQiLCJTQU1QTEVUWVBFX0RFUFRIIiwiZGltZW5zaW9uIiwiQmluZFRleHR1cmVGb3JtYXQiLCJCaW5kR3JvdXBGb3JtYXQiLCJ1bmlmb3JtRm9ybWF0cyIsImZvcm1hdCIsImJpbmRHcm91cEluZGV4IiwiZ2V0U2hhZGVyRGVjbGFyYXRpb24iLCJCSU5ER1JPVVBfTUVTSCIsImJpbmRHcm91cEZvcm1hdHMiLCJnZXRTaGFkZXJEZWNsYXJhdGlvblRleHR1cmVzIiwidmFyeWluZ0xpbmVzIiwiaXNWZXJ0ZXgiLCJibG9jayIsIm9wIiwic3BsaXRUb1dvcmRzIiwib3V0c0xpbmVzIiwiZ2V0VHlwZUNvdW50IiwibGFzdENoYXIiLCJzdWJzdHJpbmciLCJudW0iLCJwYXJzZUludCIsImF0dHJpYnV0ZUxpbmVzIiwic2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMiLCJ1c2VkTG9jYXRpb25zIiwiaGFzT3duUHJvcGVydHkiLCJzZW1hbnRpYyIsImxvY2F0aW9uIiwic2VtYW50aWNUb0xvY2F0aW9uIiwiY29weUNvZGUiLCJlbGVtZW50IiwiZ2V0VmVydGV4RWxlbWVudCIsImRhdGFUeXBlIiwiVFlQRV9GTE9BVDMyIiwiYXR0cmliTnVtRWxlbWVudHMiLCJuZXdOYW1lIiwiaXNTaWduZWRUeXBlIiwiVFlQRV9JTlQ4IiwiVFlQRV9JTlQxNiIsIlRZUEVfSU5UMzIiLCJzdGFydCIsImVuZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQVlBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLE9BQU8sR0FBRyxnREFBZ0QsQ0FBQTs7QUFFaEU7QUFDQSxNQUFNQyxZQUFZLEdB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
