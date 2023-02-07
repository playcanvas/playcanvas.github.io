/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { TRACEID_SHADER_COMPILE } from '../../../core/constants.js';
import { now } from '../../../core/time.js';
import { WebglShaderInput } from './webgl-shader-input.js';
import { semanticToLocation, SHADERTAG_MATERIAL } from '../constants.js';
import { DeviceCache } from '../device-cache.js';

let _totalCompileTime = 0;
const _vertexShaderBuiltins = ['gl_VertexID', 'gl_InstanceID', 'gl_DrawID', 'gl_BaseVertex', 'gl_BaseInstance'];

// class used to hold compiled WebGL vertex or fragment shaders in the device cache
class CompiledShaderCache {
  constructor() {
    this.map = new Map();
  }
  // destroy all created shaders when the device is destroyed
  destroy(device) {
    this.map.forEach(shader => {
      device.gl.deleteShader(shader);
    });
  }

  // just empty the cache when the context is lost
  loseContext(device) {
    this.map.clear();
  }
}

// class used to hold a list of recently created shaders forming a batch, to allow their more optimized compilation
class ShaderBatchCache {
  constructor() {
    this.shaders = [];
  }
  loseContext(device) {
    this.shaders = [];
  }
}
const _vertexShaderCache = new DeviceCache();
const _fragmentShaderCache = new DeviceCache();
const _shaderBatchCache = new DeviceCache();

/**
 * A WebGL implementation of the Shader.
 *
 * @ignore
 */
class WebglShader {
  constructor(shader) {
    this.compileDuration = 0;
    this.init();

    // kick off vertex and fragment shader compilation, but not linking here, as that would
    // make it blocking.
    this.compile(shader.device, shader);

    // add the shader to recently created list
    WebglShader.getBatchShaders(shader.device).push(shader);

    // add it to a device list of all shaders
    shader.device.shaders.push(shader);
  }

