/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_billboardVS = `
    quadXY = rotate(quadXY, inAngle, rotMatrix);
    vec3 localPos = billboard(particlePos, quadXY);
`;

export { particle_billboardVS as default };
