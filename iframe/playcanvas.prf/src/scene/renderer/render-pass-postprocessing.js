import { RenderPass } from '../../platform/graphics/render-pass.js';

class RenderPassPostprocessing extends RenderPass {
  constructor(device, renderer, renderAction) {
    super(device);
    this.renderer = renderer;
    this.renderAction = renderAction;
    this.requiresCubemaps = false;
  }
  execute() {
    const renderAction = this.renderAction;
    const camera = renderAction.camera;
    camera.onPostprocessing();
  }
}

export { RenderPassPostprocessing };
