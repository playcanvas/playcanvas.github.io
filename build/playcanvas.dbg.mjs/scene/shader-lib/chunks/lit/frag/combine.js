/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var combinePS = /* glsl */`
vec3 combineColor(vec3 albedo, vec3 sheenSpecularity, float clearcoatSpecularity) {
    vec3 ret = vec3(0);
#ifdef LIT_OLD_AMBIENT
    ret += (dDiffuseLight - light_globalAmbient) * albedo + material_ambient * light_globalAmbient;
#else
    ret += albedo * dDiffuseLight;
#endif
#ifdef LIT_SPECULAR
    ret += dSpecularLight;
#endif
#ifdef LIT_REFLECTIONS
    ret += dReflection.rgb * dReflection.a;
#endif

#ifdef LIT_SHEEN
    float sheenScaling = 1.0 - max(max(sheenSpecularity.r, sheenSpecularity.g), sheenSpecularity.b) * 0.157;
    ret = ret * sheenScaling + (sSpecularLight + sReflection.rgb) * sheenSpecularity;
#endif
#ifdef LIT_CLEARCOAT
    float clearCoatScaling = 1.0 - ccFresnel * clearcoatSpecularity;
    ret = ret * clearCoatScaling + (ccSpecularLight + ccReflection.rgb) * clearcoatSpecularity;
#endif

    return ret;
}
`;

export { combinePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tYmluZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2NvbWJpbmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZlYzMgY29tYmluZUNvbG9yKHZlYzMgYWxiZWRvLCB2ZWMzIHNoZWVuU3BlY3VsYXJpdHksIGZsb2F0IGNsZWFyY29hdFNwZWN1bGFyaXR5KSB7XG4gICAgdmVjMyByZXQgPSB2ZWMzKDApO1xuI2lmZGVmIExJVF9PTERfQU1CSUVOVFxuICAgIHJldCArPSAoZERpZmZ1c2VMaWdodCAtIGxpZ2h0X2dsb2JhbEFtYmllbnQpICogYWxiZWRvICsgbWF0ZXJpYWxfYW1iaWVudCAqIGxpZ2h0X2dsb2JhbEFtYmllbnQ7XG4jZWxzZVxuICAgIHJldCArPSBhbGJlZG8gKiBkRGlmZnVzZUxpZ2h0O1xuI2VuZGlmXG4jaWZkZWYgTElUX1NQRUNVTEFSXG4gICAgcmV0ICs9IGRTcGVjdWxhckxpZ2h0O1xuI2VuZGlmXG4jaWZkZWYgTElUX1JFRkxFQ1RJT05TXG4gICAgcmV0ICs9IGRSZWZsZWN0aW9uLnJnYiAqIGRSZWZsZWN0aW9uLmE7XG4jZW5kaWZcblxuI2lmZGVmIExJVF9TSEVFTlxuICAgIGZsb2F0IHNoZWVuU2NhbGluZyA9IDEuMCAtIG1heChtYXgoc2hlZW5TcGVjdWxhcml0eS5yLCBzaGVlblNwZWN1bGFyaXR5LmcpLCBzaGVlblNwZWN1bGFyaXR5LmIpICogMC4xNTc7XG4gICAgcmV0ID0gcmV0ICogc2hlZW5TY2FsaW5nICsgKHNTcGVjdWxhckxpZ2h0ICsgc1JlZmxlY3Rpb24ucmdiKSAqIHNoZWVuU3BlY3VsYXJpdHk7XG4jZW5kaWZcbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG4gICAgZmxvYXQgY2xlYXJDb2F0U2NhbGluZyA9IDEuMCAtIGNjRnJlc25lbCAqIGNsZWFyY29hdFNwZWN1bGFyaXR5O1xuICAgIHJldCA9IHJldCAqIGNsZWFyQ29hdFNjYWxpbmcgKyAoY2NTcGVjdWxhckxpZ2h0ICsgY2NSZWZsZWN0aW9uLnJnYikgKiBjbGVhcmNvYXRTcGVjdWxhcml0eTtcbiNlbmRpZlxuXG4gICAgcmV0dXJuIHJldDtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
