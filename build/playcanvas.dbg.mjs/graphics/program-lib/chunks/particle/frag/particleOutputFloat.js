/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleOutputFloatPS = `
void writeOutput() {
    if (gl_FragCoord.y<1.0) {
        gl_FragColor = vec4(outPos, (outAngle + 1000.0) * visMode);
    } else {
        gl_FragColor = vec4(outVel, outLife);
    }
}
`;

export { particleOutputFloatPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVPdXRwdXRGbG9hdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlT3V0cHV0RmxvYXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgd3JpdGVPdXRwdXQoKSB7XG4gICAgaWYgKGdsX0ZyYWdDb29yZC55PDEuMCkge1xuICAgICAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KG91dFBvcywgKG91dEFuZ2xlICsgMTAwMC4wKSAqIHZpc01vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQob3V0VmVsLCBvdXRMaWZlKTtcbiAgICB9XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVJBOzs7OyJ9
