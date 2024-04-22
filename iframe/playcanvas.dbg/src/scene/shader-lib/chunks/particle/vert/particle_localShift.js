var particle_localShiftVS = /* glsl */`
    particlePos = (matrix_model * vec4(particlePos, 1.0)).xyz;
`;

export { particle_localShiftVS as default };
