/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var transformDeclVS = /* glsl */`
attribute vec3 vertex_position;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

vec3 dPositionW;
mat4 dModelMatrix;
`;

export { transformDeclVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtRGVjbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NvbW1vbi92ZXJ0L3RyYW5zZm9ybURlY2wuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbmF0dHJpYnV0ZSB2ZWMzIHZlcnRleF9wb3NpdGlvbjtcblxudW5pZm9ybSBtYXQ0IG1hdHJpeF9tb2RlbDtcbnVuaWZvcm0gbWF0NCBtYXRyaXhfdmlld1Byb2plY3Rpb247XG5cbnZlYzMgZFBvc2l0aW9uVztcbm1hdDQgZE1vZGVsTWF0cml4O1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHNCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
