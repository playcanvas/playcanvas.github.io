/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
