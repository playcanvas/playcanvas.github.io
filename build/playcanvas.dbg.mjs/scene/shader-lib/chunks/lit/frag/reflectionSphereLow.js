/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionSphereLowPS = /* glsl */`
uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 reflDirV = vNormalV;

    vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
    return $DECODE(texture2D(texture_sphereMap, sphereMapUv));
}

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;

export { reflectionSphereLowPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvblNwaGVyZUxvdy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxlY3Rpb25TcGhlcmVMb3cuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfc3BoZXJlTWFwO1xudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZsZWN0aXZpdHk7XG5cbnZlYzMgY2FsY1JlZmxlY3Rpb24odmVjMyByZWZsRGlyLCBmbG9hdCBnbG9zcykge1xuICAgIHZlYzMgcmVmbERpclYgPSB2Tm9ybWFsVjtcblxuICAgIHZlYzIgc3BoZXJlTWFwVXYgPSByZWZsRGlyVi54eSAqIDAuNSArIDAuNTtcbiAgICByZXR1cm4gJERFQ09ERSh0ZXh0dXJlMkQodGV4dHVyZV9zcGhlcmVNYXAsIHNwaGVyZU1hcFV2KSk7XG59XG5cbnZvaWQgYWRkUmVmbGVjdGlvbih2ZWMzIHJlZmxEaXIsIGZsb2F0IGdsb3NzKSB7ICAgXG4gICAgZFJlZmxlY3Rpb24gKz0gdmVjNChjYWxjUmVmbGVjdGlvbihyZWZsRGlyLCBnbG9zcyksIG1hdGVyaWFsX3JlZmxlY3Rpdml0eSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
