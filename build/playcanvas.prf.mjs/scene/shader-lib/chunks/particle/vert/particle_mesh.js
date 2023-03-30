/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_meshVS = `
		vec3 localPos = meshLocalPos;
		localPos.xy = rotate(localPos.xy, inAngle, rotMatrix);
		localPos.yz = rotate(localPos.yz, inAngle, rotMatrix);

		billboard(particlePos, quadXY);
`;

export { particle_meshVS as default };
