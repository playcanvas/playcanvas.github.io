/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalInstancedVS = `
vec3 getNormal() {
    dNormalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);
    return normalize(dNormalMatrix * vertex_normal);
}
`;

export { normalInstancedVS as default };
