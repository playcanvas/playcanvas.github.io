/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterNoRespawnPS = `
    if (outLife >= lifetime) {
        outLife -= max(lifetime, (numParticles - 1.0) * particleRate);
        visMode = -1.0;
    }
`;

export { particleUpdaterNoRespawnPS as default };
