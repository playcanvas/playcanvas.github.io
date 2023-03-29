/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var basePS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvZnJhZy9iYXNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIHZlYzMgdmlld19wb3NpdGlvbjtcblxudW5pZm9ybSB2ZWMzIGxpZ2h0X2dsb2JhbEFtYmllbnQ7XG5cbmZsb2F0IHNxdWFyZShmbG9hdCB4KSB7XG4gICAgcmV0dXJuIHgqeDtcbn1cblxuZmxvYXQgc2F0dXJhdGUoZmxvYXQgeCkge1xuICAgIHJldHVybiBjbGFtcCh4LCAwLjAsIDEuMCk7XG59XG5cbnZlYzMgc2F0dXJhdGUodmVjMyB4KSB7XG4gICAgcmV0dXJuIGNsYW1wKHgsIHZlYzMoMC4wKSwgdmVjMygxLjApKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxhQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBaEJBOzs7OyJ9
