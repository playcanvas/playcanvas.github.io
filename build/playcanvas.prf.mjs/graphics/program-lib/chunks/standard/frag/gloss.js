/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var glossPS = `
#ifdef MAPFLOAT
uniform float material_shininess;
#endif

void getGlossiness() {
    dGlossiness = 1.0;

    #ifdef MAPFLOAT
    dGlossiness *= material_shininess;
    #endif

    #ifdef MAPTEXTURE
    dGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dGlossiness *= saturate(vVertexColor.$VC);
    #endif

    dGlossiness += 0.0000001;
}
`;

export { glossPS as default };
