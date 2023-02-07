/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var fixCubemapSeamsNonePS = `
vec3 fixSeams(vec3 vec, float mipmapIndex) {
		return vec;
}

vec3 fixSeams(vec3 vec) {
		return vec;
}

vec3 fixSeamsStatic(vec3 vec, float invRecMipSize) {
		return vec;
}

vec3 calcSeam(vec3 vec) {
		return vec3(0);
}

vec3 applySeam(vec3 vec, vec3 seam, float scale) {
		return vec;
}
`;

export { fixCubemapSeamsNonePS as default };
