/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var webgpuVS = `
#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)

#define GL2
#define VERTEXSHADER
`;

export { webgpuVS as default };
