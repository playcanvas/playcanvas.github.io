/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightSpecularPhongPS = `
float calcLightSpecular(float tGlossiness, vec3 tReflDirW, vec3 h) {
    float specPow = tGlossiness;

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(tReflDirW, -dLightDirNormW), 0.0), specPow + 0.0001);
}

float getLightSpecular(vec3 h) {
    return calcLightSpecular(dGlossiness, dReflDirW, h);
}

#ifdef LIT_CLEARCOAT
float getLightSpecularCC(vec3 h) {
    return calcLightSpecular(ccGlossiness, ccReflDirW,h );
}
#endif
`;

export { lightSpecularPhongPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhclBob25nLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvbGlnaHRTcGVjdWxhclBob25nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBjYWxjTGlnaHRTcGVjdWxhcihmbG9hdCB0R2xvc3NpbmVzcywgdmVjMyB0UmVmbERpclcsIHZlYzMgaCkge1xuICAgIGZsb2F0IHNwZWNQb3cgPSB0R2xvc3NpbmVzcztcblxuICAgIC8vIEhhY2s6IE9uIE1hYyBPUyBYLCBjYWxsaW5nIHBvdyB3aXRoIHplcm8gZm9yIHRoZSBleHBvbmVudCBnZW5lcmF0ZXMgaGlkZW91cyBhcnRpZmFjdHMgc28gYmlhcyB1cCBhIGxpdHRsZVxuICAgIHJldHVybiBwb3cobWF4KGRvdCh0UmVmbERpclcsIC1kTGlnaHREaXJOb3JtVyksIDAuMCksIHNwZWNQb3cgKyAwLjAwMDEpO1xufVxuXG5mbG9hdCBnZXRMaWdodFNwZWN1bGFyKHZlYzMgaCkge1xuICAgIHJldHVybiBjYWxjTGlnaHRTcGVjdWxhcihkR2xvc3NpbmVzcywgZFJlZmxEaXJXLCBoKTtcbn1cblxuI2lmZGVmIExJVF9DTEVBUkNPQVRcbmZsb2F0IGdldExpZ2h0U3BlY3VsYXJDQyh2ZWMzIGgpIHtcbiAgICByZXR1cm4gY2FsY0xpZ2h0U3BlY3VsYXIoY2NHbG9zc2luZXNzLCBjY1JlZmxEaXJXLGggKTtcbn1cbiNlbmRpZlxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDJCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
