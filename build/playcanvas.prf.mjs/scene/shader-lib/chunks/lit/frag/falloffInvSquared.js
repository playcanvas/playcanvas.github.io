/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var falloffInvSquaredPS = `
float getFalloffWindow(float lightRadius) {
    float sqrDist = dot(dLightDirW, dLightDirW);
    float invRadius = 1.0 / lightRadius;
    return square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );
}

float getFalloffInvSquared(float lightRadius) {
    float sqrDist = dot(dLightDirW, dLightDirW);
    float falloff = 1.0 / (sqrDist + 1.0);
    float invRadius = 1.0 / lightRadius;

    falloff *= 16.0;
    falloff *= square( saturate( 1.0 - square( sqrDist * square(invRadius) ) ) );

    return falloff;
}
`;

export { falloffInvSquaredPS as default };
