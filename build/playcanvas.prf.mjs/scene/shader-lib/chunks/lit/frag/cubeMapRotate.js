/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var cubeMapRotatePS = `
#ifdef CUBEMAP_ROTATION
uniform mat3 cubeMapRotationMatrix;
#endif

vec3 cubeMapRotate(vec3 refDir) {
#ifdef CUBEMAP_ROTATION
		return refDir * cubeMapRotationMatrix;
#else
		return refDir;
#endif
}
`;

export { cubeMapRotatePS as default };
