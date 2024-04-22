import { Color } from '../../core/math/color.js';

class ColorAttachmentOps {
  constructor() {
    this.clearValue = new Color(0, 0, 0, 1);
    this.clear = false;
    this.store = false;
    this.resolve = true;
    this.mipmaps = false;
  }
}
class DepthStencilAttachmentOps {
  constructor() {
    this.clearDepthValue = 1;
    this.clearStencilValue = 0;
    this.clearDepth = false;
    this.clearStencil = false;
    this.storeDepth = false;
    this.storeStencil = false;
  }
}
class RenderPass {
  get colorOps() {
    return this.colorArrayOps[0];
  }
  constructor(graphicsDevice) {
    this._name = void 0;
    this.device = void 0;
    this._enabled = true;
    this.executeEnabled = true;
    this.renderTarget = void 0;
    this._options = void 0;
    this.samples = 0;
    this.colorArrayOps = [];
    this.depthStencilOps = void 0;
    this.requiresCubemaps = true;
    this.fullSizeClearRect = true;
    this.beforePasses = [];
    this.afterPasses = [];
    this.device = graphicsDevice;
  }
  set name(value) {
    this._name = value;
  }
  get name() {
    if (!this._name) this._name = this.constructor.name;
    return this._name;
  }
  set options(value) {
    this._options = value;
    if (value) {
      var _this$_options$scaleX, _this$_options$scaleY;
      this._options.scaleX = (_this$_options$scaleX = this._options.scaleX) != null ? _this$_options$scaleX : 1;
      this._options.scaleY = (_this$_options$scaleY = this._options.scaleY) != null ? _this$_options$scaleY : 1;
    }
  }
  get options() {
    return this._options;
  }
  init(renderTarget = null, options = null) {
    var _renderTarget$_colorB;
    this.options = options;
    this.renderTarget = renderTarget;
    this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);
    this.depthStencilOps = new DepthStencilAttachmentOps();
    const numColorOps = renderTarget ? (_renderTarget$_colorB = renderTarget._colorBuffers) == null ? void 0 : _renderTarget$_colorB.length : 1;
    this.colorArrayOps.length = 0;
    for (let i = 0; i < numColorOps; i++) {
      var _this$renderTarget;
      const colorOps = new ColorAttachmentOps();
      this.colorArrayOps[i] = colorOps;
      if (this.samples === 1) {
        colorOps.store = true;
        colorOps.resolve = false;
      }
      if ((_this$renderTarget = this.renderTarget) != null && (_this$renderTarget = _this$renderTarget._colorBuffers) != null && _this$renderTarget[i].mipmaps) {
        colorOps.mipmaps = true;
      }
    }
    this.postInit();
  }
  destroy() {}
  postInit() {}
  frameUpdate() {
    if (this._options && this.renderTarget) {
      var _this$_options$resize;
      const resizeSource = (_this$_options$resize = this._options.resizeSource) != null ? _this$_options$resize : this.device.backBuffer;
      const width = Math.floor(resizeSource.width * this._options.scaleX);
      const height = Math.floor(resizeSource.height * this._options.scaleY);
      this.renderTarget.resize(width, height);
    }
  }
  before() {}
  execute() {}
  after() {}
  onEnable() {}
  onDisable() {}
  set enabled(value) {
    if (this._enabled !== value) {
      this._enabled = value;
      if (value) {
        this.onEnable();
      } else {
        this.onDisable();
      }
    }
  }
  get enabled() {
    return this._enabled;
  }
  setClearColor(color) {
    const count = this.colorArrayOps.length;
    for (let i = 0; i < count; i++) {
      const colorOps = this.colorArrayOps[i];
      if (color) colorOps.clearValue.copy(color);
      colorOps.clear = !!color;
    }
  }
  setClearDepth(depthValue) {
    if (depthValue) this.depthStencilOps.clearDepthValue = depthValue;
    this.depthStencilOps.clearDepth = depthValue !== undefined;
  }
  setClearStencil(stencilValue) {
    if (stencilValue) this.depthStencilOps.clearStencilValue = stencilValue;
    this.depthStencilOps.clearStencil = stencilValue !== undefined;
  }
  render() {
    if (this.enabled) {
      const device = this.device;
      const realPass = this.renderTarget !== undefined;
      this.before();
      if (this.executeEnabled) {
        if (realPass) {
          device.startRenderPass(this);
        }
        this.execute();
        if (realPass) {
          device.endRenderPass(this);
        }
      }
      this.after();
      device.renderPassIndex++;
    }
  }
}

export { ColorAttachmentOps, DepthStencilAttachmentOps, RenderPass };
