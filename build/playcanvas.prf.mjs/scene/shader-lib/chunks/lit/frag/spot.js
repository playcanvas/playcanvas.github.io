/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var spotPS = `
float getSpotEffect(vec3 lightSpotDir, float lightInnerConeAngle, float lightOuterConeAngle, vec3 lightDirNorm) {
		float cosAngle = dot(lightDirNorm, lightSpotDir);
		return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}
`;

export { spotPS as default };
