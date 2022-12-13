/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var sharedFS = `

// convert clip space position into texture coordinates to sample scene grab textures
vec2 getGrabScreenPos(vec4 clipPos) {
    vec2 uv = (clipPos.xy / clipPos.w) * 0.5 + 0.5;

    #ifdef WEBGPU
        uv.y = 1.0 - uv.y;
    #endif

    return uv;
}
`;

export { sharedFS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLWNodW5rcy9mcmFnL3NoYXJlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG4vLyBjb252ZXJ0IGNsaXAgc3BhY2UgcG9zaXRpb24gaW50byB0ZXh0dXJlIGNvb3JkaW5hdGVzIHRvIHNhbXBsZSBzY2VuZSBncmFiIHRleHR1cmVzXG52ZWMyIGdldEdyYWJTY3JlZW5Qb3ModmVjNCBjbGlwUG9zKSB7XG4gICAgdmVjMiB1diA9IChjbGlwUG9zLnh5IC8gY2xpcFBvcy53KSAqIDAuNSArIDAuNTtcblxuICAgICNpZmRlZiBXRUJHUFVcbiAgICAgICAgdXYueSA9IDEuMCAtIHV2Lnk7XG4gICAgI2VuZGlmXG5cbiAgICByZXR1cm4gdXY7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsZUFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
