/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var startNineSlicedPS = `
		nineSlicedUv = vUv0;
		nineSlicedUv.y = 1.0 - nineSlicedUv.y;

`;

export { startNineSlicedPS as default };
