var envMultiplyPS = `
uniform float skyboxIntensity;

vec3 processEnvironment(vec3 color) {
		return color * skyboxIntensity;
}
`;

export { envMultiplyPS as default };
