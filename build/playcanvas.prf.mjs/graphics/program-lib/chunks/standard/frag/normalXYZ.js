/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalXYZPS = `
vec3 unpackNormal(vec4 nmap) {
    return nmap.xyz * 2.0 - 1.0;
}
`;

export { normalXYZPS as default };
