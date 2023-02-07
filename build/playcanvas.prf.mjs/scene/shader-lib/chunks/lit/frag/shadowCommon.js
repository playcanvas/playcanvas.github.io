/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowCommonPS = `
void normalOffsetPointShadow(vec4 shadowParams) {
		float distScale = length(dLightDirW);
		vec3 wPos = vPositionW + dVertexNormalW * shadowParams.y * clamp(1.0 - dot(dVertexNormalW, -dLightDirNormW), 0.0, 1.0) * distScale; //0.02
		vec3 dir = wPos - dLightPosW;
		dLightDirW = dir;
}
`;

export { shadowCommonPS as default };
