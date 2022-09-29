/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
