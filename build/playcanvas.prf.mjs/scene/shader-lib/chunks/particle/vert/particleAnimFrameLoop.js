/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleAnimFrameLoopVS = `
    float animFrame = floor(mod(texCoordsAlphaLife.w * animTexParams.y + animTexParams.x, animTexParams.z + 1.0));
`;

export { particleAnimFrameLoopVS as default };
