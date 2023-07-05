import '../../core/debug.js';
import { version, revision } from '../../core/core.js';
import { Shader } from '../../platform/graphics/shader.js';
import { SHADER_FORWARD, SHADER_SHADOW, SHADER_DEPTH, SHADER_PICK } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { StandardMaterialOptions } from '../materials/standard-material-options.js';

class ProgramLibrary {
	constructor(device, standardMaterial) {
		this.processedCache = new Map();
		this.definitionsCache = new Map();
		this._device = device;
		this._generators = {};
		this._isClearingCache = false;
		this._precached = false;
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
					const lcopy = l.clone ? l.clone() : l;
					lcopy.key = l.key;
					return lcopy;
				});
			}
			this.storeNewProgram(name, options);
			if ((_options$litOptions2 = options.litOptions) != null && _options$litOptions2.lights) options.litOptions.lights = lights;
			if (this._precached) ;
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
			return null;
		}
		const generationKey = generator.generateKey(options);
		const processingKey = processingOptions.generateKey();
		const totalKey = `${generationKey}#${processingKey}`;
		let processedShader = this.getCachedShader(totalKey);
		if (!processedShader) {
			const generatedShaderDef = this.generateShaderDefinition(generator, name, generationKey, options);
			let passName = '';
			if (options.pass !== undefined) {
				const shaderPassInfo = ShaderPass.get(this._device).getByIndex(options.pass);
				passName = `-${shaderPassInfo.name}`;
			}
			const shaderDefinition = {
				name: `${generatedShaderDef.name}${passName}-proc`,
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
			for (const p in options.litOptions) {
				opt[p] = options.litOptions[p];
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
		const shaderPassInfo = ShaderPass.get(this._device).getByIndex(pass);
		return pass === SHADER_DEPTH || pass === SHADER_PICK || shaderPassInfo.isShadow ? this._defaultStdMatOptionMin : this._defaultStdMatOption;
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
