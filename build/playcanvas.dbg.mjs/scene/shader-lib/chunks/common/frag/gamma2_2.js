var gamma2_2PS = /* glsl */`
float gammaCorrectInput(float color) {
    return decodeGamma(color);
}

vec3 gammaCorrectInput(vec3 color) {
    return decodeGamma(color);
}

vec4 gammaCorrectInput(vec4 color) {
    return vec4(decodeGamma(color.xyz), color.w);
}

vec3 gammaCorrectOutput(vec3 color) {
#ifdef HDR
    return color;
#else
    return pow(color + 0.0000001, vec3(1.0 / 2.2));
#endif
}
`;

export { gamma2_2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtbWEyXzIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy9nYW1tYTJfMi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuZmxvYXQgZ2FtbWFDb3JyZWN0SW5wdXQoZmxvYXQgY29sb3IpIHtcbiAgICByZXR1cm4gZGVjb2RlR2FtbWEoY29sb3IpO1xufVxuXG52ZWMzIGdhbW1hQ29ycmVjdElucHV0KHZlYzMgY29sb3IpIHtcbiAgICByZXR1cm4gZGVjb2RlR2FtbWEoY29sb3IpO1xufVxuXG52ZWM0IGdhbW1hQ29ycmVjdElucHV0KHZlYzQgY29sb3IpIHtcbiAgICByZXR1cm4gdmVjNChkZWNvZGVHYW1tYShjb2xvci54eXopLCBjb2xvci53KTtcbn1cblxudmVjMyBnYW1tYUNvcnJlY3RPdXRwdXQodmVjMyBjb2xvcikge1xuI2lmZGVmIEhEUlxuICAgIHJldHVybiBjb2xvcjtcbiNlbHNlXG4gICAgcmV0dXJuIHBvdyhjb2xvciArIDAuMDAwMDAwMSwgdmVjMygxLjAgLyAyLjIpKTtcbiNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxpQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
