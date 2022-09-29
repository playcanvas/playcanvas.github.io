/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_softVS = `
    vDepth = getLinearDepth(localPos);
`;

export { particle_softVS as default };
