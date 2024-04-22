import { BitPacking } from '../../core/math/bit-packing.js';
import { StringIds } from '../../core/string-ids.js';
import { FUNC_LESSEQUAL, FUNC_ALWAYS } from './constants.js';

var _DepthState;
const stringIds = new StringIds();
const funcMask = 0b111;
const funcShift = 0;
const writeShift = 3;
class DepthState {
  constructor(func = FUNC_LESSEQUAL, write = true) {
    this.data = 0;
    this._depthBias = 0;
    this._depthBiasSlope = 0;
    this.key = 0;
    this.func = func;
    this.write = write;
  }
  set test(value) {
    this.func = value ? FUNC_LESSEQUAL : FUNC_ALWAYS;
    this.updateKey();
  }
  get test() {
    return this.func !== FUNC_ALWAYS;
  }
  set write(value) {
    this.data = BitPacking.set(this.data, value ? 1 : 0, writeShift);
    this.updateKey();
  }
  get write() {
    return BitPacking.all(this.data, writeShift);
  }
  set func(value) {
    this.data = BitPacking.set(this.data, value, funcShift, funcMask);
    this.updateKey();
  }
  get func() {
    return BitPacking.get(this.data, funcShift, funcMask);
  }
  set depthBias(value) {
    this._depthBias = value;
    this.updateKey();
  }
  get depthBias() {
    return this._depthBias;
  }
  set depthBiasSlope(value) {
    this._depthBiasSlope = value;
    this.updateKey();
  }
  get depthBiasSlope() {
    return this._depthBiasSlope;
  }
  copy(rhs) {
    this.data = rhs.data;
    this._depthBias = rhs._depthBias;
    this._depthBiasSlope = rhs._depthBiasSlope;
    this.key = rhs.key;
    return this;
  }
  clone() {
    const clone = new this.constructor();
    return clone.copy(this);
  }
  updateKey() {
    const {
      data,
      _depthBias,
      _depthBiasSlope
    } = this;
    const key = `${data}-${_depthBias}-${_depthBiasSlope}`;
    this.key = stringIds.get(key);
  }
  equals(rhs) {
    return this.key === rhs.key;
  }
}
_DepthState = DepthState;
DepthState.DEFAULT = Object.freeze(new _DepthState());
DepthState.NODEPTH = Object.freeze(new _DepthState(FUNC_ALWAYS, false));
DepthState.WRITEDEPTH = Object.freeze(new _DepthState(FUNC_ALWAYS, true));

export { DepthState };
