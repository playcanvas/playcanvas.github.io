const cachedResult = func => {
	const uninitToken = {};
	let result = uninitToken;
	return () => {
		if (result === uninitToken) {
			result = func();
		}
		return result;
	};
};
class Impl {
	static loadScript(url, callback) {
		const s = document.createElement('script');
		s.setAttribute('src', url);
		s.onload = () => {
			callback(null);
		};
		s.onerror = () => {
			callback(`Failed to load script='${url}'`);
		};
		document.body.appendChild(s);
	}
	static loadWasm(moduleName, config, callback) {
		const loadUrl = Impl.wasmSupported() && config.glueUrl && config.wasmUrl ? config.glueUrl : config.fallbackUrl;
		if (loadUrl) {
			Impl.loadScript(loadUrl, err => {
				if (err) {
					callback(err, null);
				} else {
					const module = window[moduleName];
					window[moduleName] = undefined;
					module({
						locateFile: () => config.wasmUrl,
						onAbort: () => {
							callback('wasm module aborted.');
						}
					}).then(instance => {
						callback(null, instance);
					});
				}
			});
		} else {
			callback('No supported wasm modules found.', null);
		}
	}
	static getModule(name) {
		if (!Impl.modules.hasOwnProperty(name)) {
			Impl.modules[name] = {
				config: null,
				initializing: false,
				instance: null,
				callbacks: []
			};
		}
		return Impl.modules[name];
	}
	static initialize(moduleName, module) {
		if (module.initializing) {
			return;
		}
		const config = module.config;
		if (config.glueUrl || config.wasmUrl || config.fallbackUrl) {
			module.initializing = true;
			Impl.loadWasm(moduleName, config, (err, instance) => {
				if (err) {
					if (config.errorHandler) {
						config.errorHandler(err);
					} else {
						console.error(`failed to initialize module=${moduleName} error=${err}`);
					}
				} else {
					module.instance = instance;
					module.callbacks.forEach(callback => {
						callback(instance);
					});
				}
			});
		}
	}
}
Impl.modules = {};
Impl.wasmSupported = cachedResult(() => {
	try {
		if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
			const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
			if (module instanceof WebAssembly.Module) return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
		}
	} catch (e) {}
	return false;
});
class WasmModule {
	static setConfig(moduleName, config) {
		const module = Impl.getModule(moduleName);
		module.config = config;
		if (module.callbacks.length > 0) {
			Impl.initialize(moduleName, module);
		}
	}
	static getConfig(moduleName) {
		var _Impl$modules, _Impl$modules$moduleN;
		return (_Impl$modules = Impl.modules) == null ? void 0 : (_Impl$modules$moduleN = _Impl$modules[moduleName]) == null ? void 0 : _Impl$modules$moduleN.config;
	}
	static getInstance(moduleName, callback) {
		const module = Impl.getModule(moduleName);
		if (module.instance) {
			callback(module.instance);
		} else {
			module.callbacks.push(callback);
			if (module.config) {
				Impl.initialize(moduleName, module);
			}
		}
	}
}

export { WasmModule };
