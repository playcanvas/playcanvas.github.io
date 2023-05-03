class ScriptLegacyComponentData {
	constructor() {
		this.scripts = [];
		this.enabled = true;
		this.instances = {};
		this._instances = {};
		this.runInTools = false;
		this.attributes = {};
		this.initialized = false;
		this.postInitialized = false;
		this.areScriptsLoaded = false;
	}
}

export { ScriptLegacyComponentData };
