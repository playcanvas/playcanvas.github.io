var lightDiffuseLambertPS = `
float getLightDiffuse() {
    return max(dot(dNormalW, -dLightDirNormW), 0.0);
}
`;

export { lightDiffuseLambertPS as default };
