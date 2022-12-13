/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var gles2PS = `
#define texture2DBias texture2D

#ifndef SUPPORTS_TEXLOD

// fallback for lod instructions
#define texture2DLodEXT texture2D
#define texture2DProjLodEXT textureProj
#define textureCubeLodEXT textureCube
#define textureShadow texture2D

#else

#define textureShadow(res, uv) texture2DGradEXT(res, uv, vec2(1, 1), vec2(1, 1))

#endif

`;

export { gles2PS as default };
