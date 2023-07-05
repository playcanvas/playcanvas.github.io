var fresnelSchlickPS = /* glsl */`
// Schlick's approximation
vec3 getFresnel(
        float cosTheta, 
        float gloss, 
        vec3 specularity
#if defined(LIT_IRIDESCENCE)
        , vec3 iridescenceFresnel, 
        IridescenceArgs iridescence
#endif
    ) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    float glossSq = gloss * gloss;
    vec3 ret = specularity + (max(vec3(glossSq), specularity) - specularity) * fresnel;
#if defined(LIT_IRIDESCENCE)
    return mix(ret, iridescenceFresnel, iridescence.intensity);
#else
    return ret;
#endif    
}

float getFresnelCC(float cosTheta) {
    float fresnel = pow(1.0 - max(cosTheta, 0.0), 5.0);
    return 0.04 + (1.0 - 0.04) * fresnel;
}
`;

export { fresnelSchlickPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJlc25lbFNjaGxpY2suanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9mcmVzbmVsU2NobGljay5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuLy8gU2NobGljaydzIGFwcHJveGltYXRpb25cbnZlYzMgZ2V0RnJlc25lbChcbiAgICAgICAgZmxvYXQgY29zVGhldGEsIFxuICAgICAgICBmbG9hdCBnbG9zcywgXG4gICAgICAgIHZlYzMgc3BlY3VsYXJpdHlcbiNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICAgICAgLCB2ZWMzIGlyaWRlc2NlbmNlRnJlc25lbCwgXG4gICAgICAgIElyaWRlc2NlbmNlQXJncyBpcmlkZXNjZW5jZVxuI2VuZGlmXG4gICAgKSB7XG4gICAgZmxvYXQgZnJlc25lbCA9IHBvdygxLjAgLSBtYXgoY29zVGhldGEsIDAuMCksIDUuMCk7XG4gICAgZmxvYXQgZ2xvc3NTcSA9IGdsb3NzICogZ2xvc3M7XG4gICAgdmVjMyByZXQgPSBzcGVjdWxhcml0eSArIChtYXgodmVjMyhnbG9zc1NxKSwgc3BlY3VsYXJpdHkpIC0gc3BlY3VsYXJpdHkpICogZnJlc25lbDtcbiNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICByZXR1cm4gbWl4KHJldCwgaXJpZGVzY2VuY2VGcmVzbmVsLCBpcmlkZXNjZW5jZS5pbnRlbnNpdHkpO1xuI2Vsc2VcbiAgICByZXR1cm4gcmV0O1xuI2VuZGlmICAgIFxufVxuXG5mbG9hdCBnZXRGcmVzbmVsQ0MoZmxvYXQgY29zVGhldGEpIHtcbiAgICBmbG9hdCBmcmVzbmVsID0gcG93KDEuMCAtIG1heChjb3NUaGV0YSwgMC4wKSwgNS4wKTtcbiAgICByZXR1cm4gMC4wNCArICgxLjAgLSAwLjA0KSAqIGZyZXNuZWw7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHVCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
