var clearCoatGlossPS = /* glsl */`
#ifdef MAPFLOAT
uniform float material_clearCoatGloss;
#endif

void getClearCoatGlossiness() {
    ccGlossiness = 1.0;

    #ifdef MAPFLOAT
    ccGlossiness *= material_clearCoatGloss;
    #endif

    #ifdef MAPTEXTURE
    ccGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    ccGlossiness *= saturate(vVertexColor.$VC);
    #endif

    #ifdef MAPINVERT
    ccGlossiness = 1.0 - ccGlossiness;
    #endif

    ccGlossiness += 0.0000001;
}
`;

export { clearCoatGlossPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xlYXJDb2F0R2xvc3MuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2NsZWFyQ29hdEdsb3NzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTUFQRkxPQVRcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfY2xlYXJDb2F0R2xvc3M7XG4jZW5kaWZcblxudm9pZCBnZXRDbGVhckNvYXRHbG9zc2luZXNzKCkge1xuICAgIGNjR2xvc3NpbmVzcyA9IDEuMDtcblxuICAgICNpZmRlZiBNQVBGTE9BVFxuICAgIGNjR2xvc3NpbmVzcyAqPSBtYXRlcmlhbF9jbGVhckNvYXRHbG9zcztcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgY2NHbG9zc2luZXNzICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICBjY0dsb3NzaW5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQSU5WRVJUXG4gICAgY2NHbG9zc2luZXNzID0gMS4wIC0gY2NHbG9zc2luZXNzO1xuICAgICNlbmRpZlxuXG4gICAgY2NHbG9zc2luZXNzICs9IDAuMDAwMDAwMTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsdUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
