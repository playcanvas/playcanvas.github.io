/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
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
