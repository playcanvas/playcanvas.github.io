/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
