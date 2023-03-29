/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var tangentBinormalVS = /* glsl */`
vec3 getTangent() {
    return normalize(dNormalMatrix * vertex_tangent.xyz);
}

vec3 getBinormal() {
    return cross(vNormalW, vTangentW) * vertex_tangent.w;
}
`;

export { tangentBinormalVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFuZ2VudEJpbm9ybWFsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L3ZlcnQvdGFuZ2VudEJpbm9ybWFsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGdldFRhbmdlbnQoKSB7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZShkTm9ybWFsTWF0cml4ICogdmVydGV4X3RhbmdlbnQueHl6KTtcbn1cblxudmVjMyBnZXRCaW5vcm1hbCgpIHtcbiAgICByZXR1cm4gY3Jvc3Modk5vcm1hbFcsIHZUYW5nZW50VykgKiB2ZXJ0ZXhfdGFuZ2VudC53O1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHdCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
