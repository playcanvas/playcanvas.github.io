/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowCoordPerspZbufferPS = `
void _getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xyz /= projPos.w;
    dShadowCoord = projPos.xyz;
    // depth bias is already applied on render
}

void getShadowCoordPerspZbufferNormalOffset(mat4 shadowMatrix, vec4 shadowParams) {
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y;
    _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, wPos);
}

void getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams) {
    _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, vPositionW);
}
`;

export { shadowCoordPerspZbufferPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q29vcmRQZXJzcFpidWZmZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvc2hhZG93Q29vcmRQZXJzcFpidWZmZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgX2dldFNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyKG1hdDQgc2hhZG93TWF0cml4LCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyB3UG9zKSB7XG4gICAgdmVjNCBwcm9qUG9zID0gc2hhZG93TWF0cml4ICogdmVjNCh3UG9zLCAxLjApO1xuICAgIHByb2pQb3MueHl6IC89IHByb2pQb3MudztcbiAgICBkU2hhZG93Q29vcmQgPSBwcm9qUG9zLnh5ejtcbiAgICAvLyBkZXB0aCBiaWFzIGlzIGFscmVhZHkgYXBwbGllZCBvbiByZW5kZXJcbn1cblxudm9pZCBnZXRTaGFkb3dDb29yZFBlcnNwWmJ1ZmZlck5vcm1hbE9mZnNldChtYXQ0IHNoYWRvd01hdHJpeCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICB2ZWMzIHdQb3MgPSB2UG9zaXRpb25XICsgZFZlcnRleE5vcm1hbFcgKiBzaGFkb3dQYXJhbXMueTtcbiAgICBfZ2V0U2hhZG93Q29vcmRQZXJzcFpidWZmZXIoc2hhZG93TWF0cml4LCBzaGFkb3dQYXJhbXMsIHdQb3MpO1xufVxuXG52b2lkIGdldFNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyKG1hdDQgc2hhZG93TWF0cml4LCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIF9nZXRTaGFkb3dDb29yZFBlcnNwWmJ1ZmZlcihzaGFkb3dNYXRyaXgsIHNoYWRvd1BhcmFtcywgdlBvc2l0aW9uVyk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZ0NBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FoQkE7Ozs7In0=