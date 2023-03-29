/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var skyboxHDRPS = /* glsl */`
varying vec3 vViewDir;

uniform samplerCube texture_cubeMap;

void main(void) {
    vec3 dir=vViewDir;
    dir.x *= -1.0;

    vec3 linear = $DECODE(textureCube(texture_cubeMap, fixSeamsStatic(dir, $FIXCONST)));

    gl_FragColor = vec4(gammaCorrectOutput(toneMap(processEnvironment(linear))), 1.0);
}
`;

export { skyboxHDRPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2t5Ym94SERSLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc2t5Ym94L2ZyYWcvc2t5Ym94SERSLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52YXJ5aW5nIHZlYzMgdlZpZXdEaXI7XG5cbnVuaWZvcm0gc2FtcGxlckN1YmUgdGV4dHVyZV9jdWJlTWFwO1xuXG52b2lkIG1haW4odm9pZCkge1xuICAgIHZlYzMgZGlyPXZWaWV3RGlyO1xuICAgIGRpci54ICo9IC0xLjA7XG5cbiAgICB2ZWMzIGxpbmVhciA9ICRERUNPREUodGV4dHVyZUN1YmUodGV4dHVyZV9jdWJlTWFwLCBmaXhTZWFtc1N0YXRpYyhkaXIsICRGSVhDT05TVCkpKTtcblxuICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoZ2FtbWFDb3JyZWN0T3V0cHV0KHRvbmVNYXAocHJvY2Vzc0Vudmlyb25tZW50KGxpbmVhcikpKSwgMS4wKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
