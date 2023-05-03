var lightSpecularAnisoGGXPS = /* glsl */`
// Anisotropic GGX
float calcLightSpecular(float gloss, vec3 worldNormal, vec3 viewDir, vec3 h, vec3 lightDirNorm, mat3 tbn) {
    float PI = 3.141592653589793;
    float roughness = max((1.0 - gloss) * (1.0 - gloss), 0.001);
    float anisotropy = material_anisotropy * roughness;
 
    float at = max((roughness + anisotropy), roughness / 4.0);
    float ab = max((roughness - anisotropy), roughness / 4.0);

    float NoH = dot(worldNormal, h);
    float ToH = dot(tbn[0], h);
    float BoH = dot(tbn[1], h);

    float a2 = at * ab;
    vec3 v = vec3(ab * ToH, at * BoH, a2 * NoH);
    float v2 = dot(v, v);
    float w2 = a2 / v2;
    float D = a2 * w2 * w2 * (1.0 / PI);

    float ToV = dot(tbn[0], viewDir);
    float BoV = dot(tbn[1], viewDir);
    float ToL = dot(tbn[0], -lightDirNorm);
    float BoL = dot(tbn[1], -lightDirNorm);
    float NoV = dot(worldNormal, viewDir);
    float NoL = dot(worldNormal, -lightDirNorm);

    float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));
    float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));
    float G = 0.5 / (lambdaV + lambdaL);

    return D * G;
}

float getLightSpecular(vec3 h, vec3 reflDir, vec3 worldNormal, vec3 viewDir, vec3 lightDirNorm, float gloss, mat3 tbn) {
    return calcLightSpecular(gloss, worldNormal, viewDir, h, lightDirNorm, tbn);
}
`;

export { lightSpecularAnisoGGXPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRTcGVjdWxhckFuaXNvR0dYLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvbGlnaHRTcGVjdWxhckFuaXNvR0dYLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBBbmlzb3Ryb3BpYyBHR1hcbmZsb2F0IGNhbGNMaWdodFNwZWN1bGFyKGZsb2F0IGdsb3NzLCB2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIsIHZlYzMgaCwgdmVjMyBsaWdodERpck5vcm0sIG1hdDMgdGJuKSB7XG4gICAgZmxvYXQgUEkgPSAzLjE0MTU5MjY1MzU4OTc5MztcbiAgICBmbG9hdCByb3VnaG5lc3MgPSBtYXgoKDEuMCAtIGdsb3NzKSAqICgxLjAgLSBnbG9zcyksIDAuMDAxKTtcbiAgICBmbG9hdCBhbmlzb3Ryb3B5ID0gbWF0ZXJpYWxfYW5pc290cm9weSAqIHJvdWdobmVzcztcbiBcbiAgICBmbG9hdCBhdCA9IG1heCgocm91Z2huZXNzICsgYW5pc290cm9weSksIHJvdWdobmVzcyAvIDQuMCk7XG4gICAgZmxvYXQgYWIgPSBtYXgoKHJvdWdobmVzcyAtIGFuaXNvdHJvcHkpLCByb3VnaG5lc3MgLyA0LjApO1xuXG4gICAgZmxvYXQgTm9IID0gZG90KHdvcmxkTm9ybWFsLCBoKTtcbiAgICBmbG9hdCBUb0ggPSBkb3QodGJuWzBdLCBoKTtcbiAgICBmbG9hdCBCb0ggPSBkb3QodGJuWzFdLCBoKTtcblxuICAgIGZsb2F0IGEyID0gYXQgKiBhYjtcbiAgICB2ZWMzIHYgPSB2ZWMzKGFiICogVG9ILCBhdCAqIEJvSCwgYTIgKiBOb0gpO1xuICAgIGZsb2F0IHYyID0gZG90KHYsIHYpO1xuICAgIGZsb2F0IHcyID0gYTIgLyB2MjtcbiAgICBmbG9hdCBEID0gYTIgKiB3MiAqIHcyICogKDEuMCAvIFBJKTtcblxuICAgIGZsb2F0IFRvViA9IGRvdCh0Ym5bMF0sIHZpZXdEaXIpO1xuICAgIGZsb2F0IEJvViA9IGRvdCh0Ym5bMV0sIHZpZXdEaXIpO1xuICAgIGZsb2F0IFRvTCA9IGRvdCh0Ym5bMF0sIC1saWdodERpck5vcm0pO1xuICAgIGZsb2F0IEJvTCA9IGRvdCh0Ym5bMV0sIC1saWdodERpck5vcm0pO1xuICAgIGZsb2F0IE5vViA9IGRvdCh3b3JsZE5vcm1hbCwgdmlld0Rpcik7XG4gICAgZmxvYXQgTm9MID0gZG90KHdvcmxkTm9ybWFsLCAtbGlnaHREaXJOb3JtKTtcblxuICAgIGZsb2F0IGxhbWJkYVYgPSBOb0wgKiBsZW5ndGgodmVjMyhhdCAqIFRvViwgYWIgKiBCb1YsIE5vVikpO1xuICAgIGZsb2F0IGxhbWJkYUwgPSBOb1YgKiBsZW5ndGgodmVjMyhhdCAqIFRvTCwgYWIgKiBCb0wsIE5vTCkpO1xuICAgIGZsb2F0IEcgPSAwLjUgLyAobGFtYmRhViArIGxhbWJkYUwpO1xuXG4gICAgcmV0dXJuIEQgKiBHO1xufVxuXG5mbG9hdCBnZXRMaWdodFNwZWN1bGFyKHZlYzMgaCwgdmVjMyByZWZsRGlyLCB2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIsIHZlYzMgbGlnaHREaXJOb3JtLCBmbG9hdCBnbG9zcywgbWF0MyB0Ym4pIHtcbiAgICByZXR1cm4gY2FsY0xpZ2h0U3BlY3VsYXIoZ2xvc3MsIHdvcmxkTm9ybWFsLCB2aWV3RGlyLCBoLCBsaWdodERpck5vcm0sIHRibik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
