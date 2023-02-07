/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var endPS = `
		gl_FragColor.rgb = combineColor();

		gl_FragColor.rgb += dEmission;
		gl_FragColor.rgb = addFog(gl_FragColor.rgb);

		#ifndef HDR
		gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
		gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
		#endif
`;

export { endPS as default };
