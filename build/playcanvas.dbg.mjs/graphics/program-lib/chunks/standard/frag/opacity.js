/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var opacityPS = `
#ifdef MAPFLOAT
uniform float material_opacity;
#endif

void getOpacity() {
    dAlpha = 1.0;

    #ifdef MAPFLOAT
    dAlpha *= material_opacity;
    #endif

    #ifdef MAPTEXTURE
    dAlpha *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dAlpha *= clamp(vVertexColor.$VC, 0.0, 1.0);
    #endif
}
`;

export { opacityPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BhY2l0eS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL29wYWNpdHkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBGTE9BVFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9vcGFjaXR5O1xuI2VuZGlmXG5cbnZvaWQgZ2V0T3BhY2l0eSgpIHtcbiAgICBkQWxwaGEgPSAxLjA7XG5cbiAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICBkQWxwaGEgKj0gbWF0ZXJpYWxfb3BhY2l0eTtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgZEFscGhhICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICBkQWxwaGEgKj0gY2xhbXAodlZlcnRleENvbG9yLiRWQywgMC4wLCAxLjApO1xuICAgICNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGdCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FwQkE7Ozs7In0=
