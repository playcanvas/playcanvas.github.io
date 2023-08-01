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
        // Note that we skip normalized elements, as shader receives them as floats already.
        let copyCode;
        const element = processingOptions.getVertexElement(semantic);
        if (element) {
          const dataType = element.dataType;
          if (dataType !== TYPE_FLOAT32 && !element.normalize) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLXByb2Nlc3Nvci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci1wcm9jZXNzb3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7XG4gICAgQklOREdST1VQX01FU0gsIHVuaWZvcm1UeXBlVG9OYW1lLCBzZW1hbnRpY1RvTG9jYXRpb24sXG4gICAgU0hBREVSU1RBR0VfVkVSVEVYLCBTSEFERVJTVEFHRV9GUkFHTUVOVCxcbiAgICBVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSxcbiAgICBTQU1QTEVUWVBFX0ZMT0FULCBTQU1QTEVUWVBFX0RFUFRILCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCxcbiAgICBURVhUVVJFRElNRU5TSU9OXzJELCBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZLCBURVhUVVJFRElNRU5TSU9OX0NVQkUsIFRFWFRVUkVESU1FTlNJT05fM0QsXG4gICAgVFlQRV9GTE9BVDMyLCBUWVBFX0lOVDgsIFRZUEVfSU5UMTYsIFRZUEVfSU5UMzJcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUZvcm1hdCwgVW5pZm9ybUJ1ZmZlckZvcm1hdCB9IGZyb20gJy4vdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJztcbmltcG9ydCB7IEJpbmRHcm91cEZvcm1hdCwgQmluZEJ1ZmZlckZvcm1hdCwgQmluZFRleHR1cmVGb3JtYXQgfSBmcm9tICcuL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJztcblxuLy8gYWNjZXB0ZWQga2V5d29yZHNcbi8vIFRPRE86ICdvdXQnIGtleXdvcmQgaXMgbm90IGluIHRoZSBsaXN0LCBhcyBoYW5kbGluZyBpdCBpcyBtb3JlIGNvbXBsaWNhdGVkIGR1ZVxuLy8gdG8gJ291dCcga2V5d29yZCBhbHNvIGJlaW5nIHVzZWQgdG8gbWFyayBvdXRwdXQgb25seSBmdW5jdGlvbiBwYXJhbWV0ZXJzLlxuY29uc3QgS0VZV09SRCA9IC9bIFxcdF0qKFxcYmF0dHJpYnV0ZVxcYnxcXGJ2YXJ5aW5nXFxifFxcYnVuaWZvcm1cXGIpL2c7XG5cbi8vIG1hdGNoICdhdHRyaWJ1dGUnIGFuZCBhbnl0aGluZyBlbHNlIHRpbGwgJzsnXG5jb25zdCBLRVlXT1JEX0xJTkUgPSAvKFxcYmF0dHJpYnV0ZVxcYnxcXGJ2YXJ5aW5nXFxifFxcYm91dFxcYnxcXGJ1bmlmb3JtXFxiKVsgXFx0XSooW147XSspKFs7XSspL2c7XG5cbi8vIG1hcmtlciBmb3IgYSBwbGFjZSBpbiB0aGUgc291cmNlIGNvZGUgdG8gYmUgcmVwbGFjZWQgYnkgY29kZVxuY29uc3QgTUFSS0VSID0gJ0BAQCc7XG5cbi8vIGFuIGFycmF5IGlkZW50aWZpZXIsIGZvciBleGFtcGxlICdkYXRhWzRdJyAtIGdyb3VwIDEgaXMgJ2RhdGEnLCBncm91cCAyIGlzIGV2ZXJ5dGhpbmcgaW4gYnJhY2tldHM6ICc0J1xuY29uc3QgQVJSQVlfSURFTlRJRklFUiA9IC8oW1xcdy1dKylcXFsoLio/KVxcXS87XG5cbmNvbnN0IHByZWNpc2lvblF1YWxpZmllcnMgPSBuZXcgU2V0KFsnaGlnaHAnLCAnbWVkaXVtcCcsICdsb3dwJ10pO1xuY29uc3Qgc2hhZG93U2FtcGxlcnMgPSBuZXcgU2V0KFsnc2FtcGxlcjJEU2hhZG93JywgJ3NhbXBsZXJDdWJlU2hhZG93J10pO1xuY29uc3QgdGV4dHVyZURpbWVuc2lvbnMgPSB7XG4gICAgc2FtcGxlcjJEOiBURVhUVVJFRElNRU5TSU9OXzJELFxuICAgIHNhbXBsZXIzRDogVEVYVFVSRURJTUVOU0lPTl8zRCxcbiAgICBzYW1wbGVyQ3ViZTogVEVYVFVSRURJTUVOU0lPTl9DVUJFLFxuICAgIHNhbXBsZXJDdWJlU2hhZG93OiBURVhUVVJFRElNRU5TSU9OX0NVQkUsXG4gICAgc2FtcGxlcjJEU2hhZG93OiBURVhUVVJFRElNRU5TSU9OXzJELFxuICAgIHNhbXBsZXIyREFycmF5OiBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZLFxuICAgIHNhbXBsZXIyREFycmF5U2hhZG93OiBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZXG59O1xuXG5jbGFzcyBVbmlmb3JtTGluZSB7XG4gICAgY29uc3RydWN0b3IobGluZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gZXhhbXBsZTogYGxvd3AgdmVjNCB0aW50c1syICogNF1gXG4gICAgICAgIHRoaXMubGluZSA9IGxpbmU7XG5cbiAgICAgICAgLy8gc3BsaXQgdG8gd29yZHMgaGFuZGxpbmcgYW55IG51bWJlciBvZiBzcGFjZXNcbiAgICAgICAgY29uc3Qgd29yZHMgPSBsaW5lLnRyaW0oKS5zcGxpdCgvXFxzKy8pO1xuXG4gICAgICAgIC8vIG9wdGlvbmFsIHByZWNpc2lvblxuICAgICAgICBpZiAocHJlY2lzaW9uUXVhbGlmaWVycy5oYXMod29yZHNbMF0pKSB7XG4gICAgICAgICAgICB0aGlzLnByZWNpc2lvbiA9IHdvcmRzLnNoaWZ0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0eXBlXG4gICAgICAgIHRoaXMudHlwZSA9IHdvcmRzLnNoaWZ0KCk7XG5cbiAgICAgICAgaWYgKGxpbmUuaW5jbHVkZXMoJywnKSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYEEgY29tbWEgb24gYSB1bmlmb3JtIGxpbmUgaXMgbm90IHN1cHBvcnRlZCwgc3BsaXQgaXQgaW50byBtdWx0aXBsZSB1bmlmb3JtczogJHtsaW5lfWAsIHNoYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhcnJheSBvZiB1bmlmb3Jtc1xuICAgICAgICBpZiAobGluZS5pbmNsdWRlcygnWycpKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3QgPSB3b3Jkcy5qb2luKCcgJyk7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IEFSUkFZX0lERU5USUZJRVIuZXhlYyhyZXN0KTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChtYXRjaCk7XG5cbiAgICAgICAgICAgIHRoaXMubmFtZSA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgdGhpcy5hcnJheVNpemUgPSBOdW1iZXIobWF0Y2hbMl0pO1xuICAgICAgICAgICAgaWYgKGlzTmFOKHRoaXMuYXJyYXlTaXplKSkge1xuICAgICAgICAgICAgICAgIHNoYWRlci5mYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBPbmx5IG51bWVyaWNhbGx5IHNwZWNpZmllZCB1bmlmb3JtIGFycmF5IHNpemVzIGFyZSBzdXBwb3J0ZWQsIHRoaXMgdW5pZm9ybSBpcyBub3Qgc3VwcG9ydGVkOiAnJHtsaW5lfSdgLCBzaGFkZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIHNpbXBsZSB1bmlmb3JtXG4gICAgICAgICAgICB0aGlzLm5hbWUgPSB3b3Jkcy5zaGlmdCgpO1xuICAgICAgICAgICAgdGhpcy5hcnJheVNpemUgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pc1NhbXBsZXIgPSB0aGlzLnR5cGUuaW5kZXhPZignc2FtcGxlcicpICE9PSAtMTtcbiAgICB9XG59XG5cbi8qKlxuICogUHVyZSBzdGF0aWMgY2xhc3MgaW1wbGVtZW50aW5nIHByb2Nlc3Npbmcgb2YgR0xTTCBzaGFkZXJzLiBJdCBhbGxvY2F0ZXMgZml4ZWQgbG9jYXRpb25zIGZvclxuICogYXR0cmlidXRlcywgYW5kIGhhbmRsZXMgY29udmVyc2lvbiBvZiB1bmlmb3JtcyB0byB1bmlmb3JtIGJ1ZmZlcnMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBTaGFkZXJQcm9jZXNzb3Ige1xuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgdGhlIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzaGFkZXJEZWZpbml0aW9uIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IC0gVGhlIHByb2Nlc3NlZCBzaGFkZXIgZGF0YS5cbiAgICAgKi9cbiAgICBzdGF0aWMgcnVuKGRldmljZSwgc2hhZGVyRGVmaW5pdGlvbiwgc2hhZGVyKSB7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtNYXA8c3RyaW5nLCBudW1iZXI+fSAqL1xuICAgICAgICBjb25zdCB2YXJ5aW5nTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIGV4dHJhY3QgbGluZXMgb2YgaW50ZXJlc3RzIGZyb20gYm90aCBzaGFkZXJzXG4gICAgICAgIGNvbnN0IHZlcnRleEV4dHJhY3RlZCA9IFNoYWRlclByb2Nlc3Nvci5leHRyYWN0KHNoYWRlckRlZmluaXRpb24udnNoYWRlcik7XG4gICAgICAgIGNvbnN0IGZyYWdtZW50RXh0cmFjdGVkID0gU2hhZGVyUHJvY2Vzc29yLmV4dHJhY3Qoc2hhZGVyRGVmaW5pdGlvbi5mc2hhZGVyKTtcblxuICAgICAgICAvLyBWUyAtIGNvbnZlcnQgYSBsaXN0IG9mIGF0dHJpYnV0ZXMgdG8gYSBzaGFkZXIgYmxvY2sgd2l0aCBmaXhlZCBsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgYXR0cmlidXRlc0Jsb2NrID0gU2hhZGVyUHJvY2Vzc29yLnByb2Nlc3NBdHRyaWJ1dGVzKHZlcnRleEV4dHJhY3RlZC5hdHRyaWJ1dGVzLCBzaGFkZXJEZWZpbml0aW9uLmF0dHJpYnV0ZXMsIHNoYWRlckRlZmluaXRpb24ucHJvY2Vzc2luZ09wdGlvbnMpO1xuXG4gICAgICAgIC8vIFZTIC0gY29udmVydCBhIGxpc3Qgb2YgdmFyeWluZ3MgdG8gYSBzaGFkZXIgYmxvY2tcbiAgICAgICAgY29uc3QgdmVydGV4VmFyeWluZ3NCbG9jayA9IFNoYWRlclByb2Nlc3Nvci5wcm9jZXNzVmFyeWluZ3ModmVydGV4RXh0cmFjdGVkLnZhcnlpbmdzLCB2YXJ5aW5nTWFwLCB0cnVlKTtcblxuICAgICAgICAvLyBGUyAtIGNvbnZlcnQgYSBsaXN0IG9mIHZhcnlpbmdzIHRvIGEgc2hhZGVyIGJsb2NrXG4gICAgICAgIGNvbnN0IGZyYWdtZW50VmFyeWluZ3NCbG9jayA9IFNoYWRlclByb2Nlc3Nvci5wcm9jZXNzVmFyeWluZ3MoZnJhZ21lbnRFeHRyYWN0ZWQudmFyeWluZ3MsIHZhcnlpbmdNYXAsIGZhbHNlKTtcblxuICAgICAgICAvLyBGUyAtIGNvbnZlcnQgYSBsaXN0IG9mIG91dHB1dHMgdG8gYSBzaGFkZXIgYmxvY2tcbiAgICAgICAgY29uc3Qgb3V0QmxvY2sgPSBTaGFkZXJQcm9jZXNzb3IucHJvY2Vzc091dHMoZnJhZ21lbnRFeHRyYWN0ZWQub3V0cyk7XG5cbiAgICAgICAgLy8gdW5pZm9ybXMgLSBtZXJnZSB2ZXJ0ZXggYW5kIGZyYWdtZW50IHVuaWZvcm1zLCBhbmQgY3JlYXRlIHNoYXJlZCB1bmlmb3JtIGJ1ZmZlcnNcbiAgICAgICAgLy8gTm90ZSB0aGF0IGFzIGJvdGggdmVydGV4IGFuZCBmcmFnbWVudCBjYW4gZGVjbGFyZSB0aGUgc2FtZSB1bmlmb3JtLCB3ZSBuZWVkIHRvIHJlbW92ZSBkdXBsaWNhdGVzXG4gICAgICAgIGNvbnN0IGNvbmNhdFVuaWZvcm1zID0gdmVydGV4RXh0cmFjdGVkLnVuaWZvcm1zLmNvbmNhdChmcmFnbWVudEV4dHJhY3RlZC51bmlmb3Jtcyk7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zID0gQXJyYXkuZnJvbShuZXcgU2V0KGNvbmNhdFVuaWZvcm1zKSk7XG5cbiAgICAgICAgLy8gcGFyc2UgdW5pZm9ybSBsaW5lc1xuICAgICAgICBjb25zdCBwYXJzZWRVbmlmb3JtcyA9IHVuaWZvcm1zLm1hcChsaW5lID0+IG5ldyBVbmlmb3JtTGluZShsaW5lLCBzaGFkZXIpKTtcblxuICAgICAgICAvLyB2YWxpZGF0aW9uIC0gYXMgdW5pZm9ybXMgZ28gdG8gYSBzaGFyZWQgdW5pZm9ybSBidWZmZXIsIHZlcnRleCBhbmQgZnJhZ21lbnQgdmVyc2lvbnMgbmVlZCB0byBtYXRjaFxuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgIHBhcnNlZFVuaWZvcm1zLmZvckVhY2goKHVuaSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gbWFwLmdldCh1bmkubmFtZSk7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCFleGlzdGluZywgYFZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycyBjYW5ub3QgdXNlIHRoZSBzYW1lIHVuaWZvcm0gbmFtZSB3aXRoIGRpZmZlcmVudCB0eXBlczogJyR7ZXhpc3Rpbmd9JyBhbmQgJyR7dW5pLmxpbmV9J2AsIHNoYWRlcik7XG4gICAgICAgICAgICAgICAgbWFwLnNldCh1bmkubmFtZSwgdW5pLmxpbmUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB1bmlmb3Jtc0RhdGEgPSBTaGFkZXJQcm9jZXNzb3IucHJvY2Vzc1VuaWZvcm1zKGRldmljZSwgcGFyc2VkVW5pZm9ybXMsIHNoYWRlckRlZmluaXRpb24ucHJvY2Vzc2luZ09wdGlvbnMsIHNoYWRlcik7XG5cbiAgICAgICAgLy8gVlMgLSBpbnNlcnQgdGhlIGJsb2NrcyB0byB0aGUgc291cmNlXG4gICAgICAgIGNvbnN0IHZCbG9jayA9IGF0dHJpYnV0ZXNCbG9jayArICdcXG4nICsgdmVydGV4VmFyeWluZ3NCbG9jayArICdcXG4nICsgdW5pZm9ybXNEYXRhLmNvZGU7XG4gICAgICAgIGNvbnN0IHZzaGFkZXIgPSB2ZXJ0ZXhFeHRyYWN0ZWQuc3JjLnJlcGxhY2UoTUFSS0VSLCB2QmxvY2spO1xuXG4gICAgICAgIC8vIEZTIC0gaW5zZXJ0IHRoZSBibG9ja3MgdG8gdGhlIHNvdXJjZVxuICAgICAgICBjb25zdCBmQmxvY2sgPSBmcmFnbWVudFZhcnlpbmdzQmxvY2sgKyAnXFxuJyArIG91dEJsb2NrICsgJ1xcbicgKyB1bmlmb3Jtc0RhdGEuY29kZTtcbiAgICAgICAgY29uc3QgZnNoYWRlciA9IGZyYWdtZW50RXh0cmFjdGVkLnNyYy5yZXBsYWNlKE1BUktFUiwgZkJsb2NrKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdnNoYWRlcjogdnNoYWRlcixcbiAgICAgICAgICAgIGZzaGFkZXI6IGZzaGFkZXIsXG4gICAgICAgICAgICBtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDogdW5pZm9ybXNEYXRhLm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0LFxuICAgICAgICAgICAgbWVzaEJpbmRHcm91cEZvcm1hdDogdW5pZm9ybXNEYXRhLm1lc2hCaW5kR3JvdXBGb3JtYXRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBFeHRyYWN0IHJlcXVpcmVkIGluZm9ybWF0aW9uIGZyb20gdGhlIHNoYWRlciBzb3VyY2UgY29kZS5cbiAgICBzdGF0aWMgZXh0cmFjdChzcmMpIHtcblxuICAgICAgICAvLyBjb2xsZWN0ZWQgZGF0YVxuICAgICAgICBjb25zdCBhdHRyaWJ1dGVzID0gW107XG4gICAgICAgIGNvbnN0IHZhcnlpbmdzID0gW107XG4gICAgICAgIGNvbnN0IG91dHMgPSBbXTtcbiAgICAgICAgY29uc3QgdW5pZm9ybXMgPSBbXTtcblxuICAgICAgICAvLyByZXBsYWNlbWVudCBtYXJrZXIgLSBtYXJrIGEgZmlyc3QgcmVwbGFjZW1lbnQgcGxhY2UsIHRoaXMgaXMgd2hlcmUgY29kZVxuICAgICAgICAvLyBibG9ja3MgYXJlIGluamVjdGVkIGxhdGVyXG4gICAgICAgIGxldCByZXBsYWNlbWVudCA9IGAke01BUktFUn1cXG5gO1xuXG4gICAgICAgIC8vIGV4dHJhY3QgcmVsZXZhbnQgcGFydHMgb2YgdGhlIHNoYWRlclxuICAgICAgICBsZXQgbWF0Y2g7XG4gICAgICAgIHdoaWxlICgobWF0Y2ggPSBLRVlXT1JELmV4ZWMoc3JjKSkgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgY29uc3Qga2V5d29yZCA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgc3dpdGNoIChrZXl3b3JkKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnYXR0cmlidXRlJzpcbiAgICAgICAgICAgICAgICBjYXNlICd2YXJ5aW5nJzpcbiAgICAgICAgICAgICAgICBjYXNlICd1bmlmb3JtJzpcbiAgICAgICAgICAgICAgICBjYXNlICdvdXQnOiB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVhZCB0aGUgbGluZVxuICAgICAgICAgICAgICAgICAgICBLRVlXT1JEX0xJTkUubGFzdEluZGV4ID0gbWF0Y2guaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVNYXRjaCA9IEtFWVdPUkRfTElORS5leGVjKHNyYyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleXdvcmQgPT09ICdhdHRyaWJ1dGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzLnB1c2gobGluZU1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXl3b3JkID09PSAndmFyeWluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcnlpbmdzLnB1c2gobGluZU1hdGNoWzJdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChrZXl3b3JkID09PSAnb3V0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3V0cy5wdXNoKGxpbmVNYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5d29yZCA9PT0gJ3VuaWZvcm0nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlmb3Jtcy5wdXNoKGxpbmVNYXRjaFsyXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBjdXQgaXQgb3V0XG4gICAgICAgICAgICAgICAgICAgIHNyYyA9IFNoYWRlclByb2Nlc3Nvci5jdXRPdXQoc3JjLCBtYXRjaC5pbmRleCwgS0VZV09SRF9MSU5FLmxhc3RJbmRleCwgcmVwbGFjZW1lbnQpO1xuICAgICAgICAgICAgICAgICAgICBLRVlXT1JELmxhc3RJbmRleCA9IG1hdGNoLmluZGV4ICsgcmVwbGFjZW1lbnQubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgcGxhY2UgYSBzaW5nbGUgcmVwbGFjZW1lbnQgbWFya2VyXG4gICAgICAgICAgICAgICAgICAgIHJlcGxhY2VtZW50ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzcmMsXG4gICAgICAgICAgICBhdHRyaWJ1dGVzLFxuICAgICAgICAgICAgdmFyeWluZ3MsXG4gICAgICAgICAgICBvdXRzLFxuICAgICAgICAgICAgdW5pZm9ybXNcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBsaW5lcyB3aXRoIHVuaWZvcm1zLiBUaGUgZnVuY3Rpb24gcmVjZWl2ZXMgdGhlIGxpbmVzIGNvbnRhaW5pbmcgYWxsIHVuaWZvcm1zLFxuICAgICAqIGJvdGggbnVtZXJpY2FsIGFzIHdlbGwgYXMgdGV4dHVyZXMvc2FtcGxlcnMuIFRoZSBmdW5jdGlvbiBhbHNvIHJlY2VpdmVzIHRoZSBmb3JtYXQgb2YgdW5pZm9ybVxuICAgICAqIGJ1ZmZlcnMgKG51bWVyaWNhbCkgYW5kIGJpbmQgZ3JvdXBzICh0ZXh0dXJlcykgZm9yIHZpZXcgYW5kIG1hdGVyaWFsIGxldmVsLiBBbGwgdW5pZm9ybXMgdGhhdFxuICAgICAqIG1hdGNoIGFueSBvZiB0aG9zZSBhcmUgaWdub3JlZCwgYXMgdGhvc2Ugd291bGQgYmUgc3VwcGxpZWQgYnkgdmlldyAvIG1hdGVyaWFsIGxldmVsIGJ1ZmZlcnMuXG4gICAgICogQWxsIGxlZnRvdmVyIHVuaWZvcm1zIGNyZWF0ZSB1bmlmb3JtIGJ1ZmZlciBhbmQgYmluZCBncm91cCBmb3IgdGhlIG1lc2ggaXRzZWxmLCBjb250YWluaW5nXG4gICAgICogdW5pZm9ybXMgdGhhdCBjaGFuZ2Ugb24gdGhlIGxldmVsIG9mIHRoZSBtZXNoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtBcnJheTxVbmlmb3JtTGluZT59IHVuaWZvcm1zIC0gTGluZXMgY29udGFpbmluZyB1bmlmb3Jtcy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zaGFkZXItcHJvY2Vzc29yLW9wdGlvbnMuanMnKS5TaGFkZXJQcm9jZXNzb3JPcHRpb25zfSBwcm9jZXNzaW5nT3B0aW9ucyAtXG4gICAgICogVW5pZm9ybSBmb3JtYXRzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IC0gVGhlIHVuaWZvcm0gZGF0YS4gUmV0dXJucyBhIHNoYWRlciBjb2RlIGJsb2NrIGNvbnRhaW5pbmcgdW5pZm9ybXMsIHRvIGJlXG4gICAgICogaW5zZXJ0ZWQgaW50byB0aGUgc2hhZGVyLCBhcyB3ZWxsIGFzIGdlbmVyYXRlZCB1bmlmb3JtIGZvcm1hdCBzdHJ1Y3R1cmVzIGZvciB0aGUgbWVzaCBsZXZlbC5cbiAgICAgKi9cbiAgICBzdGF0aWMgcHJvY2Vzc1VuaWZvcm1zKGRldmljZSwgdW5pZm9ybXMsIHByb2Nlc3NpbmdPcHRpb25zLCBzaGFkZXIpIHtcblxuICAgICAgICAvLyBzcGxpdCB1bmlmb3JtIGxpbmVzIGludG8gc2FtcGxlcnMgYW5kIHRoZSByZXN0XG4gICAgICAgIC8qKiBAdHlwZSB7QXJyYXk8VW5pZm9ybUxpbmU+fSAqL1xuICAgICAgICBjb25zdCB1bmlmb3JtTGluZXNTYW1wbGVycyA9IFtdO1xuICAgICAgICAvKiogQHR5cGUge0FycmF5PFVuaWZvcm1MaW5lPn0gKi9cbiAgICAgICAgY29uc3QgdW5pZm9ybUxpbmVzTm9uU2FtcGxlcnMgPSBbXTtcbiAgICAgICAgdW5pZm9ybXMuZm9yRWFjaCgodW5pZm9ybSkgPT4ge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0uaXNTYW1wbGVyKSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybUxpbmVzU2FtcGxlcnMucHVzaCh1bmlmb3JtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybUxpbmVzTm9uU2FtcGxlcnMucHVzaCh1bmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gYnVpbGQgbWVzaCB1bmlmb3JtIGJ1ZmZlciBmb3JtYXRcbiAgICAgICAgY29uc3QgbWVzaFVuaWZvcm1zID0gW107XG4gICAgICAgIHVuaWZvcm1MaW5lc05vblNhbXBsZXJzLmZvckVhY2goKHVuaWZvcm0pID0+IHtcbiAgICAgICAgICAgIC8vIHVuaWZvcm1zIG5vdCBhbHJlYWR5IGluIHN1cHBsaWVkIHVuaWZvcm0gYnVmZmVycyBnbyB0byB0aGUgbWVzaCBidWZmZXJcbiAgICAgICAgICAgIGlmICghcHJvY2Vzc2luZ09wdGlvbnMuaGFzVW5pZm9ybSh1bmlmb3JtLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5pZm9ybVR5cGUgPSB1bmlmb3JtVHlwZVRvTmFtZS5pbmRleE9mKHVuaWZvcm0udHlwZSk7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHVuaWZvcm1UeXBlID49IDAsIGBVbmlmb3JtIHR5cGUgJHt1bmlmb3JtLnR5cGV9IGlzIG5vdCByZWNvZ25pemVkIG9uIGxpbmUgWyR7dW5pZm9ybS5saW5lfV1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmlmb3JtRm9ybWF0ID0gbmV3IFVuaWZvcm1Gb3JtYXQodW5pZm9ybS5uYW1lLCB1bmlmb3JtVHlwZSwgdW5pZm9ybS5hcnJheVNpemUpO1xuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCghdW5pZm9ybUZvcm1hdC5pbnZhbGlkLCBgSW52YWxpZCB1bmlmb3JtIGxpbmU6ICR7dW5pZm9ybS5saW5lfWAsIHNoYWRlcik7XG4gICAgICAgICAgICAgICAgbWVzaFVuaWZvcm1zLnB1c2godW5pZm9ybUZvcm1hdCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHZhbGlkYXRlIHR5cGVzIGluIGVsc2VcblxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQgPSBtZXNoVW5pZm9ybXMubGVuZ3RoID8gbmV3IFVuaWZvcm1CdWZmZXJGb3JtYXQoZGV2aWNlLCBtZXNoVW5pZm9ybXMpIDogbnVsbDtcblxuICAgICAgICAvLyBidWlsZCBtZXNoIGJpbmQgZ3JvdXAgZm9ybWF0IC0gc3RhcnQgd2l0aCB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICBjb25zdCBidWZmZXJGb3JtYXRzID0gW107XG4gICAgICAgIGlmIChtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCkge1xuICAgICAgICAgICAgLy8gVE9ETzogd2UgY291bGQgb3B0aW1pemUgdmlzaWJpbGl0eSB0byBvbmx5IHN0YWdlcyB0aGF0IHVzZSBhbnkgb2YgdGhlIGRhdGFcbiAgICAgICAgICAgIGJ1ZmZlckZvcm1hdHMucHVzaChuZXcgQmluZEJ1ZmZlckZvcm1hdChVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSwgU0hBREVSU1RBR0VfVkVSVEVYIHwgU0hBREVSU1RBR0VfRlJBR01FTlQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZCB0ZXh0dXJlcyB1bmlmb3Jtc1xuICAgICAgICBjb25zdCB0ZXh0dXJlRm9ybWF0cyA9IFtdO1xuICAgICAgICB1bmlmb3JtTGluZXNTYW1wbGVycy5mb3JFYWNoKCh1bmlmb3JtKSA9PiB7XG4gICAgICAgICAgICAvLyB1bm1hdGNoZWQgdGV4dHVyZSB1bmlmb3JtcyBnbyB0byBtZXNoIGJsb2NrXG4gICAgICAgICAgICBpZiAoIXByb2Nlc3NpbmdPcHRpb25zLmhhc1RleHR1cmUodW5pZm9ybS5uYW1lKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gc2FtcGxlIHR5cGVcbiAgICAgICAgICAgICAgICAvLyBXZWJHcHUgZG9lcyBub3QgY3VycmVudGx5IHN1cHBvcnQgZmlsdGVyZWQgZmxvYXQgZm9ybWF0IHRleHR1cmVzLCBhbmQgc28gd2UgbWFwIHRoZW0gdG8gdW5maWx0ZXJhYmxlIHR5cGVcbiAgICAgICAgICAgICAgICAvLyBhcyB3ZSBzYW1wbGUgdGhlbSB3aXRob3V0IGZpbHRlcmluZyBhbnl3YXlzXG4gICAgICAgICAgICAgICAgbGV0IHNhbXBsZVR5cGUgPSBTQU1QTEVUWVBFX0ZMT0FUO1xuICAgICAgICAgICAgICAgIGlmICh1bmlmb3JtLnByZWNpc2lvbiA9PT0gJ2hpZ2hwJylcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUO1xuICAgICAgICAgICAgICAgIGlmIChzaGFkb3dTYW1wbGVycy5oYXModW5pZm9ybS50eXBlKSlcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlVHlwZSA9IFNBTVBMRVRZUEVfREVQVEg7XG5cbiAgICAgICAgICAgICAgICAvLyBkaW1lbnNpb25cbiAgICAgICAgICAgICAgICBjb25zdCBkaW1lbnNpb24gPSB0ZXh0dXJlRGltZW5zaW9uc1t1bmlmb3JtLnR5cGVdO1xuXG4gICAgICAgICAgICAgICAgLy8gVE9ETzogd2UgY291bGQgb3B0aW1pemUgdmlzaWJpbGl0eSB0byBvbmx5IHN0YWdlcyB0aGF0IHVzZSBhbnkgb2YgdGhlIGRhdGFcbiAgICAgICAgICAgICAgICB0ZXh0dXJlRm9ybWF0cy5wdXNoKG5ldyBCaW5kVGV4dHVyZUZvcm1hdCh1bmlmb3JtLm5hbWUsIFNIQURFUlNUQUdFX1ZFUlRFWCB8IFNIQURFUlNUQUdFX0ZSQUdNRU5ULCBkaW1lbnNpb24sIHNhbXBsZVR5cGUpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdmFsaWRhdGUgdHlwZXMgaW4gZWxzZVxuXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBtZXNoQmluZEdyb3VwRm9ybWF0ID0gbmV3IEJpbmRHcm91cEZvcm1hdChkZXZpY2UsIGJ1ZmZlckZvcm1hdHMsIHRleHR1cmVGb3JtYXRzKTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSBjb2RlIGZvciB1bmlmb3JtIGJ1ZmZlcnNcbiAgICAgICAgbGV0IGNvZGUgPSAnJztcbiAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnMudW5pZm9ybUZvcm1hdHMuZm9yRWFjaCgoZm9ybWF0LCBiaW5kR3JvdXBJbmRleCkgPT4ge1xuICAgICAgICAgICAgaWYgKGZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNvZGUgKz0gZm9ybWF0LmdldFNoYWRlckRlY2xhcmF0aW9uKGJpbmRHcm91cEluZGV4LCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gYW5kIGFsc28gZm9yIGdlbmVyYXRlZCBtZXNoIGZvcm1hdCwgd2hpY2ggaXMgYXQgdGhlIHNsb3QgMCBvZiB0aGUgYmluZCBncm91cFxuICAgICAgICBpZiAobWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQpIHtcbiAgICAgICAgICAgIGNvZGUgKz0gbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQuZ2V0U2hhZGVyRGVjbGFyYXRpb24oQklOREdST1VQX01FU0gsIDApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgY29kZSBmb3IgdGV4dHVyZXNcbiAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnMuYmluZEdyb3VwRm9ybWF0cy5mb3JFYWNoKChmb3JtYXQsIGJpbmRHcm91cEluZGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSBmb3JtYXQuZ2V0U2hhZGVyRGVjbGFyYXRpb25UZXh0dXJlcyhiaW5kR3JvdXBJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGFuZCBhbHNvIGZvciBnZW5lcmF0ZWQgbWVzaCBmb3JtYXRcbiAgICAgICAgY29kZSArPSBtZXNoQmluZEdyb3VwRm9ybWF0LmdldFNoYWRlckRlY2xhcmF0aW9uVGV4dHVyZXMoQklOREdST1VQX01FU0gpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgbWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQsXG4gICAgICAgICAgICBtZXNoQmluZEdyb3VwRm9ybWF0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgc3RhdGljIHByb2Nlc3NWYXJ5aW5ncyh2YXJ5aW5nTGluZXMsIHZhcnlpbmdNYXAsIGlzVmVydGV4KSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBjb25zdCBvcCA9IGlzVmVydGV4ID8gJ291dCcgOiAnaW4nO1xuICAgICAgICB2YXJ5aW5nTGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmRzID0gU2hhZGVyUHJvY2Vzc29yLnNwbGl0VG9Xb3JkcyhsaW5lKTtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSB3b3Jkc1swXTtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSB3b3Jkc1sxXTtcblxuICAgICAgICAgICAgaWYgKGlzVmVydGV4KSB7XG4gICAgICAgICAgICAgICAgLy8gc3RvcmUgaXQgaW4gdGhlIG1hcFxuICAgICAgICAgICAgICAgIHZhcnlpbmdNYXAuc2V0KG5hbWUsIGluZGV4KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZhcnlpbmdNYXAuaGFzKG5hbWUpLCBgRnJhZ21lbnQgc2hhZGVyIHJlcXVpcmVzIHZhcnlpbmcgWyR7bmFtZX1dIGJ1dCB2ZXJ0ZXggc2hhZGVyIGRvZXMgbm90IGdlbmVyYXRlIGl0LmApO1xuICAgICAgICAgICAgICAgIGluZGV4ID0gdmFyeWluZ01hcC5nZXQobmFtZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIGluIHZlYzQgcG9zaXRpb247J1xuICAgICAgICAgICAgYmxvY2sgKz0gYGxheW91dChsb2NhdGlvbiA9ICR7aW5kZXh9KSAke29wfSAke3R5cGV9ICR7bmFtZX07XFxuYDtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBibG9jaztcbiAgICB9XG5cbiAgICBzdGF0aWMgcHJvY2Vzc091dHMob3V0c0xpbmVzKSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBvdXRzTGluZXMuZm9yRWFjaCgobGluZSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgIC8vIGdlbmVyYXRlczogJ2xheW91dChsb2NhdGlvbiA9IDApIG91dCB2ZWM0IGdsX0ZyYWdDb2xvcjsnXG4gICAgICAgICAgICBibG9jayArPSBgbGF5b3V0KGxvY2F0aW9uID0gJHtpbmRleH0pIG91dCAke2xpbmV9O1xcbmA7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gYmxvY2s7XG4gICAgfVxuXG4gICAgLy8gZXh0cmFjdCBjb3VudCBmcm9tIHR5cGUgKCd2ZWMzJyA9PiAzLCAnZmxvYXQnID0+IDEpXG4gICAgc3RhdGljIGdldFR5cGVDb3VudCh0eXBlKSB7XG4gICAgICAgIGNvbnN0IGxhc3RDaGFyID0gdHlwZS5zdWJzdHJpbmcodHlwZS5sZW5ndGggLSAxKTtcbiAgICAgICAgY29uc3QgbnVtID0gcGFyc2VJbnQobGFzdENoYXIsIDEwKTtcbiAgICAgICAgcmV0dXJuIGlzTmFOKG51bSkgPyAxIDogbnVtO1xuICAgIH1cblxuICAgIHN0YXRpYyBwcm9jZXNzQXR0cmlidXRlcyhhdHRyaWJ1dGVMaW5lcywgc2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMsIHByb2Nlc3NpbmdPcHRpb25zKSB7XG4gICAgICAgIGxldCBibG9jayA9ICcnO1xuICAgICAgICBjb25zdCB1c2VkTG9jYXRpb25zID0ge307XG4gICAgICAgIGF0dHJpYnV0ZUxpbmVzLmZvckVhY2goKGxpbmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHdvcmRzID0gU2hhZGVyUHJvY2Vzc29yLnNwbGl0VG9Xb3JkcyhsaW5lKTtcbiAgICAgICAgICAgIGxldCB0eXBlID0gd29yZHNbMF07XG4gICAgICAgICAgICBsZXQgbmFtZSA9IHdvcmRzWzFdO1xuXG4gICAgICAgICAgICBpZiAoc2hhZGVyRGVmaW5pdGlvbkF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IHNoYWRlckRlZmluaXRpb25BdHRyaWJ1dGVzW25hbWVdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gc2VtYW50aWNUb0xvY2F0aW9uW3NlbWFudGljXTtcblxuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCghdXNlZExvY2F0aW9ucy5oYXNPd25Qcm9wZXJ0eShsb2NhdGlvbiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBXQVJOSU5HOiBUd28gdmVydGV4IGF0dHJpYnV0ZXMgYXJlIG1hcHBlZCB0byB0aGUgc2FtZSBsb2NhdGlvbiBpbiBhIHNoYWRlcjogJHt1c2VkTG9jYXRpb25zW2xvY2F0aW9uXX0gYW5kICR7c2VtYW50aWN9YCk7XG4gICAgICAgICAgICAgICAgdXNlZExvY2F0aW9uc1tsb2NhdGlvbl0gPSBzZW1hbnRpYztcblxuICAgICAgICAgICAgICAgIC8vIGlmIHZlcnRleCBmb3JtYXQgZm9yIHRoaXMgYXR0cmlidXRlIGlzIG5vdCBvZiBhIGZsb2F0IHR5cGUsIHdlIG5lZWQgdG8gYWRqdXN0IHRoZSBhdHRyaWJ1dGUgZm9ybWF0LCBmb3IgZXhhbXBsZSB3ZSBjb252ZXJ0XG4gICAgICAgICAgICAgICAgLy8gICAgICBhdHRyaWJ1dGUgdmVjNCB2ZXJ0ZXhfcG9zaXRpb247XG4gICAgICAgICAgICAgICAgLy8gdG9cbiAgICAgICAgICAgICAgICAvLyAgICAgIGF0dHJpYnV0ZSBpdmVjNCBfcHJpdmF0ZV92ZXJ0ZXhfcG9zaXRpb247XG4gICAgICAgICAgICAgICAgLy8gICAgICB2ZWM0IHZlcnRleF9wb3NpdGlvbiA9IHZlYzQoX3ByaXZhdGVfdmVydGV4X3Bvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAvLyBOb3RlIHRoYXQgd2Ugc2tpcCBub3JtYWxpemVkIGVsZW1lbnRzLCBhcyBzaGFkZXIgcmVjZWl2ZXMgdGhlbSBhcyBmbG9hdHMgYWxyZWFkeS5cbiAgICAgICAgICAgICAgICBsZXQgY29weUNvZGU7XG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHByb2Nlc3NpbmdPcHRpb25zLmdldFZlcnRleEVsZW1lbnQoc2VtYW50aWMpO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFUeXBlID0gZWxlbWVudC5kYXRhVHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGFUeXBlICE9PSBUWVBFX0ZMT0FUMzIgJiYgIWVsZW1lbnQubm9ybWFsaXplKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGF0dHJpYk51bUVsZW1lbnRzID0gU2hhZGVyUHJvY2Vzc29yLmdldFR5cGVDb3VudCh0eXBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld05hbWUgPSBgX3ByaXZhdGVfJHtuYW1lfWA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNlY29uZCBsaW5lIG9mIG5ldyBjb2RlLCBjb3B5IHByaXZhdGUgKHUpaW50IHR5cGUgaW50byB2ZWMgdHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgY29weUNvZGUgPSBgdmVjJHthdHRyaWJOdW1FbGVtZW50c30gJHtuYW1lfSA9IHZlYyR7YXR0cmliTnVtRWxlbWVudHN9KCR7bmV3TmFtZX0pO1xcbmA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgPSBuZXdOYW1lO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXcgYXR0cmlidXRlIHR5cGUsIGJhc2VkIG9uIHRoZSB2ZXJ0ZXggZm9ybWF0IGVsZW1lbnQgdHlwZSwgZXhhbXBsZTogdmVjMyAtPiBpdmVjM1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNTaWduZWRUeXBlID0gZGF0YVR5cGUgPT09IFRZUEVfSU5UOCB8fCBkYXRhVHlwZSA9PT0gVFlQRV9JTlQxNiB8fCBkYXRhVHlwZSA9PT0gVFlQRV9JTlQzMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhdHRyaWJOdW1FbGVtZW50cyA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUgPSBpc1NpZ25lZFR5cGUgPyAnaW50JyA6ICd1aW50JztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9IGlzU2lnbmVkVHlwZSA/IGBpdmVjJHthdHRyaWJOdW1FbGVtZW50c31gIDogYHV2ZWMke2F0dHJpYk51bUVsZW1lbnRzfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBnZW5lcmF0ZXM6ICdsYXlvdXQobG9jYXRpb24gPSAwKSBpbiB2ZWM0IHBvc2l0aW9uOydcbiAgICAgICAgICAgICAgICBibG9jayArPSBgbGF5b3V0KGxvY2F0aW9uID0gJHtsb2NhdGlvbn0pIGluICR7dHlwZX0gJHtuYW1lfTtcXG5gO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNvcHlDb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2NrICs9IGNvcHlDb2RlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBibG9jaztcbiAgICB9XG5cbiAgICBzdGF0aWMgc3BsaXRUb1dvcmRzKGxpbmUpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFueSBkb3VibGUgc3BhY2VzXG4gICAgICAgIGxpbmUgPSBsaW5lLnJlcGxhY2UoL1xccysvZywgJyAnKS50cmltKCk7XG4gICAgICAgIHJldHVybiBsaW5lLnNwbGl0KCcgJyk7XG4gICAgfVxuXG4gICAgc3RhdGljIGN1dE91dChzcmMsIHN0YXJ0LCBlbmQsIHJlcGxhY2VtZW50KSB7XG4gICAgICAgIHJldHVybiBzcmMuc3Vic3RyaW5nKDAsIHN0YXJ0KSArIHJlcGxhY2VtZW50ICsgc3JjLnN1YnN0cmluZyhlbmQpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2hhZGVyUHJvY2Vzc29yIH07XG4iXSwibmFtZXMiOlsiS0VZV09SRCIsIktFWVdPUkRfTElORSIsIk1BUktFUiIsIkFSUkFZX0lERU5USUZJRVIiLCJwcmVjaXNpb25RdWFsaWZpZXJzIiwiU2V0Iiwic2hhZG93U2FtcGxlcnMiLCJ0ZXh0dXJlRGltZW5zaW9ucyIsInNhbXBsZXIyRCIsIlRFWFRVUkVESU1FTlNJT05fMkQiLCJzYW1wbGVyM0QiLCJURVhUVVJFRElNRU5TSU9OXzNEIiwic2FtcGxlckN1YmUiLCJURVhUVVJFRElNRU5TSU9OX0NVQkUiLCJzYW1wbGVyQ3ViZVNoYWRvdyIsInNhbXBsZXIyRFNoYWRvdyIsInNhbXBsZXIyREFycmF5IiwiVEVYVFVSRURJTUVOU0lPTl8yRF9BUlJBWSIsInNhbXBsZXIyREFycmF5U2hhZG93IiwiVW5pZm9ybUxpbmUiLCJjb25zdHJ1Y3RvciIsImxpbmUiLCJzaGFkZXIiLCJ3b3JkcyIsInRyaW0iLCJzcGxpdCIsImhhcyIsInByZWNpc2lvbiIsInNoaWZ0IiwidHlwZSIsImluY2x1ZGVzIiwiRGVidWciLCJlcnJvciIsInJlc3QiLCJqb2luIiwibWF0Y2giLCJleGVjIiwiYXNzZXJ0IiwibmFtZSIsImFycmF5U2l6ZSIsIk51bWJlciIsImlzTmFOIiwiZmFpbGVkIiwiaXNTYW1wbGVyIiwiaW5kZXhPZiIsIlNoYWRlclByb2Nlc3NvciIsInJ1biIsImRldmljZSIsInNoYWRlckRlZmluaXRpb24iLCJ2YXJ5aW5nTWFwIiwiTWFwIiwidmVydGV4RXh0cmFjdGVkIiwiZXh0cmFjdCIsInZzaGFkZXIiLCJmcmFnbWVudEV4dHJhY3RlZCIsImZzaGFkZXIiLCJhdHRyaWJ1dGVzQmxvY2siLCJwcm9jZXNzQXR0cmlidXRlcyIsImF0dHJpYnV0ZXMiLCJwcm9jZXNzaW5nT3B0aW9ucyIsInZlcnRleFZhcnlpbmdzQmxvY2siLCJwcm9jZXNzVmFyeWluZ3MiLCJ2YXJ5aW5ncyIsImZyYWdtZW50VmFyeWluZ3NCbG9jayIsIm91dEJsb2NrIiwicHJvY2Vzc091dHMiLCJvdXRzIiwiY29uY2F0VW5pZm9ybXMiLCJ1bmlmb3JtcyIsImNvbmNhdCIsIkFycmF5IiwiZnJvbSIsInBhcnNlZFVuaWZvcm1zIiwibWFwIiwiY2FsbCIsImZvckVhY2giLCJ1bmkiLCJleGlzdGluZyIsImdldCIsInNldCIsInVuaWZvcm1zRGF0YSIsInByb2Nlc3NVbmlmb3JtcyIsInZCbG9jayIsImNvZGUiLCJzcmMiLCJyZXBsYWNlIiwiZkJsb2NrIiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwicmVwbGFjZW1lbnQiLCJrZXl3b3JkIiwibGFzdEluZGV4IiwiaW5kZXgiLCJsaW5lTWF0Y2giLCJwdXNoIiwiY3V0T3V0IiwibGVuZ3RoIiwidW5pZm9ybUxpbmVzU2FtcGxlcnMiLCJ1bmlmb3JtTGluZXNOb25TYW1wbGVycyIsInVuaWZvcm0iLCJtZXNoVW5pZm9ybXMiLCJoYXNVbmlmb3JtIiwidW5pZm9ybVR5cGUiLCJ1bmlmb3JtVHlwZVRvTmFtZSIsInVuaWZvcm1Gb3JtYXQiLCJVbmlmb3JtRm9ybWF0IiwiaW52YWxpZCIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJidWZmZXJGb3JtYXRzIiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJ0ZXh0dXJlRm9ybWF0cyIsImhhc1RleHR1cmUiLCJzYW1wbGVUeXBlIiwiU0FNUExFVFlQRV9GTE9BVCIsIlNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUIiwiU0FNUExFVFlQRV9ERVBUSCIsImRpbWVuc2lvbiIsIkJpbmRUZXh0dXJlRm9ybWF0IiwiQmluZEdyb3VwRm9ybWF0IiwidW5pZm9ybUZvcm1hdHMiLCJmb3JtYXQiLCJiaW5kR3JvdXBJbmRleCIsImdldFNoYWRlckRlY2xhcmF0aW9uIiwiQklOREdST1VQX01FU0giLCJiaW5kR3JvdXBGb3JtYXRzIiwiZ2V0U2hhZGVyRGVjbGFyYXRpb25UZXh0dXJlcyIsInZhcnlpbmdMaW5lcyIsImlzVmVydGV4IiwiYmxvY2siLCJvcCIsInNwbGl0VG9Xb3JkcyIsIm91dHNMaW5lcyIsImdldFR5cGVDb3VudCIsImxhc3RDaGFyIiwic3Vic3RyaW5nIiwibnVtIiwicGFyc2VJbnQiLCJhdHRyaWJ1dGVMaW5lcyIsInNoYWRlckRlZmluaXRpb25BdHRyaWJ1dGVzIiwidXNlZExvY2F0aW9ucyIsImhhc093blByb3BlcnR5Iiwic2VtYW50aWMiLCJsb2NhdGlvbiIsInNlbWFudGljVG9Mb2NhdGlvbiIsImNvcHlDb2RlIiwiZWxlbWVudCIsImdldFZlcnRleEVsZW1lbnQiLCJkYXRhVHlwZSIsIlRZUEVfRkxPQVQzMiIsIm5vcm1hbGl6ZSIsImF0dHJpYk51bUVsZW1lbnRzIiwibmV3TmFtZSIsImlzU2lnbmVkVHlwZSIsIlRZUEVfSU5UOCIs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