/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var baseVS = `
attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec4 vertex_tangent;
attribute vec2 vertex_texCoord0;
attribute vec2 vertex_texCoord1;
attribute vec4 vertex_color;

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;

vec3 dPositionW;
mat4 dModelMatrix;
mat3 dNormalMatrix;
`;

export { baseVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9saXQvdmVydC9iYXNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjMyB2ZXJ0ZXhfcG9zaXRpb247XG5hdHRyaWJ1dGUgdmVjMyB2ZXJ0ZXhfbm9ybWFsO1xuYXR0cmlidXRlIHZlYzQgdmVydGV4X3RhbmdlbnQ7XG5hdHRyaWJ1dGUgdmVjMiB2ZXJ0ZXhfdGV4Q29vcmQwO1xuYXR0cmlidXRlIHZlYzIgdmVydGV4X3RleENvb3JkMTtcbmF0dHJpYnV0ZSB2ZWM0IHZlcnRleF9jb2xvcjtcblxudW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3UHJvamVjdGlvbjtcbnVuaWZvcm0gbWF0NCBtYXRyaXhfbW9kZWw7XG51bmlmb3JtIG1hdDMgbWF0cml4X25vcm1hbDtcblxudmVjMyBkUG9zaXRpb25XO1xubWF0NCBkTW9kZWxNYXRyaXg7XG5tYXQzIGROb3JtYWxNYXRyaXg7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsYUFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FmQTs7OzsifQ==
