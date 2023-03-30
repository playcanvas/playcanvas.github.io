/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var outputAlphaPS = `
gl_FragColor.a = litShaderArgs.opacity;
`;

export { outputAlphaPS as default };
