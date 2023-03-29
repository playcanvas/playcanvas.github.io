/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalSkinnedVS = /* glsl */`
vec3 getNormal() {
    dNormalMatrix = mat3(dModelMatrix[0].xyz, dModelMatrix[1].xyz, dModelMatrix[2].xyz);
    return normalize(dNormalMatrix * vertex_normal);
}
`;

export { normalSkinnedVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsU2tpbm5lZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC92ZXJ0L25vcm1hbFNraW5uZWQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZlYzMgZ2V0Tm9ybWFsKCkge1xuICAgIGROb3JtYWxNYXRyaXggPSBtYXQzKGRNb2RlbE1hdHJpeFswXS54eXosIGRNb2RlbE1hdHJpeFsxXS54eXosIGRNb2RlbE1hdHJpeFsyXS54eXopO1xuICAgIHJldHVybiBub3JtYWxpemUoZE5vcm1hbE1hdHJpeCAqIHZlcnRleF9ub3JtYWwpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
