/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var viewDirPS = `
void getViewDir() {
    dViewDirW = normalize(view_position - vPositionW);
}
`;

export { viewDirPS as default };
