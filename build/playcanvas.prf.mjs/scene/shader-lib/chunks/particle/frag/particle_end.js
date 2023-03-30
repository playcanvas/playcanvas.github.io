/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
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
