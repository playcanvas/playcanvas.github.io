/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_localShiftVS = `
		particlePos = (matrix_model * vec4(particlePos, 1.0)).xyz;
`;

export { particle_localShiftVS as default };
