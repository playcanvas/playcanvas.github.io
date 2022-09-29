/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var screenDepthPS = `
uniform highp sampler2D uSceneDepthMap;

#ifndef SCREENSIZE
#define SCREENSIZE
uniform vec4 uScreenSize;
#endif

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif



#ifndef CAMERAPLANES
#define CAMERAPLANES
uniform vec4 camera_params; // 1 / camera_far,      camera_far,     camera_near,        is_ortho
#endif

#ifdef GL2
float linearizeDepth(float z) {
    if (camera_params.w == 0.0)
        return (camera_params.z * camera_params.y) / (camera_params.y + z * (camera_params.z - camera_params.y));
    else
        return camera_params.z + z * (camera_params.y - camera_params.z);
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

// Retrieves rendered linear camera depth by UV
float getLinearScreenDepth(vec2 uv) {
    #ifdef GL2
        return linearizeDepth(texture2D(uSceneDepthMap, uv).r);
    #else
        return unpackFloat(texture2D(uSceneDepthMap, uv)) * camera_params.y;
    #endif
}

#ifndef VERTEXSHADER
// Retrieves rendered linear camera depth under the current pixel
float getLinearScreenDepth() {
    vec2 uv = gl_FragCoord.xy * uScreenSize.zw;
    return getLinearScreenDepth(uv);
}
#endif

// Generates linear camera depth for the given world position
float getLinearDepth(vec3 pos) {
    return -(matrix_view * vec4(pos, 1.0)).z;
}
`;

export { screenDepthPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuRGVwdGguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvc2NyZWVuRGVwdGguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIHVTY2VuZURlcHRoTWFwO1xuXG4jaWZuZGVmIFNDUkVFTlNJWkVcbiNkZWZpbmUgU0NSRUVOU0laRVxudW5pZm9ybSB2ZWM0IHVTY3JlZW5TaXplO1xuI2VuZGlmXG5cbiNpZm5kZWYgVklFV01BVFJJWFxuI2RlZmluZSBWSUVXTUFUUklYXG51bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXc7XG4jZW5kaWZcblxuXG5cbiNpZm5kZWYgQ0FNRVJBUExBTkVTXG4jZGVmaW5lIENBTUVSQVBMQU5FU1xudW5pZm9ybSB2ZWM0IGNhbWVyYV9wYXJhbXM7IC8vIDEgLyBjYW1lcmFfZmFyLCAgICAgIGNhbWVyYV9mYXIsICAgICBjYW1lcmFfbmVhciwgICAgICAgIGlzX29ydGhvXG4jZW5kaWZcblxuI2lmZGVmIEdMMlxuZmxvYXQgbGluZWFyaXplRGVwdGgoZmxvYXQgeikge1xuICAgIGlmIChjYW1lcmFfcGFyYW1zLncgPT0gMC4wKVxuICAgICAgICByZXR1cm4gKGNhbWVyYV9wYXJhbXMueiAqIGNhbWVyYV9wYXJhbXMueSkgLyAoY2FtZXJhX3BhcmFtcy55ICsgeiAqIChjYW1lcmFfcGFyYW1zLnogLSBjYW1lcmFfcGFyYW1zLnkpKTtcbiAgICBlbHNlXG4gICAgICAgIHJldHVybiBjYW1lcmFfcGFyYW1zLnogKyB6ICogKGNhbWVyYV9wYXJhbXMueSAtIGNhbWVyYV9wYXJhbXMueik7XG59XG4jZWxzZVxuI2lmbmRlZiBVTlBBQ0tGTE9BVFxuI2RlZmluZSBVTlBBQ0tGTE9BVFxuZmxvYXQgdW5wYWNrRmxvYXQodmVjNCByZ2JhRGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdFNoaWZ0ID0gdmVjNCgxLjAgLyAoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wKSwgMS4wIC8gKDI1Ni4wICogMjU2LjApLCAxLjAgLyAyNTYuMCwgMS4wKTtcbiAgICByZXR1cm4gZG90KHJnYmFEZXB0aCwgYml0U2hpZnQpO1xufVxuI2VuZGlmXG4jZW5kaWZcblxuLy8gUmV0cmlldmVzIHJlbmRlcmVkIGxpbmVhciBjYW1lcmEgZGVwdGggYnkgVVZcbmZsb2F0IGdldExpbmVhclNjcmVlbkRlcHRoKHZlYzIgdXYpIHtcbiAgICAjaWZkZWYgR0wyXG4gICAgICAgIHJldHVybiBsaW5lYXJpemVEZXB0aCh0ZXh0dXJlMkQodVNjZW5lRGVwdGhNYXAsIHV2KS5yKTtcbiAgICAjZWxzZVxuICAgICAgICByZXR1cm4gdW5wYWNrRmxvYXQodGV4dHVyZTJEKHVTY2VuZURlcHRoTWFwLCB1dikpICogY2FtZXJhX3BhcmFtcy55O1xuICAgICNlbmRpZlxufVxuXG4jaWZuZGVmIFZFUlRFWFNIQURFUlxuLy8gUmV0cmlldmVzIHJlbmRlcmVkIGxpbmVhciBjYW1lcmEgZGVwdGggdW5kZXIgdGhlIGN1cnJlbnQgcGl4ZWxcbmZsb2F0IGdldExpbmVhclNjcmVlbkRlcHRoKCkge1xuICAgIHZlYzIgdXYgPSBnbF9GcmFnQ29vcmQueHkgKiB1U2NyZWVuU2l6ZS56dztcbiAgICByZXR1cm4gZ2V0TGluZWFyU2NyZWVuRGVwdGgodXYpO1xufVxuI2VuZGlmXG5cbi8vIEdlbmVyYXRlcyBsaW5lYXIgY2FtZXJhIGRlcHRoIGZvciB0aGUgZ2l2ZW4gd29ybGQgcG9zaXRpb25cbmZsb2F0IGdldExpbmVhckRlcHRoKHZlYzMgcG9zKSB7XG4gICAgcmV0dXJuIC0obWF0cml4X3ZpZXcgKiB2ZWM0KHBvcywgMS4wKSkuejtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxvQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQTFEQTs7OzsifQ==
