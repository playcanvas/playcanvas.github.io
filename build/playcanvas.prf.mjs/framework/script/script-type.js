import '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { SCRIPT_INITIALIZE, SCRIPT_POST_INITIALIZE } from './constants.js';
import { ScriptAttributes } from './script-attributes.js';

const funcNameRegex = new RegExp('^\\s*function(?:\\s|\\s*\\/\\*.*\\*\\/\\s*)+([^\\(\\s\\/]*)\\s*');
class ScriptType extends EventHandler {
	constructor(args) {
		super();
		this.app = void 0;
		this.entity = void 0;
		this._enabled = void 0;
		this._enabledOld = void 0;
		this._initialized = void 0;
		this._postInitialized = void 0;
		this.__destroyed = void 0;
		this.__attributes = void 0;
		this.__attributesRaw = void 0;
		this.__scriptType = void 0;
		this.__executionOrder = void 0;
		this.initScriptType(args);
	}
	set enabled(value) {
		this._enabled = !!value;
		if (this.enabled === this._enabledOld) return;
		this._enabledOld = this.enabled;
		this.fire(this.enabled ? 'enable' : 'disable');
		this.fire('state', this.enabled);
		if (!this._initialized && this.enabled) {
			this._initialized = true;
			this.__initializeAttributes(true);
			if (this.initialize) this.entity.script._scriptMethod(this, SCRIPT_INITIALIZE);
		}
		if (this._initialized && !this._postInitialized && this.enabled && !this.entity.script._beingEnabled) {
			this._postInitialized = true;
			if (this.postInitialize) this.entity.script._scriptMethod(this, SCRIPT_POST_INITIALIZE);
		}
	}
	get enabled() {
		return this._enabled && !this._destroyed && this.entity.script.enabled && this.entity.enabled;
	}
	initScriptType(args) {
		const script = this.constructor;
		this.app = args.app;
		this.entity = args.entity;
		this._enabled = typeof args.enabled === 'boolean' ? args.enabled : true;
		this._enabledOld = this.enabled;
		this.__destroyed = false;
		this.__attributes = {};
		this.__attributesRaw = args.attributes || {};
		this.__scriptType = script;
		this.__executionOrder = -1;
	}
	static __getScriptName(constructorFn) {
		if (typeof constructorFn !== 'function') return undefined;
		if ('name' in Function.prototype) return constructorFn.name;
		if (constructorFn === Function || constructorFn === Function.prototype.constructor) return 'Function';
		const match = ('' + constructorFn).match(funcNameRegex);
		return match ? match[1] : undefined;
	}
	static get scriptName() {
		return this.__name;
	}
	static get attributes() {
		if (!this.hasOwnProperty('__attributes')) this.__attributes = new ScriptAttributes(this);
		return this.__attributes;
	}
	__initializeAttributes(force) {
		if (!force && !this.__attributesRaw) return;
		for (const key in this.__scriptType.attributes.index) {
			if (this.__attributesRaw && this.__attributesRaw.hasOwnProperty(key)) {
				this[key] = this.__attributesRaw[key];
			} else if (!this.__attributes.hasOwnProperty(key)) {
				if (this.__scriptType.attributes.index[key].hasOwnProperty('default')) {
					this[key] = this.__scriptType.attributes.index[key].default;
				} else {
					this[key] = null;
				}
			}
		}
		this.__attributesRaw = null;
	}
	static extend(methods) {
		for (const key in methods) {
			if (!methods.hasOwnProperty(key)) continue;
			this.prototype[key] = methods[key];
		}
	}
}
ScriptType.__name = null;

export { ScriptType };
