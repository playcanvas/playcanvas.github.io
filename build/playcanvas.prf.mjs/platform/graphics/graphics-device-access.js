/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class GraphicsDeviceAccess {
	static set(graphicsDevice) {
		GraphicsDeviceAccess._graphicsDevice = graphicsDevice;
	}
	static get() {
		return GraphicsDeviceAccess._graphicsDevice;
	}
}
GraphicsDeviceAccess._graphicsDevice = null;

export { GraphicsDeviceAccess };
