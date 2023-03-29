/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_normalVS = `
    Normal = normalize(localPos + matrix_viewInverse[2].xyz);
`;

export { particle_normalVS as default };
