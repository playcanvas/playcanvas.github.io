/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalXYZPS = `
vec3 unpackNormal(vec4 nmap) {
    return nmap.xyz * 2.0 - 1.0;
}
`;

export { normalXYZPS as default };
