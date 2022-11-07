/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalSkinnedVS = `
vec3 getNormal() {
    dNormalMatrix = mat3(dModelMatrix[0].xyz, dModelMatrix[1].xyz, dModelMatrix[2].xyz);
    return normalize(dNormalMatrix * vertex_normal);
}
`;

export { normalSkinnedVS as default };
