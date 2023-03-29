/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var baseNineSlicedVS = /* glsl */`
#define NINESLICED

varying vec2 vMask;
varying vec2 vTiledUv;

uniform mediump vec4 innerOffset;
uniform mediump vec2 outerScale;
uniform mediump vec4 atlasRect;
`;

export { baseNineSlicedVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZU5pbmVTbGljZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvdmVydC9iYXNlTmluZVNsaWNlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2RlZmluZSBOSU5FU0xJQ0VEXG5cbnZhcnlpbmcgdmVjMiB2TWFzaztcbnZhcnlpbmcgdmVjMiB2VGlsZWRVdjtcblxudW5pZm9ybSBtZWRpdW1wIHZlYzQgaW5uZXJPZmZzZXQ7XG51bmlmb3JtIG1lZGl1bXAgdmVjMiBvdXRlclNjYWxlO1xudW5pZm9ybSBtZWRpdW1wIHZlYzQgYXRsYXNSZWN0O1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHVCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
