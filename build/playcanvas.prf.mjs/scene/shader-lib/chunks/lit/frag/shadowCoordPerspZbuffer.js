/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
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
