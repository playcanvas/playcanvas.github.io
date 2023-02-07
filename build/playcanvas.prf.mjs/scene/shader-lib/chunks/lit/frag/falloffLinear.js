/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var falloffLinearPS = `
float getFalloffLinear(float lightRadius) {
		float d = length(dLightDirW);
		return max(((lightRadius - d) / lightRadius), 0.0);
}
`;

export { falloffLinearPS as default };
