/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var fullscreenQuadPS = /* glsl */`
varying vec2 vUv0;

uniform sampler2D source;

void main(void) {
    gl_FragColor = texture2D(source, vUv0);
}
`;

export { fullscreenQuadPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnVsbHNjcmVlblF1YWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jb21tb24vZnJhZy9mdWxsc2NyZWVuUXVhZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudmFyeWluZyB2ZWMyIHZVdjA7XG5cbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCB2VXYwKTtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
