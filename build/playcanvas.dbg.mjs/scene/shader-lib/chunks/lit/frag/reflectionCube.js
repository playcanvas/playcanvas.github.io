/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflectionCubePS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkN1YmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9yZWZsZWN0aW9uQ3ViZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBzYW1wbGVyQ3ViZSB0ZXh0dXJlX2N1YmVNYXA7XG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX3JlZmxlY3Rpdml0eTtcblxudmVjMyBjYWxjUmVmbGVjdGlvbih2ZWMzIHRSZWZsRGlyVywgZmxvYXQgdEdsb3NzaW5lc3MpIHtcbiAgICB2ZWMzIGxvb2t1cFZlYyA9IGZpeFNlYW1zKGN1YmVNYXBQcm9qZWN0KHRSZWZsRGlyVykpO1xuICAgIGxvb2t1cFZlYy54ICo9IC0xLjA7XG4gICAgcmV0dXJuICRERUNPREUodGV4dHVyZUN1YmUodGV4dHVyZV9jdWJlTWFwLCBsb29rdXBWZWMpKTtcbn1cblxudm9pZCBhZGRSZWZsZWN0aW9uKCkgeyAgIFxuICAgIGRSZWZsZWN0aW9uICs9IHZlYzQoY2FsY1JlZmxlY3Rpb24oZFJlZmxEaXJXLCBkR2xvc3NpbmVzcyksIG1hdGVyaWFsX3JlZmxlY3Rpdml0eSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
