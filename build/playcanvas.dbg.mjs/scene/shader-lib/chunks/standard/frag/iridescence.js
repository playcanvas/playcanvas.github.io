/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var iridescencePS = `
#ifdef MAPFLOAT
uniform float material_iridescence;
#endif

void getIridescence() {
    float iridescence = 1.0;

    #ifdef MAPFLOAT
    iridescence *= material_iridescence;
    #endif

    #ifdef MAPTEXTURE
    iridescence *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    dIridescence = iridescence; 
}
`;

export { iridescencePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXJpZGVzY2VuY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2lyaWRlc2NlbmNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTUFQRkxPQVRcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfaXJpZGVzY2VuY2U7XG4jZW5kaWZcblxudm9pZCBnZXRJcmlkZXNjZW5jZSgpIHtcbiAgICBmbG9hdCBpcmlkZXNjZW5jZSA9IDEuMDtcblxuICAgICNpZmRlZiBNQVBGTE9BVFxuICAgIGlyaWRlc2NlbmNlICo9IG1hdGVyaWFsX2lyaWRlc2NlbmNlO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICBpcmlkZXNjZW5jZSAqPSB0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgI2VuZGlmXG5cbiAgICBkSXJpZGVzY2VuY2UgPSBpcmlkZXNjZW5jZTsgXG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsb0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
