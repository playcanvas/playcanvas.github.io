/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fogLinearPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9nTGluZWFyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL2xpdC9mcmFnL2ZvZ0xpbmVhci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSB2ZWMzIGZvZ19jb2xvcjtcbnVuaWZvcm0gZmxvYXQgZm9nX3N0YXJ0O1xudW5pZm9ybSBmbG9hdCBmb2dfZW5kO1xuZmxvYXQgZEJsZW5kTW9kZUZvZ0ZhY3RvciA9IDEuMDtcblxudmVjMyBhZGRGb2codmVjMyBjb2xvcikge1xuICAgIGZsb2F0IGRlcHRoID0gZ2xfRnJhZ0Nvb3JkLnogLyBnbF9GcmFnQ29vcmQudztcbiAgICBmbG9hdCBmb2dGYWN0b3IgPSAoZm9nX2VuZCAtIGRlcHRoKSAvIChmb2dfZW5kIC0gZm9nX3N0YXJ0KTtcbiAgICBmb2dGYWN0b3IgPSBjbGFtcChmb2dGYWN0b3IsIDAuMCwgMS4wKTtcbiAgICByZXR1cm4gbWl4KGZvZ19jb2xvciAqIGRCbGVuZE1vZGVGb2dGYWN0b3IsIGNvbG9yLCBmb2dGYWN0b3IpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLGtCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVpBOzs7OyJ9
