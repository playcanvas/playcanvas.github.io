var cookiePS = /* glsl */`
// light cookie functionality for non-clustered lights
vec4 getCookie2D(sampler2D tex, mat4 transform, float intensity) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    return mix(vec4(1.0), texture2D(tex, projPos.xy), intensity);
}

vec4 getCookie2DClip(sampler2D tex, mat4 transform, float intensity) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    if (projPos.x < 0.0 || projPos.x > 1.0 || projPos.y < 0.0 || projPos.y > 1.0 || projPos.z < 0.0) return vec4(0.0);
    return mix(vec4(1.0), texture2D(tex, projPos.xy), intensity);
}

vec4 getCookie2DXform(sampler2D tex, mat4 transform, float intensity, vec4 cookieMatrix, vec2 cookieOffset) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    projPos.xy += cookieOffset;
    vec2 uv = mat2(cookieMatrix) * (projPos.xy-vec2(0.5)) + vec2(0.5);
    return mix(vec4(1.0), texture2D(tex, uv), intensity);
}

vec4 getCookie2DClipXform(sampler2D tex, mat4 transform, float intensity, vec4 cookieMatrix, vec2 cookieOffset) {
    vec4 projPos = transform * vec4(vPositionW, 1.0);
    projPos.xy /= projPos.w;
    projPos.xy += cookieOffset;
    if (projPos.x < 0.0 || projPos.x > 1.0 || projPos.y < 0.0 || projPos.y > 1.0 || projPos.z < 0.0) return vec4(0.0);
    vec2 uv = mat2(cookieMatrix) * (projPos.xy-vec2(0.5)) + vec2(0.5);
    return mix(vec4(1.0), texture2D(tex, uv), intensity);
}

vec4 getCookieCube(samplerCube tex, mat4 transform, float intensity) {
    return mix(vec4(1.0), textureCube(tex, dLightDirNormW * mat3(transform)), intensity);
}
`;

export { cookiePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29va2llLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvY29va2llLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBsaWdodCBjb29raWUgZnVuY3Rpb25hbGl0eSBmb3Igbm9uLWNsdXN0ZXJlZCBsaWdodHNcbnZlYzQgZ2V0Q29va2llMkQoc2FtcGxlcjJEIHRleCwgbWF0NCB0cmFuc2Zvcm0sIGZsb2F0IGludGVuc2l0eSkge1xuICAgIHZlYzQgcHJvalBvcyA9IHRyYW5zZm9ybSAqIHZlYzQodlBvc2l0aW9uVywgMS4wKTtcbiAgICBwcm9qUG9zLnh5IC89IHByb2pQb3MudztcbiAgICByZXR1cm4gbWl4KHZlYzQoMS4wKSwgdGV4dHVyZTJEKHRleCwgcHJvalBvcy54eSksIGludGVuc2l0eSk7XG59XG5cbnZlYzQgZ2V0Q29va2llMkRDbGlwKHNhbXBsZXIyRCB0ZXgsIG1hdDQgdHJhbnNmb3JtLCBmbG9hdCBpbnRlbnNpdHkpIHtcbiAgICB2ZWM0IHByb2pQb3MgPSB0cmFuc2Zvcm0gKiB2ZWM0KHZQb3NpdGlvblcsIDEuMCk7XG4gICAgcHJvalBvcy54eSAvPSBwcm9qUG9zLnc7XG4gICAgaWYgKHByb2pQb3MueCA8IDAuMCB8fCBwcm9qUG9zLnggPiAxLjAgfHwgcHJvalBvcy55IDwgMC4wIHx8IHByb2pQb3MueSA+IDEuMCB8fCBwcm9qUG9zLnogPCAwLjApIHJldHVybiB2ZWM0KDAuMCk7XG4gICAgcmV0dXJuIG1peCh2ZWM0KDEuMCksIHRleHR1cmUyRCh0ZXgsIHByb2pQb3MueHkpLCBpbnRlbnNpdHkpO1xufVxuXG52ZWM0IGdldENvb2tpZTJEWGZvcm0oc2FtcGxlcjJEIHRleCwgbWF0NCB0cmFuc2Zvcm0sIGZsb2F0IGludGVuc2l0eSwgdmVjNCBjb29raWVNYXRyaXgsIHZlYzIgY29va2llT2Zmc2V0KSB7XG4gICAgdmVjNCBwcm9qUG9zID0gdHJhbnNmb3JtICogdmVjNCh2UG9zaXRpb25XLCAxLjApO1xuICAgIHByb2pQb3MueHkgLz0gcHJvalBvcy53O1xuICAgIHByb2pQb3MueHkgKz0gY29va2llT2Zmc2V0O1xuICAgIHZlYzIgdXYgPSBtYXQyKGNvb2tpZU1hdHJpeCkgKiAocHJvalBvcy54eS12ZWMyKDAuNSkpICsgdmVjMigwLjUpO1xuICAgIHJldHVybiBtaXgodmVjNCgxLjApLCB0ZXh0dXJlMkQodGV4LCB1diksIGludGVuc2l0eSk7XG59XG5cbnZlYzQgZ2V0Q29va2llMkRDbGlwWGZvcm0oc2FtcGxlcjJEIHRleCwgbWF0NCB0cmFuc2Zvcm0sIGZsb2F0IGludGVuc2l0eSwgdmVjNCBjb29raWVNYXRyaXgsIHZlYzIgY29va2llT2Zmc2V0KSB7XG4gICAgdmVjNCBwcm9qUG9zID0gdHJhbnNmb3JtICogdmVjNCh2UG9zaXRpb25XLCAxLjApO1xuICAgIHByb2pQb3MueHkgLz0gcHJvalBvcy53O1xuICAgIHByb2pQb3MueHkgKz0gY29va2llT2Zmc2V0O1xuICAgIGlmIChwcm9qUG9zLnggPCAwLjAgfHwgcHJvalBvcy54ID4gMS4wIHx8IHByb2pQb3MueSA8IDAuMCB8fCBwcm9qUG9zLnkgPiAxLjAgfHwgcHJvalBvcy56IDwgMC4wKSByZXR1cm4gdmVjNCgwLjApO1xuICAgIHZlYzIgdXYgPSBtYXQyKGNvb2tpZU1hdHJpeCkgKiAocHJvalBvcy54eS12ZWMyKDAuNSkpICsgdmVjMigwLjUpO1xuICAgIHJldHVybiBtaXgodmVjNCgxLjApLCB0ZXh0dXJlMkQodGV4LCB1diksIGludGVuc2l0eSk7XG59XG5cbnZlYzQgZ2V0Q29va2llQ3ViZShzYW1wbGVyQ3ViZSB0ZXgsIG1hdDQgdHJhbnNmb3JtLCBmbG9hdCBpbnRlbnNpdHkpIHtcbiAgICByZXR1cm4gbWl4KHZlYzQoMS4wKSwgdGV4dHVyZUN1YmUodGV4LCBkTGlnaHREaXJOb3JtVyAqIG1hdDModHJhbnNmb3JtKSksIGludGVuc2l0eSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGVBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
