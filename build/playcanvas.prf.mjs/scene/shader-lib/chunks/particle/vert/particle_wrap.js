/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_wrapVS = `
		vec3 origParticlePos = particlePos;
		particlePos -= matrix_model[3].xyz;
		particlePos = mod(particlePos, wrapBounds) - wrapBounds * 0.5;
		particlePos += matrix_model[3].xyz;
		particlePosMoved = particlePos - origParticlePos;
`;

export { particle_wrapVS as default };
