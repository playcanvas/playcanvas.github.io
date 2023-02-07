/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var outputAlphaPremulPS = `
gl_FragColor.rgb *= dAlpha;
gl_FragColor.a = dAlpha;
`;

export { outputAlphaPremulPS as default };
