import '../../../core/debug.js';
import { SortedLoopArray } from '../../../core/sorted-loop-array.js';
import { ScriptAttributes } from '../../script/script-attributes.js';
import { SCRIPT_POST_INITIALIZE, SCRIPT_INITIALIZE, SCRIPT_UPDATE, SCRIPT_POST_UPDATE, SCRIPT_SWAP } from '../../script/constants.js';
import { Component } from '../component.js';
import { Entity } from '../../entity.js';

class ScriptComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._scripts = [];
		this._updateList = new SortedLoopArray({
			sortBy: '__executionOrder'
		});
		this._postUpdateList = new SortedLoopArray({
			sortBy: '__executionOrder'
		});
		this._scriptsIndex = {};
		this._destroyedScripts = [];
		this._destroyed = false;
		this._scriptsData = null;
		this._oldState = true;
		this._enabled = true;
		this._beingEnabled = false;
		this._isLoopingThroughScripts = false;
		this._executionOrder = -1;
		this.on('set_enabled', this._onSetEnabled, this);
	}
	set scripts(value) {
		this._scriptsData = value;
		for (const key in value) {
			if (!value.hasOwnProperty(key)) continue;
			const script = this._scriptsIndex[key];
			if (script) {
				if (typeof value[key].enabled === 'boolean') script.enabled = !!value[key].enabled;
				if (typeof value[key].attributes === 'object') {
					for (const attr in value[key].attributes) {
						if (ScriptAttributes.reservedNames.has(attr)) continue;
						if (!script.__attributes.hasOwnProperty(attr)) {
							const scriptType = this.system.app.scripts.get(key);
							if (scriptType) scriptType.attributes.add(attr, {});
						}
						script[attr] = value[key].attributes[attr];
					}
				}
			} else {
				console.log(this.order);
			}
		}
	}
	get scripts() {
		return this._scripts;
	}
	set enabled(value) {
		const oldValue = this._enabled;
		this._enabled = value;
		this.fire('set', 'enabled', oldValue, value);
	}
	get enabled() {
		return this._enabled;
	}
	onEnable() {
		this._beingEnabled = true;
		this._checkState();
		if (!this.entity._beingEnabled) {
			this.onPostStateChange();
		}
		this._beingEnabled = false;
	}
	onDisable() {
		this._checkState();
	}
	onPostStateChange() {
		const wasLooping = this._beginLooping();
		for (let i = 0, len = this.scripts.length; i < len; i++) {
			const script = this.scripts[i];
			if (script._initialized && !script._postInitialized && script.enabled) {
				script._postInitialized = true;
				if (script.postInitialize) this._scriptMethod(script, SCRIPT_POST_INITIALIZE);
			}
		}
		this._endLooping(wasLooping);
	}
	_beginLooping() {
		const looping = this._isLoopingThroughScripts;
		this._isLoopingThroughScripts = true;
		return looping;
	}
	_endLooping(wasLoopingBefore) {
		this._isLoopingThroughScripts = wasLoopingBefore;
		if (!this._isLoopingThroughScripts) {
			this._removeDestroyedScripts();
		}
	}
	_onSetEnabled(prop, old, value) {
		this._beingEnabled = true;
		this._checkState();
		this._beingEnabled = false;
	}
	_checkState() {
		const state = this.enabled && this.entity.enabled;
		if (state === this._oldState) return;
		this._oldState = state;
		this.fire(state ? 'enable' : 'disable');
		this.fire('state', state);
		if (state) {
			this.system._addComponentToEnabled(this);
		} else {
			this.system._removeComponentFromEnabled(this);
		}
		const wasLooping = this._beginLooping();
		for (let i = 0, len = this.scripts.length; i < len; i++) {
			const script = this.scripts[i];
			script.enabled = script._enabled;
		}
		this._endLooping(wasLooping);
	}
	_onBeforeRemove() {
		this.fire('remove');
		const wasLooping = this._beginLooping();
		for (let i = 0; i < this.scripts.length; i++) {
			const script = this.scripts[i];
			if (!script) continue;
			this.destroy(script.__scriptType.__name);
		}
		this._endLooping(wasLooping);
	}
	_removeDestroyedScripts() {
		const len = this._destroyedScripts.length;
		if (!len) return;
		for (let i = 0; i < len; i++) {
			const script = this._destroyedScripts[i];
			this._removeScriptInstance(script);
		}
		this._destroyedScripts.length = 0;
		this._resetExecutionOrder(0, this._scripts.length);
	}
	_onInitializeAttributes() {
		for (let i = 0, len = this.scripts.length; i < len; i++) this.scripts[i].__initializeAttributes();
	}
	_scriptMethod(script, method, arg) {
		script[method](arg);
	}
	_onInitialize() {
		const scripts = this._scripts;
		const wasLooping = this._beginLooping();
		for (let i = 0, len = scripts.length; i < len; i++) {
			const script = scripts[i];
			if (!script._initialized && script.enabled) {
				script._initialized = true;
				if (script.initialize) this._scriptMethod(script, SCRIPT_INITIALIZE);
			}
		}
		this._endLooping(wasLooping);
	}
	_onPostInitialize() {
		this.onPostStateChange();
	}
	_onUpdate(dt) {
		const list = this._updateList;
		if (!list.length) return;
		const wasLooping = this._beginLooping();
		for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
			const script = list.items[list.loopIndex];
			if (script.enabled) {
				this._scriptMethod(script, SCRIPT_UPDATE, dt);
			}
		}
		this._endLooping(wasLooping);
	}
	_onPostUpdate(dt) {
		const list = this._postUpdateList;
		if (!list.length) return;
		const wasLooping = this._beginLooping();
		for (list.loopIndex = 0; list.loopIndex < list.length; list.loopIndex++) {
			const script = list.items[list.loopIndex];
			if (script.enabled) {
				this._scriptMethod(script, SCRIPT_POST_UPDATE, dt);
			}
		}
		this._endLooping(wasLooping);
	}
	_insertScriptInstance(scriptInstance, index, scriptsLength) {
		if (index === -1) {
			this._scripts.push(scriptInstance);
			scriptInstance.__executionOrder = scriptsLength;
			if (scriptInstance.update) {
				this._updateList.append(scriptInstance);
			}
			if (scriptInstance.postUpdate) {
				this._postUpdateList.append(scriptInstance);
			}
		} else {
			this._scripts.splice(index, 0, scriptInstance);
			scriptInstance.__executionOrder = index;
			this._resetExecutionOrder(index + 1, scriptsLength + 1);
			if (scriptInstance.update) {
				this._updateList.insert(scriptInstance);
			}
			if (scriptInstance.postUpdate) {
				this._postUpdateList.insert(scriptInstance);
			}
		}
	}
	_removeScriptInstance(scriptInstance) {
		const idx = this._scripts.indexOf(scriptInstance);
		if (idx === -1) return idx;
		this._scripts.splice(idx, 1);
		if (scriptInstance.update) {
			this._updateList.remove(scriptInstance);
		}
		if (scriptInstance.postUpdate) {
			this._postUpdateList.remove(scriptInstance);
		}
		return idx;
	}
	_resetExecutionOrder(startIndex, scriptsLength) {
		for (let i = startIndex; i < scriptsLength; i++) {
			this._scripts[i].__executionOrder = i;
		}
	}
	_resolveEntityScriptAttribute(attribute, attributeName, oldValue, useGuid, newAttributes, duplicatedIdsMap) {
		if (attribute.array) {
			const len = oldValue.length;
			if (!len) {
				return;
			}
			const newGuidArray = oldValue.slice();
			for (let i = 0; i < len; i++) {
				const guid = newGuidArray[i] instanceof Entity ? newGuidArray[i].getGuid() : newGuidArray[i];
				if (duplicatedIdsMap[guid]) {
					newGuidArray[i] = useGuid ? duplicatedIdsMap[guid].getGuid() : duplicatedIdsMap[guid];
				}
			}
			newAttributes[attributeName] = newGuidArray;
		} else {
			if (oldValue instanceof Entity) {
				oldValue = oldValue.getGuid();
			} else if (typeof oldValue !== 'string') {
				return;
			}
			if (duplicatedIdsMap[oldValue]) {
				newAttributes[attributeName] = duplicatedIdsMap[oldValue];
			}
		}
	}
	has(nameOrType) {
		if (typeof nameOrType === 'string') {
			return !!this._scriptsIndex[nameOrType];
		}
		if (!nameOrType) return false;
		const scriptType = nameOrType;
		const scriptName = scriptType.__name;
		const scriptData = this._scriptsIndex[scriptName];
		const scriptInstance = scriptData && scriptData.instance;
		return scriptInstance instanceof scriptType;
	}
	get(nameOrType) {
		if (typeof nameOrType === 'string') {
			const data = this._scriptsIndex[nameOrType];
			return data ? data.instance : null;
		}
		if (!nameOrType) return null;
		const scriptType = nameOrType;
		const scriptName = scriptType.__name;
		const scriptData = this._scriptsIndex[scriptName];
		const scriptInstance = scriptData && scriptData.instance;
		return scriptInstance instanceof scriptType ? scriptInstance : null;
	}
	create(nameOrType, args = {}) {
		const self = this;
		let scriptType = nameOrType;
		let scriptName = nameOrType;
		if (typeof scriptType === 'string') {
			scriptType = this.system.app.scripts.get(scriptType);
		} else if (scriptType) {
			scriptName = scriptType.__name;
		}
		if (scriptType) {
			if (!this._scriptsIndex[scriptName] || !this._scriptsIndex[scriptName].instance) {
				const scriptInstance = new scriptType({
					app: this.system.app,
					entity: this.entity,
					enabled: args.hasOwnProperty('enabled') ? args.enabled : true,
					attributes: args.attributes
				});
				const len = this._scripts.length;
				let ind = -1;
				if (typeof args.ind === 'number' && args.ind !== -1 && len > args.ind) ind = args.ind;
				this._insertScriptInstance(scriptInstance, ind, len);
				this._scriptsIndex[scriptName] = {
					instance: scriptInstance,
					onSwap: function () {
						self.swap(scriptName);
					}
				};
				this[scriptName] = scriptInstance;
				if (!args.preloading) scriptInstance.__initializeAttributes();
				this.fire('create', scriptName, scriptInstance);
				this.fire('create:' + scriptName, scriptInstance);
				this.system.app.scripts.on('swap:' + scriptName, this._scriptsIndex[scriptName].onSwap);
				if (!args.preloading) {
					if (scriptInstance.enabled && !scriptInstance._initialized) {
						scriptInstance._initialized = true;
						if (scriptInstance.initialize) this._scriptMethod(scriptInstance, SCRIPT_INITIALIZE);
					}
					if (scriptInstance.enabled && !scriptInstance._postInitialized) {
						scriptInstance._postInitialized = true;
						if (scriptInstance.postInitialize) this._scriptMethod(scriptInstance, SCRIPT_POST_INITIALIZE);
					}
				}
				return scriptInstance;
			}
		} else {
			this._scriptsIndex[scriptName] = {
				awaiting: true,
				ind: this._scripts.length
			};
		}
		return null;
	}
	destroy(nameOrType) {
		let scriptName = nameOrType;
		let scriptType = nameOrType;
		if (typeof scriptType === 'string') {
			scriptType = this.system.app.scripts.get(scriptType);
		} else if (scriptType) {
			scriptName = scriptType.__name;
		}
		const scriptData = this._scriptsIndex[scriptName];
		delete this._scriptsIndex[scriptName];
		if (!scriptData) return false;
		const scriptInstance = scriptData.instance;
		if (scriptInstance && !scriptInstance._destroyed) {
			scriptInstance.enabled = false;
			scriptInstance._destroyed = true;
			if (!this._isLoopingThroughScripts) {
				const ind = this._removeScriptInstance(scriptInstance);
				if (ind >= 0) {
					this._resetExecutionOrder(ind, this._scripts.length);
				}
			} else {
				this._destroyedScripts.push(scriptInstance);
			}
		}
		this.system.app.scripts.off('swap:' + scriptName, scriptData.onSwap);
		delete this[scriptName];
		this.fire('destroy', scriptName, scriptInstance || null);
		this.fire('destroy:' + scriptName, scriptInstance || null);
		if (scriptInstance) scriptInstance.fire('destroy');
		return true;
	}
	swap(nameOrType) {
		let scriptName = nameOrType;
		let scriptType = nameOrType;
		if (typeof scriptType === 'string') {
			scriptType = this.system.app.scripts.get(scriptType);
		} else if (scriptType) {
			scriptName = scriptType.__name;
		}
		const old = this._scriptsIndex[scriptName];
		if (!old || !old.instance) return false;
		const scriptInstanceOld = old.instance;
		const ind = this._scripts.indexOf(scriptInstanceOld);
		const scriptInstance = new scriptType({
			app: this.system.app,
			entity: this.entity,
			enabled: scriptInstanceOld.enabled,
			attributes: scriptInstanceOld.__attributes
		});
		if (!scriptInstance.swap) return false;
		scriptInstance.__initializeAttributes();
		this._scripts[ind] = scriptInstance;
		this._scriptsIndex[scriptName].instance = scriptInstance;
		this[scriptName] = scriptInstance;
		scriptInstance.__executionOrder = ind;
		if (scriptInstanceOld.update) {
			this._updateList.remove(scriptInstanceOld);
		}
		if (scriptInstanceOld.postUpdate) {
			this._postUpdateList.remove(scriptInstanceOld);
		}
		if (scriptInstance.update) {
			this._updateList.insert(scriptInstance);
		}
		if (scriptInstance.postUpdate) {
			this._postUpdateList.insert(scriptInstance);
		}
		this._scriptMethod(scriptInstance, SCRIPT_SWAP, scriptInstanceOld);
		this.fire('swap', scriptName, scriptInstance);
		this.fire('swap:' + scriptName, scriptInstance);
		return true;
	}
	resolveDuplicatedEntityReferenceProperties(oldScriptComponent, duplicatedIdsMap) {
		const newScriptComponent = this.entity.script;
		for (const scriptName in oldScriptComponent._scriptsIndex) {
			const scriptType = this.system.app.scripts.get(scriptName);
			if (!scriptType) {
				continue;
			}
			const script = oldScriptComponent._scriptsIndex[scriptName];
			if (!script || !script.instance) {
				continue;
			}
			const newAttributesRaw = newScriptComponent[scriptName].__attributesRaw;
			const newAttributes = newScriptComponent[scriptName].__attributes;
			if (!newAttributesRaw && !newAttributes) {
				continue;
			}
			const useGuid = !!newAttributesRaw;
			const oldAttributes = script.instance.__attributes;
			for (const attributeName in oldAttributes) {
				if (!oldAttributes[attributeName]) {
					continue;
				}
				const attribute = scriptType.attributes.get(attributeName);
				if (!attribute) {
					continue;
				}
				if (attribute.type === 'entity') {
					this._resolveEntityScriptAttribute(attribute, attributeName, oldAttributes[attributeName], useGuid, newAttributesRaw || newAttributes, duplicatedIdsMap);
				} else if (attribute.type === 'json' && Array.isArray(attribute.schema)) {
					const oldValue = oldAttributes[attributeName];
					const newJsonValue = newAttributesRaw ? newAttributesRaw[attributeName] : newAttributes[attributeName];
					for (let i = 0; i < attribute.schema.length; i++) {
						const field = attribute.schema[i];
						if (field.type !== 'entity') {
							continue;
						}
						if (attribute.array) {
							for (let j = 0; j < oldValue.length; j++) {
								this._resolveEntityScriptAttribute(field, field.name, oldValue[j][field.name], useGuid, newJsonValue[j], duplicatedIdsMap);
							}
						} else {
							this._resolveEntityScriptAttribute(field, field.name, oldValue[field.name], useGuid, newJsonValue, duplicatedIdsMap);
						}
					}
				}
			}
		}
	}
	move(nameOrType, ind) {
		const len = this._scripts.length;
		if (ind >= len || ind < 0) return false;
		let scriptType = nameOrType;
		let scriptName = nameOrType;
		if (typeof scriptName !== 'string') {
			scriptName = nameOrType.__name;
		} else {
			scriptType = null;
		}
		const scriptData = this._scriptsIndex[scriptName];
		if (!scriptData || !scriptData.instance) return false;
		const scriptInstance = scriptData.instance;
		if (scriptType && !(scriptInstance instanceof scriptType)) return false;
		const indOld = this._scripts.indexOf(scriptInstance);
		if (indOld === -1 || indOld === ind) return false;
		this._scripts.splice(ind, 0, this._scripts.splice(indOld, 1)[0]);
		this._resetExecutionOrder(0, len);
		this._updateList.sort();
		this._postUpdateList.sort();
		this.fire('move', scriptName, scriptInstance, ind, indOld);
		this.fire('move:' + scriptName, scriptInstance, ind, indOld);
		return true;
	}
}

export { ScriptComponent };
