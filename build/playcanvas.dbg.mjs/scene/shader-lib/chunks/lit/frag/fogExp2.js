var fogExp2PS = /* glsl */`
uniform vec3 fog_color;
uniform float fog_density;
float dBlendModeFogFactor = 1.0;

vec3 addFog(vec3 color) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = exp(-depth * depth * fog_density * fog_density);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(fog_color * dBlendModeFogFactor, color, fogFactor);
}
`;

export { fogExp2PS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9nRXhwMi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2ZvZ0V4cDIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gdmVjMyBmb2dfY29sb3I7XG51bmlmb3JtIGZsb2F0IGZvZ19kZW5zaXR5O1xuZmxvYXQgZEJsZW5kTW9kZUZvZ0ZhY3RvciA9IDEuMDtcblxudmVjMyBhZGRGb2codmVjMyBjb2xvcikge1xuICAgIGZsb2F0IGRlcHRoID0gZ2xfRnJhZ0Nvb3JkLnogLyBnbF9GcmFnQ29vcmQudztcbiAgICBmbG9hdCBmb2dGYWN0b3IgPSBleHAoLWRlcHRoICogZGVwdGggKiBmb2dfZGVuc2l0eSAqIGZvZ19kZW5zaXR5KTtcbiAgICBmb2dGYWN0b3IgPSBjbGFtcChmb2dGYWN0b3IsIDAuMCwgMS4wKTtcbiAgICByZXR1cm4gbWl4KGZvZ19jb2xvciAqIGRCbGVuZE1vZGVGb2dGYWN0b3IsIGNvbG9yLCBmb2dGYWN0b3IpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxnQkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
