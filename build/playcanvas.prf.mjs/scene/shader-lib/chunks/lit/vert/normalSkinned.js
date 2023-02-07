/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalSkinnedVS = `
vec3 getNormal() {
		dNormalMatrix = mat3(dModelMatrix[0].xyz, dModelMatrix[1].xyz, dModelMatrix[2].xyz);
		return normalize(dNormalMatrix * vertex_normal);
}
`;

export { normalSkinnedVS as default };
