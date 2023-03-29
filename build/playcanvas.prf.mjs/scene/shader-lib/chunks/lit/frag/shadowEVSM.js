/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var shadowEVSMPS = `
float VSM$(sampler2D tex, vec2 texCoords, float resolution, float Z, float vsmBias, float exponent) {
		vec3 moments = texture2D(tex, texCoords).xyz;
		return calculateEVSM(moments, Z, vsmBias, exponent);
}

float getShadowVSM$(sampler2D shadowMap, vec3 shadowCoord, vec3 shadowParams, float exponent, vec3 lightDir) {
		return VSM$(shadowMap, shadowCoord.xy, shadowParams.x, shadowCoord.z, shadowParams.y, exponent);
}

float getShadowSpotVSM$(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams, float exponent, vec3 lightDir) {
		return VSM$(shadowMap, shadowCoord.xy, shadowParams.x, length(lightDir) * shadowParams.w + shadowParams.z, shadowParams.y, exponent);
}
`;

export { shadowEVSMPS as default };
