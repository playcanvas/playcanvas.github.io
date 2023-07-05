var linearizeDepthPS = /* glsl */`

#ifndef LINEARIZE_DEPTH
#define LINEARIZE_DEPTH

float linearizeDepth(float z, vec4 cameraParams) {
    if (cameraParams.w == 0.0)
        return (cameraParams.z * cameraParams.y) / (cameraParams.y + z * (cameraParams.z - cameraParams.y));
    else
        return cameraParams.z + z * (cameraParams.y - cameraParams.z);
}

#ifndef CAMERAPLANES
#define CAMERAPLANES
uniform vec4 camera_params; // x: 1 / camera_far,      y: camera_far,     z: camera_near,        w: is_ortho
#endif

#ifdef GL2
float linearizeDepth(float z) {
    return linearizeDepth(z, camera_params);
}
#else
#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}
#endif
#endif
#endif
`;

export { linearizeDepthPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGluZWFyaXplRGVwdGguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy9saW5lYXJpemVEZXB0aC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG4jaWZuZGVmIExJTkVBUklaRV9ERVBUSFxuI2RlZmluZSBMSU5FQVJJWkVfREVQVEhcblxuZmxvYXQgbGluZWFyaXplRGVwdGgoZmxvYXQgeiwgdmVjNCBjYW1lcmFQYXJhbXMpIHtcbiAgICBpZiAoY2FtZXJhUGFyYW1zLncgPT0gMC4wKVxuICAgICAgICByZXR1cm4gKGNhbWVyYVBhcmFtcy56ICogY2FtZXJhUGFyYW1zLnkpIC8gKGNhbWVyYVBhcmFtcy55ICsgeiAqIChjYW1lcmFQYXJhbXMueiAtIGNhbWVyYVBhcmFtcy55KSk7XG4gICAgZWxzZVxuICAgICAgICByZXR1cm4gY2FtZXJhUGFyYW1zLnogKyB6ICogKGNhbWVyYVBhcmFtcy55IC0gY2FtZXJhUGFyYW1zLnopO1xufVxuXG4jaWZuZGVmIENBTUVSQVBMQU5FU1xuI2RlZmluZSBDQU1FUkFQTEFORVNcbnVuaWZvcm0gdmVjNCBjYW1lcmFfcGFyYW1zOyAvLyB4OiAxIC8gY2FtZXJhX2ZhciwgICAgICB5OiBjYW1lcmFfZmFyLCAgICAgejogY2FtZXJhX25lYXIsICAgICAgICB3OiBpc19vcnRob1xuI2VuZGlmXG5cbiNpZmRlZiBHTDJcbmZsb2F0IGxpbmVhcml6ZURlcHRoKGZsb2F0IHopIHtcbiAgICByZXR1cm4gbGluZWFyaXplRGVwdGgoeiwgY2FtZXJhX3BhcmFtcyk7XG59XG4jZWxzZVxuI2lmbmRlZiBVTlBBQ0tGTE9BVFxuI2RlZmluZSBVTlBBQ0tGTE9BVFxuZmxvYXQgdW5wYWNrRmxvYXQodmVjNCByZ2JhRGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdFNoaWZ0ID0gdmVjNCgxLjAgLyAoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wKSwgMS4wIC8gKDI1Ni4wICogMjU2LjApLCAxLjAgLyAyNTYuMCwgMS4wKTtcbiAgICByZXR1cm4gZG90KHJnYmFEZXB0aCwgYml0U2hpZnQpO1xufVxuI2VuZGlmXG4jZW5kaWZcbiNlbmRpZlxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx1QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
