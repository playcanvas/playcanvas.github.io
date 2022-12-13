/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var TBNPS = `
void getTBN() {
    dTBN = mat3(normalize(dTangentW), normalize(dBinormalW), normalize(dVertexNormalW));
}
`;

export { TBNPS as default };
