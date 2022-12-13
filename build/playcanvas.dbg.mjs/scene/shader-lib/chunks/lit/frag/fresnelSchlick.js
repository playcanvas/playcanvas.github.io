/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fresnelSchlickPS = `
// Schlick's approximation
vec3 getFresnel(float cosTheta, vec3 f0) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    float glossSq = dGlossiness * dGlossiness;
    vec3 ret = f0 + (max(vec3(glossSq), f0) - f0) * fresnel;
    #ifdef LIT_IRIDESCENCE
        return mix(ret, dIridescenceFresnel, vec3(dIridescence));
    #else
        return ret;
    #endif    
}

float getFresnelCC(float cosTheta) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;

export { fresnelSchlickPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJlc25lbFNjaGxpY2suanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9mcmVzbmVsU2NobGljay5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gU2NobGljaydzIGFwcHJveGltYXRpb25cbnZlYzMgZ2V0RnJlc25lbChmbG9hdCBjb3NUaGV0YSwgdmVjMyBmMCkge1xuICAgIGZsb2F0IGZyZXNuZWwgPSBwb3coMS4wIC0gbWF4KGNvc1RoZXRhLCAwLjApLCA1LjApO1xuICAgIGZsb2F0IGdsb3NzU3EgPSBkR2xvc3NpbmVzcyAqIGRHbG9zc2luZXNzO1xuICAgIHZlYzMgcmV0ID0gZjAgKyAobWF4KHZlYzMoZ2xvc3NTcSksIGYwKSAtIGYwKSAqIGZyZXNuZWw7XG4gICAgI2lmZGVmIExJVF9JUklERVNDRU5DRVxuICAgICAgICByZXR1cm4gbWl4KHJldCwgZElyaWRlc2NlbmNlRnJlc25lbCwgdmVjMyhkSXJpZGVzY2VuY2UpKTtcbiAgICAjZWxzZVxuICAgICAgICByZXR1cm4gcmV0O1xuICAgICNlbmRpZiAgICBcbn1cblxuZmxvYXQgZ2V0RnJlc25lbENDKGZsb2F0IGNvc1RoZXRhKSB7XG4gICAgZmxvYXQgZnJlc25lbCA9IHBvdygxLjAgLSBtYXgoY29zVGhldGEsIDAuMCksIDUuMCk7XG4gICAgcmV0dXJuIDAuMDQgKyAoMS4wIC0gMC4wNCkgKiBmcmVzbmVsO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHVCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
