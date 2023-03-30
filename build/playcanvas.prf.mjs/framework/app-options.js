/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class AppOptions {
	constructor() {
		this.elementInput = void 0;
		this.keyboard = void 0;
		this.mouse = void 0;
		this.touch = void 0;
		this.gamepads = void 0;
		this.scriptPrefix = void 0;
		this.assetPrefix = void 0;
		this.scriptsOrder = void 0;
		this.soundManager = void 0;
		this.graphicsDevice = void 0;
		this.lightmapper = void 0;
		this.batchManager = void 0;
		this.xr = void 0;
		this.componentSystems = [];
		this.resourceHandlers = [];
	}
}

export { AppOptions };
