/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var skyboxEnvPS = /* glsl */`
varying vec3 vViewDir;

uniform sampler2D texture_envAtlas;
uniform float mipLevel;

void main(void) {
    vec3 dir = vViewDir * vec3(-1.0, 1.0, 1.0);
    vec2 uv = toSphericalUv(normalize(dir));

    vec3 linear = $DECODE(texture2D(texture_envAtlas, mapRoughnessUv(uv, mipLevel)));

    gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
}
`;

export { skyboxEnvPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2t5Ym94RW52LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc2t5Ym94L2ZyYWcvc2t5Ym94RW52LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52YXJ5aW5nIHZlYzMgdlZpZXdEaXI7XG5cbnVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZW52QXRsYXM7XG51bmlmb3JtIGZsb2F0IG1pcExldmVsO1xuXG52b2lkIG1haW4odm9pZCkge1xuICAgIHZlYzMgZGlyID0gdlZpZXdEaXIgKiB2ZWMzKC0xLjAsIDEuMCwgMS4wKTtcbiAgICB2ZWMyIHV2ID0gdG9TcGhlcmljYWxVdihub3JtYWxpemUoZGlyKSk7XG5cbiAgICB2ZWMzIGxpbmVhciA9ICRERUNPREUodGV4dHVyZTJEKHRleHR1cmVfZW52QXRsYXMsIG1hcFJvdWdobmVzc1V2KHV2LCBtaXBMZXZlbCkpKTtcblxuICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZ2FtbWFDb3JyZWN0T3V0cHV0KHRvbmVNYXAocHJvY2Vzc0Vudmlyb25tZW50KGxpbmVhcikpKSwgMS4wKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
