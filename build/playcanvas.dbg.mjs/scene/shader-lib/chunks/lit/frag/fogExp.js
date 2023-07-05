var fogExpPS = /* glsl */`
uniform vec3 fog_color;
uniform float fog_density;
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = exp(-depth * fog_density);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
`;

export { fogExpPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9nRXhwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvZm9nRXhwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHZlYzMgZm9nX2NvbG9yO1xudW5pZm9ybSBmbG9hdCBmb2dfZGVuc2l0eTtcbmZsb2F0IGRCbGVuZE1vZGVGb2dGYWN0b3IgPSAxLjA7XG5cbnZlYzMgYWRkRm9nKHZlYzMgY29sb3IpIHtcbiAgICBmbG9hdCBkZXB0aCA9IGdsX0ZyYWdDb29yZC56IC8gZ2xfRnJhZ0Nvb3JkLnc7XG4gICAgZmxvYXQgZm9nRmFjdG9yID0gZXhwKC1kZXB0aCAqIGZvZ19kZW5zaXR5KTtcbiAgICBmb2dGYWN0b3IgPSBjbGFtcChmb2dGYWN0b3IsIDAuMCwgMS4wKTtcbiAgICByZXR1cm4gbWl4KGZvZ19jb2xvciAqIGRCbGVuZE1vZGVGb2dGYWN0b3IsIGNvbG9yLCBmb2dGYWN0b3IpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxlQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
