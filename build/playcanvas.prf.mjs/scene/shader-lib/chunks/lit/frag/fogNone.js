/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var fogNonePS = `
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
		return color;
}
`;

export { fogNonePS as default };
