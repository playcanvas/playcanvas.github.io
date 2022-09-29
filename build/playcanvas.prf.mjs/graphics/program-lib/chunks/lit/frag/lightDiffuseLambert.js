/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightDiffuseLambertPS = `
float getLightDiffuse() {
    return max(dot(dNormalW, -dLightDirNormW), 0.0);
}
`;

export { lightDiffuseLambertPS as default };
