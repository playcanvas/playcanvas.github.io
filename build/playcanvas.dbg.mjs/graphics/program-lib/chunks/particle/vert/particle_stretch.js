/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_stretchVS = `
    vec3 moveDir = inVel * stretch;
    vec3 posPrev = particlePos - moveDir;
    posPrev += particlePosMoved;

    vec2 centerToVertexV = normalize((mat3(matrix_view) * localPos).xy);

    float interpolation = dot(-velocityV, centerToVertexV) * 0.5 + 0.5;

    particlePos = mix(particlePos, posPrev, interpolation);
`;

export { particle_stretchVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfc3RyZXRjaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3Byb2dyYW0tbGliL2NodW5rcy9wYXJ0aWNsZS92ZXJ0L3BhcnRpY2xlX3N0cmV0Y2guanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICB2ZWMzIG1vdmVEaXIgPSBpblZlbCAqIHN0cmV0Y2g7XG4gICAgdmVjMyBwb3NQcmV2ID0gcGFydGljbGVQb3MgLSBtb3ZlRGlyO1xuICAgIHBvc1ByZXYgKz0gcGFydGljbGVQb3NNb3ZlZDtcblxuICAgIHZlYzIgY2VudGVyVG9WZXJ0ZXhWID0gbm9ybWFsaXplKChtYXQzKG1hdHJpeF92aWV3KSAqIGxvY2FsUG9zKS54eSk7XG5cbiAgICBmbG9hdCBpbnRlcnBvbGF0aW9uID0gZG90KC12ZWxvY2l0eVYsIGNlbnRlclRvVmVydGV4VikgKiAwLjUgKyAwLjU7XG5cbiAgICBwYXJ0aWNsZVBvcyA9IG1peChwYXJ0aWNsZVBvcywgcG9zUHJldiwgaW50ZXJwb2xhdGlvbik7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEseUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FWQTs7OzsifQ==
