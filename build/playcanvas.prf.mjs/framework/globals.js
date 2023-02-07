/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
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
