/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var combinePS = `
vec3 combineColor() {
    vec3 ret = vec3(0);
#ifdef LIT_OLD_AMBIENT
    ret += (dDiffuseLight - light_globalAmbient) * dAlbedo + material_ambient * light_globalAmbient;
#else
    ret += dAlbedo * dDiffuseLight;
#endif
#ifdef LIT_SPECULAR
    ret += dSpecularLight;
#endif
#ifdef LIT_REFLECTIONS
    ret += dReflection.rgb * dReflection.a;
#endif

#ifdef LIT_SHEEN
    float sheenScaling = 1.0 - max(max(sSpecularity.r, sSpecularity.g), sSpecularity.b) * 0.157;
    ret = ret * sheenScaling + (sSpecularLight + sReflection.rgb) * sSpecularity;
#endif
#ifdef LIT_CLEARCOAT
    float clearCoatScaling = 1.0 - ccFresnel * ccSpecularity;
    ret = ret * clearCoatScaling + (ccSpecularLight + ccReflection.rgb) * ccSpecularity;
#endif

    return ret;
}
`;

export { combinePS as default };
