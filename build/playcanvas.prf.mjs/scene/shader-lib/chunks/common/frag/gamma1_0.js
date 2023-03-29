/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var gamma1_0PS = `
float gammaCorrectInput(float color) {
		return color;
}

vec3 gammaCorrectInput(vec3 color) {
		return color;
}

vec4 gammaCorrectInput(vec4 color) {
		return color;
}

vec3 gammaCorrectOutput(vec3 color) {
		return color;
}
`;

export { gamma1_0PS as default };
