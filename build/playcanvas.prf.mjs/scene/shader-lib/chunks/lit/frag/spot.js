/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var spotPS = `
float getSpotEffect(vec3 lightSpotDirW, float lightInnerConeAngle, float lightOuterConeAngle) {
    float cosAngle = dot(dLightDirNormW, lightSpotDirW);
    return smoothstep(lightOuterConeAngle, lightInnerConeAngle, cosAngle);
}
`;

export { spotPS as default };
