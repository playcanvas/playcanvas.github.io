var basePS = /* glsl */`
uniform vec3 view_position;

uniform vec3 light_globalAmbient;

float square(float x) {
    return x*x;
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec3 saturate(vec3 x) {
    return clamp(x, vec3(0.0), vec3(1.0));
}
`;

export { basePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC9mcmFnL2Jhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gdmVjMyB2aWV3X3Bvc2l0aW9uO1xuXG51bmlmb3JtIHZlYzMgbGlnaHRfZ2xvYmFsQW1iaWVudDtcblxuZmxvYXQgc3F1YXJlKGZsb2F0IHgpIHtcbiAgICByZXR1cm4geCp4O1xufVxuXG5mbG9hdCBzYXR1cmF0ZShmbG9hdCB4KSB7XG4gICAgcmV0dXJuIGNsYW1wKHgsIDAuMCwgMS4wKTtcbn1cblxudmVjMyBzYXR1cmF0ZSh2ZWMzIHgpIHtcbiAgICByZXR1cm4gY2xhbXAoeCwgdmVjMygwLjApLCB2ZWMzKDEuMCkpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxhQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
