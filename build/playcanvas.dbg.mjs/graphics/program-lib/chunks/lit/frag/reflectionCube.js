/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCubePS = `
uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 lookupVec = fixSeams(cubeMapProject(tReflDirW));
    lookupVec.x *= -1.0;
    return $DECODE(textureCube(texture_cubeMap, lookupVec));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
`;

export { reflectionCubePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkN1YmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbGVjdGlvbkN1YmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gc2FtcGxlckN1YmUgdGV4dHVyZV9jdWJlTWFwO1xudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZsZWN0aXZpdHk7XG5cbnZlYzMgY2FsY1JlZmxlY3Rpb24odmVjMyB0UmVmbERpclcsIGZsb2F0IHRHbG9zc2luZXNzKSB7XG4gICAgdmVjMyBsb29rdXBWZWMgPSBmaXhTZWFtcyhjdWJlTWFwUHJvamVjdCh0UmVmbERpclcpKTtcbiAgICBsb29rdXBWZWMueCAqPSAtMS4wO1xuICAgIHJldHVybiAkREVDT0RFKHRleHR1cmVDdWJlKHRleHR1cmVfY3ViZU1hcCwgbG9va3VwVmVjKSk7XG59XG5cbnZvaWQgYWRkUmVmbGVjdGlvbigpIHsgICBcbiAgICBkUmVmbGVjdGlvbiArPSB2ZWM0KGNhbGNSZWZsZWN0aW9uKGRSZWZsRGlyVywgZEdsb3NzaW5lc3MpLCBtYXRlcmlhbF9yZWZsZWN0aXZpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHVCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBYkE7Ozs7In0=
