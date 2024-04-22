var particle_customFaceVS = /* glsl */`
    quadXY = rotate(quadXY, inAngle, rotMatrix);
    vec3 localPos = customFace(particlePos, quadXY);
`;

export { particle_customFaceVS as default };
