/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
