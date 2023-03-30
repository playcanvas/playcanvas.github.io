/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var diffusePS = `
#ifdef MAPCOLOR
uniform vec3 material_diffuse;
#endif

void getAlbedo() {
		dAlbedo = vec3(1.0);

#ifdef MAPCOLOR
		dAlbedo *= material_diffuse.rgb;
#endif

#ifdef MAPTEXTURE
		vec3 albedoBase = $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
		dAlbedo *= addAlbedoDetail(albedoBase);
#endif

#ifdef MAPVERTEX
		dAlbedo *= gammaCorrectInput(saturate(vVertexColor.$VC));
#endif
}
`;

export { diffusePS as default };
