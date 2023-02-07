/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingNonePS = `
vec3 toneMap(vec3 color) {
		return color;
}
`;

export { tonemappingNonePS as default };
