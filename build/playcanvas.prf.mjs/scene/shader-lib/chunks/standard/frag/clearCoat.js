/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var clearCoatPS = `
#ifdef MAPFLOAT
uniform float material_clearCoat;
#endif

void getClearCoat() {
    ccSpecularity = 1.0;

    #ifdef MAPFLOAT
    ccSpecularity *= material_clearCoat;
    #endif

    #ifdef MAPTEXTURE
    ccSpecularity *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    ccSpecularity *= saturate(vVertexColor.$VC);
    #endif
}
`;

export { clearCoatPS as default };
