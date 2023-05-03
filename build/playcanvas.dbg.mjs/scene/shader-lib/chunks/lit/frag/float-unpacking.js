var floatUnpackingPS = /* glsl */`
// float unpacking functionality, complimentary to float-packing.js
float bytes2float2(vec2 data) {
    return dot(data, vec2(1.0, 1.0 / 255.0));
}

float bytes2float3(vec3 data) {
    return dot(data, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
}

float bytes2float4(vec4 data) {
    return dot(data, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
}

float bytes2floatRange2(vec2 data, float min, float max) {
    return mix(min, max, bytes2float2(data));
}

float bytes2floatRange3(vec3 data, float min, float max) {
    return mix(min, max, bytes2float3(data));
}

float bytes2floatRange4(vec4 data, float min, float max) {
    return mix(min, max, bytes2float4(data));
}

float mantissaExponent2Float(vec4 pack)
{
    float value = bytes2floatRange3(pack.xyz, -1.0, 1.0);
    float exponent = floor(pack.w * 255.0 - 127.0);
    return value * exp2(exponent);
}
`;

export { floatUnpackingPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXQtdW5wYWNraW5nLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvZmxvYXQtdW5wYWNraW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBmbG9hdCB1bnBhY2tpbmcgZnVuY3Rpb25hbGl0eSwgY29tcGxpbWVudGFyeSB0byBmbG9hdC1wYWNraW5nLmpzXG5mbG9hdCBieXRlczJmbG9hdDIodmVjMiBkYXRhKSB7XG4gICAgcmV0dXJuIGRvdChkYXRhLCB2ZWMyKDEuMCwgMS4wIC8gMjU1LjApKTtcbn1cblxuZmxvYXQgYnl0ZXMyZmxvYXQzKHZlYzMgZGF0YSkge1xuICAgIHJldHVybiBkb3QoZGF0YSwgdmVjMygxLjAsIDEuMCAvIDI1NS4wLCAxLjAgLyA2NTAyNS4wKSk7XG59XG5cbmZsb2F0IGJ5dGVzMmZsb2F0NCh2ZWM0IGRhdGEpIHtcbiAgICByZXR1cm4gZG90KGRhdGEsIHZlYzQoMS4wLCAxLjAgLyAyNTUuMCwgMS4wIC8gNjUwMjUuMCwgMS4wIC8gMTY1ODEzNzUuMCkpO1xufVxuXG5mbG9hdCBieXRlczJmbG9hdFJhbmdlMih2ZWMyIGRhdGEsIGZsb2F0IG1pbiwgZmxvYXQgbWF4KSB7XG4gICAgcmV0dXJuIG1peChtaW4sIG1heCwgYnl0ZXMyZmxvYXQyKGRhdGEpKTtcbn1cblxuZmxvYXQgYnl0ZXMyZmxvYXRSYW5nZTModmVjMyBkYXRhLCBmbG9hdCBtaW4sIGZsb2F0IG1heCkge1xuICAgIHJldHVybiBtaXgobWluLCBtYXgsIGJ5dGVzMmZsb2F0MyhkYXRhKSk7XG59XG5cbmZsb2F0IGJ5dGVzMmZsb2F0UmFuZ2U0KHZlYzQgZGF0YSwgZmxvYXQgbWluLCBmbG9hdCBtYXgpIHtcbiAgICByZXR1cm4gbWl4KG1pbiwgbWF4LCBieXRlczJmbG9hdDQoZGF0YSkpO1xufVxuXG5mbG9hdCBtYW50aXNzYUV4cG9uZW50MkZsb2F0KHZlYzQgcGFjaylcbntcbiAgICBmbG9hdCB2YWx1ZSA9IGJ5dGVzMmZsb2F0UmFuZ2UzKHBhY2sueHl6LCAtMS4wLCAxLjApO1xuICAgIGZsb2F0IGV4cG9uZW50ID0gZmxvb3IocGFjay53ICogMjU1LjAgLSAxMjcuMCk7XG4gICAgcmV0dXJuIHZhbHVlICogZXhwMihleHBvbmVudCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHVCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
