/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendMultiplyPS = `
    rgb = mix(vec3(1.0), rgb, vec3(a));
    if (rgb.r + rgb.g + rgb.b > 2.99) discard;
`;

export { particle_blendMultiplyPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfYmxlbmRNdWx0aXBseS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlX2JsZW5kTXVsdGlwbHkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICByZ2IgPSBtaXgodmVjMygxLjApLCByZ2IsIHZlYzMoYSkpO1xuICAgIGlmIChyZ2IuciArIHJnYi5nICsgcmdiLmIgPiAyLjk5KSBkaXNjYXJkO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLCtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQSxDQUhBOzs7OyJ9
