/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tangentBinormalVS = `
vec3 getTangent() {
    return normalize(dNormalMatrix * vertex_tangent.xyz);
}

vec3 getBinormal() {
    return cross(vNormalW, vTangentW) * vertex_tangent.w;
}

vec3 getObjectSpaceUp() {
    return normalize(dNormalMatrix * vec3(0, 1, 0));
}
`;

export { tangentBinormalVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFuZ2VudEJpbm9ybWFsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC92ZXJ0L3RhbmdlbnRCaW5vcm1hbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyBnZXRUYW5nZW50KCkge1xuICAgIHJldHVybiBub3JtYWxpemUoZE5vcm1hbE1hdHJpeCAqIHZlcnRleF90YW5nZW50Lnh5eik7XG59XG5cbnZlYzMgZ2V0Qmlub3JtYWwoKSB7XG4gICAgcmV0dXJuIGNyb3NzKHZOb3JtYWxXLCB2VGFuZ2VudFcpICogdmVydGV4X3RhbmdlbnQudztcbn1cblxudmVjMyBnZXRPYmplY3RTcGFjZVVwKCkge1xuICAgIHJldHVybiBub3JtYWxpemUoZE5vcm1hbE1hdHJpeCAqIHZlYzMoMCwgMSwgMCkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHdCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVpBOzs7OyJ9
