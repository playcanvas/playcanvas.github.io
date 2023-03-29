/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_meshVS = `
		vec3 localPos = meshLocalPos;
		localPos.xy = rotate(localPos.xy, inAngle, rotMatrix);
		localPos.yz = rotate(localPos.yz, inAngle, rotMatrix);

		billboard(particlePos, quadXY);
`;

export { particle_meshVS as default };
