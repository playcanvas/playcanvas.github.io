/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var outputAlphaPremulPS = `
gl_FragColor.rgb *= dAlpha;
gl_FragColor.a = dAlpha;
`;

export { outputAlphaPremulPS as default };
