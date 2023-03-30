/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';

let currentApplication;
function getApplication() {
	return currentApplication;
}
function setApplication(app) {
	currentApplication = app;
	GraphicsDeviceAccess.set(app == null ? void 0 : app.graphicsDevice);
}

export { getApplication, setApplication };
