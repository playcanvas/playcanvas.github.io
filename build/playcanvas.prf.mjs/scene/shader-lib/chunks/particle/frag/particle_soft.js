/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particle_softPS = `
		float depth = getLinearScreenDepth();
		float particleDepth = vDepth;
		float depthDiff = saturate(abs(particleDepth - depth) * softening);
		a *= depthDiff;
`;

export { particle_softPS as default };
