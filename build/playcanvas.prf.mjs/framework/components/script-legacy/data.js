/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
