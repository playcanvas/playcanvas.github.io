/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var detailModesPS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV0YWlsTW9kZXMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3Mvc3RhbmRhcmQvZnJhZy9kZXRhaWxNb2Rlcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmVjMyBkZXRhaWxNb2RlX211bCh2ZWMzIGMxLCB2ZWMzIGMyKSB7XG4gICAgcmV0dXJuIGMxICogYzI7XG59XG5cbnZlYzMgZGV0YWlsTW9kZV9hZGQodmVjMyBjMSwgdmVjMyBjMikge1xuICAgIHJldHVybiBjMSArIGMyO1xufVxuXG4vLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CbGVuZF9tb2RlcyNTY3JlZW5cbnZlYzMgZGV0YWlsTW9kZV9zY3JlZW4odmVjMyBjMSwgdmVjMyBjMikge1xuICAgIHJldHVybiAxLjAgLSAoMS4wIC0gYzEpKigxLjAgLSBjMik7XG59XG5cbi8vIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0JsZW5kX21vZGVzI092ZXJsYXlcbnZlYzMgZGV0YWlsTW9kZV9vdmVybGF5KHZlYzMgYzEsIHZlYzMgYzIpIHtcbiAgICByZXR1cm4gbWl4KDEuMCAtIDIuMCooMS4wIC0gYzEpKigxLjAgLSBjMiksIDIuMCpjMSpjMiwgc3RlcChjMSwgdmVjMygwLjUpKSk7XG59XG5cbnZlYzMgZGV0YWlsTW9kZV9taW4odmVjMyBjMSwgdmVjMyBjMikge1xuICAgIHJldHVybiBtaW4oYzEsIGMyKTtcbn1cblxudmVjMyBkZXRhaWxNb2RlX21heCh2ZWMzIGMxLCB2ZWMzIGMyKSB7XG4gICAgcmV0dXJuIG1heChjMSwgYzIpO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG9CQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0ExQkE7Ozs7In0=
