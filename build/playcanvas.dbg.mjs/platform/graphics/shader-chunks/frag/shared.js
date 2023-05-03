var sharedFS = /* glsl */`

// convert clip space position into texture coordinates to sample scene grab textures
vec2 getGrabScreenPos(vec4 clipPos) {
    vec2 uv = (clipPos.xy / clipPos.w) * 0.5 + 0.5;

    #ifdef WEBGPU
        uv.y = 1.0 - uv.y;
    #endif

    return uv;
}

// convert uv coordinates to sample image effect texture (render target texture rendered without
// forward renderer which does the flip in the projection matrix)
vec2 getImageEffectUV(vec2 uv) {
    #ifdef WEBGPU
        uv.y = 1.0 - uv.y;
    #endif

    return uv;
}
`;

export { sharedFS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLWNodW5rcy9mcmFnL3NoYXJlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG4vLyBjb252ZXJ0IGNsaXAgc3BhY2UgcG9zaXRpb24gaW50byB0ZXh0dXJlIGNvb3JkaW5hdGVzIHRvIHNhbXBsZSBzY2VuZSBncmFiIHRleHR1cmVzXG52ZWMyIGdldEdyYWJTY3JlZW5Qb3ModmVjNCBjbGlwUG9zKSB7XG4gICAgdmVjMiB1diA9IChjbGlwUG9zLnh5IC8gY2xpcFBvcy53KSAqIDAuNSArIDAuNTtcblxuICAgICNpZmRlZiBXRUJHUFVcbiAgICAgICAgdXYueSA9IDEuMCAtIHV2Lnk7XG4gICAgI2VuZGlmXG5cbiAgICByZXR1cm4gdXY7XG59XG5cbi8vIGNvbnZlcnQgdXYgY29vcmRpbmF0ZXMgdG8gc2FtcGxlIGltYWdlIGVmZmVjdCB0ZXh0dXJlIChyZW5kZXIgdGFyZ2V0IHRleHR1cmUgcmVuZGVyZWQgd2l0aG91dFxuLy8gZm9yd2FyZCByZW5kZXJlciB3aGljaCBkb2VzIHRoZSBmbGlwIGluIHRoZSBwcm9qZWN0aW9uIG1hdHJpeClcbnZlYzIgZ2V0SW1hZ2VFZmZlY3RVVih2ZWMyIHV2KSB7XG4gICAgI2lmZGVmIFdFQkdQVVxuICAgICAgICB1di55ID0gMS4wIC0gdXYueTtcbiAgICAjZW5kaWZcblxuICAgIHJldHVybiB1djtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsZUFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
