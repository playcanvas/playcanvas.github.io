import { Debug } from '../../core/debug.js';
import { version, revision } from '../../core/core.js';
import { Shader } from '../../platform/graphics/shader.js';
import { SHADER_FORWARD, SHADER_SHADOW, SHADER_DEPTH, SHADER_PICK } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { StandardMaterialOptions } from '../materials/standard-material-options.js';

/**
 * A class responsible for creation and caching of required shaders.
 * There is a two level cache. The first level generates the shader based on the provided options.
 * The second level processes this generated shader using processing options - in most cases
 * modifies it to support uniform buffers.
 *
 * @ignore
 */
class ProgramLibrary {
  /**
   * A cache of shaders processed using processing options.
   *
   * @type {Map<string, Shader>}
   */

  /**
   * A cache of shader definitions before processing.
   *
   * @type {Map<string, object>}
   */

  constructor(device, standardMaterial) {
    this.processedCache = new Map();
    this.definitionsCache = new Map();
    this._device = device;
    this._generators = {};
    this._isClearingCache = false;
    this._precached = false;

    // Unique non-cached programs collection to dump and update game shaders cache
    this._programsCollection = [];
    this._defaultStdMatOption = new StandardMaterialOptions();
    this._defaultStdMatOptionMin = new StandardMaterialOptions();
    standardMaterial.shaderOptBuilder.updateRef(this._defaultStdMatOption, {}, standardMaterial, null, [], SHADER_FORWARD, null);
    standardMaterial.shaderOptBuilder.updateMinRef(this._defaultStdMatOptionMin, {}, standardMaterial, null, [], SHADER_SHADOW, null);
    device.on('destroy:shader', shader => {
      this.removeFromCache(shader);
    });
  }
  destroy() {
    this.clearCache();
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
  generateShaderDefinition(generator, name, key, options) {
    let def = this.definitionsCache.get(key);
    if (!def) {
      var _options$litOptions, _options$litOptions2, _def$name;
      let lights;
      if ((_options$litOptions = options.litOptions) != null && _options$litOptions.lights) {
        lights = options.litOptions.lights;
        options.litOptions.lights = lights.map(function (l) {
          // TODO: refactor this to avoid creating a clone of the light.
          const lcopy = l.clone ? l.clone() : l;
          lcopy.key = l.key;
          return lcopy;
        });
      }
      this.storeNewProgram(name, options);
      if ((_options$litOptions2 = options.litOptions) != null && _options$litOptions2.lights) options.litOptions.lights = lights;
      if (this._precached) Debug.log(`ProgramLibrary#getProgram: Cache miss for shader ${name} key ${key} after shaders precaching`);
      const device = this._device;
      def = generator.createShaderDefinition(device, options);
      def.name = (_def$name = def.name) != null ? _def$name : options.pass ? `${name}-pass:${options.pass}` : name;
      this.definitionsCache.set(key, def);
    }
    return def;
  }
  getCachedShader(key) {
    return this.processedCache.get(key);
  }
  setCachedShader(key, shader) {
    this.processedCache.set(key, shader);
  }
  getProgram(name, options, processingOptions) {
    const generator = this._generators[name];
    if (!generator) {
      Debug.warn(`ProgramLibrary#getProgram: No program library functions registered for: ${name}`);
      return null;
    }

    // we have a key for shader source code generation, a key for its further processing to work with
    // uniform buffers, and a final key to get the processed shader from the cache
    const generationKey = generator.generateKey(options);
    const processingKey = processingOptions.generateKey();
    const totalKey = `${generationKey}#${processingKey}`;

    // do we have final processed shader
    let processedShader = this.getCachedShader(totalKey);
    if (!processedShader) {
      // get generated shader
      const generatedShaderDef = this.generateShaderDefinition(generator, name, generationKey, options);
      Debug.assert(generatedShaderDef);

      // use shader pass name if known
      let passName = '';
      if (options.pass !== undefined) {
        const shaderPassInfo = ShaderPass.get(this._device).getByIndex(options.pass);
        passName = `-${shaderPassInfo.name}`;
      }

      // create a shader definition for the shader that will include the processingOptions
      const shaderDefinition = {
        name: `${generatedShaderDef.name}${passName}-proc`,
        attributes: generatedShaderDef.attributes,
        vshader: generatedShaderDef.vshader,
        fshader: generatedShaderDef.fshader,
        processingOptions: processingOptions
      };

      // add new shader to the processed cache
      processedShader = new Shader(this._device, shaderDefinition);
      this.setCachedShader(totalKey, processedShader);
    }
    return processedShader;
  }
  storeNewProgram(name, options) {
    let opt = {};
    if (name === "standard") {
      // For standard material saving all default values is overkill, so we store only diff
      const defaultMat = this._getDefaultStdMatOptions(options.pass);
      for (const p in options) {
        if (options.hasOwnProperty(p) && defaultMat[p] !== options[p] || p === "pass") opt[p] = options[p];
      }

      // Note: this was added in #4792 and it does not filter out the default values, like the loop above
      for (const p in options.litOptions) {
        opt[p] = options.litOptions[p];
      }
    } else {
      // Other shaders have only dozen params
      opt = options;
    }
    this._programsCollection.push(JSON.stringify({
      name: name,
      options: opt
    }));
  }

  // run pc.app.graphicsDevice.getProgramLibrary().dumpPrograms(); from browser console to build shader options script
  dumpPrograms() {
    let text = 'let device = pc.app ? pc.app.graphicsDevice : pc.Application.getApplication().graphicsDevice;\n';
    text += 'let shaders = [';
    if (this._programsCollection[0]) text += '\n\t' + this._programsCollection[0];
    for (let i = 1; i < this._programsCollection.length; ++i) {
      text += ',\n\t' + this._programsCollection[i];
    }
    text += '\n];\n';
    text += 'device.getProgramLibrary().precompile(shaders);\n';
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
    this._isClearingCache = true;
    this.processedCache.forEach(shader => {
      shader.destroy();
    });
    this.processedCache.clear();
    this._isClearingCache = false;
  }

  /**
   * Remove shader from the cache. This function does not destroy it, that is the responsibility
   * of the caller.
   *
   * @param {Shader} shader - The shader to be removed.
   */
  removeFromCache(shader) {
    // don't delete by one when clearing whole cache
    if (this._isClearingCache) return;
    this.processedCache.forEach((cachedShader, key) => {
      if (shader === cachedShader) {
        this.processedCache.delete(key);
      }
    });
  }
  _getDefaultStdMatOptions(pass) {
    const shaderPassInfo = ShaderPass.get(this._device).getByIndex(pass);
    return pass === SHADER_DEPTH || pass === SHADER_PICK || shaderPassInfo.isShadow ? this._defaultStdMatOptionMin : this._defaultStdMatOption;
  }
  precompile(cache) {
    if (cache) {
      const shaders = new Array(cache.length);
      for (let i = 0; i < cache.length; i++) {
        // default options for the standard materials are not stored, and so they are inserted
        // back into the loaded options
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3JhbS1saWJyYXJ5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHZlcnNpb24sIHJldmlzaW9uIH0gZnJvbSAnLi4vLi4vY29yZS9jb3JlLmpzJztcblxuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJztcblxuaW1wb3J0IHsgU0hBREVSX0ZPUldBUkQsIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0ssIFNIQURFUl9TSEFET1cgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uL3NoYWRlci1wYXNzLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIH0gZnJvbSAnLi4vbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnO1xuXG4vKipcbiAqIEEgY2xhc3MgcmVzcG9uc2libGUgZm9yIGNyZWF0aW9uIGFuZCBjYWNoaW5nIG9mIHJlcXVpcmVkIHNoYWRlcnMuXG4gKiBUaGVyZSBpcyBhIHR3byBsZXZlbCBjYWNoZS4gVGhlIGZpcnN0IGxldmVsIGdlbmVyYXRlcyB0aGUgc2hhZGVyIGJhc2VkIG9uIHRoZSBwcm92aWRlZCBvcHRpb25zLlxuICogVGhlIHNlY29uZCBsZXZlbCBwcm9jZXNzZXMgdGhpcyBnZW5lcmF0ZWQgc2hhZGVyIHVzaW5nIHByb2Nlc3Npbmcgb3B0aW9ucyAtIGluIG1vc3QgY2FzZXNcbiAqIG1vZGlmaWVzIGl0IHRvIHN1cHBvcnQgdW5pZm9ybSBidWZmZXJzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgUHJvZ3JhbUxpYnJhcnkge1xuICAgIC8qKlxuICAgICAqIEEgY2FjaGUgb2Ygc2hhZGVycyBwcm9jZXNzZWQgdXNpbmcgcHJvY2Vzc2luZyBvcHRpb25zLlxuICAgICAqXG4gICAgICogQHR5cGUge01hcDxzdHJpbmcsIFNoYWRlcj59XG4gICAgICovXG4gICAgcHJvY2Vzc2VkQ2FjaGUgPSBuZXcgTWFwKCk7XG5cbiAgICAvKipcbiAgICAgKiBBIGNhY2hlIG9mIHNoYWRlciBkZWZpbml0aW9ucyBiZWZvcmUgcHJvY2Vzc2luZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8c3RyaW5nLCBvYmplY3Q+fVxuICAgICAqL1xuICAgIGRlZmluaXRpb25zQ2FjaGUgPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIHN0YW5kYXJkTWF0ZXJpYWwpIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLl9nZW5lcmF0b3JzID0ge307XG4gICAgICAgIHRoaXMuX2lzQ2xlYXJpbmdDYWNoZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9wcmVjYWNoZWQgPSBmYWxzZTtcblxuICAgICAgICAvLyBVbmlxdWUgbm9uLWNhY2hlZCBwcm9ncmFtcyBjb2xsZWN0aW9uIHRvIGR1bXAgYW5kIHVwZGF0ZSBnYW1lIHNoYWRlcnMgY2FjaGVcbiAgICAgICAgdGhpcy5fcHJvZ3JhbXNDb2xsZWN0aW9uID0gW107XG4gICAgICAgIHRoaXMuX2RlZmF1bHRTdGRNYXRPcHRpb24gPSBuZXcgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMoKTtcbiAgICAgICAgdGhpcy5fZGVmYXVsdFN0ZE1hdE9wdGlvbk1pbiA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucygpO1xuXG4gICAgICAgIHN0YW5kYXJkTWF0ZXJpYWwuc2hhZGVyT3B0QnVpbGRlci51cGRhdGVSZWYoXG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0U3RkTWF0T3B0aW9uLCB7fSwgc3RhbmRhcmRNYXRlcmlhbCwgbnVsbCwgW10sIFNIQURFUl9GT1JXQVJELCBudWxsKTtcbiAgICAgICAgc3RhbmRhcmRNYXRlcmlhbC5zaGFkZXJPcHRCdWlsZGVyLnVwZGF0ZU1pblJlZihcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRTdGRNYXRPcHRpb25NaW4sIHt9LCBzdGFuZGFyZE1hdGVyaWFsLCBudWxsLCBbXSwgU0hBREVSX1NIQURPVywgbnVsbCk7XG5cbiAgICAgICAgZGV2aWNlLm9uKCdkZXN0cm95OnNoYWRlcicsIChzaGFkZXIpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRnJvbUNhY2hlKHNoYWRlcik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuY2xlYXJDYWNoZSgpO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyKG5hbWUsIGdlbmVyYXRvcikge1xuICAgICAgICBpZiAoIXRoaXMuaXNSZWdpc3RlcmVkKG5hbWUpKSB7XG4gICAgICAgICAgICB0aGlzLl9nZW5lcmF0b3JzW25hbWVdID0gZ2VuZXJhdG9yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdW5yZWdpc3RlcihuYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLmlzUmVnaXN0ZXJlZChuYW1lKSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2dlbmVyYXRvcnNbbmFtZV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpc1JlZ2lzdGVyZWQobmFtZSkge1xuICAgICAgICBjb25zdCBnZW5lcmF0b3IgPSB0aGlzLl9nZW5lcmF0b3JzW25hbWVdO1xuICAgICAgICByZXR1cm4gKGdlbmVyYXRvciAhPT0gdW5kZWZpbmVkKTtcbiAgICB9XG5cbiAgICBnZW5lcmF0ZVNoYWRlckRlZmluaXRpb24oZ2VuZXJhdG9yLCBuYW1lLCBrZXksIG9wdGlvbnMpIHtcbiAgICAgICAgbGV0IGRlZiA9IHRoaXMuZGVmaW5pdGlvbnNDYWNoZS5nZXQoa2V5KTtcbiAgICAgICAgaWYgKCFkZWYpIHtcbiAgICAgICAgICAgIGxldCBsaWdodHM7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zPy5saWdodHMpIHtcbiAgICAgICAgICAgICAgICBsaWdodHMgPSBvcHRpb25zLmxpdE9wdGlvbnMubGlnaHRzO1xuICAgICAgICAgICAgICAgIG9wdGlvbnMubGl0T3B0aW9ucy5saWdodHMgPSBsaWdodHMubWFwKGZ1bmN0aW9uIChsKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHJlZmFjdG9yIHRoaXMgdG8gYXZvaWQgY3JlYXRpbmcgYSBjbG9uZSBvZiB0aGUgbGlnaHQuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxjb3B5ID0gbC5jbG9uZSA/IGwuY2xvbmUoKSA6IGw7XG4gICAgICAgICAgICAgICAgICAgIGxjb3B5LmtleSA9IGwua2V5O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGNvcHk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc3RvcmVOZXdQcm9ncmFtKG5hbWUsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saXRPcHRpb25zPy5saWdodHMpXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5saXRPcHRpb25zLmxpZ2h0cyA9IGxpZ2h0cztcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3ByZWNhY2hlZClcbiAgICAgICAgICAgICAgICBEZWJ1Zy5sb2coYFByb2dyYW1MaWJyYXJ5I2dldFByb2dyYW06IENhY2hlIG1pc3MgZm9yIHNoYWRlciAke25hbWV9IGtleSAke2tleX0gYWZ0ZXIgc2hhZGVycyBwcmVjYWNoaW5nYCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuX2RldmljZTtcbiAgICAgICAgICAgIGRlZiA9IGdlbmVyYXRvci5jcmVhdGVTaGFkZXJEZWZpbml0aW9uKGRldmljZSwgb3B0aW9ucyk7XG4gICAgICAgICAgICBkZWYubmFtZSA9IGRlZi5uYW1lID8/IChvcHRpb25zLnBhc3MgPyBgJHtuYW1lfS1wYXNzOiR7b3B0aW9ucy5wYXNzfWAgOiBuYW1lKTtcbiAgICAgICAgICAgIHRoaXMuZGVmaW5pdGlvbnNDYWNoZS5zZXQoa2V5LCBkZWYpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkZWY7XG4gICAgfVxuXG4gICAgZ2V0Q2FjaGVkU2hhZGVyKGtleSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wcm9jZXNzZWRDYWNoZS5nZXQoa2V5KTtcbiAgICB9XG5cbiAgICBzZXRDYWNoZWRTaGFkZXIoa2V5LCBzaGFkZXIpIHtcbiAgICAgICAgdGhpcy5wcm9jZXNzZWRDYWNoZS5zZXQoa2V5LCBzaGFkZXIpO1xuICAgIH1cblxuICAgIGdldFByb2dyYW0obmFtZSwgb3B0aW9ucywgcHJvY2Vzc2luZ09wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZ2VuZXJhdG9yID0gdGhpcy5fZ2VuZXJhdG9yc1tuYW1lXTtcbiAgICAgICAgaWYgKCFnZW5lcmF0b3IpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYFByb2dyYW1MaWJyYXJ5I2dldFByb2dyYW06IE5vIHByb2dyYW0gbGlicmFyeSBmdW5jdGlvbnMgcmVnaXN0ZXJlZCBmb3I6ICR7bmFtZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2UgaGF2ZSBhIGtleSBmb3Igc2hhZGVyIHNvdXJjZSBjb2RlIGdlbmVyYXRpb24sIGEga2V5IGZvciBpdHMgZnVydGhlciBwcm9jZXNzaW5nIHRvIHdvcmsgd2l0aFxuICAgICAgICAvLyB1bmlmb3JtIGJ1ZmZlcnMsIGFuZCBhIGZpbmFsIGtleSB0byBnZXQgdGhlIHByb2Nlc3NlZCBzaGFkZXIgZnJvbSB0aGUgY2FjaGVcbiAgICAgICAgY29uc3QgZ2VuZXJhdGlvbktleSA9IGdlbmVyYXRvci5nZW5lcmF0ZUtleShvcHRpb25zKTtcbiAgICAgICAgY29uc3QgcHJvY2Vzc2luZ0tleSA9IHByb2Nlc3NpbmdPcHRpb25zLmdlbmVyYXRlS2V5KCk7XG4gICAgICAgIGNvbnN0IHRvdGFsS2V5ID0gYCR7Z2VuZXJhdGlvbktleX0jJHtwcm9jZXNzaW5nS2V5fWA7XG5cbiAgICAgICAgLy8gZG8gd2UgaGF2ZSBmaW5hbCBwcm9jZXNzZWQgc2hhZGVyXG4gICAgICAgIGxldCBwcm9jZXNzZWRTaGFkZXIgPSB0aGlzLmdldENhY2hlZFNoYWRlcih0b3RhbEtleSk7XG4gICAgICAgIGlmICghcHJvY2Vzc2VkU2hhZGVyKSB7XG5cbiAgICAgICAgICAgIC8vIGdldCBnZW5lcmF0ZWQgc2hhZGVyXG4gICAgICAgICAgICBjb25zdCBnZW5lcmF0ZWRTaGFkZXJEZWYgPSB0aGlzLmdlbmVyYXRlU2hhZGVyRGVmaW5pdGlvbihnZW5lcmF0b3IsIG5hbWUsIGdlbmVyYXRpb25LZXksIG9wdGlvbnMpO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGdlbmVyYXRlZFNoYWRlckRlZik7XG5cbiAgICAgICAgICAgIC8vIHVzZSBzaGFkZXIgcGFzcyBuYW1lIGlmIGtub3duXG4gICAgICAgICAgICBsZXQgcGFzc05hbWUgPSAnJztcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnBhc3MgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRlclBhc3NJbmZvID0gU2hhZGVyUGFzcy5nZXQodGhpcy5fZGV2aWNlKS5nZXRCeUluZGV4KG9wdGlvbnMucGFzcyk7XG4gICAgICAgICAgICAgICAgcGFzc05hbWUgPSBgLSR7c2hhZGVyUGFzc0luZm8ubmFtZX1gO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjcmVhdGUgYSBzaGFkZXIgZGVmaW5pdGlvbiBmb3IgdGhlIHNoYWRlciB0aGF0IHdpbGwgaW5jbHVkZSB0aGUgcHJvY2Vzc2luZ09wdGlvbnNcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlckRlZmluaXRpb24gPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogYCR7Z2VuZXJhdGVkU2hhZGVyRGVmLm5hbWV9JHtwYXNzTmFtZX0tcHJvY2AsXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlczogZ2VuZXJhdGVkU2hhZGVyRGVmLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICAgICAgdnNoYWRlcjogZ2VuZXJhdGVkU2hhZGVyRGVmLnZzaGFkZXIsXG4gICAgICAgICAgICAgICAgZnNoYWRlcjogZ2VuZXJhdGVkU2hhZGVyRGVmLmZzaGFkZXIsXG4gICAgICAgICAgICAgICAgcHJvY2Vzc2luZ09wdGlvbnM6IHByb2Nlc3NpbmdPcHRpb25zXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBhZGQgbmV3IHNoYWRlciB0byB0aGUgcHJvY2Vzc2VkIGNhY2hlXG4gICAgICAgICAgICBwcm9jZXNzZWRTaGFkZXIgPSBuZXcgU2hhZGVyKHRoaXMuX2RldmljZSwgc2hhZGVyRGVmaW5pdGlvbik7XG4gICAgICAgICAgICB0aGlzLnNldENhY2hlZFNoYWRlcih0b3RhbEtleSwgcHJvY2Vzc2VkU2hhZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9jZXNzZWRTaGFkZXI7XG4gICAgfVxuXG4gICAgc3RvcmVOZXdQcm9ncmFtKG5hbWUsIG9wdGlvbnMpIHtcbiAgICAgICAgbGV0IG9wdCA9IHt9O1xuICAgICAgICBpZiAobmFtZSA9PT0gXCJzdGFuZGFyZFwiKSB7XG4gICAgICAgICAgICAvLyBGb3Igc3RhbmRhcmQgbWF0ZXJpYWwgc2F2aW5nIGFsbCBkZWZhdWx0IHZhbHVlcyBpcyBvdmVya2lsbCwgc28gd2Ugc3RvcmUgb25seSBkaWZmXG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0TWF0ID0gdGhpcy5fZ2V0RGVmYXVsdFN0ZE1hdE9wdGlvbnMob3B0aW9ucy5wYXNzKTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoKG9wdGlvbnMuaGFzT3duUHJvcGVydHkocCkgJiYgZGVmYXVsdE1hdFtwXSAhPT0gb3B0aW9uc1twXSkgfHwgcCA9PT0gXCJwYXNzXCIpXG4gICAgICAgICAgICAgICAgICAgIG9wdFtwXSA9IG9wdGlvbnNbcF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE5vdGU6IHRoaXMgd2FzIGFkZGVkIGluICM0NzkyIGFuZCBpdCBkb2VzIG5vdCBmaWx0ZXIgb3V0IHRoZSBkZWZhdWx0IHZhbHVlcywgbGlrZSB0aGUgbG9vcCBhYm92ZVxuICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIG9wdGlvbnMubGl0T3B0aW9ucykge1xuICAgICAgICAgICAgICAgIG9wdFtwXSA9IG9wdGlvbnMubGl0T3B0aW9uc1twXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIE90aGVyIHNoYWRlcnMgaGF2ZSBvbmx5IGRvemVuIHBhcmFtc1xuICAgICAgICAgICAgb3B0ID0gb3B0aW9ucztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Byb2dyYW1zQ29sbGVjdGlvbi5wdXNoKEpTT04uc3RyaW5naWZ5KHsgbmFtZTogbmFtZSwgb3B0aW9uczogb3B0IH0pKTtcbiAgICB9XG5cbiAgICAvLyBydW4gcGMuYXBwLmdyYXBoaWNzRGV2aWNlLmdldFByb2dyYW1MaWJyYXJ5KCkuZHVtcFByb2dyYW1zKCk7IGZyb20gYnJvd3NlciBjb25zb2xlIHRvIGJ1aWxkIHNoYWRlciBvcHRpb25zIHNjcmlwdFxuICAgIGR1bXBQcm9ncmFtcygpIHtcbiAgICAgICAgbGV0IHRleHQgPSAnbGV0IGRldmljZSA9IHBjLmFwcCA/IHBjLmFwcC5ncmFwaGljc0RldmljZSA6IHBjLkFwcGxpY2F0aW9uLmdldEFwcGxpY2F0aW9uKCkuZ3JhcGhpY3NEZXZpY2U7XFxuJztcbiAgICAgICAgdGV4dCArPSAnbGV0IHNoYWRlcnMgPSBbJztcbiAgICAgICAgaWYgKHRoaXMuX3Byb2dyYW1zQ29sbGVjdGlvblswXSlcbiAgICAgICAgICAgIHRleHQgKz0gJ1xcblxcdCcgKyB0aGlzLl9wcm9ncmFtc0NvbGxlY3Rpb25bMF07XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgdGhpcy5fcHJvZ3JhbXNDb2xsZWN0aW9uLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB0ZXh0ICs9ICcsXFxuXFx0JyArIHRoaXMuX3Byb2dyYW1zQ29sbGVjdGlvbltpXTtcbiAgICAgICAgfVxuICAgICAgICB0ZXh0ICs9ICdcXG5dO1xcbic7XG4gICAgICAgIHRleHQgKz0gJ2RldmljZS5nZXRQcm9ncmFtTGlicmFyeSgpLnByZWNvbXBpbGUoc2hhZGVycyk7XFxuJztcbiAgICAgICAgdGV4dCArPSAnaWYgKHBjLnZlcnNpb24gIT0gXFxcIicgKyB2ZXJzaW9uICsgJ1xcXCIgfHwgcGMucmV2aXNpb24gIT0gXFxcIicgKyByZXZpc2lvbiArICdcXFwiKVxcbic7XG4gICAgICAgIHRleHQgKz0gJ1xcdGNvbnNvbGUud2FybihcXFwicHJlY29tcGlsZS1zaGFkZXJzLmpzOiBlbmdpbmUgdmVyc2lvbiBtaXNtYXRjaCwgcmVidWlsZCBzaGFkZXJzIGxpYiB3aXRoIGN1cnJlbnQgZW5naW5lXFxcIik7JztcblxuICAgICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnaHJlZicsICdkYXRhOnRleHQvcGxhaW47Y2hhcnNldD11dGYtOCwnICsgZW5jb2RlVVJJQ29tcG9uZW50KHRleHQpKTtcbiAgICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2Rvd25sb2FkJywgJ3ByZWNvbXBpbGUtc2hhZGVycy5qcycpO1xuICAgICAgICBlbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG4gICAgICAgIGVsZW1lbnQuY2xpY2soKTtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChlbGVtZW50KTtcbiAgICB9XG5cbiAgICBjbGVhckNhY2hlKCkge1xuICAgICAgICB0aGlzLl9pc0NsZWFyaW5nQ2FjaGUgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMucHJvY2Vzc2VkQ2FjaGUuZm9yRWFjaCgoc2hhZGVyKSA9PiB7XG4gICAgICAgICAgICBzaGFkZXIuZGVzdHJveSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5wcm9jZXNzZWRDYWNoZS5jbGVhcigpO1xuXG4gICAgICAgIHRoaXMuX2lzQ2xlYXJpbmdDYWNoZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBzaGFkZXIgZnJvbSB0aGUgY2FjaGUuIFRoaXMgZnVuY3Rpb24gZG9lcyBub3QgZGVzdHJveSBpdCwgdGhhdCBpcyB0aGUgcmVzcG9uc2liaWxpdHlcbiAgICAgKiBvZiB0aGUgY2FsbGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gYmUgcmVtb3ZlZC5cbiAgICAgKi9cbiAgICByZW1vdmVGcm9tQ2FjaGUoc2hhZGVyKSB7XG4gICAgICAgIC8vIGRvbid0IGRlbGV0ZSBieSBvbmUgd2hlbiBjbGVhcmluZyB3aG9sZSBjYWNoZVxuICAgICAgICBpZiAodGhpcy5faXNDbGVhcmluZ0NhY2hlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMucHJvY2Vzc2VkQ2FjaGUuZm9yRWFjaCgoY2FjaGVkU2hhZGVyLCBrZXkpID0+IHtcbiAgICAgICAgICAgIGlmIChzaGFkZXIgPT09IGNhY2hlZFNoYWRlcikge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc2VkQ2FjaGUuZGVsZXRlKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF9nZXREZWZhdWx0U3RkTWF0T3B0aW9ucyhwYXNzKSB7XG4gICAgICAgIGNvbnN0IHNoYWRlclBhc3NJbmZvID0gU2hhZGVyUGFzcy5nZXQodGhpcy5fZGV2aWNlKS5nZXRCeUluZGV4KHBhc3MpO1xuICAgICAgICByZXR1cm4gKHBhc3MgPT09IFNIQURFUl9ERVBUSCB8fCBwYXNzID09PSBTSEFERVJfUElDSyB8fCBzaGFkZXJQYXNzSW5mby5pc1NoYWRvdykgP1xuICAgICAgICAgICAgdGhpcy5fZGVmYXVsdFN0ZE1hdE9wdGlvbk1pbiA6IHRoaXMuX2RlZmF1bHRTdGRNYXRPcHRpb247XG4gICAgfVxuXG4gICAgcHJlY29tcGlsZShjYWNoZSkge1xuICAgICAgICBpZiAoY2FjaGUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlcnMgPSBuZXcgQXJyYXkoY2FjaGUubGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FjaGUubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgb3B0aW9ucyBmb3IgdGhlIHN0YW5kYXJkIG1hdGVyaWFscyBhcmUgbm90IHN0b3JlZCwgYW5kIHNvIHRoZXkgYXJlIGluc2VydGVkXG4gICAgICAgICAgICAgICAgLy8gYmFjayBpbnRvIHRoZSBsb2FkZWQgb3B0aW9uc1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZVtpXS5uYW1lID09PSBcInN0YW5kYXJkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0ID0gY2FjaGVbaV0ub3B0aW9ucztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVmYXVsdE1hdCA9IHRoaXMuX2dldERlZmF1bHRTdGRNYXRPcHRpb25zKG9wdC5wYXNzKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIGRlZmF1bHRNYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZWZhdWx0TWF0Lmhhc093blByb3BlcnR5KHApICYmIG9wdFtwXSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdFtwXSA9IGRlZmF1bHRNYXRbcF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzaGFkZXJzW2ldID0gdGhpcy5nZXRQcm9ncmFtKGNhY2hlW2ldLm5hbWUsIGNhY2hlW2ldLm9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3ByZWNhY2hlZCA9IHRydWU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQcm9ncmFtTGlicmFyeSB9O1xuIl0sIm5hbWVzIjpbIlByb2dyYW1MaWJyYXJ5IiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJzdGFuZGFyZE1hdGVyaWFsIiwicHJvY2Vzc2VkQ2FjaGUiLCJNYXAiLCJkZWZpbml0aW9uc0NhY2hlIiwiX2RldmljZSIsIl9nZW5lcmF0b3JzIiwiX2lzQ2xlYXJpbmdDYWNoZSIsIl9wcmVjYWNoZWQiLCJfcHJvZ3JhbXNDb2xsZWN0aW9uIiwiX2RlZmF1bHRTdGRNYXRPcHRpb24iLCJTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyIsIl9kZWZhdWx0U3RkTWF0T3B0aW9uTWluIiwic2hhZGVyT3B0QnVpbGRlciIsInVwZGF0ZVJlZiIsIlNIQURFUl9GT1JXQVJEIiwidXBkYXRlTWluUmVmIiwiU0hBREVSX1NIQURPVyIsIm9uIiwic2hhZGVyIiwicmVtb3ZlRnJvbUNhY2hlIiwiZGVzdHJveSIsImNsZWFyQ2FjaGUiLCJyZWdpc3RlciIsIm5hbWUiLCJnZW5lcmF0b3IiLCJpc1JlZ2lzdGVyZWQiLCJ1bnJlZ2lzdGVyIiwidW5kZWZpbmVkIiwiZ2VuZXJhdGVTaGFkZXJEZWZpbml0aW9uIiwia2V5Iiwib3B0aW9ucyIsImRlZiIsImdldCIsIl9vcHRpb25zJGxpdE9wdGlvbnMiLCJfb3B0aW9ucyRsaXRPcHRpb25zMiIsIl9kZWYkbmFtZSIsImxpZ2h0cyIsImxpdE9wdGlvbnMiLCJtYXAiLCJsIiwibGNvcHkiLCJjbG9uZSIsInN0b3JlTmV3UHJvZ3JhbSIsIkRlYnVnIiwibG9nIiwiY3JlYXRlU2hhZGVyRGVmaW5pdGlvbiIsInBhc3MiLCJzZXQiLCJnZXRDYWNoZWRTaGFkZXIiLCJzZXRDYWNoZWRTaGFkZXIiLCJnZXRQcm9ncmFtIiwicHJvY2Vzc2luZ09wdGlvbnMiLCJ3YXJuIiwiZ2VuZXJhdGlvbktleSIsImdlbmVyYXRlS2V5IiwicHJvY2Vzc2luZ0tleSIsInRvdGFsS2V5IiwicHJvY2Vzc2VkU2hhZGVyIiwiZ2VuZXJhdGVkU2hhZGVyRGVmIiwiYXNzZXJ0IiwicGFzc05hbWUiLCJzaGFkZXJQYXNzSW5mbyIsIlNoYWRlclBhc3MiLCJnZXRCeUluZGV4Iiwic2hhZGVyRGVmaW5pdGlvbiIsImF0dHJpYnV0ZXMiLCJ2c2hhZGVyIiwiZnNoYWRlciIsIlNoYWRlciIsIm9wdCIsImRlZmF1bHRNYXQiLCJfZ2V0RGVmYXVsdFN0ZE1hdE9wdGlvbnMiLCJwIiwiaGFzT3duUHJvcGVydHkiLCJwdXNoIiwiSlNPTiIsInN0cmluZ2lmeSIsImR1bXBQcm9ncmFtcyIsInRleHQiLCJpIiwibGVuZ3RoIiwidmVyc2lvbiIsInJldmlzaW9uIiwiZWxlbWVudCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInNldEF0dHJpYnV0ZSIsImVuY29kZVVSSUNvbXBvbmVudCIsInN0eWxlIiwiZGlzcGxheSIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImNsaWNrIiwicmVtb3ZlQ2hpbGQiLCJmb3JFYWNoIiwiY2xlYXIiLCJjYWNoZWRTaGFkZXIiLCJkZWxldGUiLCJTSEFERVJfREVQVEgiLCJTSEFERVJfUElDSyIsImlzU2hhZG93IiwicHJlY29tcGlsZSIsImNhY2hlIiwic2hhZGVycyIsIkFycmF5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGNBQWMsQ0FBQztBQUNqQjtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0lDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsZ0JBQWdCLEVBQUU7QUFBQSxJQUFBLElBQUEsQ0FUdENDLGNBQWMsR0FBRyxJQUFJQyxHQUFHLEVBQUUsQ0FB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
