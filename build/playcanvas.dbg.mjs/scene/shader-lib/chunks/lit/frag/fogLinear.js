var fogLinearPS = /* glsl */`
uniform vec3 fog_color;
uniform float fog_start;
uniform float fog_end;
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = (fog_end - depth) / (fog_end - fog_start);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
`;

export { fogLinearPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9nTGluZWFyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvZm9nTGluZWFyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHZlYzMgZm9nX2NvbG9yO1xudW5pZm9ybSBmbG9hdCBmb2dfc3RhcnQ7XG51bmlmb3JtIGZsb2F0IGZvZ19lbmQ7XG5mbG9hdCBkQmxlbmRNb2RlRm9nRmFjdG9yID0gMS4wO1xuXG52ZWMzIGFkZEZvZyh2ZWMzIGNvbG9yKSB7XG4gICAgZmxvYXQgZGVwdGggPSBnbF9GcmFnQ29vcmQueiAvIGdsX0ZyYWdDb29yZC53O1xuICAgIGZsb2F0IGZvZ0ZhY3RvciA9IChmb2dfZW5kIC0gZGVwdGgpIC8gKGZvZ19lbmQgLSBmb2dfc3RhcnQpO1xuICAgIGZvZ0ZhY3RvciA9IGNsYW1wKGZvZ0ZhY3RvciwgMC4wLCAxLjApO1xuICAgIHJldHVybiBtaXgoZm9nX2NvbG9yICogZEJsZW5kTW9kZUZvZ0ZhY3RvciwgY29sb3IsIGZvZ0ZhY3Rvcik7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGtCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
