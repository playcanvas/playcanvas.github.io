/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowCommonPS = `
void normalOffsetPointShadow(vec4 shadowParams, vec3 lightPos, inout vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
		float distScale = length(lightDir);
		vec3 wPos = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale; //0.02
		vec3 dir = wPos - lightPos;
		lightDir = dir;
}
`;

export { shadowCommonPS as default };
