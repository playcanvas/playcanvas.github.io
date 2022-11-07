/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflectionEnvHQPS = `
#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif
uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 tReflDirW, float tGlossiness) {
    vec3 dir = cubeMapProject(tReflDirW) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    // calculate roughness level
    float level = saturate(1.0 - tGlossiness) * 5.0;
    float ilevel = floor(level);
    float flevel = level - ilevel;

    vec3 sharp = $DECODE(textureCube(texture_cubeMap, fixSeams(dir)));
    vec3 roughA = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel)));
    vec3 roughB = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(sharp, mix(roughA, roughB, flevel), min(level, 1.0)));
}

void addReflection() {   
    dReflection += vec4(calcReflection(dReflDirW, dGlossiness), material_reflectivity);
}
`;

export { reflectionEnvHQPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkVudkhRLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbGVjdGlvbkVudkhRLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZuZGVmIEVOVl9BVExBU1xuI2RlZmluZSBFTlZfQVRMQVNcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZW52QXRsYXM7XG4jZW5kaWZcbnVuaWZvcm0gc2FtcGxlckN1YmUgdGV4dHVyZV9jdWJlTWFwO1xudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZsZWN0aXZpdHk7XG5cbnZlYzMgY2FsY1JlZmxlY3Rpb24odmVjMyB0UmVmbERpclcsIGZsb2F0IHRHbG9zc2luZXNzKSB7XG4gICAgdmVjMyBkaXIgPSBjdWJlTWFwUHJvamVjdCh0UmVmbERpclcpICogdmVjMygtMS4wLCAxLjAsIDEuMCk7XG4gICAgdmVjMiB1diA9IHRvU3BoZXJpY2FsVXYoZGlyKTtcblxuICAgIC8vIGNhbGN1bGF0ZSByb3VnaG5lc3MgbGV2ZWxcbiAgICBmbG9hdCBsZXZlbCA9IHNhdHVyYXRlKDEuMCAtIHRHbG9zc2luZXNzKSAqIDUuMDtcbiAgICBmbG9hdCBpbGV2ZWwgPSBmbG9vcihsZXZlbCk7XG4gICAgZmxvYXQgZmxldmVsID0gbGV2ZWwgLSBpbGV2ZWw7XG5cbiAgICB2ZWMzIHNoYXJwID0gJERFQ09ERSh0ZXh0dXJlQ3ViZSh0ZXh0dXJlX2N1YmVNYXAsIGZpeFNlYW1zKGRpcikpKTtcbiAgICB2ZWMzIHJvdWdoQSA9ICRERUNPREUodGV4dHVyZTJEKHRleHR1cmVfZW52QXRsYXMsIG1hcFJvdWdobmVzc1V2KHV2LCBpbGV2ZWwpKSk7XG4gICAgdmVjMyByb3VnaEIgPSAkREVDT0RFKHRleHR1cmUyRCh0ZXh0dXJlX2VudkF0bGFzLCBtYXBSb3VnaG5lc3NVdih1diwgaWxldmVsICsgMS4wKSkpO1xuXG4gICAgcmV0dXJuIHByb2Nlc3NFbnZpcm9ubWVudChtaXgoc2hhcnAsIG1peChyb3VnaEEsIHJvdWdoQiwgZmxldmVsKSwgbWluKGxldmVsLCAxLjApKSk7XG59XG5cbnZvaWQgYWRkUmVmbGVjdGlvbigpIHsgICBcbiAgICBkUmVmbGVjdGlvbiArPSB2ZWM0KGNhbGNSZWZsZWN0aW9uKGRSZWZsRGlyVywgZEdsb3NzaW5lc3MpLCBtYXRlcmlhbF9yZWZsZWN0aXZpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHdCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
