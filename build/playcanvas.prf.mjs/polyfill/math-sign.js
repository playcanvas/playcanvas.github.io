/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
if (!Math.sign) {
	Math.sign = function (x) {
		return (x > 0) - (x < 0) || +x;
	};
}
