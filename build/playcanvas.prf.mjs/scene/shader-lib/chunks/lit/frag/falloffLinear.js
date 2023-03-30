/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var falloffLinearPS = `
float getFalloffLinear(float lightRadius, vec3 lightDir) {
		float d = length(lightDir);
		return max(((lightRadius - d) / lightRadius), 0.0);
}
`;

export { falloffLinearPS as default };
