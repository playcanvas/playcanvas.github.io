/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
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
