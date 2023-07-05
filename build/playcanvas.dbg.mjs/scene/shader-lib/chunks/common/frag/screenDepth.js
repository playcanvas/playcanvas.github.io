var screenDepthPS = /* glsl */`
uniform highp sampler2D uSceneDepthMap;

#ifndef SCREENSIZE
#define SCREENSIZE
uniform vec4 uScreenSize;
#endif

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

#ifndef LINEARIZE_DEPTH
#ifndef CAMERAPLANES
#define CAMERAPLANES
uniform vec4 camera_params; // x: 1 / camera_far,      y: camera_far,     z: camera_near,        w: is_ortho
#endif

#define LINEARIZE_DEPTH
#ifdef GL2
float linearizeDepth(float z) {
    if (camera_params.w == 0.0)
        return (camera_params.z * camera_params.y) / (camera_params.y + z * (camera_params.z - camera_params.y));
    else
        return camera_params.z + z * (camera_params.y - camera_params.z);
}
#else // GL2
#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}
#endif
#endif
#endif // LINEARIZE_DEPTH

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuRGVwdGguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy9zY3JlZW5EZXB0aC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgdVNjZW5lRGVwdGhNYXA7XG5cbiNpZm5kZWYgU0NSRUVOU0laRVxuI2RlZmluZSBTQ1JFRU5TSVpFXG51bmlmb3JtIHZlYzQgdVNjcmVlblNpemU7XG4jZW5kaWZcblxuI2lmbmRlZiBWSUVXTUFUUklYXG4jZGVmaW5lIFZJRVdNQVRSSVhcbnVuaWZvcm0gbWF0NCBtYXRyaXhfdmlldztcbiNlbmRpZlxuXG4jaWZuZGVmIExJTkVBUklaRV9ERVBUSFxuI2lmbmRlZiBDQU1FUkFQTEFORVNcbiNkZWZpbmUgQ0FNRVJBUExBTkVTXG51bmlmb3JtIHZlYzQgY2FtZXJhX3BhcmFtczsgLy8geDogMSAvIGNhbWVyYV9mYXIsICAgICAgeTogY2FtZXJhX2ZhciwgICAgIHo6IGNhbWVyYV9uZWFyLCAgICAgICAgdzogaXNfb3J0aG9cbiNlbmRpZlxuXG4jZGVmaW5lIExJTkVBUklaRV9ERVBUSFxuI2lmZGVmIEdMMlxuZmxvYXQgbGluZWFyaXplRGVwdGgoZmxvYXQgeikge1xuICAgIGlmIChjYW1lcmFfcGFyYW1zLncgPT0gMC4wKVxuICAgICAgICByZXR1cm4gKGNhbWVyYV9wYXJhbXMueiAqIGNhbWVyYV9wYXJhbXMueSkgLyAoY2FtZXJhX3BhcmFtcy55ICsgeiAqIChjYW1lcmFfcGFyYW1zLnogLSBjYW1lcmFfcGFyYW1zLnkpKTtcbiAgICBlbHNlXG4gICAgICAgIHJldHVybiBjYW1lcmFfcGFyYW1zLnogKyB6ICogKGNhbWVyYV9wYXJhbXMueSAtIGNhbWVyYV9wYXJhbXMueik7XG59XG4jZWxzZSAvLyBHTDJcbiNpZm5kZWYgVU5QQUNLRkxPQVRcbiNkZWZpbmUgVU5QQUNLRkxPQVRcbmZsb2F0IHVucGFja0Zsb2F0KHZlYzQgcmdiYURlcHRoKSB7XG4gICAgY29uc3QgdmVjNCBiaXRTaGlmdCA9IHZlYzQoMS4wIC8gKDI1Ni4wICogMjU2LjAgKiAyNTYuMCksIDEuMCAvICgyNTYuMCAqIDI1Ni4wKSwgMS4wIC8gMjU2LjAsIDEuMCk7XG4gICAgcmV0dXJuIGRvdChyZ2JhRGVwdGgsIGJpdFNoaWZ0KTtcbn1cbiNlbmRpZlxuI2VuZGlmXG4jZW5kaWYgLy8gTElORUFSSVpFX0RFUFRIXG5cbi8vIFJldHJpZXZlcyByZW5kZXJlZCBsaW5lYXIgY2FtZXJhIGRlcHRoIGJ5IFVWXG5mbG9hdCBnZXRMaW5lYXJTY3JlZW5EZXB0aCh2ZWMyIHV2KSB7XG4gICAgI2lmZGVmIEdMMlxuICAgICAgICByZXR1cm4gbGluZWFyaXplRGVwdGgodGV4dHVyZTJEKHVTY2VuZURlcHRoTWFwLCB1dikucik7XG4gICAgI2Vsc2VcbiAgICAgICAgcmV0dXJuIHVucGFja0Zsb2F0KHRleHR1cmUyRCh1U2NlbmVEZXB0aE1hcCwgdXYpKSAqIGNhbWVyYV9wYXJhbXMueTtcbiAgICAjZW5kaWZcbn1cblxuI2lmbmRlZiBWRVJURVhTSEFERVJcbi8vIFJldHJpZXZlcyByZW5kZXJlZCBsaW5lYXIgY2FtZXJhIGRlcHRoIHVuZGVyIHRoZSBjdXJyZW50IHBpeGVsXG5mbG9hdCBnZXRMaW5lYXJTY3JlZW5EZXB0aCgpIHtcbiAgICB2ZWMyIHV2ID0gZ2xfRnJhZ0Nvb3JkLnh5ICogdVNjcmVlblNpemUuenc7XG4gICAgcmV0dXJuIGdldExpbmVhclNjcmVlbkRlcHRoKHV2KTtcbn1cbiNlbmRpZlxuXG4vLyBHZW5lcmF0ZXMgbGluZWFyIGNhbWVyYSBkZXB0aCBmb3IgdGhlIGdpdmVuIHdvcmxkIHBvc2l0aW9uXG5mbG9hdCBnZXRMaW5lYXJEZXB0aCh2ZWMzIHBvcykge1xuICAgIHJldHVybiAtKG1hdHJpeF92aWV3ICogdmVjNChwb3MsIDEuMCkpLno7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLG9CQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
