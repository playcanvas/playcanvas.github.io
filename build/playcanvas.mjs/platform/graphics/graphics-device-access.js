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
