/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
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