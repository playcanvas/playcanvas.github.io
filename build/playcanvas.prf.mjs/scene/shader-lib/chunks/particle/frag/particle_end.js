/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_endPS = `
		rgb = addFog(rgb);
		rgb = toneMap(rgb);
		rgb = gammaCorrectOutput(rgb);
		gl_FragColor = vec4(rgb, a);
}
`;

export { particle_endPS as default };
