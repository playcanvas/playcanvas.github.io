/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { now } from '../../core/time.js';
import { ShaderInput } from '../shader-input.js';
import { semanticToLocation, SHADERTAG_MATERIAL } from '../constants.js';

const _vertexShaderBuiltins = ['gl_VertexID', 'gl_InstanceID', 'gl_DrawID', 'gl_BaseVertex', 'gl_BaseInstance'];

class WebglShader {
  constructor(shader) {
    this.init();
    this.compileAndLink(shader.device, shader);
    shader.device.shaders.push(shader);
  }

  destroy(shader) {
    const device = shader.device;
    const idx = device.shaders.indexOf(shader);

    if (idx !== -1) {
      device.shaders.splice(idx, 1);
    }

    if (this.glProgram) {
      device.gl.deleteProgram(this.glProgram);
      this.glProgram = null;
      device.removeShaderFromCache(shader);
    }
  }

  init() {
    this.uniforms = [];
    this.samplers = [];
    this.attributes = [];
    this.glProgram = null;
    this.glVertexShader = null;
    this.glFragmentShader = null;
  }

  loseContext() {
    this.init();
  }

  restoreContext(device, shader) {
    this.compileAndLink(device, shader);
  }

  compileAndLink(device, shader) {
    const definition = shader.definition;

    const glVertexShader = this._compileShaderSource(device, definition.vshader, true);

    const glFragmentShader = this._compileShaderSource(device, definition.fshader, false);

    const gl = device.gl;
    const glProgram = gl.createProgram();
    gl.attachShader(glProgram, glVertexShader);
    gl.attachShader(glProgram, glFragmentShader);
    const attrs = definition.attributes;

    if (device.webgl2 && definition.useTransformFeedback) {
      const outNames = [];

      for (const attr in attrs) {
        if (attrs.hasOwnProperty(attr)) {
          outNames.push("out_" + attr);
        }
      }

      gl.transformFeedbackVaryings(glProgram, outNames, gl.INTERLEAVED_ATTRIBS);
    }

    for (const attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        const semantic = attrs[attr];
        const loc = semanticToLocation[semantic];
        gl.bindAttribLocation(glProgram, loc, attr);
      }
    }

    gl.linkProgram(glProgram);
    this.glVertexShader = glVertexShader;
    this.glFragmentShader = glFragmentShader;
    this.glProgram = glProgram;
    device._shaderStats.linked++;

    if (definition.tag === SHADERTAG_MATERIAL) {
      device._shaderStats.materialShaders++;
    }
  }

  _compileShaderSource(device, src, isVertexShader) {
    const gl = device.gl;
    const shaderCache = isVertexShader ? device.vertexShaderCache : device.fragmentShaderCache;
    let glShader = shaderCache[src];

    if (!glShader) {
      const startTime = now();
      device.fire('shader:compile:start', {
        timestamp: startTime,
        target: device
      });
      glShader = gl.createShader(isVertexShader ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
      gl.shaderSource(glShader, src);
      gl.compileShader(glShader);
      shaderCache[src] = glShader;
      const endTime = now();
      device.fire('shader:compile:end', {
        timestamp: endTime,
        target: device
      });
      device._shaderStats.compileTime += endTime - startTime;

      if (isVertexShader) {
        device._shaderStats.vsCompiled++;
      } else {
        device._shaderStats.fsCompiled++;
      }
    }

    return glShader;
  }

  postLink(device, shader) {
    const gl = device.gl;
    const glProgram = this.glProgram;
    const definition = shader.definition;
    const startTime = now();
    device.fire('shader:link:start', {
      timestamp: startTime,
      target: device
    });
    if (!this._isCompiled(device, shader, this.glVertexShader, definition.vshader, "vertex")) return false;
    if (!this._isCompiled(device, shader, this.glFragmentShader, definition.fshader, "fragment")) return false;

    if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
      const message = "Failed to link shader program. Error: " + gl.getProgramInfoLog(glProgram);
      console.error(message);
      return false;
    }

    let i = 0;
    const numAttributes = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);

    while (i < numAttributes) {
      const info = gl.getActiveAttrib(glProgram, i++);
      const location = gl.getAttribLocation(glProgram, info.name);
      if (_vertexShaderBuiltins.indexOf(info.name) !== -1) continue;

      if (definition.attributes[info.name] === undefined) {
        console.error(`Vertex shader attribute "${info.name}" is not mapped to a semantic in shader definition.`);
      }

      const shaderInput = new ShaderInput(device, definition.attributes[info.name], device.pcUniformType[info.type], location);
      this.attributes.push(shaderInput);
    }

    i = 0;
    const numUniforms = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);

    while (i < numUniforms) {
      const info = gl.getActiveUniform(glProgram, i++);
      const location = gl.getUniformLocation(glProgram, info.name);
      const shaderInput = new ShaderInput(device, info.name, device.pcUniformType[info.type], location);

      if (info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_CUBE || device.webgl2 && (info.type === gl.SAMPLER_2D_SHADOW || info.type === gl.SAMPLER_CUBE_SHADOW || info.type === gl.SAMPLER_3D)) {
        this.samplers.push(shaderInput);
      } else {
        this.uniforms.push(shaderInput);
      }
    }

    shader.ready = true;
    const endTime = now();
    device.fire('shader:link:end', {
      timestamp: endTime,
      target: device
    });
    device._shaderStats.compileTime += endTime - startTime;
    return true;
  }

  _isCompiled(device, shader, glShader, source, shaderType) {
    const gl = device.gl;

    if (!gl.getShaderParameter(glShader, gl.COMPILE_STATUS)) {
      const infoLog = gl.getShaderInfoLog(glShader);

      const [code, error] = this._processError(source, infoLog);

      const message = `Failed to compile ${shaderType} shader:\n\n${infoLog}\n${code}`;
      console.error(message);
      return false;
    }

    return true;
  }

  _processError(src, infoLog) {
    const error = {};
    let code = '';

    if (src) {
      const lines = src.split('\n');
      let from = 0;
      let to = lines.length;

      if (infoLog && infoLog.startsWith('ERROR:')) {
        const match = infoLog.match(/^ERROR:\s([0-9]+):([0-9]+):\s*(.+)/);

        if (match) {
          error.message = match[3];
          error.line = parseInt(match[2], 10);
          from = Math.max(0, error.line - 6);
          to = Math.min(lines.length, error.line + 5);
        }
      }

      for (let i = from; i < to; i++) {
        code += i + 1 + ":\t" + lines[i] + '\n';
      }

      error.source = src;
    }

    return [code, error];
  }

}

export { WebglShader };
