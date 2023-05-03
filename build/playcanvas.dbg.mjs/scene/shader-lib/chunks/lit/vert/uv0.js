var uv0VS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXYwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L3ZlcnQvdXYwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jaWZkZWYgTklORVNMSUNFRFxudmVjMiBnZXRVdjAoKSB7XG4gICAgdmVjMiB1diA9IHZlcnRleF9wb3NpdGlvbi54ejtcblxuICAgIC8vIG9mZnNldCBpbm5lciB2ZXJ0aWNlcyBpbnNpZGVcbiAgICAvLyAob3JpZ2luYWwgdmVydGljZXMgbXVzdCBiZSBpbiBbLTE7MV0gcmFuZ2UpXG4gICAgdmVjMiBwb3NpdGl2ZVVuaXRPZmZzZXQgPSBjbGFtcCh2ZXJ0ZXhfcG9zaXRpb24ueHosIHZlYzIoMC4wKSwgdmVjMigxLjApKTtcbiAgICB2ZWMyIG5lZ2F0aXZlVW5pdE9mZnNldCA9IGNsYW1wKC12ZXJ0ZXhfcG9zaXRpb24ueHosIHZlYzIoMC4wKSwgdmVjMigxLjApKTtcbiAgICB1diArPSAoLXBvc2l0aXZlVW5pdE9mZnNldCAqIGlubmVyT2Zmc2V0Lnh5ICsgbmVnYXRpdmVVbml0T2Zmc2V0ICogaW5uZXJPZmZzZXQuencpICogdmVydGV4X3RleENvb3JkMC54eTtcblxuICAgIHV2ID0gdXYgKiAtMC41ICsgMC41O1xuICAgIHV2ID0gdXYgKiBhdGxhc1JlY3QuencgKyBhdGxhc1JlY3QueHk7XG5cbiAgICB2TWFzayA9IHZlcnRleF90ZXhDb29yZDAueHk7XG5cbiAgICByZXR1cm4gdXY7XG59XG4jZWxzZVxudmVjMiBnZXRVdjAoKSB7XG4gICAgcmV0dXJuIHZlcnRleF90ZXhDb29yZDA7XG59XG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsWUFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
