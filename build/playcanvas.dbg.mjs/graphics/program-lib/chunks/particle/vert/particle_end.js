/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_endVS = `
    localPos *= scale * emitterScale;
    localPos += particlePos;

    #ifdef SCREEN_SPACE
    gl_Position = vec4(localPos.x, localPos.y, 0.0, 1.0);
    #else
    gl_Position = matrix_viewProjection * vec4(localPos.xyz, 1.0);
    #endif
`;

export { particle_endVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfZW5kLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfZW5kLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgbG9jYWxQb3MgKj0gc2NhbGUgKiBlbWl0dGVyU2NhbGU7XG4gICAgbG9jYWxQb3MgKz0gcGFydGljbGVQb3M7XG5cbiAgICAjaWZkZWYgU0NSRUVOX1NQQUNFXG4gICAgZ2xfUG9zaXRpb24gPSB2ZWM0KGxvY2FsUG9zLngsIGxvY2FsUG9zLnksIDAuMCwgMS4wKTtcbiAgICAjZWxzZVxuICAgIGdsX1Bvc2l0aW9uID0gbWF0cml4X3ZpZXdQcm9qZWN0aW9uICogdmVjNChsb2NhbFBvcy54eXosIDEuMCk7XG4gICAgI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEscUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBVEE7Ozs7In0=
