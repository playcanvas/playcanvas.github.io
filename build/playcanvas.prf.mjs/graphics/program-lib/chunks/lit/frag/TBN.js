/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var TBNPS = `
void getTBN() {
    dTBN = mat3(normalize(dTangentW), normalize(dBinormalW), normalize(dVertexNormalW));
}
`;

export { TBNPS as default };
