/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
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
