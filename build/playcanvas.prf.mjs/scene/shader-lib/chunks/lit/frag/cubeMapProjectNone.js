/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var cubeMapProjectNonePS = `
vec3 cubeMapProject(vec3 dir) {
    return cubeMapRotate(dir);
}
`;

export { cubeMapProjectNonePS as default };
