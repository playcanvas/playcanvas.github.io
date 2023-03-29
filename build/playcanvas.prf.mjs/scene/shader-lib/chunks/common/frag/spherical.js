/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var sphericalPS = `
// equirectangular helper functions
const float PI = 3.141592653589793;

vec2 toSpherical(vec3 dir) {
		return vec2(dir.xz == vec2(0.0) ? 0.0 : atan(dir.x, dir.z), asin(dir.y));
}

vec2 toSphericalUv(vec3 dir) {
		vec2 uv = toSpherical(dir) / vec2(PI * 2.0, PI) + 0.5;
		return vec2(uv.x, 1.0 - uv.y);
}
`;

export { sphericalPS as default };
