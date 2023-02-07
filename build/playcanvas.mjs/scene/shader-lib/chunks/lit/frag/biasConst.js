var biasConstPS = `
#define SHADOWBIAS

float getShadowBias(float resolution, float maxBias) {
		return maxBias;
}
`;

export { biasConstPS as default };
