import { FUNC_ALWAYS, STENCILOP_KEEP } from '../platform/graphics/constants.js';

class StencilParameters {
  constructor(options) {
    this.func = options.func === undefined ? FUNC_ALWAYS : options.func;
    this.ref = options.ref || 0;
    this.readMask = options.readMask === undefined ? 0xFF : options.readMask;
    this.writeMask = options.writeMask === undefined ? 0xFF : options.writeMask;
    this.fail = options.fail || STENCILOP_KEEP;
    this.zfail = options.zfail || STENCILOP_KEEP;
    this.zpass = options.zpass || STENCILOP_KEEP;
  }
  clone() {
    return new StencilParameters({
      func: this.func,
      ref: this.ref,
      readMask: this.readMask,
      writeMask: this.writeMask,
      fail: this.fail,
      zfail: this.zfail,
      zpass: this.zpass
    });
  }
}

export { StencilParameters };
