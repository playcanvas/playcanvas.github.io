/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflDirPS = `
void getReflDir(vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {
		dReflDirW = normalize(-reflect(viewDir, worldNormal));
}
`;

export { reflDirPS as default };
