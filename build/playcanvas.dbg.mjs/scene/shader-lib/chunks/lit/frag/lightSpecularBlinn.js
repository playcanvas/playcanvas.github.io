/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightSpecularBlinnPS = `
// Energy-conserving (hopefully) Blinn-Phong
float calcLightSpecular(float tGlossiness, vec3 tNormalW, vec3 h) {
    float nh = max( dot( h, tNormalW ), 0.0 );

    float specPow = exp2(tGlossiness * 11.0); // glossiness is linear, power is not; 0 - 2048

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    specPow = max(specPow, 0.0001);

    return pow(nh, specPow) * (specPow + 2.0) / 8.0;
}

float getLightSpecular(vec3 h) {
    return calcLightSpecular(dGlossiness, dNormalW, h);
}

#ifdef LIT_CLEARCOAT
float getLightSpecularCC(vec3 h) {
    return calcLightSpecular(ccGlossiness, ccNormalW, h);
}
#endif
`;

export { lightSpecularBlinnPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhckJsaW5uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvbGlnaHRTcGVjdWxhckJsaW5uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBFbmVyZ3ktY29uc2VydmluZyAoaG9wZWZ1bGx5KSBCbGlubi1QaG9uZ1xuZmxvYXQgY2FsY0xpZ2h0U3BlY3VsYXIoZmxvYXQgdEdsb3NzaW5lc3MsIHZlYzMgdE5vcm1hbFcsIHZlYzMgaCkge1xuICAgIGZsb2F0IG5oID0gbWF4KCBkb3QoIGgsIHROb3JtYWxXICksIDAuMCApO1xuXG4gICAgZmxvYXQgc3BlY1BvdyA9IGV4cDIodEdsb3NzaW5lc3MgKiAxMS4wKTsgLy8gZ2xvc3NpbmVzcyBpcyBsaW5lYXIsIHBvd2VyIGlzIG5vdDsgMCAtIDIwNDhcblxuICAgIC8vIEhhY2s6IE9uIE1hYyBPUyBYLCBjYWxsaW5nIHBvdyB3aXRoIHplcm8gZm9yIHRoZSBleHBvbmVudCBnZW5lcmF0ZXMgaGlkZW91cyBhcnRpZmFjdHMgc28gYmlhcyB1cCBhIGxpdHRsZVxuICAgIHNwZWNQb3cgPSBtYXgoc3BlY1BvdywgMC4wMDAxKTtcblxuICAgIHJldHVybiBwb3cobmgsIHNwZWNQb3cpICogKHNwZWNQb3cgKyAyLjApIC8gOC4wO1xufVxuXG5mbG9hdCBnZXRMaWdodFNwZWN1bGFyKHZlYzMgaCkge1xuICAgIHJldHVybiBjYWxjTGlnaHRTcGVjdWxhcihkR2xvc3NpbmVzcywgZE5vcm1hbFcsIGgpO1xufVxuXG4jaWZkZWYgTElUX0NMRUFSQ09BVFxuZmxvYXQgZ2V0TGlnaHRTcGVjdWxhckNDKHZlYzMgaCkge1xuICAgIHJldHVybiBjYWxjTGlnaHRTcGVjdWxhcihjY0dsb3NzaW5lc3MsIGNjTm9ybWFsVywgaCk7XG59XG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwyQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
