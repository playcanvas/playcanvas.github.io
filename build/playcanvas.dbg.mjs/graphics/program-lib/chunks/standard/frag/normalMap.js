/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalMapPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsTWFwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvbm9ybWFsTWFwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTUFQVEVYVFVSRVxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9idW1waW5lc3M7XG4jZW5kaWZcblxudm9pZCBnZXROb3JtYWwoKSB7XG4jaWZkZWYgTUFQVEVYVFVSRVxuICAgIHZlYzMgbm9ybWFsTWFwID0gdW5wYWNrTm9ybWFsKHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpKTtcbiAgICBub3JtYWxNYXAgPSBtaXgodmVjMygwLjAsIDAuMCwgMS4wKSwgbm9ybWFsTWFwLCBtYXRlcmlhbF9idW1waW5lc3MpO1xuICAgIGROb3JtYWxXID0gbm9ybWFsaXplKGRUQk4gKiBhZGROb3JtYWxEZXRhaWwobm9ybWFsTWFwKSk7XG4jZWxzZVxuICAgIGROb3JtYWxXID0gZFZlcnRleE5vcm1hbFc7XG4jZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxrQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBZEE7Ozs7In0=
