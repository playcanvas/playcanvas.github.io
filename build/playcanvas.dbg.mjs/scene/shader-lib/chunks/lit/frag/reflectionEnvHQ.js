var reflectionEnvHQPS = /* glsl */`
#ifndef ENV_ATLAS
#define ENV_ATLAS
uniform sampler2D texture_envAtlas;
#endif
uniform samplerCube texture_cubeMap;
uniform float material_reflectivity;

vec3 calcReflection(vec3 reflDir, float gloss) {
    vec3 dir = cubeMapProject(reflDir) * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(dir);

    // calculate roughness level
    float level = saturate(1.0 - gloss) * 5.0;
    float ilevel = floor(level);
    float flevel = level - ilevel;

    vec3 sharp = $DECODE_CUBEMAP(textureCube(texture_cubeMap, fixSeams(dir)));
    vec3 roughA = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel)));
    vec3 roughB = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, ilevel + 1.0)));

    return processEnvironment(mix(sharp, mix(roughA, roughB, flevel), min(level, 1.0)));
}

void addReflection(vec3 reflDir, float gloss) {   
    dReflection += vec4(calcReflection(reflDir, gloss), material_reflectivity);
}
`;

export { reflectionEnvHQPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmbGVjdGlvbkVudkhRLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvcmVmbGVjdGlvbkVudkhRLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZuZGVmIEVOVl9BVExBU1xuI2RlZmluZSBFTlZfQVRMQVNcbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZW52QXRsYXM7XG4jZW5kaWZcbnVuaWZvcm0gc2FtcGxlckN1YmUgdGV4dHVyZV9jdWJlTWFwO1xudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9yZWZsZWN0aXZpdHk7XG5cbnZlYzMgY2FsY1JlZmxlY3Rpb24odmVjMyByZWZsRGlyLCBmbG9hdCBnbG9zcykge1xuICAgIHZlYzMgZGlyID0gY3ViZU1hcFByb2plY3QocmVmbERpcikgKiB2ZWMzKC0xLjAsIDEuMCwgMS4wKTtcbiAgICB2ZWMyIHV2ID0gdG9TcGhlcmljYWxVdihkaXIpO1xuXG4gICAgLy8gY2FsY3VsYXRlIHJvdWdobmVzcyBsZXZlbFxuICAgIGZsb2F0IGxldmVsID0gc2F0dXJhdGUoMS4wIC0gZ2xvc3MpICogNS4wO1xuICAgIGZsb2F0IGlsZXZlbCA9IGZsb29yKGxldmVsKTtcbiAgICBmbG9hdCBmbGV2ZWwgPSBsZXZlbCAtIGlsZXZlbDtcblxuICAgIHZlYzMgc2hhcnAgPSAkREVDT0RFX0NVQkVNQVAodGV4dHVyZUN1YmUodGV4dHVyZV9jdWJlTWFwLCBmaXhTZWFtcyhkaXIpKSk7XG4gICAgdmVjMyByb3VnaEEgPSAkREVDT0RFKHRleHR1cmUyRCh0ZXh0dXJlX2VudkF0bGFzLCBtYXBSb3VnaG5lc3NVdih1diwgaWxldmVsKSkpO1xuICAgIHZlYzMgcm91Z2hCID0gJERFQ09ERSh0ZXh0dXJlMkQodGV4dHVyZV9lbnZBdGxhcywgbWFwUm91Z2huZXNzVXYodXYsIGlsZXZlbCArIDEuMCkpKTtcblxuICAgIHJldHVybiBwcm9jZXNzRW52aXJvbm1lbnQobWl4KHNoYXJwLCBtaXgocm91Z2hBLCByb3VnaEIsIGZsZXZlbCksIG1pbihsZXZlbCwgMS4wKSkpO1xufVxuXG52b2lkIGFkZFJlZmxlY3Rpb24odmVjMyByZWZsRGlyLCBmbG9hdCBnbG9zcykgeyAgIFxuICAgIGRSZWZsZWN0aW9uICs9IHZlYzQoY2FsY1JlZmxlY3Rpb24ocmVmbERpciwgZ2xvc3MpLCBtYXRlcmlhbF9yZWZsZWN0aXZpdHkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx3QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
