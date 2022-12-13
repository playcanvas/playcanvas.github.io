/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var clearCoatGlossPS = `
#ifdef MAPFLOAT
uniform float material_clearCoatGlossiness;
#endif

void getClearCoatGlossiness() {
    ccGlossiness = 1.0;

    #ifdef MAPFLOAT
    ccGlossiness *= material_clearCoatGlossiness;
    #endif

    #ifdef MAPTEXTURE
    ccGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    ccGlossiness *= saturate(vVertexColor.$VC);
    #endif

    ccGlossiness += 0.0000001;
}
`;

export { clearCoatGlossPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xlYXJDb2F0R2xvc3MuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2NsZWFyQ29hdEdsb3NzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTUFQRkxPQVRcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfY2xlYXJDb2F0R2xvc3NpbmVzcztcbiNlbmRpZlxuXG52b2lkIGdldENsZWFyQ29hdEdsb3NzaW5lc3MoKSB7XG4gICAgY2NHbG9zc2luZXNzID0gMS4wO1xuXG4gICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgY2NHbG9zc2luZXNzICo9IG1hdGVyaWFsX2NsZWFyQ29hdEdsb3NzaW5lc3M7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgIGNjR2xvc3NpbmVzcyAqPSB0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgY2NHbG9zc2luZXNzICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICNlbmRpZlxuXG4gICAgY2NHbG9zc2luZXNzICs9IDAuMDAwMDAwMTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
