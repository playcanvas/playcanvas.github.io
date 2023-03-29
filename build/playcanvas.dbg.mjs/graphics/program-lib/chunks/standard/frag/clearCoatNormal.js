/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var clearCoatNormalPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xlYXJDb2F0Tm9ybWFsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvY2xlYXJDb2F0Tm9ybWFsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTUFQVEVYVFVSRVxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9jbGVhckNvYXRCdW1waW5lc3M7XG4jZW5kaWZcblxudm9pZCBnZXRDbGVhckNvYXROb3JtYWwoKSB7XG4jaWZkZWYgTUFQVEVYVFVSRVxuICAgIHZlYzMgbm9ybWFsTWFwID0gdW5wYWNrTm9ybWFsKHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpKTtcbiAgICBub3JtYWxNYXAgPSBtaXgodmVjMygwLjAsIDAuMCwgMS4wKSwgbm9ybWFsTWFwLCBtYXRlcmlhbF9jbGVhckNvYXRCdW1waW5lc3MpO1xuICAgIGNjTm9ybWFsVyA9IG5vcm1hbGl6ZShkVEJOICogbm9ybWFsTWFwKTtcbiNlbHNlXG4gICAgY2NOb3JtYWxXID0gZFZlcnRleE5vcm1hbFc7XG4jZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx3QkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBZEE7Ozs7In0=
