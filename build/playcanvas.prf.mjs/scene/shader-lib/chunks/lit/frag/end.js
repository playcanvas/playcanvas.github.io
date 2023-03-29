/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var endPS = `
		gl_FragColor.rgb = combineColor(litShaderArgs.albedo, litShaderArgs.sheen.specularity, litShaderArgs.clearcoat.specularity);

		gl_FragColor.rgb += litShaderArgs.emission;
		gl_FragColor.rgb = addFog(gl_FragColor.rgb);

		#ifndef HDR
		gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
		gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
		#endif
`;

export { endPS as default };
