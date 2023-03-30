/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var ambientSHPS = `
uniform vec3 ambientSH[9];

void addAmbient(vec3 worldNormal) {
		vec3 n = cubeMapRotate(worldNormal);

		vec3 color =
				ambientSH[0] +
				ambientSH[1] * n.x +
				ambientSH[2] * n.y +
				ambientSH[3] * n.z +
				ambientSH[4] * n.x * n.z +
				ambientSH[5] * n.z * n.y +
				ambientSH[6] * n.y * n.x +
				ambientSH[7] * (3.0 * n.z * n.z - 1.0) +
				ambientSH[8] * (n.x * n.x - n.y * n.y);

		dDiffuseLight += processEnvironment(max(color, vec3(0.0)));
}
`;

export { ambientSHPS as default };
