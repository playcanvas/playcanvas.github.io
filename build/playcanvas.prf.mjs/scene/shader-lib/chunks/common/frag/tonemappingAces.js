/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingAcesPS = `
uniform float exposure;

vec3 toneMap(vec3 color) {
		float tA = 2.51;
		float tB = 0.03;
		float tC = 2.43;
		float tD = 0.59;
		float tE = 0.14;
		vec3 x = color * exposure;
		return (x*(tA*x+tB))/(x*(tC*x+tD)+tE);
}
`;

export { tonemappingAcesPS as default };
