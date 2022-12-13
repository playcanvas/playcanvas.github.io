/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var sheenGlossPS = `
#ifdef MAPFLOAT
uniform float material_sheenGlossiness;
#endif

void getSheenGlossiness() {
    float sheenGlossiness = 1.0;

    #ifdef MAPFLOAT
    sheenGlossiness *= material_sheenGlossiness;
    #endif

    #ifdef MAPTEXTURE
    sheenGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenGlossiness *= saturate(vVertexColor.$VC);
    #endif

    sheenGlossiness += 0.0000001;
    sGlossiness = sheenGlossiness;
}
`;

export { sheenGlossPS as default };
