/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionSpherePS = /* glsl */`
#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif
uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 reflDirV = (mat3(matrix_view) * reflDir).xyz;

    float m = 2.0 * sqrt( dot(reflDirV.xy, reflDirV.xy) + (reflDirV.z+1.0)*(reflDirV.z+1.0) );
    vec2 sphereMapUv = reflDirV.xy / m + 0.5;

    return $DECODE(texture2D(texture_sphereMap, sphereMapUv));
}

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;

export { reflectionSpherePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvblNwaGVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxlY3Rpb25TcGhlcmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZm5kZWYgVklFV01BVFJJWFxuI2RlZmluZSBWSUVXTUFUUklYXG51bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXc7XG4jZW5kaWZcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfc3BoZXJlTWFwO1xudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZsZWN0aXZpdHk7XG5cbnZlYzMgY2FsY1JlZmxlY3Rpb24odmVjMyByZWZsRGlyLCBmbG9hdCBnbG9zcykge1xuICAgIHZlYzMgcmVmbERpclYgPSAobWF0MyhtYXRyaXhfdmlldykgKiByZWZsRGlyKS54eXo7XG5cbiAgICBmbG9hdCBtID0gMi4wICogc3FydCggZG90KHJlZmxEaXJWLnh5LCByZWZsRGlyVi54eSkgKyAocmVmbERpclYueisxLjApKihyZWZsRGlyVi56KzEuMCkgKTtcbiAgICB2ZWMyIHNwaGVyZU1hcFV2ID0gcmVmbERpclYueHkgLyBtICsgMC41O1xuXG4gICAgcmV0dXJuICRERUNPREUodGV4dHVyZTJEKHRleHR1cmVfc3BoZXJlTWFwLCBzcGhlcmVNYXBVdikpO1xufVxuXG52b2lkIGFkZFJlZmxlY3Rpb24odmVjMyByZWZsRGlyLCBmbG9hdCBnbG9zcykgeyAgIFxuICAgIGRSZWZsZWN0aW9uICs9IHZlYzQoY2FsY1JlZmxlY3Rpb24ocmVmbERpciwgZ2xvc3MpLCBtYXRlcmlhbF9yZWZsZWN0aXZpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHlCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
