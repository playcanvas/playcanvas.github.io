/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fogExpPS = `
uniform vec3 fog_color;
uniform float fog_density;
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = exp(-depth * fog_density);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
`;

export { fogExpPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9nRXhwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2ZvZ0V4cC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSB2ZWMzIGZvZ19jb2xvcjtcbnVuaWZvcm0gZmxvYXQgZm9nX2RlbnNpdHk7XG5mbG9hdCBkQmxlbmRNb2RlRm9nRmFjdG9yID0gMS4wO1xuXG52ZWMzIGFkZEZvZyh2ZWMzIGNvbG9yKSB7XG4gICAgZmxvYXQgZGVwdGggPSBnbF9GcmFnQ29vcmQueiAvIGdsX0ZyYWdDb29yZC53O1xuICAgIGZsb2F0IGZvZ0ZhY3RvciA9IGV4cCgtZGVwdGggKiBmb2dfZGVuc2l0eSk7XG4gICAgZm9nRmFjdG9yID0gY2xhbXAoZm9nRmFjdG9yLCAwLjAsIDEuMCk7XG4gICAgcmV0dXJuIG1peChmb2dfY29sb3IgKiBkQmxlbmRNb2RlRm9nRmFjdG9yLCBjb2xvciwgZm9nRmFjdG9yKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxlQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FYQTs7OzsifQ==
