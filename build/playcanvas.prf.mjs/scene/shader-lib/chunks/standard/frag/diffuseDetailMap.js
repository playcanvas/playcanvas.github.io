/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var diffuseDetailMapPS = `
vec3 addAlbedoDetail(vec3 albedo) {
#ifdef MAPTEXTURE
		vec3 albedoDetail = $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
		return detailMode_$DETAILMODE(albedo, albedoDetail);
#else
		return albedo;
#endif
}
`;

export { diffuseDetailMapPS as default };
