/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var transmissionPS = `

#ifdef MAPFLOAT
uniform float material_refraction;
#endif

void getRefraction() {
		float refraction = 1.0;

		#ifdef MAPFLOAT
		refraction = material_refraction;
		#endif

		#ifdef MAPTEXTURE
		refraction *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
		#endif

		#ifdef MAPVERTEX
		refraction *= saturate(vVertexColor.$VC);
		#endif

		dTransmission = refraction;
}
`;

export { transmissionPS as default };
