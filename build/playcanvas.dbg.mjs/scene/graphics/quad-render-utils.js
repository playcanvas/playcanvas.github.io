/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug, DebugHelper } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';
import { CULLFACE_NONE, DEVICETYPE_WEBGPU } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { QuadRender } from './quad-render.js';

const _tempRect = new Vec4();

/**
 * Draws a screen-space quad using a specific shader.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device used to draw
 * the quad.
 * @param {import('../../platform/graphics/render-target.js').RenderTarget|undefined} target - The destination render
 * target. If undefined, target is the frame buffer.
 * @param {import('../../platform/graphics/shader.js').Shader} shader - The shader used for rendering the quad. Vertex
 * shader should contain `attribute vec2 vertex_position`.
 * @param {import('../../core/math/vec4.js').Vec4} [rect] - The viewport rectangle of the quad, in
 * pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {import('../../core/math/vec4.js').Vec4} [scissorRect] - The scissor rectangle of the
 * quad, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {boolean} [useBlend] - True to enable blending. Defaults to false, disabling blending.
 */
function drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend = false) {
  // a valid target or a null target (framebuffer) are supported
  Debug.assert(target !== undefined);
  DebugGraphics.pushGpuMarker(device, "drawQuadWithShader");
  const oldDepthTest = device.getDepthTest();
  const oldDepthWrite = device.getDepthWrite();
  const oldCullMode = device.getCullMode();
  const oldWR = device.writeRed;
  const oldWG = device.writeGreen;
  const oldWB = device.writeBlue;
  const oldWA = device.writeAlpha;
  device.setDepthTest(false);
  device.setDepthWrite(false);
  device.setCullMode(CULLFACE_NONE);
  device.setColorWrite(true, true, true, true);
  if (!useBlend) device.setBlending(false);

  // prepare the quad for rendering with the shader
  const quad = new QuadRender(shader);

  // by default render to the whole render target
  if (!rect) {
    rect = _tempRect;
    rect.x = 0;
    rect.y = 0;
    rect.z = target ? target.width : device.width;
    rect.w = target ? target.height : device.height;
  }

  // prepare a render pass to render the quad to the render target
  const renderPass = new RenderPass(device, () => {
    quad.render(rect, scissorRect);
  });
  DebugHelper.setName(renderPass, `RenderPass-drawQuadWithShader${target ? `-${target.name}` : ''}`);
  renderPass.init(target);
  renderPass.colorOps.clear = false;
  renderPass.depthStencilOps.clearDepth = false;

  // TODO: this is temporary, till the webgpu supports setDepthTest
  if (device.deviceType === DEVICETYPE_WEBGPU) {
    renderPass.depthStencilOps.clearDepth = true;
  }
  renderPass.render();
  quad.destroy();
  device.setDepthTest(oldDepthTest);
  device.setDepthWrite(oldDepthWrite);
  device.setCullMode(oldCullMode);
  device.setColorWrite(oldWR, oldWG, oldWB, oldWA);
  DebugGraphics.popGpuMarker(device);
}

/**
 * Draws a texture in screen-space. Mostly used by post-effects.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device used to draw
 * the texture.
 * @param {import('../../platform/graphics/texture.js').Texture} texture - The source texture to be drawn. Accessible as
 * `uniform sampler2D * source` in shader.
 * @param {import('../../platform/graphics/render-target.js').RenderTarget} [target] - The destination render target.
 * Defaults to the frame buffer.
 * @param {import('../../platform/graphics/shader.js').Shader} [shader] - The shader used for rendering the texture.
 * Defaults to {@link GraphicsDevice#getCopyShader}.
 * @param {import('../../core/math/vec4.js').Vec4} [rect] - The viewport rectangle to use for the
 * texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {import('../../core/math/vec4.js').Vec4} [scissorRect] - The scissor rectangle to use for
 * the texture, in pixels. Defaults to fullscreen (`0, 0, target.width, target.height`).
 * @param {boolean} [useBlend] - True to enable blending. Defaults to false, disabling blending.
 */
function drawTexture(device, texture, target, shader, rect, scissorRect, useBlend = false) {
  Debug.assert(device.deviceType !== DEVICETYPE_WEBGPU, 'pc.drawTexture is not currently supported on WebGPU platform.');
  shader = shader || device.getCopyShader();
  device.constantTexSource.setValue(texture);
  drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend);
}

