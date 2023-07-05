var clearCoatPS = /* glsl */`
#ifdef MAPFLOAT
uniform float material_clearCoat;
#endif

void getClearCoat() {
    ccSpecularity = 1.0;

    #ifdef MAPFLOAT
    ccSpecularity *= material_clearCoat;
    #endif

    #ifdef MAPTEXTURE
    ccSpecularity *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    ccSpecularity *= saturate(vVertexColor.$VC);
    #endif
}
`;

export { clearCoatPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xlYXJDb2F0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9jbGVhckNvYXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBGTE9BVFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9jbGVhckNvYXQ7XG4jZW5kaWZcblxudm9pZCBnZXRDbGVhckNvYXQoKSB7XG4gICAgY2NTcGVjdWxhcml0eSA9IDEuMDtcblxuICAgICNpZmRlZiBNQVBGTE9BVFxuICAgIGNjU3BlY3VsYXJpdHkgKj0gbWF0ZXJpYWxfY2xlYXJDb2F0O1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICBjY1NwZWN1bGFyaXR5ICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICBjY1NwZWN1bGFyaXR5ICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
