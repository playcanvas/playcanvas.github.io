var particle_meshVS = /* glsl */`
    vec3 localPos = meshLocalPos;
    localPos.xy = rotate(localPos.xy, inAngle, rotMatrix);
    localPos.yz = rotate(localPos.yz, inAngle, rotMatrix);

    billboard(particlePos, quadXY);
`;

export { particle_meshVS as default };
