/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var aoDiffuseOccPS = `
void occludeDiffuse() {
    dDiffuseLight *= dAo;
}
`;

export { aoDiffuseOccPS as default };
