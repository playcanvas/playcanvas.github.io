/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var decodePS = `
vec3 decodeLinear(vec4 raw) {
    return raw.rgb;
}

float decodeGamma(float raw) {
    return pow(raw, 2.2);
}

vec3 decodeGamma(vec3 raw) {
    return pow(raw, vec3(2.2));
}

vec3 decodeGamma(vec4 raw) {
    return pow(raw.xyz, vec3(2.2));
}

vec3 decodeRGBM(vec4 raw) {
    vec3 color = (8.0 * raw.a) * raw.rgb;
    return color * color;
}

vec3 decodeRGBP(vec4 raw) {
    vec3 color = raw.rgb * (-raw.a * 7.0 + 8.0);
    return color * color;
}

vec3 decodeRGBE(vec4 raw) {
    if (raw.a == 0.0) {
        return vec3(0.0, 0.0, 0.0);
    } else {
        return raw.xyz * pow(2.0, raw.w * 255.0 - 128.0);
    }
}

vec4 passThrough(vec4 raw) {
    return raw;
}
`;

export { decodePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb2RlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL2RlY29kZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyBkZWNvZGVMaW5lYXIodmVjNCByYXcpIHtcbiAgICByZXR1cm4gcmF3LnJnYjtcbn1cblxuZmxvYXQgZGVjb2RlR2FtbWEoZmxvYXQgcmF3KSB7XG4gICAgcmV0dXJuIHBvdyhyYXcsIDIuMik7XG59XG5cbnZlYzMgZGVjb2RlR2FtbWEodmVjMyByYXcpIHtcbiAgICByZXR1cm4gcG93KHJhdywgdmVjMygyLjIpKTtcbn1cblxudmVjMyBkZWNvZGVHYW1tYSh2ZWM0IHJhdykge1xuICAgIHJldHVybiBwb3cocmF3Lnh5eiwgdmVjMygyLjIpKTtcbn1cblxudmVjMyBkZWNvZGVSR0JNKHZlYzQgcmF3KSB7XG4gICAgdmVjMyBjb2xvciA9ICg4LjAgKiByYXcuYSkgKiByYXcucmdiO1xuICAgIHJldHVybiBjb2xvciAqIGNvbG9yO1xufVxuXG52ZWMzIGRlY29kZVJHQlAodmVjNCByYXcpIHtcbiAgICB2ZWMzIGNvbG9yID0gcmF3LnJnYiAqICgtcmF3LmEgKiA3LjAgKyA4LjApO1xuICAgIHJldHVybiBjb2xvciAqIGNvbG9yO1xufVxuXG52ZWMzIGRlY29kZVJHQkUodmVjNCByYXcpIHtcbiAgICBpZiAocmF3LmEgPT0gMC4wKSB7XG4gICAgICAgIHJldHVybiB2ZWMzKDAuMCwgMC4wLCAwLjApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByYXcueHl6ICogcG93KDIuMCwgcmF3LncgKiAyNTUuMCAtIDEyOC4wKTtcbiAgICB9XG59XG5cbnZlYzQgcGFzc1Rocm91Z2godmVjNCByYXcpIHtcbiAgICByZXR1cm4gcmF3O1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGVBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXRDQTs7OzsifQ==
