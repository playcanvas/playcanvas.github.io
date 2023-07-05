/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var startNineSlicedPS = `
    nineSlicedUv = vUv0;
    nineSlicedUv.y = 1.0 - nineSlicedUv.y;

`;

export { startNineSlicedPS as default };
