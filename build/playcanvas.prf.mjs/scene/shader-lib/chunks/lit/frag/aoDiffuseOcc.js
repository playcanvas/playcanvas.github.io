/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoDiffuseOccPS = `
void occludeDiffuse() {
    dDiffuseLight *= dAo;
}
`;

export { aoDiffuseOccPS as default };
