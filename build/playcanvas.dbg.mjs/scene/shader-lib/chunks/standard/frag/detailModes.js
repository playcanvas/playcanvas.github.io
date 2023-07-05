var detailModesPS = /* glsl */`
vec3 detailMode_mul(vec3 c1, vec3 c2) {
    return c1 * c2;
}

vec3 detailMode_add(vec3 c1, vec3 c2) {
    return c1 + c2;
}

// https://en.wikipedia.org/wiki/Blend_modes#Screen
vec3 detailMode_screen(vec3 c1, vec3 c2) {
    return 1.0 - (1.0 - c1)*(1.0 - c2);
}

// https://en.wikipedia.org/wiki/Blend_modes#Overlay
vec3 detailMode_overlay(vec3 c1, vec3 c2) {
    return mix(1.0 - 2.0*(1.0 - c1)*(1.0 - c2), 2.0*c1*c2, step(c1, vec3(0.5)));
}

vec3 detailMode_min(vec3 c1, vec3 c2) {
    return min(c1, c2);
}

vec3 detailMode_max(vec3 c1, vec3 c2) {
    return max(c1, c2);
}
`;

export { detailModesPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV0YWlsTW9kZXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9zdGFuZGFyZC9mcmFnL2RldGFpbE1vZGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGRldGFpbE1vZGVfbXVsKHZlYzMgYzEsIHZlYzMgYzIpIHtcbiAgICByZXR1cm4gYzEgKiBjMjtcbn1cblxudmVjMyBkZXRhaWxNb2RlX2FkZCh2ZWMzIGMxLCB2ZWMzIGMyKSB7XG4gICAgcmV0dXJuIGMxICsgYzI7XG59XG5cbi8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0JsZW5kX21vZGVzI1NjcmVlblxudmVjMyBkZXRhaWxNb2RlX3NjcmVlbih2ZWMzIGMxLCB2ZWMzIGMyKSB7XG4gICAgcmV0dXJuIDEuMCAtICgxLjAgLSBjMSkqKDEuMCAtIGMyKTtcbn1cblxuLy8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmxlbmRfbW9kZXMjT3ZlcmxheVxudmVjMyBkZXRhaWxNb2RlX292ZXJsYXkodmVjMyBjMSwgdmVjMyBjMikge1xuICAgIHJldHVybiBtaXgoMS4wIC0gMi4wKigxLjAgLSBjMSkqKDEuMCAtIGMyKSwgMi4wKmMxKmMyLCBzdGVwKGMxLCB2ZWMzKDAuNSkpKTtcbn1cblxudmVjMyBkZXRhaWxNb2RlX21pbih2ZWMzIGMxLCB2ZWMzIGMyKSB7XG4gICAgcmV0dXJuIG1pbihjMSwgYzIpO1xufVxuXG52ZWMzIGRldGFpbE1vZGVfbWF4KHZlYzMgYzEsIHZlYzMgYzIpIHtcbiAgICByZXR1cm4gbWF4KGMxLCBjMik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLG9CQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
