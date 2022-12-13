/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var falloffLinearPS = `
float getFalloffLinear(float lightRadius) {
    float d = length(dLightDirW);
    return max(((lightRadius - d) / lightRadius), 0.0);
}
`;

export { falloffLinearPS as default };
