/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendNormalPS = `
		if (a < 0.01) discard;
`;

export { particle_blendNormalPS as default };
