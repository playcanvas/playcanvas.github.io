/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightmapSinglePS = `
void getLightMap() {
    dLightmap = vec3(1.0);

    #ifdef MAPTEXTURE
    dLightmap *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    dLightmap *= saturate(vVertexColor.$VC);
    #endif
}
`;

export { lightmapSinglePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRtYXBTaW5nbGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9saWdodG1hcFNpbmdsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBnZXRMaWdodE1hcCgpIHtcbiAgICBkTGlnaHRtYXAgPSB2ZWMzKDEuMCk7XG5cbiAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgIGRMaWdodG1hcCAqPSAkREVDT0RFKHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpKS4kQ0g7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgZExpZ2h0bWFwICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHVCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVpBOzs7OyJ9
