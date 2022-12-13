/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterNoRespawnPS = `
    if (outLife >= lifetime) {
        outLife -= max(lifetime, (numParticles - 1.0) * particleRate);
        visMode = -1.0;
    }
`;

export { particleUpdaterNoRespawnPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVVcGRhdGVyTm9SZXNwYXduLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZVVwZGF0ZXJOb1Jlc3Bhd24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBpZiAob3V0TGlmZSA+PSBsaWZldGltZSkge1xuICAgICAgICBvdXRMaWZlIC09IG1heChsaWZldGltZSwgKG51bVBhcnRpY2xlcyAtIDEuMCkgKiBwYXJ0aWNsZVJhdGUpO1xuICAgICAgICB2aXNNb2RlID0gLTEuMDtcbiAgICB9XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsaUNBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
