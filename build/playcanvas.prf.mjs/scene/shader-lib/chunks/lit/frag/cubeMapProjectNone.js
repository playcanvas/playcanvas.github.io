/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var cubeMapProjectNonePS = `
vec3 cubeMapProject(vec3 dir) {
		return cubeMapRotate(dir);
}
`;

export { cubeMapProjectNonePS as default };
