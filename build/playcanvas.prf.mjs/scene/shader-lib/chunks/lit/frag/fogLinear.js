/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var fogLinearPS = `
uniform vec3 fog_color;
uniform float fog_start;
uniform float fog_end;
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
		float depth = gl_FragCoord.z / gl_FragCoord.w;
		float fogFactor = (fog_end - depth) / (fog_end - fog_start);
		fogFactor = clamp(fogFactor, 0.0, 1.0);
		return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
`;

export { fogLinearPS as default };
