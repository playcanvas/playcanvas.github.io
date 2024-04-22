import { RenderPass } from '../../platform/graphics/render-pass.js';

class RenderPassShadowLocalClustered extends RenderPass {
  constructor(device, shadowRenderer, shadowRendererLocal) {
    super(device);
    this.requiresCubemaps = false;
    this.shadowRenderer = shadowRenderer;
    this.shadowRendererLocal = shadowRendererLocal;
  }
  update(localLights) {
    const shadowLights = this.shadowRendererLocal.shadowLights;
    const shadowCamera = this.shadowRendererLocal.prepareLights(shadowLights, localLights);
    const count = shadowLights.length;
    this.enabled = count > 0;
    if (count) {
      this.shadowRenderer.setupRenderPass(this, shadowCamera, false);
    }
  }
  execute() {
    const shadowLights = this.shadowRendererLocal.shadowLights;
    const count = shadowLights.length;
    for (let i = 0; i < count; i++) {
      const light = shadowLights[i];
      for (let face = 0; face < light.numShadowFaces; face++) {
        this.shadowRenderer.renderFace(light, null, face, true);
      }
    }
    shadowLights.length = 0;
  }
}

export { RenderPassShadowLocalClustered };
