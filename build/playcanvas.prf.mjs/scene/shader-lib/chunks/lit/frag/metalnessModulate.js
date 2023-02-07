/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var metalnessModulatePS = `

uniform float material_f0;

void getMetalnessModulate() {
		vec3 dielectricF0 = material_f0 * dSpecularity;
		dSpecularity = mix(dielectricF0, dAlbedo, dMetalness);
		dAlbedo *= 1.0 - dMetalness;
}
`;

export { metalnessModulatePS as default };
