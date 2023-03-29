/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4Q3ViZW1hcFNlYW1zTm9uZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9jb21tb24vZnJhZy9maXhDdWJlbWFwU2VhbXNOb25lLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGZpeFNlYW1zKHZlYzMgdmVjLCBmbG9hdCBtaXBtYXBJbmRleCkge1xuICAgIHJldHVybiB2ZWM7XG59XG5cbnZlYzMgZml4U2VhbXModmVjMyB2ZWMpIHtcbiAgICByZXR1cm4gdmVjO1xufVxuXG52ZWMzIGZpeFNlYW1zU3RhdGljKHZlYzMgdmVjLCBmbG9hdCBpbnZSZWNNaXBTaXplKSB7XG4gICAgcmV0dXJuIHZlYztcbn1cblxudmVjMyBjYWxjU2VhbSh2ZWMzIHZlYykge1xuICAgIHJldHVybiB2ZWMzKDApO1xufVxuXG52ZWMzIGFwcGx5U2VhbSh2ZWMzIHZlYywgdmVjMyBzZWFtLCBmbG9hdCBzY2FsZSkge1xuICAgIHJldHVybiB2ZWM7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXBCQTs7OzsifQ==
