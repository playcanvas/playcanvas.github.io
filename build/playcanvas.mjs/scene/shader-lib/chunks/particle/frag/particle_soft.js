var particle_softPS = `
		float depth = getLinearScreenDepth();
		float particleDepth = vDepth;
		float depthDiff = saturate(abs(particleDepth - depth) * softening);
		a *= depthDiff;
`;

export { particle_softPS as default };
