/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var TBNfastPS = `
void getTBN() {
		dTBN = mat3(dTangentW, dBinormalW, dVertexNormalW);
}
`;

export { TBNfastPS as default };
