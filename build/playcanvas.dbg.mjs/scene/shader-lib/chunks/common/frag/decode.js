var decodePS = /* glsl */`
vec3 decodeLinear(vec4 raw) {
    return raw.rgb;
}

float decodeGamma(float raw) {
    return pow(raw, 2.2);
}

vec3 decodeGamma(vec3 raw) {
    return pow(raw, vec3(2.2));
}

vec3 decodeGamma(vec4 raw) {
    return pow(raw.xyz, vec3(2.2));
}

vec3 decodeRGBM(vec4 raw) {
    vec3 color = (8.0 * raw.a) * raw.rgb;
    return color * color;
}

vec3 decodeRGBP(vec4 raw) {
    vec3 color = raw.rgb * (-raw.a * 7.0 + 8.0);
    return color * color;
}

vec3 decodeRGBE(vec4 raw) {
    if (raw.a == 0.0) {
        return vec3(0.0, 0.0, 0.0);
    } else {
        return raw.xyz * pow(2.0, raw.w * 255.0 - 128.0);
    }
}

vec4 passThrough(vec4 raw) {
    return raw;
}
`;

export { decodePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb2RlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvZGVjb2RlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG52ZWMzIGRlY29kZUxpbmVhcih2ZWM0IHJhdykge1xuICAgIHJldHVybiByYXcucmdiO1xufVxuXG5mbG9hdCBkZWNvZGVHYW1tYShmbG9hdCByYXcpIHtcbiAgICByZXR1cm4gcG93KHJhdywgMi4yKTtcbn1cblxudmVjMyBkZWNvZGVHYW1tYSh2ZWMzIHJhdykge1xuICAgIHJldHVybiBwb3cocmF3LCB2ZWMzKDIuMikpO1xufVxuXG52ZWMzIGRlY29kZUdhbW1hKHZlYzQgcmF3KSB7XG4gICAgcmV0dXJuIHBvdyhyYXcueHl6LCB2ZWMzKDIuMikpO1xufVxuXG52ZWMzIGRlY29kZVJHQk0odmVjNCByYXcpIHtcbiAgICB2ZWMzIGNvbG9yID0gKDguMCAqIHJhdy5hKSAqIHJhdy5yZ2I7XG4gICAgcmV0dXJuIGNvbG9yICogY29sb3I7XG59XG5cbnZlYzMgZGVjb2RlUkdCUCh2ZWM0IHJhdykge1xuICAgIHZlYzMgY29sb3IgPSByYXcucmdiICogKC1yYXcuYSAqIDcuMCArIDguMCk7XG4gICAgcmV0dXJuIGNvbG9yICogY29sb3I7XG59XG5cbnZlYzMgZGVjb2RlUkdCRSh2ZWM0IHJhdykge1xuICAgIGlmIChyYXcuYSA9PSAwLjApIHtcbiAgICAgICAgcmV0dXJuIHZlYzMoMC4wLCAwLjAsIDAuMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJhdy54eXogKiBwb3coMi4wLCByYXcudyAqIDI1NS4wIC0gMTI4LjApO1xuICAgIH1cbn1cblxudmVjNCBwYXNzVGhyb3VnaCh2ZWM0IHJhdykge1xuICAgIHJldHVybiByYXc7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGVBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
