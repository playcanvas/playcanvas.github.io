/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var transformDeclVS = `
attribute vec3 vertex_position;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

vec3 dPositionW;
mat4 dModelMatrix;
`;

export { transformDeclVS as default };
