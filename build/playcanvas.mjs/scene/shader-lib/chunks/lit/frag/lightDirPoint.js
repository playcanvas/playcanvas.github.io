var lightDirPointPS = `
void getLightDirPoint(vec3 lightPosW) {
		dLightDirW = vPositionW - lightPosW;
		dLightDirNormW = normalize(dLightDirW);
		dLightPosW = lightPosW;
}
`;

export { lightDirPointPS as default };
