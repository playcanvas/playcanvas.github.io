/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var shadowCoordPS = `
void _getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    dShadowCoord = (shadowMatrix * vec4(wPos, 1.0)).xyz;
    dShadowCoord.z = saturate(dShadowCoord.z) - 0.0001;

    #ifdef SHADOWBIAS
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
}

void _getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xy /= projPos.w;
    dShadowCoord.xy = projPos.xy;
    dShadowCoord.z = length(dLightDirW) * shadowParams.w;

    #ifdef SHADOWBIAS
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
}

void getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordOrtho(shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams) {
    _getShadowCoordPersp(shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPerspNormalOffset(mat4 shadowMatrix, vec4 shadowParams) {
    float distScale = abs(dot(vPositionW - dLightPosW, dLightDirNormW)); // fov?
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale;

    _getShadowCoordPersp(shadowMatrix, shadowParams, wPos);
}

void getShadowCoordOrthoNormalOffset(mat4 shadowMatrix, vec3 shadowParams) {
    vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0); //0.08

    _getShadowCoordOrtho(shadowMatrix, shadowParams, wPos);
}
`;

export { shadowCoordPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q29vcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvc2hhZG93Q29vcmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgX2dldFNoYWRvd0Nvb3JkT3J0aG8obWF0NCBzaGFkb3dNYXRyaXgsIHZlYzMgc2hhZG93UGFyYW1zLCB2ZWMzIHdQb3MpIHtcbiAgICBkU2hhZG93Q29vcmQgPSAoc2hhZG93TWF0cml4ICogdmVjNCh3UG9zLCAxLjApKS54eXo7XG4gICAgZFNoYWRvd0Nvb3JkLnogPSBzYXR1cmF0ZShkU2hhZG93Q29vcmQueikgLSAwLjAwMDE7XG5cbiAgICAjaWZkZWYgU0hBRE9XQklBU1xuICAgIGRTaGFkb3dDb29yZC56ICs9IGdldFNoYWRvd0JpYXMoc2hhZG93UGFyYW1zLngsIHNoYWRvd1BhcmFtcy56KTtcbiAgICAjZW5kaWZcbn1cblxudm9pZCBfZ2V0U2hhZG93Q29vcmRQZXJzcChtYXQ0IHNoYWRvd01hdHJpeCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgd1Bvcykge1xuICAgIHZlYzQgcHJvalBvcyA9IHNoYWRvd01hdHJpeCAqIHZlYzQod1BvcywgMS4wKTtcbiAgICBwcm9qUG9zLnh5IC89IHByb2pQb3MudztcbiAgICBkU2hhZG93Q29vcmQueHkgPSBwcm9qUG9zLnh5O1xuICAgIGRTaGFkb3dDb29yZC56ID0gbGVuZ3RoKGRMaWdodERpclcpICogc2hhZG93UGFyYW1zLnc7XG5cbiAgICAjaWZkZWYgU0hBRE9XQklBU1xuICAgIGRTaGFkb3dDb29yZC56ICs9IGdldFNoYWRvd0JpYXMoc2hhZG93UGFyYW1zLngsIHNoYWRvd1BhcmFtcy56KTtcbiAgICAjZW5kaWZcbn1cblxudm9pZCBnZXRTaGFkb3dDb29yZE9ydGhvKG1hdDQgc2hhZG93TWF0cml4LCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIF9nZXRTaGFkb3dDb29yZE9ydGhvKHNoYWRvd01hdHJpeCwgc2hhZG93UGFyYW1zLCB2UG9zaXRpb25XKTtcbn1cblxudm9pZCBnZXRTaGFkb3dDb29yZFBlcnNwKG1hdDQgc2hhZG93TWF0cml4LCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIF9nZXRTaGFkb3dDb29yZFBlcnNwKHNoYWRvd01hdHJpeCwgc2hhZG93UGFyYW1zLCB2UG9zaXRpb25XKTtcbn1cblxudm9pZCBnZXRTaGFkb3dDb29yZFBlcnNwTm9ybWFsT2Zmc2V0KG1hdDQgc2hhZG93TWF0cml4LCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgIGZsb2F0IGRpc3RTY2FsZSA9IGFicyhkb3QodlBvc2l0aW9uVyAtIGRMaWdodFBvc1csIGRMaWdodERpck5vcm1XKSk7IC8vIGZvdj9cbiAgICB2ZWMzIHdQb3MgPSB2UG9zaXRpb25XICsgZFZlcnRleE5vcm1hbFcgKiBzaGFkb3dQYXJhbXMueSAqIGNsYW1wKDEuMCAtIGRvdChkVmVydGV4Tm9ybWFsVywgLWRMaWdodERpck5vcm1XKSwgMC4wLCAxLjApICogZGlzdFNjYWxlO1xuXG4gICAgX2dldFNoYWRvd0Nvb3JkUGVyc3Aoc2hhZG93TWF0cml4LCBzaGFkb3dQYXJhbXMsIHdQb3MpO1xufVxuXG52b2lkIGdldFNoYWRvd0Nvb3JkT3J0aG9Ob3JtYWxPZmZzZXQobWF0NCBzaGFkb3dNYXRyaXgsIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgdmVjMyB3UG9zID0gdlBvc2l0aW9uVyArIGRWZXJ0ZXhOb3JtYWxXICogc2hhZG93UGFyYW1zLnkgKiBjbGFtcCgxLjAgLSBkb3QoZFZlcnRleE5vcm1hbFcsIC1kTGlnaHREaXJOb3JtVyksIDAuMCwgMS4wKTsgLy8wLjA4XG5cbiAgICBfZ2V0U2hhZG93Q29vcmRPcnRobyhzaGFkb3dNYXRyaXgsIHNoYWRvd1BhcmFtcywgd1Bvcyk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsb0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXpDQTs7OzsifQ==
