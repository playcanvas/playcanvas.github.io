import { EventHandler } from '../../core/event-handler.js';

class ScriptRegistry extends EventHandler {
	constructor(app) {
		super();
		this.app = app;
		this._scripts = {};
		this._list = [];
	}
	destroy() {
		this.app = null;
		this.off();
	}
	add(script) {
		const scriptName = script.__name;
		if (this._scripts.hasOwnProperty(scriptName)) {
			setTimeout(() => {
				if (script.prototype.swap) {
					const old = this._scripts[scriptName];
					const ind = this._list.indexOf(old);
					this._list[ind] = script;
					this._scripts[scriptName] = script;
					this.fire('swap', scriptName, script);
					this.fire('swap:' + scriptName, script);
				} else {
					console.warn(`script registry already has '${scriptName}' script, define 'swap' method for new script type to enable code hot swapping`);
				}
			});
			return false;
		}
		this._scripts[scriptName] = script;
		this._list.push(script);
		this.fire('add', scriptName, script);
		this.fire('add:' + scriptName, script);
		setTimeout(() => {
			if (!this._scripts.hasOwnProperty(scriptName)) return;
			if (!this.app || !this.app.systems || !this.app.systems.script) {
				return;
			}
			const components = this.app.systems.script._components;
			let attributes;
			const scriptInstances = [];
			const scriptInstancesInitialized = [];
			for (components.loopIndex = 0; components.loopIndex < components.length; components.loopIndex++) {
				const component = components.items[components.loopIndex];
				if (component._scriptsIndex[scriptName] && component._scriptsIndex[scriptName].awaiting) {
					if (component._scriptsData && component._scriptsData[scriptName]) attributes = component._scriptsData[scriptName].attributes;
					const scriptInstance = component.create(scriptName, {
						preloading: true,
						ind: component._scriptsIndex[scriptName].ind,
						attributes: attributes
					});
					if (scriptInstance) scriptInstances.push(scriptInstance);
				}
			}
			for (let i = 0; i < scriptInstances.length; i++) scriptInstances[i].__initializeAttributes();
			for (let i = 0; i < scriptInstances.length; i++) {
				if (scriptInstances[i].enabled) {
					scriptInstances[i]._initialized = true;
					scriptInstancesInitialized.push(scriptInstances[i]);
					if (scriptInstances[i].initialize) scriptInstances[i].initialize();
				}
			}
			for (let i = 0; i < scriptInstancesInitialized.length; i++) {
				if (!scriptInstancesInitialized[i].enabled || scriptInstancesInitialized[i]._postInitialized) {
					continue;
				}
				scriptInstancesInitialized[i]._postInitialized = true;
				if (scriptInstancesInitialized[i].postInitialize) scriptInstancesInitialized[i].postInitialize();
			}
		});
		return true;
	}
	remove(nameOrType) {
		let scriptType = nameOrType;
		let scriptName = nameOrType;
		if (typeof scriptName !== 'string') {
			scriptName = scriptType.__name;
		} else {
			scriptType = this.get(scriptName);
		}
		if (this.get(scriptName) !== scriptType) return false;
		delete this._scripts[scriptName];
		const ind = this._list.indexOf(scriptType);
		this._list.splice(ind, 1);
		this.fire('remove', scriptName, scriptType);
		this.fire('remove:' + scriptName, scriptType);
		return true;
	}
	get(name) {
		return this._scripts[name] || null;
	}
	has(nameOrType) {
		if (typeof nameOrType === 'string') {
			return this._scripts.hasOwnProperty(nameOrType);
		}
		if (!nameOrType) return false;
		const scriptName = nameOrType.__name;
		return this._scripts[scriptName] === nameOrType;
	}
	list() {
		return this._list;
	}
}

export { ScriptRegistry };
