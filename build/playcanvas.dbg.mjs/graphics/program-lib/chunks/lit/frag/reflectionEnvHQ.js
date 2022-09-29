/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionEnvHQPS = `
#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif
uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 dir = cubeMapProject(tReflDirW) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    // calculate roughness level
    float level = saturate(1.0 - tGlossiness) * 5.0;
    float ilevel = floor(level);
    float flevel = level - ilevel;

    vec3 sharp = $DECODE(textureCube(texture_cubeMap, fixSeams(dir)));
    vec3 roughA = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel)));
    vec3 roughB = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(sharp, mix(roughA, roughB, flevel), min(level, 1.0)));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
`;

export { reflectionEnvHQPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkVudkhRLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxlY3Rpb25FbnZIUS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmbmRlZiBFTlZfQVRMQVNcbiNkZWZpbmUgRU5WX0FUTEFTXG51bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX2VudkF0bGFzO1xuI2VuZGlmXG51bmlmb3JtIHNhbXBsZXJDdWJlIHRleHR1cmVfY3ViZU1hcDtcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfcmVmbGVjdGl2aXR5O1xuXG52ZWMzIGNhbGNSZWZsZWN0aW9uKHZlYzMgdFJlZmxEaXJXLCBmbG9hdCB0R2xvc3NpbmVzcykge1xuICAgIHZlYzMgZGlyID0gY3ViZU1hcFByb2plY3QodFJlZmxEaXJXKSAqIHZlYzMoLTEuMCwgMS4wLCAxLjApO1xuICAgIHZlYzIgdXYgPSB0b1NwaGVyaWNhbFV2KGRpcik7XG5cbiAgICAvLyBjYWxjdWxhdGUgcm91Z2huZXNzIGxldmVsXG4gICAgZmxvYXQgbGV2ZWwgPSBzYXR1cmF0ZSgxLjAgLSB0R2xvc3NpbmVzcykgKiA1LjA7XG4gICAgZmxvYXQgaWxldmVsID0gZmxvb3IobGV2ZWwpO1xuICAgIGZsb2F0IGZsZXZlbCA9IGxldmVsIC0gaWxldmVsO1xuXG4gICAgdmVjMyBzaGFycCA9ICRERUNPREUodGV4dHVyZUN1YmUodGV4dHVyZV9jdWJlTWFwLCBmaXhTZWFtcyhkaXIpKSk7XG4gICAgdmVjMyByb3VnaEEgPSAkREVDT0RFKHRleHR1cmUyRCh0ZXh0dXJlX2VudkF0bGFzLCBtYXBSb3VnaG5lc3NVdih1diwgaWxldmVsKSkpO1xuICAgIHZlYzMgcm91Z2hCID0gJERFQ09ERSh0ZXh0dXJlMkQodGV4dHVyZV9lbnZBdGxhcywgbWFwUm91Z2huZXNzVXYodXYsIGlsZXZlbCArIDEuMCkpKTtcblxuICAgIHJldHVybiBwcm9jZXNzRW52aXJvbm1lbnQobWl4KHNoYXJwLCBtaXgocm91Z2hBLCByb3VnaEIsIGZsZXZlbCksIG1pbihsZXZlbCwgMS4wKSkpO1xufVxuXG52b2lkIGFkZFJlZmxlY3Rpb24oKSB7ICAgXG4gICAgZFJlZmxlY3Rpb24gKz0gdmVjNChjYWxjUmVmbGVjdGlvbihkUmVmbERpclcsIGRHbG9zc2luZXNzKSwgbWF0ZXJpYWxfcmVmbGVjdGl2aXR5KTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx3QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0EzQkE7Ozs7In0=
