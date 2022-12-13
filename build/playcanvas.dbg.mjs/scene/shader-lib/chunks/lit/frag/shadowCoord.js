/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93Q29vcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dDb29yZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBfZ2V0U2hhZG93Q29vcmRPcnRobyhtYXQ0IHNoYWRvd01hdHJpeCwgdmVjMyBzaGFkb3dQYXJhbXMsIHZlYzMgd1Bvcykge1xuICAgIGRTaGFkb3dDb29yZCA9IChzaGFkb3dNYXRyaXggKiB2ZWM0KHdQb3MsIDEuMCkpLnh5ejtcbiAgICBkU2hhZG93Q29vcmQueiA9IHNhdHVyYXRlKGRTaGFkb3dDb29yZC56KSAtIDAuMDAwMTtcblxuICAgICNpZmRlZiBTSEFET1dCSUFTXG4gICAgZFNoYWRvd0Nvb3JkLnogKz0gZ2V0U2hhZG93QmlhcyhzaGFkb3dQYXJhbXMueCwgc2hhZG93UGFyYW1zLnopO1xuICAgICNlbmRpZlxufVxuXG52b2lkIF9nZXRTaGFkb3dDb29yZFBlcnNwKG1hdDQgc2hhZG93TWF0cml4LCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyB3UG9zKSB7XG4gICAgdmVjNCBwcm9qUG9zID0gc2hhZG93TWF0cml4ICogdmVjNCh3UG9zLCAxLjApO1xuICAgIHByb2pQb3MueHkgLz0gcHJvalBvcy53O1xuICAgIGRTaGFkb3dDb29yZC54eSA9IHByb2pQb3MueHk7XG4gICAgZFNoYWRvd0Nvb3JkLnogPSBsZW5ndGgoZExpZ2h0RGlyVykgKiBzaGFkb3dQYXJhbXMudztcblxuICAgICNpZmRlZiBTSEFET1dCSUFTXG4gICAgZFNoYWRvd0Nvb3JkLnogKz0gZ2V0U2hhZG93QmlhcyhzaGFkb3dQYXJhbXMueCwgc2hhZG93UGFyYW1zLnopO1xuICAgICNlbmRpZlxufVxuXG52b2lkIGdldFNoYWRvd0Nvb3JkT3J0aG8obWF0NCBzaGFkb3dNYXRyaXgsIHZlYzMgc2hhZG93UGFyYW1zKSB7XG4gICAgX2dldFNoYWRvd0Nvb3JkT3J0aG8oc2hhZG93TWF0cml4LCBzaGFkb3dQYXJhbXMsIHZQb3NpdGlvblcpO1xufVxuXG52b2lkIGdldFNoYWRvd0Nvb3JkUGVyc3AobWF0NCBzaGFkb3dNYXRyaXgsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgX2dldFNoYWRvd0Nvb3JkUGVyc3Aoc2hhZG93TWF0cml4LCBzaGFkb3dQYXJhbXMsIHZQb3NpdGlvblcpO1xufVxuXG52b2lkIGdldFNoYWRvd0Nvb3JkUGVyc3BOb3JtYWxPZmZzZXQobWF0NCBzaGFkb3dNYXRyaXgsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgZmxvYXQgZGlzdFNjYWxlID0gYWJzKGRvdCh2UG9zaXRpb25XIC0gZExpZ2h0UG9zVywgZExpZ2h0RGlyTm9ybVcpKTsgLy8gZm92P1xuICAgIHZlYzMgd1BvcyA9IHZQb3NpdGlvblcgKyBkVmVydGV4Tm9ybWFsVyAqIHNoYWRvd1BhcmFtcy55ICogY2xhbXAoMS4wIC0gZG90KGRWZXJ0ZXhOb3JtYWxXLCAtZExpZ2h0RGlyTm9ybVcpLCAwLjAsIDEuMCkgKiBkaXN0U2NhbGU7XG5cbiAgICBfZ2V0U2hhZG93Q29vcmRQZXJzcChzaGFkb3dNYXRyaXgsIHNoYWRvd1BhcmFtcywgd1Bvcyk7XG59XG5cbnZvaWQgZ2V0U2hhZG93Q29vcmRPcnRob05vcm1hbE9mZnNldChtYXQ0IHNoYWRvd01hdHJpeCwgdmVjMyBzaGFkb3dQYXJhbXMpIHtcbiAgICB2ZWMzIHdQb3MgPSB2UG9zaXRpb25XICsgZFZlcnRleE5vcm1hbFcgKiBzaGFkb3dQYXJhbXMueSAqIGNsYW1wKDEuMCAtIGRvdChkVmVydGV4Tm9ybWFsVywgLWRMaWdodERpck5vcm1XKSwgMC4wLCAxLjApOyAvLzAuMDhcblxuICAgIF9nZXRTaGFkb3dDb29yZE9ydGhvKHNoYWRvd01hdHJpeCwgc2hhZG93UGFyYW1zLCB3UG9zKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxvQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
