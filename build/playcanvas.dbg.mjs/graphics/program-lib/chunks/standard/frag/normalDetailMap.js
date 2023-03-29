/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalDetailMapPS = `
#ifdef MAPTEXTURE
uniform float material_normalDetailMapBumpiness;

vec3 blendNormals(vec3 n1, vec3 n2) {
    // https://blog.selfshadow.com/publications/blending-in-detail/#detail-oriented
    n1 += vec3(0, 0, 1);
    n2 *= vec3(-1, -1, 1);
    return n1 * dot(n1, n2) / n1.z - n2;
}
#endif

vec3 addNormalDetail(vec3 normalMap) {
#ifdef MAPTEXTURE
    vec3 normalDetailMap = unpackNormal(texture2DBias($SAMPLER, $UV, textureBias));
    normalDetailMap = mix(vec3(0.0, 0.0, 1.0), normalDetailMap, material_normalDetailMapBumpiness);
    return blendNormals(normalMap, normalDetailMap);
#else
    return normalMap;
#endif
}
`;

export { normalDetailMapPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsRGV0YWlsTWFwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvbm9ybWFsRGV0YWlsTWFwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTUFQVEVYVFVSRVxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9ub3JtYWxEZXRhaWxNYXBCdW1waW5lc3M7XG5cbnZlYzMgYmxlbmROb3JtYWxzKHZlYzMgbjEsIHZlYzMgbjIpIHtcbiAgICAvLyBodHRwczovL2Jsb2cuc2VsZnNoYWRvdy5jb20vcHVibGljYXRpb25zL2JsZW5kaW5nLWluLWRldGFpbC8jZGV0YWlsLW9yaWVudGVkXG4gICAgbjEgKz0gdmVjMygwLCAwLCAxKTtcbiAgICBuMiAqPSB2ZWMzKC0xLCAtMSwgMSk7XG4gICAgcmV0dXJuIG4xICogZG90KG4xLCBuMikgLyBuMS56IC0gbjI7XG59XG4jZW5kaWZcblxudmVjMyBhZGROb3JtYWxEZXRhaWwodmVjMyBub3JtYWxNYXApIHtcbiNpZmRlZiBNQVBURVhUVVJFXG4gICAgdmVjMyBub3JtYWxEZXRhaWxNYXAgPSB1bnBhY2tOb3JtYWwodGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykpO1xuICAgIG5vcm1hbERldGFpbE1hcCA9IG1peCh2ZWMzKDAuMCwgMC4wLCAxLjApLCBub3JtYWxEZXRhaWxNYXAsIG1hdGVyaWFsX25vcm1hbERldGFpbE1hcEJ1bXBpbmVzcyk7XG4gICAgcmV0dXJuIGJsZW5kTm9ybWFscyhub3JtYWxNYXAsIG5vcm1hbERldGFpbE1hcCk7XG4jZWxzZVxuICAgIHJldHVybiBub3JtYWxNYXA7XG4jZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx3QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FyQkE7Ozs7In0=
