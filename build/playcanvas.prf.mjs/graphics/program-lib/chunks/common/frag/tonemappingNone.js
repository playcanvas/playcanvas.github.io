/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingNonePS = `
vec3 toneMap(vec3 color) {
    return color;
}
`;

export { tonemappingNonePS as default };
