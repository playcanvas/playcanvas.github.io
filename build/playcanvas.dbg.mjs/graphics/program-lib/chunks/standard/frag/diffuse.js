/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var diffusePS = `
#ifdef MAPCOLOR
uniform vec3 material_diffuse;
#endif

void getAlbedo() {
    dAlbedo = vec3(1.0);

#ifdef MAPCOLOR
    dAlbedo *= material_diffuse.rgb;
#endif

#ifdef MAPTEXTURE
    vec3 albedoBase = $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    dAlbedo *= addAlbedoDetail(albedoBase);
#endif

#ifdef MAPVERTEX
    dAlbedo *= gammaCorrectInput(saturate(vVertexColor.$VC));
#endif
}
`;

export { diffusePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlmZnVzZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2RpZmZ1c2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBDT0xPUlxudW5pZm9ybSB2ZWMzIG1hdGVyaWFsX2RpZmZ1c2U7XG4jZW5kaWZcblxudm9pZCBnZXRBbGJlZG8oKSB7XG4gICAgZEFsYmVkbyA9IHZlYzMoMS4wKTtcblxuI2lmZGVmIE1BUENPTE9SXG4gICAgZEFsYmVkbyAqPSBtYXRlcmlhbF9kaWZmdXNlLnJnYjtcbiNlbmRpZlxuXG4jaWZkZWYgTUFQVEVYVFVSRVxuICAgIHZlYzMgYWxiZWRvQmFzZSA9ICRERUNPREUodGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykpLiRDSDtcbiAgICBkQWxiZWRvICo9IGFkZEFsYmVkb0RldGFpbChhbGJlZG9CYXNlKTtcbiNlbmRpZlxuXG4jaWZkZWYgTUFQVkVSVEVYXG4gICAgZEFsYmVkbyAqPSBnYW1tYUNvcnJlY3RJbnB1dChzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKSk7XG4jZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FyQkE7Ozs7In0=
