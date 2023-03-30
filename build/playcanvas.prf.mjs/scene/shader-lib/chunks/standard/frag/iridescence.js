/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var iridescencePS = `
#ifdef MAPFLOAT
uniform float material_iridescence;
#endif

void getIridescence() {
		float iridescence = 1.0;

		#ifdef MAPFLOAT
		iridescence *= material_iridescence;
		#endif

		#ifdef MAPTEXTURE
		iridescence *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
		#endif

		dIridescence = iridescence; 
}
`;

export { iridescencePS as default };
