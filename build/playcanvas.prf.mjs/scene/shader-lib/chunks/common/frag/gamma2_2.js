/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var gamma2_2PS = `
float gammaCorrectInput(float color) {
		return decodeGamma(color);
}

vec3 gammaCorrectInput(vec3 color) {
		return decodeGamma(color);
}

vec4 gammaCorrectInput(vec4 color) {
		return vec4(decodeGamma(color.xyz), color.w);
}

vec3 gammaCorrectOutput(vec3 color) {
#ifdef HDR
		return color;
#else
		return pow(color + 0.0000001, vec3(1.0 / 2.2));
#endif
}
`;

export { gamma2_2PS as default };
