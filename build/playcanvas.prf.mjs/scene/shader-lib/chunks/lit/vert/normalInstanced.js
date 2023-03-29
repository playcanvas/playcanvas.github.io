/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalInstancedVS = `
vec3 getNormal() {
		dNormalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);
		return normalize(dNormalMatrix * vertex_normal);
}
`;

export { normalInstancedVS as default };
