/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var viewNormalVS = /* glsl */`
#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

vec3 getViewNormal() {
    return mat3(matrix_view) * vNormalW;
}
`;

export { viewNormalVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld05vcm1hbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2xpdC92ZXJ0L3ZpZXdOb3JtYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiNpZm5kZWYgVklFV01BVFJJWFxuI2RlZmluZSBWSUVXTUFUUklYXG51bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXc7XG4jZW5kaWZcblxudmVjMyBnZXRWaWV3Tm9ybWFsKCkge1xuICAgIHJldHVybiBtYXQzKG1hdHJpeF92aWV3KSAqIHZOb3JtYWxXO1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLG1CQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
