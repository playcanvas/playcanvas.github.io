/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterRespawnPS = `
    if (outLife >= lifetime) {
        outLife -= max(lifetime, (numParticles - 1.0) * particleRate);
        visMode = 1.0;
    }
    visMode = outLife < 0.0? 1.0: visMode;
`;

export { particleUpdaterRespawnPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyUmVzcGF3bi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlVXBkYXRlclJlc3Bhd24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBpZiAob3V0TGlmZSA+PSBsaWZldGltZSkge1xuICAgICAgICBvdXRMaWZlIC09IG1heChsaWZldGltZSwgKG51bVBhcnRpY2xlcyAtIDEuMCkgKiBwYXJ0aWNsZVJhdGUpO1xuICAgICAgICB2aXNNb2RlID0gMS4wO1xuICAgIH1cbiAgICB2aXNNb2RlID0gb3V0TGlmZSA8IDAuMD8gMS4wOiB2aXNNb2RlO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLCtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQU5BOzs7OyJ9
