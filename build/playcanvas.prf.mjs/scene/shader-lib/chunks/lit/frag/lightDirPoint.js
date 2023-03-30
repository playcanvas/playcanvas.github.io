/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightDirPointPS = `
void getLightDirPoint(vec3 lightPosW) {
		dLightDirW = vPositionW - lightPosW;
		dLightDirNormW = normalize(dLightDirW);
		dLightPosW = lightPosW;
}
`;

export { lightDirPointPS as default };
