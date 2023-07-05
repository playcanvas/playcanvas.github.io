/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particlePS = `
varying vec4 texCoordsAlphaLife;

uniform sampler2D colorMap;
uniform sampler2D colorParam;
uniform float graphSampleSize;
uniform float graphNumSamples;

#ifndef CAMERAPLANES
#define CAMERAPLANES
uniform vec4 camera_params;
#endif

uniform float softening;
uniform float colorMult;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    float depth = dot(rgbaDepth, bitShift);
    return depth;
}
#endif

void main(void) {
    vec4 tex  = gammaCorrectInput(texture2D(colorMap, vec2(texCoordsAlphaLife.x, 1.0 - texCoordsAlphaLife.y)));
    vec4 ramp = gammaCorrectInput(texture2D(colorParam, vec2(texCoordsAlphaLife.w, 0.0)));
    ramp.rgb *= colorMult;

    ramp.a += texCoordsAlphaLife.z;

    vec3 rgb = tex.rgb * ramp.rgb;
    float a  = tex.a * ramp.a;
`;

export { particlePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmFyeWluZyB2ZWM0IHRleENvb3Jkc0FscGhhTGlmZTtcblxudW5pZm9ybSBzYW1wbGVyMkQgY29sb3JNYXA7XG51bmlmb3JtIHNhbXBsZXIyRCBjb2xvclBhcmFtO1xudW5pZm9ybSBmbG9hdCBncmFwaFNhbXBsZVNpemU7XG51bmlmb3JtIGZsb2F0IGdyYXBoTnVtU2FtcGxlcztcblxuI2lmbmRlZiBDQU1FUkFQTEFORVNcbiNkZWZpbmUgQ0FNRVJBUExBTkVTXG51bmlmb3JtIHZlYzQgY2FtZXJhX3BhcmFtcztcbiNlbmRpZlxuXG51bmlmb3JtIGZsb2F0IHNvZnRlbmluZztcbnVuaWZvcm0gZmxvYXQgY29sb3JNdWx0O1xuXG5mbG9hdCBzYXR1cmF0ZShmbG9hdCB4KSB7XG4gICAgcmV0dXJuIGNsYW1wKHgsIDAuMCwgMS4wKTtcbn1cblxuI2lmbmRlZiBVTlBBQ0tGTE9BVFxuI2RlZmluZSBVTlBBQ0tGTE9BVFxuZmxvYXQgdW5wYWNrRmxvYXQodmVjNCByZ2JhRGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdFNoaWZ0ID0gdmVjNCgxLjAgLyAoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wKSwgMS4wIC8gKDI1Ni4wICogMjU2LjApLCAxLjAgLyAyNTYuMCwgMS4wKTtcbiAgICBmbG9hdCBkZXB0aCA9IGRvdChyZ2JhRGVwdGgsIGJpdFNoaWZ0KTtcbiAgICByZXR1cm4gZGVwdGg7XG59XG4jZW5kaWZcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICB2ZWM0IHRleCAgPSBnYW1tYUNvcnJlY3RJbnB1dCh0ZXh0dXJlMkQoY29sb3JNYXAsIHZlYzIodGV4Q29vcmRzQWxwaGFMaWZlLngsIDEuMCAtIHRleENvb3Jkc0FscGhhTGlmZS55KSkpO1xuICAgIHZlYzQgcmFtcCA9IGdhbW1hQ29ycmVjdElucHV0KHRleHR1cmUyRChjb2xvclBhcmFtLCB2ZWMyKHRleENvb3Jkc0FscGhhTGlmZS53LCAwLjApKSk7XG4gICAgcmFtcC5yZ2IgKj0gY29sb3JNdWx0O1xuXG4gICAgcmFtcC5hICs9IHRleENvb3Jkc0FscGhhTGlmZS56O1xuXG4gICAgdmVjMyByZ2IgPSB0ZXgucmdiICogcmFtcC5yZ2I7XG4gICAgZmxvYXQgYSAgPSB0ZXguYSAqIHJhbXAuYTtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxpQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBdENBOzs7OyJ9
