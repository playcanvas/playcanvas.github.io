/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightSpecularAnisoGGXPS = /* glsl */`
// Anisotropic GGX
float calcLightSpecular(float tGlossiness, vec3 tNormalW, vec3 h) {
    float PI = 3.141592653589793;
    float roughness = max((1.0 - tGlossiness) * (1.0 - tGlossiness), 0.001);
    float anisotropy = material_anisotropy * roughness;
 
    float at = max((roughness + anisotropy), roughness / 4.0);
    float ab = max((roughness - anisotropy), roughness / 4.0);

    float NoH = dot(tNormalW, h);
    float ToH = dot(dTBN[0], h);
    float BoH = dot(dTBN[1], h);

    float a2 = at * ab;
    vec3 v = vec3(ab * ToH, at * BoH, a2 * NoH);
    float v2 = dot(v, v);
    float w2 = a2 / v2;
    float D = a2 * w2 * w2 * (1.0 / PI);

    float ToV = dot(dTBN[0], dViewDirW);
    float BoV = dot(dTBN[1], dViewDirW);
    float ToL = dot(dTBN[0], -dLightDirNormW);
    float BoL = dot(dTBN[1], -dLightDirNormW);
    float NoV = dot(tNormalW, dViewDirW);
    float NoL = dot(tNormalW, -dLightDirNormW);

    float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));
    float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));
    float G = 0.5 / (lambdaV + lambdaL);

    return D * G;
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

export { lightSpecularAnisoGGXPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhckFuaXNvR0dYLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvbGlnaHRTcGVjdWxhckFuaXNvR0dYLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBBbmlzb3Ryb3BpYyBHR1hcbmZsb2F0IGNhbGNMaWdodFNwZWN1bGFyKGZsb2F0IHRHbG9zc2luZXNzLCB2ZWMzIHROb3JtYWxXLCB2ZWMzIGgpIHtcbiAgICBmbG9hdCBQSSA9IDMuMTQxNTkyNjUzNTg5NzkzO1xuICAgIGZsb2F0IHJvdWdobmVzcyA9IG1heCgoMS4wIC0gdEdsb3NzaW5lc3MpICogKDEuMCAtIHRHbG9zc2luZXNzKSwgMC4wMDEpO1xuICAgIGZsb2F0IGFuaXNvdHJvcHkgPSBtYXRlcmlhbF9hbmlzb3Ryb3B5ICogcm91Z2huZXNzO1xuIFxuICAgIGZsb2F0IGF0ID0gbWF4KChyb3VnaG5lc3MgKyBhbmlzb3Ryb3B5KSwgcm91Z2huZXNzIC8gNC4wKTtcbiAgICBmbG9hdCBhYiA9IG1heCgocm91Z2huZXNzIC0gYW5pc290cm9weSksIHJvdWdobmVzcyAvIDQuMCk7XG5cbiAgICBmbG9hdCBOb0ggPSBkb3QodE5vcm1hbFcsIGgpO1xuICAgIGZsb2F0IFRvSCA9IGRvdChkVEJOWzBdLCBoKTtcbiAgICBmbG9hdCBCb0ggPSBkb3QoZFRCTlsxXSwgaCk7XG5cbiAgICBmbG9hdCBhMiA9IGF0ICogYWI7XG4gICAgdmVjMyB2ID0gdmVjMyhhYiAqIFRvSCwgYXQgKiBCb0gsIGEyICogTm9IKTtcbiAgICBmbG9hdCB2MiA9IGRvdCh2LCB2KTtcbiAgICBmbG9hdCB3MiA9IGEyIC8gdjI7XG4gICAgZmxvYXQgRCA9IGEyICogdzIgKiB3MiAqICgxLjAgLyBQSSk7XG5cbiAgICBmbG9hdCBUb1YgPSBkb3QoZFRCTlswXSwgZFZpZXdEaXJXKTtcbiAgICBmbG9hdCBCb1YgPSBkb3QoZFRCTlsxXSwgZFZpZXdEaXJXKTtcbiAgICBmbG9hdCBUb0wgPSBkb3QoZFRCTlswXSwgLWRMaWdodERpck5vcm1XKTtcbiAgICBmbG9hdCBCb0wgPSBkb3QoZFRCTlsxXSwgLWRMaWdodERpck5vcm1XKTtcbiAgICBmbG9hdCBOb1YgPSBkb3QodE5vcm1hbFcsIGRWaWV3RGlyVyk7XG4gICAgZmxvYXQgTm9MID0gZG90KHROb3JtYWxXLCAtZExpZ2h0RGlyTm9ybVcpO1xuXG4gICAgZmxvYXQgbGFtYmRhViA9IE5vTCAqIGxlbmd0aCh2ZWMzKGF0ICogVG9WLCBhYiAqIEJvViwgTm9WKSk7XG4gICAgZmxvYXQgbGFtYmRhTCA9IE5vViAqIGxlbmd0aCh2ZWMzKGF0ICogVG9MLCBhYiAqIEJvTCwgTm9MKSk7XG4gICAgZmxvYXQgRyA9IDAuNSAvIChsYW1iZGFWICsgbGFtYmRhTCk7XG5cbiAgICByZXR1cm4gRCAqIEc7XG59XG5cbmZsb2F0IGdldExpZ2h0U3BlY3VsYXIodmVjMyBoKSB7XG4gICAgcmV0dXJuIGNhbGNMaWdodFNwZWN1bGFyKGRHbG9zc2luZXNzLCBkTm9ybWFsVywgaCk7XG59XG5cbiNpZmRlZiBMSVRfQ0xFQVJDT0FUXG5mbG9hdCBnZXRMaWdodFNwZWN1bGFyQ0ModmVjMyBoKSB7XG4gICAgcmV0dXJuIGNhbGNMaWdodFNwZWN1bGFyKGNjR2xvc3NpbmVzcywgY2NOb3JtYWxXLCBoKTtcbn1cbiNlbmRpZlxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDhCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
