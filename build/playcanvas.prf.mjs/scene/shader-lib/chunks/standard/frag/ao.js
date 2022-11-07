/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoPS = `

void getAO() {
    dAo = 1.0;

    #ifdef MAPTEXTURE
    dAo *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dAo *= saturate(vVertexColor.$VC);
    #endif
}
`;

export { aoPS as default };
