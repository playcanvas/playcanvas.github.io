/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_customFaceVS = `
    quadXY = rotate(quadXY, inAngle, rotMatrix);
    vec3 localPos = customFace(particlePos, quadXY);
`;

export { particle_customFaceVS as default };
