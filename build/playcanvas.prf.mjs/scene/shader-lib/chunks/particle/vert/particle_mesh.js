/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_meshVS = `
    vec3 localPos = meshLocalPos;
    localPos.xy = rotate(localPos.xy, inAngle, rotMatrix);
    localPos.yz = rotate(localPos.yz, inAngle, rotMatrix);

    billboard(particlePos, quadXY);
`;

export { particle_meshVS as default };
