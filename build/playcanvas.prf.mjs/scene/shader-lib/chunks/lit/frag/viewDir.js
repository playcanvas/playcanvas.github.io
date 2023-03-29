/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var viewDirPS = `
void getViewDir() {
		dViewDirW = normalize(view_position - vPositionW);
}
`;

export { viewDirPS as default };
