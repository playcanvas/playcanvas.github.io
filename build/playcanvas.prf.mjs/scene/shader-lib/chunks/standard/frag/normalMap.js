/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalMapPS = `
#ifdef MAPTEXTURE
uniform float material_bumpiness;
#endif

void getNormal() {
#ifdef MAPTEXTURE
		vec3 normalMap = unpackNormal(texture2DBias($SAMPLER, $UV, textureBias));
		normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpiness);
		dNormalW = normalize(dTBN * addNormalDetail(normalMap));
#else
		dNormalW = dVertexNormalW;
#endif
}
`;

export { normalMapPS as default };
