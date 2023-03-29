/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var envMultiplyPS = `
uniform float skyboxIntensity;

vec3 processEnvironment(vec3 color) {
		return color * skyboxIntensity;
}
`;

export { envMultiplyPS as default };
