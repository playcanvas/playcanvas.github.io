/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
