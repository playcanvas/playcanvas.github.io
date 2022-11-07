/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var floatUnpackingPS = `
// float unpacking functionality, complimentary to float-packing.js
float bytes2float2(vec2 data) {
    return dot(data, vec2(1.0, 1.0 / 255.0));
}

float bytes2float3(vec3 data) {
    return dot(data, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
}

float bytes2float4(vec4 data) {
    return dot(data, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}

float bytes2floatRange2(vec2 data, float min, float max) {
    return mix(min, max, bytes2float2(data));
}

float bytes2floatRange3(vec3 data, float min, float max) {
    return mix(min, max, bytes2float3(data));
}

float bytes2floatRange4(vec4 data, float min, float max) {
    return mix(min, max, bytes2float4(data));
}

float mantissaExponent2Float(vec4 pack)
{
    float value = bytes2floatRange3(pack.xyz, -1.0, 1.0);
    float exponent = floor(pack.w * 255.0 - 127.0);
    return value * exp2(exponent);
}
`;

export { floatUnpackingPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXQtdW5wYWNraW5nLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2Zsb2F0LXVucGFja2luZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gZmxvYXQgdW5wYWNraW5nIGZ1bmN0aW9uYWxpdHksIGNvbXBsaW1lbnRhcnkgdG8gZmxvYXQtcGFja2luZy5qc1xuZmxvYXQgYnl0ZXMyZmxvYXQyKHZlYzIgZGF0YSkge1xuICAgIHJldHVybiBkb3QoZGF0YSwgdmVjMigxLjAsIDEuMCAvIDI1NS4wKSk7XG59XG5cbmZsb2F0IGJ5dGVzMmZsb2F0Myh2ZWMzIGRhdGEpIHtcbiAgICByZXR1cm4gZG90KGRhdGEsIHZlYzMoMS4wLCAxLjAgLyAyNTUuMCwgMS4wIC8gNjUwMjUuMCkpO1xufVxuXG5mbG9hdCBieXRlczJmbG9hdDQodmVjNCBkYXRhKSB7XG4gICAgcmV0dXJuIGRvdChkYXRhLCB2ZWM0KDEuMCwgMS4wIC8gMjU1LjAsIDEuMCAvIDY1MDI1LjAsIDEuMCAvIDE2NTgxMzc1LjApKTtcbn1cblxuZmxvYXQgYnl0ZXMyZmxvYXRSYW5nZTIodmVjMiBkYXRhLCBmbG9hdCBtaW4sIGZsb2F0IG1heCkge1xuICAgIHJldHVybiBtaXgobWluLCBtYXgsIGJ5dGVzMmZsb2F0MihkYXRhKSk7XG59XG5cbmZsb2F0IGJ5dGVzMmZsb2F0UmFuZ2UzKHZlYzMgZGF0YSwgZmxvYXQgbWluLCBmbG9hdCBtYXgpIHtcbiAgICByZXR1cm4gbWl4KG1pbiwgbWF4LCBieXRlczJmbG9hdDMoZGF0YSkpO1xufVxuXG5mbG9hdCBieXRlczJmbG9hdFJhbmdlNCh2ZWM0IGRhdGEsIGZsb2F0IG1pbiwgZmxvYXQgbWF4KSB7XG4gICAgcmV0dXJuIG1peChtaW4sIG1heCwgYnl0ZXMyZmxvYXQ0KGRhdGEpKTtcbn1cblxuZmxvYXQgbWFudGlzc2FFeHBvbmVudDJGbG9hdCh2ZWM0IHBhY2spXG57XG4gICAgZmxvYXQgdmFsdWUgPSBieXRlczJmbG9hdFJhbmdlMyhwYWNrLnh5eiwgLTEuMCwgMS4wKTtcbiAgICBmbG9hdCBleHBvbmVudCA9IGZsb29yKHBhY2sudyAqIDI1NS4wIC0gMTI3LjApO1xuICAgIHJldHVybiB2YWx1ZSAqIGV4cDIoZXhwb25lbnQpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHVCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FoQ0E7Ozs7In0=
