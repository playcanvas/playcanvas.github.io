/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
