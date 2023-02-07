/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
