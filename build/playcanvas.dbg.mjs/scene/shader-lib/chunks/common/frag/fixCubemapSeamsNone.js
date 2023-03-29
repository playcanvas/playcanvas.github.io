/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var fixCubemapSeamsNonePS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4Q3ViZW1hcFNlYW1zTm9uZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NvbW1vbi9mcmFnL2ZpeEN1YmVtYXBTZWFtc05vbmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZlYzMgZml4U2VhbXModmVjMyB2ZWMsIGZsb2F0IG1pcG1hcEluZGV4KSB7XG4gICAgcmV0dXJuIHZlYztcbn1cblxudmVjMyBmaXhTZWFtcyh2ZWMzIHZlYykge1xuICAgIHJldHVybiB2ZWM7XG59XG5cbnZlYzMgZml4U2VhbXNTdGF0aWModmVjMyB2ZWMsIGZsb2F0IGludlJlY01pcFNpemUpIHtcbiAgICByZXR1cm4gdmVjO1xufVxuXG52ZWMzIGNhbGNTZWFtKHZlYzMgdmVjKSB7XG4gICAgcmV0dXJuIHZlYzMoMCk7XG59XG5cbnZlYzMgYXBwbHlTZWFtKHZlYzMgdmVjLCB2ZWMzIHNlYW0sIGZsb2F0IHNjYWxlKSB7XG4gICAgcmV0dXJuIHZlYztcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw0QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
