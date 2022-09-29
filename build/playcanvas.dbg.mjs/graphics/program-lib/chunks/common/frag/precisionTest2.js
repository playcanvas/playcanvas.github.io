/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var precisionTest2PS = `
uniform sampler2D source;

vec4 packFloat(float depth) {
    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);

    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);
    res -= res.xxyz * bit_mask;
    return res;
}

void main(void) {
    float c = texture2D(source, vec2(0.0)).r;
    float diff = abs(c - 2147483648.0) / 2147483648.0;
    gl_FragColor = packFloat(diff);
}
`;

export { precisionTest2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlY2lzaW9uVGVzdDIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvcHJlY2lzaW9uVGVzdDIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcblxudmVjNCBwYWNrRmxvYXQoZmxvYXQgZGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdF9zaGlmdCA9IHZlYzQoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wLCAyNTYuMCAqIDI1Ni4wLCAyNTYuMCwgMS4wKTtcbiAgICBjb25zdCB2ZWM0IGJpdF9tYXNrICA9IHZlYzQoMC4wLCAxLjAgLyAyNTYuMCwgMS4wIC8gMjU2LjAsIDEuMCAvIDI1Ni4wKTtcblxuICAgIHZlYzQgcmVzID0gbW9kKGRlcHRoICogYml0X3NoaWZ0ICogdmVjNCgyNTUpLCB2ZWM0KDI1NikgKSAvIHZlYzQoMjU1KTtcbiAgICByZXMgLT0gcmVzLnh4eXogKiBiaXRfbWFzaztcbiAgICByZXR1cm4gcmVzO1xufVxuXG52b2lkIG1haW4odm9pZCkge1xuICAgIGZsb2F0IGMgPSB0ZXh0dXJlMkQoc291cmNlLCB2ZWMyKDAuMCkpLnI7XG4gICAgZmxvYXQgZGlmZiA9IGFicyhjIC0gMjE0NzQ4MzY0OC4wKSAvIDIxNDc0ODM2NDguMDtcbiAgICBnbF9GcmFnQ29sb3IgPSBwYWNrRmxvYXQoZGlmZik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQWpCQTs7OzsifQ==
