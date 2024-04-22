import { BUFFERUSAGE_INDEX, BUFFERUSAGE_STORAGE, INDEXFORMAT_UINT16 } from '../constants.js';
import { WebgpuBuffer } from './webgpu-buffer.js';

class WebgpuIndexBuffer extends WebgpuBuffer {
  constructor(indexBuffer, options) {
    super(BUFFERUSAGE_INDEX | (options != null && options.storage ? BUFFERUSAGE_STORAGE : 0));
    this.format = null;
    this.format = indexBuffer.format === INDEXFORMAT_UINT16 ? "uint16" : "uint32";
  }
  unlock(indexBuffer) {
    const device = indexBuffer.device;
    super.unlock(device, indexBuffer.storage);
  }
}

export { WebgpuIndexBuffer };
