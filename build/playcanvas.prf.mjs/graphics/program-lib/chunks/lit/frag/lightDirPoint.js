/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var lightDirPointPS = `
void getLightDirPoint(vec3 lightPosW) {
    dLightDirW = vPositionW - lightPosW;
    dLightDirNormW = normalize(dLightDirW);
    dLightPosW = lightPosW;
}
`;

export { lightDirPointPS as default };
