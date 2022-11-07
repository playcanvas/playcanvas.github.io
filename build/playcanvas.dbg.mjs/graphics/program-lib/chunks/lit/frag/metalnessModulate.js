/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var metalnessModulatePS = `

uniform float material_f0;

void getMetalnessModulate() {
    vec3 dielectricF0 = material_f0 * dSpecularity;
    dSpecularity = mix(dielectricF0, dAlbedo, dMetalness);
    dAlbedo *= 1.0 - dMetalness;
}
`;

export { metalnessModulatePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWxuZXNzTW9kdWxhdGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvbGl0L2ZyYWcvbWV0YWxuZXNzTW9kdWxhdGUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcblxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9mMDtcblxudm9pZCBnZXRNZXRhbG5lc3NNb2R1bGF0ZSgpIHtcbiAgICB2ZWMzIGRpZWxlY3RyaWNGMCA9IG1hdGVyaWFsX2YwICogZFNwZWN1bGFyaXR5O1xuICAgIGRTcGVjdWxhcml0eSA9IG1peChkaWVsZWN0cmljRjAsIGRBbGJlZG8sIGRNZXRhbG5lc3MpO1xuICAgIGRBbGJlZG8gKj0gMS4wIC0gZE1ldGFsbmVzcztcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwwQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FUQTs7OzsifQ==
