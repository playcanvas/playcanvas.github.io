import { math } from '../../../core/math/math.js';
import { INTERPOLATION_STEP, INTERPOLATION_CUBIC, INTERPOLATION_LINEAR } from '../constants.js';

class AnimCache {
	constructor() {
		this._left = Infinity;
		this._right = -Infinity;
		this._len = 0;
		this._recip = 0;
		this._p0 = 0;
		this._p1 = 0;
		this._t = 0;
		this._hermite = {
			valid: false,
			p0: 0,
			m0: 0,
			p1: 0,
			m1: 0
		};
	}
	update(time, input) {
		if (time < this._left || time >= this._right) {
			const len = input.length;
			if (!len) {
				this._left = -Infinity;
				this._right = Infinity;
				this._len = 0;
				this._recip = 0;
				this._p0 = this._p1 = 0;
			} else {
				if (time < input[0]) {
					this._left = -Infinity;
					this._right = input[0];
					this._len = 0;
					this._recip = 0;
					this._p0 = this._p1 = 0;
				} else if (time >= input[len - 1]) {
					this._left = input[len - 1];
					this._right = Infinity;
					this._len = 0;
					this._recip = 0;
					this._p0 = this._p1 = len - 1;
				} else {
					const index = this._findKey(time, input);
					this._left = input[index];
					this._right = input[index + 1];
					this._len = this._right - this._left;
					const diff = 1.0 / this._len;
					this._recip = isFinite(diff) ? diff : 0;
					this._p0 = index;
					this._p1 = index + 1;
				}
			}
		}
		this._t = this._recip === 0 ? 0 : (time - this._left) * this._recip;
		this._hermite.valid = false;
	}
	_findKey(time, input) {
		let index = 0;
		while (time >= input[index + 1]) {
			index++;
		}
		return index;
	}
	eval(result, interpolation, output) {
		const data = output._data;
		const comp = output._components;
		const idx0 = this._p0 * comp;
		if (interpolation === INTERPOLATION_STEP) {
			for (let i = 0; i < comp; ++i) {
				result[i] = data[idx0 + i];
			}
		} else {
			const t = this._t;
			const idx1 = this._p1 * comp;
			switch (interpolation) {
				case INTERPOLATION_LINEAR:
					for (let i = 0; i < comp; ++i) {
						result[i] = math.lerp(data[idx0 + i], data[idx1 + i], t);
					}
					break;
				case INTERPOLATION_CUBIC:
					{
						const hermite = this._hermite;
						if (!hermite.valid) {
							const t2 = t * t;
							const twot = t + t;
							const omt = 1 - t;
							const omt2 = omt * omt;
							hermite.valid = true;
							hermite.p0 = (1 + twot) * omt2;
							hermite.m0 = t * omt2;
							hermite.p1 = t2 * (3 - twot);
							hermite.m1 = t2 * (t - 1);
						}
						const p0 = (this._p0 * 3 + 1) * comp;
						const m0 = (this._p0 * 3 + 2) * comp;
						const p1 = (this._p1 * 3 + 1) * comp;
						const m1 = (this._p1 * 3 + 0) * comp;
						for (let i = 0; i < comp; ++i) {
							result[i] = hermite.p0 * data[p0 + i] + hermite.m0 * data[m0 + i] * this._len + hermite.p1 * data[p1 + i] + hermite.m1 * data[m1 + i] * this._len;
						}
						break;
					}
			}
		}
	}
}

export { AnimCache };
