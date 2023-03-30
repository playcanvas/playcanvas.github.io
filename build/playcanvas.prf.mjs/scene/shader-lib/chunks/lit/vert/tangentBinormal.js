/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var tangentBinormalVS = `
vec3 getTangent() {
		return normalize(dNormalMatrix * vertex_tangent.xyz);
}

vec3 getBinormal() {
		return cross(vNormalW, vTangentW) * vertex_tangent.w;
}
`;

export { tangentBinormalVS as default };
