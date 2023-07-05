import { SEMANTIC_POSITION, TYPE_FLOAT32, CULLFACE_NONE, PRIMITIVE_TRISTRIP } from './constants.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';
import { VertexIterator } from './vertex-iterator.js';

const primitive = {
  type: PRIMITIVE_TRISTRIP,
  base: 0,
  count: 4,
  indexed: false
};

class PostEffect {
  constructor(graphicsDevice) {
    this.device = graphicsDevice;
    this.shader = null;
    this.vertexBuffer = createFullscreenQuad(graphicsDevice);
    this.needsDepthBuffer = false;
    this.depthMap = null;
  }

  render(inputTarget, outputTarget, rect) {}

}

function createFullscreenQuad(device) {
  const vertexFormat = new VertexFormat(device, [{
    semantic: SEMANTIC_POSITION,
    components: 2,
    type: TYPE_FLOAT32
  }]);
  const vertexBuffer = new VertexBuffer(device, vertexFormat, 4);
  const iterator = new VertexIterator(vertexBuffer);
  iterator.element[SEMANTIC_POSITION].set(-1.0, -1.0);
  iterator.next();
  iterator.element[SEMANTIC_POSITION].set(1.0, -1.0);
  iterator.next();
  iterator.element[SEMANTIC_POSITION].set(-1.0, 1.0);
  iterator.next();
  iterator.element[SEMANTIC_POSITION].set(1.0, 1.0);
  iterator.end();
  return vertexBuffer;
}

function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {
  const oldRt = device.getRenderTarget();
  device.setRenderTarget(target);
  device.updateBegin();
  let w = target ? target.width : device.width;
  let h = target ? target.height : device.height;
  let x = 0;
  let y = 0;

  if (rect) {
    x = rect.x * w;
    y = rect.y * h;
    w *= rect.z;
    h *= rect.w;
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
  device.setScissor(x, y, w, h);
  const oldBlending = device.getBlending();
  const oldDepthTest = device.getDepthTest();
  const oldDepthWrite = device.getDepthWrite();
  const oldCullMode = device.getCullMode();
  const oldWR = device.writeRed;
  const oldWG = device.writeGreen;
  const oldWB = device.writeBlue;
  const oldWA = device.writeAlpha;
  device.setBlending(false);
  device.setDepthTest(false);
  device.setDepthWrite(false);
  device.setCullMode(CULLFACE_NONE);
  device.setColorWrite(true, true, true, true);
  device.setVertexBuffer(vertexBuffer, 0);
  device.setShader(shader);
  device.draw(primitive);
  device.setBlending(oldBlending);
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

export { PostEffect, createFullscreenQuad, drawFullscreenQuad };
