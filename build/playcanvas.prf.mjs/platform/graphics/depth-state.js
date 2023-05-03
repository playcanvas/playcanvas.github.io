import { BitPacking } from '../../core/math/bit-packing.js';
import { FUNC_ALWAYS, FUNC_LESSEQUAL } from './constants.js';

const funcMask = 0b111;
const funcShift = 0;
const writeShift = 3;
class DepthState {
	constructor(func = FUNC_LESSEQUAL, write = true) {
		this.data = 0;
		this.func = func;
		this.write = write;
	}
	set test(value) {
		this.func = value ? FUNC_LESSEQUAL : FUNC_ALWAYS;
	}
	get test() {
		return this.func !== FUNC_ALWAYS;
	}
	set write(value) {
		this.data = BitPacking.set(this.data, value ? 1 : 0, writeShift);
	}
	get write() {
		return BitPacking.all(this.data, writeShift);
	}
	set func(value) {
		this.data = BitPacking.set(this.data, value, funcShift, funcMask);
	}
	get func() {
		return BitPacking.get(this.data, funcShift, funcMask);
	}
	copy(rhs) {
		this.data = rhs.data;
		return this;
	}
	clone() {
		const clone = new this.constructor();
		return clone.copy(this);
	}
	get key() {
		return this.data;
	}
	equals(rhs) {
		return this.data === rhs.data;
	}
}
DepthState.DEFAULT = Object.freeze(new DepthState());
DepthState.NODEPTH = Object.freeze(new DepthState(FUNC_ALWAYS, false));
DepthState.WRITEDEPTH = Object.freeze(new DepthState(FUNC_ALWAYS, true));

export { DepthState };
