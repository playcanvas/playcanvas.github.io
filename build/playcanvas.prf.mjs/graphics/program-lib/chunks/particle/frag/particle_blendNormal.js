/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendNormalPS = `
    if (a < 0.01) discard;
`;

export { particle_blendNormalPS as default };
