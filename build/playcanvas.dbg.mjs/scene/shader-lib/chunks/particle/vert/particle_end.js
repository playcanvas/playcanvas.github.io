/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_endVS = /* glsl */`
    localPos *= scale * emitterScale;
    localPos += particlePos;

    #ifdef SCREEN_SPACE
    gl_Position = vec4(localPos.x, localPos.y, 0.0, 1.0);
    #else
    gl_Position = matrix_viewProjection * vec4(localPos.xyz, 1.0);
    #endif
`;

export { particle_endVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfZW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvdmVydC9wYXJ0aWNsZV9lbmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBsb2NhbFBvcyAqPSBzY2FsZSAqIGVtaXR0ZXJTY2FsZTtcbiAgICBsb2NhbFBvcyArPSBwYXJ0aWNsZVBvcztcblxuICAgICNpZmRlZiBTQ1JFRU5fU1BBQ0VcbiAgICBnbF9Qb3NpdGlvbiA9IHZlYzQobG9jYWxQb3MueCwgbG9jYWxQb3MueSwgMC4wLCAxLjApO1xuICAgICNlbHNlXG4gICAgZ2xfUG9zaXRpb24gPSBtYXRyaXhfdmlld1Byb2plY3Rpb24gKiB2ZWM0KGxvY2FsUG9zLnh5eiwgMS4wKTtcbiAgICAjZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxxQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
