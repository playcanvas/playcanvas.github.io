/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalMapPS = /* glsl */`
#ifdef MAPTEXTURE
uniform float material_bumpiness;
#endif

void getNormal() {
#ifdef MAPTEXTURE
    vec3 normalMap = unpackNormal(texture2DBias($SAMPLER, $UV, textureBias));
    normalMap = mix(vec3(0.0, 0.0, 1.0), normalMap, material_bumpiness);
    dNormalW = normalize(dTBN * addNormalDetail(normalMap));
#else
    dNormalW = dVertexNormalW;
#endif
}
`;

export { normalMapPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsTWFwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9ub3JtYWxNYXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBURVhUVVJFXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2J1bXBpbmVzcztcbiNlbmRpZlxuXG52b2lkIGdldE5vcm1hbCgpIHtcbiNpZmRlZiBNQVBURVhUVVJFXG4gICAgdmVjMyBub3JtYWxNYXAgPSB1bnBhY2tOb3JtYWwodGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykpO1xuICAgIG5vcm1hbE1hcCA9IG1peCh2ZWMzKDAuMCwgMC4wLCAxLjApLCBub3JtYWxNYXAsIG1hdGVyaWFsX2J1bXBpbmVzcyk7XG4gICAgZE5vcm1hbFcgPSBub3JtYWxpemUoZFRCTiAqIGFkZE5vcm1hbERldGFpbChub3JtYWxNYXApKTtcbiNlbHNlXG4gICAgZE5vcm1hbFcgPSBkVmVydGV4Tm9ybWFsVztcbiNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
