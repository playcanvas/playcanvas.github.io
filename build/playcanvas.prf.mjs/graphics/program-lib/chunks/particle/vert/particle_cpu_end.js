/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_cpu_endVS = `
    localPos *= particle_vertexData2.y * emitterScale;
    localPos += particlePos;

    gl_Position = matrix_viewProjection * vec4(localPos, 1.0);
`;

export { particle_cpu_endVS as default };
