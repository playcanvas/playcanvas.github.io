var biasConstPS = /* glsl */`
#define SHADOWBIAS
#define SHADOW_SAMPLE_Z_BIAS

float getShadowBias(float resolution, float maxBias) {
    return maxBias;
}
`;

export { biasConstPS as default };
