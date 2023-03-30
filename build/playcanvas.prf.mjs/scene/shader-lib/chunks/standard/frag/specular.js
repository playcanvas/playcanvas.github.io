/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var specularPS = `

#ifdef MAPCOLOR
uniform vec3 material_specular;
#endif

void getSpecularity() {
		vec3 specularColor = vec3(1,1,1);

		#ifdef MAPCOLOR
		specularColor *= material_specular;
		#endif

		#ifdef MAPTEXTURE
		specularColor *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
		#endif

		#ifdef MAPVERTEX
		specularColor *= saturate(vVertexColor.$VC);
		#endif

		dSpecularity = specularColor;
}
`;

export { specularPS as default };
