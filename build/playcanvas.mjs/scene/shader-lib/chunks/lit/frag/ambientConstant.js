var ambientConstantPS = `
void addAmbient() {
		dDiffuseLight += light_globalAmbient;
}
`;

export { ambientConstantPS as default };
