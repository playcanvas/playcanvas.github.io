/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var lightDiffuseLambertPS = /* glsl */`
float getLightDiffuse() {
    return max(dot(dNormalW, -dLightDirNormW), 0.0);
}
`;

export { lightDiffuseLambertPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHREaWZmdXNlTGFtYmVydC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2xpZ2h0RGlmZnVzZUxhbWJlcnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmZsb2F0IGdldExpZ2h0RGlmZnVzZSgpIHtcbiAgICByZXR1cm4gbWF4KGRvdChkTm9ybWFsVywgLWRMaWdodERpck5vcm1XKSwgMC4wKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw0QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
