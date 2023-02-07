/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var fogNonePS = `
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
		return color;
}
`;

export { fogNonePS as default };
