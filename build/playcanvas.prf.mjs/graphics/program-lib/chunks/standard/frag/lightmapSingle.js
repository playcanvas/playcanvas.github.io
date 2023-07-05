/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightmapSinglePS = `
void getLightMap() {
    dLightmap = vec3(1.0);

    #ifdef MAPTEXTURE
    dLightmap *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    dLightmap *= saturate(vVertexColor.$VC);
    #endif
}
`;

export { lightmapSinglePS as default };
