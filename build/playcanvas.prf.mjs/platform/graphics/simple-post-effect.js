/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { CULLFACE_NONE, PRIMITIVE_TRISTRIP, SEMANTIC_POSITION, TYPE_FLOAT32, BUFFER_STATIC } from './constants.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';
import { DeviceCache } from './device-cache.js';

const _postEffectQuadDraw = {
  type: PRIMITIVE_TRISTRIP,
  base: 0,
  count: 4,
  indexed: false
};

const postEffectDeviceCache = new DeviceCache();
function getPostEffectQuadVB(device) {
  return postEffectDeviceCache.get(device, () => {
    const vertexFormat = new VertexFormat(device, [{
      semantic: SEMANTIC_POSITION,
      components: 2,
      type: TYPE_FLOAT32
    }]);
    const positions = new Float32Array(8);
    positions.set([-1, -1, 1, -1, -1, 1, 1, 1]);
    return new VertexBuffer(device, vertexFormat, 4, BUFFER_STATIC, positions);
  });
}

function drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend = false) {
  const oldRt = device.renderTarget;
  device.setRenderTarget(target);
  device.updateBegin();
  let x, y, w, h;
  let sx, sy, sw, sh;
  if (!rect) {
    w = target ? target.width : device.width;
    h = target ? target.height : device.height;
    x = 0;
    y = 0;
  } else {
    x = rect.x;
    y = rect.y;
    w = rect.z;
    h = rect.w;
  }
  if (!scissorRect) {
    sx = x;
    sy = y;
    sw = w;
    sh = h;
  } else {
    sx = scissorRect.x;
    sy = scissorRect.y;
    sw = scissorRect.z;
    sh = scissorRect.w;
  }
  const oldVx = device.vx;
  const oldVy = device.vy;
  const oldVw = device.vw;
  const oldVh = device.vh;
  device.setViewport(x, y, w, h);
  const oldSx = device.sx;
  const oldSy = device.sy;
  const oldSw = device.sw;
  const oldSh = device.sh;
  device.setScissor(sx, sy, sw, sh);
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
  device.setVertexBuffer(getPostEffectQuadVB(device), 0);
  device.setShader(shader);
  device.draw(_postEffectQuadDraw);
  device.setDepthTest(oldDepthTest);
  device.setDepthWrite(oldDepthWrite);
  device.setCullMode(oldCullMode);
  device.setColorWrite(oldWR, oldWG, oldWB, oldWA);
  device.updateEnd();
  device.setRenderTarget(oldRt);
  device.updateBegin();
  device.setViewport(oldVx, oldVy, oldVw, oldVh);
  device.setScissor(oldSx, oldSy, oldSw, oldSh);
}

function drawTexture(device, texture, target, shader, rect, scissorRect, useBlend = false) {
  shader = shader || device.getCopyShader();
  device.constantTexSource.setValue(texture);
  drawQuadWithShader(device, target, shader, rect, scissorRect, useBlend);
}

export { drawQuadWithShader, drawTexture };
