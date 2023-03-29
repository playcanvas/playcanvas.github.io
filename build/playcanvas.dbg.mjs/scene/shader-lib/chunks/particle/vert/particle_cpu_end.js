/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_cpu_endVS = /* glsl */`
    localPos *= particle_vertexData2.y * emitterScale;
    localPos += particlePos;

    gl_Position = matrix_viewProjection * vec4(localPos, 1.0);
`;

export { particle_cpu_endVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfY3B1X2VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfY3B1X2VuZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIGxvY2FsUG9zICo9IHBhcnRpY2xlX3ZlcnRleERhdGEyLnkgKiBlbWl0dGVyU2NhbGU7XG4gICAgbG9jYWxQb3MgKz0gcGFydGljbGVQb3M7XG5cbiAgICBnbF9Qb3NpdGlvbiA9IG1hdHJpeF92aWV3UHJvamVjdGlvbiAqIHZlYzQobG9jYWxQb3MsIDEuMCk7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
