/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var textureSamplePS = `
vec4 texture2DSRGB(sampler2D tex, vec2 uv) {
		return gammaCorrectInput(texture2D(tex, uv));
}

vec4 texture2DSRGB(sampler2D tex, vec2 uv, float bias) {
		return gammaCorrectInput(texture2D(tex, uv, bias));
}

vec3 texture2DRGBM(sampler2D tex, vec2 uv) {
		return decodeRGBM(texture2D(tex, uv));
}

vec3 texture2DRGBM(sampler2D tex, vec2 uv, float bias) {
		return decodeRGBM(texture2D(tex, uv, bias));
}

vec3 texture2DRGBE(sampler2D tex, vec2 uv) {
		return decodeRGBM(texture2D(tex, uv));
}

vec3 texture2DRGBE(sampler2D tex, vec2 uv, float bias) {
		return decodeRGBM(texture2D(tex, uv, bias));
}
`;

export { textureSamplePS as default };
