var particle_normalVS = /* glsl */`
    Normal = normalize(localPos + matrix_viewInverse[2].xyz);
`;

export { particle_normalVS as default };