export { drawQuadWithShader, drawTexture };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVhZC1yZW5kZXItdXRpbHMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9xdWFkLXJlbmRlci11dGlscy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IENVTExGQUNFX05PTkUsIERFVklDRVRZUEVfV0VCR1BVIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5pbXBvcnQgeyBSZW5kZXJQYXNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXBhc3MuanMnO1xuaW1wb3J0IHsgUXVhZFJlbmRlciB9IGZyb20gJy4vcXVhZC1yZW5kZXIuanMnO1xuXG5jb25zdCBfdGVtcFJlY3QgPSBuZXcgVmVjNCgpO1xuXG4vKipcbiAqIERyYXdzIGEgc2NyZWVuLXNwYWNlIHF1YWQgdXNpbmcgYSBzcGVjaWZpYyBzaGFkZXIuXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gZHJhd1xuICogdGhlIHF1YWQuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcycpLlJlbmRlclRhcmdldHx1bmRlZmluZWR9IHRhcmdldCAtIFRoZSBkZXN0aW5hdGlvbiByZW5kZXJcbiAqIHRhcmdldC4gSWYgdW5kZWZpbmVkLCB0YXJnZXQgaXMgdGhlIGZyYW1lIGJ1ZmZlci5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXIuanMnKS5TaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdXNlZCBmb3IgcmVuZGVyaW5nIHRoZSBxdWFkLiBWZXJ0ZXhcbiAqIHNoYWRlciBzaG91bGQgY29udGFpbiBgYXR0cmlidXRlIHZlYzIgdmVydGV4X3Bvc2l0aW9uYC5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcycpLlZlYzR9IFtyZWN0XSAtIFRoZSB2aWV3cG9ydCByZWN0YW5nbGUgb2YgdGhlIHF1YWQsIGluXG4gKiBwaXhlbHMuIERlZmF1bHRzIHRvIGZ1bGxzY3JlZW4gKGAwLCAwLCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHRgKS5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcycpLlZlYzR9IFtzY2lzc29yUmVjdF0gLSBUaGUgc2Npc3NvciByZWN0YW5nbGUgb2YgdGhlXG4gKiBxdWFkLCBpbiBwaXhlbHMuIERlZmF1bHRzIHRvIGZ1bGxzY3JlZW4gKGAwLCAwLCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHRgKS5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW3VzZUJsZW5kXSAtIFRydWUgdG8gZW5hYmxlIGJsZW5kaW5nLiBEZWZhdWx0cyB0byBmYWxzZSwgZGlzYWJsaW5nIGJsZW5kaW5nLlxuICovXG5mdW5jdGlvbiBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnZXQsIHNoYWRlciwgcmVjdCwgc2Npc3NvclJlY3QsIHVzZUJsZW5kID0gZmFsc2UpIHtcblxuICAgIC8vIGEgdmFsaWQgdGFyZ2V0IG9yIGEgbnVsbCB0YXJnZXQgKGZyYW1lYnVmZmVyKSBhcmUgc3VwcG9ydGVkXG4gICAgRGVidWcuYXNzZXJ0KHRhcmdldCAhPT0gdW5kZWZpbmVkKTtcblxuICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIFwiZHJhd1F1YWRXaXRoU2hhZGVyXCIpO1xuXG4gICAgY29uc3Qgb2xkRGVwdGhUZXN0ID0gZGV2aWNlLmdldERlcHRoVGVzdCgpO1xuICAgIGNvbnN0IG9sZERlcHRoV3JpdGUgPSBkZXZpY2UuZ2V0RGVwdGhXcml0ZSgpO1xuICAgIGNvbnN0IG9sZEN1bGxNb2RlID0gZGV2aWNlLmdldEN1bGxNb2RlKCk7XG4gICAgY29uc3Qgb2xkV1IgPSBkZXZpY2Uud3JpdGVSZWQ7XG4gICAgY29uc3Qgb2xkV0cgPSBkZXZpY2Uud3JpdGVHcmVlbjtcbiAgICBjb25zdCBvbGRXQiA9IGRldmljZS53cml0ZUJsdWU7XG4gICAgY29uc3Qgb2xkV0EgPSBkZXZpY2Uud3JpdGVBbHBoYTtcblxuICAgIGRldmljZS5zZXREZXB0aFRlc3QoZmFsc2UpO1xuICAgIGRldmljZS5zZXREZXB0aFdyaXRlKGZhbHNlKTtcbiAgICBkZXZpY2Uuc2V0Q3VsbE1vZGUoQ1VMTEZBQ0VfTk9ORSk7XG4gICAgZGV2aWNlLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgaWYgKCF1c2VCbGVuZCkgZGV2aWNlLnNldEJsZW5kaW5nKGZhbHNlKTtcblxuICAgIC8vIHByZXBhcmUgdGhlIHF1YWQgZm9yIHJlbmRlcmluZyB3aXRoIHRoZSBzaGFkZXJcbiAgICBjb25zdCBxdWFkID0gbmV3IFF1YWRSZW5kZXIoc2hhZGVyKTtcblxuICAgIC8vIGJ5IGRlZmF1bHQgcmVuZGVyIHRvIHRoZSB3aG9sZSByZW5kZXIgdGFyZ2V0XG4gICAgaWYgKCFyZWN0KSB7XG4gICAgICAgIHJlY3QgPSBfdGVtcFJlY3Q7XG4gICAgICAgIHJlY3QueCA9IDA7XG4gICAgICAgIHJlY3QueSA9IDA7XG4gICAgICAgIHJlY3QueiA9IHRhcmdldCA/IHRhcmdldC53aWR0aCA6IGRldmljZS53aWR0aDtcbiAgICAgICAgcmVjdC53ID0gdGFyZ2V0ID8gdGFyZ2V0LmhlaWdodCA6IGRldmljZS5oZWlnaHQ7XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZSBhIHJlbmRlciBwYXNzIHRvIHJlbmRlciB0aGUgcXVhZCB0byB0aGUgcmVuZGVyIHRhcmdldFxuICAgIGNvbnN0IHJlbmRlclBhc3MgPSBuZXcgUmVuZGVyUGFzcyhkZXZpY2UsICgpID0+IHtcbiAgICAgICAgcXVhZC5yZW5kZXIocmVjdCwgc2Npc3NvclJlY3QpO1xuICAgIH0pO1xuICAgIERlYnVnSGVscGVyLnNldE5hbWUocmVuZGVyUGFzcywgYFJlbmRlclBhc3MtZHJhd1F1YWRXaXRoU2hhZGVyJHt0YXJnZXQgPyBgLSR7dGFyZ2V0Lm5hbWV9YCA6ICcnfWApO1xuICAgIHJlbmRlclBhc3MuaW5pdCh0YXJnZXQpO1xuICAgIHJlbmRlclBhc3MuY29sb3JPcHMuY2xlYXIgPSBmYWxzZTtcbiAgICByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoID0gZmFsc2U7XG5cbiAgICAvLyBUT0RPOiB0aGlzIGlzIHRlbXBvcmFyeSwgdGlsbCB0aGUgd2ViZ3B1IHN1cHBvcnRzIHNldERlcHRoVGVzdFxuICAgIGlmIChkZXZpY2UuZGV2aWNlVHlwZSA9PT0gREVWSUNFVFlQRV9XRUJHUFUpIHtcbiAgICAgICAgcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aCA9IHRydWU7XG4gICAgfVxuXG4gICAgcmVuZGVyUGFzcy5yZW5kZXIoKTtcbiAgICBxdWFkLmRlc3Ryb3koKTtcblxuICAgIGRldmljZS5zZXREZXB0aFRlc3Qob2xkRGVwdGhUZXN0KTtcbiAgICBkZXZpY2Uuc2V0RGVwdGhXcml0ZShvbGREZXB0aFdyaXRlKTtcbiAgICBkZXZpY2Uuc2V0Q3VsbE1vZGUob2xkQ3VsbE1vZGUpO1xuICAgIGRldmljZS5zZXRDb2xvcldyaXRlKG9sZFdSLCBvbGRXRywgb2xkV0IsIG9sZFdBKTtcblxuICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG59XG5cbi8qKlxuICogRHJhd3MgYSB0ZXh0dXJlIGluIHNjcmVlbi1zcGFjZS4gTW9zdGx5IHVzZWQgYnkgcG9zdC1lZmZlY3RzLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIGRyYXdcbiAqIHRoZSB0ZXh0dXJlLlxuICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHNvdXJjZSB0ZXh0dXJlIHRvIGJlIGRyYXduLiBBY2Nlc3NpYmxlIGFzXG4gKiBgdW5pZm9ybSBzYW1wbGVyMkQgKiBzb3VyY2VgIGluIHNoYWRlci5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fSBbdGFyZ2V0XSAtIFRoZSBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LlxuICogRGVmYXVsdHMgdG8gdGhlIGZyYW1lIGJ1ZmZlci5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXIuanMnKS5TaGFkZXJ9IFtzaGFkZXJdIC0gVGhlIHNoYWRlciB1c2VkIGZvciByZW5kZXJpbmcgdGhlIHRleHR1cmUuXG4gKiBEZWZhdWx0cyB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjZ2V0Q29weVNoYWRlcn0uXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnKS5WZWM0fSBbcmVjdF0gLSBUaGUgdmlld3BvcnQgcmVjdGFuZ2xlIHRvIHVzZSBmb3IgdGhlXG4gKiB0ZXh0dXJlLCBpbiBwaXhlbHMuIERlZmF1bHRzIHRvIGZ1bGxzY3JlZW4gKGAwLCAwLCB0YXJnZXQud2lkdGgsIHRhcmdldC5oZWlnaHRgKS5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcycpLlZlYzR9IFtzY2lzc29yUmVjdF0gLSBUaGUgc2Npc3NvciByZWN0YW5nbGUgdG8gdXNlIGZvclxuICogdGhlIHRleHR1cmUsIGluIHBpeGVscy4gRGVmYXVsdHMgdG8gZnVsbHNjcmVlbiAoYDAsIDAsIHRhcmdldC53aWR0aCwgdGFyZ2V0LmhlaWdodGApLlxuICogQHBhcmFtIHtib29sZWFufSBbdXNlQmxlbmRdIC0gVHJ1ZSB0byBlbmFibGUgYmxlbmRpbmcuIERlZmF1bHRzIHRvIGZhbHNlLCBkaXNhYmxpbmcgYmxlbmRpbmcuXG4gKi9cbmZ1bmN0aW9uIGRyYXdUZXh0dXJlKGRldmljZSwgdGV4dHVyZSwgdGFyZ2V0LCBzaGFkZXIsIHJlY3QsIHNjaXNzb3JSZWN0LCB1c2VCbGVuZCA9IGZhbHNlKSB7XG4gICAgRGVidWcuYXNzZXJ0KGRldmljZS5kZXZpY2VUeXBlICE9PSBERVZJQ0VUWVBFX1dFQkdQVSwgJ3BjLmRyYXdUZXh0dXJlIGlzIG5vdCBjdXJyZW50bHkgc3VwcG9ydGVkIG9uIFdlYkdQVSBwbGF0Zm9ybS4nKTtcbiAgICBzaGFkZXIgPSBzaGFkZXIgfHwgZGV2aWNlLmdldENvcHlTaGFkZXIoKTtcbiAgICBkZXZpY2UuY29uc3RhbnRUZXhTb3VyY2Uuc2V0VmFsdWUodGV4dHVyZSk7XG4gICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZ2V0LCBzaGFkZXIsIHJlY3QsIHNjaXNzb3JSZWN0LCB1c2VCbGVuZCk7XG59XG5cbmV4cG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciwgZHJhd1RleHR1cmUgfTtcbiJdLCJuYW1lcyI6WyJfdGVtcFJlY3QiLCJWZWM0IiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwiZGV2aWNlIiwidGFyZ2V0Iiwic2hhZGVyIiwicmVjdCIsInNjaXNzb3JSZWN0IiwidXNlQmxlbmQiLCJEZWJ1ZyIsImFzc2VydCIsInVuZGVmaW5lZCIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwib2xkRGVwdGhUZXN0IiwiZ2V0RGVwdGhUZXN0Iiwib2xkRGVwdGhXcml0ZSIsImdldERlcHRoV3JpdGUiLCJvbGRDdWxsTW9kZSIsImdldEN1bGxNb2RlIiwib2xkV1IiLCJ3cml0ZVJlZCIsIm9sZFdHIiwid3JpdGVHcmVlbiIsIm9sZFdCIiwid3JpdGVCbHVlIiwib2xkV0EiLCJ3cml0ZUFscGhhIiwic2V0RGVwdGhUZXN0Iiwic2V0RGVwdGhXcml0ZSIsInNldEN1bGxNb2RlIiwiQ1VMTEZBQ0VfTk9ORSIsInNldENvbG9yV3JpdGUiLCJzZXRCbGVuZGluZyIsInF1YWQiLCJRdWFkUmVuZGVyIiwieCIsInkiLCJ6Iiwid2lkdGgiLCJ3IiwiaGVpZ2h0IiwicmVuZGVyUGFzcyIsIlJlbmRlclBhc3MiLCJyZW5kZXIiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJuYW1lIiwiaW5pdCIsImNvbG9yT3BzIiwiY2xlYXIiLCJkZXB0aFN0ZW5jaWxPcHMiLCJjbGVhckRlcHRoIiwiZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR1BVIiwiZGVzdHJveSIsInBvcEdwdU1hcmtlciIsImRyYXdUZXh0dXJlIiwidGV4dHVyZSIsImdldENvcHlTaGFkZXIiLCJjb25zdGFudFRleFNvdXJjZSIsInNldFZhbHVlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFRQSxNQUFNQSxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLGtCQUFrQixDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxJQUFJLEVBQUVDLFdBQVcsRUFBRUMsUUFBUSxHQUFHLEtBQUssRUFBRTtBQUVyRjtBQUNBQyxFQUFBQSxLQUFLLENBQUNDLE1BQU0sQ0FBQ04sTUFBTSxLQUFLTyxTQUFTLENBQUMsQ0FBQTtBQUVsQ0MsRUFBQUEsYUFBYSxDQUFDQyxhQUFhLENBQUNWLE1BQU0sRUFBRSxvQkFBb0IsQ0FBQyxDQUFBO0FBRXpELEVBQUEsTUFBTVcsWUFBWSxHQUFHWCxNQUFNLENBQUNZLFlBQVksRUFBRSxDQUFBO0FBQzFDLEVBQUEsTUFBTUMsYUFBYSxHQUFHYixNQUFNLENBQUNjLGFBQWEsRUFBRSxDQUFBO0FBQzVDLEVBQUEsTUFBTUMsV0FBVyxHQUFHZixNQUFNLENBQUNnQixXQUFXLEVBQUUsQ0FBQTtBQUN4QyxFQUFBLE1BQU1DLEtBQUssR0FBR2pCLE1BQU0sQ0FBQ2tCLFFBQVEsQ0FBQTtBQUM3QixFQUFBLE1BQU1DLEtBQUssR0FBR25CLE1BQU0sQ0FBQ29CLFVBQVUsQ0FBQTtBQUMvQixFQUFBLE1BQU1DLEtBQUssR0FBR3JCLE1BQU0sQ0FBQ3NCLFNBQVMsQ0FBQTtBQUM5QixFQUFBLE1BQU1DLEtBQUssR0FBR3ZCLE1BQU0sQ0FBQ3dCLFVBQVUsQ0FBQTtBQUUvQnhCLEVBQUFBLE1BQU0sQ0FBQ3lCLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUMxQnpCLEVBQUFBLE1BQU0sQ0FBQzBCLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUMzQjFCLEVBQUFBLE1BQU0sQ0FBQzJCLFdBQVcsQ0FBQ0MsYUFBYSxDQUFDLENBQUE7RUFDakM1QixNQUFNLENBQUM2QixhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7RUFDNUMsSUFBSSxDQUFDeEIsUUFBUSxFQUFFTCxNQUFNLENBQUM4QixXQUFXLENBQUMsS0FBSyxDQUFDLENBQUE7O0FBRXhDO0FBQ0EsRUFBQSxNQUFNQyxJQUFJLEdBQUcsSUFBSUMsVUFBVSxDQUFDOUIsTUFBTSxDQUFDLENBQUE7O0FBRW5DO0VBQ0EsSUFBSSxDQUFDQyxJQUFJLEVBQUU7QUFDUEEsSUFBQUEsSUFBSSxHQUFHTixTQUFTLENBQUE7SUFDaEJNLElBQUksQ0FBQzhCLENBQUMsR0FBRyxDQUFDLENBQUE7SUFDVjlCLElBQUksQ0FBQytCLENBQUMsR0FBRyxDQUFDLENBQUE7SUFDVi9CLElBQUksQ0FBQ2dDLENBQUMsR0FBR2xDLE1BQU0sR0FBR0EsTUFBTSxDQUFDbUMsS0FBSyxHQUFHcEMsTUFBTSxDQUFDb0MsS0FBSyxDQUFBO0lBQzdDakMsSUFBSSxDQUFDa0MsQ0FBQyxHQUFHcEMsTUFBTSxHQUFHQSxNQUFNLENBQUNxQyxNQUFNLEdBQUd0QyxNQUFNLENBQUNzQyxNQUFNLENBQUE7QUFDbkQsR0FBQTs7QUFFQTtBQUNBLEVBQUEsTUFBTUMsVUFBVSxHQUFHLElBQUlDLFVBQVUsQ0FBQ3hDLE1BQU0sRUFBRSxNQUFNO0FBQzVDK0IsSUFBQUEsSUFBSSxDQUFDVSxNQUFNLENBQUN0QyxJQUFJLEVBQUVDLFdBQVcsQ0FBQyxDQUFBO0FBQ2xDLEdBQUMsQ0FBQyxDQUFBO0FBQ0ZzQyxFQUFBQSxXQUFXLENBQUNDLE9BQU8sQ0FBQ0osVUFBVSxFQUFHLGdDQUErQnRDLE1BQU0sR0FBSSxDQUFHQSxDQUFBQSxFQUFBQSxNQUFNLENBQUMyQyxJQUFLLENBQUEsQ0FBQyxHQUFHLEVBQUcsRUFBQyxDQUFDLENBQUE7QUFDbEdMLEVBQUFBLFVBQVUsQ0FBQ00sSUFBSSxDQUFDNUMsTUFBTSxDQUFDLENBQUE7QUFDdkJzQyxFQUFBQSxVQUFVLENBQUNPLFFBQVEsQ0FBQ0MsS0FBSyxHQUFHLEtBQUssQ0FBQTtBQUNqQ1IsRUFBQUEsVUFBVSxDQUFDUyxlQUFlLENBQUNDLFVBQVUsR0FBRyxLQUFLLENBQUE7O0FBRTdDO0FBQ0EsRUFBQSxJQUFJakQsTUFBTSxDQUFDa0QsVUFBVSxLQUFLQyxpQkFBaUIsRUFBRTtBQUN6Q1osSUFBQUEsVUFBVSxDQUFDUyxlQUFlLENBQUNDLFVBQVUsR0FBRyxJQUFJLENBQUE7QUFDaEQsR0FBQTtFQUVBVixVQUFVLENBQUNFLE1BQU0sRUFBRSxDQUFBO0VBQ25CVixJQUFJLENBQUNxQixPQUFPLEVBQUUsQ0FBQTtBQUVkcEQsRUFBQUEsTUFBTSxDQUFDeUIsWUFBWSxDQUFDZCxZQUFZLENBQUMsQ0FBQTtBQUNqQ1gsRUFBQUEsTUFBTSxDQUFDMEIsYUFBYSxDQUFDYixhQUFhLENBQUMsQ0FBQTtBQUNuQ2IsRUFBQUEsTUFBTSxDQUFDMkIsV0FBVyxDQUFDWixXQUFXLENBQUMsQ0FBQTtFQUMvQmYsTUFBTSxDQUFDNkIsYUFBYSxDQUFDWixLQUFLLEVBQUVFLEtBQUssRUFBRUUsS0FBSyxFQUFFRSxLQUFLLENBQUMsQ0FBQTtBQUVoRGQsRUFBQUEsYUFBYSxDQUFDNEMsWUFBWSxDQUFDckQsTUFBTSxDQUFDLENBQUE7QUFDdEMsQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU3NELFdBQVcsQ0FBQ3RELE1BQU0sRUFBRXVELE9BQU8sRUFBRXRELE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxJQUFJLEVBQUVDLFdBQVcsRUFBRUMsUUFBUSxHQUFHLEtBQUssRUFBRTtFQUN2RkMsS0FBSyxDQUFDQyxNQUFNLENBQUNQLE1BQU0sQ0FBQ2tELFVBQVUsS0FBS0MsaUJBQWlCLEVBQUUsK0RBQStELENBQUMsQ0FBQTtBQUN0SGpELEVBQUFBLE1BQU0sR0FBR0EsTUFBTSxJQUFJRixNQUFNLENBQUN3RCxhQUFhLEVBQUUsQ0FBQTtBQUN6Q3hELEVBQUFBLE1BQU0sQ0FBQ3lELGlCQUFpQixDQUFDQyxRQUFRLENBQUNILE9BQU8sQ0FBQyxDQUFBO0FBQzFDeEQsRUFBQUEsa0JBQWtCLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsV0FBVyxFQUFFQyxRQUFRLENBQUMsQ0FBQTtBQUMzRTs7OzsifQ==
