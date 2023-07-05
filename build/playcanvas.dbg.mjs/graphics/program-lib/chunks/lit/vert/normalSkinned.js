/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var normalSkinnedVS = `
vec3 getNormal() {
    dNormalMatrix = mat3(dModelMatrix[0].xyz, dModelMatrix[1].xyz, dModelMatrix[2].xyz);
    return normalize(dNormalMatrix * vertex_normal);
}
`;

export { normalSkinnedVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsU2tpbm5lZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvdmVydC9ub3JtYWxTa2lubmVkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGdldE5vcm1hbCgpIHtcbiAgICBkTm9ybWFsTWF0cml4ID0gbWF0MyhkTW9kZWxNYXRyaXhbMF0ueHl6LCBkTW9kZWxNYXRyaXhbMV0ueHl6LCBkTW9kZWxNYXRyaXhbMl0ueHl6KTtcbiAgICByZXR1cm4gbm9ybWFsaXplKGROb3JtYWxNYXRyaXggKiB2ZXJ0ZXhfbm9ybWFsKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxzQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBTEE7Ozs7In0=
