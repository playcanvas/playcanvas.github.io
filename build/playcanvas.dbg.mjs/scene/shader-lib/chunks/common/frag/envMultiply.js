/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var envMultiplyPS = `
uniform float skyboxIntensity;

vec3 processEnvironment(vec3 color) {
    return color * skyboxIntensity;
}
`;

export { envMultiplyPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52TXVsdGlwbHkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy9lbnZNdWx0aXBseS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBmbG9hdCBza3lib3hJbnRlbnNpdHk7XG5cbnZlYzMgcHJvY2Vzc0Vudmlyb25tZW50KHZlYzMgY29sb3IpIHtcbiAgICByZXR1cm4gY29sb3IgKiBza3lib3hJbnRlbnNpdHk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsb0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
