/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var specularPS = `

#ifdef MAPCOLOR
uniform vec3 material_specular;
#endif

void getSpecularity() {
    vec3 specularColor = vec3(1,1,1);

    #ifdef MAPCOLOR
    specularColor *= material_specular;
    #endif

    #ifdef MAPTEXTURE
    specularColor *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    specularColor *= saturate(vVertexColor.$VC);
    #endif

    dSpecularity = specularColor;
}
`;

export { specularPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BlY3VsYXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL3NwZWN1bGFyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5cbiNpZmRlZiBNQVBDT0xPUlxudW5pZm9ybSB2ZWMzIG1hdGVyaWFsX3NwZWN1bGFyO1xuI2VuZGlmXG5cbnZvaWQgZ2V0U3BlY3VsYXJpdHkoKSB7XG4gICAgdmVjMyBzcGVjdWxhckNvbG9yID0gdmVjMygxLDEsMSk7XG5cbiAgICAjaWZkZWYgTUFQQ09MT1JcbiAgICBzcGVjdWxhckNvbG9yICo9IG1hdGVyaWFsX3NwZWN1bGFyO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICBzcGVjdWxhckNvbG9yICo9ICRERUNPREUodGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykpLiRDSDtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICBzcGVjdWxhckNvbG9yICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICNlbmRpZlxuXG4gICAgZFNwZWN1bGFyaXR5ID0gc3BlY3VsYXJDb2xvcjtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxpQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
