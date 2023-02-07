/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var viewNormalVS = `
#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

vec3 getViewNormal() {
		return mat3(matrix_view) * vNormalW;
}
`;

export { viewNormalVS as default };
