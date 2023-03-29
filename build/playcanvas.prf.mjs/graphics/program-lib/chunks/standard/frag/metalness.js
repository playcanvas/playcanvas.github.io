/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var metalnessPS = `
#ifdef MAPFLOAT
uniform float material_metalness;
#endif

void getMetalness() {
    float metalness = 1.0;

    #ifdef MAPFLOAT
    metalness *= material_metalness;
    #endif

    #ifdef MAPTEXTURE
    metalness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    metalness *= saturate(vVertexColor.$VC);
    #endif

    dMetalness = metalness;
}
`;

export { metalnessPS as default };
