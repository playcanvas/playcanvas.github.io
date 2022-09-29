/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var skyboxVS = `
attribute vec3 aPosition;

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

uniform mat4 matrix_projectionSkybox;
uniform mat3 cubeMapRotationMatrix;

varying vec3 vViewDir;

void main(void) {
    mat4 view = matrix_view;
    view[3][0] = view[3][1] = view[3][2] = 0.0;
    gl_Position = matrix_projectionSkybox * view * vec4(aPosition, 1.0);

    // Force skybox to far Z, regardless of the clip planes on the camera
    // Subtract a tiny fudge factor to ensure floating point errors don't
    // still push pixels beyond far Z. See:
    // http://www.opengl.org/discussion_boards/showthread.php/171867-skybox-problem

    gl_Position.z = gl_Position.w - 0.00001;
    vViewDir = aPosition * cubeMapRotationMatrix;
}
`;

export { skyboxVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2t5Ym94LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3NreWJveC92ZXJ0L3NreWJveC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuYXR0cmlidXRlIHZlYzMgYVBvc2l0aW9uO1xuXG4jaWZuZGVmIFZJRVdNQVRSSVhcbiNkZWZpbmUgVklFV01BVFJJWFxudW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3O1xuI2VuZGlmXG5cbnVuaWZvcm0gbWF0NCBtYXRyaXhfcHJvamVjdGlvblNreWJveDtcbnVuaWZvcm0gbWF0MyBjdWJlTWFwUm90YXRpb25NYXRyaXg7XG5cbnZhcnlpbmcgdmVjMyB2Vmlld0Rpcjtcblxudm9pZCBtYWluKHZvaWQpIHtcbiAgICBtYXQ0IHZpZXcgPSBtYXRyaXhfdmlldztcbiAgICB2aWV3WzNdWzBdID0gdmlld1szXVsxXSA9IHZpZXdbM11bMl0gPSAwLjA7XG4gICAgZ2xfUG9zaXRpb24gPSBtYXRyaXhfcHJvamVjdGlvblNreWJveCAqIHZpZXcgKiB2ZWM0KGFQb3NpdGlvbiwgMS4wKTtcblxuICAgIC8vIEZvcmNlIHNreWJveCB0byBmYXIgWiwgcmVnYXJkbGVzcyBvZiB0aGUgY2xpcCBwbGFuZXMgb24gdGhlIGNhbWVyYVxuICAgIC8vIFN1YnRyYWN0IGEgdGlueSBmdWRnZSBmYWN0b3IgdG8gZW5zdXJlIGZsb2F0aW5nIHBvaW50IGVycm9ycyBkb24ndFxuICAgIC8vIHN0aWxsIHB1c2ggcGl4ZWxzIGJleW9uZCBmYXIgWi4gU2VlOlxuICAgIC8vIGh0dHA6Ly93d3cub3BlbmdsLm9yZy9kaXNjdXNzaW9uX2JvYXJkcy9zaG93dGhyZWFkLnBocC8xNzE4Njctc2t5Ym94LXByb2JsZW1cblxuICAgIGdsX1Bvc2l0aW9uLnogPSBnbF9Qb3NpdGlvbi53IC0gMC4wMDAwMTtcbiAgICB2Vmlld0RpciA9IGFQb3NpdGlvbiAqIGN1YmVNYXBSb3RhdGlvbk1hdHJpeDtcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxlQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0ExQkE7Ozs7In0=
