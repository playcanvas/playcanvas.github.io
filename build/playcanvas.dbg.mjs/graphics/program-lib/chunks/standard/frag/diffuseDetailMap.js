/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var diffuseDetailMapPS = `
vec3 addAlbedoDetail(vec3 albedo) {
#ifdef MAPTEXTURE
    vec3 albedoDetail = $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    return detailMode_$DETAILMODE(albedo, albedoDetail);
#else
    return albedo;
#endif
}
`;

export { diffuseDetailMapPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZnVzZURldGFpbE1hcC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2RpZmZ1c2VEZXRhaWxNYXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZlYzMgYWRkQWxiZWRvRGV0YWlsKHZlYzMgYWxiZWRvKSB7XG4jaWZkZWYgTUFQVEVYVFVSRVxuICAgIHZlYzMgYWxiZWRvRGV0YWlsID0gJERFQ09ERSh0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKSkuJENIO1xuICAgIHJldHVybiBkZXRhaWxNb2RlXyRERVRBSUxNT0RFKGFsYmVkbywgYWxiZWRvRGV0YWlsKTtcbiNlbHNlXG4gICAgcmV0dXJuIGFsYmVkbztcbiNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHlCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVRBOzs7OyJ9
