/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_wrapVS = `
    vec3 origParticlePos = particlePos;
    particlePos -= matrix_model[3].xyz;
    particlePos = mod(particlePos, wrapBounds) - wrapBounds * 0.5;
    particlePos += matrix_model[3].xyz;
    particlePosMoved = particlePos - origParticlePos;
`;

export { particle_wrapVS as default };
