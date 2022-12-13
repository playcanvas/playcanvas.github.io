/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_pointAlongVS = `
    inAngle = atan(velocityV.x, velocityV.y); // not the fastest way, but easier to plug in; TODO: create rot matrix right from vectors

`;

export { particle_pointAlongVS as default };
