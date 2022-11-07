/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingLinearPS = `
uniform float exposure;

vec3 toneMap(vec3 color) {
    return color * exposure;
}
`;

export { tonemappingLinearPS as default };
