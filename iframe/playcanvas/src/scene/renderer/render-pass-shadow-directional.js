import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME } from '../constants.js';

class RenderPassShadowDirectional extends RenderPass {
  constructor(device, shadowRenderer, light, camera, allCascadesRendering) {
    super(device);
    this.shadowRenderer = shadowRenderer;
    this.light = light;
    this.camera = camera;
    this.allCascadesRendering = allCascadesRendering;
  }
  execute() {
    const {
      light,
      camera,
      shadowRenderer,
      allCascadesRendering
    } = this;
    const faceCount = light.numShadowFaces;
    const shadowUpdateOverrides = light.shadowUpdateOverrides;
    for (let face = 0; face < faceCount; face++) {
      if ((shadowUpdateOverrides == null ? void 0 : shadowUpdateOverrides[face]) !== SHADOWUPDATE_NONE) {
        shadowRenderer.renderFace(light, camera, face, !allCascadesRendering);
      }
      if ((shadowUpdateOverrides == null ? void 0 : shadowUpdateOverrides[face]) === SHADOWUPDATE_THISFRAME) {
        shadowUpdateOverrides[face] = SHADOWUPDATE_NONE;
      }
    }
  }
  after() {
    this.shadowRenderer.renderVsm(this.light, this.camera);
  }
}

export { RenderPassShadowDirectional };
