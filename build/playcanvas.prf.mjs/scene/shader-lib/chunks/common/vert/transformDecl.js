/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var transformDeclVS = `
attribute vec3 vertex_position;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

vec3 dPositionW;
mat4 dModelMatrix;
`;

export { transformDeclVS as default };
