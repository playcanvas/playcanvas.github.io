/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_softVS = `
		vDepth = getLinearDepth(localPos);
`;

export { particle_softVS as default };
