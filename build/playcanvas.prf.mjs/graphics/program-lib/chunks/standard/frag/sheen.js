/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var sheenPS = `

#ifdef MAPCOLOR
uniform vec3 material_sheen;
#endif

void getSheen() {
    vec3 sheenColor = vec3(1, 1, 1);

    #ifdef MAPCOLOR
    sheenColor *= material_sheen;
    #endif

    #ifdef MAPTEXTURE
    sheenColor *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    sheenColor *= saturate(vVertexColor.$VC);
    #endif

    sSpecularity = sheenColor;
}
`;

export { sheenPS as default };
