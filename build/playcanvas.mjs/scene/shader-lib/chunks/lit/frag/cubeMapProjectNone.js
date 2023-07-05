var cubeMapProjectNonePS = `
vec3 cubeMapProject(vec3 dir) {
		return cubeMapRotate(dir);
}
`;

export { cubeMapProjectNonePS as default };
