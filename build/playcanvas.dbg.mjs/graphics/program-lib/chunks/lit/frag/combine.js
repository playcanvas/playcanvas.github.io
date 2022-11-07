/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
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
    ret = ret * sheenScaling + sSpecularLight + sReflection.rgb * sReflection.a;
#endif
#ifdef LIT_CLEARCOAT
    float clearCoatScaling = 1.0 - ccFresnel * ccSpecularity;
    ret = ret * clearCoatScaling + (ccSpecularLight + ccReflection.rgb) * ccSpecularity;
#endif

    return ret;
}
`;

export { combinePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tYmluZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9jb21iaW5lLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGNvbWJpbmVDb2xvcigpIHtcbiAgICB2ZWMzIHJldCA9IHZlYzMoMCk7XG4jaWZkZWYgTElUX09MRF9BTUJJRU5UXG4gICAgcmV0ICs9IChkRGlmZnVzZUxpZ2h0IC0gbGlnaHRfZ2xvYmFsQW1iaWVudCkgKiBkQWxiZWRvICsgbWF0ZXJpYWxfYW1iaWVudCAqIGxpZ2h0X2dsb2JhbEFtYmllbnQ7XG4jZWxzZVxuICAgIHJldCArPSBkQWxiZWRvICogZERpZmZ1c2VMaWdodDtcbiNlbmRpZlxuI2lmZGVmIExJVF9TUEVDVUxBUlxuICAgIHJldCArPSBkU3BlY3VsYXJMaWdodDtcbiNlbmRpZlxuI2lmZGVmIExJVF9SRUZMRUNUSU9OU1xuICAgIHJldCArPSBkUmVmbGVjdGlvbi5yZ2IgKiBkUmVmbGVjdGlvbi5hO1xuI2VuZGlmXG4jaWZkZWYgTElUX1NIRUVOXG4gICAgZmxvYXQgc2hlZW5TY2FsaW5nID0gMS4wIC0gbWF4KG1heChzU3BlY3VsYXJpdHkuciwgc1NwZWN1bGFyaXR5LmcpLCBzU3BlY3VsYXJpdHkuYikgKiAwLjE1NztcbiAgICByZXQgPSByZXQgKiBzaGVlblNjYWxpbmcgKyBzU3BlY3VsYXJMaWdodCArIHNSZWZsZWN0aW9uLnJnYiAqIHNSZWZsZWN0aW9uLmE7XG4jZW5kaWZcbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG4gICAgZmxvYXQgY2xlYXJDb2F0U2NhbGluZyA9IDEuMCAtIGNjRnJlc25lbCAqIGNjU3BlY3VsYXJpdHk7XG4gICAgcmV0ID0gcmV0ICogY2xlYXJDb2F0U2NhbGluZyArIChjY1NwZWN1bGFyTGlnaHQgKyBjY1JlZmxlY3Rpb24ucmdiKSAqIGNjU3BlY3VsYXJpdHk7XG4jZW5kaWZcblxuICAgIHJldHVybiByZXQ7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZ0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0F6QkE7Ozs7In0=
