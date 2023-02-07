/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
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
