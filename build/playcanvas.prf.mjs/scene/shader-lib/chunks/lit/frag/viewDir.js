/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var viewDirPS = `
void getViewDir() {
    dViewDirW = normalize(view_position - vPositionW);
}
`;

export { viewDirPS as default };
