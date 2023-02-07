/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_billboardVS = `
		quadXY = rotate(quadXY, inAngle, rotMatrix);
		vec3 localPos = billboard(particlePos, quadXY);
`;

export { particle_billboardVS as default };
