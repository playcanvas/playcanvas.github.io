/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
