/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var ambientConstantPS = `
void addAmbient() {
    dDiffuseLight += light_globalAmbient;
}
`;

export { ambientConstantPS as default };
