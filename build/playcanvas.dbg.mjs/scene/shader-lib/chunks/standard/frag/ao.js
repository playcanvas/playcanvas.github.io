/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var aoPS = /* glsl */`

void getAO() {
    dAo = 1.0;

    #ifdef MAPTEXTURE
    dAo *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dAo *= saturate(vVertexColor.$VC);
    #endif
}
`;

export { aoPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW8uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2FvLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5cbnZvaWQgZ2V0QU8oKSB7XG4gICAgZEFvID0gMS4wO1xuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICBkQW8gKj0gdGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgIGRBbyAqPSBzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKTtcbiAgICAjZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxXQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
