/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_customFaceVS = `
		quadXY = rotate(quadXY, inAngle, rotMatrix);
		vec3 localPos = customFace(particlePos, quadXY);
`;

export { particle_customFaceVS as default };
