import { EventHandler } from '../../core/event-handler.js';
import { Mat4 } from '../../core/math/mat4.js';

/**
 * @category XR
 * @deprecated
 * @ignore
 */
class XrDepthSensing extends EventHandler {
  /**
   * @param {import('./xr-manager.js').XrManager} manager - manager
   * @ignore
   */
  constructor(manager) {
    super();
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    this._manager = void 0;
    /**
     * @type {import('./xr-views.js').XrViews}
     * @private
     */
    this._views = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._available = false;
    /**
     * @type {import('../../core/event-handle.js').EventHandle|null}
     * @private
     */
    this._evtDepthResize = null;
    /**
     * @type {Mat4}
     * @private
     */
    this._uvMatrix = Mat4.IDENTITY.clone();
    this._manager = manager;
    this._views = manager.views;
    if (this._views.supportedDepth) {
      this._manager.on('start', this._onSessionStart, this);
      this._manager.on('end', this._onSessionEnd, this);
    }
  }

  /** @private */
  _onSessionStart() {
    var _this$_views$list$;
    if (this._views.availableDepth) this._evtDepthResize = (_this$_views$list$ = this._views.list[0]) == null ? void 0 : _this$_views$list$.on('depth:resize', this._onDepthResize, this);
  }

  /** @private */
  _onSessionEnd() {
    if (this._evtDepthResize) {
      this._evtDepthResize.off();
      this._evtDepthResize = null;
    }
    if (this._available) {
      this._available = false;
      this.fire('unavailable');
    }
  }

  /** @private */
  _onDepthResize(width, height) {
    this.fire('resize', width, height);
  }

  /**
   * @param {number} u - u
   * @param {number} v - v
   * @deprecated
   * @returns {number|null} number
   */
  getDepth(u, v) {
    var _this$_views$list$0$g, _this$_views$list$2;
    return (_this$_views$list$0$g = (_this$_views$list$2 = this._views.list[0]) == null ? void 0 : _this$_views$list$2.getDepth(u, v)) != null ? _this$_views$list$0$g : null;
  }

  /**
   * @deprecated
   */
  update() {
    if (this._manager.session && this.supported && this._views.availableDepth && this._views.list.length && !this._available) {
      this._available = true;
      this.fire('available');
    }
  }

  /**
   * @type {boolean}
   * @deprecated
   */
  get supported() {
    return this._views.supportedDepth;
  }

  /**
   * @type {boolean}
   * @deprecated
   */
  get available() {
    return this._views.availableDepth;
  }

  /**
   * @type {string}
   * @deprecated
   */
  get usage() {
    return this._views.depthUsage;
  }

  /**
   * @type {string}
   * @deprecated
   */
  get dataFormat() {
    return this._views.depthFormat;
  }

  /**
   * @type {number}
   * @deprecated
   */
  get width() {
    var _this$_views$list$0$t, _this$_views$list$3;
    return (_this$_views$list$0$t = (_this$_views$list$3 = this._views.list[0]) == null || (_this$_views$list$3 = _this$_views$list$3.textureDepth) == null ? void 0 : _this$_views$list$3.width) != null ? _this$_views$list$0$t : 0;
  }

  /**
   * @type {number}
   * @deprecated
   */
  get height() {
    var _this$_views$list$0$t2, _this$_views$list$4;
    return (_this$_views$list$0$t2 = (_this$_views$list$4 = this._views.list[0]) == null || (_this$_views$list$4 = _this$_views$list$4.textureDepth) == null ? void 0 : _this$_views$list$4.height) != null ? _this$_views$list$0$t2 : 0;
  }

  /**
   * @type {import('../../platform/graphics/texture.js').Texture|null}
   * @deprecated
   */
  get texture() {
    var _this$_views$list$5;
    return (_this$_views$list$5 = this._views.list[0]) == null ? void 0 : _this$_views$list$5.textureDepth;
  }

  /**
   * @type {Mat4}
   * @deprecated
   */
  get uvMatrix() {
    var _this$_views$list$0$d, _this$_views$list$6;
    return (_this$_views$list$0$d = (_this$_views$list$6 = this._views.list[0]) == null ? void 0 : _this$_views$list$6.depthUvMatrix) != null ? _this$_views$list$0$d : this._uvMatrix;
  }

  /**
   * @type {number}
   * @deprecated
   */
  get rawValueToMeters() {
    var _this$_views$list$0$d2, _this$_views$list$7;
    return (_this$_views$list$0$d2 = (_this$_views$list$7 = this._views.list[0]) == null ? void 0 : _this$_views$list$7.depthValueToMeters) != null ? _this$_views$list$0$d2 : 0;
  }
}
/**
 * @event
 * @deprecated
 */
XrDepthSensing.EVENT_AVAILABLE = 'available';
/**
 * @event
 * @deprecated
 */
XrDepthSensing.EVENT_UNAVAILABLE = 'unavailable';
/**
 * @event
 * @deprecated
 */
XrDepthSensing.EVENT_RESIZE = 'resize';

export { XrDepthSensing };
