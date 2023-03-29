/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var falloffLinearPS = `
float getFalloffLinear(float lightRadius, vec3 lightDir) {
		float d = length(lightDir);
		return max(((lightRadius - d) / lightRadius), 0.0);
}
`;

export { falloffLinearPS as default };
