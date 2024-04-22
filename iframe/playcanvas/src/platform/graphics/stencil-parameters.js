import { FUNC_ALWAYS, STENCILOP_KEEP } from './constants.js';
import { StringIds } from '../../core/string-ids.js';

var _StencilParameters;
const stringIds = new StringIds();
class StencilParameters {
  set func(value) {
    this._func = value;
    this._dirty = true;
  }
  get func() {
    return this._func;
  }
  set ref(value) {
    this._ref = value;
    this._dirty = true;
  }
  get ref() {
    return this._ref;
  }
  set fail(value) {
    this._fail = value;
    this._dirty = true;
  }
  get fail() {
    return this._fail;
  }
  set zfail(value) {
    this._zfail = value;
    this._dirty = true;
  }
  get zfail() {
    return this._zfail;
  }
  set zpass(value) {
    this._zpass = value;
    this._dirty = true;
  }
  get zpass() {
    return this._zpass;
  }
  set readMask(value) {
    this._readMask = value;
    this._dirty = true;
  }
  get readMask() {
    return this._readMask;
  }
  set writeMask(value) {
    this._writeMask = value;
    this._dirty = true;
  }
  get writeMask() {
    return this._writeMask;
  }
  constructor(options = {}) {
    var _options$func, _options$ref, _options$readMask, _options$writeMask, _options$fail, _options$zfail, _options$zpass;
    this._func = void 0;
    this._ref = void 0;
    this._fail = void 0;
    this._zfail = void 0;
    this._zpass = void 0;
    this._readMask = void 0;
    this._writeMask = void 0;
    this._dirty = true;
    this._key = void 0;
    this._func = (_options$func = options.func) != null ? _options$func : FUNC_ALWAYS;
    this._ref = (_options$ref = options.ref) != null ? _options$ref : 0;
    this._readMask = (_options$readMask = options.readMask) != null ? _options$readMask : 0xFF;
    this._writeMask = (_options$writeMask = options.writeMask) != null ? _options$writeMask : 0xFF;
    this._fail = (_options$fail = options.fail) != null ? _options$fail : STENCILOP_KEEP;
    this._zfail = (_options$zfail = options.zfail) != null ? _options$zfail : STENCILOP_KEEP;
    this._zpass = (_options$zpass = options.zpass) != null ? _options$zpass : STENCILOP_KEEP;
    this._evalKey();
  }
  _evalKey() {
    const {
      _func,
      _ref,
      _fail,
      _zfail,
      _zpass,
      _readMask,
      _writeMask
    } = this;
    const key = `${_func},${_ref},${_fail},${_zfail},${_zpass},${_readMask},${_writeMask}`;
    this._key = stringIds.get(key);
    this._dirty = false;
  }
  get key() {
    if (this._dirty) {
      this._evalKey();
    }
    return this._key;
  }
  copy(rhs) {
    this._func = rhs._func;
    this._ref = rhs._ref;
    this._readMask = rhs._readMask;
    this._writeMask = rhs._writeMask;
    this._fail = rhs._fail;
    this._zfail = rhs._zfail;
    this._zpass = rhs._zpass;
    this._dirty = rhs._dirty;
    this._key = rhs._key;
    return this;
  }
  clone() {
    const clone = new this.constructor();
    return clone.copy(this);
  }
}
_StencilParameters = StencilParameters;
StencilParameters.DEFAULT = Object.freeze(new _StencilParameters());

export { StencilParameters };
