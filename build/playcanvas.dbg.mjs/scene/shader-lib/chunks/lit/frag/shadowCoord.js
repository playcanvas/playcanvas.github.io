/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowCoordPS = /* glsl */`
void _getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams, vec3 wPos) {
    dShadowCoord = (shadowMatrix * vec4(wPos, 1.0)).xyz;
    dShadowCoord.z = saturate(dShadowCoord.z) - 0.0001;

    #ifdef SHADOWBIAS
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
}

void _getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos, vec3 lightDir) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xy /= projPos.w;
    dShadowCoord.xy = projPos.xy;
    dShadowCoord.z = length(lightDir) * shadowParams.w;

    #ifdef SHADOWBIAS
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
}

void getShadowCoordOrtho(mat4 shadowMatrix, vec3 shadowParams) {
    _getShadowCoordOrtho(shadowMatrix, shadowParams, vPositionW);
}

void getShadowCoordPersp(mat4 shadowMatrix, vec4 shadowParams, vec3 lightPos, vec3 lightDir) {
    _getShadowCoordPersp(shadowMatrix, shadowParams, vPositionW, lightDir);
}

void getShadowCoordPerspNormalOffset(mat4 shadowMatrix, vec4 shadowParams, vec3 lightPos, vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
    float distScale = abs(dot(vPositionW - lightPos, lightDirNorm)); // fov?
    vec3 wPos = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;

    _getShadowCoordPersp(shadowMatrix, shadowParams, wPos, lightDir);
}

void getShadowCoordOrthoNormalOffset(mat4 shadowMatrix, vec3 shadowParams, vec3 lightPos, vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
    vec3 wPos = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0); //0.08

    _getShadowCoordOrtho(shadowMatrix, shadowParams, wPos);
}
`;

export { shadowCoordPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q29vcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dDb29yZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBfZ2V0U2hhZG93Q29vcmRPcnRobyhtYXQ0IHNoYWRvd01hdHJpeCwgdmVjMyBzaGFkb3dQYXJhbXMsIHZlYzMgd1Bvcykge1xuICAgIGRTaGFkb3dDb29yZCA9IChzaGFkb3dNYXRyaXggKiB2ZWM0KHdQb3MsIDEuMCkpLnh5ejtcbiAgICBkU2hhZG93Q29vcmQueiA9IHNhdHVyYXRlKGRTaGFkb3dDb29yZC56KSAtIDAuMDAwMTtcblxuICAgICNpZmRlZiBTSEFET1dCSUFTXG4gICAgZFNoYWRvd0Nvb3JkLnogKz0gZ2V0U2hhZG93QmlhcyhzaGFkb3dQYXJhbXMueCwgc2hhZG93UGFyYW1zLnopO1xuICAgICNlbmRpZlxufVxuXG52b2lkIF9nZXRTaGFkb3dDb29yZFBlcnNwKG1hdDQgc2hhZG93TWF0cml4LCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyB3UG9zLCB2ZWMzIGxpZ2h0RGlyKSB7XG4gICAgdmVjNCBwcm9qUG9zID0gc2hhZG93TWF0cml4ICogdmVjNCh3UG9zLCAxLjApO1xuICAgIHByb2pQb3MueHkgLz0gcHJvalBvcy53O1xuICAgIGRTaGFkb3dDb29yZC54eSA9IHByb2pQb3MueHk7XG4gICAgZFNoYWRvd0Nvb3JkLnogPSBsZW5ndGgobGlnaHREaXIpICogc2hhZG93UGFyYW1zLnc7XG5cbiAgICAjaWZkZWYgU0hBRE9XQklBU1xuICAgIGRTaGFkb3dDb29yZC56ICs9IGdldFNoYWRvd0JpYXMoc2hhZG93UGFyYW1zLngsIHNoYWRvd1BhcmFtcy56KTtcbiAgICAjZW5kaWZcbn1cblxudm9pZCBnZXRTaGFkb3dDb29yZE9ydGhvKG1hdDQgc2hhZG93TWF0cml4LCB2ZWMzIHNoYWRvd1BhcmFtcykge1xuICAgIF9nZXRTaGFkb3dDb29yZE9ydGhvKHNoYWRvd01hdHJpeCwgc2hhZG93UGFyYW1zLCB2UG9zaXRpb25XKTtcbn1cblxudm9pZCBnZXRTaGFkb3dDb29yZFBlcnNwKG1hdDQgc2hhZG93TWF0cml4LCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBsaWdodFBvcywgdmVjMyBsaWdodERpcikge1xuICAgIF9nZXRTaGFkb3dDb29yZFBlcnNwKHNoYWRvd01hdHJpeCwgc2hhZG93UGFyYW1zLCB2UG9zaXRpb25XLCBsaWdodERpcik7XG59XG5cbnZvaWQgZ2V0U2hhZG93Q29vcmRQZXJzcE5vcm1hbE9mZnNldChtYXQ0IHNoYWRvd01hdHJpeCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgbGlnaHRQb3MsIHZlYzMgbGlnaHREaXIsIHZlYzMgbGlnaHREaXJOb3JtLCB2ZWMzIG5vcm1hbCkge1xuICAgIGZsb2F0IGRpc3RTY2FsZSA9IGFicyhkb3QodlBvc2l0aW9uVyAtIGxpZ2h0UG9zLCBsaWdodERpck5vcm0pKTsgLy8gZm92P1xuICAgIHZlYzMgd1BvcyA9IHZQb3NpdGlvblcgKyBub3JtYWwgKiBzaGFkb3dQYXJhbXMueSAqIGNsYW1wKDEuMCAtIGRvdChub3JtYWwsIC1saWdodERpck5vcm0pLCAwLjAsIDEuMCkgKiBkaXN0U2NhbGU7XG5cbiAgICBfZ2V0U2hhZG93Q29vcmRQZXJzcChzaGFkb3dNYXRyaXgsIHNoYWRvd1BhcmFtcywgd1BvcywgbGlnaHREaXIpO1xufVxuXG52b2lkIGdldFNoYWRvd0Nvb3JkT3J0aG9Ob3JtYWxPZmZzZXQobWF0NCBzaGFkb3dNYXRyaXgsIHZlYzMgc2hhZG93UGFyYW1zLCB2ZWMzIGxpZ2h0UG9zLCB2ZWMzIGxpZ2h0RGlyLCB2ZWMzIGxpZ2h0RGlyTm9ybSwgdmVjMyBub3JtYWwpIHtcbiAgICB2ZWMzIHdQb3MgPSB2UG9zaXRpb25XICsgbm9ybWFsICogc2hhZG93UGFyYW1zLnkgKiBjbGFtcCgxLjAgLSBkb3Qobm9ybWFsLCAtbGlnaHREaXJOb3JtKSwgMC4wLCAxLjApOyAvLzAuMDhcblxuICAgIF9nZXRTaGFkb3dDb29yZE9ydGhvKHNoYWRvd01hdHJpeCwgc2hhZG93UGFyYW1zLCB3UG9zKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxvQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
