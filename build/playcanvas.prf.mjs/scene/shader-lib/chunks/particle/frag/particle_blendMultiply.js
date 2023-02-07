/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendMultiplyPS = `
		rgb = mix(vec3(1.0), rgb, vec3(a));
		if (rgb.r + rgb.g + rgb.b > 2.99) discard;
`;

export { particle_blendMultiplyPS as default };
