/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightDiffuseLambertPS = `
float getLightDiffuse(vec3 worldNormal, vec3 viewDir, vec3 lightDir, vec3 lightDirNorm) {
		return max(dot(worldNormal, -lightDirNorm), 0.0);
}
`;

export { lightDiffuseLambertPS as default };
