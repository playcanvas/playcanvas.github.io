/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var cubeMapProjectNonePS = `
vec3 cubeMapProject(vec3 dir) {
    return cubeMapRotate(dir);
}
`;

export { cubeMapProjectNonePS as default };
