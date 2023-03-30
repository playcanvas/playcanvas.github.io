/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowCoordPerspZbufferPS = `
void _getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
		vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
		projPos.xyz /= projPos.w;
		dShadowCoord = projPos.xyz;
		// depth bias is already applied on render
}

void getShadowCoordPerspZbufferNormalOffset(mat4 shadowMatrix, vec4 shadowParams, vec3 normal) {
		vec3 wPos = vPositionW + normal * shadowParams.y;
		_getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, wPos);
}

void getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams) {
		_getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, vPositionW);
}
`;

export { shadowCoordPerspZbufferPS as default };
