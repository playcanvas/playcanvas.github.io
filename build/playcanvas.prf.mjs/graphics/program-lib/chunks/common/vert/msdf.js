/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var msdfVS = `
attribute vec3 vertex_outlineParameters;
attribute vec3 vertex_shadowParameters;

varying vec4 outline_color;
varying float outline_thickness;
varying vec4 shadow_color;
varying vec2 shadow_offset;

void unpackMsdfParams() {
    vec3 little = mod(vertex_outlineParameters, 256.);
    vec3 big = (vertex_outlineParameters - little) / 256.;

    outline_color.rb = little.xy / 255.;
    outline_color.ga = big.xy / 255.;

    // _outlineThicknessScale === 0.2
    outline_thickness = little.z / 255. * 0.2;

    little = mod(vertex_shadowParameters, 256.);
    big = (vertex_shadowParameters - little) / 256.;

    shadow_color.rb = little.xy / 255.;
    shadow_color.ga = big.xy / 255.;

    // vec2(little.z, big.z) / 127. - 1. remaps shadow offset from [0, 254] to [-1, 1]
    // _shadowOffsetScale === 0.005
    shadow_offset = (vec2(little.z, big.z) / 127. - 1.) * 0.005;
}
`;

export { msdfVS as default };
