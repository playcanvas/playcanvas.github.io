/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
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
