/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowVSM8PS = `
float calculateVSM8(vec3 moments, float Z, float vsmBias) {
    float VSMBias = vsmBias;//0.01 * 0.25;
    float depthScale = VSMBias * Z;
    float minVariance1 = depthScale * depthScale;
    return chebyshevUpperBound(moments.xy, Z, minVariance1, 0.1);
}

float decodeFloatRG(vec2 rg) {
    return rg.y*(1.0/255.0) + rg.x;
}

float VSM8(sampler2D tex, vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
    vec4 c = texture2D(tex, texCoords);
    vec3 moments = vec3(decodeFloatRG(c.xy), decodeFloatRG(c.zw), 0.0);
    return calculateVSM8(moments, Z, vsmBias);
}

float getShadowVSM8(sampler2D shadowMap, vec3 shadowParams, float exponent) {
    return VSM8(shadowMap, dShadowCoord.xy, shadowParams.x, dShadowCoord.z, shadowParams.y, 0.0);
}

float getShadowSpotVSM8(sampler2D shadowMap, vec4 shadowParams, float exponent) {
    return VSM8(shadowMap, dShadowCoord.xy, shadowParams.x, length(dLightDirW) * shadowParams.w + shadowParams.z, shadowParams.y, 0.0);
}
`;

export { shadowVSM8PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93VlNNOC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dWU004LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBjYWxjdWxhdGVWU004KHZlYzMgbW9tZW50cywgZmxvYXQgWiwgZmxvYXQgdnNtQmlhcykge1xuICAgIGZsb2F0IFZTTUJpYXMgPSB2c21CaWFzOy8vMC4wMSAqIDAuMjU7XG4gICAgZmxvYXQgZGVwdGhTY2FsZSA9IFZTTUJpYXMgKiBaO1xuICAgIGZsb2F0IG1pblZhcmlhbmNlMSA9IGRlcHRoU2NhbGUgKiBkZXB0aFNjYWxlO1xuICAgIHJldHVybiBjaGVieXNoZXZVcHBlckJvdW5kKG1vbWVudHMueHksIFosIG1pblZhcmlhbmNlMSwgMC4xKTtcbn1cblxuZmxvYXQgZGVjb2RlRmxvYXRSRyh2ZWMyIHJnKSB7XG4gICAgcmV0dXJuIHJnLnkqKDEuMC8yNTUuMCkgKyByZy54O1xufVxuXG5mbG9hdCBWU004KHNhbXBsZXIyRCB0ZXgsIHZlYzIgdGV4Q29vcmRzLCBmbG9hdCByZXNvbHV0aW9uLCBmbG9hdCBaLCBmbG9hdCB2c21CaWFzLCBmbG9hdCBleHBvbmVudCkge1xuICAgIHZlYzQgYyA9IHRleHR1cmUyRCh0ZXgsIHRleENvb3Jkcyk7XG4gICAgdmVjMyBtb21lbnRzID0gdmVjMyhkZWNvZGVGbG9hdFJHKGMueHkpLCBkZWNvZGVGbG9hdFJHKGMuencpLCAwLjApO1xuICAgIHJldHVybiBjYWxjdWxhdGVWU004KG1vbWVudHMsIFosIHZzbUJpYXMpO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dWU004KHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93UGFyYW1zLCBmbG9hdCBleHBvbmVudCkge1xuICAgIHJldHVybiBWU004KHNoYWRvd01hcCwgZFNoYWRvd0Nvb3JkLnh5LCBzaGFkb3dQYXJhbXMueCwgZFNoYWRvd0Nvb3JkLnosIHNoYWRvd1BhcmFtcy55LCAwLjApO1xufVxuXG5mbG9hdCBnZXRTaGFkb3dTcG90VlNNOChzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcywgZmxvYXQgZXhwb25lbnQpIHtcbiAgICByZXR1cm4gVlNNOChzaGFkb3dNYXAsIGRTaGFkb3dDb29yZC54eSwgc2hhZG93UGFyYW1zLngsIGxlbmd0aChkTGlnaHREaXJXKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLnosIHNoYWRvd1BhcmFtcy55LCAwLjApO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1CQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBekJBOzs7OyJ9
