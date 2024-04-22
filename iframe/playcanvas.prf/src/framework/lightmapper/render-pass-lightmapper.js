import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADER_FORWARDHDR } from '../../scene/constants.js';

class RenderPassLightmapper extends RenderPass {
  constructor(device, renderer, camera, worldClusters, receivers, lightArray) {
    super(device);
    this.viewBindGroups = [];
    this.renderer = renderer;
    this.camera = camera;
    this.worldClusters = worldClusters;
    this.receivers = receivers;
    this.lightArray = lightArray;
  }
  destroy() {
    this.viewBindGroups.forEach(bg => {
      bg.defaultUniformBuffer.destroy();
      bg.destroy();
    });
    this.viewBindGroups.length = 0;
  }
  execute() {
    this.device;
    const {
      renderer,
      camera,
      receivers,
      renderTarget,
      worldClusters,
      lightArray
    } = this;
    renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_FORWARDHDR, this.viewBindGroups, {
      meshInstances: receivers,
      splitLights: lightArray,
      lightClusters: worldClusters
    });
  }
}

export { RenderPassLightmapper };
