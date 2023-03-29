/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fresnelSchlickPS = `
// Schlick's approximation
vec3 getFresnel(float cosTheta, vec3 f0) {
    float fresnel = pow(1.0 - abs(cosTheta), 5.0);
    float glossSq = dGlossiness * dGlossiness;
    vec3 ret = f0 + (max(vec3(glossSq), f0) - f0) * fresnel;
    #ifdef LIT_IRIDESCENCE
        return mix(ret, dIridescenceFresnel, vec3(dIridescence));
    #else
        return ret;
    #endif    
}

float getFresnelCC(float cosTheta, float glossiness) {
    float fresnel = pow(1.0 - abs(cosTheta), 5.0);
    float glossSq = glossiness * glossiness;
    const float f0 = 0.04;
    return f0 + (max(glossSq, f0) - f0) * fresnel;
}
`;

export { fresnelSchlickPS as default };
