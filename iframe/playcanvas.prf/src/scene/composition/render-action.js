class RenderAction {
  constructor() {
    this.layer = null;
    this.transparent = false;
    this.camera = null;
    this.renderTarget = null;
    this.lightClusters = null;
    this.clearColor = false;
    this.clearDepth = false;
    this.clearStencil = false;
    this.triggerPostprocess = false;
    this.firstCameraUse = false;
    this.lastCameraUse = false;
    this.viewBindGroups = [];
    this.useCameraPasses = false;
  }
  destroy() {
    this.viewBindGroups.forEach(bg => {
      bg.defaultUniformBuffer.destroy();
      bg.destroy();
    });
    this.viewBindGroups.length = 0;
  }
  setupClears(camera, layer) {
    this.clearColor = (camera == null ? void 0 : camera.clearColorBuffer) || layer.clearColorBuffer;
    this.clearDepth = (camera == null ? void 0 : camera.clearDepthBuffer) || layer.clearDepthBuffer;
    this.clearStencil = (camera == null ? void 0 : camera.clearStencilBuffer) || layer.clearStencilBuffer;
  }
}

export { RenderAction };
