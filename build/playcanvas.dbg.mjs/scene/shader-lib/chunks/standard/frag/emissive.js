var emissivePS = /* glsl */`
#ifdef MAPCOLOR
uniform vec3 material_emissive;
#endif

#ifdef MAPFLOAT
uniform float material_emissiveIntensity;
#endif

void getEmission() {
    dEmission = vec3(1.0);

    #ifdef MAPFLOAT
    dEmission *= material_emissiveIntensity;
    #endif

    #ifdef MAPCOLOR
    dEmission *= material_emissive;
    #endif

    #ifdef MAPTEXTURE
    dEmission *= $DECODE(texture2DBias($SAMPLER, $UV, textureBias)).$CH;
    #endif

    #ifdef MAPVERTEX
    dEmission *= gammaCorrectInput(saturate(vVertexColor.$VC));
    #endif
}
`;

export { emissivePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1pc3NpdmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2VtaXNzaXZlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTUFQQ09MT1JcbnVuaWZvcm0gdmVjMyBtYXRlcmlhbF9lbWlzc2l2ZTtcbiNlbmRpZlxuXG4jaWZkZWYgTUFQRkxPQVRcbnVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfZW1pc3NpdmVJbnRlbnNpdHk7XG4jZW5kaWZcblxudm9pZCBnZXRFbWlzc2lvbigpIHtcbiAgICBkRW1pc3Npb24gPSB2ZWMzKDEuMCk7XG5cbiAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICBkRW1pc3Npb24gKj0gbWF0ZXJpYWxfZW1pc3NpdmVJbnRlbnNpdHk7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQQ09MT1JcbiAgICBkRW1pc3Npb24gKj0gbWF0ZXJpYWxfZW1pc3NpdmU7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgIGRFbWlzc2lvbiAqPSAkREVDT0RFKHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpKS4kQ0g7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgZEVtaXNzaW9uICo9IGdhbW1hQ29ycmVjdElucHV0KHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpKTtcbiAgICAjZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsaUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
