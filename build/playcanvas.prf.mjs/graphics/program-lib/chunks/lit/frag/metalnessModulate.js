/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var metalnessModulatePS = `

uniform float material_f0;

void getMetalnessModulate() {
    vec3 dielectricF0 = material_f0 * dSpecularity;
    dSpecularity = mix(dielectricF0, dAlbedo, dMetalness);
    dAlbedo *= 1.0 - dMetalness;
}
`;

export { metalnessModulatePS as default };
