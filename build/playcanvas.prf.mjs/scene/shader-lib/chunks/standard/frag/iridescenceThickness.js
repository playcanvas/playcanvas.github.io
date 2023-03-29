/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var iridescenceThicknessPS = `
uniform float material_iridescenceThicknessMax;

#ifdef MAPTEXTURE
uniform float material_iridescenceThicknessMin;
#endif

void getIridescenceThickness() {

		#ifdef MAPTEXTURE
		float blend = texture2DBias($SAMPLER, $UV, textureBias).$CH;
		float iridescenceThickness = mix(material_iridescenceThicknessMin, material_iridescenceThicknessMax, blend);
		#else
		float iridescenceThickness = material_iridescenceThicknessMax;
		#endif

		dIridescenceThickness = iridescenceThickness; 
}
`;

export { iridescenceThicknessPS as default };
