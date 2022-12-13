/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_softVS = `
    vDepth = getLinearDepth(localPos);
`;

export { particle_softVS as default };
