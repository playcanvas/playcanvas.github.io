/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var reflDirPS = `
void getReflDir() {
    dReflDirW = normalize(-reflect(dViewDirW, dNormalW));
}
`;

export { reflDirPS as default };
