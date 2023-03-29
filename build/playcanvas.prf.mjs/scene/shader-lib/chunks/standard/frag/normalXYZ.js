/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalXYZPS = `
vec3 unpackNormal(vec4 nmap) {
		return nmap.xyz * 2.0 - 1.0;
}
`;

export { normalXYZPS as default };
