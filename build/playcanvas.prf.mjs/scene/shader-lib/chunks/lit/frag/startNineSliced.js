/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var startNineSlicedPS = `
    nineSlicedUv = vUv0;
    nineSlicedUv.y = 1.0 - nineSlicedUv.y;

`;

export { startNineSlicedPS as default };
