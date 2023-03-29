/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var biasConstPS = `
#define SHADOWBIAS

float getShadowBias(float resolution, float maxBias) {
    return maxBias;
}
`;

export { biasConstPS as default };
