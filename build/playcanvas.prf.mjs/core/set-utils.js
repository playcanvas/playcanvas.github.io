/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
const set = {
	equals: function (set1, set2) {
		if (set1.size !== set2.size) {
			return false;
		}
		for (const item of set1) {
			if (!set2.has(item)) {
				return false;
			}
		}
		return true;
	}
};

export { set };
