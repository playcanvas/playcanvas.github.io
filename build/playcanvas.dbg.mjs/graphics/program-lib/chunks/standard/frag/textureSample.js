/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var textureSamplePS = `
vec4 texture2DSRGB(sampler2D tex, vec2 uv) {
    return gammaCorrectInput(texture2D(tex, uv));
}

vec4 texture2DSRGB(sampler2D tex, vec2 uv, float bias) {
    return gammaCorrectInput(texture2D(tex, uv, bias));
}

vec3 texture2DRGBM(sampler2D tex, vec2 uv) {
    return decodeRGBM(texture2D(tex, uv));
}

vec3 texture2DRGBM(sampler2D tex, vec2 uv, float bias) {
    return decodeRGBM(texture2D(tex, uv, bias));
}

vec3 texture2DRGBE(sampler2D tex, vec2 uv) {
    return decodeRGBM(texture2D(tex, uv));
}

vec3 texture2DRGBE(sampler2D tex, vec2 uv, float bias) {
    return decodeRGBM(texture2D(tex, uv, bias));
}
`;

export { textureSamplePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZVNhbXBsZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL3RleHR1cmVTYW1wbGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZlYzQgdGV4dHVyZTJEU1JHQihzYW1wbGVyMkQgdGV4LCB2ZWMyIHV2KSB7XG4gICAgcmV0dXJuIGdhbW1hQ29ycmVjdElucHV0KHRleHR1cmUyRCh0ZXgsIHV2KSk7XG59XG5cbnZlYzQgdGV4dHVyZTJEU1JHQihzYW1wbGVyMkQgdGV4LCB2ZWMyIHV2LCBmbG9hdCBiaWFzKSB7XG4gICAgcmV0dXJuIGdhbW1hQ29ycmVjdElucHV0KHRleHR1cmUyRCh0ZXgsIHV2LCBiaWFzKSk7XG59XG5cbnZlYzMgdGV4dHVyZTJEUkdCTShzYW1wbGVyMkQgdGV4LCB2ZWMyIHV2KSB7XG4gICAgcmV0dXJuIGRlY29kZVJHQk0odGV4dHVyZTJEKHRleCwgdXYpKTtcbn1cblxudmVjMyB0ZXh0dXJlMkRSR0JNKHNhbXBsZXIyRCB0ZXgsIHZlYzIgdXYsIGZsb2F0IGJpYXMpIHtcbiAgICByZXR1cm4gZGVjb2RlUkdCTSh0ZXh0dXJlMkQodGV4LCB1diwgYmlhcykpO1xufVxuXG52ZWMzIHRleHR1cmUyRFJHQkUoc2FtcGxlcjJEIHRleCwgdmVjMiB1dikge1xuICAgIHJldHVybiBkZWNvZGVSR0JNKHRleHR1cmUyRCh0ZXgsIHV2KSk7XG59XG5cbnZlYzMgdGV4dHVyZTJEUkdCRShzYW1wbGVyMkQgdGV4LCB2ZWMyIHV2LCBmbG9hdCBiaWFzKSB7XG4gICAgcmV0dXJuIGRlY29kZVJHQk0odGV4dHVyZTJEKHRleCwgdXYsIGJpYXMpKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0F4QkE7Ozs7In0=
