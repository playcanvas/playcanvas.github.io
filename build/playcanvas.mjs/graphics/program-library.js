import '../core/tracing.js';
import { version, revision } from '../core/core.js';
import { Shader } from './shader.js';
import { SHADER_FORWARD, SHADER_SHADOW, SHADER_DEPTH, SHADER_PICK } from '../scene/constants.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { ShaderPass } from '../scene/shader-pass.js';

class ProgramLibrary {
  constructor(device) {
    this.processedCache = new Map();
    this._device = device;
    this._cache = {};
    this._generators = {};
    this._isClearingCache = false;
    this._precached = false;
    this._programsCollection = [];
    this._defaultStdMatOption = {};
    this._defaultStdMatOptionMin = {};
    const m = new StandardMaterial();
    m.shaderOptBuilder.updateRef(this._defaultStdMatOption, {}, m, null, [], SHADER_FORWARD, null);
    m.shaderOptBuilder.updateMinRef(this._defaultStdMatOptionMin, {}, m, null, [], SHADER_SHADOW, null);
  }

  register(name, generator) {
    if (!this.isRegistered(name)) {
      this._generators[name] = generator;
    }
  }

  unregister(name) {
    if (this.isRegistered(name)) {
      delete this._generators[name];
    }
  }

  isRegistered(name) {
    const generator = this._generators[name];
    return generator !== undefined;
  }

  generateShader(generator, name, key, options) {
    let shader = this._cache[key];

    if (!shader) {
      let lights;

      if (options.lights) {
        lights = options.lights;
        options.lights = lights.map(function (l) {
          const lcopy = l.clone ? l.clone() : l;
          lcopy.key = l.key;
          return lcopy;
        });
      }

      this.storeNewProgram(name, options);
      if (options.lights) options.lights = lights;
      if (this._precached) ;
      const device = this._device;
      const shaderDefinition = generator.createShaderDefinition(device, options);
      shaderDefinition.name = `${name}-pass:${options.pass}`;
      shader = this._cache[key] = new Shader(device, shaderDefinition);
    }

    return shader;
  }

  getProgram(name, options, processingOptions) {
    const generator = this._generators[name];

    if (!generator) {
      return null;
    }

    const generationKey = generator.generateKey(options);
    const processingKey = JSON.stringify(processingOptions);
    const totalKey = `${generationKey}#${processingKey}`;
    let processedShader = this.processedCache.get(totalKey);

    if (!processedShader) {
      const generatedShader = this.generateShader(generator, name, generationKey, options);
      const generatedShaderDef = generatedShader.definition;
      const shaderDefinition = {
        attributes: generatedShaderDef.attributes,
        vshader: generatedShaderDef.vshader,
        fshader: generatedShaderDef.fshader,
        processingOptions: processingOptions
      };
      processedShader = new Shader(this._device, shaderDefinition);
      this.processedCache.set(totalKey, processedShader);
    }

    return processedShader;
  }

  storeNewProgram(name, options) {
    let opt = {};

    if (name === "standard") {
      const defaultMat = this._getDefaultStdMatOptions(options.pass);

      for (const p in options) {
        if (options.hasOwnProperty(p) && defaultMat[p] !== options[p] || p === "pass") opt[p] = options[p];
      }
    } else {
      opt = options;
    }

    this._programsCollection.push(JSON.stringify({
      name: name,
      options: opt
    }));
  }

  dumpPrograms() {
    let text = 'let device = pc.app ? pc.app.graphicsDevice : pc.Application.getApplication().graphicsDevice;\n';
    text += 'let shaders = [';
    if (this._programsCollection[0]) text += '\n\t' + this._programsCollection[0];

    for (let i = 1; i < this._programsCollection.length; ++i) {
      text += ',\n\t' + this._programsCollection[i];
    }

    text += '\n];\n';
    text += 'device.programLib.precompile(shaders);\n';
    text += 'if (pc.version != \"' + version + '\" || pc.revision != \"' + revision + '\")\n';
    text += '\tconsole.warn(\"precompile-shaders.js: engine version mismatch, rebuild shaders lib with current engine\");';
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', 'precompile-shaders.js');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  clearCache() {
    const cache = this._cache;
    this._isClearingCache = true;

    for (const key in cache) {
      if (cache.hasOwnProperty(key)) {
        cache[key].destroy();
      }
    }

    this._cache = {};
    this._isClearingCache = false;
  }

  removeFromCache(shader) {
    if (this._isClearingCache) return;
    const cache = this._cache;

    for (const key in cache) {
      if (cache.hasOwnProperty(key)) {
        if (cache[key] === shader) {
          delete cache[key];
          break;
        }
      }
    }
  }

  _getDefaultStdMatOptions(pass) {
    return pass === SHADER_DEPTH || pass === SHADER_PICK || ShaderPass.isShadow(pass) ? this._defaultStdMatOptionMin : this._defaultStdMatOption;
  }

  precompile(cache) {
    if (cache) {
      const shaders = new Array(cache.length);

      for (let i = 0; i < cache.length; i++) {
        if (cache[i].name === "standard") {
          const opt = cache[i].options;

          const defaultMat = this._getDefaultStdMatOptions(opt.pass);

          for (const p in defaultMat) {
            if (defaultMat.hasOwnProperty(p) && opt[p] === undefined) opt[p] = defaultMat[p];
          }
        }

        shaders[i] = this.getProgram(cache[i].name, cache[i].options);
      }
    }

    this._precached = true;
  }

}

export { ProgramLibrary };
