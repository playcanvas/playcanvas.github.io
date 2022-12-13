/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var baseNineSlicedPS = `
#define NINESLICED

varying vec2 vMask;
varying vec2 vTiledUv;

uniform mediump vec4 innerOffset;
uniform mediump vec2 outerScale;
uniform mediump vec4 atlasRect;

vec2 nineSlicedUv;
`;

export { baseNineSlicedPS as default };
