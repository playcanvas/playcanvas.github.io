/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var iridescencePS = `
#ifdef MAPFLOAT
uniform float material_iridescence;
#endif

void getIridescence() {
    float iridescence = 1.0;

    #ifdef MAPFLOAT
    iridescence *= material_iridescence;
    #endif

    #ifdef MAPTEXTURE
    iridescence *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    dIridescence = iridescence; 
}
`;

export { iridescencePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXJpZGVzY2VuY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9pcmlkZXNjZW5jZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIE1BUEZMT0FUXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2lyaWRlc2NlbmNlO1xuI2VuZGlmXG5cbnZvaWQgZ2V0SXJpZGVzY2VuY2UoKSB7XG4gICAgZmxvYXQgaXJpZGVzY2VuY2UgPSAxLjA7XG5cbiAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICBpcmlkZXNjZW5jZSAqPSBtYXRlcmlhbF9pcmlkZXNjZW5jZTtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgaXJpZGVzY2VuY2UgKj0gdGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgICNlbmRpZlxuXG4gICAgZElyaWRlc2NlbmNlID0gaXJpZGVzY2VuY2U7IFxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG9CQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQWxCQTs7OzsifQ==
