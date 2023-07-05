/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var thicknessPS = `
#ifdef MAPFLOAT
uniform float material_thickness;
#endif

void getThickness() {
    dThickness = 1.0;

    #ifdef MAPFLOAT
    dThickness *= material_thickness;
    #endif

    #ifdef MAPTEXTURE
    dThickness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dThickness *= saturate(vVertexColor.$VC);
    #endif
}
`;

export { thicknessPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhpY2tuZXNzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvdGhpY2tuZXNzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTUFQRkxPQVRcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfdGhpY2tuZXNzO1xuI2VuZGlmXG5cbnZvaWQgZ2V0VGhpY2tuZXNzKCkge1xuICAgIGRUaGlja25lc3MgPSAxLjA7XG5cbiAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICBkVGhpY2tuZXNzICo9IG1hdGVyaWFsX3RoaWNrbmVzcztcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgZFRoaWNrbmVzcyAqPSB0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgZFRoaWNrbmVzcyAqPSBzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKTtcbiAgICAjZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxrQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBcEJBOzs7OyJ9
