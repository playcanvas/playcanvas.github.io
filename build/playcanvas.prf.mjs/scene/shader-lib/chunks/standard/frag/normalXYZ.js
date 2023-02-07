/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalXYZPS = `
vec3 unpackNormal(vec4 nmap) {
		return nmap.xyz * 2.0 - 1.0;
}
`;

export { normalXYZPS as default };
