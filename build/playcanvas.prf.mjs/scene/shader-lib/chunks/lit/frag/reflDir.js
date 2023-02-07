/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var reflDirPS = `
void getReflDir() {
		dReflDirW = normalize(-reflect(dViewDirW, dNormalW));
}
`;

export { reflDirPS as default };
