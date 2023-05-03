var packDepthPS = /* glsl */`
// Packing a float in GLSL with multiplication and mod
// http://blog.gradientstudios.com/2012/08/23/shadow-map-improvement
vec4 packFloat(float depth) {
    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);

    // combination of mod and multiplication and division works better
    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);
    res -= res.xxyz * bit_mask;
    return res;
}
`;

export { packDepthPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFja0RlcHRoLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvcGFja0RlcHRoLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBQYWNraW5nIGEgZmxvYXQgaW4gR0xTTCB3aXRoIG11bHRpcGxpY2F0aW9uIGFuZCBtb2Rcbi8vIGh0dHA6Ly9ibG9nLmdyYWRpZW50c3R1ZGlvcy5jb20vMjAxMi8wOC8yMy9zaGFkb3ctbWFwLWltcHJvdmVtZW50XG52ZWM0IHBhY2tGbG9hdChmbG9hdCBkZXB0aCkge1xuICAgIGNvbnN0IHZlYzQgYml0X3NoaWZ0ID0gdmVjNCgyNTYuMCAqIDI1Ni4wICogMjU2LjAsIDI1Ni4wICogMjU2LjAsIDI1Ni4wLCAxLjApO1xuICAgIGNvbnN0IHZlYzQgYml0X21hc2sgID0gdmVjNCgwLjAsIDEuMCAvIDI1Ni4wLCAxLjAgLyAyNTYuMCwgMS4wIC8gMjU2LjApO1xuXG4gICAgLy8gY29tYmluYXRpb24gb2YgbW9kIGFuZCBtdWx0aXBsaWNhdGlvbiBhbmQgZGl2aXNpb24gd29ya3MgYmV0dGVyXG4gICAgdmVjNCByZXMgPSBtb2QoZGVwdGggKiBiaXRfc2hpZnQgKiB2ZWM0KDI1NSksIHZlYzQoMjU2KSApIC8gdmVjNCgyNTUpO1xuICAgIHJlcyAtPSByZXMueHh5eiAqIGJpdF9tYXNrO1xuICAgIHJldHVybiByZXM7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
