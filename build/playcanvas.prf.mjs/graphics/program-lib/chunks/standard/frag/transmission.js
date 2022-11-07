/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var transmissionPS = `

#ifdef MAPFLOAT
uniform float material_refraction;
#endif

void getRefraction() {
    float refraction = 1.0;

    #ifdef MAPFLOAT
    refraction = material_refraction;
    #endif

    #ifdef MAPTEXTURE
    refraction *= gammaCorrectInput(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    refraction *= saturate(vVertexColor.$VC);
    #endif

    dTransmission = refraction;
}
`;

export { transmissionPS as default };
