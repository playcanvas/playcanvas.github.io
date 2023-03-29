/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fogExp2PS = `
uniform vec3 fog_color;
uniform float fog_density;
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = exp(-depth * depth * fog_density * fog_density);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
`;

export { fogExp2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9nRXhwMi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9mb2dFeHAyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHZlYzMgZm9nX2NvbG9yO1xudW5pZm9ybSBmbG9hdCBmb2dfZGVuc2l0eTtcbmZsb2F0IGRCbGVuZE1vZGVGb2dGYWN0b3IgPSAxLjA7XG5cbnZlYzMgYWRkRm9nKHZlYzMgY29sb3IpIHtcbiAgICBmbG9hdCBkZXB0aCA9IGdsX0ZyYWdDb29yZC56IC8gZ2xfRnJhZ0Nvb3JkLnc7XG4gICAgZmxvYXQgZm9nRmFjdG9yID0gZXhwKC1kZXB0aCAqIGRlcHRoICogZm9nX2RlbnNpdHkgKiBmb2dfZGVuc2l0eSk7XG4gICAgZm9nRmFjdG9yID0gY2xhbXAoZm9nRmFjdG9yLCAwLjAsIDEuMCk7XG4gICAgcmV0dXJuIG1peChmb2dfY29sb3IgKiBkQmxlbmRNb2RlRm9nRmFjdG9yLCBjb2xvciwgZm9nRmFjdG9yKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBWEE7Ozs7In0=
