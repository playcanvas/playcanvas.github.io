/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingNonePS = `
vec3 toneMap(vec3 color) {
    return color;
}
`;

export { tonemappingNonePS as default };
