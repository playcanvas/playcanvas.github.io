/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var tangentBinormalVS = `
vec3 getTangent() {
		return normalize(dNormalMatrix * vertex_tangent.xyz);
}

vec3 getBinormal() {
		return cross(vNormalW, vTangentW) * vertex_tangent.w;
}

vec3 getObjectSpaceUp() {
		return normalize(dNormalMatrix * vec3(0, 1, 0));
}
`;

export { tangentBinormalVS as default };
