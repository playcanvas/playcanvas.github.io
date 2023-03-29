/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_stretchVS = `
		vec3 moveDir = inVel * stretch;
		vec3 posPrev = particlePos - moveDir;
		posPrev += particlePosMoved;

		vec2 centerToVertexV = normalize((mat3(matrix_view) * localPos).xy);

		float interpolation = dot(-velocityV, centerToVertexV) * 0.5 + 0.5;

		particlePos = mix(particlePos, posPrev, interpolation);
`;

export { particle_stretchVS as default };
