/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var thicknessPS = `
#ifdef MAPFLOAT
uniform float material_thickness;
#endif

void getThickness() {
		dThickness = 1.0;

		#ifdef MAPFLOAT
		dThickness *= material_thickness;
		#endif

		#ifdef MAPTEXTURE
		dThickness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
		#endif

		#ifdef MAPVERTEX
		dThickness *= saturate(vVertexColor.$VC);
		#endif
}
`;

export { thicknessPS as default };
