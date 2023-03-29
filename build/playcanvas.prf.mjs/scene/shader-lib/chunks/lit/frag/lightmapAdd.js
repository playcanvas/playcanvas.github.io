/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightmapAddPS = `
void addLightMap(
		vec3 lightmap, 
		vec3 dir, 
		vec3 worldNormal, 
		vec3 viewDir, 
		vec3 reflectionDir, 
		float gloss, 
		vec3 specularity, 
		vec3 vertexNormal, 
		mat3 tbn
#if defined(LIT_IRIDESCENCE)
		vec3 iridescenceFresnel, 
		IridescenceArgs iridescence
#endif
) {
		dDiffuseLight += lightmap;
}
`;

export { lightmapAddPS as default };
