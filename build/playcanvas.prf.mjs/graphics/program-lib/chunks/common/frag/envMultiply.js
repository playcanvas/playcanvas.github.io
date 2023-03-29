/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var envMultiplyPS = `
uniform float skyboxIntensity;

vec3 processEnvironment(vec3 color) {
    return color * skyboxIntensity;
}
`;

export { envMultiplyPS as default };
