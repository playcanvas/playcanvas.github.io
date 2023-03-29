/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingLinearPS = `
uniform float exposure;

vec3 toneMap(vec3 color) {
    return color * exposure;
}
`;

export { tonemappingLinearPS as default };
