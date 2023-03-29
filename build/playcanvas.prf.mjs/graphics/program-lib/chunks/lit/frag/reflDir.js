/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflDirPS = `
void getReflDir() {
    dReflDirW = normalize(-reflect(dViewDirW, dNormalW));
}
`;

export { reflDirPS as default };
