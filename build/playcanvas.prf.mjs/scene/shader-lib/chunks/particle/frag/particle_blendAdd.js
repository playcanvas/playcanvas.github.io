/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendAddPS = `
		dBlendModeFogFactor = 0.0;
		rgb *= saturate(gammaCorrectInput(max(a, 0.0)));
		if ((rgb.r + rgb.g + rgb.b) < 0.000001) discard;
`;

export { particle_blendAddPS as default };
