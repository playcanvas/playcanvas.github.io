/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var skyboxHDRPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2t5Ym94SERSLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3NreWJveC9mcmFnL3NreWJveEhEUi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmFyeWluZyB2ZWMzIHZWaWV3RGlyO1xuXG51bmlmb3JtIHNhbXBsZXJDdWJlIHRleHR1cmVfY3ViZU1hcDtcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICB2ZWMzIGRpcj12Vmlld0RpcjtcbiAgICBkaXIueCAqPSAtMS4wO1xuXG4gICAgdmVjMyBsaW5lYXIgPSAkREVDT0RFKHRleHR1cmVDdWJlKHRleHR1cmVfY3ViZU1hcCwgZml4U2VhbXNTdGF0aWMoZGlyLCAkRklYQ09OU1QpKSk7XG5cbiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KGdhbW1hQ29ycmVjdE91dHB1dCh0b25lTWFwKHByb2Nlc3NFbnZpcm9ubWVudChsaW5lYXIpKSksIDEuMCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsa0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FiQTs7OzsifQ==
