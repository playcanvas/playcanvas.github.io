/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var outputAlphaPremulPS = `
gl_FragColor.rgb *= dAlpha;
gl_FragColor.a = dAlpha;
`;

export { outputAlphaPremulPS as default };
