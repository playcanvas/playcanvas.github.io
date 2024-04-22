import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { XrView } from './xr-view.js';
import { XRDEPTHSENSINGFORMAT_L8A8, XRDEPTHSENSINGFORMAT_F32, XRDEPTHSENSINGUSAGE_GPU, XRTYPE_AR } from './constants.js';
import { PIXELFORMAT_LA8, PIXELFORMAT_R32F } from '../../platform/graphics/constants.js';

class XrViews extends EventHandler {
  constructor(manager) {
    super();
    this._manager = void 0;
    this._index = new Map();
    this._indexTmp = new Map();
    this._list = [];
    this._supportedColor = platform.browser && !!window.XRCamera && !!window.XRWebGLBinding;
    this._supportedDepth = platform.browser && !!window.XRDepthInformation;
    this._availableColor = false;
    this._availableDepth = false;
    this._depthUsage = '';
    this._depthFormat = '';
    this._depthFormats = {
      [XRDEPTHSENSINGFORMAT_L8A8]: PIXELFORMAT_LA8,
      [XRDEPTHSENSINGFORMAT_F32]: PIXELFORMAT_R32F
    };
    this._manager = manager;
    this._manager.on('start', this._onSessionStart, this);
    this._manager.on('end', this._onSessionEnd, this);
  }
  get list() {
    return this._list;
  }
  get supportedColor() {
    return this._supportedColor;
  }
  get supportedDepth() {
    return this._supportedDepth;
  }
  get availableColor() {
    return this._availableColor;
  }
  get availableDepth() {
    return this._availableDepth;
  }
  get depthUsage() {
    return this._depthUsage;
  }
  get depthGpuOptimized() {
    return this._depthUsage === XRDEPTHSENSINGUSAGE_GPU;
  }
  get depthFormat() {
    return this._depthFormat;
  }
  get depthPixelFormat() {
    var _this$_depthFormats$t;
    return (_this$_depthFormats$t = this._depthFormats[this._depthFormat]) != null ? _this$_depthFormats$t : null;
  }
  update(frame, xrViews) {
    for (let i = 0; i < xrViews.length; i++) {
      this._indexTmp.set(xrViews[i].eye, xrViews[i]);
    }
    for (const [eye, xrView] of this._indexTmp) {
      let view = this._index.get(eye);
      if (!view) {
        view = new XrView(this._manager, xrView, xrViews.length);
        this._index.set(eye, view);
        this._list.push(view);
        view.update(frame, xrView);
        this.fire('add', view);
      } else {
        view.update(frame, xrView);
      }
    }
    for (const [eye, view] of this._index) {
      if (this._indexTmp.has(eye)) continue;
      view.destroy();
      this._index.delete(eye);
      const ind = this._list.indexOf(view);
      if (ind !== -1) this._list.splice(ind, 1);
      this.fire('remove', view);
    }
    this._indexTmp.clear();
  }
  get(eye) {
    return this._index.get(eye) || null;
  }
  _onSessionStart() {
    if (this._manager.type !== XRTYPE_AR) return;
    if (!this._manager.session.enabledFeatures) return;
    this._availableColor = this._manager.session.enabledFeatures.indexOf('camera-access') !== -1;
    this._availableDepth = this._manager.session.enabledFeatures.indexOf('depth-sensing') !== -1;
    if (this._availableDepth) {
      const session = this._manager.session;
      this._depthUsage = session.depthUsage;
      this._depthFormat = session.depthDataFormat;
    }
  }
  _onSessionEnd() {
    for (const view of this._index.values()) {
      view.destroy();
    }
    this._index.clear();
    this._availableColor = false;
    this._availableDepth = false;
    this._depthUsage = '';
    this._depthFormat = '';
    this._list.length = 0;
  }
}
XrViews.EVENT_ADD = 'add';
XrViews.EVENT_REMOVE = 'remove';

export { XrViews };
