/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var outputAlphaPremulPS = `
gl_FragColor.rgb *= litShaderArgs.opacity;
gl_FragColor.a = litShaderArgs.opacity;
`;

export { outputAlphaPremulPS as default };
