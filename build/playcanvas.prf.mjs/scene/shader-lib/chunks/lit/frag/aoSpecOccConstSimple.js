/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccConstSimplePS = `
void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {
		dSpecularLight *= ao;
		dReflection *= ao;

#ifdef LIT_SHEEN
		sSpecularLight *= ao;
		sReflection *= ao;
#endif
}
`;

export { aoSpecOccConstSimplePS as default };
