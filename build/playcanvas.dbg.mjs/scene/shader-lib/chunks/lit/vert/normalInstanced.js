/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var normalInstancedVS = /* glsl */`
vec3 getNormal() {
    dNormalMatrix = mat3(instance_line1.xyz, instance_line2.xyz, instance_line3.xyz);
    return normalize(dNormalMatrix * vertex_normal);
}
`;

export { normalInstancedVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9ybWFsSW5zdGFuY2VkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L3ZlcnQvbm9ybWFsSW5zdGFuY2VkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGdldE5vcm1hbCgpIHtcbiAgICBkTm9ybWFsTWF0cml4ID0gbWF0MyhpbnN0YW5jZV9saW5lMS54eXosIGluc3RhbmNlX2xpbmUyLnh5eiwgaW5zdGFuY2VfbGluZTMueHl6KTtcbiAgICByZXR1cm4gbm9ybWFsaXplKGROb3JtYWxNYXRyaXggKiB2ZXJ0ZXhfbm9ybWFsKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx3QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
