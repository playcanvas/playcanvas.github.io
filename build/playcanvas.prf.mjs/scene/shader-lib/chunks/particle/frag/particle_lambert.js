/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_lambertPS = `
    vec3 negNormal = max(normal, vec3(0.0));
    vec3 posNormal = max(-normal, vec3(0.0));
`;

export { particle_lambertPS as default };
