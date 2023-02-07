/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var envMultiplyPS = `
uniform float skyboxIntensity;

vec3 processEnvironment(vec3 color) {
		return color * skyboxIntensity;
}
`;

export { envMultiplyPS as default };
