/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var baseNineSlicedTiledPS = `
#define NINESLICED
#define NINESLICETILED

varying vec2 vMask;
varying vec2 vTiledUv;

uniform mediump vec4 innerOffset;
uniform mediump vec2 outerScale;
uniform mediump vec4 atlasRect;

vec2 nineSlicedUv;
`;

export { baseNineSlicedTiledPS as default };
