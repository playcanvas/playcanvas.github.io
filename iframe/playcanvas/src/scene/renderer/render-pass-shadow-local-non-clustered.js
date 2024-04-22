import { RenderPass } from '../../platform/graphics/render-pass.js';

class RenderPassShadowLocalNonClustered extends RenderPass {
  constructor(device, shadowRenderer, light, face, applyVsm) {
    super(device);
    this.requiresCubemaps = false;
    this.shadowRenderer = shadowRenderer;
    this.light = light;
    this.face = face;
    this.applyVsm = applyVsm;
    this.shadowCamera = shadowRenderer.prepareFace(light, null, face);
    shadowRenderer.setupRenderPass(this, this.shadowCamera, true);
  }
  execute() {
    this.shadowRenderer.renderFace(this.light, null, this.face, false);
  }
  after() {
    if (this.applyVsm) {
      this.shadowRenderer.renderVsm(this.light, this.shadowCamera);
    }
  }
}

export { RenderPassShadowLocalNonClustered };
