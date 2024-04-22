var transformDeclVS = /* glsl */`
attribute vec3 vertex_position;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

vec3 dPositionW;
mat4 dModelMatrix;
`;

export { transformDeclVS as default };
