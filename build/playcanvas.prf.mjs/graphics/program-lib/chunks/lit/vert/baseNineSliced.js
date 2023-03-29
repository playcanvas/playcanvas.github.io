/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var baseNineSlicedVS = `
#define NINESLICED

varying vec2 vMask;
varying vec2 vTiledUv;

uniform mediump vec4 innerOffset;
uniform mediump vec2 outerScale;
uniform mediump vec4 atlasRect;
`;

export { baseNineSlicedVS as default };
