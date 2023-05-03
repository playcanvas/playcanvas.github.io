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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtc2hhZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBUUkFDRUlEX1NIQURFUl9DT01QSUxFIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vLi4vY29yZS90aW1lLmpzJztcblxuaW1wb3J0IHsgV2ViZ2xTaGFkZXJJbnB1dCB9IGZyb20gJy4vd2ViZ2wtc2hhZGVyLWlucHV0LmpzJztcbmltcG9ydCB7IFNIQURFUlRBR19NQVRFUklBTCwgc2VtYW50aWNUb0xvY2F0aW9uIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vZGV2aWNlLWNhY2hlLmpzJztcblxubGV0IF90b3RhbENvbXBpbGVUaW1lID0gMDtcblxuY29uc3QgX3ZlcnRleFNoYWRlckJ1aWx0aW5zID0gW1xuICAgICdnbF9WZXJ0ZXhJRCcsXG4gICAgJ2dsX0luc3RhbmNlSUQnLFxuICAgICdnbF9EcmF3SUQnLFxuICAgICdnbF9CYXNlVmVydGV4JyxcbiAgICAnZ2xfQmFzZUluc3RhbmNlJ1xuXTtcblxuLy8gY2xhc3MgdXNlZCB0byBob2xkIGNvbXBpbGVkIFdlYkdMIHZlcnRleCBvciBmcmFnbWVudCBzaGFkZXJzIGluIHRoZSBkZXZpY2UgY2FjaGVcbmNsYXNzIENvbXBpbGVkU2hhZGVyQ2FjaGUge1xuICAgIC8vIG1hcHMgc2hhZGVyIHNvdXJjZSB0byBhIGNvbXBpbGVkIFdlYkdMIHNoYWRlclxuICAgIG1hcCA9IG5ldyBNYXAoKTtcblxuICAgIC8vIGRlc3Ryb3kgYWxsIGNyZWF0ZWQgc2hhZGVycyB3aGVuIHRoZSBkZXZpY2UgaXMgZGVzdHJveWVkXG4gICAgZGVzdHJveShkZXZpY2UpIHtcbiAgICAgICAgdGhpcy5tYXAuZm9yRWFjaCgoc2hhZGVyKSA9PiB7XG4gICAgICAgICAgICBkZXZpY2UuZ2wuZGVsZXRlU2hhZGVyKHNoYWRlcik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGp1c3QgZW1wdHkgdGhlIGNhY2hlIHdoZW4gdGhlIGNvbnRleHQgaXMgbG9zdFxuICAgIGxvc2VDb250ZXh0KGRldmljZSkge1xuICAgICAgICB0aGlzLm1hcC5jbGVhcigpO1xuICAgIH1cbn1cblxuLy8gY2xhc3MgdXNlZCB0byBob2xkIGEgbGlzdCBvZiByZWNlbnRseSBjcmVhdGVkIHNoYWRlcnMgZm9ybWluZyBhIGJhdGNoLCB0byBhbGxvdyB0aGVpciBtb3JlIG9wdGltaXplZCBjb21waWxhdGlvblxuY2xhc3MgU2hhZGVyQmF0Y2hDYWNoZSB7XG4gICAgc2hhZGVycyA9IFtdO1xuXG4gICAgbG9zZUNvbnRleHQoZGV2aWNlKSB7XG4gICAgICAgIHRoaXMuc2hhZGVycyA9IFtdO1xuICAgIH1cbn1cblxuY29uc3QgX3ZlcnRleFNoYWRlckNhY2hlID0gbmV3IERldmljZUNhY2hlKCk7XG5jb25zdCBfZnJhZ21lbnRTaGFkZXJDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuY29uc3QgX3NoYWRlckJhdGNoQ2FjaGUgPSBuZXcgRGV2aWNlQ2FjaGUoKTtcblxuLyoqXG4gKiBBIFdlYkdMIGltcGxlbWVudGF0aW9uIG9mIHRoZSBTaGFkZXIuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJnbFNoYWRlciB7XG4gICAgY29tcGlsZUR1cmF0aW9uID0gMDtcblxuICAgIGNvbnN0cnVjdG9yKHNoYWRlcikge1xuICAgICAgICB0aGlzLmluaXQoKTtcblxuICAgICAgICAvLyBraWNrIG9mZiB2ZXJ0ZXggYW5kIGZyYWdtZW50IHNoYWRlciBjb21waWxhdGlvbiwgYnV0IG5vdCBsaW5raW5nIGhlcmUsIGFzIHRoYXQgd291bGRcbiAgICAgICAgLy8gbWFrZSBpdCBibG9ja2luZy5cbiAgICAgICAgdGhpcy5jb21waWxlKHNoYWRlci5kZXZpY2UsIHNoYWRlcik7XG5cbiAgICAgICAgLy8gYWRkIHRoZSBzaGFkZXIgdG8gcmVjZW50bHkgY3JlYXRlZCBsaXN0XG4gICAgICAgIFdlYmdsU2hhZGVyLmdldEJhdGNoU2hhZGVycyhzaGFkZXIuZGV2aWNlKS5wdXNoKHNoYWRlcik7XG5cbiAgICAgICAgLy8gYWRkIGl0IHRvIGEgZGV2aWNlIGxpc3Qgb2YgYWxsIHNoYWRlcnNcbiAgICAgICAgc2hhZGVyLmRldmljZS5zaGFkZXJzLnB1c2goc2hhZGVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlIHRoZSBXZWJHTCByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBmcmVlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koc2hhZGVyKSB7XG4gICAgICAgIGlmICh0aGlzLmdsUHJvZ3JhbSkge1xuICAgICAgICAgICAgc2hhZGVyLmRldmljZS5nbC5kZWxldGVQcm9ncmFtKHRoaXMuZ2xQcm9ncmFtKTtcbiAgICAgICAgICAgIHRoaXMuZ2xQcm9ncmFtID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGluaXQoKSB7XG4gICAgICAgIHRoaXMudW5pZm9ybXMgPSBbXTtcbiAgICAgICAgdGhpcy5zYW1wbGVycyA9IFtdO1xuICAgICAgICB0aGlzLmF0dHJpYnV0ZXMgPSBbXTtcblxuICAgICAgICB0aGlzLmdsUHJvZ3JhbSA9IG51bGw7XG4gICAgICAgIHRoaXMuZ2xWZXJ0ZXhTaGFkZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmdsRnJhZ21lbnRTaGFkZXIgPSBudWxsO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXRCYXRjaFNoYWRlcnMoZGV2aWNlKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoQ2FjaGUgPSBfc2hhZGVyQmF0Y2hDYWNoZS5nZXQoZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFNoYWRlckJhdGNoQ2FjaGUoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBiYXRjaENhY2hlLnNoYWRlcnM7XG4gICAgfVxuXG4gICAgc3RhdGljIGVuZFNoYWRlckJhdGNoKGRldmljZSkge1xuXG4gICAgICAgIC8vIFRyaWdnZXIgbGluayBzdGVwIGZvciBhbGwgcmVjZW50bHkgY3JlYXRlZCBzaGFkZXJzLiBUaGlzIGFsbG93cyBsaW5raW5nIHRvIGJlIGRvbmUgaW4gcGFyYWxsZWwsIGJlZm9yZVxuICAgICAgICAvLyB0aGUgYmxvY2tpbmcgd2FpdCBvbiB0aGUgbGlua2luZyByZXN1bHQgaXMgdHJpZ2dlcmVkIGluIGZpbmFsaXplIGZ1bmN0aW9uXG4gICAgICAgIGNvbnN0IHNoYWRlcnMgPSBXZWJnbFNoYWRlci5nZXRCYXRjaFNoYWRlcnMoZGV2aWNlKTtcbiAgICAgICAgc2hhZGVycy5mb3JFYWNoKHNoYWRlciA9PiBzaGFkZXIuaW1wbC5saW5rKGRldmljZSwgc2hhZGVyKSk7XG4gICAgICAgIHNoYWRlcnMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXNwb3NlIHRoZSBzaGFkZXIgd2hlbiB0aGUgY29udGV4dCBoYXMgYmVlbiBsb3N0LlxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlIHNoYWRlciBhZnRlciB0aGUgY29udGV4dCBoYXMgYmVlbiBvYnRhaW5lZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdsLWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdsR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byByZXN0b3JlLlxuICAgICAqL1xuICAgIHJlc3RvcmVDb250ZXh0KGRldmljZSwgc2hhZGVyKSB7XG4gICAgICAgIHRoaXMuY29tcGlsZShkZXZpY2UsIHNoYWRlcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcGlsZSBzaGFkZXIgcHJvZ3JhbXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJnbC1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJnbEdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gY29tcGlsZS5cbiAgICAgKi9cbiAgICBjb21waWxlKGRldmljZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbiA9IHNoYWRlci5kZWZpbml0aW9uO1xuICAgICAgICB0aGlzLmdsVmVydGV4U2hhZGVyID0gdGhpcy5fY29tcGlsZVNoYWRlclNvdXJjZShkZXZpY2UsIGRlZmluaXRpb24udnNoYWRlciwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuZ2xGcmFnbWVudFNoYWRlciA9IHRoaXMuX2NvbXBpbGVTaGFkZXJTb3VyY2UoZGV2aWNlLCBkZWZpbml0aW9uLmZzaGFkZXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaW5rIHNoYWRlciBwcm9ncmFtcy4gVGhpcyBpcyBjYWxsZWQgYXQgYSBsYXRlciBzdGFnZSwgdG8gYWxsb3cgbWFueSBzaGFkZXJzIHRvIGNvbXBpbGUgaW4gcGFyYWxsZWwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJnbC1ncmFwaGljcy1kZXZpY2UuanMnKS5XZWJnbEdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gY29tcGlsZS5cbiAgICAgKi9cbiAgICBsaW5rKGRldmljZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gaWYgdGhlIHNoYWRlciB3YXMgYWxyZWFkeSBsaW5rZWRcbiAgICAgICAgaWYgKHRoaXMuZ2xQcm9ncmFtKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCBzdGFydFRpbWUgPSAwO1xuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuY29tcGlsZUR1cmF0aW9uID0gMDtcbiAgICAgICAgICAgIHN0YXJ0VGltZSA9IG5vdygpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBnbCA9IGRldmljZS5nbDtcbiAgICAgICAgY29uc3QgZ2xQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICAgICAgICB0aGlzLmdsUHJvZ3JhbSA9IGdsUHJvZ3JhbTtcblxuICAgICAgICBnbC5hdHRhY2hTaGFkZXIoZ2xQcm9ncmFtLCB0aGlzLmdsVmVydGV4U2hhZGVyKTtcbiAgICAgICAgZ2wuYXR0YWNoU2hhZGVyKGdsUHJvZ3JhbSwgdGhpcy5nbEZyYWdtZW50U2hhZGVyKTtcblxuICAgICAgICBjb25zdCBkZWZpbml0aW9uID0gc2hhZGVyLmRlZmluaXRpb247XG4gICAgICAgIGNvbnN0IGF0dHJzID0gZGVmaW5pdGlvbi5hdHRyaWJ1dGVzO1xuICAgICAgICBpZiAoZGV2aWNlLndlYmdsMiAmJiBkZWZpbml0aW9uLnVzZVRyYW5zZm9ybUZlZWRiYWNrKSB7XG4gICAgICAgICAgICAvLyBDb2xsZWN0IGFsbCBcIm91dF9cIiBhdHRyaWJ1dGVzIGFuZCB1c2UgdGhlbSBmb3Igb3V0cHV0XG4gICAgICAgICAgICBjb25zdCBvdXROYW1lcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBhdHRyIGluIGF0dHJzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgICAgIG91dE5hbWVzLnB1c2goXCJvdXRfXCIgKyBhdHRyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBnbC50cmFuc2Zvcm1GZWVkYmFja1ZhcnlpbmdzKGdsUHJvZ3JhbSwgb3V0TmFtZXMsIGdsLklOVEVSTEVBVkVEX0FUVFJJQlMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFwIGFsbCB2ZXJ0ZXggaW5wdXQgYXR0cmlidXRlcyB0byBmaXhlZCBsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgbG9jYXRpb25zID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0ciBpbiBhdHRycykge1xuICAgICAgICAgICAgaWYgKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBhdHRyc1thdHRyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsb2MgPSBzZW1hbnRpY1RvTG9jYXRpb25bc2VtYW50aWNdO1xuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydCghbG9jYXRpb25zLmhhc093blByb3BlcnR5KGxvYyksIGBXQVJOSU5HOiBUd28gYXR0cmlidXRlcyBhcmUgbWFwcGVkIHRvIHRoZSBzYW1lIGxvY2F0aW9uIGluIGEgc2hhZGVyOiAke2xvY2F0aW9uc1tsb2NdfSBhbmQgJHthdHRyfWApO1xuXG4gICAgICAgICAgICAgICAgbG9jYXRpb25zW2xvY10gPSBhdHRyO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRBdHRyaWJMb2NhdGlvbihnbFByb2dyYW0sIGxvYywgYXR0cik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBnbC5saW5rUHJvZ3JhbShnbFByb2dyYW0pO1xuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jb21waWxlRHVyYXRpb24gPSBub3coKSAtIHN0YXJ0VGltZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBkZXZpY2UuX3NoYWRlclN0YXRzLmxpbmtlZCsrO1xuICAgICAgICBpZiAoZGVmaW5pdGlvbi50YWcgPT09IFNIQURFUlRBR19NQVRFUklBTCkge1xuICAgICAgICAgICAgZGV2aWNlLl9zaGFkZXJTdGF0cy5tYXRlcmlhbFNoYWRlcnMrKztcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb21waWxlcyBhbiBpbmRpdmlkdWFsIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdsLWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdsR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNyYyAtIFRoZSBzaGFkZXIgc291cmNlIGNvZGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpc1ZlcnRleFNoYWRlciAtIFRydWUgaWYgdGhlIHNoYWRlciBpcyBhIHZlcnRleCBzaGFkZXIsIGZhbHNlIGlmIGl0IGlzIGFcbiAgICAgKiBmcmFnbWVudCBzaGFkZXIuXG4gICAgICogQHJldHVybnMge1dlYkdMU2hhZGVyfSBUaGUgY29tcGlsZWQgc2hhZGVyLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NvbXBpbGVTaGFkZXJTb3VyY2UoZGV2aWNlLCBzcmMsIGlzVmVydGV4U2hhZGVyKSB7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIC8vIGRldmljZSBjYWNoZSBmb3IgY3VycmVudCBkZXZpY2UsIGNvbnRhaW5pbmcgY2FjaGUgb2YgY29tcGlsZWQgc2hhZGVyc1xuICAgICAgICBjb25zdCBzaGFkZXJEZXZpY2VDYWNoZSA9IGlzVmVydGV4U2hhZGVyID8gX3ZlcnRleFNoYWRlckNhY2hlIDogX2ZyYWdtZW50U2hhZGVyQ2FjaGU7XG4gICAgICAgIGNvbnN0IHNoYWRlckNhY2hlID0gc2hhZGVyRGV2aWNlQ2FjaGUuZ2V0KGRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBDb21waWxlZFNoYWRlckNhY2hlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHRyeSB0byBnZXQgY29tcGlsZWQgc2hhZGVyIGZyb20gdGhlIGNhY2hlXG4gICAgICAgIGxldCBnbFNoYWRlciA9IHNoYWRlckNhY2hlLm1hcC5nZXQoc3JjKTtcblxuICAgICAgICBpZiAoIWdsU2hhZGVyKSB7XG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBjb25zdCBzdGFydFRpbWUgPSBub3coKTtcbiAgICAgICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6Y29tcGlsZTpzdGFydCcsIHtcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IHN0YXJ0VGltZSxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IGRldmljZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgZ2xTaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoaXNWZXJ0ZXhTaGFkZXIgPyBnbC5WRVJURVhfU0hBREVSIDogZ2wuRlJBR01FTlRfU0hBREVSKTtcblxuICAgICAgICAgICAgZ2wuc2hhZGVyU291cmNlKGdsU2hhZGVyLCBzcmMpO1xuICAgICAgICAgICAgZ2wuY29tcGlsZVNoYWRlcihnbFNoYWRlcik7XG5cbiAgICAgICAgICAgIHNoYWRlckNhY2hlLm1hcC5zZXQoc3JjLCBnbFNoYWRlcik7XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIGNvbnN0IGVuZFRpbWUgPSBub3coKTtcbiAgICAgICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6Y29tcGlsZTplbmQnLCB7XG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBlbmRUaW1lLFxuICAgICAgICAgICAgICAgIHRhcmdldDogZGV2aWNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGRldmljZS5fc2hhZGVyU3RhdHMuY29tcGlsZVRpbWUgKz0gZW5kVGltZSAtIHN0YXJ0VGltZTtcblxuICAgICAgICAgICAgaWYgKGlzVmVydGV4U2hhZGVyKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLl9zaGFkZXJTdGF0cy52c0NvbXBpbGVkKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRldmljZS5fc2hhZGVyU3RhdHMuZnNDb21waWxlZCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZ2xTaGFkZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGluayB0aGUgc2hhZGVyLCBhbmQgZXh0cmFjdCBpdHMgYXR0cmlidXRlcyBhbmQgdW5pZm9ybSBpbmZvcm1hdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3dlYmdsLWdyYXBoaWNzLWRldmljZS5qcycpLldlYmdsR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBxdWVyeS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2hhZGVyIHdhcyBzdWNjZXNzZnVsbHkgcXVlcmllZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGZpbmFsaXplKGRldmljZSwgc2hhZGVyKSB7XG5cbiAgICAgICAgLy8gaWYgdGhlIHByb2dyYW0gd2Fzbid0IGxpbmtlZCB5ZXQgKHNoYWRlciB3YXMgbm90IGNyZWF0ZWQgaW4gYmF0Y2gpXG4gICAgICAgIGlmICghdGhpcy5nbFByb2dyYW0pXG4gICAgICAgICAgICB0aGlzLmxpbmsoZGV2aWNlLCBzaGFkZXIpO1xuXG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuICAgICAgICBjb25zdCBnbFByb2dyYW0gPSB0aGlzLmdsUHJvZ3JhbTtcbiAgICAgICAgY29uc3QgZGVmaW5pdGlvbiA9IHNoYWRlci5kZWZpbml0aW9uO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6bGluazpzdGFydCcsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogc3RhcnRUaW1lLFxuICAgICAgICAgICAgdGFyZ2V0OiBkZXZpY2VcbiAgICAgICAgfSk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHRoaXMgaXMgdGhlIG1haW4gdGhlYWQgYmxvY2tpbmcgcGFydCBvZiB0aGUgc2hhZGVyIGNvbXBpbGF0aW9uLCB0aW1lIGl0XG4gICAgICAgIGxldCBsaW5rU3RhcnRUaW1lID0gMDtcbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICBsaW5rU3RhcnRUaW1lID0gbm93KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGxpbmtTdGF0dXMgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKGdsUHJvZ3JhbSwgZ2wuTElOS19TVEFUVVMpO1xuICAgICAgICBpZiAoIWxpbmtTdGF0dXMpIHtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGNvbXBpbGF0aW9uIGVycm9yc1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0NvbXBpbGVkKGRldmljZSwgc2hhZGVyLCB0aGlzLmdsVmVydGV4U2hhZGVyLCBkZWZpbml0aW9uLnZzaGFkZXIsIFwidmVydGV4XCIpKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc0NvbXBpbGVkKGRldmljZSwgc2hhZGVyLCB0aGlzLmdsRnJhZ21lbnRTaGFkZXIsIGRlZmluaXRpb24uZnNoYWRlciwgXCJmcmFnbWVudFwiKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBcIkZhaWxlZCB0byBsaW5rIHNoYWRlciBwcm9ncmFtLiBFcnJvcjogXCIgKyBnbC5nZXRQcm9ncmFtSW5mb0xvZyhnbFByb2dyYW0pO1xuXG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG5cbiAgICAgICAgICAgIC8vIGxvZyB0cmFuc2xhdGVkIHNoYWRlcnNcbiAgICAgICAgICAgIGRlZmluaXRpb24udHJhbnNsYXRlZEZyYWcgPSBnbC5nZXRFeHRlbnNpb24oJ1dFQkdMX2RlYnVnX3NoYWRlcnMnKT8uZ2V0VHJhbnNsYXRlZFNoYWRlclNvdXJjZSh0aGlzLmdsRnJhZ21lbnRTaGFkZXIpO1xuICAgICAgICAgICAgZGVmaW5pdGlvbi50cmFuc2xhdGVkVmVydCA9IGdsLmdldEV4dGVuc2lvbignV0VCR0xfZGVidWdfc2hhZGVycycpPy5nZXRUcmFuc2xhdGVkU2hhZGVyU291cmNlKHRoaXMuZ2xWZXJ0ZXhTaGFkZXIpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKG1lc3NhZ2UsIGRlZmluaXRpb24pO1xuICAgICAgICAgICAgLy8gI2Vsc2VcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUXVlcnkgdGhlIHByb2dyYW0gZm9yIGVhY2ggdmVydGV4IGJ1ZmZlciBpbnB1dCAoR0xTTCAnYXR0cmlidXRlJylcbiAgICAgICAgbGV0IGkgPSAwO1xuICAgICAgICBjb25zdCBudW1BdHRyaWJ1dGVzID0gZ2wuZ2V0UHJvZ3JhbVBhcmFtZXRlcihnbFByb2dyYW0sIGdsLkFDVElWRV9BVFRSSUJVVEVTKTtcbiAgICAgICAgd2hpbGUgKGkgPCBudW1BdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBjb25zdCBpbmZvID0gZ2wuZ2V0QWN0aXZlQXR0cmliKGdsUHJvZ3JhbSwgaSsrKTtcbiAgICAgICAgICAgIGNvbnN0IGxvY2F0aW9uID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24oZ2xQcm9ncmFtLCBpbmZvLm5hbWUpO1xuXG4gICAgICAgICAgICAvLyBhIGJ1aWx0LWluIGF0dHJpYnV0ZXMgZm9yIHdoaWNoIHdlIGRvIG5vdCBuZWVkIHRvIHByb3ZpZGUgYW55IGRhdGFcbiAgICAgICAgICAgIGlmIChfdmVydGV4U2hhZGVyQnVpbHRpbnMuaW5kZXhPZihpbmZvLm5hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgYXR0cmlidXRlcyBhcmUgY29ycmVjdGx5IGxpbmtlZCB1cFxuICAgICAgICAgICAgaWYgKGRlZmluaXRpb24uYXR0cmlidXRlc1tpbmZvLm5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBWZXJ0ZXggc2hhZGVyIGF0dHJpYnV0ZSBcIiR7aW5mby5uYW1lfVwiIGlzIG5vdCBtYXBwZWQgdG8gYSBzZW1hbnRpYyBpbiBzaGFkZXIgZGVmaW5pdGlvbiwgc2hhZGVyIFske3NoYWRlci5sYWJlbH1dYCwgc2hhZGVyKTtcbiAgICAgICAgICAgICAgICBzaGFkZXIuZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc2hhZGVySW5wdXQgPSBuZXcgV2ViZ2xTaGFkZXJJbnB1dChkZXZpY2UsIGRlZmluaXRpb24uYXR0cmlidXRlc1tpbmZvLm5hbWVdLCBkZXZpY2UucGNVbmlmb3JtVHlwZVtpbmZvLnR5cGVdLCBsb2NhdGlvbik7XG5cbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlcy5wdXNoKHNoYWRlcklucHV0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFF1ZXJ5IHRoZSBwcm9ncmFtIGZvciBlYWNoIHNoYWRlciBzdGF0ZSAoR0xTTCAndW5pZm9ybScpXG4gICAgICAgIGkgPSAwO1xuICAgICAgICBjb25zdCBudW1Vbmlmb3JtcyA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIoZ2xQcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuICAgICAgICB3aGlsZSAoaSA8IG51bVVuaWZvcm1zKSB7XG4gICAgICAgICAgICBjb25zdCBpbmZvID0gZ2wuZ2V0QWN0aXZlVW5pZm9ybShnbFByb2dyYW0sIGkrKyk7XG4gICAgICAgICAgICBjb25zdCBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihnbFByb2dyYW0sIGluZm8ubmFtZSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHNoYWRlcklucHV0ID0gbmV3IFdlYmdsU2hhZGVySW5wdXQoZGV2aWNlLCBpbmZvLm5hbWUsIGRldmljZS5wY1VuaWZvcm1UeXBlW2luZm8udHlwZV0sIGxvY2F0aW9uKTtcblxuICAgICAgICAgICAgaWYgKGluZm8udHlwZSA9PT0gZ2wuU0FNUExFUl8yRCB8fCBpbmZvLnR5cGUgPT09IGdsLlNBTVBMRVJfQ1VCRSB8fFxuICAgICAgICAgICAgICAgIChkZXZpY2Uud2ViZ2wyICYmIChpbmZvLnR5cGUgPT09IGdsLlNBTVBMRVJfMkRfU0hBRE9XIHx8IGluZm8udHlwZSA9PT0gZ2wuU0FNUExFUl9DVUJFX1NIQURPVyB8fCBpbmZvLnR5cGUgPT09IGdsLlNBTVBMRVJfM0QpKVxuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zYW1wbGVycy5wdXNoKHNoYWRlcklucHV0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bmlmb3Jtcy5wdXNoKHNoYWRlcklucHV0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHNoYWRlci5yZWFkeSA9IHRydWU7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCBlbmRUaW1lID0gbm93KCk7XG4gICAgICAgIGRldmljZS5maXJlKCdzaGFkZXI6bGluazplbmQnLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IGVuZFRpbWUsXG4gICAgICAgICAgICB0YXJnZXQ6IGRldmljZVxuICAgICAgICB9KTtcbiAgICAgICAgZGV2aWNlLl9zaGFkZXJTdGF0cy5jb21waWxlVGltZSArPSBlbmRUaW1lIC0gc3RhcnRUaW1lO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGR1cmF0aW9uID0gbm93KCkgLSBsaW5rU3RhcnRUaW1lO1xuICAgICAgICAgICAgdGhpcy5jb21waWxlRHVyYXRpb24gKz0gZHVyYXRpb247XG4gICAgICAgICAgICBfdG90YWxDb21waWxlVGltZSArPSB0aGlzLmNvbXBpbGVEdXJhdGlvbjtcbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfU0hBREVSX0NPTVBJTEUsIGBbaWQ6ICR7c2hhZGVyLmlkfV0gJHtzaGFkZXIubmFtZX06ICR7dGhpcy5jb21waWxlRHVyYXRpb24udG9GaXhlZCgxKX1tcywgVE9UQUw6ICR7X3RvdGFsQ29tcGlsZVRpbWUudG9GaXhlZCgxKX1tc2ApO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayB0aGUgY29tcGlsYXRpb24gc3RhdHVzIG9mIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ2xHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2hhZGVyLmpzJykuU2hhZGVyfSBzaGFkZXIgLSBUaGUgc2hhZGVyIHRvIHF1ZXJ5LlxuICAgICAqIEBwYXJhbSB7V2ViR0xTaGFkZXJ9IGdsU2hhZGVyIC0gVGhlIFdlYkdMIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc291cmNlIC0gVGhlIHNoYWRlciBzb3VyY2UgY29kZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2hhZGVyVHlwZSAtIFRoZSBzaGFkZXIgdHlwZS4gQ2FuIGJlICd2ZXJ0ZXgnIG9yICdmcmFnbWVudCcuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNoYWRlciBjb21waWxlZCBzdWNjZXNzZnVsbHksIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pc0NvbXBpbGVkKGRldmljZSwgc2hhZGVyLCBnbFNoYWRlciwgc291cmNlLCBzaGFkZXJUeXBlKSB7XG4gICAgICAgIGNvbnN0IGdsID0gZGV2aWNlLmdsO1xuXG4gICAgICAgIGlmICghZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKGdsU2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZm9Mb2cgPSBnbC5nZXRTaGFkZXJJbmZvTG9nKGdsU2hhZGVyKTtcbiAgICAgICAgICAgIGNvbnN0IFtjb2RlLCBlcnJvcl0gPSB0aGlzLl9wcm9jZXNzRXJyb3Ioc291cmNlLCBpbmZvTG9nKTtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgRmFpbGVkIHRvIGNvbXBpbGUgJHtzaGFkZXJUeXBlfSBzaGFkZXI6XFxuXFxuJHtpbmZvTG9nfVxcbiR7Y29kZX1gO1xuICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgZXJyb3Iuc2hhZGVyID0gc2hhZGVyO1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlLCBlcnJvcik7XG4gICAgICAgICAgICAvLyAjZWxzZVxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydW5jYXRlIHRoZSBXZWJHTCBzaGFkZXIgY29tcGlsYXRpb24gbG9nIHRvIGp1c3QgaW5jbHVkZSB0aGUgZXJyb3IgbGluZSBwbHVzIHRoZSA1IGxpbmVzXG4gICAgICogYmVmb3JlIGFuZCBhZnRlciBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcmMgLSBUaGUgc2hhZGVyIHNvdXJjZSBjb2RlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpbmZvTG9nIC0gVGhlIGluZm8gbG9nIHJldHVybmVkIGZyb20gV2ViR0wgb24gYSBmYWlsZWQgc2hhZGVyIGNvbXBpbGF0aW9uLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gQW4gYXJyYXkgd2hlcmUgdGhlIGZpcnN0IGVsZW1lbnQgaXMgdGhlIDEwIGxpbmVzIG9mIGNvZGUgYXJvdW5kIHRoZSBmaXJzdFxuICAgICAqIGRldGVjdGVkIGVycm9yLCBhbmQgdGhlIHNlY29uZCBlbGVtZW50IGFuIG9iamVjdCBzdG9yaW5nIHRoZSBlcnJvciBtZXNzYWdlLCBsaW5lIG51bWJlciBhbmRcbiAgICAgKiBjb21wbGV0ZSBzaGFkZXIgc291cmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Byb2Nlc3NFcnJvcihzcmMsIGluZm9Mb2cpIHtcbiAgICAgICAgY29uc3QgZXJyb3IgPSB7IH07XG4gICAgICAgIGxldCBjb2RlID0gJyc7XG5cbiAgICAgICAgaWYgKHNyYykge1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBzcmMuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgbGV0IGZyb20gPSAwO1xuICAgICAgICAgICAgbGV0IHRvID0gbGluZXMubGVuZ3RoO1xuXG4gICAgICAgICAgICAvLyBpZiBlcnJvciBpcyBpbiB0aGUgY29kZSwgb25seSBzaG93IG5lYXJieSBsaW5lcyBpbnN0ZWFkIG9mIHdob2xlIHNoYWRlciBjb2RlXG4gICAgICAgICAgICBpZiAoaW5mb0xvZyAmJiBpbmZvTG9nLnN0YXJ0c1dpdGgoJ0VSUk9SOicpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBpbmZvTG9nLm1hdGNoKC9eRVJST1I6XFxzKFswLTldKyk6KFswLTldKyk6XFxzKiguKykvKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IubWVzc2FnZSA9IG1hdGNoWzNdO1xuICAgICAgICAgICAgICAgICAgICBlcnJvci5saW5lID0gcGFyc2VJbnQobWF0Y2hbMl0sIDEwKTtcblxuICAgICAgICAgICAgICAgICAgICBmcm9tID0gTWF0aC5tYXgoMCwgZXJyb3IubGluZSAtIDYpO1xuICAgICAgICAgICAgICAgICAgICB0byA9IE1hdGgubWluKGxpbmVzLmxlbmd0aCwgZXJyb3IubGluZSArIDUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hyb21lIHJlcG9ydHMgc2hhZGVyIGVycm9ycyBvbiBsaW5lcyBpbmRleGVkIGZyb20gMVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IGZyb207IGkgPCB0bzsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29kZSArPSAoaSArIDEpICsgXCI6XFx0XCIgKyBsaW5lc1tpXSArICdcXG4nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlcnJvci5zb3VyY2UgPSBzcmM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gW2NvZGUsIGVycm9yXTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsU2hhZGVyIH07XG4iXSwibmFtZXMiOlsiX3RvdGFsQ29tcGlsZVRpbWUiLCJfdmVydGV4U2hhZGVyQnVpbHRpbnMiLCJDb21waWxlZFNoYWRlckNhY2hlIiwiY29uc3RydWN0b3IiLCJtYXAiLCJNYXAiLCJkZXN0cm95IiwiZGV2aWNlIiwiZm9yRWFjaCIsInNoYWRlciIsImdsIiwiZGVsZXRlU2hhZGVyIiwibG9zZUNvbnRleHQiLCJjbGVhciIsIlNoYWRlckJhdGNoQ2FjaGUiLCJzaGFkZXJzIiwiX3ZlcnRleFNoYWRlckNhY2hlIiwiRGV2aWNlQ2FjaGUiLCJfZnJhZ21lbnRTaGFkZXJDYWNoZSIsIl9zaGFkZXJCYXRjaENhY2hlIiwiV2ViZ2xTaGFkZXIiLCJjb21waWxlRHVyYXRpb24iLCJpbml0IiwiY29tcGlsZSIsImdldEJhdGNoU2hhZGVycyIsInB1c2giLCJnbFByb2dyYW0iLCJkZWxldGVQcm9ncmFtIiwidW5pZm9ybXMiLCJzYW1wbGVycyIsImF0dHJpYnV0ZXMiLCJnbFZlcnRleFNoYWRlciIsImdsRnJhZ21lbnRTaGFkZXIiLCJiYXRjaENhY2hlIiwiZ2V0IiwiZW5kU2hhZGVyQmF0Y2giLCJpbXBsIiwibGluayIsImxlbmd0aCIsInJlc3RvcmVDb250ZXh0IiwiZGVmaW5pdGlvbiIsIl9jb21waWxlU2hhZGVyU291cmNlIiwidnNoYWRlciIsImZzaGFkZXIiLCJzdGFydFRpbWUiLCJEZWJ1ZyIsImNhbGwiLCJub3ciLCJjcmVhdGVQcm9ncmFtIiwiYXR0YWNoU2hhZGVyIiwiYXR0cnMiLCJ3ZWJnbDIiLCJ1c2VUcmFuc2Zvcm1GZWVkYmFjayIsIm91dE5hbWVzIiwiYXR0ciIsImhhc093blByb3BlcnR5IiwidHJhbnNmb3JtRmVlZGJhY2tWYXJ5aW5ncyIsIklOVEVSTEVBVkVEX0FUVFJJQlMiLCJsb2NhdGlvbnMiLCJzZW1hbnRpYyIsImxvYyIsInNlbWFudGljVG9Mb2NhdGlvbiIsImFzc2VydCIsImJpbmRBdHRyaWJMb2NhdGlvbiIsImxpbmtQcm9ncmFtIiwiX3NoYWRlclN0YXRzIiwibGlua2VkIiwidGFnIiwiU0hBREVSVEFHX01BVEVSSUFMIiwibWF0ZXJpYWxTaGFkZXJzIiwic3JjIiwiaXNWZXJ0ZXhTaGFkZXIiLCJzaGFkZXJEZXZpY2VDYWNoZSIsInNoYWRlckNhY2hlIiwiZ2xTaGFkZXIiLCJmaXJlIiwidGltZXN0YW1wIiwidGFyZ2V0IiwiY3JlYXRlU2hhZGVyIiwiVkVSVEVYX1NIQURFUiIsIkZSQUdNRU5UX1NIQURFUiIsInNoYWRlclNvdXJjZSIsImNvbXBpbGVTaGFkZXIiLCJzZXQiLCJlbmRUaW1lIiwiY29tcGlsZVRpbWUiLCJ2c0NvbXBpbGVkIiwiZnNDb21waWxlZCIsImZpbmFsaXplIiwibGlua1N0YXJ0VGltZSIsImxpbmtTdGF0dXMiLCJnZXRQcm9ncmFtUGFyYW1ldGVyIiwiTElOS19TVEFUVVMiLCJfZ2wkZ2V0RXh0ZW5zaW9uIiwiX2dsJGdldEV4dGVuc2lvbjIiLCJfaXNDb21waWxlZCIsIm1lc3NhZ2UiLCJnZXRQcm9ncmFtSW5mb0xvZyIsInRyYW5zbGF0ZWRGcmFnIiwiZ2V0RXh0ZW5zaW9uIiwiZ2V0VHJhbnNsYXRlZFNoYWRlclNvdXJjZSIsInRyYW5zbGF0ZWRWZXJ0IiwiY29uc29sZSIsImVycm9yIiwiaSIsIm51bUF0dHJpYnV0ZXMiLCJBQ1RJVkVfQVRUUklCVVRFUyIsImluZm8iLCJnZXRBY3RpdmVBdHRyaWIiLCJsb2NhdGlvbiIsImdldEF0dHJpYkxvY2F0aW9uIiwibmFtZSIsImluZGV4T2YiLCJ1bmRlZmluZWQiLCJsYWJlbCIsImZhaWxlZCIsInNoYWRlcklucHV0IiwiV2ViZ2xTaGFkZXJJbnB1dCIsInBjVW5pZm9ybVR5cGUiLCJ0eXBlIiwibnVtVW5pZm9ybXMiLCJBQ1RJVkVfVU5JRk9STVMiLCJnZXRBY3RpdmVVbmlmb3JtIiwiZ2V0VW5pZm9ybUxvY2F0aW9uIiwiU0FNUExFUl8yRCIsIlNBTVBMRVJfQ1VCRSIsIlNBTVBMRVJfMkRfU0hBRE9XIiwiU0FNUExFUl9DVUJFX1NIQURPVyIsIlNBTVBMRVJfM0QiLCJyZWFkeSIsImR1cmF0aW9uIiwidHJhY2UiLCJUUkFDRUlEX1NIQURFUl9DT01QSUxFIiwiaWQiLCJ0b0ZpeGVkIiwic291cmNlIiwic2hhZGVyVHlwZSIsImdldFNoYWRlclBhcmFtZXRlciIsIkNPTVBJTEVfU1RBVFVTIiwiaW5mb0xvZyIsImdldFNoYWRlckluZm9Mb2ciLCJjb2RlIiwiX3Byb2Nlc3NFcnJvciIsImxpbmVzIiwic3BsaXQiLCJmcm9tIiwidG8iLCJzdGFydHNXaXRoIiwibWF0Y2giLCJsaW5lIiwicGFyc2VJbnQiLCJNYXRoIiwibWF4IiwibWluIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBUUEsSUFBSUEsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0FBRXpCLE1BQU1DLHFCQUFxQixHQUFHLENBQzFCLGFBQWEsRUFDYixlQUFlLEVBQ2YsV0FBVyxFQUNYLGVBQWUsRUFDZixpQkFBaUIsQ0FDcEIsQ0FBQTs7QUFFRDtBQUNBLE1BQU1DLG1CQUFtQixDQUFDO0VBQUFDLFdBQUEsR0FBQTtBQUFBLElBQUEsSUFBQSxDQUV0QkMsR0FBRyxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0FBQUEsR0FBQTtBQUVmO0VBQ0FDLE9BQU9BLENBQUNDLE1BQU0sRUFBRTtBQUNaLElBQUEsSUFBSSxDQUFDSCxHQUFHLENBQUNJLE9BQU8sQ0FBRUMsTUFBTSxJQUFLO0FBQ3pCRixNQUFBQSxNQUFNLENBQUNHLEVBQUUsQ0FBQ0MsWUFBWSxDQUFDRixNQUFNLENBQUMsQ0FBQTtBQUNsQyxLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7O0FBRUE7RUFDQUcsV0FBV0EsQ0FBQ0wsTUFBTSxFQUFFO0FBQ2hCLElBQUEsSUFBSSxDQUFDSCxHQUFHLENBQUNTLEtBQUssRUFBRSxDQUFBO0FBQ3BCLEdBQUE7QUFDSixDQUFBOztBQUVBO0FBQ0EsTUFBTUMsZ0JBQWdCLENBQUM7RUFBQVgsV0FBQSxHQUFBO0lBQUEsSUFDbkJZLENBQUFBLE9BQU8sR0FBRyxFQUFFLENBQUE7QUFBQSxHQUFBO0VBRVpILFdBQVdBLENBQUNMLE1BQU0sRUFBRTtJQUNoQixJQUFJLENBQUNRLE9BQU8sR0FBRyxFQUFFLENBQUE7QUFDckIsR0FBQTtBQUNKLENBQUE7QUFFQSxNQUFNQyxrQkFBa0IsR0FBRyxJQUFJQyxXQUFXLEVBQUUsQ0FBQTtBQUM1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
