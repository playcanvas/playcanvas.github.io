/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var emissivePS = `
#ifdef MAPCOLOR
uniform vec3 material_emissive;
#endif

#ifdef MAPFLOAT
uniform float material_emissiveIntensity;
#endif

void getEmission() {
    dEmission = vec3(1.0);

    #ifdef MAPFLOAT
    dEmission *= material_emissiveIntensity;
    #endif

    #ifdef MAPCOLOR
    dEmission *= material_emissive;
    #endif

    #ifdef MAPTEXTURE
    dEmission *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    dEmission *= gammaCorrectInput(saturate(vVertexColor.$VC));
    #endif
}
`;

export { emissivePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1pc3NpdmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9lbWlzc2l2ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIE1BUENPTE9SXG51bmlmb3JtIHZlYzMgbWF0ZXJpYWxfZW1pc3NpdmU7XG4jZW5kaWZcblxuI2lmZGVmIE1BUEZMT0FUXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2VtaXNzaXZlSW50ZW5zaXR5O1xuI2VuZGlmXG5cbnZvaWQgZ2V0RW1pc3Npb24oKSB7XG4gICAgZEVtaXNzaW9uID0gdmVjMygxLjApO1xuXG4gICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgZEVtaXNzaW9uICo9IG1hdGVyaWFsX2VtaXNzaXZlSW50ZW5zaXR5O1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUENPTE9SXG4gICAgZEVtaXNzaW9uICo9IG1hdGVyaWFsX2VtaXNzaXZlO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICBkRW1pc3Npb24gKj0gJERFQ09ERSh0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKSkuJENIO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgIGRFbWlzc2lvbiAqPSBnYW1tYUNvcnJlY3RJbnB1dChzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKSk7XG4gICAgI2VuZGlmXG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsaUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0E1QkE7Ozs7In0=
