/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
function defineProtoFunc(cls, name, func) {
	if (!cls.prototype[name]) {
		Object.defineProperty(cls.prototype, name, {
			value: func,
			configurable: true,
			enumerable: false,
			writable: true
		});
	}
}

export { defineProtoFunc };
