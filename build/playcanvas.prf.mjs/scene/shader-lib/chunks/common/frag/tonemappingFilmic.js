/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingFilmicPS = `
const float A =  0.15;
const float B =  0.50;
const float C =  0.10;
const float D =  0.20;
const float E =  0.02;
const float F =  0.30;
const float W =  11.2;

uniform float exposure;

vec3 uncharted2Tonemap(vec3 x) {
	 return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 toneMap(vec3 color) {
		color = uncharted2Tonemap(color * exposure);
		vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W,W,W));
		color = color * whiteScale;

		return color;
}
`;

export { tonemappingFilmicPS as default };
