/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_lambertPS = `
		vec3 negNormal = max(normal, vec3(0.0));
		vec3 posNormal = max(-normal, vec3(0.0));
`;

export { particle_lambertPS as default };
