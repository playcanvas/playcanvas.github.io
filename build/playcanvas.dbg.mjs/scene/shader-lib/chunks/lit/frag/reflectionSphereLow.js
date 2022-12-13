/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionSphereLowPS = `
uniform sampler2D texture_sphereMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 reflDirV = vNormalV;

    vec2 sphereMapUv = reflDirV.xy * 0.5 + 0.5;
    return $DECODE(texture2D(texture_sphereMap, sphereMapUv));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
`;

export { reflectionSphereLowPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvblNwaGVyZUxvdy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL3JlZmxlY3Rpb25TcGhlcmVMb3cuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfc3BoZXJlTWFwO1xudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZsZWN0aXZpdHk7XG5cbnZlYzMgY2FsY1JlZmxlY3Rpb24odmVjMyB0UmVmbERpclcsIGZsb2F0IHRHbG9zc2luZXNzKSB7XG4gICAgdmVjMyByZWZsRGlyViA9IHZOb3JtYWxWO1xuXG4gICAgdmVjMiBzcGhlcmVNYXBVdiA9IHJlZmxEaXJWLnh5ICogMC41ICsgMC41O1xuICAgIHJldHVybiAkREVDT0RFKHRleHR1cmUyRCh0ZXh0dXJlX3NwaGVyZU1hcCwgc3BoZXJlTWFwVXYpKTtcbn1cblxudm9pZCBhZGRSZWZsZWN0aW9uKCkgeyAgIFxuICAgIGRSZWZsZWN0aW9uICs9IHZlYzQoY2FsY1JlZmxlY3Rpb24oZFJlZmxEaXJXLCBkR2xvc3NpbmVzcyksIG1hdGVyaWFsX3JlZmxlY3Rpdml0eSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
