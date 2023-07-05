/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhckJsaW5uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2xpZ2h0U3BlY3VsYXJCbGlubi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gRW5lcmd5LWNvbnNlcnZpbmcgKGhvcGVmdWxseSkgQmxpbm4tUGhvbmdcbmZsb2F0IGNhbGNMaWdodFNwZWN1bGFyKGZsb2F0IHRHbG9zc2luZXNzLCB2ZWMzIHROb3JtYWxXLCB2ZWMzIGgpIHtcbiAgICBmbG9hdCBuaCA9IG1heCggZG90KCBoLCB0Tm9ybWFsVyApLCAwLjAgKTtcblxuICAgIGZsb2F0IHNwZWNQb3cgPSBleHAyKHRHbG9zc2luZXNzICogMTEuMCk7IC8vIGdsb3NzaW5lc3MgaXMgbGluZWFyLCBwb3dlciBpcyBub3Q7IDAgLSAyMDQ4XG5cbiAgICAvLyBIYWNrOiBPbiBNYWMgT1MgWCwgY2FsbGluZyBwb3cgd2l0aCB6ZXJvIGZvciB0aGUgZXhwb25lbnQgZ2VuZXJhdGVzIGhpZGVvdXMgYXJ0aWZhY3RzIHNvIGJpYXMgdXAgYSBsaXR0bGVcbiAgICBzcGVjUG93ID0gbWF4KHNwZWNQb3csIDAuMDAwMSk7XG5cbiAgICByZXR1cm4gcG93KG5oLCBzcGVjUG93KSAqIChzcGVjUG93ICsgMi4wKSAvIDguMDtcbn1cblxuZmxvYXQgZ2V0TGlnaHRTcGVjdWxhcih2ZWMzIGgpIHtcbiAgICByZXR1cm4gY2FsY0xpZ2h0U3BlY3VsYXIoZEdsb3NzaW5lc3MsIGROb3JtYWxXLCBoKTtcbn1cblxuI2lmZGVmIExJVF9DTEVBUkNPQVRcbmZsb2F0IGdldExpZ2h0U3BlY3VsYXJDQyh2ZWMzIGgpIHtcbiAgICByZXR1cm4gY2FsY0xpZ2h0U3BlY3VsYXIoY2NHbG9zc2luZXNzLCBjY05vcm1hbFcsIGgpO1xufVxuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMkJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0F0QkE7Ozs7In0=
