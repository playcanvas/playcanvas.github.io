/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var TBNfastPS = `
void getTBN() {
    dTBN = mat3(dTangentW, dBinormalW, dVertexNormalW);
}
`;

export { TBNfastPS as default };
