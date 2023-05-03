var lightSpecularBlinnPS = /* glsl */`
// Energy-conserving (hopefully) Blinn-Phong
float calcLightSpecular(float gloss, vec3 worldNormal, vec3 h) {
    float nh = max( dot( h, worldNormal ), 0.0 );

    float specPow = exp2(gloss * 11.0); // glossiness is linear, power is not; 0 - 2048

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    specPow = max(specPow, 0.0001);

    return pow(nh, specPow) * (specPow + 2.0) / 8.0;
}

float getLightSpecular(vec3 h, vec3 reflDir, vec3 worldNormal, vec3 viewDir, vec3 lightDirNorm, float gloss, mat3 tbn) {
    return calcLightSpecular(gloss, worldNormal, h);
}
`;

export { lightSpecularBlinnPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhckJsaW5uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvbGlnaHRTcGVjdWxhckJsaW5uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBFbmVyZ3ktY29uc2VydmluZyAoaG9wZWZ1bGx5KSBCbGlubi1QaG9uZ1xuZmxvYXQgY2FsY0xpZ2h0U3BlY3VsYXIoZmxvYXQgZ2xvc3MsIHZlYzMgd29ybGROb3JtYWwsIHZlYzMgaCkge1xuICAgIGZsb2F0IG5oID0gbWF4KCBkb3QoIGgsIHdvcmxkTm9ybWFsICksIDAuMCApO1xuXG4gICAgZmxvYXQgc3BlY1BvdyA9IGV4cDIoZ2xvc3MgKiAxMS4wKTsgLy8gZ2xvc3NpbmVzcyBpcyBsaW5lYXIsIHBvd2VyIGlzIG5vdDsgMCAtIDIwNDhcblxuICAgIC8vIEhhY2s6IE9uIE1hYyBPUyBYLCBjYWxsaW5nIHBvdyB3aXRoIHplcm8gZm9yIHRoZSBleHBvbmVudCBnZW5lcmF0ZXMgaGlkZW91cyBhcnRpZmFjdHMgc28gYmlhcyB1cCBhIGxpdHRsZVxuICAgIHNwZWNQb3cgPSBtYXgoc3BlY1BvdywgMC4wMDAxKTtcblxuICAgIHJldHVybiBwb3cobmgsIHNwZWNQb3cpICogKHNwZWNQb3cgKyAyLjApIC8gOC4wO1xufVxuXG5mbG9hdCBnZXRMaWdodFNwZWN1bGFyKHZlYzMgaCwgdmVjMyByZWZsRGlyLCB2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIsIHZlYzMgbGlnaHREaXJOb3JtLCBmbG9hdCBnbG9zcywgbWF0MyB0Ym4pIHtcbiAgICByZXR1cm4gY2FsY0xpZ2h0U3BlY3VsYXIoZ2xvc3MsIHdvcmxkTm9ybWFsLCBoKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMkJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
