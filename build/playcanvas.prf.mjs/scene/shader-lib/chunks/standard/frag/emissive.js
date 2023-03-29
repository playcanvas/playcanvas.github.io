/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var emissivePS = `
#ifdef MAPCOLOR
uniform vec3 material_emissive;
#endif

#ifdef MAPFLOAT
uniform float material_emissiveIntensity;
#endif

void getEmission() {
		dEmission = vec3(1.0);

		#ifdef MAPFLOAT
		dEmission *= material_emissiveIntensity;
		#endif

		#ifdef MAPCOLOR
		dEmission *= material_emissive;
		#endif

		#ifdef MAPTEXTURE
		dEmission *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
		#endif

		#ifdef MAPVERTEX
		dEmission *= gammaCorrectInput(saturate(vVertexColor.$VC));
		#endif
}
`;

export { emissivePS as default };
