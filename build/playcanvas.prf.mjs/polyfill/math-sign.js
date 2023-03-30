/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
if (!Math.sign) {
	Math.sign = function (x) {
		return (x > 0) - (x < 0) || +x;
	};
}
