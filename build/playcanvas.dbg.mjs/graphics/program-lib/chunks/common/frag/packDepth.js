/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var packDepthPS = `
// Packing a float in GLSL with multiplication and mod
// http://blog.gradientstudios.com/2012/08/23/shadow-map-improvement
vec4 packFloat(float depth) {
    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);

    // combination of mod and multiplication and division works better
    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);
    res -= res.xxyz * bit_mask;
    return res;
}
`;

export { packDepthPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja0RlcHRoLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL3BhY2tEZXB0aC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gUGFja2luZyBhIGZsb2F0IGluIEdMU0wgd2l0aCBtdWx0aXBsaWNhdGlvbiBhbmQgbW9kXG4vLyBodHRwOi8vYmxvZy5ncmFkaWVudHN0dWRpb3MuY29tLzIwMTIvMDgvMjMvc2hhZG93LW1hcC1pbXByb3ZlbWVudFxudmVjNCBwYWNrRmxvYXQoZmxvYXQgZGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdF9zaGlmdCA9IHZlYzQoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wLCAyNTYuMCAqIDI1Ni4wLCAyNTYuMCwgMS4wKTtcbiAgICBjb25zdCB2ZWM0IGJpdF9tYXNrICA9IHZlYzQoMC4wLCAxLjAgLyAyNTYuMCwgMS4wIC8gMjU2LjAsIDEuMCAvIDI1Ni4wKTtcblxuICAgIC8vIGNvbWJpbmF0aW9uIG9mIG1vZCBhbmQgbXVsdGlwbGljYXRpb24gYW5kIGRpdmlzaW9uIHdvcmtzIGJldHRlclxuICAgIHZlYzQgcmVzID0gbW9kKGRlcHRoICogYml0X3NoaWZ0ICogdmVjNCgyNTUpLCB2ZWM0KDI1NikgKSAvIHZlYzQoMjU1KTtcbiAgICByZXMgLT0gcmVzLnh4eXogKiBiaXRfbWFzaztcbiAgICByZXR1cm4gcmVzO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVpBOzs7OyJ9
