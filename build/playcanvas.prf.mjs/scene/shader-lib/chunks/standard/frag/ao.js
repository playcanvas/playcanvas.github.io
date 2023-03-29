/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
