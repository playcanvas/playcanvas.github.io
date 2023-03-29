/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightSpecularPhongPS = /* glsl */`
float calcLightSpecular(float gloss, vec3 reflDir, vec3 lightDirNorm) {
    float specPow = gloss;

    // Hack: On Mac OS X, calling pow with zero for the exponent generates hideous artifacts so bias up a little
    return pow(max(dot(reflDir, -lightDirNorm), 0.0), specPow + 0.0001);
}

float getLightSpecular(vec3 h, vec3 reflDir, vec3 worldNormal, vec3 viewDir, vec3 lightDirNorm, float gloss, mat3 tbn) {
    return calcLightSpecular(gloss, reflDir, lightDirNorm);
}
`;

export { lightSpecularPhongPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhclBob25nLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvbGlnaHRTcGVjdWxhclBob25nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5mbG9hdCBjYWxjTGlnaHRTcGVjdWxhcihmbG9hdCBnbG9zcywgdmVjMyByZWZsRGlyLCB2ZWMzIGxpZ2h0RGlyTm9ybSkge1xuICAgIGZsb2F0IHNwZWNQb3cgPSBnbG9zcztcblxuICAgIC8vIEhhY2s6IE9uIE1hYyBPUyBYLCBjYWxsaW5nIHBvdyB3aXRoIHplcm8gZm9yIHRoZSBleHBvbmVudCBnZW5lcmF0ZXMgaGlkZW91cyBhcnRpZmFjdHMgc28gYmlhcyB1cCBhIGxpdHRsZVxuICAgIHJldHVybiBwb3cobWF4KGRvdChyZWZsRGlyLCAtbGlnaHREaXJOb3JtKSwgMC4wKSwgc3BlY1BvdyArIDAuMDAwMSk7XG59XG5cbmZsb2F0IGdldExpZ2h0U3BlY3VsYXIodmVjMyBoLCB2ZWMzIHJlZmxEaXIsIHZlYzMgd29ybGROb3JtYWwsIHZlYzMgdmlld0RpciwgdmVjMyBsaWdodERpck5vcm0sIGZsb2F0IGdsb3NzLCBtYXQzIHRibikge1xuICAgIHJldHVybiBjYWxjTGlnaHRTcGVjdWxhcihnbG9zcywgcmVmbERpciwgbGlnaHREaXJOb3JtKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwyQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
