/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var specularityFactorPS = `

#ifdef MAPFLOAT
uniform float material_specularityFactor;
#endif

void getSpecularityFactor() {
    float specularityFactor = 1.0;

    #ifdef MAPFLOAT
    specularityFactor *= material_specularityFactor;
    #endif

    #ifdef MAPTEXTURE
    specularityFactor *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    specularityFactor *= saturate(vVertexColor.$VC);
    #endif

    dSpecularityFactor = specularityFactor;
}
`;

export { specularityFactorPS as default };
