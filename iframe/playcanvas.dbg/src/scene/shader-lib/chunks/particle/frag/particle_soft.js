var particle_softPS = /* glsl */`
    float depth = getLinearScreenDepth();
    float particleDepth = vDepth;
    float depthDiff = saturate(abs(particleDepth - depth) * softening);
    a *= depthDiff;
`;

export { particle_softPS as default };
