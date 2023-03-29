/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var fullscreenQuadPS = `
varying vec2 vUv0;

uniform sampler2D source;

void main(void) {
    gl_FragColor = texture2D(source, vUv0);
}
`;

export { fullscreenQuadPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnVsbHNjcmVlblF1YWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvZnVsbHNjcmVlblF1YWQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZhcnlpbmcgdmVjMiB2VXYwO1xuXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XG5cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCk7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQVJBOzs7OyJ9
