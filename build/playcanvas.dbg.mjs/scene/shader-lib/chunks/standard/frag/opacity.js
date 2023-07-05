var opacityPS = /* glsl */`
#ifdef MAPFLOAT
uniform float material_opacity;
#endif

void getOpacity() {
    dAlpha = 1.0;

    #ifdef MAPFLOAT
    dAlpha *= material_opacity;
    #endif

    #ifdef MAPTEXTURE
    dAlpha *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dAlpha *= clamp(vVertexColor.$VC, 0.0, 1.0);
    #endif
}
`;

export { opacityPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3BhY2l0eS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3N0YW5kYXJkL2ZyYWcvb3BhY2l0eS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIE1BUEZMT0FUXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX29wYWNpdHk7XG4jZW5kaWZcblxudm9pZCBnZXRPcGFjaXR5KCkge1xuICAgIGRBbHBoYSA9IDEuMDtcblxuICAgICNpZmRlZiBNQVBGTE9BVFxuICAgIGRBbHBoYSAqPSBtYXRlcmlhbF9vcGFjaXR5O1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICBkQWxwaGEgKj0gdGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgIGRBbHBoYSAqPSBjbGFtcCh2VmVydGV4Q29sb3IuJFZDLCAwLjAsIDEuMCk7XG4gICAgI2VuZGlmXG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGdCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
