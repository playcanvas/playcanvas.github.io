/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_halflambertPS = `
		vec3 negNormal = normal*0.5+0.5;
		vec3 posNormal = -normal*0.5+0.5;
		negNormal *= negNormal;
		posNormal *= posNormal;
`;

export { particle_halflambertPS as default };
