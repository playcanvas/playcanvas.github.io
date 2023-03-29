/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particleAnimFrameClampVS = `
		float animFrame = min(floor(texCoordsAlphaLife.w * animTexParams.y) + animTexParams.x, animTexParams.z);
`;

export { particleAnimFrameClampVS as default };
