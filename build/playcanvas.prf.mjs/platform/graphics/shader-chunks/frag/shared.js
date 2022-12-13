/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var sharedFS = `

// convert clip space position into texture coordinates to sample scene grab textures
vec2 getGrabScreenPos(vec4 clipPos) {
    vec2 uv = (clipPos.xy / clipPos.w) * 0.5 + 0.5;

    #ifdef WEBGPU
        uv.y = 1.0 - uv.y;
    #endif

    return uv;
}
`;

export { sharedFS as default };
