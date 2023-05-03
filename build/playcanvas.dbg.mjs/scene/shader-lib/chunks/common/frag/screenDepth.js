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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuRGVwdGguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy9zY3JlZW5EZXB0aC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgdVNjZW5lRGVwdGhNYXA7XG5cbiNpZm5kZWYgU0NSRUVOU0laRVxuI2RlZmluZSBTQ1JFRU5TSVpFXG51bmlmb3JtIHZlYzQgdVNjcmVlblNpemU7XG4jZW5kaWZcblxuI2lmbmRlZiBWSUVXTUFUUklYXG4jZGVmaW5lIFZJRVdNQVRSSVhcbnVuaWZvcm0gbWF0NCBtYXRyaXhfdmlldztcbiNlbmRpZlxuXG5cblxuI2lmbmRlZiBDQU1FUkFQTEFORVNcbiNkZWZpbmUgQ0FNRVJBUExBTkVTXG51bmlmb3JtIHZlYzQgY2FtZXJhX3BhcmFtczsgLy8gMSAvIGNhbWVyYV9mYXIsICAgICAgY2FtZXJhX2ZhciwgICAgIGNhbWVyYV9uZWFyLCAgICAgICAgaXNfb3J0aG9cbiNlbmRpZlxuXG4jaWZkZWYgR0wyXG5mbG9hdCBsaW5lYXJpemVEZXB0aChmbG9hdCB6KSB7XG4gICAgaWYgKGNhbWVyYV9wYXJhbXMudyA9PSAwLjApXG4gICAgICAgIHJldHVybiAoY2FtZXJhX3BhcmFtcy56ICogY2FtZXJhX3BhcmFtcy55KSAvIChjYW1lcmFfcGFyYW1zLnkgKyB6ICogKGNhbWVyYV9wYXJhbXMueiAtIGNhbWVyYV9wYXJhbXMueSkpO1xuICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIGNhbWVyYV9wYXJhbXMueiArIHogKiAoY2FtZXJhX3BhcmFtcy55IC0gY2FtZXJhX3BhcmFtcy56KTtcbn1cbiNlbHNlXG4jaWZuZGVmIFVOUEFDS0ZMT0FUXG4jZGVmaW5lIFVOUEFDS0ZMT0FUXG5mbG9hdCB1bnBhY2tGbG9hdCh2ZWM0IHJnYmFEZXB0aCkge1xuICAgIGNvbnN0IHZlYzQgYml0U2hpZnQgPSB2ZWM0KDEuMCAvICgyNTYuMCAqIDI1Ni4wICogMjU2LjApLCAxLjAgLyAoMjU2LjAgKiAyNTYuMCksIDEuMCAvIDI1Ni4wLCAxLjApO1xuICAgIHJldHVybiBkb3QocmdiYURlcHRoLCBiaXRTaGlmdCk7XG59XG4jZW5kaWZcbiNlbmRpZlxuXG4vLyBSZXRyaWV2ZXMgcmVuZGVyZWQgbGluZWFyIGNhbWVyYSBkZXB0aCBieSBVVlxuZmxvYXQgZ2V0TGluZWFyU2NyZWVuRGVwdGgodmVjMiB1dikge1xuICAgICNpZmRlZiBHTDJcbiAgICAgICAgcmV0dXJuIGxpbmVhcml6ZURlcHRoKHRleHR1cmUyRCh1U2NlbmVEZXB0aE1hcCwgdXYpLnIpO1xuICAgICNlbHNlXG4gICAgICAgIHJldHVybiB1bnBhY2tGbG9hdCh0ZXh0dXJlMkQodVNjZW5lRGVwdGhNYXAsIHV2KSkgKiBjYW1lcmFfcGFyYW1zLnk7XG4gICAgI2VuZGlmXG59XG5cbiNpZm5kZWYgVkVSVEVYU0hBREVSXG4vLyBSZXRyaWV2ZXMgcmVuZGVyZWQgbGluZWFyIGNhbWVyYSBkZXB0aCB1bmRlciB0aGUgY3VycmVudCBwaXhlbFxuZmxvYXQgZ2V0TGluZWFyU2NyZWVuRGVwdGgoKSB7XG4gICAgdmVjMiB1diA9IGdsX0ZyYWdDb29yZC54eSAqIHVTY3JlZW5TaXplLnp3O1xuICAgIHJldHVybiBnZXRMaW5lYXJTY3JlZW5EZXB0aCh1dik7XG59XG4jZW5kaWZcblxuLy8gR2VuZXJhdGVzIGxpbmVhciBjYW1lcmEgZGVwdGggZm9yIHRoZSBnaXZlbiB3b3JsZCBwb3NpdGlvblxuZmxvYXQgZ2V0TGluZWFyRGVwdGgodmVjMyBwb3MpIHtcbiAgICByZXR1cm4gLShtYXRyaXhfdmlldyAqIHZlYzQocG9zLCAxLjApKS56O1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxvQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
