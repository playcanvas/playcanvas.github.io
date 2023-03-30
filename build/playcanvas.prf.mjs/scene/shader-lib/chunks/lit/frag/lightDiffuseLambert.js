/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightDiffuseLambertPS = `
float getLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir, vec3 lightDirNorm) {
		return max(dot(worldNormal, -lightDirNorm), 0.0);
}
`;

export { lightDiffuseLambertPS as default };
