import '../../core/tracing.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL } from './constants.js';
import { GraphicsDevice } from './graphics-device.js';

const defaultOptions = {
  depth: true,
  face: 0
};
let id = 0;

class RenderTarget {
  constructor(options) {
    var _this$_colorBuffer, _this$_depthBuffer;
    this.id = id++;
    const _arg2 = arguments[1];
    const _arg3 = arguments[2];
    if (options instanceof GraphicsDevice) {
      this._colorBuffer = _arg2;
      options = _arg3;
    } else {
      this._colorBuffer = options.colorBuffer;
    }

    if (this._colorBuffer) {
      this._colorBuffer._isRenderTarget = true;
    }

    options = options !== undefined ? options : defaultOptions;
    this._depthBuffer = options.depthBuffer;
    this._face = options.face !== undefined ? options.face : 0;
    if (this._depthBuffer) {
      const format = this._depthBuffer._format;
      if (format === PIXELFORMAT_DEPTH) {
        this._depth = true;
        this._stencil = false;
      } else if (format === PIXELFORMAT_DEPTHSTENCIL) {
        this._depth = true;
        this._stencil = true;
      } else {
        this._depth = false;
        this._stencil = false;
      }
    } else {
      this._depth = options.depth !== undefined ? options.depth : true;
      this._stencil = options.stencil !== undefined ? options.stencil : false;
    }

    const device = ((_this$_colorBuffer = this._colorBuffer) == null ? void 0 : _this$_colorBuffer.device) || ((_this$_depthBuffer = this._depthBuffer) == null ? void 0 : _this$_depthBuffer.device) || options.graphicsDevice;
    this._device = device;
    this._samples = options.samples !== undefined ? Math.min(options.samples, this._device.maxSamples) : 1;
    this.autoResolve = options.autoResolve !== undefined ? options.autoResolve : true;

    this.name = options.name;
    if (!this.name) {
      var _this$_colorBuffer2;
      this.name = (_this$_colorBuffer2 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer2.name;
    }
    if (!this.name) {
      var _this$_depthBuffer2;
      this.name = (_this$_depthBuffer2 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer2.name;
    }
    if (!this.name) {
      this.name = "Untitled";
    }

    this.flipY = !!options.flipY;

    this.impl = device.createRenderTargetImpl(this);
  }

  destroy() {
    const device = this._device;
    if (device) {
      const idx = device.targets.indexOf(this);
      if (idx !== -1) {
        device.targets.splice(idx, 1);
      }
      if (device.renderTarget === this) {
        device.setRenderTarget(null);
      }
      this.destroyFrameBuffers();
    }
  }

  destroyFrameBuffers() {
    const device = this._device;
    if (device) {
      this.impl.destroy(device);
    }
  }

  destroyTextureBuffers() {
    if (this._depthBuffer) {
      this._depthBuffer.destroy();
      this._depthBuffer = null;
    }
    if (this._colorBuffer) {
      this._colorBuffer.destroy();
      this._colorBuffer = null;
    }
  }

  init() {
    this.impl.init(this._device, this);
  }
  get initialized() {
    return this.impl.initialized;
  }

  loseContext() {
    this.impl.loseContext();
  }

  resolve(color = true, depth = !!this._depthBuffer) {
    if (this._device && this._samples > 1) {
      this.impl.resolve(this._device, this, color, depth);
    }
  }

  copy(source, color, depth) {
    if (!this._device) {
      if (source._device) {
        this._device = source._device;
      } else {
        return false;
      }
    }
    const success = this._device.copyRenderTarget(source, this, color, depth);
    return success;
  }

  get samples() {
    return this._samples;
  }

  get depth() {
    return this._depth;
  }

  get stencil() {
    return this._stencil;
  }

  get colorBuffer() {
    return this._colorBuffer;
  }

  get depthBuffer() {
    return this._depthBuffer;
  }

  get face() {
    return this._face;
  }

  get width() {
    var _this$_colorBuffer3, _this$_depthBuffer3;
    return ((_this$_colorBuffer3 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer3.width) || ((_this$_depthBuffer3 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer3.width) || this._device.width;
  }

  get height() {
    var _this$_colorBuffer4, _this$_depthBuffer4;
    return ((_this$_colorBuffer4 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer4.height) || ((_this$_depthBuffer4 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer4.height) || this._device.height;
  }
}

export { RenderTarget };
