/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWV0YWxuZXNzTW9kdWxhdGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9tZXRhbG5lc3NNb2R1bGF0ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2YwO1xuXG52b2lkIGdldE1ldGFsbmVzc01vZHVsYXRlKCkge1xuICAgIHZlYzMgZGllbGVjdHJpY0YwID0gbWF0ZXJpYWxfZjAgKiBkU3BlY3VsYXJpdHk7XG4gICAgZFNwZWN1bGFyaXR5ID0gbWl4KGRpZWxlY3RyaWNGMCwgZEFsYmVkbywgZE1ldGFsbmVzcyk7XG4gICAgZEFsYmVkbyAqPSAxLjAgLSBkTWV0YWxuZXNzO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDBCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
