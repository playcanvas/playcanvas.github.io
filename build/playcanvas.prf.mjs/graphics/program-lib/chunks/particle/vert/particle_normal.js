/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_normalVS = `
    Normal = normalize(localPos + matrix_viewInverse[2].xyz);
`;

export { particle_normalVS as default };
