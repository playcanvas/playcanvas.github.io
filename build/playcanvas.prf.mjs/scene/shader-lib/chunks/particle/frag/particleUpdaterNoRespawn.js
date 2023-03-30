/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterNoRespawnPS = `
		if (outLife >= lifetime) {
				outLife -= max(lifetime, (numParticles - 1.0) * particleRate);
				visMode = -1.0;
		}
`;

export { particleUpdaterNoRespawnPS as default };
