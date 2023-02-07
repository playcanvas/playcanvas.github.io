/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_cpu_endVS = `
		localPos *= particle_vertexData2.y * emitterScale;
		localPos += particlePos;

		gl_Position = matrix_viewProjection * vec4(localPos, 1.0);
`;

export { particle_cpu_endVS as default };
