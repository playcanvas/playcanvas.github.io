import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderPassCookieRenderer } from './render-pass-cookie-renderer.js';
import { RenderPassShadowLocalClustered } from './render-pass-shadow-local-clustered.js';

class RenderPassUpdateClustered extends RenderPass {
  constructor(device, renderer, shadowRenderer, shadowRendererLocal, lightTextureAtlas) {
    super(device);
    this.renderer = renderer;
    this.frameGraph = null;
    this.cookiesRenderPass = RenderPassCookieRenderer.create(lightTextureAtlas.cookieRenderTarget, lightTextureAtlas.cubeSlotsOffsets);
    this.beforePasses.push(this.cookiesRenderPass);
    this.shadowRenderPass = new RenderPassShadowLocalClustered(device, shadowRenderer, shadowRendererLocal);
    this.beforePasses.push(this.shadowRenderPass);
  }
  update(frameGraph, shadowsEnabled, cookiesEnabled, lights, localLights) {
    this.frameGraph = frameGraph;
    this.cookiesRenderPass.enabled = cookiesEnabled;
    if (cookiesEnabled) {
      this.cookiesRenderPass.update(lights);
    }
    this.shadowRenderPass.enabled = shadowsEnabled;
    if (shadowsEnabled) {
      this.shadowRenderPass.update(localLights);
    }
  }
  destroy() {
    this.cookiesRenderPass.destroy();
    this.cookiesRenderPass = null;
  }
  execute() {
    const {
      renderer
    } = this;
    const {
      scene
    } = renderer;
    renderer.worldClustersAllocator.update(this.frameGraph.renderPasses, scene.gammaCorrection, scene.lighting);
  }
}

export { RenderPassUpdateClustered };
