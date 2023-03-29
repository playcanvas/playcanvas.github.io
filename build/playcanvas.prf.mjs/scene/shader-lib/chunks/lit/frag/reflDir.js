/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflDirPS = `
void getReflDir(vec3 worldNormal, vec3 viewDir, float gloss, mat3 tbn) {
		dReflDirW = normalize(-reflect(viewDir, worldNormal));
}
`;

export { reflDirPS as default };
