import '../../../core/debug.js';
import { path } from '../../../core/path.js';
import { Component } from '../component.js';

class ScriptLegacyComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this.on('set_scripts', this.onSetScripts, this);
	}
	send(name, functionName) {
		const args = Array.prototype.slice.call(arguments, 2);
		const instances = this.entity.script.instances;
		let fn;
		if (instances && instances[name]) {
			fn = instances[name].instance[functionName];
			if (fn) {
				return fn.apply(instances[name].instance, args);
			}
		}
		return undefined;
	}
	onEnable() {
		if (this.data.areScriptsLoaded && !this.system.preloading) {
			if (!this.data.initialized) {
				this.system._initializeScriptComponent(this);
			} else {
				this.system._enableScriptComponent(this);
			}
			if (!this.data.postInitialized) {
				this.system._postInitializeScriptComponent(this);
			}
		}
	}
	onDisable() {
		this.system._disableScriptComponent(this);
	}
	onSetScripts(name, oldValue, newValue) {
		if (!this.system._inTools || this.runInTools) {
			if (this._updateScriptAttributes(oldValue, newValue)) {
				return;
			}
			if (this.enabled) {
				this.system._disableScriptComponent(this);
			}
			this.system._destroyScriptComponent(this);
			this.data.areScriptsLoaded = false;
			const scripts = newValue;
			const urls = scripts.map(function (s) {
				return s.url;
			});
			if (this._loadFromCache(urls)) {
				return;
			}
			this._loadScripts(urls);
		}
	}
	_updateScriptAttributes(oldValue, newValue) {
		let onlyUpdateAttributes = true;
		if (oldValue.length !== newValue.length) {
			onlyUpdateAttributes = false;
		} else {
			for (let i = 0, len = newValue.length; i < len; i++) {
				if (oldValue[i].url !== newValue[i].url) {
					onlyUpdateAttributes = false;
					break;
				}
			}
		}
		if (onlyUpdateAttributes) {
			for (const key in this.instances) {
				if (this.instances.hasOwnProperty(key)) {
					this.system._updateAccessors(this.entity, this.instances[key]);
				}
			}
		}
		return onlyUpdateAttributes;
	}
	_loadFromCache(urls) {
		const cached = [];
		const prefix = this.system.app._scriptPrefix || '';
		const regex = /^http(s)?:\/\//i;
		for (let i = 0, len = urls.length; i < len; i++) {
			let url = urls[i];
			if (!regex.test(url)) {
				url = path.join(prefix, url);
			}
			const type = this.system.app.loader.getFromCache(url, 'script');
			if (!type) {
				return false;
			}
			cached.push(type);
		}
		for (let i = 0, len = cached.length; i < len; i++) {
			const ScriptType = cached[i];
			if (ScriptType === true) {
				continue;
			}
			if (ScriptType && this.entity.script) {
				if (!this.entity.script.instances[ScriptType._pcScriptName]) {
					const instance = new ScriptType(this.entity);
					this.system._preRegisterInstance(this.entity, urls[i], ScriptType._pcScriptName, instance);
				}
			}
		}
		if (this.data) {
			this.data.areScriptsLoaded = true;
		}
		if (!this.system.preloading) {
			this.system.onInitialize(this.entity);
			this.system.onPostInitialize(this.entity);
		}
		return true;
	}
	_loadScripts(urls) {
		let count = urls.length;
		const prefix = this.system.app._scriptPrefix || '';
		urls.forEach(url => {
			let _url = null;
			let _unprefixed = null;
			if (url.toLowerCase().startsWith('http://') || url.toLowerCase().startsWith('https://')) {
				_unprefixed = url;
				_url = url;
			} else {
				_unprefixed = url;
				_url = path.join(prefix, url);
			}
			this.system.app.loader.load(_url, 'script', (err, ScriptType) => {
				count--;
				if (!err) {
					if (ScriptType && this.entity.script) {
						if (!this.entity.script.instances[ScriptType._pcScriptName]) {
							const instance = new ScriptType(this.entity);
							this.system._preRegisterInstance(this.entity, _unprefixed, ScriptType._pcScriptName, instance);
						}
					}
				} else {
					console.error(err);
				}
				if (count === 0) {
					this.data.areScriptsLoaded = true;
					if (!this.system.preloading) {
						this.system.onInitialize(this.entity);
						this.system.onPostInitialize(this.entity);
					}
				}
			});
		});
	}
}

export { ScriptLegacyComponent };
