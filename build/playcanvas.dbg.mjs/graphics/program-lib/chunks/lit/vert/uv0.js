/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var uv0VS = `
#ifdef NINESLICED
vec2 getUv0() {
    vec2 uv = vertex_position.xz;

    // offset inner vertices inside
    // (original vertices must be in [-1;1] range)
    vec2 positiveUnitOffset = clamp(vertex_position.xz, vec2(0.0), vec2(1.0));
    vec2 negativeUnitOffset = clamp(-vertex_position.xz, vec2(0.0), vec2(1.0));
    uv += (-positiveUnitOffset * innerOffset.xy + negativeUnitOffset * innerOffset.zw) * vertex_texCoord0.xy;

    uv = uv * -0.5 + 0.5;
    uv = uv * atlasRect.zw + atlasRect.xy;

    vMask = vertex_texCoord0.xy;

    return uv;
}
#else
vec2 getUv0() {
    return vertex_texCoord0;
}
#endif
`;

export { uv0VS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXYwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC92ZXJ0L3V2MC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuI2lmZGVmIE5JTkVTTElDRURcbnZlYzIgZ2V0VXYwKCkge1xuICAgIHZlYzIgdXYgPSB2ZXJ0ZXhfcG9zaXRpb24ueHo7XG5cbiAgICAvLyBvZmZzZXQgaW5uZXIgdmVydGljZXMgaW5zaWRlXG4gICAgLy8gKG9yaWdpbmFsIHZlcnRpY2VzIG11c3QgYmUgaW4gWy0xOzFdIHJhbmdlKVxuICAgIHZlYzIgcG9zaXRpdmVVbml0T2Zmc2V0ID0gY2xhbXAodmVydGV4X3Bvc2l0aW9uLnh6LCB2ZWMyKDAuMCksIHZlYzIoMS4wKSk7XG4gICAgdmVjMiBuZWdhdGl2ZVVuaXRPZmZzZXQgPSBjbGFtcCgtdmVydGV4X3Bvc2l0aW9uLnh6LCB2ZWMyKDAuMCksIHZlYzIoMS4wKSk7XG4gICAgdXYgKz0gKC1wb3NpdGl2ZVVuaXRPZmZzZXQgKiBpbm5lck9mZnNldC54eSArIG5lZ2F0aXZlVW5pdE9mZnNldCAqIGlubmVyT2Zmc2V0Lnp3KSAqIHZlcnRleF90ZXhDb29yZDAueHk7XG5cbiAgICB1diA9IHV2ICogLTAuNSArIDAuNTtcbiAgICB1diA9IHV2ICogYXRsYXNSZWN0Lnp3ICsgYXRsYXNSZWN0Lnh5O1xuXG4gICAgdk1hc2sgPSB2ZXJ0ZXhfdGV4Q29vcmQwLnh5O1xuXG4gICAgcmV0dXJuIHV2O1xufVxuI2Vsc2VcbnZlYzIgZ2V0VXYwKCkge1xuICAgIHJldHVybiB2ZXJ0ZXhfdGV4Q29vcmQwO1xufVxuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsWUFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBdkJBOzs7OyJ9
