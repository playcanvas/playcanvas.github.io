/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var clearCoatGlossPS = `
#ifdef MAPFLOAT
uniform float material_clearCoatGlossiness;
#endif

void getClearCoatGlossiness() {
    ccGlossiness = 1.0;

    #ifdef MAPFLOAT
    ccGlossiness *= material_clearCoatGlossiness;
    #endif

    #ifdef MAPTEXTURE
    ccGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    ccGlossiness *= saturate(vVertexColor.$VC);
    #endif

    ccGlossiness += 0.0000001;
}
`;

export { clearCoatGlossPS as default };
