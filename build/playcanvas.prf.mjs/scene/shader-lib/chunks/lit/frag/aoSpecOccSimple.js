/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccSimplePS = `
uniform float material_occludeSpecularIntensity;

void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {
		float specOcc = mix(1.0, ao, material_occludeSpecularIntensity);
		dSpecularLight *= specOcc;
		dReflection *= specOcc;

#ifdef LIT_SHEEN
		sSpecularLight *= specOcc;
		sReflection *= specOcc;
#endif
}
`;

export { aoSpecOccSimplePS as default };
