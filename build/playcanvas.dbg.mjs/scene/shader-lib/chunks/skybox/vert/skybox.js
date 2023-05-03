var skyboxVS = /* glsl */`
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2t5Ym94LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3Mvc2t5Ym94L3ZlcnQvc2t5Ym94LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjMyBhUG9zaXRpb247XG5cbiNpZm5kZWYgVklFV01BVFJJWFxuI2RlZmluZSBWSUVXTUFUUklYXG51bmlmb3JtIG1hdDQgbWF0cml4X3ZpZXc7XG4jZW5kaWZcblxudW5pZm9ybSBtYXQ0IG1hdHJpeF9wcm9qZWN0aW9uU2t5Ym94O1xudW5pZm9ybSBtYXQzIGN1YmVNYXBSb3RhdGlvbk1hdHJpeDtcblxudmFyeWluZyB2ZWMzIHZWaWV3RGlyO1xuXG52b2lkIG1haW4odm9pZCkge1xuICAgIG1hdDQgdmlldyA9IG1hdHJpeF92aWV3O1xuICAgIHZpZXdbM11bMF0gPSB2aWV3WzNdWzFdID0gdmlld1szXVsyXSA9IDAuMDtcbiAgICBnbF9Qb3NpdGlvbiA9IG1hdHJpeF9wcm9qZWN0aW9uU2t5Ym94ICogdmlldyAqIHZlYzQoYVBvc2l0aW9uLCAxLjApO1xuXG4gICAgLy8gRm9yY2Ugc2t5Ym94IHRvIGZhciBaLCByZWdhcmRsZXNzIG9mIHRoZSBjbGlwIHBsYW5lcyBvbiB0aGUgY2FtZXJhXG4gICAgLy8gU3VidHJhY3QgYSB0aW55IGZ1ZGdlIGZhY3RvciB0byBlbnN1cmUgZmxvYXRpbmcgcG9pbnQgZXJyb3JzIGRvbid0XG4gICAgLy8gc3RpbGwgcHVzaCBwaXhlbHMgYmV5b25kIGZhciBaLiBTZWU6XG4gICAgLy8gaHR0cDovL3d3dy5vcGVuZ2wub3JnL2Rpc2N1c3Npb25fYm9hcmRzL3Nob3d0aHJlYWQucGhwLzE3MTg2Ny1za3lib3gtcHJvYmxlbVxuXG4gICAgZ2xfUG9zaXRpb24ueiA9IGdsX1Bvc2l0aW9uLncgLSAwLjAwMDAxO1xuICAgIHZWaWV3RGlyID0gYVBvc2l0aW9uICogY3ViZU1hcFJvdGF0aW9uTWF0cml4O1xufVxuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxlQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
