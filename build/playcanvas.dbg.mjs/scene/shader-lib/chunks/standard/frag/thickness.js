var thicknessPS = /* glsl */`
#ifdef MAPFLOAT
uniform float material_thickness;
#endif

void getThickness() {
    dThickness = 1.0;

    #ifdef MAPFLOAT
    dThickness *= material_thickness;
    #endif

    #ifdef MAPTEXTURE
    dThickness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
    #endif

    #ifdef MAPVERTEX
    dThickness *= saturate(vVertexColor.$VC);
    #endif
}
`;

export { thicknessPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhpY2tuZXNzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy90aGlja25lc3MuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZmRlZiBNQVBGTE9BVFxudW5pZm9ybSBmbG9hdCBtYXRlcmlhbF90aGlja25lc3M7XG4jZW5kaWZcblxudm9pZCBnZXRUaGlja25lc3MoKSB7XG4gICAgZFRoaWNrbmVzcyA9IDEuMDtcblxuICAgICNpZmRlZiBNQVBGTE9BVFxuICAgIGRUaGlja25lc3MgKj0gbWF0ZXJpYWxfdGhpY2tuZXNzO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICBkVGhpY2tuZXNzICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICBkVGhpY2tuZXNzICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICNlbmRpZlxufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxrQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
