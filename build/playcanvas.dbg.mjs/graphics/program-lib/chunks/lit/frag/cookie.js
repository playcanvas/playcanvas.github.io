/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var cookiePS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29va2llLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2Nvb2tpZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gbGlnaHQgY29va2llIGZ1bmN0aW9uYWxpdHkgZm9yIG5vbi1jbHVzdGVyZWQgbGlnaHRzXG52ZWM0IGdldENvb2tpZTJEKHNhbXBsZXIyRCB0ZXgsIG1hdDQgdHJhbnNmb3JtLCBmbG9hdCBpbnRlbnNpdHkpIHtcbiAgICB2ZWM0IHByb2pQb3MgPSB0cmFuc2Zvcm0gKiB2ZWM0KHZQb3NpdGlvblcsIDEuMCk7XG4gICAgcHJvalBvcy54eSAvPSBwcm9qUG9zLnc7XG4gICAgcmV0dXJuIG1peCh2ZWM0KDEuMCksIHRleHR1cmUyRCh0ZXgsIHByb2pQb3MueHkpLCBpbnRlbnNpdHkpO1xufVxuXG52ZWM0IGdldENvb2tpZTJEQ2xpcChzYW1wbGVyMkQgdGV4LCBtYXQ0IHRyYW5zZm9ybSwgZmxvYXQgaW50ZW5zaXR5KSB7XG4gICAgdmVjNCBwcm9qUG9zID0gdHJhbnNmb3JtICogdmVjNCh2UG9zaXRpb25XLCAxLjApO1xuICAgIHByb2pQb3MueHkgLz0gcHJvalBvcy53O1xuICAgIGlmIChwcm9qUG9zLnggPCAwLjAgfHwgcHJvalBvcy54ID4gMS4wIHx8IHByb2pQb3MueSA8IDAuMCB8fCBwcm9qUG9zLnkgPiAxLjAgfHwgcHJvalBvcy56IDwgMC4wKSByZXR1cm4gdmVjNCgwLjApO1xuICAgIHJldHVybiBtaXgodmVjNCgxLjApLCB0ZXh0dXJlMkQodGV4LCBwcm9qUG9zLnh5KSwgaW50ZW5zaXR5KTtcbn1cblxudmVjNCBnZXRDb29raWUyRFhmb3JtKHNhbXBsZXIyRCB0ZXgsIG1hdDQgdHJhbnNmb3JtLCBmbG9hdCBpbnRlbnNpdHksIHZlYzQgY29va2llTWF0cml4LCB2ZWMyIGNvb2tpZU9mZnNldCkge1xuICAgIHZlYzQgcHJvalBvcyA9IHRyYW5zZm9ybSAqIHZlYzQodlBvc2l0aW9uVywgMS4wKTtcbiAgICBwcm9qUG9zLnh5IC89IHByb2pQb3MudztcbiAgICBwcm9qUG9zLnh5ICs9IGNvb2tpZU9mZnNldDtcbiAgICB2ZWMyIHV2ID0gbWF0Mihjb29raWVNYXRyaXgpICogKHByb2pQb3MueHktdmVjMigwLjUpKSArIHZlYzIoMC41KTtcbiAgICByZXR1cm4gbWl4KHZlYzQoMS4wKSwgdGV4dHVyZTJEKHRleCwgdXYpLCBpbnRlbnNpdHkpO1xufVxuXG52ZWM0IGdldENvb2tpZTJEQ2xpcFhmb3JtKHNhbXBsZXIyRCB0ZXgsIG1hdDQgdHJhbnNmb3JtLCBmbG9hdCBpbnRlbnNpdHksIHZlYzQgY29va2llTWF0cml4LCB2ZWMyIGNvb2tpZU9mZnNldCkge1xuICAgIHZlYzQgcHJvalBvcyA9IHRyYW5zZm9ybSAqIHZlYzQodlBvc2l0aW9uVywgMS4wKTtcbiAgICBwcm9qUG9zLnh5IC89IHByb2pQb3MudztcbiAgICBwcm9qUG9zLnh5ICs9IGNvb2tpZU9mZnNldDtcbiAgICBpZiAocHJvalBvcy54IDwgMC4wIHx8IHByb2pQb3MueCA+IDEuMCB8fCBwcm9qUG9zLnkgPCAwLjAgfHwgcHJvalBvcy55ID4gMS4wIHx8IHByb2pQb3MueiA8IDAuMCkgcmV0dXJuIHZlYzQoMC4wKTtcbiAgICB2ZWMyIHV2ID0gbWF0Mihjb29raWVNYXRyaXgpICogKHByb2pQb3MueHktdmVjMigwLjUpKSArIHZlYzIoMC41KTtcbiAgICByZXR1cm4gbWl4KHZlYzQoMS4wKSwgdGV4dHVyZTJEKHRleCwgdXYpLCBpbnRlbnNpdHkpO1xufVxuXG52ZWM0IGdldENvb2tpZUN1YmUoc2FtcGxlckN1YmUgdGV4LCBtYXQ0IHRyYW5zZm9ybSwgZmxvYXQgaW50ZW5zaXR5KSB7XG4gICAgcmV0dXJuIG1peCh2ZWM0KDEuMCksIHRleHR1cmVDdWJlKHRleCwgZExpZ2h0RGlyTm9ybVcgKiBtYXQzKHRyYW5zZm9ybSkpLCBpbnRlbnNpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGVBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQW5DQTs7OzsifQ==
