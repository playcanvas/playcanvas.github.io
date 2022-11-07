/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var metalnessPS = `
#ifdef MAPFLOAT
uniform float material_metalness;
#endif

void getMetalness() {
    float metalness = 1.0;

    #ifdef MAPFLOAT
    metalness *= material_metalness;
    #endif

    #ifdef MAPTEXTURE
    metalness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    metalness *= saturate(vVertexColor.$VC);
    #endif

    dMetalness = metalness;
}
`;

export { metalnessPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWxuZXNzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9tZXRhbG5lc3MuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBGTE9BVFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9tZXRhbG5lc3M7XG4jZW5kaWZcblxudm9pZCBnZXRNZXRhbG5lc3MoKSB7XG4gICAgZmxvYXQgbWV0YWxuZXNzID0gMS4wO1xuXG4gICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgbWV0YWxuZXNzICo9IG1hdGVyaWFsX21ldGFsbmVzcztcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgbWV0YWxuZXNzICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICBtZXRhbG5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgI2VuZGlmXG5cbiAgICBkTWV0YWxuZXNzID0gbWV0YWxuZXNzO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
