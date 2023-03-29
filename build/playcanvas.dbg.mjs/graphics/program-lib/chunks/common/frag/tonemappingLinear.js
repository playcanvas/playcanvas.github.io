/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var tonemappingLinearPS = `
uniform float exposure;

vec3 toneMap(vec3 color) {
    return color * exposure;
}
`;

export { tonemappingLinearPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9uZW1hcHBpbmdMaW5lYXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY29tbW9uL2ZyYWcvdG9uZW1hcHBpbmdMaW5lYXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnVuaWZvcm0gZmxvYXQgZXhwb3N1cmU7XG5cbnZlYzMgdG9uZU1hcCh2ZWMzIGNvbG9yKSB7XG4gICAgcmV0dXJuIGNvbG9yICogZXhwb3N1cmU7XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsMEJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBTkE7Ozs7In0=
