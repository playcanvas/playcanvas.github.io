var ambientConstantPS = `
void addAmbient(vec3 worldNormal) {
		dDiffuseLight += light_globalAmbient;
}
`;

export { ambientConstantPS as default };
