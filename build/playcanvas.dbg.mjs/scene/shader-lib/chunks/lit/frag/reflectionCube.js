/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCubePS = /* glsl */`
uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 lookupVec = fixSeams(cubeMapProject(reflDir));
    lookupVec.x *= -1.0;
    return $DECODE(textureCube(texture_cubeMap, lookupVec));
}

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;

export { reflectionCubePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkN1YmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9yZWZsZWN0aW9uQ3ViZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBzYW1wbGVyQ3ViZSB0ZXh0dXJlX2N1YmVNYXA7XG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX3JlZmxlY3Rpdml0eTtcblxudmVjMyBjYWxjUmVmbGVjdGlvbih2ZWMzIHJlZmxEaXIsIGZsb2F0IGdsb3NzKSB7XG4gICAgdmVjMyBsb29rdXBWZWMgPSBmaXhTZWFtcyhjdWJlTWFwUHJvamVjdChyZWZsRGlyKSk7XG4gICAgbG9va3VwVmVjLnggKj0gLTEuMDtcbiAgICByZXR1cm4gJERFQ09ERSh0ZXh0dXJlQ3ViZSh0ZXh0dXJlX2N1YmVNYXAsIGxvb2t1cFZlYykpO1xufVxuXG52b2lkIGFkZFJlZmxlY3Rpb24odmVjMyByZWZsRGlyLCBmbG9hdCBnbG9zcykgeyAgIFxuICAgIGRSZWZsZWN0aW9uICs9IHZlYzQoY2FsY1JlZmxlY3Rpb24ocmVmbERpciwgZ2xvc3MpLCBtYXRlcmlhbF9yZWZsZWN0aXZpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHVCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
