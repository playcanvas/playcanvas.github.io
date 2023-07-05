/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var ambientConstantPS = `
void addAmbient() {
    dDiffuseLight += light_globalAmbient;
}
`;

export { ambientConstantPS as default };
