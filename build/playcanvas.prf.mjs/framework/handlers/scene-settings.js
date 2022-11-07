/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { SceneUtils } from './scene-utils.js';

class SceneSettingsHandler {
  constructor(app) {
    this._app = app;
    this.maxRetries = 0;
  }
  load(url, callback) {
    SceneUtils.load(url, this.maxRetries, callback);
  }
  open(url, data) {
    return data.settings;
  }
}

export { SceneSettingsHandler };