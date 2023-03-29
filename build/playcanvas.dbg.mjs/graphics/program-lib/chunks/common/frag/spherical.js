/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var sphericalPS = `
// equirectangular helper functions
const float PI = 3.141592653589793;

vec2 toSpherical(vec3 dir) {
    return vec2(dir.xz == vec2(0.0) ? 0.0 : atan(dir.x, dir.z), asin(dir.y));
}

vec2 toSphericalUv(vec3 dir) {
    vec2 uv = toSpherical(dir) / vec2(PI * 2.0, PI) + 0.5;
    return vec2(uv.x, 1.0 - uv.y);
}
`;

export { sphericalPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BoZXJpY2FsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL3NwaGVyaWNhbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gZXF1aXJlY3Rhbmd1bGFyIGhlbHBlciBmdW5jdGlvbnNcbmNvbnN0IGZsb2F0IFBJID0gMy4xNDE1OTI2NTM1ODk3OTM7XG5cbnZlYzIgdG9TcGhlcmljYWwodmVjMyBkaXIpIHtcbiAgICByZXR1cm4gdmVjMihkaXIueHogPT0gdmVjMigwLjApID8gMC4wIDogYXRhbihkaXIueCwgZGlyLnopLCBhc2luKGRpci55KSk7XG59XG5cbnZlYzIgdG9TcGhlcmljYWxVdih2ZWMzIGRpcikge1xuICAgIHZlYzIgdXYgPSB0b1NwaGVyaWNhbChkaXIpIC8gdmVjMihQSSAqIDIuMCwgUEkpICsgMC41O1xuICAgIHJldHVybiB2ZWMyKHV2LngsIDEuMCAtIHV2LnkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVpBOzs7OyJ9
