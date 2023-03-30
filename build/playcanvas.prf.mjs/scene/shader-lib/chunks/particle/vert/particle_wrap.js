/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
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
