/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var clearCoatGlossPS = `
#ifdef MAPFLOAT
uniform float material_clearCoatGloss;
#endif

void getClearCoatGlossiness() {
		ccGlossiness = 1.0;

		#ifdef MAPFLOAT
		ccGlossiness *= material_clearCoatGloss;
		#endif

		#ifdef MAPTEXTURE
		ccGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
		#endif

		#ifdef MAPVERTEX
		ccGlossiness *= saturate(vVertexColor.$VC);
		#endif

		#ifdef MAPINVERT
		ccGlossiness = 1.0 - ccGlossiness;
		#endif

		ccGlossiness += 0.0000001;
}
`;

export { clearCoatGlossPS as default };
