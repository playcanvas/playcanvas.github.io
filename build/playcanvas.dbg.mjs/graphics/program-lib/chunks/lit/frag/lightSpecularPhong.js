/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhclBob25nLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2xpZ2h0U3BlY3VsYXJQaG9uZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgY2FsY0xpZ2h0U3BlY3VsYXIoZmxvYXQgdEdsb3NzaW5lc3MsIHZlYzMgdFJlZmxEaXJXLCB2ZWMzIGgpIHtcbiAgICBmbG9hdCBzcGVjUG93ID0gdEdsb3NzaW5lc3M7XG5cbiAgICAvLyBIYWNrOiBPbiBNYWMgT1MgWCwgY2FsbGluZyBwb3cgd2l0aCB6ZXJvIGZvciB0aGUgZXhwb25lbnQgZ2VuZXJhdGVzIGhpZGVvdXMgYXJ0aWZhY3RzIHNvIGJpYXMgdXAgYSBsaXR0bGVcbiAgICByZXR1cm4gcG93KG1heChkb3QodFJlZmxEaXJXLCAtZExpZ2h0RGlyTm9ybVcpLCAwLjApLCBzcGVjUG93ICsgMC4wMDAxKTtcbn1cblxuZmxvYXQgZ2V0TGlnaHRTcGVjdWxhcih2ZWMzIGgpIHtcbiAgICByZXR1cm4gY2FsY0xpZ2h0U3BlY3VsYXIoZEdsb3NzaW5lc3MsIGRSZWZsRGlyVywgaCk7XG59XG5cbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG5mbG9hdCBnZXRMaWdodFNwZWN1bGFyQ0ModmVjMyBoKSB7XG4gICAgcmV0dXJuIGNhbGNMaWdodFNwZWN1bGFyKGNjR2xvc3NpbmVzcywgY2NSZWZsRGlyVyxoICk7XG59XG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwyQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBakJBOzs7OyJ9
