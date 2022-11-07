/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { version, revision } from '../../core/core.js';
import { Shader } from '../../platform/graphics/shader.js';
import { SHADER_FORWARD, SHADER_SHADOW, SHADER_DEPTH, SHADER_PICK } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';

class ProgramLibrary {

  constructor(device, standardMaterial) {
    this.processedCache = new Map();
    this.definitionsCache = new Map();
    this._device = device;
    this._generators = {};
    this._isClearingCache = false;
    this._precached = false;

    this._programsCollection = [];
    this._defaultStdMatOption = {};
    this._defaultStdMatOptionMin = {};
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
      if (this._precached) Debug.log(`ProgramLibrary#getProgram: Cache miss for shader ${name} key ${key} after shaders precaching`);
      const device = this._device;
      def = generator.createShaderDefinition(device, options);
      def.name = `${name}-pass:${options.pass}`;
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

    const generationKey = generator.generateKey(options);
    const processingKey = JSON.stringify(processingOptions);
    const totalKey = `${generationKey}#${processingKey}`;

    let processedShader = this.getCachedShader(totalKey);
    if (!processedShader) {
      const generatedShaderDef = this.generateShaderDefinition(generator, name, generationKey, options);
      Debug.assert(generatedShaderDef);

      const shaderDefinition = {
        name: name,
        attributes: generatedShaderDef.attributes,
        vshader: generatedShaderDef.vshader,
        fshader: generatedShaderDef.fshader,
        processingOptions: processingOptions
      };

      processedShader = new Shader(this._device, shaderDefinition);
      this.setCachedShader(totalKey, processedShader);
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

  removeFromCache(shader) {
    if (this._isClearingCache) return;
    this.processedCache.forEach((cachedShader, key) => {
      if (shader === cachedShader) {
        this.processedCache.delete(key);
      }
    });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZ3JhbS1saWJyYXJ5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHZlcnNpb24sIHJldmlzaW9uIH0gZnJvbSAnLi4vLi4vY29yZS9jb3JlLmpzJztcblxuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJztcblxuaW1wb3J0IHsgU0hBREVSX0ZPUldBUkQsIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0ssIFNIQURFUl9TSEFET1cgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUGFzcyB9IGZyb20gJy4uL3NoYWRlci1wYXNzLmpzJztcblxuLyoqXG4gKiBBIGNsYXNzIHJlc3BvbnNpYmxlIGZvciBjcmVhdGlvbiBhbmQgY2FjaGluZyBvZiByZXF1aXJlZCBzaGFkZXJzLlxuICogVGhlcmUgaXMgYSB0d28gbGV2ZWwgY2FjaGUuIFRoZSBmaXJzdCBsZXZlbCBnZW5lcmF0ZXMgdGhlIHNoYWRlciBiYXNlZCBvbiB0aGUgcHJvdmlkZWQgb3B0aW9ucy5cbiAqIFRoZSBzZWNvbmQgbGV2ZWwgcHJvY2Vzc2VzIHRoaXMgZ2VuZXJhdGVkIHNoYWRlciB1c2luZyBwcm9jZXNzaW5nIG9wdGlvbnMgLSBpbiBtb3N0IGNhc2VzXG4gKiBtb2RpZmllcyBpdCB0byBzdXBwb3J0IHVuaWZvcm0gYnVmZmVycy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFByb2dyYW1MaWJyYXJ5IHtcbiAgICAvKipcbiAgICAgKiBBIGNhY2hlIG9mIHNoYWRlcnMgcHJvY2Vzc2VkIHVzaW5nIHByb2Nlc3Npbmcgb3B0aW9ucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXA8c3RyaW5nLCBTaGFkZXI+fVxuICAgICAqL1xuICAgIHByb2Nlc3NlZENhY2hlID0gbmV3IE1hcCgpO1xuXG4gICAgLyoqXG4gICAgICogQSBjYWNoZSBvZiBzaGFkZXIgZGVmaW5pdGlvbnMgYmVmb3JlIHByb2Nlc3NpbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWFwPHN0cmluZywgb2JqZWN0Pn1cbiAgICAgKi9cbiAgICBkZWZpbml0aW9uc0NhY2hlID0gbmV3IE1hcCgpO1xuXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBzdGFuZGFyZE1hdGVyaWFsKSB7XG4gICAgICAgIHRoaXMuX2RldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5fZ2VuZXJhdG9ycyA9IHt9O1xuICAgICAgICB0aGlzLl9pc0NsZWFyaW5nQ2FjaGUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fcHJlY2FjaGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gVW5pcXVlIG5vbi1jYWNoZWQgcHJvZ3JhbXMgY29sbGVjdGlvbiB0byBkdW1wIGFuZCB1cGRhdGUgZ2FtZSBzaGFkZXJzIGNhY2hlXG4gICAgICAgIHRoaXMuX3Byb2dyYW1zQ29sbGVjdGlvbiA9IFtdO1xuICAgICAgICB0aGlzLl9kZWZhdWx0U3RkTWF0T3B0aW9uID0ge307XG4gICAgICAgIHRoaXMuX2RlZmF1bHRTdGRNYXRPcHRpb25NaW4gPSB7fTtcblxuICAgICAgICBzdGFuZGFyZE1hdGVyaWFsLnNoYWRlck9wdEJ1aWxkZXIudXBkYXRlUmVmKFxuICAgICAgICAgICAgdGhpcy5fZGVmYXVsdFN0ZE1hdE9wdGlvbiwge30sIHN0YW5kYXJkTWF0ZXJpYWwsIG51bGwsIFtdLCBTSEFERVJfRk9SV0FSRCwgbnVsbCk7XG4gICAgICAgIHN0YW5kYXJkTWF0ZXJpYWwuc2hhZGVyT3B0QnVpbGRlci51cGRhdGVNaW5SZWYoXG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0U3RkTWF0T3B0aW9uTWluLCB7fSwgc3RhbmRhcmRNYXRlcmlhbCwgbnVsbCwgW10sIFNIQURFUl9TSEFET1csIG51bGwpO1xuXG4gICAgICAgIGRldmljZS5vbignZGVzdHJveTpzaGFkZXInLCAoc2hhZGVyKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZyb21DYWNoZShzaGFkZXIpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmNsZWFyQ2FjaGUoKTtcbiAgICB9XG5cbiAgICByZWdpc3RlcihuYW1lLCBnZW5lcmF0b3IpIHtcbiAgICAgICAgaWYgKCF0aGlzLmlzUmVnaXN0ZXJlZChuYW1lKSkge1xuICAgICAgICAgICAgdGhpcy5fZ2VuZXJhdG9yc1tuYW1lXSA9IGdlbmVyYXRvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVucmVnaXN0ZXIobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5pc1JlZ2lzdGVyZWQobmFtZSkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9nZW5lcmF0b3JzW25hbWVdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaXNSZWdpc3RlcmVkKG5hbWUpIHtcbiAgICAgICAgY29uc3QgZ2VuZXJhdG9yID0gdGhpcy5fZ2VuZXJhdG9yc1tuYW1lXTtcbiAgICAgICAgcmV0dXJuIChnZW5lcmF0b3IgIT09IHVuZGVmaW5lZCk7XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVTaGFkZXJEZWZpbml0aW9uKGdlbmVyYXRvciwgbmFtZSwga2V5LCBvcHRpb25zKSB7XG4gICAgICAgIGxldCBkZWYgPSB0aGlzLmRlZmluaXRpb25zQ2FjaGUuZ2V0KGtleSk7XG4gICAgICAgIGlmICghZGVmKSB7XG4gICAgICAgICAgICBsZXQgbGlnaHRzO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRzKSB7XG4gICAgICAgICAgICAgICAgbGlnaHRzID0gb3B0aW9ucy5saWdodHM7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5saWdodHMgPSBsaWdodHMubWFwKGZ1bmN0aW9uIChsKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHJlZmFjdG9yIHRoaXMgdG8gYXZvaWQgY3JlYXRpbmcgYSBjbG9uZSBvZiB0aGUgbGlnaHQuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxjb3B5ID0gbC5jbG9uZSA/IGwuY2xvbmUoKSA6IGw7XG4gICAgICAgICAgICAgICAgICAgIGxjb3B5LmtleSA9IGwua2V5O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbGNvcHk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc3RvcmVOZXdQcm9ncmFtKG5hbWUsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5saWdodHMpXG4gICAgICAgICAgICAgICAgb3B0aW9ucy5saWdodHMgPSBsaWdodHM7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9wcmVjYWNoZWQpXG4gICAgICAgICAgICAgICAgRGVidWcubG9nKGBQcm9ncmFtTGlicmFyeSNnZXRQcm9ncmFtOiBDYWNoZSBtaXNzIGZvciBzaGFkZXIgJHtuYW1lfSBrZXkgJHtrZXl9IGFmdGVyIHNoYWRlcnMgcHJlY2FjaGluZ2ApO1xuXG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9kZXZpY2U7XG4gICAgICAgICAgICBkZWYgPSBnZW5lcmF0b3IuY3JlYXRlU2hhZGVyRGVmaW5pdGlvbihkZXZpY2UsIG9wdGlvbnMpO1xuICAgICAgICAgICAgZGVmLm5hbWUgPSBgJHtuYW1lfS1wYXNzOiR7b3B0aW9ucy5wYXNzfWA7XG4gICAgICAgICAgICB0aGlzLmRlZmluaXRpb25zQ2FjaGUuc2V0KGtleSwgZGVmKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmO1xuICAgIH1cblxuICAgIGdldENhY2hlZFNoYWRlcihrZXkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvY2Vzc2VkQ2FjaGUuZ2V0KGtleSk7XG4gICAgfVxuXG4gICAgc2V0Q2FjaGVkU2hhZGVyKGtleSwgc2hhZGVyKSB7XG4gICAgICAgIHRoaXMucHJvY2Vzc2VkQ2FjaGUuc2V0KGtleSwgc2hhZGVyKTtcbiAgICB9XG5cbiAgICBnZXRQcm9ncmFtKG5hbWUsIG9wdGlvbnMsIHByb2Nlc3NpbmdPcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGdlbmVyYXRvciA9IHRoaXMuX2dlbmVyYXRvcnNbbmFtZV07XG4gICAgICAgIGlmICghZ2VuZXJhdG9yKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBQcm9ncmFtTGlicmFyeSNnZXRQcm9ncmFtOiBObyBwcm9ncmFtIGxpYnJhcnkgZnVuY3Rpb25zIHJlZ2lzdGVyZWQgZm9yOiAke25hbWV9YCk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdlIGhhdmUgYSBrZXkgZm9yIHNoYWRlciBzb3VyY2UgY29kZSBnZW5lcmF0aW9uLCBhIGtleSBmb3IgaXRzIGZ1cnRoZXIgcHJvY2Vzc2luZyB0byB3b3JrIHdpdGhcbiAgICAgICAgLy8gdW5pZm9ybSBidWZmZXJzLCBhbmQgYSBmaW5hbCBrZXkgdG8gZ2V0IHRoZSBwcm9jZXNzZWQgc2hhZGVyIGZyb20gdGhlIGNhY2hlXG4gICAgICAgIGNvbnN0IGdlbmVyYXRpb25LZXkgPSBnZW5lcmF0b3IuZ2VuZXJhdGVLZXkob3B0aW9ucyk7XG4gICAgICAgIGNvbnN0IHByb2Nlc3NpbmdLZXkgPSBKU09OLnN0cmluZ2lmeShwcm9jZXNzaW5nT3B0aW9ucyk7XG4gICAgICAgIGNvbnN0IHRvdGFsS2V5ID0gYCR7Z2VuZXJhdGlvbktleX0jJHtwcm9jZXNzaW5nS2V5fWA7XG5cbiAgICAgICAgLy8gZG8gd2UgaGF2ZSBmaW5hbCBwcm9jZXNzZWQgc2hhZGVyXG4gICAgICAgIGxldCBwcm9jZXNzZWRTaGFkZXIgPSB0aGlzLmdldENhY2hlZFNoYWRlcih0b3RhbEtleSk7XG4gICAgICAgIGlmICghcHJvY2Vzc2VkU2hhZGVyKSB7XG5cbiAgICAgICAgICAgIC8vIGdldCBnZW5lcmF0ZWQgc2hhZGVyXG4gICAgICAgICAgICBjb25zdCBnZW5lcmF0ZWRTaGFkZXJEZWYgPSB0aGlzLmdlbmVyYXRlU2hhZGVyRGVmaW5pdGlvbihnZW5lcmF0b3IsIG5hbWUsIGdlbmVyYXRpb25LZXksIG9wdGlvbnMpO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGdlbmVyYXRlZFNoYWRlckRlZik7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBhIHNoYWRlciBkZWZpbml0aW9uIGZvciB0aGUgc2hhZGVyIHRoYXQgd2lsbCBpbmNsdWRlIHRoZSBwcm9jZXNzaW5nT3B0aW9uc1xuICAgICAgICAgICAgY29uc3Qgc2hhZGVyRGVmaW5pdGlvbiA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXM6IGdlbmVyYXRlZFNoYWRlckRlZi5hdHRyaWJ1dGVzLFxuICAgICAgICAgICAgICAgIHZzaGFkZXI6IGdlbmVyYXRlZFNoYWRlckRlZi52c2hhZGVyLFxuICAgICAgICAgICAgICAgIGZzaGFkZXI6IGdlbmVyYXRlZFNoYWRlckRlZi5mc2hhZGVyLFxuICAgICAgICAgICAgICAgIHByb2Nlc3NpbmdPcHRpb25zOiBwcm9jZXNzaW5nT3B0aW9uc1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gYWRkIG5ldyBzaGFkZXIgdG8gdGhlIHByb2Nlc3NlZCBjYWNoZVxuICAgICAgICAgICAgcHJvY2Vzc2VkU2hhZGVyID0gbmV3IFNoYWRlcih0aGlzLl9kZXZpY2UsIHNoYWRlckRlZmluaXRpb24pO1xuICAgICAgICAgICAgdGhpcy5zZXRDYWNoZWRTaGFkZXIodG90YWxLZXksIHByb2Nlc3NlZFNoYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJvY2Vzc2VkU2hhZGVyO1xuICAgIH1cblxuICAgIHN0b3JlTmV3UHJvZ3JhbShuYW1lLCBvcHRpb25zKSB7XG4gICAgICAgIGxldCBvcHQgPSB7fTtcbiAgICAgICAgaWYgKG5hbWUgPT09IFwic3RhbmRhcmRcIikge1xuICAgICAgICAgICAgLy8gRm9yIHN0YW5kYXJkIG1hdGVyaWFsIHNhdmluZyBhbGwgZGVmYXVsdCB2YWx1ZXMgaXMgb3ZlcmtpbGwsIHNvIHdlIHN0b3JlIG9ubHkgZGlmZlxuICAgICAgICAgICAgY29uc3QgZGVmYXVsdE1hdCA9IHRoaXMuX2dldERlZmF1bHRTdGRNYXRPcHRpb25zKG9wdGlvbnMucGFzcyk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcCBpbiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKChvcHRpb25zLmhhc093blByb3BlcnR5KHApICYmIGRlZmF1bHRNYXRbcF0gIT09IG9wdGlvbnNbcF0pIHx8IHAgPT09IFwicGFzc1wiKVxuICAgICAgICAgICAgICAgICAgICBvcHRbcF0gPSBvcHRpb25zW3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gT3RoZXIgc2hhZGVycyBoYXZlIG9ubHkgZG96ZW4gcGFyYW1zXG4gICAgICAgICAgICBvcHQgPSBvcHRpb25zO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcHJvZ3JhbXNDb2xsZWN0aW9uLnB1c2goSlNPTi5zdHJpbmdpZnkoeyBuYW1lOiBuYW1lLCBvcHRpb25zOiBvcHQgfSkpO1xuICAgIH1cblxuICAgIC8vIHJ1biBwYy5hcHAuZ3JhcGhpY3NEZXZpY2UuZ2V0UHJvZ3JhbUxpYnJhcnkoKS5kdW1wUHJvZ3JhbXMoKTsgZnJvbSBicm93c2VyIGNvbnNvbGUgdG8gYnVpbGQgc2hhZGVyIG9wdGlvbnMgc2NyaXB0XG4gICAgZHVtcFByb2dyYW1zKCkge1xuICAgICAgICBsZXQgdGV4dCA9ICdsZXQgZGV2aWNlID0gcGMuYXBwID8gcGMuYXBwLmdyYXBoaWNzRGV2aWNlIDogcGMuQXBwbGljYXRpb24uZ2V0QXBwbGljYXRpb24oKS5ncmFwaGljc0RldmljZTtcXG4nO1xuICAgICAgICB0ZXh0ICs9ICdsZXQgc2hhZGVycyA9IFsnO1xuICAgICAgICBpZiAodGhpcy5fcHJvZ3JhbXNDb2xsZWN0aW9uWzBdKVxuICAgICAgICAgICAgdGV4dCArPSAnXFxuXFx0JyArIHRoaXMuX3Byb2dyYW1zQ29sbGVjdGlvblswXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCB0aGlzLl9wcm9ncmFtc0NvbGxlY3Rpb24ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHRleHQgKz0gJyxcXG5cXHQnICsgdGhpcy5fcHJvZ3JhbXNDb2xsZWN0aW9uW2ldO1xuICAgICAgICB9XG4gICAgICAgIHRleHQgKz0gJ1xcbl07XFxuJztcbiAgICAgICAgdGV4dCArPSAnZGV2aWNlLmdldFByb2dyYW1MaWJyYXJ5KCkucHJlY29tcGlsZShzaGFkZXJzKTtcXG4nO1xuICAgICAgICB0ZXh0ICs9ICdpZiAocGMudmVyc2lvbiAhPSBcXFwiJyArIHZlcnNpb24gKyAnXFxcIiB8fCBwYy5yZXZpc2lvbiAhPSBcXFwiJyArIHJldmlzaW9uICsgJ1xcXCIpXFxuJztcbiAgICAgICAgdGV4dCArPSAnXFx0Y29uc29sZS53YXJuKFxcXCJwcmVjb21waWxlLXNoYWRlcnMuanM6IGVuZ2luZSB2ZXJzaW9uIG1pc21hdGNoLCByZWJ1aWxkIHNoYWRlcnMgbGliIHdpdGggY3VycmVudCBlbmdpbmVcXFwiKTsnO1xuXG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdocmVmJywgJ2RhdGE6dGV4dC9wbGFpbjtjaGFyc2V0PXV0Zi04LCcgKyBlbmNvZGVVUklDb21wb25lbnQodGV4dCkpO1xuICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnZG93bmxvYWQnLCAncHJlY29tcGlsZS1zaGFkZXJzLmpzJyk7XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChlbGVtZW50KTtcbiAgICAgICAgZWxlbWVudC5jbGljaygpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGVsZW1lbnQpO1xuICAgIH1cblxuICAgIGNsZWFyQ2FjaGUoKSB7XG4gICAgICAgIHRoaXMuX2lzQ2xlYXJpbmdDYWNoZSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5wcm9jZXNzZWRDYWNoZS5mb3JFYWNoKChzaGFkZXIpID0+IHtcbiAgICAgICAgICAgIHNoYWRlci5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnByb2Nlc3NlZENhY2hlLmNsZWFyKCk7XG5cbiAgICAgICAgdGhpcy5faXNDbGVhcmluZ0NhY2hlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHNoYWRlciBmcm9tIHRoZSBjYWNoZS4gVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBkZXN0cm95IGl0LCB0aGF0IGlzIHRoZSByZXNwb25zaWJpbGl0eVxuICAgICAqIG9mIHRoZSBjYWxsZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBiZSByZW1vdmVkLlxuICAgICAqL1xuICAgIHJlbW92ZUZyb21DYWNoZShzaGFkZXIpIHtcbiAgICAgICAgLy8gZG9uJ3QgZGVsZXRlIGJ5IG9uZSB3aGVuIGNsZWFyaW5nIHdob2xlIGNhY2hlXG4gICAgICAgIGlmICh0aGlzLl9pc0NsZWFyaW5nQ2FjaGUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5wcm9jZXNzZWRDYWNoZS5mb3JFYWNoKChjYWNoZWRTaGFkZXIsIGtleSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNoYWRlciA9PT0gY2FjaGVkU2hhZGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzZWRDYWNoZS5kZWxldGUoa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX2dldERlZmF1bHRTdGRNYXRPcHRpb25zKHBhc3MpIHtcbiAgICAgICAgcmV0dXJuIChwYXNzID09PSBTSEFERVJfREVQVEggfHwgcGFzcyA9PT0gU0hBREVSX1BJQ0sgfHwgU2hhZGVyUGFzcy5pc1NoYWRvdyhwYXNzKSkgP1xuICAgICAgICAgICAgdGhpcy5fZGVmYXVsdFN0ZE1hdE9wdGlvbk1pbiA6IHRoaXMuX2RlZmF1bHRTdGRNYXRPcHRpb247XG4gICAgfVxuXG4gICAgcHJlY29tcGlsZShjYWNoZSkge1xuICAgICAgICBpZiAoY2FjaGUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlcnMgPSBuZXcgQXJyYXkoY2FjaGUubGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FjaGUubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgb3B0aW9ucyBmb3IgdGhlIHN0YW5kYXJkIG1hdGVyaWFscyBhcmUgbm90IHN0b3JlZCwgYW5kIHNvIHRoZXkgYXJlIGluc2VydGVkXG4gICAgICAgICAgICAgICAgLy8gYmFjayBpbnRvIHRoZSBsb2FkZWQgb3B0aW9uc1xuICAgICAgICAgICAgICAgIGlmIChjYWNoZVtpXS5uYW1lID09PSBcInN0YW5kYXJkXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0ID0gY2FjaGVbaV0ub3B0aW9ucztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVmYXVsdE1hdCA9IHRoaXMuX2dldERlZmF1bHRTdGRNYXRPcHRpb25zKG9wdC5wYXNzKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBwIGluIGRlZmF1bHRNYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZWZhdWx0TWF0Lmhhc093blByb3BlcnR5KHApICYmIG9wdFtwXSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdFtwXSA9IGRlZmF1bHRNYXRbcF07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzaGFkZXJzW2ldID0gdGhpcy5nZXRQcm9ncmFtKGNhY2hlW2ldLm5hbWUsIGNhY2hlW2ldLm9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3ByZWNhY2hlZCA9IHRydWU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQcm9ncmFtTGlicmFyeSB9O1xuIl0sIm5hbWVzIjpbIlByb2dyYW1MaWJyYXJ5IiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJzdGFuZGFyZE1hdGVyaWFsIiwicHJvY2Vzc2VkQ2FjaGUiLCJNYXAiLCJkZWZpbml0aW9uc0NhY2hlIiwiX2RldmljZSIsIl9nZW5lcmF0b3JzIiwiX2lzQ2xlYXJpbmdDYWNoZSIsIl9wcmVjYWNoZWQiLCJfcHJvZ3JhbXNDb2xsZWN0aW9uIiwiX2RlZmF1bHRTdGRNYXRPcHRpb24iLCJfZGVmYXVsdFN0ZE1hdE9wdGlvbk1pbiIsInNoYWRlck9wdEJ1aWxkZXIiLCJ1cGRhdGVSZWYiLCJTSEFERVJfRk9SV0FSRCIsInVwZGF0ZU1pblJlZiIsIlNIQURFUl9TSEFET1ciLCJvbiIsInNoYWRlciIsInJlbW92ZUZyb21DYWNoZSIsImRlc3Ryb3kiLCJjbGVhckNhY2hlIiwicmVnaXN0ZXIiLCJuYW1lIiwiZ2VuZXJhdG9yIiwiaXNSZWdpc3RlcmVkIiwidW5yZWdpc3RlciIsInVuZGVmaW5lZCIsImdlbmVyYXRlU2hhZGVyRGVmaW5pdGlvbiIsImtleSIsIm9wdGlvbnMiLCJkZWYiLCJnZXQiLCJsaWdodHMiLCJtYXAiLCJsIiwibGNvcHkiLCJjbG9uZSIsInN0b3JlTmV3UHJvZ3JhbSIsIkRlYnVnIiwibG9nIiwiY3JlYXRlU2hhZGVyRGVmaW5pdGlvbiIsInBhc3MiLCJzZXQiLCJnZXRDYWNoZWRTaGFkZXIiLCJzZXRDYWNoZWRTaGFkZXIiLCJnZXRQcm9ncmFtIiwicHJvY2Vzc2luZ09wdGlvbnMiLCJ3YXJuIiwiZ2VuZXJhdGlvbktleSIsImdlbmVyYXRlS2V5IiwicHJvY2Vzc2luZ0tleSIsIkpTT04iLCJzdHJpbmdpZnkiLCJ0b3RhbEtleSIsInByb2Nlc3NlZFNoYWRlciIsImdlbmVyYXRlZFNoYWRlckRlZiIsImFzc2VydCIsInNoYWRlckRlZmluaXRpb24iLCJhdHRyaWJ1dGVzIiwidnNoYWRlciIsImZzaGFkZXIiLCJTaGFkZXIiLCJvcHQiLCJkZWZhdWx0TWF0IiwiX2dldERlZmF1bHRTdGRNYXRPcHRpb25zIiwicCIsImhhc093blByb3BlcnR5IiwicHVzaCIsImR1bXBQcm9ncmFtcyIsInRleHQiLCJpIiwibGVuZ3RoIiwidmVyc2lvbiIsInJldmlzaW9uIiwiZWxlbWVudCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInNldEF0dHJpYnV0ZSIsImVuY29kZVVSSUNvbXBvbmVudCIsInN0eWxlIiwiZGlzcGxheSIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImNsaWNrIiwicmVtb3ZlQ2hpbGQiLCJmb3JFYWNoIiwiY2xlYXIiLCJjYWNoZWRTaGFkZXIiLCJkZWxldGUiLCJTSEFERVJfREVQVEgiLCJTSEFERVJfUElDSyIsIlNoYWRlclBhc3MiLCJpc1NoYWRvdyIsInByZWNvbXBpbGUiLCJjYWNoZSIsInNoYWRlcnMiLCJBcnJheSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFnQkEsTUFBTUEsY0FBYyxDQUFDOztBQWVqQkMsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLGdCQUFnQixFQUFFO0FBQUEsSUFBQSxJQUFBLENBVHRDQyxjQUFjLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPMUJDLGdCQUFnQixHQUFHLElBQUlELEdBQUcsRUFBRSxDQUFBO0lBR3hCLElBQUksQ0FBQ0UsT0FBTyxHQUFHTCxNQUFNLENBQUE7QUFDckIsSUFBQSxJQUFJLENBQUNNLFdBQVcsR0FBRyxFQUFFLENBQUE7SUFDckIsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7SUFDN0IsSUFBSSxDQUFDQyxV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