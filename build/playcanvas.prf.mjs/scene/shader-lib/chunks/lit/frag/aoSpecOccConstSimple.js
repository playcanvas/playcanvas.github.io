/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
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
