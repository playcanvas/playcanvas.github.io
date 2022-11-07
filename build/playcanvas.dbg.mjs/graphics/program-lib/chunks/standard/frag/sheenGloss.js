/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var sheenGlossPS = `
#ifdef MAPFLOAT
uniform float material_sheenGlossiness;
#endif

void getSheenGlossiness() {
    float sheenGlossiness = 1.0;

    #ifdef MAPFLOAT
    sheenGlossiness *= material_sheenGlossiness;
    #endif

    #ifdef MAPTEXTURE
    sheenGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenGlossiness *= saturate(vVertexColor.$VC);
    #endif

    sheenGlossiness += 0.0000001;
    sGlossiness = sheenGlossiness;
}
`;

export { sheenGlossPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hlZW5HbG9zcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL3NoZWVuR2xvc3MuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBGTE9BVFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9zaGVlbkdsb3NzaW5lc3M7XG4jZW5kaWZcblxudm9pZCBnZXRTaGVlbkdsb3NzaW5lc3MoKSB7XG4gICAgZmxvYXQgc2hlZW5HbG9zc2luZXNzID0gMS4wO1xuXG4gICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgc2hlZW5HbG9zc2luZXNzICo9IG1hdGVyaWFsX3NoZWVuR2xvc3NpbmVzcztcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgc2hlZW5HbG9zc2luZXNzICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICBzaGVlbkdsb3NzaW5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgI2VuZGlmXG5cbiAgICBzaGVlbkdsb3NzaW5lc3MgKz0gMC4wMDAwMDAxO1xuICAgIHNHbG9zc2luZXNzID0gc2hlZW5HbG9zc2luZXNzO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1CQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0F2QkE7Ozs7In0=
