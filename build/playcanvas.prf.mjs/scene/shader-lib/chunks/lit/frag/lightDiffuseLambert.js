/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightDiffuseLambertPS = `
float getLightDiffuse() {
		return max(dot(dNormalW, -dLightDirNormW), 0.0);
}
`;

export { lightDiffuseLambertPS as default };
