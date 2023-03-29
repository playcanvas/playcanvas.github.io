/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalXYPS = `
vec3 unpackNormal(vec4 nmap) {
		vec3 normal;
		normal.xy = nmap.wy * 2.0 - 1.0;
		normal.z = sqrt(1.0 - saturate(dot(normal.xy, normal.xy)));
		return normal;
}
`;

export { normalXYPS as default };
