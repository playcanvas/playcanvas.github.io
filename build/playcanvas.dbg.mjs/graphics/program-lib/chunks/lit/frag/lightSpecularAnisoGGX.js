/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightSpecularAnisoGGXPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhckFuaXNvR0dYLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2xpZ2h0U3BlY3VsYXJBbmlzb0dHWC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gQW5pc290cm9waWMgR0dYXG5mbG9hdCBjYWxjTGlnaHRTcGVjdWxhcihmbG9hdCB0R2xvc3NpbmVzcywgdmVjMyB0Tm9ybWFsVywgdmVjMyBoKSB7XG4gICAgZmxvYXQgUEkgPSAzLjE0MTU5MjY1MzU4OTc5MztcbiAgICBmbG9hdCByb3VnaG5lc3MgPSBtYXgoKDEuMCAtIHRHbG9zc2luZXNzKSAqICgxLjAgLSB0R2xvc3NpbmVzcyksIDAuMDAxKTtcbiAgICBmbG9hdCBhbmlzb3Ryb3B5ID0gbWF0ZXJpYWxfYW5pc290cm9weSAqIHJvdWdobmVzcztcbiBcbiAgICBmbG9hdCBhdCA9IG1heCgocm91Z2huZXNzICsgYW5pc290cm9weSksIHJvdWdobmVzcyAvIDQuMCk7XG4gICAgZmxvYXQgYWIgPSBtYXgoKHJvdWdobmVzcyAtIGFuaXNvdHJvcHkpLCByb3VnaG5lc3MgLyA0LjApO1xuXG4gICAgZmxvYXQgTm9IID0gZG90KHROb3JtYWxXLCBoKTtcbiAgICBmbG9hdCBUb0ggPSBkb3QoZFRCTlswXSwgaCk7XG4gICAgZmxvYXQgQm9IID0gZG90KGRUQk5bMV0sIGgpO1xuXG4gICAgZmxvYXQgYTIgPSBhdCAqIGFiO1xuICAgIHZlYzMgdiA9IHZlYzMoYWIgKiBUb0gsIGF0ICogQm9ILCBhMiAqIE5vSCk7XG4gICAgZmxvYXQgdjIgPSBkb3Qodiwgdik7XG4gICAgZmxvYXQgdzIgPSBhMiAvIHYyO1xuICAgIGZsb2F0IEQgPSBhMiAqIHcyICogdzIgKiAoMS4wIC8gUEkpO1xuXG4gICAgZmxvYXQgVG9WID0gZG90KGRUQk5bMF0sIGRWaWV3RGlyVyk7XG4gICAgZmxvYXQgQm9WID0gZG90KGRUQk5bMV0sIGRWaWV3RGlyVyk7XG4gICAgZmxvYXQgVG9MID0gZG90KGRUQk5bMF0sIC1kTGlnaHREaXJOb3JtVyk7XG4gICAgZmxvYXQgQm9MID0gZG90KGRUQk5bMV0sIC1kTGlnaHREaXJOb3JtVyk7XG4gICAgZmxvYXQgTm9WID0gZG90KHROb3JtYWxXLCBkVmlld0RpclcpO1xuICAgIGZsb2F0IE5vTCA9IGRvdCh0Tm9ybWFsVywgLWRMaWdodERpck5vcm1XKTtcblxuICAgIGZsb2F0IGxhbWJkYVYgPSBOb0wgKiBsZW5ndGgodmVjMyhhdCAqIFRvViwgYWIgKiBCb1YsIE5vVikpO1xuICAgIGZsb2F0IGxhbWJkYUwgPSBOb1YgKiBsZW5ndGgodmVjMyhhdCAqIFRvTCwgYWIgKiBCb0wsIE5vTCkpO1xuICAgIGZsb2F0IEcgPSAwLjUgLyAobGFtYmRhViArIGxhbWJkYUwpO1xuXG4gICAgcmV0dXJuIEQgKiBHO1xufVxuXG5mbG9hdCBnZXRMaWdodFNwZWN1bGFyKHZlYzMgaCkge1xuICAgIHJldHVybiBjYWxjTGlnaHRTcGVjdWxhcihkR2xvc3NpbmVzcywgZE5vcm1hbFcsIGgpO1xufVxuXG4jaWZkZWYgTElUX0NMRUFSQ09BVFxuZmxvYXQgZ2V0TGlnaHRTcGVjdWxhckNDKHZlYzMgaCkge1xuICAgIHJldHVybiBjYWxjTGlnaHRTcGVjdWxhcihjY0dsb3NzaW5lc3MsIGNjTm9ybWFsVywgaCk7XG59XG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw4QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQTNDQTs7OzsifQ==
