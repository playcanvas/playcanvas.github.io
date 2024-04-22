import { FUNC_ALWAYS, STENCILOP_KEEP } from './constants.js';
import { StringIds } from '../../core/string-ids.js';

var _StencilParameters;
const stringIds = new StringIds();

/**
 * Holds stencil test settings.
 *
 * @category Graphics
 */
class StencilParameters {
  /**
   * A comparison function that decides if the pixel should be written, based on the current
   * stencil buffer value, reference value, and mask value. Can be:
   *
   * - {@link FUNC_NEVER}: never pass
   * - {@link FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
   * - {@link FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
   * - {@link FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
   * - {@link FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
   * - {@link FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
   * - {@link FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
   * - {@link FUNC_ALWAYS}: always pass
   *
   * @type {number}
   */
  set func(value) {
    this._func = value;
    this._dirty = true;
  }
  get func() {
    return this._func;
  }

  /**
   * Sets stencil test reference value used in comparisons.
   *
   * @type {number}
   */
  set ref(value) {
    this._ref = value;
    this._dirty = true;
  }
  get ref() {
    return this._ref;
  }

  /**
   * Operation to perform if stencil test is failed. Can be:
   *
   * - {@link STENCILOP_KEEP}: don't change the stencil buffer value
   * - {@link STENCILOP_ZERO}: set value to zero
   * - {@link STENCILOP_REPLACE}: replace value with the reference value.
   * - {@link STENCILOP_INCREMENT}: increment the value
   * - {@link STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger
   * than a maximum representable value
   * - {@link STENCILOP_DECREMENT}: decrement the value
   * - {@link STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum
   * representable value, if the current value is 0
   * - {@link STENCILOP_INVERT}: invert the value bitwise
   *
   * @type {number}
   */
  set fail(value) {
    this._fail = value;
    this._dirty = true;
  }
  get fail() {
    return this._fail;
  }

  /**
   * Operation to perform if depth test is failed. Accepts the same values as `fail`.
   *
   * @type {number}
   */
  set zfail(value) {
    this._zfail = value;
    this._dirty = true;
  }
  get zfail() {
    return this._zfail;
  }

  /**
   * Operation to perform if both stencil and depth test are passed. Accepts the same values as
   * `fail`.
   *
   * @type {number}
   */
  set zpass(value) {
    this._zpass = value;
    this._dirty = true;
  }
  get zpass() {
    return this._zpass;
  }

  /**
   * Mask applied to stencil buffer value and reference value before comparison.
   *
   * @type {number}
   */
  set readMask(value) {
    this._readMask = value;
    this._dirty = true;
  }
  get readMask() {
    return this._readMask;
  }

  /**
   * A bit mask applied to the stencil value, when written.
   *
   * @type {number}
   */
  set writeMask(value) {
    this._writeMask = value;
    this._dirty = true;
  }
  get writeMask() {
    return this._writeMask;
  }

  /**
   * Create a new StencilParameters instance.
   *
   * @param {object} [options] - Options object to configure the stencil parameters.
   */
  constructor(options = {}) {
    var _options$func, _options$ref, _options$readMask, _options$writeMask, _options$fail, _options$zfail, _options$zpass;
    /**
     * @type {number}
     * @private
     */
    this._func = void 0;
    /**
     * @type {number}
     * @private
     */
    this._ref = void 0;
    /**
     * @type {number}
     * @private
     */
    this._fail = void 0;
    /**
     * @type {number}
     * @private
     */
    this._zfail = void 0;
    /**
     * @type {number}
     * @private
     */
    this._zpass = void 0;
    /**
     * @type {number}
     * @private
     */
    this._readMask = void 0;
    /**
     * @type {number}
     * @private
     */
    this._writeMask = void 0;
    /**
     * @type {boolean}
     * @private
     */
    this._dirty = true;
    /**
     * @type {number}
     * @private
     */
    this._key = void 0;
    this._func = (_options$func = options.func) != null ? _options$func : FUNC_ALWAYS;
    this._ref = (_options$ref = options.ref) != null ? _options$ref : 0;
    this._readMask = (_options$readMask = options.readMask) != null ? _options$readMask : 0xFF;
    this._writeMask = (_options$writeMask = options.writeMask) != null ? _options$writeMask : 0xFF;
    this._fail = (_options$fail = options.fail) != null ? _options$fail : STENCILOP_KEEP; // keep == 0
    this._zfail = (_options$zfail = options.zfail) != null ? _options$zfail : STENCILOP_KEEP;
    this._zpass = (_options$zpass = options.zpass) != null ? _options$zpass : STENCILOP_KEEP;

    // Evaluate key here. This evaluates the key for the DEFAULT instance, which is important,
    // as during rendering it gets copied and the key would get evaluated each time.
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

  /**
   * Copies the contents of a source stencil parameters to this stencil parameters.
   *
   * @param {StencilParameters} rhs - A stencil parameters to copy from.
   * @returns {StencilParameters} Self for chaining.
   */
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

  /**
   * Clone the stencil parameters.
   *
   * @returns {StencilParameters} A cloned StencilParameters object.
   */
  clone() {
    const clone = new this.constructor();
    return clone.copy(this);
  }

  /**
   * A default stencil state.
   *
   * @type {StencilParameters}
   * @readonly
   */
}
_StencilParameters = StencilParameters;
StencilParameters.DEFAULT = Object.freeze(new _StencilParameters());

export { StencilParameters };
