/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
const BitPacking = {
	set: function (storage, value, shift, mask = 1) {
		const data = storage & ~(mask << shift);
		return data | value << shift;
	},
	get: function (storage, shift, mask = 1) {
		return storage >> shift & mask;
	},
	all: function (storage, shift, mask = 1) {
		const shifted = mask << shift;
		return (storage & shifted) === shifted;
	},
	any: function (storage, shift, mask = 1) {
		return (storage & mask << shift) !== 0;
	}
};

export { BitPacking };
