/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_normalVS = `
		Normal = normalize(localPos + matrix_viewInverse[2].xyz);
`;

export { particle_normalVS as default };
