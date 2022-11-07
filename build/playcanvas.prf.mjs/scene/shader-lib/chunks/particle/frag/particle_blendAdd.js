/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendAddPS = `
    dBlendModeFogFactor = 0.0;
    rgb *= saturate(gammaCorrectInput(max(a, 0.0)));
    if ((rgb.r + rgb.g + rgb.b) < 0.000001) discard;
`;

export { particle_blendAddPS as default };
