/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var skyboxEnvPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2t5Ym94RW52LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3NreWJveC9mcmFnL3NreWJveEVudi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmFyeWluZyB2ZWMzIHZWaWV3RGlyO1xuXG51bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX2VudkF0bGFzO1xudW5pZm9ybSBmbG9hdCBtaXBMZXZlbDtcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICB2ZWMzIGRpciA9IHZWaWV3RGlyICogdmVjMygtMS4wLCAxLjAsIDEuMCk7XG4gICAgdmVjMiB1diA9IHRvU3BoZXJpY2FsVXYobm9ybWFsaXplKGRpcikpO1xuXG4gICAgdmVjMyBsaW5lYXIgPSAkREVDT0RFKHRleHR1cmUyRCh0ZXh0dXJlX2VudkF0bGFzLCBtYXBSb3VnaG5lc3NVdih1diwgbWlwTGV2ZWwpKSk7XG5cbiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGdhbW1hQ29ycmVjdE91dHB1dCh0b25lTWFwKHByb2Nlc3NFbnZpcm9ubWVudChsaW5lYXIpKSksIDEuMCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsa0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQWRBOzs7OyJ9
