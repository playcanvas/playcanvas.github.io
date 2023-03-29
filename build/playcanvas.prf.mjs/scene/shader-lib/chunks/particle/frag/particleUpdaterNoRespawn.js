/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterNoRespawnPS = `
		if (outLife >= lifetime) {
				outLife -= max(lifetime, (numParticles - 1.0) * particleRate);
				visMode = -1.0;
		}
`;

export { particleUpdaterNoRespawnPS as default };
