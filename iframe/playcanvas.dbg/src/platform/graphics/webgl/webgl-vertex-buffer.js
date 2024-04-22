import { WebglBuffer } from './webgl-buffer.js';

/**
 * A WebGL implementation of the VertexBuffer.
 *
 * @ignore
 */
class WebglVertexBuffer extends WebglBuffer {
  constructor(...args) {
    super(...args);
    // vertex array object
    this.vao = null;
  }
  destroy(device) {
    super.destroy(device);

    // clear up bound vertex buffers
    device.unbindVertexArray();
  }
  loseContext() {
    super.loseContext();
    this.vao = null;
  }
  unlock(vertexBuffer) {
    const device = vertexBuffer.device;
    super.unlock(device, vertexBuffer.usage, device.gl.ARRAY_BUFFER, vertexBuffer.storage);
  }
}

export { WebglVertexBuffer };
