/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
Object.values = Object.values || function (object) {
	return Object.keys(object).map(key => object[key]);
};
