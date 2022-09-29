/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
