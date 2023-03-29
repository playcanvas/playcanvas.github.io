/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_softPS = /* glsl */`
    float depth = getLinearScreenDepth();
    float particleDepth = vDepth;
    float depthDiff = saturate(abs(particleDepth - depth) * softening);
    a *= depthDiff;
`;

export { particle_softPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfc29mdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL2ZyYWcvcGFydGljbGVfc29mdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIGZsb2F0IGRlcHRoID0gZ2V0TGluZWFyU2NyZWVuRGVwdGgoKTtcbiAgICBmbG9hdCBwYXJ0aWNsZURlcHRoID0gdkRlcHRoO1xuICAgIGZsb2F0IGRlcHRoRGlmZiA9IHNhdHVyYXRlKGFicyhwYXJ0aWNsZURlcHRoIC0gZGVwdGgpICogc29mdGVuaW5nKTtcbiAgICBhICo9IGRlcHRoRGlmZjtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
