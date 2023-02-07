/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { SceneParser } from '../parsers/scene.js';
import { SceneUtils } from './scene-utils.js';

class HierarchyHandler {
	constructor(app) {
		this.handlerType = "hierarchy";
		this._app = app;
		this.maxRetries = 0;
	}
	load(url, callback) {
		SceneUtils.load(url, this.maxRetries, callback);
	}
	open(url, data) {
		this._app.systems.script.preloading = true;
		const parser = new SceneParser(this._app, false);
		const parent = parser.parse(data);
		this._app.systems.script.preloading = false;
		return parent;
	}
}

export { HierarchyHandler };
