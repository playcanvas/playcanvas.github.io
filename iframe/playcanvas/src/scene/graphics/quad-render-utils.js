import { Vec4 } from '../../core/math/vec4.js';
import { QuadRender } from './quad-render.js';
import { RenderPassQuad } from './render-pass-quad.js';

const _tempRect = new Vec4();
function drawQuadWithShader(device, target, shader, rect, scissorRect) {
  const quad = new QuadRender(shader);
  if (!rect) {
    rect = _tempRect;
    rect.x = 0;
    rect.y = 0;
    rect.z = target ? target.width : device.width;
    rect.w = target ? target.height : device.height;
  }
  const renderPass = new RenderPassQuad(device, quad, rect, scissorRect);
  renderPass.init(target);
  renderPass.colorOps.clear = false;
  renderPass.depthStencilOps.clearDepth = false;
  if (device.isWebGPU && target === null && device.samples > 1) {
    renderPass.colorOps.store = true;
  }
  renderPass.render();
  quad.destroy();
}
function drawTexture(device, texture, target, shader, rect, scissorRect) {
  shader = shader || device.getCopyShader();
  device.constantTexSource.setValue(texture);
  drawQuadWithShader(device, target, shader, rect, scissorRect);
}

export { drawQuadWithShader, drawTexture };
