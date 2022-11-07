/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_localShiftVS = `
    particlePos = (matrix_model * vec4(particlePos, 1.0)).xyz;
`;

export { particle_localShiftVS as default };
