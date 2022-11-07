/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFuZ2VudEJpbm9ybWFsLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L3ZlcnQvdGFuZ2VudEJpbm9ybWFsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGdldFRhbmdlbnQoKSB7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZShkTm9ybWFsTWF0cml4ICogdmVydGV4X3RhbmdlbnQueHl6KTtcbn1cblxudmVjMyBnZXRCaW5vcm1hbCgpIHtcbiAgICByZXR1cm4gY3Jvc3Modk5vcm1hbFcsIHZUYW5nZW50VykgKiB2ZXJ0ZXhfdGFuZ2VudC53O1xufVxuXG52ZWMzIGdldE9iamVjdFNwYWNlVXAoKSB7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZShkTm9ybWFsTWF0cml4ICogdmVjMygwLCAxLCAwKSk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsd0JBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
