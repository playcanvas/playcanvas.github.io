/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendMultiplyPS = `
    rgb = mix(vec3(1.0), rgb, vec3(a));
    if (rgb.r + rgb.g + rgb.b > 2.99) discard;
`;

export { particle_blendMultiplyPS as default };
