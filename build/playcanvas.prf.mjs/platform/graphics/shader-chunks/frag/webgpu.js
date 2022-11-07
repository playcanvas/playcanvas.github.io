/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var webgpuPS = `

layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor

#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)
#define texture2DBias(res, uv, bias) texture(sampler2D(res, res ## _sampler), uv, bias)
#define texture2DLodEXT(res, uv, lod) textureLod(sampler2D(res, res ## _sampler), uv, lod)

// TODO: implement other texture sampling macros
// #define textureCube texture
// #define texture2DProj textureProj
// #define texture2DProjLodEXT textureProjLod
// #define textureCubeLodEXT textureLod
// #define texture2DGradEXT textureGrad
// #define texture2DProjGradEXT textureProjGrad
// #define textureCubeGradEXT textureGrad
#define GL2
#define SUPPORTS_TEXLOD
`;

export { webgpuPS as default };
