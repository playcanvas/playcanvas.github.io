/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var iridescenceDiffractionPS = `
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

vec3 calcIridescence(float outsideIor, float cosTheta, vec3 base_f0) {

    float iridescenceIor = mix(outsideIor, material_iridescenceRefractionIndex, smoothstep(0.0, 0.03, dIridescenceThickness));
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
    float opd = 2.0 * iridescenceIor * dIridescenceThickness * cosTheta2;
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

void getIridescence(float cosTheta) {
    dIridescenceFresnel = calcIridescence(1.0, cosTheta, dSpecularity);
}
`;

export { iridescenceDiffractionPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXJpZGVzY2VuY2VEaWZmcmFjdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9pcmlkZXNjZW5jZURpZmZyYWN0aW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2lyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4O1xuXG4jaWZuZGVmIFBJXG4jZGVmaW5lIFBJIDMuMTQxNTkyNjVcbiNlbmRpZlxuXG5mbG9hdCBpcmlkZXNjZW5jZV9pb3JUb0ZyZXNuZWwoZmxvYXQgdHJhbnNtaXR0ZWRJb3IsIGZsb2F0IGluY2lkZW50SW9yKSB7XG4gICAgcmV0dXJuIHBvdygodHJhbnNtaXR0ZWRJb3IgLSBpbmNpZGVudElvcikgLyAodHJhbnNtaXR0ZWRJb3IgKyBpbmNpZGVudElvciksIDIuMCk7XG59XG5cbnZlYzMgaXJpZGVzY2VuY2VfaW9yVG9GcmVzbmVsKHZlYzMgdHJhbnNtaXR0ZWRJb3IsIGZsb2F0IGluY2lkZW50SW9yKSB7XG4gICAgcmV0dXJuIHBvdygodHJhbnNtaXR0ZWRJb3IgLSB2ZWMzKGluY2lkZW50SW9yKSkgLyAodHJhbnNtaXR0ZWRJb3IgKyB2ZWMzKGluY2lkZW50SW9yKSksIHZlYzMoMi4wKSk7XG59XG5cbnZlYzMgaXJpZGVzY2VuY2VfZnJlc25lbFRvSW9yKHZlYzMgZjApIHtcbiAgICB2ZWMzIHNxcnRGMCA9IHNxcnQoZjApO1xuICAgIHJldHVybiAodmVjMygxLjApICsgc3FydEYwKSAvICh2ZWMzKDEuMCkgLSBzcXJ0RjApO1xufVxuXG52ZWMzIGlyaWRlc2NlbmNlX3NlbnNpdGl2aXR5KGZsb2F0IG9wZCwgdmVjMyBzaGlmdCkge1xuICAgIGZsb2F0IHBoYXNlID0gMi4wICogUEkgKiBvcGQgKiAxLjBlLTk7XG4gICAgY29uc3QgdmVjMyB2YWwgPSB2ZWMzKDUuNDg1NmUtMTMsIDQuNDIwMWUtMTMsIDUuMjQ4MWUtMTMpO1xuICAgIGNvbnN0IHZlYzMgcG9zID0gdmVjMygxLjY4MTBlKzA2LCAxLjc5NTNlKzA2LCAyLjIwODRlKzA2KTtcbiAgICBjb25zdCB2ZWMzIHZhciA9IHZlYzMoNC4zMjc4ZSswOSwgOS4zMDQ2ZSswOSwgNi42MTIxZSswOSk7XG5cbiAgICB2ZWMzIHh5eiA9IHZhbCAqIHNxcnQoMi4wICogUEkgKiB2YXIpICogY29zKHBvcyAqIHBoYXNlICsgc2hpZnQpICogZXhwKC1wb3cocGhhc2UsIDIuMCkgKiB2YXIpO1xuICAgIHh5ei54ICs9IDkuNzQ3MGUtMTQgKiBzcXJ0KDIuMCAqIFBJICogNC41MjgyZSswOSkgKiBjb3MoMi4yMzk5ZSswNiAqIHBoYXNlICsgc2hpZnRbMF0pICogZXhwKC00LjUyODJlKzA5ICogcG93KHBoYXNlLCAyLjApKTtcbiAgICB4eXogLz0gdmVjMygxLjA2ODVlLTA3KTtcblxuICAgIGNvbnN0IG1hdDMgWFlaX1RPX1JFQzcwOSA9IG1hdDMoXG4gICAgICAgIDMuMjQwNDU0MiwgLTAuOTY5MjY2MCwgIDAuMDU1NjQzNCxcbiAgICAgICAtMS41MzcxMzg1LCAgMS44NzYwMTA4LCAtMC4yMDQwMjU5LFxuICAgICAgIC0wLjQ5ODUzMTQsICAwLjA0MTU1NjAsICAxLjA1NzIyNTJcbiAgICApO1xuXG4gICAgcmV0dXJuIFhZWl9UT19SRUM3MDkgKiB4eXo7XG59XG5cbmZsb2F0IGlyaWRlc2NlbmNlX2ZyZXNuZWwoZmxvYXQgY29zVGhldGEsIGZsb2F0IGYwKSB7XG4gICAgZmxvYXQgeCA9IGNsYW1wKDEuMCAtIGNvc1RoZXRhLCAwLjAsIDEuMCk7XG4gICAgZmxvYXQgeDIgPSB4ICogeDtcbiAgICBmbG9hdCB4NSA9IHggKiB4MiAqIHgyO1xuICAgIHJldHVybiBmMCArICgxLjAgLSBmMCkgKiB4NTtcbn0gXG5cbnZlYzMgaXJpZGVzY2VuY2VfZnJlc25lbChmbG9hdCBjb3NUaGV0YSwgdmVjMyBmMCkge1xuICAgIGZsb2F0IHggPSBjbGFtcCgxLjAgLSBjb3NUaGV0YSwgMC4wLCAxLjApO1xuICAgIGZsb2F0IHgyID0geCAqIHg7XG4gICAgZmxvYXQgeDUgPSB4ICogeDIgKiB4MjsgXG4gICAgcmV0dXJuIGYwICsgKHZlYzMoMS4wKSAtIGYwKSAqIHg1O1xufVxuXG52ZWMzIGNhbGNJcmlkZXNjZW5jZShmbG9hdCBvdXRzaWRlSW9yLCBmbG9hdCBjb3NUaGV0YSwgdmVjMyBiYXNlX2YwKSB7XG5cbiAgICBmbG9hdCBpcmlkZXNjZW5jZUlvciA9IG1peChvdXRzaWRlSW9yLCBtYXRlcmlhbF9pcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCwgc21vb3Roc3RlcCgwLjAsIDAuMDMsIGRJcmlkZXNjZW5jZVRoaWNrbmVzcykpO1xuICAgIGZsb2F0IHNpblRoZXRhMlNxID0gcG93KG91dHNpZGVJb3IgLyBpcmlkZXNjZW5jZUlvciwgMi4wKSAqICgxLjAgLSBwb3coY29zVGhldGEsIDIuMCkpO1xuICAgIGZsb2F0IGNvc1RoZXRhMlNxID0gMS4wIC0gc2luVGhldGEyU3E7XG5cbiAgICBpZiAoY29zVGhldGEyU3EgPCAwLjApIHtcbiAgICAgICAgcmV0dXJuIHZlYzMoMS4wKTtcbiAgICB9XG5cbiAgICBmbG9hdCBjb3NUaGV0YTIgPSBzcXJ0KGNvc1RoZXRhMlNxKTtcblxuICAgIGZsb2F0IHIwID0gaXJpZGVzY2VuY2VfaW9yVG9GcmVzbmVsKGlyaWRlc2NlbmNlSW9yLCBvdXRzaWRlSW9yKTtcbiAgICBmbG9hdCByMTIgPSBpcmlkZXNjZW5jZV9mcmVzbmVsKGNvc1RoZXRhLCByMCk7XG4gICAgZmxvYXQgcjIxID0gcjEyO1xuICAgIGZsb2F0IHQxMjEgPSAxLjAgLSByMTI7XG5cbiAgICBmbG9hdCBwaGkxMiA9IGlyaWRlc2NlbmNlSW9yIDwgb3V0c2lkZUlvciA/IFBJIDogMC4wO1xuICAgIGZsb2F0IHBoaTIxID0gUEkgLSBwaGkxMjtcblxuICAgIHZlYzMgYmFzZUlvciA9IGlyaWRlc2NlbmNlX2ZyZXNuZWxUb0lvcihiYXNlX2YwICsgdmVjMygwLjAwMDEpKTtcbiAgICB2ZWMzIHIxID0gaXJpZGVzY2VuY2VfaW9yVG9GcmVzbmVsKGJhc2VJb3IsIGlyaWRlc2NlbmNlSW9yKTtcbiAgICB2ZWMzIHIyMyA9IGlyaWRlc2NlbmNlX2ZyZXNuZWwoY29zVGhldGEyLCByMSk7XG5cbiAgICB2ZWMzIHBoaTIzID0gdmVjMygwLjApO1xuICAgIGlmIChiYXNlSW9yWzBdIDwgaXJpZGVzY2VuY2VJb3IpIHBoaTIzWzBdID0gUEk7XG4gICAgaWYgKGJhc2VJb3JbMV0gPCBpcmlkZXNjZW5jZUlvcikgcGhpMjNbMV0gPSBQSTtcbiAgICBpZiAoYmFzZUlvclsyXSA8IGlyaWRlc2NlbmNlSW9yKSBwaGkyM1syXSA9IFBJO1xuICAgIGZsb2F0IG9wZCA9IDIuMCAqIGlyaWRlc2NlbmNlSW9yICogZElyaWRlc2NlbmNlVGhpY2tuZXNzICogY29zVGhldGEyO1xuICAgIHZlYzMgcGhpID0gdmVjMyhwaGkyMSkgKyBwaGkyMzsgXG5cbiAgICB2ZWMzIHIxMjNTcSA9IGNsYW1wKHIxMiAqIHIyMywgMWUtNSwgMC45OTk5KTtcbiAgICB2ZWMzIHIxMjMgPSBzcXJ0KHIxMjNTcSk7XG4gICAgdmVjMyBycyA9IHBvdyh0MTIxLCAyLjApICogcjIzIC8gKDEuMCAtIHIxMjNTcSk7XG5cbiAgICB2ZWMzIGMwID0gcjEyICsgcnM7XG4gICAgdmVjMyBpID0gYzA7XG5cbiAgICB2ZWMzIGNtID0gcnMgLSB0MTIxO1xuICAgIGZvciAoaW50IG0gPSAxOyBtIDw9IDI7IG0rKykge1xuICAgICAgICBjbSAqPSByMTIzO1xuICAgICAgICB2ZWMzIHNtID0gMi4wICogaXJpZGVzY2VuY2Vfc2Vuc2l0aXZpdHkoZmxvYXQobSkgKiBvcGQsIGZsb2F0KG0pICogcGhpKTtcbiAgICAgICAgaSArPSBjbSAqIHNtO1xuICAgIH1cbiAgICByZXR1cm4gbWF4KGksIHZlYzMoMC4wKSk7XG59XG5cbnZvaWQgZ2V0SXJpZGVzY2VuY2UoZmxvYXQgY29zVGhldGEpIHtcbiAgICBkSXJpZGVzY2VuY2VGcmVzbmVsID0gY2FsY0lyaWRlc2NlbmNlKDEuMCwgY29zVGhldGEsIGRTcGVjdWxhcml0eSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsK0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0F2R0E7Ozs7In0=