  /**
   * Free the WebGL resources associated with a shader.
   *
   * @param {import('../shader.js').Shader} shader - The shader to free.
   */
  destroy(shader) {
    if (this.glProgram) {
      shader.device.gl.deleteProgram(this.glProgram);
      this.glProgram = null;
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
  static getBatchShaders(device) {
    const batchCache = _shaderBatchCache.get(device, () => {
      return new ShaderBatchCache();
    });
    return batchCache.shaders;
  }
  static endShaderBatch(device) {
    // Trigger link step for all recently created shaders. This allows linking to be done in parallel, before
    // the blocking wait on the linking result is triggered in finalize function
    const shaders = WebglShader.getBatchShaders(device);
    shaders.forEach(shader => shader.impl.link(device, shader));
    shaders.length = 0;
  }

  /**
   * Dispose the shader when the context has been lost.
   */
  loseContext() {
    this.init();
  }

  /**
   * Restore shader after the context has been obtained.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to restore.
   */
  restoreContext(device, shader) {
    this.compile(device, shader);
  }

  /**
   * Compile shader programs.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to compile.
   */
  compile(device, shader) {
    const definition = shader.definition;
    this.glVertexShader = this._compileShaderSource(device, definition.vshader, true);
    this.glFragmentShader = this._compileShaderSource(device, definition.fshader, false);
  }

  /**
   * Link shader programs. This is called at a later stage, to allow many shaders to compile in parallel.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to compile.
   */
  link(device, shader) {
    // if the shader was already linked
    if (this.glProgram) return;
    let startTime = 0;
    Debug.call(() => {
      this.compileDuration = 0;
      startTime = now();
    });
    const gl = device.gl;
    const glProgram = gl.createProgram();
    this.glProgram = glProgram;
    gl.attachShader(glProgram, this.glVertexShader);
    gl.attachShader(glProgram, this.glFragmentShader);
    const definition = shader.definition;
    const attrs = definition.attributes;
    if (device.webgl2 && definition.useTransformFeedback) {
      // Collect all "out_" attributes and use them for output
      const outNames = [];
      for (const attr in attrs) {
        if (attrs.hasOwnProperty(attr)) {
          outNames.push("out_" + attr);
        }
      }
      gl.transformFeedbackVaryings(glProgram, outNames, gl.INTERLEAVED_ATTRIBS);
    }

    // map all vertex input attributes to fixed locations
    const locations = {};
    for (const attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        const semantic = attrs[attr];
        const loc = semanticToLocation[semantic];
        Debug.assert(!locations.hasOwnProperty(loc), `WARNING: Two attributes are mapped to the same location in a shader: ${locations[loc]} and ${attr}`);
        locations[loc] = attr;
        gl.bindAttribLocation(glProgram, loc, attr);
      }
    }
    gl.linkProgram(glProgram);
    Debug.call(() => {
      this.compileDuration = now() - startTime;
    });
    device._shaderStats.linked++;
    if (definition.tag === SHADERTAG_MATERIAL) {
      device._shaderStats.materialShaders++;
    }
  }

  /**
   * Compiles an individual shader.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {string} src - The shader source code.
   * @param {boolean} isVertexShader - True if the shader is a vertex shader, false if it is a
   * fragment shader.
   * @returns {WebGLShader} The compiled shader.
   * @private
   */
  _compileShaderSource(device, src, isVertexShader) {
    const gl = device.gl;

    // device cache for current device, containing cache of compiled shaders
    const shaderDeviceCache = isVertexShader ? _vertexShaderCache : _fragmentShaderCache;
    const shaderCache = shaderDeviceCache.get(device, () => {
      return new CompiledShaderCache();
    });

    // try to get compiled shader from the cache
    let glShader = shaderCache.map.get(src);
    if (!glShader) {
      const startTime = now();
      device.fire('shader:compile:start', {
        timestamp: startTime,
        target: device
      });
      glShader = gl.createShader(isVertexShader ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
      gl.shaderSource(glShader, src);
      gl.compileShader(glShader);
      shaderCache.map.set(src, glShader);
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

  /**
   * Link the shader, and extract its attributes and uniform information.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to query.
   * @returns {boolean} True if the shader was successfully queried and false otherwise.
   */
  finalize(device, shader) {
    // if the program wasn't linked yet (shader was not created in batch)
    if (!this.glProgram) this.link(device, shader);
    const gl = device.gl;
    const glProgram = this.glProgram;
    const definition = shader.definition;
    const startTime = now();
    device.fire('shader:link:start', {
      timestamp: startTime,
      target: device
    });

    // this is the main thead blocking part of the shader compilation, time it
    let linkStartTime = 0;
    Debug.call(() => {
      linkStartTime = now();
    });
    const linkStatus = gl.getProgramParameter(glProgram, gl.LINK_STATUS);
    if (!linkStatus) {
      var _gl$getExtension, _gl$getExtension2;
      // Check for compilation errors
      if (!this._isCompiled(device, shader, this.glVertexShader, definition.vshader, "vertex")) return false;
      if (!this._isCompiled(device, shader, this.glFragmentShader, definition.fshader, "fragment")) return false;
      const message = "Failed to link shader program. Error: " + gl.getProgramInfoLog(glProgram);

      // log translated shaders
      definition.translatedFrag = (_gl$getExtension = gl.getExtension('WEBGL_debug_shaders')) == null ? void 0 : _gl$getExtension.getTranslatedShaderSource(this.glFragmentShader);
      definition.translatedVert = (_gl$getExtension2 = gl.getExtension('WEBGL_debug_shaders')) == null ? void 0 : _gl$getExtension2.getTranslatedShaderSource(this.glVertexShader);
      console.error(message, definition);
      return false;
    }

    // Query the program for each vertex buffer input (GLSL 'attribute')
    let i = 0;
    const numAttributes = gl.getProgramParameter(glProgram, gl.ACTIVE_ATTRIBUTES);
    while (i < numAttributes) {
      const info = gl.getActiveAttrib(glProgram, i++);
      const location = gl.getAttribLocation(glProgram, info.name);

      // a built-in attributes for which we do not need to provide any data
      if (_vertexShaderBuiltins.indexOf(info.name) !== -1) continue;

      // Check attributes are correctly linked up
      if (definition.attributes[info.name] === undefined) {
        console.error(`Vertex shader attribute "${info.name}" is not mapped to a semantic in shader definition, shader [${shader.label}]`, shader);
        shader.failed = true;
      }
      const shaderInput = new WebglShaderInput(device, definition.attributes[info.name], device.pcUniformType[info.type], location);
      this.attributes.push(shaderInput);
    }

    // Query the program for each shader state (GLSL 'uniform')
    i = 0;
    const numUniforms = gl.getProgramParameter(glProgram, gl.ACTIVE_UNIFORMS);
    while (i < numUniforms) {
      const info = gl.getActiveUniform(glProgram, i++);
      const location = gl.getUniformLocation(glProgram, info.name);
      const shaderInput = new WebglShaderInput(device, info.name, device.pcUniformType[info.type], location);
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
    Debug.call(() => {
      const duration = now() - linkStartTime;
      this.compileDuration += duration;
      _totalCompileTime += this.compileDuration;
      Debug.trace(TRACEID_SHADER_COMPILE, `[id: ${shader.id}] ${shader.name}: ${this.compileDuration.toFixed(1)}ms, TOTAL: ${_totalCompileTime.toFixed(1)}ms`);
    });
    return true;
  }

  /**
   * Check the compilation status of a shader.
   *
   * @param {import('./webgl-graphics-device.js').WebglGraphicsDevice} device - The graphics device.
   * @param {import('../shader.js').Shader} shader - The shader to query.
   * @param {WebGLShader} glShader - The WebGL shader.
   * @param {string} source - The shader source code.
   * @param {string} shaderType - The shader type. Can be 'vertex' or 'fragment'.
   * @returns {boolean} True if the shader compiled successfully, false otherwise.
   * @private
   */
  _isCompiled(device, shader, glShader, source, shaderType) {
    const gl = device.gl;
    if (!gl.getShaderParameter(glShader, gl.COMPILE_STATUS)) {
      const infoLog = gl.getShaderInfoLog(glShader);
      const [code, error] = this._processError(source, infoLog);
      const message = `Failed to compile ${shaderType} shader:\n\n${infoLog}\n${code}`;
      error.shader = shader;
      console.error(message, error);
      return false;
    }
    return true;
  }

  /**
   * Truncate the WebGL shader compilation log to just include the error line plus the 5 lines
   * before and after it.
   *
   * @param {string} src - The shader source code.
   * @param {string} infoLog - The info log returned from WebGL on a failed shader compilation.
   * @returns {Array} An array where the first element is the 10 lines of code around the first
   * detected error, and the second element an object storing the error message, line number and
   * complete shader source.
   * @private
   */
  _processError(src, infoLog) {
    const error = {};
    let code = '';
    if (src) {
      const lines = src.split('\n');
      let from = 0;
      let to = lines.length;

      // if error is in the code, only show nearby lines instead of whole shader code
      if (infoLog && infoLog.startsWith('ERROR:')) {
        const match = infoLog.match(/^ERROR:\s([0-9]+):([0-9]+):\s*(.+)/);
        if (match) {
          error.message = match[3];
          error.line = parseInt(match[2], 10);
          from = Math.max(0, error.line - 6);
          to = Math.min(lines.length, error.line + 5);
        }
      }

      // Chrome reports shader errors on lines indexed from 1
      for (let i = from; i < to; i++) {
        code += i + 1 + ":\t" + lines[i] + '\n';
      }
      error.source = src;
    }
    return [code, error];
  }
}

export { WebglShader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtc2hhZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBUUkFDRUlEX1NIQURFUl9DT01QSUxFIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcblxuaW1wb3J0IHsgV2ViZ2xTaGFkZXJJbnB1dCB9IGZyb20gJy4vd2ViZ2wtc2hhZGVyLWlucHV0LmpzJztcbmltcG9ydCB7IFNIQURFUlRBR19NQVRFUklBTCwgc2VtYW50aWNUb0xvY2F0aW9uIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vZGV2aWNlLWNhY2hlLmpzJztcblxubGV0IF90b3RhbENvbXBpbGVUaW1lID0gMDtcblxuY29uc3QgX3ZlcnRleFNoYWRlckJ1aWx0aW5zID0gW1xuICAgICdnbF9WZXJ0ZXhJRCcsXG4gICAgJ2dsX0luc3RhbmNlSUQnLFxuICAgICdnbF9EcmF3SUQnLFxuICAgICdnbF9CYXNlVmVydGV4JyxcbiAgICAnZ2xfQmFzZUluc3RhbmNlJ1xuXTtcblxuLy8gY2xhc3MgdXNlZCB0byBob2xkIGNvbXBpbGVkIFdlYkdMIHZlcnRleCBvciBmcmFnbWVudCBzaGFkZXJzIGluIHRoZSBkZXZpY2UgY2FjaGVcbmNsYXNzIENvbXBpbGVkU2hhZGVyQ2FjaGUge1xuICAgIC8vIG1hcHMgc2hhZGVyIHNvdXJjZSB0byBhIGNvbXBpbGVkIFdlYkdMIHNoYWRlclxuICAgIG1hcCA9IG5ldyBNYXAoKTtcblxuICAgIC8vIGRlc3Ryb3kgYWxsIGNyZWF0ZWQgc2hhZGVycyB3aGVuIHRoZSBkZXZpY2UgaXMgZGVzdHJveWVkXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICAgICAgdGhpcy5tYXAuZm9yRWFjaCgoc2hhZGVyKSA9PiB7XG4gICAgICAgICAgICBkZXZpY2UuZ2wuZGVsZXRlU2hhZGVyKHNoYWRlcik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGp1c3QgZW1wdHkgdGhlIGNhY2hlIHdoZW4gdGhlIGNvbnRleHQgaXMgbG9zdFxuICAgIGxvc2VDb250ZXh0KGRldmljZSkge1xuICAgICAgICB0aGlzLm1hcC5jbGVhcigpO1xuICAgIH1cbn1cblxuLy8gY2xhc3MgdXNlZCB0byBob2xkIGEgbGlzdCBvZiByZWNlbnRseSBjcmVhdGVkIHNoYWRlcnMgZm9ybWluZyBhIGJhdGNoLCB0byBhbGxvdyB0aGVpciBtb3JlIG9wdGltaXplZCBjb21waWxhdGlvblxuY2xhc3MgU2hhZGVyQmF0Y2hDYWNoZSB7XG4gICAgc2hhZGVycyA9IFtdO1xuXG4gICAgbG9zZUNvbnRleHQoZGV2aWNlKSB7XG4gICAgICAgIHRoaXMuc2hhZGVycyA9IFtdO1xuICAgIH1cbn1cblxuY29uc3QgX3ZlcnRleFNoYWRlckNhY2hlID0gbmV3IERldmljZUNhY2hlKCk7XG5jb25zdCBfZnJhZ21lbnRTaGFkZXJDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuY29uc3QgX3NoYWRlckJhdGNoQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuLyoqXG4gKiBBIFdlYkdMIGltcGxlbWVudGF0aW9uIG9mIHRoZSBTaGFkZXIuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJnbFNoYWRlciB7XG4gICAgY29tcGlsZUR1cmF0aW9uID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHNoYWRlcikge1xuICAgICAgICB0aGlzLmluaXQoKTtcblxuICAgICAgICAvLyBraWNrIG9mZiB2ZXJ0ZXggYW5kIGZyYWdtZW50IHNoYWRlciBjb21waWxhdGlvbiwgYnV0IG5vdCBsaW5raW5nIGhlcmUsIGFzIHRoYXQgd291bGRcbiAgICAgICAgLy8gbWFrZSBpdCBibG9ja2luZy5cbiAgICAgICAgdGhpcy5jb21waWxlKHNoYWRlci5kZXZpY2UsIHNoYWRlcik7XG5cbiAgICAgICAgLy8gYWRkIHRoZSBzaGFkZXIgdG8gcmVjZW50bHkgY3JlYXRlZCBsaXN0XG4gICAgICAgIFdlYmdsU2hhZGVyLmdldEJhdGNoU2hhZGVycyhzaGFkZXIuZGV2aWNlKS5wdXNoKHNoYWRlcik7XG5cbiAgICAgICAgLy8gYWRkIGl0IHRvIGEgZGV2aWNlIGxpc3Qgb2YgYWxsIHNoYWRlcnNcbiAgICAgICAgc2hhZGVyLmRldmljZS5zaGFkZXJzLnB1c2goc2hhZGVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlIHRoZSBXZWJHTCByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBmcmVlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koc2hhZGVyKSB7XG4gICAgICAgIGlmICh0aGlzLmdsUHJvZ3JhbSkge1xuICAgICAgICAgICAgc2hhZGVyLmRldmljZS5nbC5kZWxldGVQcm9ncmFtKHRoaXMuZ2xQcm9ncmFtKTtcbiAgICAgICAgICAgIHRoaXMuZ2xQcm9ncmFtID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGluaXQoKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMgPSBbXTtcbiAgICAgICAgdGhpcy5zYW1wbGVycyA9IFtdO1xuICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSBbXTtcblxuICAgICAgICB0aGlzLmdsUHJvZ3JhbSA9IG51bGw7XG4gICAgICAgIHRoaXMuZ2xWZXJ0ZXhTaGFkZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmdsRnJhZ21lbnRTaGFkZXIgPSBudWxsO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXRCYXRjaFNoYWRlcnMoZGV2aWNlKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoQ2FjaGUgPSBfc2hhZGVyQmF0Y2hDYWNoZS5nZXQoZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFNoYWRlckJhdGNoQ2FjaGUoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBiYXRjaENhY2hlLnNoYWRlcnM7XG4gICAgfVxuXG4gICAgc3RhdGljIGVuZFNoYWRlckJhdGNoKGRldmljZSkge1xuXG4gICAgICAgIC8vIFRyaWdnZXIgbGluayBzdGVwIGZvciBhbGwgcmVjZW50bHkgY3JlYXRlZCBzaGFkZXJzLiBUaGlzIGFsbG93cyBsaW5raW5nIHRvIGJlIGRvbmUgaW4gcGFyYWxsZWwsIGJlZm9yZVxuICAgICAgICAvLyB0aGUgYmxvY2tpbmcgd2FpdCBvbiB0aGUgbGlua2luZyByZXN1bHQgaXMgdHJpZ2dlcmVkIGluIGZpbmFsaXplIGZ1bmN0aW9uXG4gICAgICAgIGNvbnN0IHNoYWRlcnMgPSBXZWJnbFNoYWRlci5nZXRCYXRjaFNoYWRlcnMoZGV2aWNlKTtcbiAgICAgICAgc2hhZGVycy5mb3JFYWNoKHNoYWRlciA9PiBzaGFkZXIuaW1wbC5saW5rKGRldmljZSwgc2hhZGVyKSk7XG4gICAgICAgIHNoYWRlcnMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXNwb3NlIHRoZSBzaGFkZXIgd2hlbiB0aGUgY29udGV4dCBoYXMgYmVlbiBsb3N0LlxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlIHNoYWRlciBhZnRlciB0aGUgY29udGV4dCBoYXMgYmVlbiBvYnRhaW5lZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdsLWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdsR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byByZXN0b3JlLlxuICAgICAqL1xuICAgIHJlc3RvcmVDb250ZXh0KGRldmljZSwgc2hhZGVyKSB7XG4gICAgICAgIHRoaXMuY29tcGlsZShkZXZpY2UsIHNoYWRlcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcGlsZSBzaGFkZXIgcHJvZ3JhbXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJnbC1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJnbEdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gY29tcGlsZS5cbiAgICAgKi9cbiAgICBjb21waWxlKGRldmljZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbiA9IHNoYWRlci5kZWZpbml0aW9uO1xuICAgICAgICB0aGlzLmdsVmVydGV4U2hhZGVyID0gdGhpcy5fY29tcGlsZVNoYWRlclNvdXJjZShkZXZpY2UsIGRlZmluaXRpb24udnNoYWRlciwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuZ2xGcmFnbWVudFNoYWRlciA9IHRoaXMuX2NvbXBpbGVTaGFkZXJTb3VyY2UoZGV2aWNlLCBkZWZpbml0aW9uLmZzaGFkZXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaW5rIHNoYWRlciBwcm9ncmFtcy4gVGhpcyBpcyBjYWxsZWQgYXQgYSBsYXRlciBzdGFnZSwgdG8gYWxsb3cgbWFueSBzaGFkZXJzIHRvIGNvbXBpbGUgaW4gcGFyYWxsZWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJnbC1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJnbEdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gY29tcGlsZS5cbiAgICAgKi9cbiAgICBsaW5rKGRldmljZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gaWYgdGhlIHNoYWRlciB3YXMgYWxyZWFkeSBsaW5rZWRcbiAgICAgICAgaWYgKHRoaXMuZ2xQcm9ncmFtKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCBzdGFydFRpbWUgPSAwO1xuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuY29tcGlsZUR1cmF0aW9uID0gMDtcbiAgICAgICAgICAgIHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBnbCA9IGRldmljZS5nbDtcbiAgICAgICAgY29uc3QgZ2xQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICAgICAgICB0aGlzLmdsUHJvZ3JhbSA9IGdsUHJvZ3JhbTtcblxuICAgICAgICBnbC5hdHRhY2hTaGFkZXIoZ2xQcm9ncmFtLCB0aGlzLmdsVmVydGV4U2hhZGVyKTtcbiAgICAgICAgZ2wuYXR0YWNoU2hhZGVyKGdsUHJvZ3JhbSwgdGhpcy5nbEZyYWdtZW50U2hhZGVyKTtcblxuICAgICAgICBjb25zdCBkZWZpbml0aW9uID0gc2hhZGVyLmRlZmluaXRpb247XG4gICAgICAgIGNvbnN0IGF0dHJzID0gZGVmaW5pdGlvbi5hdHRyaWJ1dGVzO1xuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMiAmJiBkZWZpbml0aW9uLnVzZVRyYW5zZm9ybUZlZWRiYWNrKSB7XG4gICAgICAgICAgICAvLyBDb2xsZWN0IGFsbCBcIm91dF9cIiBhdHRyaWJ1dGVzIGFuZCB1c2UgdGhlbSBmb3Igb3V0cHV0XG4gICAgICAgICAgICBjb25zdCBvdXROYW1lcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBhdHRyIGluIGF0dHJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dE5hbWVzLnB1c2goXCJvdXRfXCIgKyBhdHRyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBnbC50cmFuc2Zvcm1GZWVkYmFja1ZhcnlpbmdzKGdsUHJvZ3JhbSwgb3V0TmFtZXMsIGdsLklOVEVSTEVBVkVEX0FUVFJJQlMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFwIGFsbCB2ZXJ0ZXggaW5wdXQgYXR0cmlidXRlcyB0byBmaXhlZCBsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgbG9jYXRpb25zID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBpbiBhdHRycykge1xuICAgICAgICAgICAgaWYgKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBhdHRyc1thdHRyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsb2MgPSBzZW1hbnRpY1RvTG9jYXRpb25bc2VtYW50aWNdO1xuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCghbG9jYXRpb25zLmhhc093blByb3BlcnR5KGxvYyksIGBXQVJOSU5HOiBUd28gYXR0cmlidXRlcyBhcmUgbWFwcGVkIHRvIHRoZSBzYW1lIGxvY2F0aW9uIGluIGEgc2hhZGVyOiAke2xvY2F0aW9uc1tsb2NdfSBhbmQgJHthdHRyfWApO1xuXG4gICAgICAgICAgICAgICAgbG9jYXRpb25zW2xvY10gPSBhdHRyO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRBdHRyaWJMb2NhdGlvbihnbFByb2dyYW0sIGxvYywgYXR0cik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBnbC5saW5rUHJvZ3JhbShnbFByb2dyYW0pO1xuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jb21waWxlRHVyYXRpb24gPSBub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBkZXZpY2UuX3NoYWRlclN0YXRzLmxpbmtlZCsrO1xuICAgICAgICBpZiAoZGVmaW5pdGlvbi50YWcgPT09IFNIQURFUlRBR19NQVRFUklBTCkge1xuICAgICAgICAgICAgZGV2aWNlLl9zaGFkZXJTdGF0cy5tYXRlcmlhbFNoYWRlcnMrKztcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb21waWxlcyBhbiBpbmRpdmlkdWFsIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdsLWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdsR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNyYyAtIFRoZSBzaGFkZXIgc291cmNlIGNvZGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpc1ZlcnRleFNoYWRlciAtIFRydWUgaWYgdGhlIHNoYWRlciBpcyBhIHZlcnRleCBzaGFkZXIsIGZhbHNlIGlmIGl0IGlzIGFcbiAgICAgKiBmcmFnbWVudCBzaGFkZXIuXG4gICAgICogQHJldHVybnMge1dlYkdMU2hhZGVyfSBUaGUgY29tcGlsZWQgc2hhZGVyLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NvbXBpbGVTaGFkZXJTb3VyY2UoZGV2aWNlLCBzcmMsIGlzVmVydGV4U2hhZGVyKSB7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIC8vIGRldmljZSBjYWNoZSBmb3IgY3VycmVudCBkZXZpY2UsIGNvbnRhaW5pbmcgY2FjaGUgb2YgY29tcGlsZWQgc2hhZGVyc1xuICAgICAgICBjb25zdCBzaGFkZXJEZXZpY2VDYWNoZSA9IGlzVmVydGV4U2hhZGVyID8gX3ZlcnRleFNoYWRlckNhY2hlIDogX2ZyYWdtZW50U2hhZGVyQ2FjaGU7XG4gICAgICAgIGNvbnN0IHNoYWRlckNhY2hlID0gc2hhZGVyRGV2aWNlQ2FjaGUuZ2V0KGRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBDb21waWxlZFNoYWRlckNhY2hlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHRyeSB0byBnZXQgY29tcGlsZWQgc2hhZGVyIGZyb20gdGhlIGNhY2hlXG4gICAgICAgIGxldCBnbFNoYWRlciA9IHNoYWRlckNhY2hlLm1hcC5nZXQoc3JjKTtcblxuICAgICAgICBpZiAoIWdsU2hhZGVyKSB7XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6Y29tcGlsZTpzdGFydCcsIHtcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IHN0YXJ0VGltZSxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGRldmljZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgZ2xTaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoaXNWZXJ0ZXhTaGFkZXIgPyBnbC5WRVJURVhfU0hBREVSIDogZ2wuRlJBR01FTlRfU0hBREVSKTtcblxuICAgICAgICAgICAgZ2wuc2hhZGVyU291cmNlKGdsU2hhZGVyLCBzcmMpO1xuICAgICAgICAgICAgZ2wuY29tcGlsZVNoYWRlcihnbFNoYWRlcik7XG5cbiAgICAgICAgICAgIHNoYWRlckNhY2hlLm1hcC5zZXQoc3JjLCBnbFNoYWRlcik7XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIGNvbnN0IGVuZFRpbWUgPSBub3coKTtcbiAgICAgICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6Y29tcGlsZTplbmQnLCB7XG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBlbmRUaW1lLFxuICAgICAgICAgICAgICAgIHRhcmdldDogZGV2aWNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWUgKz0gZW5kVGltZSAtIHN0YXJ0VGltZTtcblxuICAgICAgICAgICAgaWYgKGlzVmVydGV4U2hhZGVyKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLl9zaGFkZXJTdGF0cy52c0NvbXBpbGVkKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRldmljZS5fc2hhZGVyU3RhdHMuZnNDb21waWxlZCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZ2xTaGFkZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGluayB0aGUgc2hhZGVyLCBhbmQgZXh0cmFjdCBpdHMgYXR0cmlidXRlcyBhbmQgdW5pZm9ybSBpbmZvcm1hdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdsLWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdsR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBxdWVyeS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2hhZGVyIHdhcyBzdWNjZXNzZnVsbHkgcXVlcmllZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGZpbmFsaXplKGRldmljZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gaWYgdGhlIHByb2dyYW0gd2Fzbid0IGxpbmtlZCB5ZXQgKHNoYWRlciB3YXMgbm90IGNyZWF0ZWQgaW4gYmF0Y2gpXG4gICAgICAgIGlmICghdGhpcy5nbFByb2dyYW0pXG4gICAgICAgICAgICB0aGlzLmxpbmsoZGV2aWNlLCBzaGFkZXIpO1xuXG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuICAgICAgICBjb25zdCBnbFByb2dyYW0gPSB0aGlzLmdsUHJvZ3JhbTtcbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbiA9IHNoYWRlci5kZWZpbml0aW9uO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6bGluazpzdGFydCcsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogc3RhcnRUaW1lLFxuICAgICAgICAgICAgdGFyZ2V0OiBkZXZpY2VcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHRoaXMgaXMgdGhlIG1haW4gdGhlYWQgYmxvY2tpbmcgcGFydCBvZiB0aGUgc2hhZGVyIGNvbXBpbGF0aW9uLCB0aW1lIGl0XG4gICAgICAgIGxldCBsaW5rU3RhcnRUaW1lID0gMDtcbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICBsaW5rU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGxpbmtTdGF0dXMgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKGdsUHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpO1xuICAgICAgICBpZiAoIWxpbmtTdGF0dXMpIHtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGNvbXBpbGF0aW9uIGVycm9yc1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0NvbXBpbGVkKGRldmljZSwgc2hhZGVyLCB0aGlzLmdsVmVydGV4U2hhZGVyLCBkZWZpbml0aW9uLnZzaGFkZXIsIFwidmVydGV4XCIpKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0NvbXBpbGVkKGRldmljZSwgc2hhZGVyLCB0aGlzLmdsRnJhZ21lbnRTaGFkZXIsIGRlZmluaXRpb24uZnNoYWRlciwgXCJmcmFnbWVudFwiKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBcIkZhaWxlZCB0byBsaW5rIHNoYWRlciBwcm9ncmFtLiBFcnJvcjogXCIgKyBnbC5nZXRQcm9ncmFtSW5mb0xvZyhnbFByb2dyYW0pO1xuXG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG5cbiAgICAgICAgICAgIC8vIGxvZyB0cmFuc2xhdGVkIHNoYWRlcnNcbiAgICAgICAgICAgIGRlZmluaXRpb24udHJhbnNsYXRlZEZyYWcgPSBnbC5nZXRFeHRlbnNpb24oJ1dFQkdMX2RlYnVnX3NoYWRlcnMnKT8uZ2V0VHJhbnNsYXRlZFNoYWRlclNvdXJjZSh0aGlzLmdsRnJhZ21lbnRTaGFkZXIpO1xuICAgICAgICAgICAgZGVmaW5pdGlvbi50cmFuc2xhdGVkVmVydCA9IGdsLmdldEV4dGVuc2lvbignV0VCR0xfZGVidWdfc2hhZGVycycpPy5nZXRUcmFuc2xhdGVkU2hhZGVyU291cmNlKHRoaXMuZ2xWZXJ0ZXhTaGFkZXIpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UsIGRlZmluaXRpb24pO1xuICAgICAgICAgICAgLy8gI2Vsc2VcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUXVlcnkgdGhlIHByb2dyYW0gZm9yIGVhY2ggdmVydGV4IGJ1ZmZlciBpbnB1dCAoR0xTTCAnYXR0cmlidXRlJylcbiAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICBjb25zdCBudW1BdHRyaWJ1dGVzID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihnbFByb2dyYW0sIGdsLkFDVElWRV9BVFRSSUJVVEVTKTtcbiAgICAgICAgd2hpbGUgKGkgPCBudW1BdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBjb25zdCBpbmZvID0gZ2wuZ2V0QWN0aXZlQXR0cmliKGdsUHJvZ3JhbSwgaSsrKTtcbiAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24oZ2xQcm9ncmFtLCBpbmZvLm5hbWUpO1xuXG4gICAgICAgICAgICAvLyBhIGJ1aWx0LWluIGF0dHJpYnV0ZXMgZm9yIHdoaWNoIHdlIGRvIG5vdCBuZWVkIHRvIHByb3ZpZGUgYW55IGRhdGFcbiAgICAgICAgICAgIGlmIChfdmVydGV4U2hhZGVyQnVpbHRpbnMuaW5kZXhPZihpbmZvLm5hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgYXR0cmlidXRlcyBhcmUgY29ycmVjdGx5IGxpbmtlZCB1cFxuICAgICAgICAgICAgaWYgKGRlZmluaXRpb24uYXR0cmlidXRlc1tpbmZvLm5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBWZXJ0ZXggc2hhZGVyIGF0dHJpYnV0ZSBcIiR7aW5mby5uYW1lfVwiIGlzIG5vdCBtYXBwZWQgdG8gYSBzZW1hbnRpYyBpbiBzaGFkZXIgZGVmaW5pdGlvbiwgc2hhZGVyIFske3NoYWRlci5sYWJlbH1dYCwgc2hhZGVyKTtcbiAgICAgICAgICAgICAgICBzaGFkZXIuZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc2hhZGVySW5wdXQgPSBuZXcgV2ViZ2xTaGFkZXJJbnB1dChkZXZpY2UsIGRlZmluaXRpb24uYXR0cmlidXRlc1tpbmZvLm5hbWVdLCBkZXZpY2UucGNVbmlmb3JtVHlwZVtpbmZvLnR5cGVdLCBsb2NhdGlvbik7XG5cbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5wdXNoKHNoYWRlcklucHV0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFF1ZXJ5IHRoZSBwcm9ncmFtIGZvciBlYWNoIHNoYWRlciBzdGF0ZSAoR0xTTCAndW5pZm9ybScpXG4gICAgICAgIGkgPSAwO1xuICAgICAgICBjb25zdCBudW1Vbmlmb3JtcyA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIoZ2xQcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuICAgICAgICB3aGlsZSAoaSA8IG51bVVuaWZvcm1zKSB7XG4gICAgICAgICAgICBjb25zdCBpbmZvID0gZ2wuZ2V0QWN0aXZlVW5pZm9ybShnbFByb2dyYW0sIGkrKyk7XG4gICAgICAgICAgICBjb25zdCBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihnbFByb2dyYW0sIGluZm8ubmFtZSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYWRlcklucHV0ID0gbmV3IFdlYmdsU2hhZGVySW5wdXQoZGV2aWNlLCBpbmZvLm5hbWUsIGRldmljZS5wY1VuaWZvcm1UeXBlW2luZm8udHlwZV0sIGxvY2F0aW9uKTtcblxuICAgICAgICAgICAgaWYgKGluZm8udHlwZSA9PT0gZ2wuU0FNUExFUl8yRCB8fCBpbmZvLnR5cGUgPT09IGdsLlNBTVBMRVJfQ1VCRSB8fFxuICAgICAgICAgICAgICAgIChkZXZpY2Uud2ViZ2wyICYmIChpbmZvLnR5cGUgPT09IGdsLlNBTVBMRVJfMkRfU0hBRE9XIHx8IGluZm8udHlwZSA9PT0gZ2wuU0FNUExFUl9DVUJFX1NIQURPVyB8fCBpbmZvLnR5cGUgPT09IGdsLlNBTVBMRVJfM0QpKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zYW1wbGVycy5wdXNoKHNoYWRlcklucHV0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bmlmb3Jtcy5wdXNoKHNoYWRlcklucHV0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRlci5yZWFkeSA9IHRydWU7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBlbmRUaW1lID0gbm93KCk7XG4gICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6bGluazplbmQnLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IGVuZFRpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IGRldmljZVxuICAgICAgICB9KTtcbiAgICAgICAgZGV2aWNlLl9zaGFkZXJTdGF0cy5jb21waWxlVGltZSArPSBlbmRUaW1lIC0gc3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGR1cmF0aW9uID0gbm93KCkgLSBsaW5rU3RhcnRUaW1lO1xuICAgICAgICAgICAgdGhpcy5jb21waWxlRHVyYXRpb24gKz0gZHVyYXRpb247XG4gICAgICAgICAgICBfdG90YWxDb21waWxlVGltZSArPSB0aGlzLmNvbXBpbGVEdXJhdGlvbjtcbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfU0hBREVSX0NPTVBJTEUsIGBbaWQ6ICR7c2hhZGVyLmlkfV0gJHtzaGFkZXIubmFtZX06ICR7dGhpcy5jb21waWxlRHVyYXRpb24udG9GaXhlZCgxKX1tcywgVE9UQUw6ICR7X3RvdGFsQ29tcGlsZVRpbWUudG9GaXhlZCgxKX1tc2ApO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayB0aGUgY29tcGlsYXRpb24gc3RhdHVzIG9mIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ2xHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2hhZGVyLmpzJykuU2hhZGVyfSBzaGFkZXIgLSBUaGUgc2hhZGVyIHRvIHF1ZXJ5LlxuICAgICAqIEBwYXJhbSB7V2ViR0xTaGFkZXJ9IGdsU2hhZGVyIC0gVGhlIFdlYkdMIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc291cmNlIC0gVGhlIHNoYWRlciBzb3VyY2UgY29kZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2hhZGVyVHlwZSAtIFRoZSBzaGFkZXIgdHlwZS4gQ2FuIGJlICd2ZXJ0ZXgnIG9yICdmcmFnbWVudCcuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNoYWRlciBjb21waWxlZCBzdWNjZXNzZnVsbHksIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pc0NvbXBpbGVkKGRldmljZSwgc2hhZGVyLCBnbFNoYWRlciwgc291cmNlLCBzaGFkZXJUeXBlKSB7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIGlmICghZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKGdsU2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZm9Mb2cgPSBnbC5nZXRTaGFkZXJJbmZvTG9nKGdsU2hhZGVyKTtcbiAgICAgICAgICAgIGNvbnN0IFtjb2RlLCBlcnJvcl0gPSB0aGlzLl9wcm9jZXNzRXJyb3Ioc291cmNlLCBpbmZvTG9nKTtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgRmFpbGVkIHRvIGNvbXBpbGUgJHtzaGFkZXJUeXBlfSBzaGFkZXI6XFxuXFxuJHtpbmZvTG9nfVxcbiR7Y29kZX1gO1xuICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgZXJyb3Iuc2hhZGVyID0gc2hhZGVyO1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlLCBlcnJvcik7XG4gICAgICAgICAgICAvLyAjZWxzZVxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydW5jYXRlIHRoZSBXZWJHTCBzaGFkZXIgY29tcGlsYXRpb24gbG9nIHRvIGp1c3QgaW5jbHVkZSB0aGUgZXJyb3IgbGluZSBwbHVzIHRoZSA1IGxpbmVzXG4gICAgICogYmVmb3JlIGFuZCBhZnRlciBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcmMgLSBUaGUgc2hhZGVyIHNvdXJjZSBjb2RlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpbmZvTG9nIC0gVGhlIGluZm8gbG9nIHJldHVybmVkIGZyb20gV2ViR0wgb24gYSBmYWlsZWQgc2hhZGVyIGNvbXBpbGF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gQW4gYXJyYXkgd2hlcmUgdGhlIGZpcnN0IGVsZW1lbnQgaXMgdGhlIDEwIGxpbmVzIG9mIGNvZGUgYXJvdW5kIHRoZSBmaXJzdFxuICAgICAqIGRldGVjdGVkIGVycm9yLCBhbmQgdGhlIHNlY29uZCBlbGVtZW50IGFuIG9iamVjdCBzdG9yaW5nIHRoZSBlcnJvciBtZXNzYWdlLCBsaW5lIG51bWJlciBhbmRcbiAgICAgKiBjb21wbGV0ZSBzaGFkZXIgc291cmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Byb2Nlc3NFcnJvcihzcmMsIGluZm9Mb2cpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSB7IH07XG4gICAgICAgIGxldCBjb2RlID0gJyc7XG5cbiAgICAgICAgaWYgKHNyYykge1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzcmMuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgbGV0IGZyb20gPSAwO1xuICAgICAgICAgICAgbGV0IHRvID0gbGluZXMubGVuZ3RoO1xuXG4gICAgICAgICAgICAvLyBpZiBlcnJvciBpcyBpbiB0aGUgY29kZSwgb25seSBzaG93IG5lYXJieSBsaW5lcyBpbnN0ZWFkIG9mIHdob2xlIHNoYWRlciBjb2RlXG4gICAgICAgICAgICBpZiAoaW5mb0xvZyAmJiBpbmZvTG9nLnN0YXJ0c1dpdGgoJ0VSUk9SOicpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBpbmZvTG9nLm1hdGNoKC9eRVJST1I6XFxzKFswLTldKyk6KFswLTldKyk6XFxzKiguKykvKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IubWVzc2FnZSA9IG1hdGNoWzNdO1xuICAgICAgICAgICAgICAgICAgICBlcnJvci5saW5lID0gcGFyc2VJbnQobWF0Y2hbMl0sIDEwKTtcblxuICAgICAgICAgICAgICAgICAgICBmcm9tID0gTWF0aC5tYXgoMCwgZXJyb3IubGluZSAtIDYpO1xuICAgICAgICAgICAgICAgICAgICB0byA9IE1hdGgubWluKGxpbmVzLmxlbmd0aCwgZXJyb3IubGluZSArIDUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hyb21lIHJlcG9ydHMgc2hhZGVyIGVycm9ycyBvbiBsaW5lcyBpbmRleGVkIGZyb20gMVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IGZyb207IGkgPCB0bzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSAoaSArIDEpICsgXCI6XFx0XCIgKyBsaW5lc1tpXSArICdcXG4nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlcnJvci5zb3VyY2UgPSBzcmM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW2NvZGUsIGVycm9yXTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsU2hhZGVyIH07XG4iXSwibmFtZXMiOlsiX3RvdGFsQ29tcGlsZVRpbWUiLCJfdmVydGV4U2hhZGVyQnVpbHRpbnMiLCJDb21waWxlZFNoYWRlckNhY2hlIiwibWFwIiwiTWFwIiwiZGVzdHJveSIsImRldmljZSIsImZvckVhY2giLCJzaGFkZXIiLCJnbCIsImRlbGV0ZVNoYWRlciIsImxvc2VDb250ZXh0IiwiY2xlYXIiLCJTaGFkZXJCYXRjaENhY2hlIiwic2hhZGVycyIsIl92ZXJ0ZXhTaGFkZXJDYWNoZSIsIkRldmljZUNhY2hlIiwiX2ZyYWdtZW50U2hhZGVyQ2FjaGUiLCJfc2hhZGVyQmF0Y2hDYWNoZSIsIldlYmdsU2hhZGVyIiwiY29uc3RydWN0b3IiLCJjb21waWxlRHVyYXRpb24iLCJpbml0IiwiY29tcGlsZSIsImdldEJhdGNoU2hhZGVycyIsInB1c2giLCJnbFByb2dyYW0iLCJkZWxldGVQcm9ncmFtIiwidW5pZm9ybXMiLCJzYW1wbGVycyIsImF0dHJpYnV0ZXMiLCJnbFZlcnRleFNoYWRlciIsImdsRnJhZ21lbnRTaGFkZXIiLCJiYXRjaENhY2hlIiwiZ2V0IiwiZW5kU2hhZGVyQmF0Y2giLCJpbXBsIiwibGluayIsImxlbmd0aCIsInJlc3RvcmVDb250ZXh0IiwiZGVmaW5pdGlvbiIsIl9jb21waWxlU2hhZGVyU291cmNlIiwidnNoYWRlciIsImZzaGFkZXIiLCJzdGFydFRpbWUiLCJEZWJ1ZyIsImNhbGwiLCJub3ciLCJjcmVhdGVQcm9ncmFtIiwiYXR0YWNoU2hhZGVyIiwiYXR0cnMiLCJ3ZWJnbDIiLCJ1c2VUcmFuc2Zvcm1GZWVkYmFjayIsIm91dE5hbWVzIiwiYXR0ciIsImhhc093blByb3BlcnR5IiwidHJhbnNmb3JtRmVlZGJhY2tWYXJ5aW5ncyIsIklOVEVSTEVBVkVEX0FUVFJJQlMiLCJsb2NhdGlvbnMiLCJzZW1hbnRpYyIsImxvYyIsInNlbWFudGljVG9Mb2NhdGlvbiIsImFzc2VydCIsImJpbmRBdHRyaWJMb2NhdGlvbiIsImxpbmtQcm9ncmFtIiwiX3NoYWRlclN0YXRzIiwibGlua2VkIiwidGFnIiwiU0hBREVSVEFHX01BVEVSSUFMIiwibWF0ZXJpYWxTaGFkZXJzIiwic3JjIiwiaXNWZXJ0ZXhTaGFkZXIiLCJzaGFkZXJEZXZpY2VDYWNoZSIsInNoYWRlckNhY2hlIiwiZ2xTaGFkZXIiLCJmaXJlIiwidGltZXN0YW1wIiwidGFyZ2V0IiwiY3JlYXRlU2hhZGVyIiwiVkVSVEVYX1NIQURFUiIsIkZSQUdNRU5UX1NIQURFUiIsInNoYWRlclNvdXJjZSIsImNvbXBpbGVTaGFkZXIiLCJzZXQiLCJlbmRUaW1lIiwiY29tcGlsZVRpbWUiLCJ2c0NvbXBpbGVkIiwiZnNDb21waWxlZCIsImZpbmFsaXplIiwibGlua1N0YXJ0VGltZSIsImxpbmtTdGF0dXMiLCJnZXRQcm9ncmFtUGFyYW1ldGVyIiwiTElOS19TVEFUVVMiLCJfaXNDb21waWxlZCIsIm1lc3NhZ2UiLCJnZXRQcm9ncmFtSW5mb0xvZyIsInRyYW5zbGF0ZWRGcmFnIiwiZ2V0RXh0ZW5zaW9uIiwiZ2V0VHJhbnNsYXRlZFNoYWRlclNvdXJjZSIsInRyYW5zbGF0ZWRWZXJ0IiwiY29uc29sZSIsImVycm9yIiwiaSIsIm51bUF0dHJpYnV0ZXMiLCJBQ1RJVkVfQVRUUklCVVRFUyIsImluZm8iLCJnZXRBY3RpdmVBdHRyaWIiLCJsb2NhdGlvbiIsImdldEF0dHJpYkxvY2F0aW9uIiwibmFtZSIsImluZGV4T2YiLCJ1bmRlZmluZWQiLCJsYWJlbCIsImZhaWxlZCIsInNoYWRlcklucHV0IiwiV2ViZ2xTaGFkZXJJbnB1dCIsInBjVW5pZm9ybVR5cGUiLCJ0eXBlIiwibnVtVW5pZm9ybXMiLCJBQ1RJVkVfVU5JRk9STVMiLCJnZXRBY3RpdmVVbmlmb3JtIiwiZ2V0VW5pZm9ybUxvY2F0aW9uIiwiU0FNUExFUl8yRCIsIlNBTVBMRVJfQ1VCRSIsIlNBTVBMRVJfMkRfU0hBRE9XIiwiU0FNUExFUl9DVUJFX1NIQURPVyIsIlNBTVBMRVJfM0QiLCJyZWFkeSIsImR1cmF0aW9uIiwidHJhY2UiLCJUUkFDRUlEX1NIQURFUl9DT01QSUxFIiwiaWQiLCJ0b0ZpeGVkIiwic291cmNlIiwic2hhZGVyVHlwZSIsImdldFNoYWRlclBhcmFtZXRlciIsIkNPTVBJTEVfU1RBVFVTIiwiaW5mb0xvZyIsImdldFNoYWRlckluZm9Mb2ciLCJjb2RlIiwiX3Byb2Nlc3NFcnJvciIsImxpbmVzIiwic3BsaXQiLCJmcm9tIiwidG8iLCJzdGFydHNXaXRoIiwibWF0Y2giLCJsaW5lIiwicGFyc2VJbnQiLCJNYXRoIiwibWF4IiwibWluIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFRQSxJQUFJQSxpQkFBaUIsR0FBRyxDQUFDLENBQUE7QUFFekIsTUFBTUMscUJBQXFCLEdBQUcsQ0FDMUIsYUFBYSxFQUNiLGVBQWUsRUFDZixXQUFXLEVBQ1gsZUFBZSxFQUNmLGlCQUFpQixDQUNwQixDQUFBOztBQUVEO0FBQ0EsTUFBTUMsbUJBQW1CLENBQUM7QUFBQSxFQUFBLFdBQUEsR0FBQTtBQUFBLElBQUEsSUFBQSxDQUV0QkMsR0FBRyxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0FBQUEsR0FBQTtBQUVmO0VBQ0FDLE9BQU8sQ0FBQ0MsTUFBTSxFQUFFO0FBQ1osSUFBQSxJQUFJLENBQUNILEdBQUcsQ0FBQ0ksT0FBTyxDQUFFQyxNQUFNLElBQUs7QUFDekJGLE1BQUFBLE1BQU0sQ0FBQ0csRUFBRSxDQUFDQyxZQUFZLENBQUNGLE1BQU0sQ0FBQyxDQUFBO0FBQ2xDLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7QUFFQTtFQUNBRyxXQUFXLENBQUNMLE1BQU0sRUFBRTtBQUNoQixJQUFBLElBQUksQ0FBQ0gsR0FBRyxDQUFDUyxLQUFLLEVBQUUsQ0FBQTtBQUNwQixHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQUNBLE1BQU1DLGdCQUFnQixDQUFDO0FBQUEsRUFBQSxXQUFBLEdBQUE7SUFBQSxJQUNuQkMsQ0FBQUEsT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQUFBLEdBQUE7RUFFWkgsV0FBVyxDQUFDTCxNQUFNLEVBQUU7SUFDaEIsSUFBSSxDQUFDUSxPQUFPLEdBQUcsRUFBRSxDQUFBO0FBQ3JCLEdBQUE7QUFDSixDQUFBO0FBRUEsTUFBTUMsa0JBQWtCLEdBQUcsSUFBSUMsV0FBVyxFQUFFLENBQUE7QUFDNUMsTUFBTUMsb0JBQW9CLEdBQUcsSUFBSUQsV0FB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
