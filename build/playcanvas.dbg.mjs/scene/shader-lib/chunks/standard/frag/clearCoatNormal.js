/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var clearCoatNormalPS = /* glsl */`
#ifdef MAPTEXTURE
uniform float material_clearCoatBumpiness;
#endif

void getClearCoatNormal() {
#ifdef MAPTEXTURE
    vec3 normalMap = unpackNormal(texture2DBias($SAMPLER, $UV, textureBias));
    normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_clearCoatBumpiness);
    ccNormalW = normalize(dTBN * normalMap);
#else
    ccNormalW = dVertexNormalW;
#endif
}
`;

export { clearCoatNormalPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xlYXJDb2F0Tm9ybWFsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9jbGVhckNvYXROb3JtYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBURVhUVVJFXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2NsZWFyQ29hdEJ1bXBpbmVzcztcbiNlbmRpZlxuXG52b2lkIGdldENsZWFyQ29hdE5vcm1hbCgpIHtcbiNpZmRlZiBNQVBURVhUVVJFXG4gICAgdmVjMyBub3JtYWxNYXAgPSB1bnBhY2tOb3JtYWwodGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykpO1xuICAgIG5vcm1hbE1hcCA9IG1peCh2ZWMzKDAuMCwgMC4wLCAxLjApLCBub3JtYWxNYXAsIG1hdGVyaWFsX2NsZWFyQ29hdEJ1bXBpbmVzcyk7XG4gICAgY2NOb3JtYWxXID0gbm9ybWFsaXplKGRUQk4gKiBub3JtYWxNYXApO1xuI2Vsc2VcbiAgICBjY05vcm1hbFcgPSBkVmVydGV4Tm9ybWFsVztcbiNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHdCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
