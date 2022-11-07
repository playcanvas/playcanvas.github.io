/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tYmluZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2NvbWJpbmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZlYzMgY29tYmluZUNvbG9yKCkge1xuICAgIHZlYzMgcmV0ID0gdmVjMygwKTtcbiNpZmRlZiBMSVRfT0xEX0FNQklFTlRcbiAgICByZXQgKz0gKGREaWZmdXNlTGlnaHQgLSBsaWdodF9nbG9iYWxBbWJpZW50KSAqIGRBbGJlZG8gKyBtYXRlcmlhbF9hbWJpZW50ICogbGlnaHRfZ2xvYmFsQW1iaWVudDtcbiNlbHNlXG4gICAgcmV0ICs9IGRBbGJlZG8gKiBkRGlmZnVzZUxpZ2h0O1xuI2VuZGlmXG4jaWZkZWYgTElUX1NQRUNVTEFSXG4gICAgcmV0ICs9IGRTcGVjdWxhckxpZ2h0O1xuI2VuZGlmXG4jaWZkZWYgTElUX1JFRkxFQ1RJT05TXG4gICAgcmV0ICs9IGRSZWZsZWN0aW9uLnJnYiAqIGRSZWZsZWN0aW9uLmE7XG4jZW5kaWZcblxuI2lmZGVmIExJVF9TSEVFTlxuICAgIGZsb2F0IHNoZWVuU2NhbGluZyA9IDEuMCAtIG1heChtYXgoc1NwZWN1bGFyaXR5LnIsIHNTcGVjdWxhcml0eS5nKSwgc1NwZWN1bGFyaXR5LmIpICogMC4xNTc7XG4gICAgcmV0ID0gcmV0ICogc2hlZW5TY2FsaW5nICsgKHNTcGVjdWxhckxpZ2h0ICsgc1JlZmxlY3Rpb24ucmdiKSAqIHNTcGVjdWxhcml0eTtcbiNlbmRpZlxuI2lmZGVmIExJVF9DTEVBUkNPQVRcbiAgICBmbG9hdCBjbGVhckNvYXRTY2FsaW5nID0gMS4wIC0gY2NGcmVzbmVsICogY2NTcGVjdWxhcml0eTtcbiAgICByZXQgPSByZXQgKiBjbGVhckNvYXRTY2FsaW5nICsgKGNjU3BlY3VsYXJMaWdodCArIGNjUmVmbGVjdGlvbi5yZ2IpICogY2NTcGVjdWxhcml0eTtcbiNlbmRpZlxuXG4gICAgcmV0dXJuIHJldDtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
