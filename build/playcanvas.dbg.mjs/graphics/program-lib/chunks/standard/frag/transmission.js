/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var transmissionPS = `

#ifdef MAPFLOAT
uniform float material_refraction;
#endif

void getRefraction() {
    float refraction = 1.0;

    #ifdef MAPFLOAT
    refraction = material_refraction;
    #endif

    #ifdef MAPTEXTURE
    refraction *= gammaCorrectInput(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    refraction *= saturate(vVertexColor.$VC);
    #endif

    dTransmission = refraction;
}
`;

export { transmissionPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNtaXNzaW9uLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvdHJhbnNtaXNzaW9uLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5cbiNpZmRlZiBNQVBGTE9BVFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZyYWN0aW9uO1xuI2VuZGlmXG5cbnZvaWQgZ2V0UmVmcmFjdGlvbigpIHtcbiAgICBmbG9hdCByZWZyYWN0aW9uID0gMS4wO1xuXG4gICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgcmVmcmFjdGlvbiA9IG1hdGVyaWFsX3JlZnJhY3Rpb247XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgIHJlZnJhY3Rpb24gKj0gZ2FtbWFDb3JyZWN0SW5wdXQodGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykpLiRDSDtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICByZWZyYWN0aW9uICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICNlbmRpZlxuXG4gICAgZFRyYW5zbWlzc2lvbiA9IHJlZnJhY3Rpb247XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEscUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQXZCQTs7OzsifQ==
