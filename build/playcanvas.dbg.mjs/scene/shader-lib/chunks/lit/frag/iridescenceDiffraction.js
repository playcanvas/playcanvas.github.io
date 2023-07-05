var iridescenceDiffractionPS = /* glsl */`
uniform float material_iridescenceRefractionIndex;

#ifndef PI
#define PI 3.14159265
#endif

float iridescence_iorToFresnel(float transmittedIor, float incidentIor) {
    return pow((transmittedIor - incidentIor) / (transmittedIor + incidentIor), 2.0);
}

vec3 iridescence_iorToFresnel(vec3 transmittedIor, float incidentIor) {
    return pow((transmittedIor - vec3(incidentIor)) / (transmittedIor + vec3(incidentIor)), vec3(2.0));
}

vec3 iridescence_fresnelToIor(vec3 f0) {
    vec3 sqrtF0 = sqrt(f0);
    return (vec3(1.0) + sqrtF0) / (vec3(1.0) - sqrtF0);
}

vec3 iridescence_sensitivity(float opd, vec3 shift) {
    float phase = 2.0 * PI * opd * 1.0e-9;
    const vec3 val = vec3(5.4856e-13, 4.4201e-13, 5.2481e-13);
    const vec3 pos = vec3(1.6810e+06, 1.7953e+06, 2.2084e+06);
    const vec3 var = vec3(4.3278e+09, 9.3046e+09, 6.6121e+09);

    vec3 xyz = val * sqrt(2.0 * PI * var) * cos(pos * phase + shift) * exp(-pow(phase, 2.0) * var);
    xyz.x += 9.7470e-14 * sqrt(2.0 * PI * 4.5282e+09) * cos(2.2399e+06 * phase + shift[0]) * exp(-4.5282e+09 * pow(phase, 2.0));
    xyz /= vec3(1.0685e-07);

    const mat3 XYZ_TO_REC709 = mat3(
        3.2404542, -0.9692660,  0.0556434,
       -1.5371385,  1.8760108, -0.2040259,
       -0.4985314,  0.0415560,  1.0572252
    );

    return XYZ_TO_REC709 * xyz;
}

float iridescence_fresnel(float cosTheta, float f0) {
    float x = clamp(1.0 - cosTheta, 0.0, 1.0);
    float x2 = x * x;
    float x5 = x * x2 * x2;
    return f0 + (1.0 - f0) * x5;
} 

vec3 iridescence_fresnel(float cosTheta, vec3 f0) {
    float x = clamp(1.0 - cosTheta, 0.0, 1.0);
    float x2 = x * x;
    float x5 = x * x2 * x2; 
    return f0 + (vec3(1.0) - f0) * x5;
}

vec3 calcIridescence(float outsideIor, float cosTheta, vec3 base_f0, float iridescenceThickness) {

    float iridescenceIor = mix(outsideIor, material_iridescenceRefractionIndex, smoothstep(0.0, 0.03, iridescenceThickness));
    float sinTheta2Sq = pow(outsideIor / iridescenceIor, 2.0) * (1.0 - pow(cosTheta, 2.0));
    float cosTheta2Sq = 1.0 - sinTheta2Sq;

    if (cosTheta2Sq < 0.0) {
        return vec3(1.0);
    }

    float cosTheta2 = sqrt(cosTheta2Sq);

    float r0 = iridescence_iorToFresnel(iridescenceIor, outsideIor);
    float r12 = iridescence_fresnel(cosTheta, r0);
    float r21 = r12;
    float t121 = 1.0 - r12;

    float phi12 = iridescenceIor < outsideIor ? PI : 0.0;
    float phi21 = PI - phi12;

    vec3 baseIor = iridescence_fresnelToIor(base_f0 + vec3(0.0001));
    vec3 r1 = iridescence_iorToFresnel(baseIor, iridescenceIor);
    vec3 r23 = iridescence_fresnel(cosTheta2, r1);

    vec3 phi23 = vec3(0.0);
    if (baseIor[0] < iridescenceIor) phi23[0] = PI;
    if (baseIor[1] < iridescenceIor) phi23[1] = PI;
    if (baseIor[2] < iridescenceIor) phi23[2] = PI;
    float opd = 2.0 * iridescenceIor * iridescenceThickness * cosTheta2;
    vec3 phi = vec3(phi21) + phi23; 

    vec3 r123Sq = clamp(r12 * r23, 1e-5, 0.9999);
    vec3 r123 = sqrt(r123Sq);
    vec3 rs = pow(t121, 2.0) * r23 / (1.0 - r123Sq);

    vec3 c0 = r12 + rs;
    vec3 i = c0;

    vec3 cm = rs - t121;
    for (int m = 1; m <= 2; m++) {
        cm *= r123;
        vec3 sm = 2.0 * iridescence_sensitivity(float(m) * opd, float(m) * phi);
        i += cm * sm;
    }
    return max(i, vec3(0.0));
}

vec3 getIridescence(float cosTheta, vec3 specularity, inout IridescenceArgs iridescence) {
    return calcIridescence(1.0, cosTheta, specularity, iridescence.thickness);
}
`;

export { iridescenceDiffractionPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXJpZGVzY2VuY2VEaWZmcmFjdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2lyaWRlc2NlbmNlRGlmZnJhY3Rpb24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXg7XG5cbiNpZm5kZWYgUElcbiNkZWZpbmUgUEkgMy4xNDE1OTI2NVxuI2VuZGlmXG5cbmZsb2F0IGlyaWRlc2NlbmNlX2lvclRvRnJlc25lbChmbG9hdCB0cmFuc21pdHRlZElvciwgZmxvYXQgaW5jaWRlbnRJb3IpIHtcbiAgICByZXR1cm4gcG93KCh0cmFuc21pdHRlZElvciAtIGluY2lkZW50SW9yKSAvICh0cmFuc21pdHRlZElvciArIGluY2lkZW50SW9yKSwgMi4wKTtcbn1cblxudmVjMyBpcmlkZXNjZW5jZV9pb3JUb0ZyZXNuZWwodmVjMyB0cmFuc21pdHRlZElvciwgZmxvYXQgaW5jaWRlbnRJb3IpIHtcbiAgICByZXR1cm4gcG93KCh0cmFuc21pdHRlZElvciAtIHZlYzMoaW5jaWRlbnRJb3IpKSAvICh0cmFuc21pdHRlZElvciArIHZlYzMoaW5jaWRlbnRJb3IpKSwgdmVjMygyLjApKTtcbn1cblxudmVjMyBpcmlkZXNjZW5jZV9mcmVzbmVsVG9Jb3IodmVjMyBmMCkge1xuICAgIHZlYzMgc3FydEYwID0gc3FydChmMCk7XG4gICAgcmV0dXJuICh2ZWMzKDEuMCkgKyBzcXJ0RjApIC8gKHZlYzMoMS4wKSAtIHNxcnRGMCk7XG59XG5cbnZlYzMgaXJpZGVzY2VuY2Vfc2Vuc2l0aXZpdHkoZmxvYXQgb3BkLCB2ZWMzIHNoaWZ0KSB7XG4gICAgZmxvYXQgcGhhc2UgPSAyLjAgKiBQSSAqIG9wZCAqIDEuMGUtOTtcbiAgICBjb25zdCB2ZWMzIHZhbCA9IHZlYzMoNS40ODU2ZS0xMywgNC40MjAxZS0xMywgNS4yNDgxZS0xMyk7XG4gICAgY29uc3QgdmVjMyBwb3MgPSB2ZWMzKDEuNjgxMGUrMDYsIDEuNzk1M2UrMDYsIDIuMjA4NGUrMDYpO1xuICAgIGNvbnN0IHZlYzMgdmFyID0gdmVjMyg0LjMyNzhlKzA5LCA5LjMwNDZlKzA5LCA2LjYxMjFlKzA5KTtcblxuICAgIHZlYzMgeHl6ID0gdmFsICogc3FydCgyLjAgKiBQSSAqIHZhcikgKiBjb3MocG9zICogcGhhc2UgKyBzaGlmdCkgKiBleHAoLXBvdyhwaGFzZSwgMi4wKSAqIHZhcik7XG4gICAgeHl6LnggKz0gOS43NDcwZS0xNCAqIHNxcnQoMi4wICogUEkgKiA0LjUyODJlKzA5KSAqIGNvcygyLjIzOTllKzA2ICogcGhhc2UgKyBzaGlmdFswXSkgKiBleHAoLTQuNTI4MmUrMDkgKiBwb3cocGhhc2UsIDIuMCkpO1xuICAgIHh5eiAvPSB2ZWMzKDEuMDY4NWUtMDcpO1xuXG4gICAgY29uc3QgbWF0MyBYWVpfVE9fUkVDNzA5ID0gbWF0MyhcbiAgICAgICAgMy4yNDA0NTQyLCAtMC45NjkyNjYwLCAgMC4wNTU2NDM0LFxuICAgICAgIC0xLjUzNzEzODUsICAxLjg3NjAxMDgsIC0wLjIwNDAyNTksXG4gICAgICAgLTAuNDk4NTMxNCwgIDAuMDQxNTU2MCwgIDEuMDU3MjI1MlxuICAgICk7XG5cbiAgICByZXR1cm4gWFlaX1RPX1JFQzcwOSAqIHh5ejtcbn1cblxuZmxvYXQgaXJpZGVzY2VuY2VfZnJlc25lbChmbG9hdCBjb3NUaGV0YSwgZmxvYXQgZjApIHtcbiAgICBmbG9hdCB4ID0gY2xhbXAoMS4wIC0gY29zVGhldGEsIDAuMCwgMS4wKTtcbiAgICBmbG9hdCB4MiA9IHggKiB4O1xuICAgIGZsb2F0IHg1ID0geCAqIHgyICogeDI7XG4gICAgcmV0dXJuIGYwICsgKDEuMCAtIGYwKSAqIHg1O1xufSBcblxudmVjMyBpcmlkZXNjZW5jZV9mcmVzbmVsKGZsb2F0IGNvc1RoZXRhLCB2ZWMzIGYwKSB7XG4gICAgZmxvYXQgeCA9IGNsYW1wKDEuMCAtIGNvc1RoZXRhLCAwLjAsIDEuMCk7XG4gICAgZmxvYXQgeDIgPSB4ICogeDtcbiAgICBmbG9hdCB4NSA9IHggKiB4MiAqIHgyOyBcbiAgICByZXR1cm4gZjAgKyAodmVjMygxLjApIC0gZjApICogeDU7XG59XG5cbnZlYzMgY2FsY0lyaWRlc2NlbmNlKGZsb2F0IG91dHNpZGVJb3IsIGZsb2F0IGNvc1RoZXRhLCB2ZWMzIGJhc2VfZjAsIGZsb2F0IGlyaWRlc2NlbmNlVGhpY2tuZXNzKSB7XG5cbiAgICBmbG9hdCBpcmlkZXNjZW5jZUlvciA9IG1peChvdXRzaWRlSW9yLCBtYXRlcmlhbF9pcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCwgc21vb3Roc3RlcCgwLjAsIDAuMDMsIGlyaWRlc2NlbmNlVGhpY2tuZXNzKSk7XG4gICAgZmxvYXQgc2luVGhldGEyU3EgPSBwb3cob3V0c2lkZUlvciAvIGlyaWRlc2NlbmNlSW9yLCAyLjApICogKDEuMCAtIHBvdyhjb3NUaGV0YSwgMi4wKSk7XG4gICAgZmxvYXQgY29zVGhldGEyU3EgPSAxLjAgLSBzaW5UaGV0YTJTcTtcblxuICAgIGlmIChjb3NUaGV0YTJTcSA8IDAuMCkge1xuICAgICAgICByZXR1cm4gdmVjMygxLjApO1xuICAgIH1cblxuICAgIGZsb2F0IGNvc1RoZXRhMiA9IHNxcnQoY29zVGhldGEyU3EpO1xuXG4gICAgZmxvYXQgcjAgPSBpcmlkZXNjZW5jZV9pb3JUb0ZyZXNuZWwoaXJpZGVzY2VuY2VJb3IsIG91dHNpZGVJb3IpO1xuICAgIGZsb2F0IHIxMiA9IGlyaWRlc2NlbmNlX2ZyZXNuZWwoY29zVGhldGEsIHIwKTtcbiAgICBmbG9hdCByMjEgPSByMTI7XG4gICAgZmxvYXQgdDEyMSA9IDEuMCAtIHIxMjtcblxuICAgIGZsb2F0IHBoaTEyID0gaXJpZGVzY2VuY2VJb3IgPCBvdXRzaWRlSW9yID8gUEkgOiAwLjA7XG4gICAgZmxvYXQgcGhpMjEgPSBQSSAtIHBoaTEyO1xuXG4gICAgdmVjMyBiYXNlSW9yID0gaXJpZGVzY2VuY2VfZnJlc25lbFRvSW9yKGJhc2VfZjAgKyB2ZWMzKDAuMDAwMSkpO1xuICAgIHZlYzMgcjEgPSBpcmlkZXNjZW5jZV9pb3JUb0ZyZXNuZWwoYmFzZUlvciwgaXJpZGVzY2VuY2VJb3IpO1xuICAgIHZlYzMgcjIzID0gaXJpZGVzY2VuY2VfZnJlc25lbChjb3NUaGV0YTIsIHIxKTtcblxuICAgIHZlYzMgcGhpMjMgPSB2ZWMzKDAuMCk7XG4gICAgaWYgKGJhc2VJb3JbMF0gPCBpcmlkZXNjZW5jZUlvcikgcGhpMjNbMF0gPSBQSTtcbiAgICBpZiAoYmFzZUlvclsxXSA8IGlyaWRlc2NlbmNlSW9yKSBwaGkyM1sxXSA9IFBJO1xuICAgIGlmIChiYXNlSW9yWzJdIDwgaXJpZGVzY2VuY2VJb3IpIHBoaTIzWzJdID0gUEk7XG4gICAgZmxvYXQgb3BkID0gMi4wICogaXJpZGVzY2VuY2VJb3IgKiBpcmlkZXNjZW5jZVRoaWNrbmVzcyAqIGNvc1RoZXRhMjtcbiAgICB2ZWMzIHBoaSA9IHZlYzMocGhpMjEpICsgcGhpMjM7IFxuXG4gICAgdmVjMyByMTIzU3EgPSBjbGFtcChyMTIgKiByMjMsIDFlLTUsIDAuOTk5OSk7XG4gICAgdmVjMyByMTIzID0gc3FydChyMTIzU3EpO1xuICAgIHZlYzMgcnMgPSBwb3codDEyMSwgMi4wKSAqIHIyMyAvICgxLjAgLSByMTIzU3EpO1xuXG4gICAgdmVjMyBjMCA9IHIxMiArIHJzO1xuICAgIHZlYzMgaSA9IGMwO1xuXG4gICAgdmVjMyBjbSA9IHJzIC0gdDEyMTtcbiAgICBmb3IgKGludCBtID0gMTsgbSA8PSAyOyBtKyspIHtcbiAgICAgICAgY20gKj0gcjEyMztcbiAgICAgICAgdmVjMyBzbSA9IDIuMCAqIGlyaWRlc2NlbmNlX3NlbnNpdGl2aXR5KGZsb2F0KG0pICogb3BkLCBmbG9hdChtKSAqIHBoaSk7XG4gICAgICAgIGkgKz0gY20gKiBzbTtcbiAgICB9XG4gICAgcmV0dXJuIG1heChpLCB2ZWMzKDAuMCkpO1xufVxuXG52ZWMzIGdldElyaWRlc2NlbmNlKGZsb2F0IGNvc1RoZXRhLCB2ZWMzIHNwZWN1bGFyaXR5LCBpbm91dCBJcmlkZXNjZW5jZUFyZ3MgaXJpZGVzY2VuY2UpIHtcbiAgICByZXR1cm4gY2FsY0lyaWRlc2NlbmNlKDEuMCwgY29zVGhldGEsIHNwZWN1bGFyaXR5LCBpcmlkZXNjZW5jZS50aGlja25lc3MpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
